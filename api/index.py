"""Vercel serverless entry point for the FastAPI backend.

Vercel's Python runtime serves the ASGI object named `app`. All `/api/*`
requests are routed here by vercel.json. The backend package lives in
../backend, so we add it to sys.path before importing the app.
"""
import sys
from pathlib import Path

_backend_dir = Path(__file__).resolve().parent.parent / "backend"
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from app.main import app  # noqa: E402,F401
