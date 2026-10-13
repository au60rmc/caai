from sqlalchemy import create_engine, text
import sys

DATABASE_URL = "postgresql://postgres:Kumar2214%40%23@db.ywgnrqlvnhfrelkazpvj.supabase.co:5432/postgres"
engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    res = conn.execute(text("SELECT key_name, key_value FROM master.system_setting WHERE key_name IN ('EMAIL', 'EMAILPSCD')"))
    for row in res:
        print(f"{row[0]}: {row[1]}")
