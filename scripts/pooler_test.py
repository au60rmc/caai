from sqlalchemy import create_engine, text
import time

URL = "postgresql://postgres:Kumar2214%40%23@db.ywgnrqlvnhfrelkazpvj.supabase.co:6543/postgres"
engine = create_engine(URL)

start = time.time()
try:
    with engine.connect() as conn:
        res = conn.execute(text("SELECT 1"))
    print(f"Connected to port 6543 in {time.time() - start:.2f} seconds!")
except Exception as e:
    print(f"Port 6543 failed: {e}")
