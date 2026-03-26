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
    #[serde(default)]
    pub download_count: i64,
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
    pub download_count: i64,
    pub like_count: i64,
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
    pub advisories: Vec<OsvAdvisory>,
    #[serde(rename = "advisoriesUpdated", skip_serializing_if = "Option::is_none")]
    pub advisories_updated: Option<DateTime<Utc>>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct DBAdvisory {
    pub id: Uuid,
    #[allow(dead_code)]
    pub package_id: Uuid,
    pub title: String,
    pub description: String,
    pub affected_versions: String,
    pub patched_versions: Option<String>,
    pub severity: String,
    pub url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OsvAdvisory {
    pub schema_version: String,
    pub id: String,
    pub modified: DateTime<Utc>,
    pub published: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub withdrawn: Option<DateTime<Utc>>,
    #[serde(default)]
    pub aliases: Vec<String>,
    #[serde(default)]
    pub upstream: Vec<String>,
    #[serde(default)]
    pub related: Vec<String>,
    pub summary: String,
    pub details: String,
    #[serde(default)]
    pub severity: Vec<OsvSeverity>,
    pub affected: Vec<OsvAffected>,
    #[serde(default)]
    pub references: Vec<OsvReference>,
    #[serde(default)]
    pub credits: Vec<OsvCredit>,
    pub database_specific: OsvDatabaseSpecific,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OsvSeverity {
    #[serde(rename = "type")]
    pub severity_type: String,
    pub score: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OsvCredit {
    pub name: String,
    #[serde(default)]
    pub contact: Vec<String>,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub credit_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OsvAffected {
    pub package: OsvPackage,
    #[serde(default)]
    pub severity: Vec<OsvSeverity>,
    pub ranges: Vec<OsvRange>,
    #[serde(default)]
    pub versions: Vec<String>,
    #[serde(default)]
    pub ecosystem_specific: std::collections::HashMap<String, serde_json::Value>,
    #[serde(default)]
    pub database_specific: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OsvPackage {
    pub ecosystem: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OsvRange {
    #[serde(rename = "type")]
    pub range_type: String,
    pub events: Vec<OsvEvent>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OsvEvent {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub introduced: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fixed: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OsvReference {
    #[serde(rename = "type")]
    pub ref_type: String,
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OsvDatabaseSpecific {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub severity: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateAdvisoryRequest {
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_affected_versions", rename = "affectedVersions")]
    pub affected_versions: String,
    #[serde(rename = "patchedVersions")]
    pub patched_versions: Option<String>,
    #[serde(default = "default_severity")]
    pub severity: String,
    pub url: Option<String>,
}

fn default_affected_versions() -> String {
    "*".to_string()
}

fn default_severity() -> String {
    "unknown".to_string()
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
    pub download_count: i64,
    pub like_count: i64,
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
    pub download_count: i64,
    pub like_count: i64,
    pub is_liked: bool,
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

#[derive(Debug, sqlx::FromRow, Serialize, Deserialize)]
pub struct DownloadSeriesRow {
    pub date: Option<DateTime<Utc>>,
    pub version: String,
    pub count: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PackageDownloadsResponse {
    pub data: Vec<DownloadSeriesRow>,
}
