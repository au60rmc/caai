from fastapi import APIRouter
from app.core.config import settings

router = APIRouter(prefix="/api/debug", tags=["Debug"])

@router.get("/env")
def env_check():
    return {
        "status": "SUCCESS",
        "has_direct_url": bool(settings.database_url_direct),
        "db_host": settings.DATABASE_HOST,
        "is_localhost": settings.DATABASE_HOST == "localhost"
    }
