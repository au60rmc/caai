from pydantic import BaseModel
from typing import Optional
from uuid import UUID


class LoginRequest(BaseModel):
    email: str
    password: str


class DemoLoginRequest(BaseModel):
    email: str


class SignupRequest(BaseModel):
    user_name: Optional[str] = None
    useremail: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    mobile: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    user_id: str
    confirm_password: str
    token: str


class PermissionItem(BaseModel):
    module: str
    module_order: int
    feature: str
    feature_code: str
    feature_url: str
    view: bool
    write: bool
    delete: bool


class UserInfo(BaseModel):
    id: UUID
    user_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    user_email: Optional[str] = None
    user_type: Optional[str] = None


class LoginData(BaseModel):
    user: UserInfo
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    permissions: list[PermissionItem] = []
    must_change_password: bool = False


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class LoginResponse(BaseModel):
    status: str
    message: str
    result: Optional[LoginData] = None


class SimpleResponse(BaseModel):
    status: str
    message: str
    result: Optional[str] = None

class VerifyOTPRequest(BaseModel):
    email: str
    otp: str

class ResetPasswordOTPRequest(BaseModel):
    email: str
    otp: str
    new_password: str
