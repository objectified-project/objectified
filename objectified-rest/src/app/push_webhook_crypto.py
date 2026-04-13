"""Encrypt signing secrets at rest for outbound webhook HMAC (#2588)."""

from __future__ import annotations

from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from .config import settings


def encrypt_signing_secret(plain: str) -> Optional[bytes]:
    """Return Fernet ciphertext, or None if encryption key is not configured."""
    key = settings.webhook_signing_secret_encryption_key
    if not key or not plain:
        return None
    f = Fernet(key.strip().encode("ascii"))
    return f.encrypt(plain.encode("utf-8"))


def decrypt_signing_secret(blob: bytes) -> Optional[str]:
    """Decrypt ciphertext; returns None on missing key or bad data."""
    key = settings.webhook_signing_secret_encryption_key
    if not key or not blob:
        return None
    try:
        f = Fernet(key.strip().encode("ascii"))
        return f.decrypt(blob).decode("utf-8")
    except (InvalidToken, ValueError, UnicodeDecodeError):
        return None
