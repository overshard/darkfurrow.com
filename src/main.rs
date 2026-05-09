mod almanac;
mod app;
mod astro;
mod content;
mod error;
mod markdown;
mod middleware;
mod rng;
mod routes;
mod templates;

use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(8000);

    let app = app::router(app::AppState::from_env());
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    eprintln!("darkfurrow listening on http://{addr}");
    axum::serve(listener, app).await.unwrap();
}
