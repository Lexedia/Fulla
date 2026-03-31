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
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::Deserialize;
use std::collections::HashMap;
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
    let mut version_downloads: HashMap<uuid::Uuid, i64> = HashMap::new();
    if let Ok(records) = sqlx::query!(
        "SELECT package_version_id, COUNT(*) as count FROM downloads d INNER JOIN package_versions pv ON d.package_version_id = pv.id WHERE pv.package_id = $1 GROUP BY package_version_id",
        pkg.id
    )
    .fetch_all(&state.db)
    .await {
        for r in records {
            version_downloads.insert(r.package_version_id, r.count.unwrap_or(0));
        }
    }

    let latest_db = &versions[0];
    let latest = PackageVersion {
        version: latest_db.version.clone(),
        archive_url: latest_db.archive_url.clone(),
        archive_sha256: latest_db.archive_sha256.clone(),
        pubspec: latest_db.pubspec.clone(),
        retracted: latest_db.retracted,
        created_at: Some(latest_db.created_at),
        download_count: version_downloads.get(&latest_db.id).copied().unwrap_or(0),
    };
    let all_versions = versions
        .into_iter()
        .map(|v| {
            let dc = version_downloads.get(&v.id).copied().unwrap_or(0);
            PackageVersion {
                version: v.version,
                archive_url: v.archive_url,
                archive_sha256: v.archive_sha256,
                pubspec: v.pubspec,
                retracted: v.retracted,
                created_at: Some(v.created_at),
                download_count: dc,
            }
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

    let advisories_updated = sqlx::query_scalar::<_, chrono::DateTime<chrono::Utc>>(
        "SELECT MAX(updated_at) FROM advisories WHERE package_id = $1",
    )
    .bind(pkg.id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    Ok(Json(PackageVersionsResponse {
        name: pkg.name,
        is_discontinued: pkg.is_discontinued,
        replaced_by: pkg.replaced_by,
        advisories_updated,
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

    let mut version_downloads: std::collections::HashMap<uuid::Uuid, i64> =
        std::collections::HashMap::new();
    if let Ok(records) = sqlx::query!(
        "SELECT package_version_id, COUNT(*) as count FROM downloads d INNER JOIN package_versions pv ON d.package_version_id = pv.id WHERE pv.package_id = $1 GROUP BY package_version_id",
        pkg.id
    )
    .fetch_all(&state.db)
    .await {
        for r in records {
            version_downloads.insert(r.package_version_id, r.count.unwrap_or(0));
        }
    }

    let all_versions = versions
        .into_iter()
        .map(|v| {
            let dc = version_downloads.get(&v.id).copied().unwrap_or(0);
            PackageVersion {
                version: v.version,
                archive_url: v.archive_url,
                archive_sha256: v.archive_sha256,
                pubspec: v.pubspec,
                retracted: v.retracted,
                created_at: Some(v.created_at),
                download_count: dc,
            }
        })
        .collect();

    Ok(Json(all_versions))
}

pub async fn get_package_details(
    headers: HeaderMap,
    Path((package_name, version)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<crate::models::FrontendPackageDetail>, ApiError> {
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

    let version_dl_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM downloads WHERE package_version_id = $1",
    )
    .bind(db_version.id)
    .fetch_one(&state.db)
    .await
    .unwrap_or_default();

    Ok(Json(crate::models::FrontendPackageDetail {
        package: pkg,
        version: PackageVersion {
            version: db_version.version,
            archive_url: db_version.archive_url,
            archive_sha256: db_version.archive_sha256,
            pubspec: db_version.pubspec,
            retracted: db_version.retracted,
            created_at: Some(db_version.created_at),
            download_count: version_dl_count,
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
    let version_dl_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM downloads WHERE package_version_id = $1",
    )
    .bind(db_version.id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    Ok(Json(PackageVersion {
        version: db_version.version,
        archive_url: db_version.archive_url,
        archive_sha256: db_version.archive_sha256,
        pubspec: db_version.pubspec,
        retracted: db_version.retracted,
        created_at: Some(db_version.created_at),
        download_count: version_dl_count,
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

    let db_clone = state.db.clone();
    tokio::spawn(async move {
        let _ = sqlx::query("INSERT INTO downloads (package_version_id) VALUES ($1)")
            .bind(version_id)
            .execute(&db_clone)
            .await;
    });

    match state
        .storage
        .get_download_url(&name, &version)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?
    {
        storage::PackageRetrieval::Redirect(url) => Ok(Response::builder()
            .status(StatusCode::FOUND)
            .header(header::LOCATION, url)
            .body(Body::empty())
            .unwrap()),
        storage::PackageRetrieval::File(path) => {
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

    let db_advisories = sqlx::query_as::<_, crate::models::DBAdvisory>(
        "SELECT * FROM advisories WHERE package_id = $1 ORDER BY created_at DESC",
    )
    .bind(pkg.id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?;

    let advisories_updated = db_advisories.first().map(|a| a.updated_at);

    let all_versions = sqlx::query_scalar::<_, String>(
        "SELECT version FROM package_versions WHERE package_id = $1"
    )
    .bind(pkg.id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let advisories = db_advisories
        .into_iter()
        .map(|a| {
            let mut affected_vers = Vec::new();
            if a.affected_versions == "*" {
                affected_vers = all_versions.clone();
            } else if let Ok(req) = semver::VersionReq::parse(&a.affected_versions) {
                let patched_req = a.patched_versions.as_ref().and_then(|p| semver::VersionReq::parse(p).ok());
                for v in &all_versions {
                    if let Ok(ver) = semver::Version::parse(v) {
                        if req.matches(&ver) {
                            if let Some(ref p_req) = patched_req {
                                if p_req.matches(&ver) {
                                    continue;
                                }
                            }
                            affected_vers.push(v.clone());
                        }
                    }
                }
            }

            let pub_display_url = a.url.clone();

            crate::models::OsvAdvisory {
                schema_version: "1.7.5".to_string(),
                id: a.id.to_string(),
                modified: a.updated_at,
                published: a.created_at,
                withdrawn: None,
                aliases: vec![],
                upstream: vec![],
                related: vec![],
                summary: a.title,
                details: a.description,
                severity: vec![],
                affected: vec![crate::models::OsvAffected {
                    package: crate::models::OsvPackage {
                        ecosystem: "Pub".to_string(),
                        name: pkg.name.clone(),
                    },
                    severity: vec![],
                    ranges: vec![crate::models::OsvRange {
                        range_type: "ECOSYSTEM".to_string(),
                        events: vec![crate::models::OsvEvent {
                            introduced: Some(if a.affected_versions == "*" {
                                "0".to_string()
                            } else {
                                a.affected_versions
                            }),
                            fixed: a.patched_versions,
                        }],
                    }],
                    versions: affected_vers,
                    ecosystem_specific: std::collections::HashMap::new(),
                    database_specific: std::collections::HashMap::new(),
                }],
                references: if let Some(url) = a.url {
                    vec![crate::models::OsvReference {
                        ref_type: "WEB".to_string(),
                        url,
                    }]
                } else {
                    vec![]
                },
                credits: vec![],
                database_specific: crate::models::OsvDatabaseSpecific {
                    severity: Some(a.severity),
                    pub_display_url,
                },
            }
        })
        .collect();

    Ok(Json(AdvisoriesResponse {
        advisories,
        advisories_updated,
    }))
}

pub async fn discontinue_package(
    headers: HeaderMap,
    Path(package_name): Path<String>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<DiscontinuePackageRequest>,
) -> Result<Json<DBPackage>, ApiError> {
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

    let is_owner = pkg.owner_id == Some(user.id);
    if !is_owner && !user.is_admin {
        return Err(ApiError::Forbidden(
            "PermissionDenied: You must be the owner or an admin to discontinue this package"
                .to_string(),
        ));
    }

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

    let updated_pkg = sqlx::query_as::<_, DBPackage>(
        "UPDATE packages SET is_discontinued = TRUE, replaced_by = $1, updated_at = NOW() WHERE id = $2 RETURNING *"
    )
    .bind(payload.replaced_by)
    .bind(pkg.id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?;

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

#[derive(Deserialize)]
pub struct DownloadQuery {
    pub range: Option<String>,
}

pub async fn get_package_downloads(
    Path(package_name): Path<String>,
    Query(query): Query<DownloadQuery>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<crate::models::PackageDownloadsResponse>, ApiError> {
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

    let days = match query.range.as_deref() {
        Some("30d") => 30,
        Some("90d") => 90,
        Some("all") => 36500,
        _ => 30,
    };

    let records = sqlx::query_as::<_, crate::models::DownloadSeriesRow>(
        r#"
        SELECT DATE_TRUNC('day', d.download_time) as date, pv.version, COUNT(*)::bigint as count
        FROM downloads d
        INNER JOIN package_versions pv ON d.package_version_id = pv.id
        WHERE pv.package_id = $1 AND d.download_time > NOW() - INTERVAL '1 day' * $2
        GROUP BY date, pv.version
        ORDER BY date ASC
        "#,
    )
    .bind(pkg.id)
    .bind(days as f64)
    .fetch_all(&state.db)
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?;

    Ok(Json(crate::models::PackageDownloadsResponse {
        data: records,
    }))
}
