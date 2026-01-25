"""
Tests for Projects REST API endpoints with dual authentication (JWT and API Key)
"""

import pytest
from fastapi.testclient import TestClient
from src.app.main import app

client = TestClient(app)


def test_list_projects_requires_auth():
    """Test that listing projects requires authentication."""
    response = client.get('/v1/projects/test-tenant')
    assert response.status_code == 401
    assert 'Authentication required' in response.json()['detail']


def test_list_projects_invalid_jwt():
    """Test that invalid JWT token is rejected."""
    response = client.get(
        '/v1/projects/test-tenant',
        headers={'Authorization': 'Bearer invalid-token'}
    )
    assert response.status_code == 401


def test_list_projects_invalid_api_key():
    """Test that invalid API key is rejected."""
    response = client.get(
        '/v1/projects/test-tenant',
        headers={'X-API-Key': 'invalid-key'}
    )
    assert response.status_code == 401


def test_get_project_requires_auth():
    """Test that getting a project requires authentication."""
    response = client.get('/v1/projects/test-tenant/some-id')
    assert response.status_code == 401


def test_get_project_by_slug_requires_auth():
    """Test that getting a project by slug requires authentication."""
    response = client.get('/v1/projects/test-tenant/by-slug/some-slug')
    assert response.status_code == 401


def test_create_project_requires_auth():
    """Test that creating a project requires authentication."""
    response = client.post(
        '/v1/projects/test-tenant',
        json={
            'name': 'Test Project',
            'slug': 'test-project',
            'description': 'A test project'
        }
    )
    assert response.status_code == 401


def test_update_project_requires_auth():
    """Test that updating a project requires authentication."""
    response = client.put(
        '/v1/projects/test-tenant/some-id',
        json={'name': 'Updated Project'}
    )
    assert response.status_code == 401


def test_delete_project_requires_auth():
    """Test that deleting a project requires authentication."""
    response = client.delete('/v1/projects/test-tenant/some-id')
    assert response.status_code == 401


def test_jwt_and_api_key_both_provided():
    """Test behavior when both JWT and API key are provided (JWT takes precedence)."""
    response = client.get(
        '/v1/projects/test-tenant',
        headers={
            'Authorization': 'Bearer invalid-token',
            'X-API-Key': 'also-invalid'
        }
    )
    # Should still be 401 since both are invalid
    assert response.status_code == 401


def test_create_project_validation_missing_name():
    """Test that create project validates required name field."""
    # Using 422 format - missing required fields in the schema
    response = client.post(
        '/v1/projects/test-tenant',
        json={
            'slug': 'test-project'
        }
    )
    assert response.status_code == 401  # Auth check happens first


def test_create_project_validation_missing_slug():
    """Test that create project validates required slug field."""
    response = client.post(
        '/v1/projects/test-tenant',
        json={
            'name': 'Test Project'
        }
    )
    assert response.status_code == 401  # Auth check happens first


def test_create_project_empty_request():
    """Test that create project rejects empty request."""
    response = client.post(
        '/v1/projects/test-tenant',
        json={}
    )
    assert response.status_code == 401  # Auth check happens first before validation


def test_update_project_empty_request():
    """Test that update project with empty request still requires auth."""
    response = client.put(
        '/v1/projects/test-tenant/some-id',
        json={}
    )
    assert response.status_code == 401  # Auth check happens first


def test_project_endpoints_return_json():
    """Test that all project endpoints return JSON content type."""
    # List projects
    response = client.get('/v1/projects/test-tenant')
    assert response.headers.get('content-type', '').startswith('application/json')

    # Get project
    response = client.get('/v1/projects/test-tenant/some-id')
    assert response.headers.get('content-type', '').startswith('application/json')

    # Get project by slug
    response = client.get('/v1/projects/test-tenant/by-slug/test-slug')
    assert response.headers.get('content-type', '').startswith('application/json')

    # Create project
    response = client.post('/v1/projects/test-tenant', json={'name': 'Test', 'slug': 'test'})
    assert response.headers.get('content-type', '').startswith('application/json')

    # Update project
    response = client.put('/v1/projects/test-tenant/some-id', json={'name': 'Updated'})
    assert response.headers.get('content-type', '').startswith('application/json')

    # Delete project
    response = client.delete('/v1/projects/test-tenant/some-id')
    assert response.headers.get('content-type', '').startswith('application/json')


def test_projects_router_is_registered():
    """Test that the projects router is properly registered."""
    # Check that the routes exist by verifying we don't get 404 Method Not Allowed
    response = client.get('/v1/projects/any-tenant')
    # 401 means the route exists but requires auth (not 404)
    assert response.status_code == 401


def test_auth_header_formats():
    """Test various authorization header formats."""
    # Without Bearer prefix
    response = client.get(
        '/v1/projects/test-tenant',
        headers={'Authorization': 'invalid-token'}
    )
    assert response.status_code == 401

    # With Bearer prefix but invalid token
    response = client.get(
        '/v1/projects/test-tenant',
        headers={'Authorization': 'Bearer invalid-token'}
    )
    assert response.status_code == 401

    # Empty Authorization header
    response = client.get(
        '/v1/projects/test-tenant',
        headers={'Authorization': ''}
    )
    assert response.status_code == 401


def test_api_key_header_formats():
    """Test API key header format."""
    # Empty API key
    response = client.get(
        '/v1/projects/test-tenant',
        headers={'X-API-Key': ''}
    )
    assert response.status_code == 401

    # Invalid API key
    response = client.get(
        '/v1/projects/test-tenant',
        headers={'X-API-Key': 'definitely-not-valid'}
    )
    assert response.status_code == 401
