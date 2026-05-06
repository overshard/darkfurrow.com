mod almanac;
mod astro;
mod content;
mod markdown;
mod rng;
mod templates;

use axum::{
    extract::{Query, Request, State},
    http::{header, StatusCode},
    middleware::{self, Next},
    response::{Html, IntoResponse, Json, Response},
    routing::get,
    Router,
};
use chrono::Local;
use chrono_tz::America::New_York;
use minijinja::{context, Environment};
use serde::Deserialize;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;
use tower_http::services::ServeDir;
use tower_http::set_header::SetResponseHeaderLayer;

use content::SiteData;

#[derive(Clone)]
struct AppState {
    env: Arc<Environment<'static>>,
    data: Arc<SiteData>,
}

#[derive(Deserialize)]
struct ContentQuery {
    #[serde(default)]
    season: Option<String>,
}

#[tokio::main]
async fn main() {
    let project_root: PathBuf = std::env::var("DARKFURROW_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));

    let templates_dir = project_root.join("templates");
    let dist_dir = project_root.join("dist");
    let data_dir = project_root.join("data");
    let manifest_path = dist_dir.join(".vite/manifest.json");

    let env = templates::build_env(&templates_dir, &manifest_path);
    let data = content::load_data(&data_dir).expect("failed to load data");

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(8000);

    let state = AppState {
        env: Arc::new(env),
        data: Arc::new(data),
    };

    let app = Router::new()
        .route("/", get(index))
        .route("/api/content", get(api_content))
        .nest_service(
            "/static",
            tower::ServiceBuilder::new()
                .layer(SetResponseHeaderLayer::if_not_present(
                    header::CACHE_CONTROL,
                    header::HeaderValue::from_static("public, max-age=31536000"),
                ))
                .service(ServeDir::new(&dist_dir)),
        )
        .layer(middleware::from_fn(log_requests))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    eprintln!("darkfurrow listening on http://{addr}");
    axum::serve(listener, app).await.unwrap();
}

async fn log_requests(req: Request, next: Next) -> Response {
    let method = req.method().clone();
    let path = req
        .uri()
        .path_and_query()
        .map(|p| p.as_str().to_string())
        .unwrap_or_else(|| req.uri().path().to_string());
    let start = Instant::now();
    let response = next.run(req).await;
    let elapsed_ms = start.elapsed().as_secs_f64() * 1000.0;
    let status = response.status().as_u16();
    let now = Local::now().format("%H:%M:%S");
    let color = match status {
        200..=299 => "\x1b[32m",
        300..=399 => "\x1b[36m",
        400..=499 => "\x1b[33m",
        _ => "\x1b[31m",
    };
    eprintln!("{now} {method:<5} {color}{status}\x1b[0m {elapsed_ms:>7.2}ms  {path}");
    response
}

struct AppError(StatusCode, String);

impl<E: std::fmt::Display> From<E> for AppError {
    fn from(e: E) -> Self {
        AppError(StatusCode::INTERNAL_SERVER_ERROR, format!("internal error: {e}"))
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (self.0, self.1).into_response()
    }
}

async fn index(
    State(state): State<AppState>,
    Query(q): Query<ContentQuery>,
) -> Result<Html<String>, AppError> {
    let now = chrono::Utc::now().with_timezone(&New_York);
    let content = almanac::assemble_content(now, &state.data, q.season.as_deref());
    let tmpl = state.env.get_template("index.html")?;
    let body = tmpl.render(context! {
        date_line => content.date_line,
        season_name => content.season_name,
        season_note => content.season_note,
        season_key => content.season_key,
        time_key => content.time_key,
        haiku_html => content.haiku_html,
        sections_html => content.sections_html,
        footer_text => content.footer_text,
        season_nav_html => content.season_nav_html,
    })?;
    Ok(Html(body))
}

async fn api_content(
    State(state): State<AppState>,
    Query(q): Query<ContentQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let now = chrono::Utc::now().with_timezone(&New_York);
    let content = almanac::assemble_content(now, &state.data, q.season.as_deref());
    Ok(Json(serde_json::json!({
        "date_line": content.date_line,
        "season_name": content.season_name,
        "season_note": content.season_note,
        "season_key": content.season_key,
        "time_key": content.time_key,
        "haiku_html": content.haiku_html,
        "sections_html": content.sections_html,
        "footer_text": content.footer_text,
        "season_nav_html": content.season_nav_html,
    })))
}
