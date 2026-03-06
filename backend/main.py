"""FastAPI application entry point.

Start the server:
    uv run fastapi dev main.py
    # or for production:
    uv run fastapi run main.py --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import logging

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.analyze import router as analyze_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Episodic Intelligence Engine",
    description=(
        "AI-powered API that decomposes story ideas into optimised "
        "multi-episode arcs for 90-second vertical video."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    """Simple liveness probe."""
    return {"status": "ok"}
