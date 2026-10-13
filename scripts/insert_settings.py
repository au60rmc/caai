from sqlalchemy import create_engine, text
import uuid

DATABASE_URL = "postgresql://postgres:Kumar2214%40%23@db.ywgnrqlvnhfrelkazpvj.supabase.co:5432/postgres"
engine = create_engine(DATABASE_URL)

email = "kumaraids2006@gmail.com"
password = "gfde qsrj hixp xubi".replace(" ", "")

insert_query = text("""
INSERT INTO master.system_setting (id, key_name, key_value, key_type, active, sys_module)
VALUES 
(:id1, 'EMAIL', :val1, 'S', 'Y', 'MODULE_SYS'),
(:id2, 'EMAILPSCD', :val2, 'S', 'Y', 'MODULE_SYS')
""")

with engine.connect() as conn:
    # Check if they exist first
    res = conn.execute(text("SELECT key_name FROM master.system_setting WHERE key_name IN ('EMAIL', 'EMAILPSCD')"))
    existing = [row[0] for row in res]
    
    if 'EMAIL' not in existing and 'EMAILPSCD' not in existing:
        conn.execute(insert_query, {
            "id1": str(uuid.uuid4()), 
            "val1": email,
            "id2": str(uuid.uuid4()), 
            "val2": password
        })
        conn.commit()
        print("Successfully inserted EMAIL and EMAILPSCD settings.")
    else:
        # Update existing
        if 'EMAIL' in existing:
            conn.execute(text("UPDATE master.system_setting SET key_value = :val WHERE key_name = 'EMAIL'"), {"val": email})
        if 'EMAILPSCD' in existing:
            conn.execute(text("UPDATE master.system_setting SET key_value = :val WHERE key_name = 'EMAILPSCD'"), {"val": password})
        conn.commit()
        print("Successfully updated existing settings.")

