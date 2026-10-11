"""
Demo Schema Management Utility.
Clones the master schema into demo schema for completely isolated sandbox testing.
"""
import logging
from sqlalchemy import create_engine, text
from app.core.config import settings

logger = logging.getLogger(__name__)


def reset_demo_schema(db_url: str = None) -> bool:
    """Drops and recreates demo schema, copying all tables and seed data from master."""
    target_url = db_url or settings.DATABASE_URL
    if target_url.startswith("sqlite"):
        logger.info("SQLite does not use PostgreSQL schema cloning.")
        return True

    engine = create_engine(target_url)
    try:
        with engine.connect() as conn:
            logger.info("Recreating demo schema...")
            conn.execute(text("DROP SCHEMA IF EXISTS demo CASCADE; CREATE SCHEMA demo;"))
            conn.commit()

            tables = conn.execute(
                text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'master';")
            ).fetchall()

            for t in tables:
                tbl = t[0]
                conn.execute(
                    text(
                        f"CREATE TABLE demo.{tbl} (LIKE master.{tbl} "
                        "INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);"
                    )
                )
                conn.execute(text(f"INSERT INTO demo.{tbl} SELECT * FROM master.{tbl};"))
                conn.commit()
                logger.info("Cloned table demo.%s", tbl)

            logger.info("Successfully reset demo schema from master!")
            return True
    except Exception as e:
        logger.error("Failed to reset demo schema: %s", e)
        raise e
    finally:
        engine.dispose()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    reset_demo_schema()
