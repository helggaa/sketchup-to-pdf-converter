"""
FastAPI application for the SketchUp-to-PDF Converter PDF Service.

Exposes:
  POST /generate-pdf  — Accepts a RenderPayload and returns a PDF binary.
  GET  /health        — Returns {"status": "ok"} for health checks.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import ValidationError

from .models import RenderPayload
from .pdf_assembler import assemble_pdf

app = FastAPI(title="SketchUp-to-PDF Converter", version="1.0.0")

# ---------------------------------------------------------------------------
# CORS — allow requests from localhost during development
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server default
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------


def _format_validation_errors(errors: list) -> str:
    """Produce a compact, readable summary of Pydantic validation failures."""
    messages = []
    for err in errors:
        loc = " -> ".join(str(part) for part in err.get("loc", []))
        msg = err.get("msg", "invalid value")
        messages.append(f"{loc}: {msg}" if loc else msg)
    return "; ".join(messages)


@app.exception_handler(RequestValidationError)
async def request_validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Format FastAPI RequestValidationError as HTTP 400 with a human-readable detail."""
    detail = _format_validation_errors(exc.errors())
    return JSONResponse(status_code=400, content={"detail": detail})


@app.exception_handler(ValidationError)
async def pydantic_validation_error_handler(
    request: Request, exc: ValidationError
) -> JSONResponse:
    """Format Pydantic ValidationError as HTTP 400 with a human-readable detail."""
    detail = _format_validation_errors(exc.errors())
    return JSONResponse(status_code=400, content={"detail": detail})


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health")
async def health_check() -> dict:
    """Simple health-check endpoint."""
    return {"status": "ok"}


@app.post("/generate-pdf")
async def generate_pdf(payload: RenderPayload) -> Response:
    """
    Receive a RenderPayload, assemble a PDF, and return it as a binary download.

    Returns:
        200 application/pdf — the generated PDF document.
        400 application/json — if the payload fails validation.
    """
    pdf_bytes = assemble_pdf(payload)
    filename = f"{payload.filename}-views.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
