use crate::AppState;
use crate::handlers::ApiError;
use crate::handlers::auth::validate_auth;
use crate::models::{DBPackage, PublishResponse, SuccessMessage, SuccessResponse};
use crate::utils::get_base_url;
use axum::{
    Json,
    extract::{Multipart, Path, State},
    http::{HeaderMap, StatusCode, header},
    response::IntoResponse,
};
use flate2::read::GzDecoder;
use std::collections::HashMap;
use std::io::Read;
use std::sync::Arc;
use tar::Archive;
use uuid::Uuid;

pub async fn publish_new_version(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
) -> Result<Json<PublishResponse>, ApiError> {
    validate_auth(&headers, &state.db).await?;

    let (scheme, host) = get_base_url()?;
    let upload_url = format!("{}://{}/api/upload", scheme, host);

    let mut fields = HashMap::new();
    let upload_id = Uuid::new_v4().to_string();
    fields.insert("token".to_string(), upload_id);

    Ok(Json(PublishResponse {
        url: upload_url,
        fields,
    }))
}

pub async fn upload_package(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, ApiError> {
    let token = validate_auth(&headers, &state.db).await?;

    let mut package_data = None;
    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or_default().to_string();
        if name == "file" {
            package_data = Some(
                field
                    .bytes()
                    .await
                    .map_err(|e| ApiError::Internal(e.to_string()))?,
            );
        }
    }
    let data = package_data.ok_or_else(|| {
        ApiError::BadRequest(
            "MissingFile".to_string(),
            "No file field in multipart".to_string(),
        )
    })?;
    let upload_id = Uuid::new_v4();
    let temp_path = std::env::temp_dir().join(format!("fulla-upload-{}-{}", upload_id, token.id));
    tokio::fs::write(&temp_path, data)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    let (scheme, host) = match get_base_url() {
        Ok((s, h)) => (s, h),
        Err(_) => ("http".to_string(), "localhost:3000".to_string()),
    };

    let finalize_url = format!("{}://{}/api/publish/finalize/{}", scheme, host, upload_id);
    Ok((StatusCode::NO_CONTENT, [(header::LOCATION, finalize_url)]))
}

pub async fn finalize_publish(
    headers: HeaderMap,
    Path(upload_id): Path<Uuid>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<SuccessResponse>, ApiError> {
    let token = validate_auth(&headers, &state.db).await?;
    let temp_path = std::env::temp_dir().join(format!("fulla-upload-{}-{}", upload_id, token.id));
    if !temp_path.exists() {
        return Err(ApiError::NotFound(
            "UploadNotFound".to_string(),
            "No uploaded file found for this ID".to_string(),
        ));
    }
    let data = tokio::fs::read(&temp_path)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    let gz = GzDecoder::new(&data[..]);
    let mut archive = Archive::new(gz);
    let mut pubspec_val = None;
    for entry in archive
        .entries()
        .map_err(|e| ApiError::BadRequest("InvalidArchive".to_string(), e.to_string()))?
    {
        let mut entry =
            entry.map_err(|e| ApiError::BadRequest("InvalidArchive".to_string(), e.to_string()))?;
        let path = entry.path().map_err(|_| {
            ApiError::BadRequest("InvalidArchive".to_string(), "Invalid path".to_string())
        })?;
        if path.to_str() == Some("pubspec.yaml") {
            let mut yaml_content = String::new();
            entry.read_to_string(&mut yaml_content).map_err(|_| {
                ApiError::BadRequest(
                    "InvalidPubspec".to_string(),
                    "Failed to read pubspec.yaml".to_string(),
                )
            })?;
            let pubspec: serde_json::Value = serde_yaml::from_str(&yaml_content)
                .map_err(|e| ApiError::BadRequest("InvalidPubspec".to_string(), e.to_string()))?;
            pubspec_val = Some(pubspec);
            break;
        }
    }
    let pubspec = pubspec_val.ok_or_else(|| {
        ApiError::BadRequest(
            "MissingPubspec".to_string(),
            "pubspec.yaml not found in archive".to_string(),
        )
    })?;
    let name = pubspec["name"].as_str().ok_or_else(|| {
        ApiError::BadRequest(
            "InvalidPubspec".to_string(),
            "Package name missing in pubspec".to_string(),
        )
    })?;
    let version = pubspec["version"].as_str().ok_or_else(|| {
        ApiError::BadRequest(
            "InvalidPubspec".to_string(),
            "Package version missing in pubspec".to_string(),
        )
    })?;
    crate::utils::validate_identifier(name, "Package name")?;
    crate::utils::validate_identifier(version, "Package version")?;
    let stored = state
        .storage
        .store_package(name, version, &data)
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to store package: {}", e)))?;
    let _ = tokio::fs::remove_file(&temp_path).await;

    let (scheme, host) = get_base_url()?;
    let archive_url = format!(
        "{}://{}/packages/{}/versions/{}.tar.gz",
        scheme, host, name, version
    );
    let mut tx = state
        .db
        .begin()
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    let existing_pkg = sqlx::query_as::<_, DBPackage>("SELECT * FROM packages WHERE name = $1")
        .bind(&name)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    let pkg_id = if let Some(pkg) = existing_pkg {
        if let Some(owner_id) = pkg.owner_id {
            if let Some(token_user_id) = token.user_id {
                if owner_id != token_user_id {
                    return Err(ApiError::BadRequest(
                        "PackageOwnedByOther".to_string(),
                        "Package is already owned by another user".to_string(),
                    ));
                }
            } else {
                return Err(ApiError::Forbidden("TokenMissingUser".to_string()));
            }
        } else if let Some(token_user_id) = token.user_id {
            sqlx::query("UPDATE packages SET owner_id = $1, updated_at = NOW() WHERE id = $2")
                .bind(token_user_id)
                .bind(pkg.id)
                .execute(&mut *tx)
                .await
                .map_err(|e| ApiError::Internal(e.to_string()))?;
        }

        sqlx::query("UPDATE packages SET updated_at = NOW() WHERE id = $1")
            .bind(pkg.id)
            .execute(&mut *tx)
            .await
            .map_err(|e| ApiError::Internal(e.to_string()))?;

        pkg.id
    } else {
        sqlx::query_scalar("INSERT INTO packages (name, owner_id) VALUES ($1, $2) RETURNING id")
            .bind(&name)
            .bind(token.user_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| ApiError::Internal(e.to_string()))?
    };

    sqlx::query(
        "INSERT INTO package_versions (package_id, version, pubspec, archive_url, archive_sha256) VALUES ($1, $2, $3, $4, $5)"
    )
    .bind(pkg_id)
    .bind(version)
    .bind(&pubspec)
    .bind(&archive_url)
    .bind(&stored.sha256)
    .execute(&mut *tx)
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?;
    tx.commit()
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    crate::worker::spawn_analysis(state.clone(), name.to_string(), version.to_string()).await;
    Ok(Json(SuccessResponse {
        success: SuccessMessage {
            message: format!("Successfully published {} v{}", name, version),
        },
    }))
}
