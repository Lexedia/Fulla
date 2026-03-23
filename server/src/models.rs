use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct PackageVersion {
    pub version: String,
    pub archive_url: String,
    pub archive_sha256: Option<String>,
    pub pubspec: serde_json::Value,
    #[serde(default)]
    pub retracted: bool,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PackageVersionsResponse {
    pub name: String,
    #[serde(default, rename = "isDiscontinued")]
    pub is_discontinued: bool,
    #[serde(skip_serializing_if = "Option::is_none", rename = "replacedBy")]
    pub replaced_by: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "advisoriesUpdated")]
    pub advisories_updated: Option<DateTime<Utc>>,
    pub latest: PackageVersion,
    pub versions: Vec<PackageVersion>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PublishResponse {
    pub url: String,
    pub fields: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SuccessResponse {
    pub success: SuccessMessage,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SuccessMessage {
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: ErrorDetail,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorDetail {
    pub code: String,
    pub message: String,
}

#[derive(Debug, sqlx::FromRow, Serialize, Deserialize)]
pub struct DBPackage {
    pub id: Uuid,
    pub name: String,
    pub is_discontinued: bool,
    pub replaced_by: Option<String>,
    pub owner_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct DBPackageVersion {
    pub id: Uuid,
    #[allow(dead_code)]
    pub package_id: Uuid,
    pub version: String,
    pub pubspec: serde_json::Value,
    pub archive_url: String,
    pub archive_sha256: Option<String>,
    pub retracted: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, sqlx::FromRow, Serialize, Deserialize)]
pub struct DBToken {
    pub id: Uuid,
    pub token: String,
    pub name: String,
    pub user_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub revoked: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTokenRequest {
    pub name: String,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenResponse {
    pub id: Uuid,
    pub token: String,
    pub name: String,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AdvisoriesResponse {
    pub advisories: Vec<serde_json::Value>,
    #[serde(rename = "advisoriesUpdated")]
    pub advisories_updated: DateTime<Utc>,
}

#[derive(Debug, sqlx::FromRow, Serialize, Deserialize)]
pub struct DBUser {
    pub id: Uuid,
    pub username: String,
    #[serde(skip)]
    pub password_hash: String,
    pub is_admin: bool,
    pub avatar_url: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserResponse,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub packages: Vec<SearchPackage>,
    pub total_hits: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchPackage {
    pub package: String,
    pub version: String,
    pub description: Option<String>,
    pub score: Option<i64>,
    pub updated_at: DateTime<Utc>,
    pub is_discontinued: bool,
    pub owner_username: Option<String>,
    pub owner_avatar: Option<String>,
    pub platforms: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub username: String,
    pub is_admin: bool,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FrontendPackageDetail {
    pub package: DBPackage,
    pub version: PackageVersion,
    pub readme: Option<String>,
    pub analysis: Option<serde_json::Value>,
    pub owner_username: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiscontinuePackageRequest {
    pub replaced_by: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AdminStats {
    pub users: i64,
    pub packages: i64,
    pub versions: i64,
}

#[derive(Debug, sqlx::FromRow, Serialize, Deserialize)]
pub struct AdminUser {
    pub id: Uuid,
    pub username: String,
    pub is_admin: bool,
    pub avatar_url: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SetAdminRequest {
    pub is_admin: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateAdminUserRequest {
    pub username: String,
    pub password: String,
    pub is_admin: Option<bool>,
}

#[derive(Debug, sqlx::FromRow, Serialize, Deserialize)]
pub struct AdminUserResponse {
    pub id: Uuid,
    pub username: String,
    pub is_admin: bool,
    pub avatar_url: Option<String>,
    pub created_at: DateTime<Utc>,
}
