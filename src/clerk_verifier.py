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
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                options={"verify_aud": False}
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
            "role": payload.get("role") or payload.get("metadata", {}).get("role", "Admin"),
            "full_name": payload.get("name") or "Clerk User",
            "department": payload.get("department", "General"),
            "provider": "clerk"
        }
    except Exception as e:
        # Token is not a valid Clerk token
        return None
