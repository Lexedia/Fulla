use crate::AppState;
use crate::handlers::ApiError;
use crate::models::{
    AuthResponse, CreateTokenRequest, DBToken, DBUser, LoginRequest, RegisterRequest,
    TokenResponse, UserResponse,
};
use argon2::{
    Argon2,
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString, rand_core::OsRng},
};
use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode, header},
};
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    exp: usize,
    admin: bool,
}

pub async fn validate_auth(headers: &HeaderMap, db: &sqlx::PgPool) -> Result<DBToken, ApiError> {
    let auth_header = headers
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| ApiError::Unauthorized("Authorization header missing".to_string()))?;
    if !auth_header.starts_with("Bearer ") {
        return Err(ApiError::Unauthorized(
            "Invalid authorization scheme".to_string(),
        ));
    }
    let token_str = &auth_header[7..];
    let token_record = sqlx::query_as::<_, DBToken>(
        "SELECT * FROM tokens WHERE token = $1 AND revoked = FALSE AND (expires_at IS NULL OR expires_at > NOW())",
    )
    .bind(token_str)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .ok_or_else(|| ApiError::Unauthorized("Invalid or expired token".to_string()))?;
    // Update last_used_at
    let db_clone = db.clone();
    let token_id = token_record.id;
    tokio::spawn(async move {
        let _ = sqlx::query("UPDATE tokens SET last_used_at = NOW() WHERE id = $1")
            .bind(token_id)
            .execute(&db_clone)
            .await;
    });
    Ok(token_record)
}

async fn validate_jwt_auth(headers: &HeaderMap, db: &sqlx::PgPool) -> Result<DBUser, ApiError> {
    let auth_header = headers
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| ApiError::Unauthorized("Authorization header missing".to_string()))?;

    if !auth_header.starts_with("Bearer ") {
        return Err(ApiError::Unauthorized(
            "Invalid authorization scheme".to_string(),
        ));
    }

    let token_str = &auth_header[7..];
    let secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");

    let token_data = decode::<Claims>(
        token_str,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| ApiError::Unauthorized("Invalid or expired token".to_string()))?;

    let user_id = Uuid::parse_str(&token_data.claims.sub)
        .map_err(|_| ApiError::Internal("Invalid user ID in token".to_string()))?;

    let user = sqlx::query_as::<_, DBUser>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?
        .ok_or_else(|| ApiError::Unauthorized("User not found".to_string()))?;

    Ok(user)
}

pub async fn validate_user_auth(
    headers: &HeaderMap,
    db: &sqlx::PgPool,
) -> Result<DBUser, ApiError> {
    let auth_header = headers
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok());

    match auth_header {
        Some(h) if h.starts_with("Basic ") => validate_basic_auth(headers, db).await,
        Some(h) if h.starts_with("Bearer ") => validate_jwt_auth(headers, db).await,
        _ => Err(ApiError::Unauthorized(
            "Authorization header missing or invalid scheme".to_string(),
        )),
    }
}

pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, ApiError> {
    if std::env::var("ENABLE_REGISTRATION").unwrap_or_else(|_| "false".to_string()) != "true" {
        return Err(ApiError::Forbidden("Registration is disabled".to_string()));
    }

    if payload.password.len() < 8 {
        return Err(ApiError::BadRequest(
            "InvalidPassword".to_string(),
            "Password must be at least 8 characters".to_string(),
        ));
    }

    // Check if user exists
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

    let user_count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users")
        .fetch_one(&state.db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    let is_admin = user_count == 0;

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(payload.password.as_bytes(), &salt)
        .map_err(|e| ApiError::Internal(e.to_string()))?
        .to_string();

    let user_id = Uuid::new_v4();
    let user = sqlx::query_as::<_, DBUser>(
        "INSERT INTO users (id, username, password_hash, is_admin) VALUES ($1, $2, $3, $4) RETURNING *"
    )
    .bind(user_id)
    .bind(&payload.username)
    .bind(&password_hash)
    .bind(is_admin)
    .fetch_one(&state.db)
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?;

    // Generate Token
    let token = generate_token(user.id, user.is_admin)?;

    Ok(Json(AuthResponse {
        token,
        user: UserResponse {
            id: user.id,
            username: user.username,
            is_admin: user.is_admin,
            avatar_url: user.avatar_url,
        },
    }))
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, ApiError> {
    let user = sqlx::query_as::<_, DBUser>("SELECT * FROM users WHERE username = $1")
        .bind(&payload.username)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?
        .ok_or_else(|| ApiError::Unauthorized("Invalid credentials".to_string()))?;

    let parsed_hash =
        PasswordHash::new(&user.password_hash).map_err(|e| ApiError::Internal(e.to_string()))?;

    Argon2::default()
        .verify_password(payload.password.as_bytes(), &parsed_hash)
        .map_err(|_| ApiError::Unauthorized("Invalid credentials".to_string()))?;

    let token = generate_token(user.id, user.is_admin)?;

    Ok(Json(AuthResponse {
        token,
        user: UserResponse {
            id: user.id,
            username: user.username,
            is_admin: user.is_admin,
            avatar_url: user.avatar_url,
        },
    }))
}

fn generate_token(user_id: Uuid, is_admin: bool) -> Result<String, ApiError> {
    let secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");
    let expiration = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::days(7))
        .expect("valid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        sub: user_id.to_string(),
        exp: expiration,
        admin: is_admin,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| ApiError::Internal(e.to_string()))
}

pub async fn validate_basic_auth(
    headers: &axum::http::HeaderMap,
    db: &sqlx::PgPool,
) -> Result<DBUser, ApiError> {
    use base64::{Engine as _, engine::general_purpose::STANDARD as b64};

    let auth_header = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| ApiError::Unauthorized("Authorization header missing".to_string()))?;

    if !auth_header.starts_with("Basic ") {
        return Err(ApiError::Unauthorized(
            "Invalid authorization scheme".to_string(),
        ));
    }

    let token_str = &auth_header[6..];
    let decoded = b64.decode(token_str).map_err(|_| {
        ApiError::BadRequest(
            "InvalidBase64".to_string(),
            "Invalid base64 encoding".to_string(),
        )
    })?;

    let credentials = String::from_utf8(decoded).map_err(|_| {
        ApiError::BadRequest(
            "InvalidUTF8".to_string(),
            "Invalid UTF-8 sequence".to_string(),
        )
    })?;

    let parts: Vec<&str> = credentials.splitn(2, ':').collect();
    if parts.len() != 2 {
        return Err(ApiError::BadRequest(
            "InvalidFormat".to_string(),
            "Invalid Basic Auth format".to_string(),
        ));
    }

    let username = parts[0];
    let password = parts[1];

    let user = sqlx::query_as::<_, DBUser>("SELECT * FROM users WHERE username = $1")
        .bind(username)
        .fetch_optional(db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?
        .ok_or_else(|| ApiError::Unauthorized("Invalid credentials".to_string()))?;

    let parsed_hash =
        PasswordHash::new(&user.password_hash).map_err(|e| ApiError::Internal(e.to_string()))?;

    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|_| ApiError::Unauthorized("Invalid credentials".to_string()))?;

    Ok(user)
}

pub async fn list_tokens(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<DBToken>>, ApiError> {
    let user = validate_user_auth(&headers, &state.db).await?;
    let tokens =
        sqlx::query_as::<_, DBToken>("SELECT * FROM tokens WHERE user_id = $1 AND revoked = FALSE")
            .bind(user.id)
            .fetch_all(&state.db)
            .await
            .map_err(|e| ApiError::Internal(e.to_string()))?;
    Ok(Json(tokens))
}

pub async fn create_token(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateTokenRequest>,
) -> Result<Json<TokenResponse>, ApiError> {
    let user = validate_user_auth(&headers, &state.db).await?;
    let token = Uuid::new_v4().to_string();
    let record = sqlx::query_as::<_, DBToken>(
        "INSERT INTO tokens (token, name, user_id, expires_at) VALUES ($1, $2, $3, $4) RETURNING *",
    )
    .bind(&token)
    .bind(&payload.name)
    .bind(user.id)
    .bind(payload.expires_at)
    .fetch_one(&state.db)
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?;
    Ok(Json(TokenResponse {
        id: record.id,
        token: record.token,
        name: record.name,
        expires_at: record.expires_at,
    }))
}

pub async fn delete_token(
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode, ApiError> {
    let user = validate_user_auth(&headers, &state.db).await?;

    // Verify the token belongs to the user
    let result = sqlx::query("UPDATE tokens SET revoked = TRUE WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user.id)
        .execute(&state.db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound(
            "TokenNotFound".to_string(),
            "Token not found or does not belong to you".to_string(),
        ));
    }

    Ok(StatusCode::NO_CONTENT)
}
