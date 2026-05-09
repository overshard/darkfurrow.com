use axum::{http::header, middleware as axum_middleware, Router};
use minijinja::Environment;
use std::path::PathBuf;
use std::sync::Arc;
use tower_http::services::ServeDir;
use tower_http::set_header::SetResponseHeaderLayer;

use crate::content::{self, SiteData};
use crate::middleware::log_requests;
use crate::routes;
use crate::templates;

#[derive(Clone)]
pub struct AppState {
    pub env: Arc<Environment<'static>>,
    pub data: Arc<SiteData>,
    pub dist_dir: PathBuf,
}

impl AppState {
    pub fn from_env() -> Self {
        let project_root: PathBuf = std::env::var("DARKFURROW_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("."));

        let templates_dir = project_root.join("templates");
        let dist_dir = project_root.join("dist");
        let content_dir = project_root.join("content");
        let manifest_path = dist_dir.join(".vite/manifest.json");

        let env = templates::build_env(&templates_dir, &manifest_path);
        let data = content::load_data(&content_dir).expect("failed to load data");

        Self {
            env: Arc::new(env),
            data: Arc::new(data),
            dist_dir,
        }
    }
}

pub fn router(state: AppState) -> Router {
    let static_files = tower::ServiceBuilder::new()
        .layer(SetResponseHeaderLayer::if_not_present(
            header::CACHE_CONTROL,
            header::HeaderValue::from_static("public, max-age=31536000"),
        ))
        .service(ServeDir::new(&state.dist_dir));

    Router::new()
        .merge(routes::index::router())
        .nest_service("/static", static_files)
        .layer(axum_middleware::from_fn(log_requests))
        .with_state(state)
}
