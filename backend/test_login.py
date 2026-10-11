import os
import sys

from dotenv import load_dotenv
load_dotenv()

from app.core.database import SessionLocal
from app.models.user_master import UserMaster
from app.models.auth import UserAttr
from app.core.security import verify_password

def check_login(username, password):
    db = SessionLocal()
    user = db.query(UserMaster).filter(UserMaster.user_name == username).first()
    if not user:
        print(f"User {username} not found")
        return

    attr = db.query(UserAttr).filter(UserAttr.user_id == user.id, UserAttr.attr_name == "PWD", UserAttr.active == "Y").first()
    if not attr:
        print(f"No active PWD attribute for {username}")
        return

    hashed = attr.attr_value
    print(f"Stored Hash: {hashed}")
    
    # Try verify
    try:
        res = verify_password(password, hashed)
        print(f"verify_password result: {res}")
    except Exception as e:
        print(f"Exception during verify: {e}")
        
    db.close()

if __name__ == "__main__":
    check_login("admin", "ImmBizAdmin2026!")
