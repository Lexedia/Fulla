use crate::AppState;
use crate::utils::validate_identifier;
use axum::{
    extract::{Path, State},
    response::{IntoResponse, Redirect},
};
use std::sync::Arc;

/// Redirects /documentation/:name to /documentation/:name/:latest_version/index.html
pub async fn redirect_to_latest(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    if validate_identifier(&name, "Package name").is_err() {
        return Redirect::to("/");
    }

    let latest_version: Option<String> = sqlx::query_scalar(
        "SELECT version FROM package_versions v 
         JOIN packages p ON v.package_id = p.id 
         WHERE p.name = $1 
         ORDER BY v.created_at DESC 
         LIMIT 1",
    )
    .bind(&name)
    .fetch_optional(&state.db)
    .await
    .unwrap_or_default();

    match latest_version {
        Some(version) => Redirect::to(&format!("/documentation/{}/{}/index.html", name, version)),
        None => Redirect::to("/"),
    }
}

/// Redirects /documentation/:name/:version to /documentation/:name/:version/index.html
pub async fn redirect_to_version(
    Path((name, version)): Path<(String, String)>,
) -> impl IntoResponse {
    if validate_identifier(&name, "Package name").is_err()
        || validate_identifier(&version, "Version").is_err()
    {
        return Redirect::to("/");
    }

    Redirect::to(&format!("/documentation/{}/{}/index.html", name, version))
}
