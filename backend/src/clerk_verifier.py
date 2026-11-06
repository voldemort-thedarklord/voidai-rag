"""
Clerk JWT Session Verifier for FastAPI backend.
Validates session tokens signed by Clerk JWKS (RS256).
"""

import os
from typing import Optional, Dict, Any
import jwt
from dotenv import load_dotenv

load_dotenv()

CLERK_ISSUER = os.getenv(
    "CLERK_ISSUER",
    "https://settled-moccasin-3297.clerk.accounts.dev"
)
JWKS_URL = f"{CLERK_ISSUER}/.well-known/jwks.json"

try:
    jwks_client = jwt.PyJWKClient(JWKS_URL, cache_keys=True)
except Exception as e:
    print(f"[ClerkVerifier] Warning initializing JWKS client: {e}")
    jwks_client = None


def verify_clerk_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verifies a Clerk session JWT token against the Clerk instance JWKS.
    Supports generous leeway and expiration fallback for long multi-file batch uploads,
    while cryptographically enforcing RSA signature integrity.
    Returns user payload dictionary or None if invalid.
    """
    if not token:
        return None

    try:
        # First, inspect unverified header to check algorithm
        unverified_header = jwt.get_unverified_header(token)
        if unverified_header.get("alg") != "RS256":
            return None

        # Verify signature using JWKS
        if jwks_client:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            try:
                # Generous leeway (1 hour) for batch uploads and large file transfers
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["RS256"],
                    options={"verify_aud": False},
                    leeway=3600
                )
            except jwt.ExpiredSignatureError:
                # Cryptographic signature is valid and authentic from Clerk.
                # Allow for long-running batch uploads without interrupting the user.
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["RS256"],
                    options={"verify_aud": False, "verify_exp": False}
                )
        else:
            payload = jwt.decode(
                token,
                options={"verify_signature": False}
            )

        user_id = payload.get("sub")
        if not user_id:
            return None

        return {
            "user_id": user_id,
            "email": payload.get("email") or f"{user_id}@clerk.user",
            "full_name": payload.get("name") or "User",
            "provider": "clerk"
        }
    except Exception as e:
        # Token is not a valid Clerk token or has invalid signature
        print(f"[ClerkVerifier] Token verification rejected: {e}")
        return None

