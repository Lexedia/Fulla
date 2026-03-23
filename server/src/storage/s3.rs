use crate::storage::AvatarRetrieval;

use super::{PackageStorage, StoredPackage};
use async_trait::async_trait;
use aws_sdk_s3::{Client, presigning::PresigningConfig, primitives::ByteStream};
use chrono::Utc;
use sha2::{Digest, Sha256};
use std::time::Duration;

/// S3-compatible storage backend
pub struct S3Storage {
    client: Client,
    presigning_client: Client,
    bucket: String,
    prefix: String,
    presigned_expiration: Duration,
}

impl S3Storage {
    pub fn new(
        client: Client,
        presigning_client: Client,
        bucket: String,
        prefix: String,
        presigned_expiration_secs: u64,
    ) -> Self {
        Self {
            client,
            presigning_client,
            bucket,
            prefix,
            presigned_expiration: Duration::from_secs(presigned_expiration_secs),
        }
    }

    fn get_key(&self, name: &str, version: &str) -> String {
        if self.prefix.is_empty() {
            format!("packages/{}/versions/{}.tar.gz", name, version)
        } else {
            format!(
                "{}/packages/{}/versions/{}.tar.gz",
                self.prefix, name, version
            )
        }
    }

    fn get_avatar_key(&self, user_id: &str) -> String {
        if self.prefix.is_empty() {
            format!("_avatars/{}.webp", user_id)
        } else {
            format!("{}/_avatars/{}.webp", self.prefix, user_id)
        }
    }
}

#[async_trait]
impl PackageStorage for S3Storage {
    async fn store_package(
        &self,
        name: &str,
        version: &str,
        data: &[u8],
    ) -> anyhow::Result<StoredPackage> {
        let mut hasher = Sha256::new();
        hasher.update(data);
        let sha256 = format!("{:x}", hasher.finalize());

        let key = self.get_key(name, version);
        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(&key)
            .body(ByteStream::from(data.to_vec()))
            .content_type("application/octet-stream")
            .send()
            .await?;

        let presigned_request = self
            .presigning_client
            .get_object()
            .bucket(&self.bucket)
            .key(&key)
            .presigned(PresigningConfig::expires_in(self.presigned_expiration)?)
            .await?;

        let expires_at = Utc::now() + chrono::Duration::from_std(self.presigned_expiration)?;

        Ok(StoredPackage {
            url: presigned_request.uri().to_string(),
            sha256,
            expires_at: Some(expires_at),
        })
    }

    async fn get_download_url(
        &self,
        name: &str,
        version: &str,
    ) -> anyhow::Result<super::PackageRetrieval> {
        let key = self.get_key(name, version);

        let presigned_request = self
            .presigning_client
            .get_object()
            .bucket(&self.bucket)
            .key(&key)
            .presigned(PresigningConfig::expires_in(self.presigned_expiration)?)
            .await?;

        Ok(super::PackageRetrieval::Redirect(
            presigned_request.uri().to_string(),
        ))
    }

    async fn package_exists(&self, name: &str, version: &str) -> anyhow::Result<bool> {
        let key = self.get_key(name, version);

        match self
            .client
            .head_object()
            .bucket(&self.bucket)
            .key(&key)
            .send()
            .await
        {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    async fn get_package_data(&self, name: &str, version: &str) -> anyhow::Result<Vec<u8>> {
        let key = self.get_key(name, version);

        let output = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(&key)
            .send()
            .await?;

        let data = output.body.collect().await?.into_bytes();
        Ok(data.to_vec())
    }

    async fn store_avatar(&self, user_id: &str, data: &[u8]) -> anyhow::Result<String> {
        let key = self.get_avatar_key(user_id);

        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(&key)
            .body(ByteStream::from(data.to_vec()))
            .content_type("image/webp")
            .send()
            .await?;

        let presigned_request = self
            .presigning_client
            .get_object()
            .bucket(&self.bucket)
            .key(&key)
            .presigned(PresigningConfig::expires_in(self.presigned_expiration)?)
            .await?;

        Ok(presigned_request.uri().to_string())
    }

    async fn get_avatar_url(&self, user_id: &str) -> anyhow::Result<AvatarRetrieval> {
        let key = self.get_avatar_key(user_id);

        let presigned_request = self
            .presigning_client
            .get_object()
            .bucket(&self.bucket)
            .key(&key)
            .presigned(PresigningConfig::expires_in(self.presigned_expiration)?)
            .await?;

        Ok(AvatarRetrieval::Redirect(
            presigned_request.uri().to_string(),
        ))
    }
}
