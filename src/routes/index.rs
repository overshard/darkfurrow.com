use axum::{
    extract::{Query, State},
    response::{Html, Json},
    routing::get,
    Router,
};
use chrono_tz::America::New_York;
use serde::Deserialize;

use crate::almanac::{self, Assembled};
use crate::app::AppState;
use crate::error::AppError;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(index))
        .route("/api/content", get(api_content))
}

#[derive(Deserialize)]
struct ContentQuery {
    #[serde(default)]
    season: Option<String>,
}

fn build(state: &AppState, season: Option<&str>) -> Assembled {
    let now = chrono::Utc::now().with_timezone(&New_York);
    almanac::assemble_content(now, &state.data, season)
}

async fn index(
    State(state): State<AppState>,
    Query(q): Query<ContentQuery>,
) -> Result<Html<String>, AppError> {
    let content = build(&state, q.season.as_deref());
    let tmpl = state.env.get_template("index.html")?;
    Ok(Html(tmpl.render(content)?))
}

async fn api_content(
    State(state): State<AppState>,
    Query(q): Query<ContentQuery>,
) -> Result<Json<Assembled>, AppError> {
    Ok(Json(build(&state, q.season.as_deref())))
}
