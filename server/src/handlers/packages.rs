use crate::AppState;
use crate::handlers::ApiError;
use crate::handlers::auth::validate_user_auth;
use crate::models::{
    AdvisoriesResponse, DBPackage, DBPackageVersion, DiscontinuePackageRequest, PackageVersion,
    PackageVersionsResponse,
};
use crate::storage;
use axum::{
    Json,
    body::Body,
    extract::{Path, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
};
use std::sync::Arc;

pub async fn list_package_versions(
    Path(package_name): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<PackageVersionsResponse>, ApiError> {
    let pkg = sqlx::query_as::<_, DBPackage>("SELECT * FROM packages WHERE name = $1")
        .bind(&package_name)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?
        .ok_or_else(|| {
            ApiError::NotFound(
                "PackageNotFound".to_string(),
                format!("Package {} not found", package_name),
            )
        })?;
    let versions = sqlx::query_as::<_, DBPackageVersion>(
        "SELECT * FROM package_versions WHERE package_id = $1 ORDER BY created_at DESC",
    )
    .bind(pkg.id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?;
    if versions.is_empty() {
        return Err(ApiError::NotFound(
            "NoVersionsFound".to_string(),
            format!("No versions found for package {}", package_name),
        ));
    }
    let latest_db = &versions[0];
    let latest = PackageVersion {
        version: latest_db.version.clone(),
        archive_url: latest_db.archive_url.clone(),
        archive_sha256: latest_db.archive_sha256.clone(),
        pubspec: latest_db.pubspec.clone(),
        retracted: latest_db.retracted,
        created_at: Some(latest_db.created_at),
    };
    let all_versions = versions
        .into_iter()
        .map(|v| PackageVersion {
            version: v.version,
            archive_url: v.archive_url,
            archive_sha256: v.archive_sha256,
            pubspec: v.pubspec,
            retracted: v.retracted,
            created_at: Some(v.created_at),
        })
        .collect();
    let download_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM downloads d INNER JOIN package_versions pv ON d.package_version_id = pv.id WHERE pv.package_id = $1"
    )
    .bind(pkg.id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?;

    let like_count =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM package_likes WHERE package_id = $1")
            .bind(pkg.id)
            .fetch_one(&state.db)
            .await
            .map_err(|e| ApiError::Internal(e.to_string()))?;

    Ok(Json(PackageVersionsResponse {
        name: pkg.name,
        is_discontinued: pkg.is_discontinued,
        replaced_by: pkg.replaced_by,
        advisories_updated: None, // TODO: Implement advisories
        download_count,
        like_count,
        latest,
        versions: all_versions,
    }))
}

pub async fn list_package_versions_tidy(
    Path(package_name): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<PackageVersion>>, ApiError> {
    let pkg = sqlx::query_as::<_, DBPackage>("SELECT * FROM packages WHERE name = $1")
        .bind(&package_name)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?
        .ok_or_else(|| {
            ApiError::NotFound(
                "PackageNotFound".to_string(),
                format!("Package {} not found", package_name),
            )
        })?;
    let versions = sqlx::query_as::<_, DBPackageVersion>(
        "SELECT * FROM package_versions WHERE package_id = $1 ORDER BY created_at DESC",
    )
    .bind(pkg.id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?;
    if versions.is_empty() {
        return Err(ApiError::NotFound(
            "NoVersionsFound".to_string(),
            format!("No versions found for package {}", package_name),
        ));
    }

    let all_versions = versions
        .into_iter()
        .map(|v| PackageVersion {
            version: v.version,
            archive_url: v.archive_url,
            archive_sha256: v.archive_sha256,
            pubspec: v.pubspec,
            retracted: v.retracted,
            created_at: Some(v.created_at),
        })
        .collect();

    Ok(Json(all_versions))
}

pub async fn get_package_details(
    headers: HeaderMap,
    Path((package_name, version)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<crate::models::FrontendPackageDetail>, ApiError> {
    // 1. Fetch Package
    let pkg = sqlx::query_as::<_, DBPackage>("SELECT * FROM packages WHERE name = $1")
        .bind(&package_name)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?
        .ok_or_else(|| {
            ApiError::NotFound(
                "PackageNotFound".to_string(),
                format!("Package {} not found", package_name),
            )
        })?;

    let owner_username = if let Some(owner_id) = pkg.owner_id {
        sqlx::query_scalar::<_, String>("SELECT username FROM users WHERE id = $1")
            .bind(owner_id)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| ApiError::Internal(e.to_string()))?
    } else {
        None
    };

    let version_query = if version == "latest" {
        "SELECT * FROM package_versions WHERE package_id = $1 ORDER BY created_at DESC LIMIT 1"
    } else {
        "SELECT * FROM package_versions WHERE package_id = $1 AND version = $2"
    };
    let version_bind = if version == "latest" {
        sqlx::query_as::<_, DBPackageVersion>(version_query).bind(pkg.id)
    } else {
        sqlx::query_as::<_, DBPackageVersion>(version_query)
            .bind(pkg.id)
            .bind(&version)
    };
    let db_version = version_bind
        .fetch_optional(&state.db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?
        .ok_or_else(|| {
            ApiError::NotFound(
                "VersionNotFound".to_string(),
                format!("Version {} not found", version),
            )
        })?;
    let analysis_record: Option<(serde_json::Value,)> = sqlx::query_as(
        "SELECT report FROM analysis_results WHERE package_version_id = $1 ORDER BY created_at DESC LIMIT 1"
    )
    .bind(db_version.id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?;
    let readme = match sqlx::query_scalar::<_, Option<String>>(
        "SELECT readme FROM package_versions WHERE id = $1",
    )
    .bind(db_version.id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        _ => None,
    };
    let download_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM downloads d INNER JOIN package_versions pv ON d.package_version_id = pv.id WHERE pv.package_id = $1"
    )
    .bind(pkg.id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?;

    let like_count =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM package_likes WHERE package_id = $1")
            .bind(pkg.id)
            .fetch_one(&state.db)
            .await
            .map_err(|e| ApiError::Internal(e.to_string()))?;

    let is_liked = if let Ok(user) = validate_user_auth(&headers, &state.db).await {
        sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM package_likes WHERE package_id = $1 AND user_id = $2)",
        )
        .bind(pkg.id)
        .bind(user.id)
        .fetch_one(&state.db)
        .await
        .unwrap_or_default()
    } else {
        false
    };

    Ok(Json(crate::models::FrontendPackageDetail {
        package: pkg,
        version: PackageVersion {
            version: db_version.version,
            archive_url: db_version.archive_url,
            archive_sha256: db_version.archive_sha256,
            pubspec: db_version.pubspec,
            retracted: db_version.retracted,
            created_at: Some(db_version.created_at),
        },
        readme,
        analysis: analysis_record.map(|r| r.0),
        owner_username,
        download_count,
        like_count,
        is_liked,
    }))
}

pub async fn inspect_package_version(
    Path((package_name, version)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<PackageVersion>, ApiError> {
    let pkg = sqlx::query_as::<_, DBPackage>("SELECT * FROM packages WHERE name = $1")
        .bind(&package_name)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?
        .ok_or_else(|| {
            ApiError::NotFound(
                "PackageNotFound".to_string(),
                format!("Package {} not found", package_name),
            )
        })?;
    let db_version = sqlx::query_as::<_, DBPackageVersion>(
        "SELECT * FROM package_versions WHERE package_id = $1 AND version = $2",
    )
    .bind(pkg.id)
    .bind(&version)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .ok_or_else(|| {
        ApiError::NotFound(
            "VersionNotFound".to_string(),
            format!("Version {} of package {} not found", version, package_name),
        )
    })?;
    Ok(Json(PackageVersion {
        version: db_version.version,
        archive_url: db_version.archive_url,
        archive_sha256: db_version.archive_sha256,
        pubspec: db_version.pubspec,
        retracted: db_version.retracted,
        created_at: Some(db_version.created_at),
    }))
}

pub async fn download_package(
    Path((name, version)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, ApiError> {
    let version = version.strip_suffix(".tar.gz").unwrap_or(&version);
    let version = version
        .strip_prefix(&format!("{}-", name))
        .unwrap_or(version);

    let version_id = sqlx::query_scalar::<_, uuid::Uuid>(
        "SELECT pv.id FROM package_versions pv
         INNER JOIN packages p ON p.id = pv.package_id
         WHERE p.name = $1 AND pv.version = $2",
    )
    .bind(&name)
    .bind(&version)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .ok_or_else(|| {
        ApiError::NotFound(
            "PackageNotFound".to_string(),
            format!("Package {} version {} not found", name, version),
        )
    })?;

    // Record download asynchronously - ignoring failure
    let db_clone = state.db.clone();
    tokio::spawn(async move {
        let _ = sqlx::query("INSERT INTO downloads (package_version_id) VALUES ($1)")
            .bind(version_id)
            .execute(&db_clone)
            .await;
    });

    // Use storage abstraction to determine how to retrieve the package
    match state
        .storage
        .get_download_url(&name, &version)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?
    {
        storage::PackageRetrieval::Redirect(url) => {
            // For S3 (or remote), redirect to the presigned URL
            Ok(Response::builder()
                .status(StatusCode::FOUND)
                .header(header::LOCATION, url)
                .body(Body::empty())
                .unwrap())
        }
        storage::PackageRetrieval::File(path) => {
            // For local file, serve it directly
            let file = tokio::fs::File::open(path)
                .await
                .map_err(|e| ApiError::Internal(e.to_string()))?;
            let stream = tokio_util::io::ReaderStream::new(file);
            let body = Body::from_stream(stream);
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/octet-stream")
                .header(
                    header::CONTENT_DISPOSITION,
                    format!("attachment; filename=\"{}-{}.tar.gz\"", name, version),
                )
                .body(body)
                .unwrap())
        }
    }
}

pub async fn list_package_advisories(
    Path(package_name): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<AdvisoriesResponse>, ApiError> {
    // Verify package exists
    let _pkg = sqlx::query_as::<_, DBPackage>("SELECT * FROM packages WHERE name = $1")
        .bind(&package_name)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?
        .ok_or_else(|| {
            ApiError::NotFound(
                "PackageNotFound".to_string(),
                format!("Package {} not found", package_name),
            )
        })?;
    // For now, return empty advisories
    Ok(Json(AdvisoriesResponse {
        advisories: vec![],
        advisories_updated: chrono::Utc::now(),
    }))
}

pub async fn discontinue_package(
    headers: HeaderMap,
    Path(package_name): Path<String>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<DiscontinuePackageRequest>,
) -> Result<Json<DBPackage>, ApiError> {
    let user = validate_user_auth(&headers, &state.db).await?;

    // 1. Fetch Package
    let pkg = sqlx::query_as::<_, DBPackage>("SELECT * FROM packages WHERE name = $1")
        .bind(&package_name)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?
        .ok_or_else(|| {
            ApiError::NotFound(
                "PackageNotFound".to_string(),
                format!("Package {} not found", package_name),
            )
        })?;

    // 2. Check Permissions (Owner or Admin)
    let is_owner = pkg.owner_id == Some(user.id);
    if !is_owner && !user.is_admin {
        return Err(ApiError::Forbidden(
            "PermissionDenied: You must be the owner or an admin to discontinue this package"
                .to_string(),
        ));
    }

    // 3. Validate Replacement Package (if specified)
    if let Some(ref replaced_by) = payload.replaced_by {
        let replacement_exists = sqlx::query("SELECT 1 FROM packages WHERE name = $1")
            .bind(replaced_by)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| ApiError::Internal(e.to_string()))?
            .is_some();

        if !replacement_exists {
            return Err(ApiError::BadRequest(
                "ReplacementPackageNotFound".to_string(),
                format!("Replacement package '{}' not found", replaced_by),
            ));
        }
    }

    // 4. Update Package
    let updated_pkg = sqlx::query_as::<_, DBPackage>(
        "UPDATE packages SET is_discontinued = TRUE, replaced_by = $1, updated_at = NOW() WHERE id = $2 RETURNING *"
    )
    .bind(payload.replaced_by)
    .bind(pkg.id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?;

    // 5. Update Search Index
    // Fetch info needed for indexing (latest version info)
    let search_info: Option<(
        String,
        Option<String>,
        Option<i32>,
        Option<String>,
        Option<String>,
    )> = sqlx::query_as(
        r#"
        SELECT 
            v.version, 
            v.pubspec->>'description',
            ar.score,
            u.username,
            u.avatar_url
        FROM package_versions v
        LEFT JOIN analysis_results ar ON v.id = ar.package_version_id
        LEFT JOIN users u ON $2 = u.id
        WHERE v.package_id = $1
        ORDER BY v.created_at DESC
        LIMIT 1
        "#,
    )
    .bind(updated_pkg.id)
    .bind(updated_pkg.owner_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?;

    if let Some((version, description, score, owner_username, owner_avatar)) = search_info {
        if let Some(search) = &state.search {
            let _ = search
                .index("packages")
                .add_documents(
                    &[serde_json::json!({
                        "id": updated_pkg.name,
                        "name": updated_pkg.name,
                        "version": version,
                        "description": description,
                        "score": score,
                        "is_discontinued": updated_pkg.is_discontinued,
                        "replaced_by": updated_pkg.replaced_by,
                        "updated_at": chrono::Utc::now(),
                        "owner_username": owner_username,
                        "owner_avatar": owner_avatar,
                    })],
                    Some("id"),
                )
                .await;
        }
    }

    Ok(Json(updated_pkg))
}

pub async fn like_package(
    headers: HeaderMap,
    Path(package_name): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode, ApiError> {
    let user = validate_user_auth(&headers, &state.db).await?;

    let pkg = sqlx::query_as::<_, DBPackage>("SELECT * FROM packages WHERE name = $1")
        .bind(&package_name)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?
        .ok_or_else(|| {
            ApiError::NotFound(
                "PackageNotFound".to_string(),
                format!("Package {} not found", package_name),
            )
        })?;

    sqlx::query(
        "INSERT INTO package_likes (package_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    )
    .bind(pkg.id)
    .bind(user.id)
    .execute(&state.db)
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?;

    Ok(StatusCode::OK)
}

pub async fn unlike_package(
    headers: HeaderMap,
    Path(package_name): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode, ApiError> {
    let user = validate_user_auth(&headers, &state.db).await?;

    let pkg = sqlx::query_as::<_, DBPackage>("SELECT * FROM packages WHERE name = $1")
        .bind(&package_name)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?
        .ok_or_else(|| {
            ApiError::NotFound(
                "PackageNotFound".to_string(),
                format!("Package {} not found", package_name),
            )
        })?;

    sqlx::query("DELETE FROM package_likes WHERE package_id = $1 AND user_id = $2")
        .bind(pkg.id)
        .bind(user.id)
        .execute(&state.db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    Ok(StatusCode::OK)
}
