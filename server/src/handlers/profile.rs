use crate::AppState;
use crate::handlers::ApiError;
use crate::storage;
use axum::{
    Json,
    body::Body,
    extract::{Multipart, Path, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
};
use jsonwebtoken::{DecodingKey, Validation, decode};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String, // user_id
    exp: usize,
    admin: bool,
}

pub async fn upload_avatar(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<Json<AvatarUploadResponse>, ApiError> {
    // Validate JWT token
    let token = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .ok_or_else(|| {
            ApiError::Unauthorized("Missing or invalid authorization header".to_string())
        })?;

    let secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| ApiError::Unauthorized("Invalid token".to_string()))?;

    let user_id = token_data.claims.sub;

    let mut image_data = None;
    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or_default().to_string();
        if name == "avatar" || name == "file" {
            let data = field
                .bytes()
                .await
                .map_err(|e| ApiError::Internal(e.to_string()))?;

            if data.len() > 10 * 1024 * 1024 {
                return Err(ApiError::BadRequest(
                    "FileTooLarge".to_string(),
                    "Avatar must be less than 10 MiB".to_string(),
                ));
            }

            image_data = Some(data.to_vec());
            break;
        }
    }

    let image_bytes = image_data.ok_or_else(|| {
        ApiError::BadRequest(
            "MissingFile".to_string(),
            "No image file in request".to_string(),
        )
    })?;

    let format = image::guess_format(&image_bytes)
        .map_err(|e| ApiError::BadRequest("InvalidImage".to_string(), e.to_string()))?;

    let final_data = if format == image::ImageFormat::WebP {
        image_bytes
    } else {
        let img = image::load_from_memory(&image_bytes)
            .map_err(|e| ApiError::BadRequest("InvalidImage".to_string(), e.to_string()))?;

        let resized = img.resize_exact(256, 256, image::imageops::FilterType::Lanczos3);

        let mut webp_data = Vec::new();
        resized
            .write_to(
                &mut std::io::Cursor::new(&mut webp_data),
                image::ImageFormat::WebP,
            )
            .map_err(|e| ApiError::Internal(format!("Failed to encode image: {}", e)))?;

        webp_data
    };

    let _ = state
        .storage
        .store_avatar(&user_id, &final_data)
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to store avatar: {}", e)))?;

    let host = headers
        .get(header::HOST)
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| {
            ApiError::BadRequest(
                "MissingHost".to_string(),
                "Host header is required".to_string(),
            )
        })?;

    let scheme = if host.contains("localhost") || host.starts_with("127.0.0.1") {
        "http"
    } else {
        "https"
    };

    let avatar_url = format!("{}://{}/_avatars/{}", scheme, host, user_id);

    sqlx::query("UPDATE users SET avatar_url = $1 WHERE id = $2")
        .bind(&avatar_url)
        .bind(uuid::Uuid::parse_str(&user_id).map_err(|e| ApiError::Internal(e.to_string()))?)
        .execute(&state.db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    Ok(Json(AvatarUploadResponse { avatar_url }))
}

pub async fn download_avatar(
    Path(user_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, ApiError> {
    match state
        .storage
        .get_avatar_url(user_id.as_str())
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?
    {
        storage::AvatarRetrieval::Redirect(url) => Ok(Response::builder()
            .status(StatusCode::FOUND)
            .header(header::LOCATION, url)
            .body(Body::empty())
            .unwrap()),
        storage::AvatarRetrieval::File(path) => {
            let file = tokio::fs::File::open(path)
                .await
                .map_err(|e| ApiError::Internal(e.to_string()))?;
            let stream = tokio_util::io::ReaderStream::new(file);
            let body = Body::from_stream(stream);
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/octet-stream")
                .body(body)
                .unwrap())
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AvatarUploadResponse {
    pub avatar_url: String,
}
