import os
import sys

from dotenv import load_dotenv
load_dotenv()

from app.core.database import SessionLocal
from app.models.user_master import UserMaster
from app.models.auth import UserAttr
from app.core.security import get_password_hash

def reset_admin():
    db = SessionLocal()
    user = db.query(UserMaster).filter(UserMaster.user_name == "admin").first()
    if not user:
        print("No admin user found")
        return

    attr = db.query(UserAttr).filter(UserAttr.user_id == user.id, UserAttr.attr_name == "PWD", UserAttr.active == "Y").first()
    if not attr:
        print("No PWD attr found")
        return

    new_pass = "ImmBizAdmin2026!"
    hashed = get_password_hash(new_pass)
    attr.attr_value = hashed
    db.commit()
    print(f"Successfully reset admin password to: {new_pass}")
    db.close()

if __name__ == "__main__":
    reset_admin()
