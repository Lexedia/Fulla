use crate::AppState;
use crate::handlers::ApiError;
use crate::handlers::auth::validate_user_auth;
use crate::models::{
    AdminStats, AdminUser, AdminUserResponse, CreateAdminUserRequest, SetAdminRequest,
};
use argon2::{
    Argon2,
    password_hash::{PasswordHasher, SaltString, rand_core::OsRng},
};
use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use std::sync::Arc;
use uuid::Uuid;

async fn require_admin(headers: &HeaderMap, db: &sqlx::PgPool) -> Result<(), ApiError> {
    let user = validate_user_auth(headers, db).await?;
    if !user.is_admin {
        return Err(ApiError::Forbidden("Admin access required".to_string()));
    }
    Ok(())
}

pub async fn get_stats(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
) -> Result<Json<AdminStats>, ApiError> {
    require_admin(&headers, &state.db).await?;

    let users = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users")
        .fetch_one(&state.db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    let packages = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM packages")
        .fetch_one(&state.db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    let versions = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM package_versions")
        .fetch_one(&state.db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    Ok(Json(AdminStats {
        users,
        packages,
        versions,
    }))
}

pub async fn list_users(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<AdminUser>>, ApiError> {
    require_admin(&headers, &state.db).await?;

    let users = sqlx::query_as::<_, AdminUser>(
        "SELECT id, username, is_admin, avatar_url, created_at FROM users ORDER BY created_at ASC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?;

    Ok(Json(users))
}

pub async fn delete_user(
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode, ApiError> {
    let admin = validate_user_auth(&headers, &state.db).await?;
    if !admin.is_admin {
        return Err(ApiError::Forbidden("Admin access required".to_string()));
    }
    if admin.id == id {
        return Err(ApiError::BadRequest(
            "CannotDeleteSelf".to_string(),
            "You cannot delete your own account".to_string(),
        ));
    }

    let result = sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound(
            "UserNotFound".to_string(),
            "User not found".to_string(),
        ));
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn set_admin_status(
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<SetAdminRequest>,
) -> Result<StatusCode, ApiError> {
    let admin = validate_user_auth(&headers, &state.db).await?;
    if !admin.is_admin {
        return Err(ApiError::Forbidden("Admin access required".to_string()));
    }
    if admin.id == id {
        return Err(ApiError::BadRequest(
            "CannotModifySelf".to_string(),
            "You cannot change your own admin status".to_string(),
        ));
    }

    let result = sqlx::query("UPDATE users SET is_admin = $1 WHERE id = $2")
        .bind(payload.is_admin)
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound(
            "UserNotFound".to_string(),
            "User not found".to_string(),
        ));
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn create_user(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateAdminUserRequest>,
) -> Result<Json<AdminUserResponse>, ApiError> {
    require_admin(&headers, &state.db).await?;

    if payload.password.len() < 8 {
        return Err(ApiError::BadRequest(
            "InvalidPassword".to_string(),
            "Password must be at least 8 characters".to_string(),
        ));
    }

    let exists = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users WHERE username = $1")
        .bind(&payload.username)
        .fetch_one(&state.db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    if exists > 0 {
        return Err(ApiError::BadRequest(
            "UserExists".to_string(),
            "Username already taken".to_string(),
        ));
    }

    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(payload.password.as_bytes(), &salt)
        .map_err(|e| ApiError::Internal(e.to_string()))?
        .to_string();

    let user = sqlx::query_as::<_, AdminUser>(
        "INSERT INTO users (id, username, password_hash, is_admin) VALUES ($1, $2, $3, $4) RETURNING id, username, is_admin, avatar_url, created_at",
    )
    .bind(Uuid::new_v4())
    .bind(&payload.username)
    .bind(&password_hash)
    .bind(payload.is_admin.unwrap_or_default())
    .fetch_one(&state.db)
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?;

    Ok(Json(AdminUserResponse {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
    }))
}
