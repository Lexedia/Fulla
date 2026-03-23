mod handlers;
mod models;
mod storage;
mod utils;
mod worker;

use axum::{
    Router,
    body::Body,
    extract::DefaultBodyLimit,
    http::{Method, Request, header},
    middleware::{self, Next},
    response::Response,
    routing::{delete, get, post},
};
use handlers::docs;
use sqlx::PgPool;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_governor::{GovernorLayer, governor::GovernorConfigBuilder};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::services::ServeDir;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub storage: Arc<dyn storage::PackageStorage>,
    pub search: Option<meilisearch_sdk::client::Client>,
}

async fn pub_api_headers(req: Request<Body>, next: Next) -> Response {
    let mut response = next.run(req).await;

    if let Some(content_type) = response.headers().get(header::CONTENT_TYPE) {
        if content_type == "application/json" {
            response.headers_mut().insert(
                header::CONTENT_TYPE,
                "application/vnd.pub.v2+json".parse().unwrap(),
            );
        }
    }

    response
}

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    let pool = PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to Postgres");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    let storage_path = std::env::var("STORAGE_PATH").unwrap_or_else(|_| "./storage".to_string());
    std::fs::create_dir_all(&storage_path).expect("Failed to create storage directory");

    let search = if let Ok(meili_url) = std::env::var("MEILI_URL") {
        let meili_key =
            std::env::var("MEILI_MASTER_KEY").unwrap_or_else(|_| "masterKey".to_string());
        let client = meilisearch_sdk::client::Client::new(meili_url, Some(meili_key))
            .expect("Failed to create Meilisearch client");

        let _ = client.create_index("packages", Some("id")).await;
        let _ = client
            .index("packages")
            .set_filterable_attributes(&["score", "updated_at", "owner_username"])
            .await;
        let _ = client
            .index("packages")
            .set_sortable_attributes(&["score", "updated_at"])
            .await;

        tracing::info!("Meilisearch enabled");
        Some(client)
    } else {
        tracing::info!("MEILI_URL not set — search will fall back to Postgres");
        None
    };

    let storage_backend =
        std::env::var("STORAGE_BACKEND").unwrap_or_else(|_| "filesystem".to_string());
    let storage: Arc<dyn storage::PackageStorage> = match storage_backend.as_str() {
        "s3" => {
            tracing::info!("Initializing S3 storage backend");

            let bucket = std::env::var("S3_BUCKET").expect("S3_BUCKET must be set for S3 storage");
            let region = std::env::var("S3_REGION").unwrap_or_else(|_| "us-east-1".to_string());
            let prefix = std::env::var("S3_PREFIX").unwrap_or_default();
            let expiration_secs = std::env::var("S3_PRESIGNED_URL_EXPIRATION")
                .unwrap_or_else(|_| "1500".to_string())
                .parse::<u64>()
                .expect("S3_PRESIGNED_URL_EXPIRATION must be a number");

            let mut config_loader = aws_config::defaults(aws_config::BehaviorVersion::latest())
                .region(aws_config::Region::new(region.clone()));

            if let Ok(endpoint) = std::env::var("S3_ENDPOINT") {
                tracing::info!("Using custom S3 endpoint: {}", endpoint);
                config_loader = config_loader.endpoint_url(endpoint);
            }

            let aws_config = config_loader.load().await;

            let s3_config = aws_sdk_s3::config::Builder::from(&aws_config)
                .force_path_style(true)
                .build();
            let s3_client = aws_sdk_s3::Client::from_conf(s3_config);

            let presigning_client = if let Ok(public_url) = std::env::var("S3_PUBLIC_URL") {
                tracing::info!(
                    "Using public S3 endpoint for presigned URLs: {}",
                    public_url
                );
                let public_loader = aws_config::defaults(aws_config::BehaviorVersion::latest())
                    .region(aws_config::Region::new(region.clone()))
                    .endpoint_url(public_url);

                let public_aws_config = public_loader.load().await;
                let public_s3_config = aws_sdk_s3::config::Builder::from(&public_aws_config)
                    .force_path_style(true)
                    .build();
                aws_sdk_s3::Client::from_conf(public_s3_config)
            } else {
                s3_client.clone()
            };

            Arc::new(storage::S3Storage::new(
                s3_client,
                presigning_client,
                bucket,
                prefix,
                expiration_secs,
            ))
        }
        "filesystem" | _ => {
            tracing::info!("Initializing filesystem storage backend");

            let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
            let base_url =
                std::env::var("BASE_URL").unwrap_or_else(|_| format!("http://localhost:{}", port));

            Arc::new(storage::FilesystemStorage::new(
                std::path::PathBuf::from(&storage_path),
                base_url,
            ))
        }
    };

    let state = Arc::new(AppState {
        db: pool,
        storage,
        search,
    });

    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse::<u16>()
        .expect("PORT must be a number");

    let docs_path = std::path::Path::new(&storage_path).join("docs");
    let docs_router = Router::new()
        .route("/{name}", get(docs::redirect_to_latest))
        .route("/{name}/latest", get(docs::redirect_to_latest))
        .route("/{name}/{version}", get(docs::redirect_to_version))
        .fallback_service(ServeDir::new(docs_path))
        .with_state(state.clone());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("listening on {}", addr);

    let max_upload_size_str =
        std::env::var("MAX_UPLOAD_SIZE").unwrap_or_else(|_| "100 MiB".to_string());
    let max_upload_size = max_upload_size_str
        .parse::<bytesize::ByteSize>()
        .expect("Invalid MAX_UPLOAD_SIZE format (e.g., '5 GiB', '100MB')")
        .as_u64();

    let auth_governor_register = GovernorConfigBuilder::default()
        .per_second(10)
        .burst_size(10)
        .finish()
        .expect("Failed to build governor config");
    let auth_governor_login = GovernorConfigBuilder::default()
        .per_second(10)
        .burst_size(10)
        .finish()
        .expect("Failed to build governor config");

    let cors_origin =
        std::env::var("BASE_URL").unwrap_or_else(|_| format!("http://localhost:{}", port));
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::exact(
            cors_origin
                .parse()
                .expect("Invalid BASE_URL for CORS origin"),
        ))
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE, header::ACCEPT])
        .allow_credentials(true);

    let app = Router::new()
        .route(
            "/api/packages/{package}",
            get(handlers::packages::list_package_versions)
                .patch(handlers::packages::discontinue_package),
        )
        .route(
            "/api/packages/{package}/advisories",
            get(handlers::packages::list_package_advisories),
        )
        .route(
            "/api/packages/{package}/versions/{version}/details",
            get(handlers::packages::get_package_details),
        )
        .route(
            "/api/packages/{package}/versions/{version}",
            get(handlers::packages::inspect_package_version),
        )
        .route(
            "/api/packages/{package}/versions",
            get(handlers::packages::list_package_versions_tidy),
        )
        .route(
            "/api/packages/versions/new",
            get(handlers::upload::publish_new_version),
        )
        .route(
            "/api/upload",
            post(handlers::upload::upload_package)
                .layer(DefaultBodyLimit::max(max_upload_size as usize)),
        )
        .route(
            "/api/publish/finalize/{id}",
            get(handlers::upload::finalize_publish),
        )
        .route(
            "/packages/{name}/versions/{version}",
            get(handlers::packages::download_package),
        )
        .route(
            "/api/tokens",
            get(handlers::auth::list_tokens).post(handlers::auth::create_token),
        )
        .route("/api/tokens/{id}", delete(handlers::auth::delete_token))
        .route(
            "/api/auth/register",
            post(handlers::auth::register).layer(GovernorLayer::new(auth_governor_register)),
        )
        .route(
            "/api/auth/login",
            post(handlers::auth::login).layer(GovernorLayer::new(auth_governor_login)),
        )
        .route(
            "/api/profile/avatar",
            post(handlers::profile::upload_avatar).layer(DefaultBodyLimit::max(10 * 1024 * 1024)), // 10 MiB for avatars
        )
        .route(
            "/_avatars/{user_id}",
            get(handlers::profile::download_avatar),
        )
        .route("/api/search", get(handlers::search::search_packages))
        .route("/api/admin/stats", get(handlers::admin::get_stats))
        .route(
            "/api/admin/users",
            get(handlers::admin::list_users).post(handlers::admin::create_user),
        )
        .route(
            "/api/admin/users/{id}",
            delete(handlers::admin::delete_user),
        )
        .route(
            "/api/admin/users/{id}/admin",
            axum::routing::patch(handlers::admin::set_admin_status),
        )
        .nest("/documentation", docs_router)
        .layer(middleware::from_fn(pub_api_headers))
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap();
}
