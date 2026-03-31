use crate::AppState;
use crate::handlers::ApiError;
use crate::handlers::auth::validate_user_auth;
use crate::models::{
    AdminStats, AdminUser, AdminUserResponse, CreateAdminUserRequest, CreateAdvisoryRequest,
    DBPackage, SetAdminRequest,
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

    crate::utils::validate_username(&payload.username)?;

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

pub async fn create_advisory(
    headers: HeaderMap,
    Path(package_name): Path<String>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateAdvisoryRequest>,
) -> Result<Json<crate::models::OsvAdvisory>, ApiError> {
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
            "PermissionDenied: You must be the owner or an admin to create an advisory for this package".to_string(),
        ));
    }

    let advisory = sqlx::query_as::<_, crate::models::DBAdvisory>(
        "INSERT INTO advisories (package_id, title, description, affected_versions, patched_versions, severity, url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
    )
    .bind(pkg.id)
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(&payload.affected_versions)
    .bind(&payload.patched_versions)
    .bind(&payload.severity)
    .bind(&payload.url)
    .fetch_one(&state.db)
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?;

    let all_versions = sqlx::query_scalar::<_, String>(
        "SELECT version FROM package_versions WHERE package_id = $1"
    )
    .bind(pkg.id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let mut affected_vers = Vec::new();
    if advisory.affected_versions == "*" {
        affected_vers = all_versions.clone();
    } else if let Ok(req) = semver::VersionReq::parse(&advisory.affected_versions) {
        let patched_req = advisory.patched_versions.as_ref().and_then(|p| semver::VersionReq::parse(p).ok());
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

    let pub_display_url = advisory.url.clone();

    Ok(Json(crate::models::OsvAdvisory {
        schema_version: "1.7.5".to_string(),
        id: advisory.id.to_string(),
        modified: advisory.updated_at,
        published: advisory.created_at,
        withdrawn: None,
        aliases: vec![],
        upstream: vec![],
        related: vec![],
        summary: advisory.title,
        details: advisory.description,
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
                    introduced: Some(if advisory.affected_versions == "*" {
                        "0".to_string()
                    } else {
                        advisory.affected_versions
                    }),
                    fixed: advisory.patched_versions,
                }],
            }],
            versions: affected_vers,
            ecosystem_specific: std::collections::HashMap::new(),
            database_specific: std::collections::HashMap::new(),
        }],
        references: if let Some(url) = advisory.url {
            vec![crate::models::OsvReference {
                ref_type: "WEB".to_string(),
                url,
            }]
        } else {
            vec![]
        },
        credits: vec![],
        database_specific: crate::models::OsvDatabaseSpecific {
            severity: Some(advisory.severity),
            pub_display_url,
        },
    }))
}

pub async fn delete_advisory(
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode, ApiError> {
    let user = validate_user_auth(&headers, &state.db).await?;

    let advisory =
        sqlx::query_as::<_, crate::models::DBAdvisory>("SELECT * FROM advisories WHERE id = $1")
            .bind(id)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| ApiError::Internal(e.to_string()))?
            .ok_or_else(|| {
                ApiError::NotFound(
                    "AdvisoryNotFound".to_string(),
                    "Advisory not found".to_string(),
                )
            })?;

    let pkg = sqlx::query_as::<_, DBPackage>("SELECT * FROM packages WHERE id = $1")
        .bind(advisory.package_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    let is_owner = pkg.owner_id == Some(user.id);
    if !is_owner && !user.is_admin {
        return Err(ApiError::Forbidden(
            "PermissionDenied: You must be the owner or an admin to delete an advisory for this package".to_string(),
        ));
    }

    let result = sqlx::query("DELETE FROM advisories WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound(
            "AdvisoryNotFound".to_string(),
            "Advisory not found".to_string(),
        ));
    }

    Ok(StatusCode::NO_CONTENT)
}
