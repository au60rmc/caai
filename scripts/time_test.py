import smtplib
import time
from sqlalchemy import create_engine, text

start = time.time()
print("Starting DB connection...")
DATABASE_URL = "postgresql://postgres:Kumar2214%40%23@db.ywgnrqlvnhfrelkazpvj.supabase.co:5432/postgres"
engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    res = conn.execute(text("SELECT 1"))
db_time = time.time() - start
print(f"DB connection took: {db_time:.2f} seconds")

start = time.time()
print("Starting SMTP connection...")
email = "kumarimmbizsoft@gmail.com"
password = "gfdeqsrjhixpxubi"
try:
    server = smtplib.SMTP("smtp.gmail.com", 587)
    server.starttls()
    server.login(email, password)
    server.quit()
    smtp_time = time.time() - start
    print(f"SMTP connection took: {smtp_time:.2f} seconds")
except Exception as e:
    print(f"SMTP error: {e}")
