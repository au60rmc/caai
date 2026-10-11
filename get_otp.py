from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://postgres:Kumar2214%40%23@db.ywgnrqlvnhfrelkazpvj.supabase.co:5432/postgres"
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    res = conn.execute(text("SELECT u.user_email, a.attr_value, a.created_date FROM master.user_attr a JOIN master.user_master u ON a.user_id = u.id WHERE a.attr_name = 'PWD_OTP' AND a.active = 'Y' ORDER BY a.created_date DESC LIMIT 5"))
    for row in res:
        print(f"Email: {row[0]}, OTP: {row[1]}, Time: {row[2]}")
