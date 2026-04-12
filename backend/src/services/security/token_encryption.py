"""
Token encryption helpers for OAuth secrets.

Ciphertext format:
- nonce: 12 bytes
- ciphertext: n bytes
- tag: 16 bytes

The bytes are concatenated as: nonce + ciphertext + tag
and then URL-safe base64 encoded for storage.
"""

import base64
import binascii
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

try:
    from services.config.load_env import load_root_env
except ModuleNotFoundError:  # pragma: no cover - allows backend.src.* imports
    from backend.src.services.config.load_env import load_root_env

load_root_env()


def _decode_base64url(value: str) -> bytes:
    padded = value + ("=" * (-len(value) % 4))
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def _load_key() -> bytes:
    encoded = (os.environ.get("TOKEN_ENCRYPTION_KEY") or "").strip()
    if not encoded:
        raise RuntimeError("TOKEN_ENCRYPTION_KEY is required")
    try:
        decoded = _decode_base64url(encoded)
    except (binascii.Error, ValueError) as exc:
        raise RuntimeError("TOKEN_ENCRYPTION_KEY must be valid base64") from exc
    if len(decoded) < 32:
        raise RuntimeError("TOKEN_ENCRYPTION_KEY must decode to at least 32 bytes")
    return decoded[:32]


_AESGCM = AESGCM(_load_key())


def encrypt_token(plaintext: str) -> str:
    """
    Encrypts a plaintext token using AES-256-GCM.
    Returns a single URL-safe base64 string in format:
    base64(nonce + ciphertext + tag)
    A fresh random 12-byte nonce is generated for every call.
    """
    nonce = os.urandom(12)
    encrypted = _AESGCM.encrypt(nonce, plaintext.encode("utf-8"), None)
    payload = nonce + encrypted
    return base64.urlsafe_b64encode(payload).decode("ascii")


def decrypt_token(ciphertext: str) -> str:
    """
    Decrypts a token produced by encrypt_token().
    Raises ValueError if the ciphertext is malformed or authentication fails.
    Never returns None — raises on any failure.
    """
    try:
        payload = _decode_base64url(ciphertext.strip())
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Malformed ciphertext") from exc

    if len(payload) < 28:  # 12-byte nonce + 16-byte tag
        raise ValueError("Malformed ciphertext")

    nonce = payload[:12]
    encrypted = payload[12:]
    try:
        plaintext = _AESGCM.decrypt(nonce, encrypted, None)
    except Exception as exc:  # cryptography raises InvalidTag on auth failure
        raise ValueError("Invalid ciphertext authentication") from exc

    try:
        return plaintext.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError("Malformed plaintext payload") from exc


__all__ = ["encrypt_token", "decrypt_token"]
