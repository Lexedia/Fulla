use crate::storage::AvatarRetrieval;

use super::{PackageStorage, StoredPackage};
use async_trait::async_trait;
use sha2::{Digest, Sha256};
use std::path::PathBuf;

/// Filesystem-based storage backend
pub struct FilesystemStorage {
    /// Base path where packages are stored
    storage_path: PathBuf,
    /// Base URL for serving packages
    base_url: String,
}

impl FilesystemStorage {
    pub fn new(storage_path: PathBuf, base_url: String) -> Self {
        Self {
            storage_path,
            base_url,
        }
    }
}

#[async_trait]
impl PackageStorage for FilesystemStorage {
    async fn store_package(
        &self,
        name: &str,
        version: &str,
        data: &[u8],
    ) -> anyhow::Result<StoredPackage> {
        let mut hasher = Sha256::new();
        hasher.update(data);
        let sha256 = format!("{:x}", hasher.finalize());

        let pkg_dir = self.storage_path.join("packages").join(name);
        tokio::fs::create_dir_all(&pkg_dir).await?;

        let file_path = pkg_dir.join(format!("{}.tar.gz", version));
        tokio::fs::write(&file_path, data).await?;

        let url = format!(
            "{}/packages/{}/versions/{}-{}.tar.gz",
            self.base_url, name, name, version
        );

        Ok(StoredPackage {
            url,
            sha256,
            expires_at: None,
        })
    }

    async fn get_download_url(
        &self,
        name: &str,
        version: &str,
    ) -> anyhow::Result<super::PackageRetrieval> {
        let file_path = self
            .storage_path
            .join("packages")
            .join(name)
            .join(format!("{}.tar.gz", version));

        if file_path.exists() {
            Ok(super::PackageRetrieval::File(file_path))
        } else {
            Err(anyhow::anyhow!("Package file not found"))
        }
    }

    async fn package_exists(&self, name: &str, version: &str) -> anyhow::Result<bool> {
        let file_path = self
            .storage_path
            .join("packages")
            .join(name)
            .join(format!("{}.tar.gz", version));
        Ok(file_path.exists())
    }

    async fn get_package_data(&self, name: &str, version: &str) -> anyhow::Result<Vec<u8>> {
        let file_path = self
            .storage_path
            .join("packages")
            .join(name)
            .join(format!("{}.tar.gz", version));

        let data = tokio::fs::read(&file_path).await?;
        Ok(data)
    }

    async fn store_avatar(&self, user_id: &str, data: &[u8]) -> anyhow::Result<String> {
        let avatars_dir = self.storage_path.join("_avatars");
        tokio::fs::create_dir_all(&avatars_dir).await?;

        let file_path = avatars_dir.join(format!("{}.webp", user_id));
        tokio::fs::write(&file_path, data).await?;

        let url = format!("{}/_avatars/{}.webp", self.base_url, user_id);
        Ok(url)
    }

    async fn get_avatar_url(&self, user_id: &str) -> anyhow::Result<AvatarRetrieval> {
        let file_path = self
            .storage_path
            .join("_avatars")
            .join(format!("{user_id}.webp"));
        Ok(AvatarRetrieval::File(file_path))
    }
}
