"""
Authentication module for JWT and API Key validation.

Supports both JWT tokens (from NextAuth) and API keys for authentication.
"""

import jwt
from typing import Optional, Dict, Any
from fastapi import HTTPException, Header

from .config import settings
from .database import db


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
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm]
        )

        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
    except Exception:
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

    Args:
        user_id: The user's ID
        tenant_slug: The tenant slug to check access for

    Returns:
        Tenant information if user has access, None otherwise
    """
    query = """
        SELECT t.id as tenant_id, t.slug as tenant_slug, t.name as tenant_name
        FROM odb.tenants t
        JOIN odb.tenant_users tu ON t.id = tu.tenant_id
        WHERE tu.user_id = %s AND t.slug = %s AND t.deleted_at IS NULL
        LIMIT 1
    """
    results = db.execute_query(query, (user_id, tenant_slug))
    return results[0] if results else None


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
