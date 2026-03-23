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
