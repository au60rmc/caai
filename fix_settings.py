from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://postgres:Kumar2214%40%23@db.ywgnrqlvnhfrelkazpvj.supabase.co:5432/postgres"
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    conn.execute(text("UPDATE master.system_setting SET sys_module = 'MODULE_SMS_EMAIL' WHERE key_name IN ('EMAIL', 'EMAILPSCD')"))
    conn.commit()
    print("Fixed sys_module!")
