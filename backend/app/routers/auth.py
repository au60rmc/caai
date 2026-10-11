from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    SignupRequest,
    DemoLoginRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ChangePasswordRequest,
    SimpleResponse,
    VerifyOTPRequest,
    ResetPasswordOTPRequest,
)
from app.services.auth_service import AuthService
from app.services.email_service import EmailService

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=LoginResponse)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    try:
        result = AuthService.login(db, login_data)
        return LoginResponse(
            status="SUCCESS",
            message="Login successful",
            result=result,
        )
    except HTTPException as e:
        detail = e.detail
        if detail in ("Invalid mail id", "Invalid credentials"):
            return LoginResponse(status="ERROR", message=detail, result=None)
        raise e


@router.post("/demo-login", response_model=LoginResponse)
def demo_login(demo_data: DemoLoginRequest, db: Session = Depends(get_db)):
    try:
        result = AuthService.demo_login(db, demo_data)
        return LoginResponse(
            status="SUCCESS",
            message="Demo Login successful",
            result=result,
        )
    except Exception as e:
        return LoginResponse(status="ERROR", message=str(e), result=None)


@router.post("/signup", response_model=LoginResponse)
def signup(signup_data: SignupRequest, db: Session = Depends(get_db)):
    try:
        AuthService.signup(db, signup_data)
        return LoginResponse(
            status="SUCCESS",
            message="Successfully signup",
            result=None,
        )
    except HTTPException as e:
        detail = e.detail
        if detail in ("Your Mail-id is existing", "Your Mobile number is existing"):
            return LoginResponse(status="ERROR", message=detail, result=None)
        raise e


@router.post("/send-password-email", response_model=SimpleResponse)
def send_password_email(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    try:
        result = EmailService.send_password_setup_email(db, request.email)
        return SimpleResponse(
            status="SUCCESS",
            message="Password setup email sent",
            result=result.get("reset_link"),
        )
    except HTTPException as e:
        detail = e.detail
        if detail == "Email not found" or "Failed to send email" in str(detail):
            return SimpleResponse(status="ERROR", message=str(detail), result=None)
        raise e


@router.get("/verify-token", response_model=SimpleResponse)
def verify_token(
    user_id: str = Query(...), token: str = Query(...), db: Session = Depends(get_db)
):
    try:
        result = AuthService.verify_token(db, user_id, token)
        return SimpleResponse(
            status="SUCCESS",
            message="Token valid",
            result=result["result"],
        )
    except HTTPException as e:
        detail = e.detail
        if detail in ("Invalid token", "Link has expired"):
            return SimpleResponse(status="ERROR", message=detail, result=None)
        raise e


@router.post("/reset-password", response_model=SimpleResponse)
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    try:
        AuthService.reset_password(
            db, request.user_id, request.confirm_password, request.token
        )
        return SimpleResponse(
            status="SUCCESS",
            message="Password created successfully",
            result=None,
        )
    except HTTPException as e:
        return SimpleResponse(status="ERROR", message=str(e.detail), result=None)


@router.post("/logout")
def logout(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _, status_val, message = AuthService.logout(db, current_user.id)
    return {"status": status_val, "message": message}


@router.get("/permissions")
def get_permissions(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    permissions = AuthService.get_user_permissions(db, current_user.id)
    return {"status": "SUCCESS", "result": permissions}


@router.post("/change-password", response_model=SimpleResponse)
def change_password(
    request: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        AuthService.change_password(
            db, current_user.id, request.current_password, request.new_password
        )
        return SimpleResponse(
            status="SUCCESS", message="Password changed successfully", result=None
        )
    except HTTPException as e:
        return SimpleResponse(status="ERROR", message=e.detail, result=None)

@router.post("/forgot-password-otp", response_model=SimpleResponse)
def forgot_password_otp(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    try:
        result = EmailService.send_forgot_password_otp(db, request.email)
        return SimpleResponse(
            status="SUCCESS",
            message=result["message"],
            result=None,
        )
    except HTTPException as e:
        return SimpleResponse(status="ERROR", message=str(e.detail), result=None)
    except Exception as e:
        return SimpleResponse(status="ERROR", message=f"FATAL DB ERROR: {str(e)}", result=None)

@router.post("/verify-otp", response_model=SimpleResponse)
def verify_otp(request: VerifyOTPRequest, db: Session = Depends(get_db)):
    try:
        AuthService.verify_otp(db, request.email, request.otp)
        return SimpleResponse(
            status="SUCCESS",
            message="OTP valid",
            result=None,
        )
    except HTTPException as e:
        return SimpleResponse(status="ERROR", message=str(e.detail), result=None)

@router.post("/reset-password-otp", response_model=SimpleResponse)
def reset_password_otp(request: ResetPasswordOTPRequest, db: Session = Depends(get_db)):
    try:
        result = AuthService.reset_password_otp(
            db, request.email, request.otp, request.new_password
        )
        return SimpleResponse(
            status="SUCCESS",
            message=result["message"],
            result=None,
        )
    except HTTPException as e:
        return SimpleResponse(status="ERROR", message=str(e.detail), result=None)
