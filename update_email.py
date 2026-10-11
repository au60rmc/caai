from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://postgres:Kumar2214%40%23@db.ywgnrqlvnhfrelkazpvj.supabase.co:5432/postgres"
engine = create_engine(DATABASE_URL)

email = "kumarimmbizsoft@gmail.com"

with engine.connect() as conn:
    conn.execute(text("UPDATE master.system_setting SET key_value = :val WHERE key_name = 'EMAIL'"), {"val": email})
    conn.commit()
    print("Successfully updated SENDER EMAIL in database.")
