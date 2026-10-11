from pydantic import Field
from pydantic_settings import BaseSettings
from typing import Optional
from urllib.parse import quote_plus


class Settings(BaseSettings):
    DATABASE_HOST: str = "localhost"
    DATABASE_PORT: int = 5432
    DATABASE_NAME: str = "masters_db"
    DATABASE_USER: str = "postgres"
    DATABASE_PASSWORD: str = "Admin01"

    # Allow direct DATABASE_URL override from env/.env
    database_url_direct: Optional[str] = Field(default=None, alias="DATABASE_URL")

    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    DEBUG: bool = True
    FRONTEND_URL: str = "http://localhost:4200"

    # Docling auto-detection: the app checks what's installed at startup.
    # - Docling installed → full pipeline (OCR, images, scanned PDFs)
    # - Only PyPDF2 → lightweight path (digital PDFs, Excel, CSV)
    # Override with ENABLE_DOCLING=true/false if needed.
    ENABLE_DOCLING: Optional[bool] = Field(default=None)

    JWT_SECRET_KEY: str = "your-super-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440  # 24 hours (1 day)

    @property
    def DATABASE_URL(self) -> str:
        SUPABASE_TX_POOLER = (
            "postgresql://postgres.ywgnrqlvnhfrelkazpvj:Kumar2214%40%23"
            "@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require"
        )
        url = self.database_url_direct
        if not url:
            import os
            # On Vercel, if DATABASE_URL was not set in project settings, default to transaction pooler
            if os.getenv("VERCEL"):
                return SUPABASE_TX_POOLER
            # Otherwise use default host/port credentials
            user = quote_plus(self.DATABASE_USER)
            password = quote_plus(self.DATABASE_PASSWORD)
            return f"postgresql://{user}:{password}@{self.DATABASE_HOST}:{self.DATABASE_PORT}/{self.DATABASE_NAME}"

        # If on Vercel and connecting to Supabase pooler, route to transaction pooler (port 6543)
        import os
        if os.getenv("VERCEL") and "pooler.supabase.com:5432" in url:
            url = url.replace("pooler.supabase.com:5432", "pooler.supabase.com:6543")

        # Fix unencoded special chars in Vercel env variable if user pasted them directly
        if url.startswith("postgresql://") and url.count("@") > 1:
            import urllib.parse
            prefix, remainder = url.split("://", 1)
            last_at = remainder.rfind("@")
            user_pass = remainder[:last_at]
            host_db = remainder[last_at+1:]
            if ":" in user_pass:
                user, pwd = user_pass.split(":", 1)
                if "%" not in pwd or "@" in pwd:
                    pwd = urllib.parse.quote(urllib.parse.unquote(pwd))
                user_pass = f"{user}:{pwd}"
            url = f"{prefix}://{user_pass}@{host_db}"
        return url

    model_config = {"env_file": "../.env", "case_sensitive": True, "extra": "ignore"}


settings = Settings()
