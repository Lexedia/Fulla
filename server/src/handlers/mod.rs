use crate::models::{ErrorDetail, ErrorResponse};
use axum::{
    Json,
    http::{StatusCode, header},
    response::IntoResponse,
};

pub mod admin;
pub mod auth;
pub mod docs;
pub mod packages;
pub mod profile;
pub mod search;
pub mod upload;

pub enum ApiError {
    Unauthorized(String),
    Forbidden(String),
    BadRequest(String, String),
    NotFound(String, String),
    Internal(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        let (status, code, message, include_auth) = match self {
            ApiError::Unauthorized(msg) => (
                StatusCode::UNAUTHORIZED,
                "Unauthorized".to_string(),
                msg,
                true,
            ),
            ApiError::Forbidden(msg) => (StatusCode::FORBIDDEN, "Forbidden".to_string(), msg, true),
            ApiError::BadRequest(c, m) => (StatusCode::BAD_REQUEST, c, m, false),
            ApiError::NotFound(c, m) => (StatusCode::NOT_FOUND, c, m, false),
            ApiError::Internal(m) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "InternalError".to_string(),
                m,
                false,
            ),
        };
        let body = Json(ErrorResponse {
            error: ErrorDetail {
                code: code.clone(),
                message: message.clone(),
            },
        });
        let mut response = if include_auth {
            let www_auth = format!("Bearer realm=\"pub\", message=\"{}\"", body.error.message);
            (status, [(header::WWW_AUTHENTICATE, www_auth)], body).into_response()
        } else {
            (status, body).into_response()
        };
        response.headers_mut().insert(
            header::CONTENT_TYPE,
            "application/vnd.pub.v2+json".parse().unwrap(),
        );
        response
    }
}
