"""
Authentication module for JWT and API Key validation.

Supports both JWT tokens (from NextAuth) and API keys for authentication.
"""

import logging
import jwt
from typing import Optional, Dict, Any
from fastapi import HTTPException, Header

from .config import settings
from .database import db

logger = logging.getLogger(__name__)

# PyJWT exposes these on the main `jwt` package; avoid `import jwt.exceptions` (fails for some
# vendor/layout installs and for the obsolete PyPI `jwt` package which is not PyJWT).
_ExpiredSignatureError = getattr(jwt, "ExpiredSignatureError", None)
_InvalidTokenError = getattr(jwt, "InvalidTokenError", None)
if _ExpiredSignatureError is None or _InvalidTokenError is None:
    raise ImportError(
        'Install PyJWT for objectified-rest (e.g. pip install "PyJWT>=2.8"). '
        "If the unrelated `jwt` package is installed, remove it: pip uninstall jwt"
    )


def decode_jwt(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and validate a JWT token.

    Args:
        token: The JWT token to decode

    Returns:
        Decoded token payload if valid, None otherwise
    """
    try:
        # Remove 'Bearer ' prefix if present
        if token.startswith('Bearer '):
            token = token[7:]

        # Decode the JWT
        payload = jwt.decode(
            token,
            settings.effective_jwt_secret,
            algorithms=[settings.jwt_algorithm]
        )

        return payload
    except _ExpiredSignatureError:
        logger.warning("decode_jwt: Token expired")
        return None
    except _InvalidTokenError as e:
        logger.warning(f"decode_jwt: Invalid token - {e}")
        return None
    except Exception as e:
        logger.error(f"decode_jwt: Exception - {e}", exc_info=True)
        return None


def get_user_tenants(user_id: str) -> list[Dict[str, Any]]:
    """
    Get all tenants that a user belongs to.

    Args:
        user_id: The user's ID

    Returns:
        List of tenant dictionaries with id, slug, and name
    """
    query = """
        SELECT t.id, t.slug, t.name
        FROM odb.tenants t
        JOIN odb.tenant_users tu ON t.id = tu.tenant_id
        WHERE tu.user_id = %s AND t.deleted_at IS NULL
    """
    return db.execute_query(query, (user_id,))


def validate_user_tenant_access(user_id: str, tenant_slug: str) -> Optional[Dict[str, Any]]:
    """
    Validate that a user has access to a specific tenant.

    Logic:
    1. Look up the tenant by slug to get the tenant_id
    2. Check if user_id + tenant_id exists in odb.tenant_users
    3. Return tenant info if access is valid, None otherwise

    Args:
        user_id: The user's ID from JWT
        tenant_slug: The tenant slug from the URL

    Returns:
        Tenant information if user has access, None otherwise
    """
    # First, get the tenant_id from the slug
    tenant_query = """
        SELECT id as tenant_id, slug as tenant_slug, name as tenant_name
        FROM odb.tenants
        WHERE slug = %s AND deleted_at IS NULL
        LIMIT 1
    """
    tenant_results = db.execute_query(tenant_query, (tenant_slug,))

    if not tenant_results:
        logger.warning(f"Tenant not found: {tenant_slug}")
        return None

    tenant = tenant_results[0]
    tenant_id = tenant['tenant_id']

    # Now check if user has access to this tenant via tenant_users
    access_query = """
        SELECT 1
        FROM odb.tenant_users
        WHERE user_id = %s AND tenant_id = %s
        LIMIT 1
    """
    access_results = db.execute_query(access_query, (user_id, tenant_id))

    if not access_results:
        logger.warning(f"User {user_id} does not have access to tenant {tenant_id}")
        return None

    logger.debug(f"validate_user_tenant_access called with user_id={user_id}, tenant_slug={tenant_slug} - Authorized")
    return tenant


def validate_authentication(
    tenant_slug: str,
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key")
) -> Dict[str, Any]:
    """
    Validate authentication using either JWT token or API key.

    Supports two authentication methods:
    1. JWT token in Authorization header (from NextAuth)
    2. API key in X-API-Key header

    Args:
        tenant_slug: The requested tenant slug
        authorization: Authorization header (Bearer token)
        x_api_key: API key header

    Returns:
        Dict with tenant information and authentication details

    Raises:
        HTTPException: If authentication fails or user doesn't have access to tenant
    """
    # Try JWT authentication first
    if authorization:
        jwt_payload = decode_jwt(authorization)

        if jwt_payload:
            # Extract user_id from JWT
            # NextAuth stores this in the 'sub' claim or 'user_id' custom claim
            user_id = jwt_payload.get('user_id') or jwt_payload.get('sub')

            if not user_id:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid JWT token: missing user identifier"
                )

            # Validate user has access to the tenant
            tenant_data = validate_user_tenant_access(user_id, tenant_slug)

            if not tenant_data:
                raise HTTPException(
                    status_code=403,
                    detail=f"User does not have access to tenant: {tenant_slug}"
                )

            # Return tenant data with user information
            return {
                **tenant_data,
                'auth_method': 'jwt',
                'user_id': user_id,
                'user_email': jwt_payload.get('email'),
                'user_name': jwt_payload.get('name')
            }

    # Try API key authentication
    if x_api_key:
        api_key_data = db.validate_api_key(x_api_key)

        if not api_key_data:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired API key",
                headers={"WWW-Authenticate": "API-Key"}
            )

        # Check if the API key's tenant matches the requested tenant
        if api_key_data['tenant_slug'] != tenant_slug:
            raise HTTPException(
                status_code=403,
                detail="API key does not have access to this tenant"
            )

        return {
            **api_key_data,
            'auth_method': 'api_key'
        }

    # No authentication provided
    raise HTTPException(
        status_code=401,
        detail="Authentication required. Provide either JWT token (Authorization: Bearer <token>) or API key (X-API-Key: <key>)",
        headers={"WWW-Authenticate": "Bearer, API-Key"}
    )


def get_authenticated_user_id(auth_data: Dict[str, Any]) -> Optional[str]:
    """
    Extract user ID from authentication data.

    For JWT auth, returns the user_id.
    For API key auth, returns None (API keys are tenant-scoped, not user-scoped).

    Args:
        auth_data: Authentication data from validate_authentication

    Returns:
        User ID if available, None otherwise
    """
    if auth_data.get('auth_method') == 'jwt':
        return auth_data.get('user_id')
    return None


def validate_session_credentials(
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
) -> Dict[str, Any]:
    """
    Validate JWT or API key without requiring a tenant path segment.

    Used by ``GET /v1/tenants/me``, ``HEAD /v1/tenants/{slug}``, and similar session-scoped endpoints.
    """
    if authorization:
        jwt_payload = decode_jwt(authorization)
        if jwt_payload:
            user_id = jwt_payload.get('user_id') or jwt_payload.get('sub')
            if not user_id:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid JWT token: missing user identifier",
                )
            return {
                'auth_method': 'jwt',
                'user_id': user_id,
                'user_email': jwt_payload.get('email'),
                'user_name': jwt_payload.get('name'),
            }

    if x_api_key:
        api_key_data = db.validate_api_key(x_api_key)
        if not api_key_data:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired API key",
                headers={"WWW-Authenticate": "API-Key"},
            )
        return {**api_key_data, 'auth_method': 'api_key'}

    raise HTTPException(
        status_code=401,
        detail=(
            "Authentication required. Provide either JWT token "
            "(Authorization: Bearer <token>) or API key (X-API-Key: <key>)"
        ),
        headers={"WWW-Authenticate": "Bearer, API-Key"},
    )
