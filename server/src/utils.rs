use crate::handlers::ApiError;
use axum::http::HeaderMap;

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

pub fn get_host_url(headers: &HeaderMap) -> Result<(String, String), ApiError> {
    if let Ok(base_url) = std::env::var("BASE_URL") {
        if let Some((scheme, host)) = base_url.split_once("://") {
            return Ok((scheme.to_string(), host.trim_end_matches('/').to_string()));
        }
    }

    Err(ApiError::BadRequest(
        "MissingBaseUrl".to_string(),
        "No BASE_URL was set".to_string(),
    ))
}
