use std::path::{Path, PathBuf};
use tokio::fs;

use crate::handlers::ApiError;

pub fn validate_identifier(value: &str, label: &str) -> Result<(), ApiError> {
    if value.is_empty() {
        return Err(ApiError::BadRequest(
            "InvalidIdentifier".to_string(),
            format!("{} cannot be empty", label),
        ));
    }
    if value.contains("..") || value.contains('/') || value.contains('\\') || value.contains('\0') {
        return Err(ApiError::BadRequest(
            "InvalidIdentifier".to_string(),
            format!("{} contains invalid characters", label),
        ));
    }
    Ok(())
}

pub fn validate_username(username: &str) -> Result<(), ApiError> {
    if username.len() < 3 || username.len() > 32 {
        return Err(ApiError::BadRequest(
            "InvalidUsername".to_string(),
            "Username must be between 3 and 32 characters".to_string(),
        ));
    }
    if !username
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err(ApiError::BadRequest(
            "InvalidUsername".to_string(),
            "Username may only contain letters, numbers, underscores, and hyphens".to_string(),
        ));
    }
    if !username.starts_with(|c: char| c.is_ascii_alphabetic()) {
        return Err(ApiError::BadRequest(
            "InvalidUsername".to_string(),
            "Username must start with a letter".to_string(),
        ));
    }
    Ok(())
}

pub fn get_base_url() -> Result<(String, String), ApiError> {
    let base_url = std::env::var("BASE_URL").expect("BASE_URL must be set");
    if let Some((scheme, host)) = base_url.split_once("://") {
        return Ok((scheme.to_string(), host.trim_end_matches('/').to_string()));
    }

    Err(ApiError::Internal(
        "BASE_URL couldn't be parsed".to_string(),
    ))
}

// https://stackoverflow.com/a/60406693
// adapted to use tokio instead
pub async fn copy_dir<U: AsRef<Path>, V: AsRef<Path>>(
    from: U,
    to: V,
) -> Result<(), std::io::Error> {
    let mut stack = Vec::new();
    stack.push(PathBuf::from(from.as_ref()));

    let output_root = PathBuf::from(to.as_ref());
    let input_root = PathBuf::from(from.as_ref()).components().count();

    while let Some(working_path) = stack.pop() {
        let src: PathBuf = working_path.components().skip(input_root).collect();

        let dest = if src.components().count() == 0 {
            output_root.clone()
        } else {
            output_root.join(&src)
        };
        if fs::metadata(&dest).await.is_err() {
            fs::create_dir_all(&dest).await?;
        }

        let mut entries = fs::read_dir(working_path).await?;
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else {
                if let Some(filename) = path.file_name() {
                    let dest_path = dest.join(filename);
                    fs::copy(&path, &dest_path).await?;
                }
            }
        }
    }

    Ok(())
}
