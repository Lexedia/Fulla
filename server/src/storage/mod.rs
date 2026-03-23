mod filesystem;
mod s3;

use async_trait::async_trait;
use chrono::{DateTime, Utc};

pub use filesystem::FilesystemStorage;
pub use s3::S3Storage;

/// Result of storing a package
#[derive(Debug, Clone)]
pub struct StoredPackage {
    /// Public URL or presigned URL to download the package
    pub url: String,
    /// SHA256 hash of the package archive
    pub sha256: String,
    /// Expiration time for presigned URLs (None for permanent URLs)
    pub expires_at: Option<DateTime<Utc>>,
}

/// Method used to retrieve a package
#[derive(Debug)]
pub enum PackageRetrieval {
    /// Redirect to an external URL (e.g. S3 presigned URL)
    Redirect(String),
    /// Serve a local file
    File(std::path::PathBuf),
}

/// Method used to retrieve an avatar
#[derive(Debug)]
pub enum AvatarRetrieval {
    /// Redirect to an external URL
    Redirect(String),
    /// Serves a local file
    File(std::path::PathBuf),
}

/// Storage backend abstraction for package archives
#[async_trait]
pub trait PackageStorage: Send + Sync {
    /// Store a package archive and return its URL
    async fn store_package(
        &self,
        name: &str,
        version: &str,
        data: &[u8],
    ) -> anyhow::Result<StoredPackage>;

    /// Get the retrieval method for a package
    async fn get_download_url(&self, name: &str, version: &str)
    -> anyhow::Result<PackageRetrieval>;

    /// Check if a package exists in storage
    async fn package_exists(&self, name: &str, version: &str) -> anyhow::Result<bool>;

    /// Retrieve the raw package data (used for analysis/indexing)
    async fn get_package_data(&self, name: &str, version: &str) -> anyhow::Result<Vec<u8>>;

    /// Store avatar image and return URL
    async fn store_avatar(&self, user_id: &str, data: &[u8]) -> anyhow::Result<String>;

    /// Get avatar URL for a user
    async fn get_avatar_url(&self, user_id: &str) -> anyhow::Result<AvatarRetrieval>;
}
