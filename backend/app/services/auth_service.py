from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.user_master import UserMaster, UserRoleMap
from app.models.app_features import AppFeature
from app.models.app_feature_rolemap import AppFeatureRolemap
from app.models.app_module import AppModule
from app.models.auth import CustomerSignup, UserAttr, UserLoginAudit
from app.schemas.auth import (
    LoginRequest,
    DemoLoginRequest,
    LoginData,
    UserInfo,
    PermissionItem,
    SignupRequest,
)
from app.core.security import verify_password, create_access_token, get_password_hash, validate_password_policy
from app.core.feature_codes import COMMON_VIEW_FEATURES
from uuid import uuid4, UUID
from datetime import datetime
import re
from fastapi import HTTPException, status


class AuthService:
    @staticmethod
    def signup(db: Session, signup_data: SignupRequest):
        email_in_user_master = (
            db.query(UserMaster)
            .filter(func.lower(UserMaster.user_email) == func.lower(signup_data.useremail))
            .first()
        )
        email_in_customer = (
            db.query(CustomerSignup)
            .filter(func.lower(CustomerSignup.useremail) == func.lower(signup_data.useremail))
            .first()
        )
        if email_in_user_master or email_in_customer:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your Mail-id is existing",
            )

        if signup_data.mobile:
            mobile_in_user_master = (
                db.query(UserMaster)
                .filter(UserMaster.user_state == signup_data.mobile)
                .first()
            )
            mobile_in_customer = (
                db.query(CustomerSignup)
                .filter(CustomerSignup.mobile == signup_data.mobile)
                .first()
            )
            if mobile_in_user_master or mobile_in_customer:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Your Mobile number is existing",
                )

        customer = CustomerSignup(
            id=uuid4(),
            user_name=signup_data.user_name,
            useremail=signup_data.useremail,
            first_name=signup_data.first_name,
            last_name=signup_data.last_name,
            mobile=signup_data.mobile,
            active="Y",
        )
        db.add(customer)
        db.commit()
        return customer

    @staticmethod
    def login(db: Session, login_data: LoginRequest) -> LoginData:
        user = None

        user_master = (
            db.query(UserMaster)
            .filter(
                (func.lower(UserMaster.user_email) == func.lower(login_data.email))
                | (func.lower(UserMaster.user_name) == func.lower(login_data.email))
            )
            .first()
        )

        if user_master:
            user = user_master
        else:
            customer_signup = (
                db.query(CustomerSignup)
                .filter(
                    (func.lower(CustomerSignup.useremail) == func.lower(login_data.email))
                    | (func.lower(CustomerSignup.user_name) == func.lower(login_data.email))
                )
                .first()
            )
            if customer_signup:
                user = customer_signup

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        user_attr = (
            db.query(UserAttr)
            .filter(
                UserAttr.user_id == user.id,
                UserAttr.attr_name == "PWD",
                UserAttr.active == "Y",
            )
            .first()
        )

        if not user_attr or not verify_password(
            login_data.password, user_attr.attr_value
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        AuthService._log_login(db, user.id)

        user_info = UserInfo(
            id=user.id,
            user_name=user.user_name,
            first_name=user.first_name,
            last_name=user.last_name,
            user_email=getattr(user, "user_email", None)
            or getattr(user, "useremail", None),
            user_type=getattr(user, "user_type", None),
        )

        access_token = create_access_token(
            data={
                "sub": user_info.user_email,
                "user_id": str(user_info.id),
                "user_name": user_info.user_name,
            }
        )

        permissions = AuthService.get_user_permissions(db, user.id)

        must_change_password = (
            db.query(UserAttr)
            .filter(
                UserAttr.user_id == user.id,
                UserAttr.attr_name == "FORCE_PWD_CHANGE",
                UserAttr.active == "Y",
            )
            .first()
            is not None
        )

        return LoginData(
            user=user_info,
            access_token=access_token,
            token_type="Bearer",
            expires_in=1800,
            permissions=permissions,
            must_change_password=must_change_password,
        )

    @staticmethod
    def demo_login(db: Session, request: DemoLoginRequest) -> LoginData:
        demo_email = request.email.lower().strip()
        user = None

        user_master = (
            db.query(UserMaster)
            .filter(func.lower(UserMaster.user_email) == demo_email)
            .first()
        )
        if user_master:
            user = user_master
            # Ensure they have demo status if they are logging in via demo flow
            # (In a real app you might want to prevent real users from using demo flow, 
            # but for now we'll allow it and ensure they get the demo experience)
            if user.user_type != "D":
                user.user_type = "D"
                db.commit()
                db.refresh(user)
        else:
            user = UserMaster(
                id=uuid4(),
                user_name=demo_email.split('@')[0],
                user_email=demo_email,
                first_name="Demo",
                last_name="User",
                user_type="D",
                active="Y",
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        AuthService._log_login(db, user.id)

        user_info = UserInfo(
            id=user.id,
            user_name=user.user_name,
            first_name=user.first_name,
            last_name=user.last_name,
            user_email=getattr(user, "user_email", None) or getattr(user, "useremail", None),
            user_type=getattr(user, "user_type", None),
        )

        access_token = create_access_token(
            data={
                "sub": user_info.user_email,
                "user_id": str(user_info.id),
                "user_name": user_info.user_name,
                "user_type": "D",
                "is_demo": True,
            }
        )

        permissions = []
        all_features = db.query(AppFeature).filter(AppFeature.active == "Y").all()
        for feature in all_features:
            module = db.query(AppModule).filter(AppModule.id == feature.app_module_id).first()
            permissions.append(
                PermissionItem(
                    module=module.module_name if module else "",
                    module_order=module.module_dis_order if module else 0,
                    feature=feature.feature_name,
                    feature_code=feature.feature_code,
                    feature_url=feature.feature_url or "",
                    view=True,
                    write=True,
                    delete=True,
                )
            )

        return LoginData(
            user=user_info,
            access_token=access_token,
            token_type="Bearer",
            expires_in=1800,
            permissions=permissions,
            must_change_password=False,
        )

    @staticmethod
    def get_user_permissions(db: Session, user_id: UUID) -> list[PermissionItem]:
        # Unrestricted: grant full access (view, write, delete) across all active features
        all_features = db.query(AppFeature).filter(AppFeature.active == "Y").all()
        permissions = []
        for feature in all_features:
            module = db.query(AppModule).filter(AppModule.id == feature.app_module_id).first()
            permissions.append(
                PermissionItem(
                    module=module.module_name if module else "",
                    module_order=module.module_dis_order if module else 0,
                    feature=feature.feature_name,
                    feature_code=feature.feature_code,
                    feature_url=feature.feature_url or "",
                    view=True,
                    write=True,
                    delete=True,
                )
            )
        return permissions

    @staticmethod
    def _log_login(db: Session, user_id):
        audit = UserLoginAudit(
            id=uuid4(),
            user_id=user_id,
            log_in_date=datetime.utcnow(),
            created_date=datetime.utcnow(),
        )
        db.add(audit)
        db.commit()

    @staticmethod
    def logout(db: Session, user_id: UUID):
        latest_audit = (
            db.query(UserLoginAudit)
            .filter(
                UserLoginAudit.user_id == user_id,
                UserLoginAudit.log_out_date.is_(None),
            )
            .order_by(UserLoginAudit.log_in_date.desc())
            .first()
        )
        if latest_audit:
            latest_audit.log_out_date = datetime.utcnow()
            db.commit()
        return (True, "SUCCESS", "Logged out successfully")

    @staticmethod
    def verify_token(db: Session, user_id: str, token: str):
        user_attr = (
            db.query(UserAttr)
            .filter(
                UserAttr.user_id == UUID(user_id),
                UserAttr.attr_value == token,
                UserAttr.attr_name == "PWD_GEN",
                UserAttr.active == "Y",
            )
            .first()
        )

        if not user_attr:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token"
            )

        elapsed = datetime.utcnow() - user_attr.created_date.replace(tzinfo=None)
        if elapsed.total_seconds() > 300:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Link has expired"
            )

        return {"status": "SUCCESS", "result": "VALID"}

    @staticmethod
    def reset_password(db: Session, user_id: str, confirm_password: str, token: str):
        AuthService.verify_token(db, user_id, token)
        password = confirm_password
        AuthService._validate_password_complexity(password)

        db.query(UserAttr).filter(
            UserAttr.user_id == UUID(user_id),
            UserAttr.attr_name == "PWD",
            UserAttr.active == "Y",
        ).update({"active": "N"})
        db.commit()

        hashed = get_password_hash(password)

        new_attr = UserAttr(
            id=uuid4(),
            user_id=UUID(user_id),
            attr_name="PWD",
            attr_value=hashed,
            active="Y",
            created_date=datetime.utcnow(),
        )
        db.add(new_attr)
        db.commit()

        db.query(UserAttr).filter(
            UserAttr.user_id == UUID(user_id),
            UserAttr.attr_name == "PWD_GEN",
            UserAttr.active == "Y",
        ).update({"active": "N"})
        db.commit()

        return {"status": "SUCCESS", "message": "Password created successfully"}

    @staticmethod
    def _validate_password_complexity(password: str) -> None:
        if not validate_password_policy(password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password does not meet security requirements. It must be at least 8 characters and not in the compromised passwords blocklist.",
            )

    @staticmethod
    def change_password(db: Session, user_id, current_password: str, new_password: str):
        attr = (
            db.query(UserAttr)
            .filter(
                UserAttr.user_id == user_id,
                UserAttr.attr_name == "PWD",
                UserAttr.active == "Y",
            )
            .first()
        )
        if not attr or not verify_password(current_password, attr.attr_value):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )

        AuthService._validate_password_complexity(new_password)

        if verify_password(new_password, attr.attr_value):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be different from the current password",
            )

        attr.active = "N"
        db.add(
            UserAttr(
                id=uuid4(),
                user_id=user_id,
                attr_name="PWD",
                attr_value=get_password_hash(new_password),
                active="Y",
                created_date=datetime.utcnow(),
            )
        )
        db.query(UserAttr).filter(
            UserAttr.user_id == user_id,
            UserAttr.attr_name == "FORCE_PWD_CHANGE",
            UserAttr.active == "Y",
        ).update({"active": "N"})
        db.commit()
        return {"status": "SUCCESS", "message": "Password changed successfully"}

    @staticmethod
    def verify_otp(db: Session, email: str, otp: str):
        user_master = (
            db.query(UserMaster)
            .filter(func.lower(UserMaster.user_email) == func.lower(email), UserMaster.active == "Y")
            .first()
        )
        user_id = None
        if not user_master:
            customer_signup = (
                db.query(CustomerSignup)
                .filter(
                    func.lower(CustomerSignup.useremail) == func.lower(email), CustomerSignup.active == "Y"
                )
                .first()
            )
            if not customer_signup:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Email not found"
                )
            user_id = customer_signup.id
        else:
            user_id = user_master.id

        user_attr = (
            db.query(UserAttr)
            .filter(
                UserAttr.user_id == user_id,
                UserAttr.attr_value == otp,
                UserAttr.attr_name == "PWD_OTP",
                UserAttr.active == "Y",
            )
            .first()
        )

        if not user_attr:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP"
            )

        elapsed = datetime.utcnow() - user_attr.created_date.replace(tzinfo=None)
        if elapsed.total_seconds() > 600:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="OTP has expired"
            )

        return {"status": "SUCCESS", "result": "VALID"}

    @staticmethod
    def reset_password_otp(db: Session, email: str, otp: str, new_password: str):
        AuthService.verify_otp(db, email, otp)

        user_master = (
            db.query(UserMaster)
            .filter(func.lower(UserMaster.user_email) == func.lower(email), UserMaster.active == "Y")
            .first()
        )
        user_id = None
        if not user_master:
            customer_signup = (
                db.query(CustomerSignup)
                .filter(
                    func.lower(CustomerSignup.useremail) == func.lower(email), CustomerSignup.active == "Y"
                )
                .first()
            )
            user_id = customer_signup.id
        else:
            user_id = user_master.id

        AuthService._validate_password_complexity(new_password)

        db.query(UserAttr).filter(
            UserAttr.user_id == user_id,
            UserAttr.attr_name == "PWD",
            UserAttr.active == "Y",
        ).update({"active": "N"})
        db.commit()

        hashed = get_password_hash(new_password)

        new_attr = UserAttr(
            id=uuid4(),
            user_id=user_id,
            attr_name="PWD",
            attr_value=hashed,
            active="Y",
            created_date=datetime.utcnow(),
        )
        db.add(new_attr)
        db.commit()

        db.query(UserAttr).filter(
            UserAttr.user_id == user_id,
            UserAttr.attr_name == "PWD_OTP",
            UserAttr.active == "Y",
        ).update({"active": "N"})
        db.commit()

        return {"status": "SUCCESS", "message": "Password updated successfully"}
