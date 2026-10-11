from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
import bcrypt
from app.core.config import settings

_BCRYPT_MAX_BYTES = 72

# Common compromised passwords blocklist (mocked for this implementation)
COMPROMISED_PASSWORDS = {"password1234", "qwertyuiop", "123456789012"}

def _to_bcrypt_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt."""
    try:
        if bcrypt.checkpw(_to_bcrypt_bytes(plain_password.lower()), hashed_password.encode("utf-8")):
            return True
        return bcrypt.checkpw(_to_bcrypt_bytes(plain_password), hashed_password.encode("utf-8"))
    except ValueError:
        return False

def get_password_hash(password: str) -> str:
    """Hash new passwords using bcrypt."""
    return bcrypt.hashpw(_to_bcrypt_bytes(password), bcrypt.gensalt()).decode("utf-8")

def validate_password_policy(password: str) -> bool:
    """Section 6.2: 8-char minimum, no composition rules, blocklist check."""
    if len(password) < 8:
        return False
    if password.lower() in COMPROMISED_PASSWORDS:
        return False
    # explicitly NO uppercase/lowercase/number/special composition requirements
    return True

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.JWT_EXPIRATION_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(
        to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )

def decode_access_token(token: str):
    try:
        return jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
    except JWTError:
        return None
