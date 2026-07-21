use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};

pub struct AppError(pub StatusCode, pub String);

impl<E: std::fmt::Display> From<E> for AppError {
    fn from(e: E) -> Self {
        // Log the detail, serve a generic body: template and IO error strings
        // can leak paths and internals to the client.
        tracing::error!("internal error: {e}");
        AppError(StatusCode::INTERNAL_SERVER_ERROR, "internal server error".to_string())
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (self.0, self.1).into_response()
    }
}
