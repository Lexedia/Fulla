use crate::handlers::ApiError;
use crate::handlers::auth::validate_user_auth;
use crate::storage;
use crate::{AppState, utils::get_base_url};
use axum::{
    Json,
    body::Body,
    extract::{Multipart, Path, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

pub async fn upload_avatar(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<Json<AvatarUploadResponse>, ApiError> {
    let user = validate_user_auth(&headers, &state.db).await?;
    let user_id = user.id.to_string();

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

    let (scheme, host) = get_base_url()?;

    let avatar_url = format!("{}://{}/_avatars/{}", scheme, host, user_id);

    sqlx::query("UPDATE users SET avatar_url = $1 WHERE id = $2")
        .bind(&avatar_url)
        .bind(user.id)
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
