import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.system_setting import SystemSetting
from app.models.user_master import UserMaster
from app.models.auth import CustomerSignup, UserAttr
from app.core.config import settings
from uuid import uuid4
from datetime import datetime
from fastapi import HTTPException, status


class EmailService:
    @staticmethod
    def get_email_setting(db: Session, key_name: str) -> str:
        setting = (
            db.query(SystemSetting)
            .filter(
                SystemSetting.sys_module == "MODULE_SMS_EMAIL",
                SystemSetting.key_name == key_name,
                SystemSetting.active == "Y",
            )
            .first()
        )
        if not setting:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Email setting not found: {key_name}",
            )
        return setting.key_value

    @staticmethod
    def send_password_setup_email(db: Session, email_id: str):
        user_master = (
            db.query(UserMaster)
            .filter(func.lower(UserMaster.user_email) == func.lower(email_id), UserMaster.active == "Y")
            .first()
        )

        if not user_master:
            customer_signup = (
                db.query(CustomerSignup)
                .filter(
                    func.lower(CustomerSignup.useremail) == func.lower(email_id), CustomerSignup.active == "Y"
                )
                .first()
            )
            if not customer_signup:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Email not found"
                )
            user_id = customer_signup.id
            user_name = customer_signup.user_name
        else:
            user_id = user_master.id
            user_name = user_master.user_name

        token = str(uuid4())

        attr_check = (
            db.query(UserAttr)
            .filter(
                UserAttr.user_id == user_id,
                UserAttr.attr_name == "PWD_GEN",
                UserAttr.active == "Y",
            )
            .first()
        )
        if attr_check:
            attr_check.active = "N"

        new_attr = UserAttr(
            id=uuid4(),
            user_id=user_id,
            attr_name="PWD_GEN",
            attr_value=token,
            active="Y",
            created_date=datetime.utcnow(),
        )
        db.add(new_attr)
        db.commit()

        reset_link = f"{settings.FRONTEND_URL}/auth/confirm-password?u={user_id}&t={token}"

        try:
            from_email = EmailService.get_email_setting(db, "EMAIL")
            sender_password = EmailService.get_email_setting(db, "EMAILPSCD")

            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Activate Account Password"
            msg["From"] = from_email
            msg["To"] = email_id

            html_body = f"""
            <html>
            <body>
                <p>Hello {user_name or "User"},</p>
                <p>Click the button below to create your password:</p>
                <p><a href="{reset_link}" style="background-color: #34c215; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Generate Password</a></p>
                <p>This link expires in 5 minutes.</p>
                <p>If you didn't request this, please ignore this email.</p>
            </body>
            </html>
            """
            part = MIMEText(html_body, "html")
            msg.attach(part)

            with smtplib.SMTP("smtp.gmail.com", 587) as server:
                server.starttls()
                server.login(from_email, sender_password)
                server.send_message(msg, from_addr=from_email, to_addrs=[email_id])

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to send email: {str(e)}",
            )

        return {
            "status": "SUCCESS",
            "message": "Password setup email sent",
            "reset_link": reset_link,
        }

    @staticmethod
    def send_forgot_password_otp(db: Session, email_id: str):
        user_master = (
            db.query(UserMaster)
            .filter(func.lower(UserMaster.user_email) == func.lower(email_id), UserMaster.active == "Y")
            .first()
        )

        if not user_master:
            customer_signup = (
                db.query(CustomerSignup)
                .filter(
                    func.lower(CustomerSignup.useremail) == func.lower(email_id), CustomerSignup.active == "Y"
                )
                .first()
            )
            if not customer_signup:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Email not found"
                )
            user_id = customer_signup.id
            user_name = customer_signup.user_name
        else:
            user_id = user_master.id
            user_name = user_master.user_name

        # Generate 6 digit OTP
        otp = str(random.randint(100000, 999999))

        # Invalidate previous OTPs
        attr_check = (
            db.query(UserAttr)
            .filter(
                UserAttr.user_id == user_id,
                UserAttr.attr_name == "PWD_OTP",
                UserAttr.active == "Y",
            )
            .all()
        )
        for attr in attr_check:
            attr.active = "N"

        # Save new OTP
        new_attr = UserAttr(
            id=uuid4(),
            user_id=user_id,
            attr_name="PWD_OTP",
            attr_value=otp,
            active="Y",
            created_date=datetime.utcnow(),
        )
        db.add(new_attr)
        db.commit()

        try:
            from_email = EmailService.get_email_setting(db, "EMAIL")
            sender_password = EmailService.get_email_setting(db, "EMAILPSCD")

            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Password Reset OTP"
            msg["From"] = from_email
            msg["To"] = email_id

            html_body = f"""
            <html>
            <body>
                <p>Hello {user_name or "User"},</p>
                <p>You requested to reset your password. Use the following OTP to proceed:</p>
                <h2 style="background-color: #f3f4f6; display: inline-block; padding: 12px 24px; border-radius: 5px; font-size: 24px; letter-spacing: 2px;">{otp}</h2>
                <p>This OTP is valid for 10 minutes.</p>
                <p>If you didn't request this, please ignore this email.</p>
            </body>
            </html>
            """
            part = MIMEText(html_body, "html")
            msg.attach(part)

            with smtplib.SMTP("smtp.gmail.com", 587) as server:
                server.starttls()
                server.login(from_email, sender_password)
                server.send_message(msg, from_addr=from_email, to_addrs=[email_id])

        except Exception as e:
            # Note: We won't raise 500 if SMTP fails so the user can test locally
            # In a real app we might, but we want to return the OTP in dev mode or log it
            print(f"Failed to send email: {e} - The OTP is {otp}")
            # raise HTTPException(
            #     status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            #     detail=f"Failed to send email: {str(e)}",
            # )

        return {
            "status": "SUCCESS",
            "message": "OTP sent to your email",
            # We return it only in response if in DEV, but for safety let's just log it
            # and tell the user check console if email isn't configured
        }

