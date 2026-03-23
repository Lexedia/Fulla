use crate::AppState;
use std::sync::Arc;
use tokio::process::Command;
use tracing::{error, info};
use uuid::Uuid;

pub async fn spawn_analysis(state: Arc<AppState>, package_name: String, version: String) {
    tokio::spawn(async move {
        if let Err(e) = run_analysis(state, package_name, version).await {
            error!("Analysis failed: {}", e);
        }
    });
}

async fn run_analysis(state: Arc<AppState>, name: String, version: String) -> anyhow::Result<()> {
    info!("Starting analysis for {} v{}", name, version);

    // Retrieve package data using storage abstraction
    let data = state.storage.get_package_data(&name, &version).await?;

    let extract_path = std::env::temp_dir().join(format!("fulla-ana-{}-{}", name, version));
    if extract_path.exists() {
        std::fs::remove_dir_all(&extract_path)?;
    }
    std::fs::create_dir_all(&extract_path)?;

    // Extract tarball
    let gz = flate2::read::GzDecoder::new(&data[..]);
    let mut archive = tar::Archive::new(gz);
    archive.set_overwrite(false);
    archive.set_unpack_xattrs(false);
    archive.unpack(&extract_path)?;

    // Get version ID and pubspec
    let (version_id, pubspec): (Uuid, serde_json::Value) = sqlx::query_as(
        "SELECT v.id, v.pubspec FROM package_versions v JOIN packages p ON v.package_id = p.id WHERE p.name = $1 AND v.version = $2"
    )
    .bind(&name)
    .bind(&version)
    .fetch_one(&state.db)
    .await?;

    // Look for README
    let mut readme_content = None;
    for entry in std::fs::read_dir(&extract_path)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() {
            if let Some(fname) = path.file_name().and_then(|s| s.to_str()) {
                if fname.to_uppercase().starts_with("README") {
                    if let Ok(content) = std::fs::read_to_string(&path) {
                        readme_content = Some(content);
                        break;
                    }
                }
            }
        }
    }

    if let Some(readme) = &readme_content {
        sqlx::query("UPDATE package_versions SET readme = $1 WHERE id = $2")
            .bind(readme)
            .bind(version_id)
            .execute(&state.db)
            .await?;
        info!("Updated README for {} v{}", name, version);
    }

    let description = pubspec
        .get("description")
        .and_then(|d| d.as_str())
        .map(|s| s.to_string());

    // Get owner information and discontinuation status
    let (owner_username, owner_avatar, is_discontinued, replaced_by): (
        Option<String>,
        Option<String>,
        bool,
        Option<String>,
    ) = sqlx::query_as(
        "SELECT u.username, u.avatar_url, p.is_discontinued, p.replaced_by FROM packages p 
         LEFT JOIN users u ON p.owner_id = u.id 
         WHERE p.name = $1",
    )
    .bind(&name)
    .fetch_one(&state.db)
    .await?;

    if let Some(search) = &state.search {
        let _ = search
            .index("packages")
            .add_documents(
                &[serde_json::json!({
                    "id": name,
                    "name": name,
                    "version": version,
                    "description": description,
                    "readme": readme_content,
                    "is_discontinued": is_discontinued,
                    "replaced_by": replaced_by,
                    "updated_at": chrono::Utc::now(),
                    "owner_username": owner_username,
                    "owner_avatar": owner_avatar,
                })],
                Some("id"),
            )
            .await;
    }

    // Run dart pub get to fetch dependencies before analysis
    info!("Running dart pub get for {} v{}", name, version);
    let pub_get = Command::new("dart")
        .arg("pub")
        .arg("get")
        .current_dir(&extract_path)
        .output()
        .await;

    match pub_get {
        Ok(output) if output.status.success() => {
            info!(
                "Successfully fetched dependencies for {} v{}",
                name, version
            );
        }
        Ok(output) => {
            error!(
                "dart pub get failed for {} v{}: {}",
                name,
                version,
                String::from_utf8_lossy(&output.stderr)
            );
        }
        Err(e) => {
            error!("Failed to run dart pub get: {}", e);
        }
    }

    // Run pana analysis if available
    let pana_output = Command::new("pana")
        .arg("--json")
        .current_dir(&extract_path)
        .output()
        .await;

    match pana_output {
        Ok(output) => {
            if output.status.success() {
                let report: serde_json::Value = serde_json::from_slice(&output.stdout)?;

                let score = report["scores"]["grantedPoints"].as_i64().unwrap_or(0);

                // Extract platforms from tags: "platform:android", "platform:ios", etc.
                let platforms: Vec<String> = report["tags"]
                    .as_array()
                    .map(|tags| {
                        tags.iter()
                            .filter_map(|t| t.as_str())
                            .filter(|t| t.starts_with("platform:"))
                            .map(|t| t.replace("platform:", ""))
                            .collect()
                    })
                    .unwrap_or_default();

                sqlx::query(
                    "INSERT INTO analysis_results (package_version_id, score, report) VALUES ($1, $2, $3)",
                )
                .bind(version_id)
                .bind(score as i32)
                .bind(&report)
                .execute(&state.db)
                .await?;

                info!(
                    "Pana analysis completed for {} v{} (score: {}, platforms: {:?})",
                    name, version, score, platforms
                );

                // Update Meilisearch with score and platforms
                if let Some(search) = &state.search {
                    let _ = search
                        .index("packages")
                        .add_documents(
                            &[serde_json::json!({
                                "id": name,
                                "name": name,
                                "version": version,
                                "description": description,
                                "score": score,
                                "platforms": platforms,
                                "is_discontinued": is_discontinued,
                                "replaced_by": replaced_by,
                                "updated_at": chrono::Utc::now(),
                                "owner_username": owner_username,
                                "owner_avatar": owner_avatar,
                            })],
                            Some("id"),
                        )
                        .await;
                }
            } else {
                error!(
                    "Pana failed for {} v{}: {}",
                    name,
                    version,
                    String::from_utf8_lossy(&output.stderr)
                );
            }
        }
        Err(e) => {
            info!("Pana not available (skipping analysis): {}", e);
            // Don't fail the whole function if Pana is missing, we still indexed it above.
        }
    }

    // Generate docs
    if let Err(e) = generate_docs(&state, &name, &version, &extract_path).await {
        error!("Failed to generate docs for {} v{}: {}", name, version, e);
    }

    // Cleanup
    let _ = std::fs::remove_dir_all(&extract_path);

    Ok(())
}

async fn generate_docs(
    _state: &Arc<AppState>,
    name: &str,
    version: &str,
    extract_path: &std::path::Path,
) -> anyhow::Result<()> {
    info!("Generating documentation for {} v{}", name, version);

    // Run dartdoc
    let output = match Command::new("dartdoc")
        .current_dir(extract_path)
        .output()
        .await
    {
        Ok(out) => out,
        Err(e) => {
            info!(
                "dartdoc not available (skipping documentation generation): {}",
                e
            );
            return Ok(());
        }
    };

    if !output.status.success() {
        error!(
            "dartdoc failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        return Ok(());
    }

    // Determine storage path (default to ./storage/docs)
    let storage_path = std::env::var("STORAGE_PATH").unwrap_or_else(|_| "storage".to_string());
    let docs_base = std::path::Path::new(&storage_path).join("docs").join(name);
    let docs_dir = docs_base.join(version);

    if docs_dir.exists() {
        tokio::fs::remove_dir_all(&docs_dir).await?;
    }
    tokio::fs::create_dir_all(&docs_dir).await?;

    let api_dir = extract_path.join("doc").join("api");
    if !api_dir.exists() {
        error!("dartdoc did not generate doc/api directory");
        return Ok(());
    }

    // Copy contents of api_dir to docs_dir
    let status = Command::new("cp")
        .arg("-r")
        .arg(".")
        .arg(&docs_dir)
        .current_dir(&api_dir)
        .status()
        .await?;

    if !status.success() {
        error!("Failed to copy docs to storage");
        return Err(anyhow::anyhow!("Failed to copy docs"));
    }

    // Pruning
    if let Err(e) = prune_old_docs(&storage_path, name).await {
        error!("Failed to prune old docs: {}", e);
    }

    Ok(())
}

async fn prune_old_docs(storage_path: &str, name: &str) -> anyhow::Result<()> {
    let max_versions = std::env::var("MAX_DOC_VERSIONS")
        .unwrap_or_else(|_| "5".to_string())
        .parse::<usize>()
        .unwrap_or(5);

    let package_docs_dir = std::path::Path::new(storage_path).join("docs").join(name);
    if !package_docs_dir.exists() {
        return Ok(());
    }

    let mut versions = Vec::new();
    let mut entries = tokio::fs::read_dir(&package_docs_dir).await?;
    while let Some(entry) = entries.next_entry().await? {
        if entry.file_type().await?.is_dir() {
            if let Some(v_str) = entry.file_name().to_str() {
                if let Ok(semver) = semver::Version::parse(v_str) {
                    versions.push((semver, entry.path()));
                }
            }
        }
    }

    // Sort descending
    versions.sort_by(|a, b| b.0.cmp(&a.0));

    if versions.len() > max_versions {
        for (_, path) in versions.iter().skip(max_versions) {
            info!("Pruning old docs: {:?}", path);
            tokio::fs::remove_dir_all(path).await?;
        }
    }

    Ok(())
}
