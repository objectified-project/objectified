"""
Tests for ISO Standard Primitives Preload

Verifies that the 36 industry-standard ISO primitives are correctly
loaded and accessible through the API.
"""

import pytest
from fastapi.testclient import TestClient
from src.app.main import app

client = TestClient(app)


@pytest.mark.requires_db
class TestISOPrimitivesPreload:
    """Tests for preloaded ISO standard primitives."""

    def test_list_all_string_primitives(self, auth_headers):
        """Test that all string primitives are available."""
        response = client.get(
            '/v1/primitives/test-tenant?category=string',
            headers=auth_headers
        )
        assert response.status_code == 200
        primitives = response.json()

        # Should have at least 20 string primitives
        assert len(primitives) >= 20

        # Verify common string primitives exist
        names = [p['name'] for p in primitives]
        assert 'Email Address' in names
        assert 'UUID' in names
        assert 'Uniform Resource Identifier (URI)' in names
        assert 'Uniform Resource Locator (URL)' in names
        assert 'Date (ISO 8601)' in names
        assert 'Date-Time (ISO 8601)' in names
        assert 'Phone Number (E.164)' in names
        assert 'IPv4 Address' in names
        assert 'IPv6 Address' in names
        assert 'Country Code (ISO 3166-1)' in names
        assert 'Language Code (ISO 639-1)' in names
        assert 'Currency Code (ISO 4217)' in names

    def test_list_all_integer_primitives(self, auth_headers):
        """Test that all integer primitives are available."""
        response = client.get(
            '/v1/primitives/test-tenant?category=integer',
            headers=auth_headers
        )
        assert response.status_code == 200
        primitives = response.json()

        # Should have at least 5 integer primitives
        assert len(primitives) >= 5

        names = [p['name'] for p in primitives]
        assert 'Integer' in names
        assert 'Positive Integer' in names
        assert 'Non-Negative Integer' in names
        assert 'Percentage (Integer)' in names

    def test_list_all_number_primitives(self, auth_headers):
        """Test that all number (decimal) primitives are available."""
        response = client.get(
            '/v1/primitives/test-tenant?category=number',
            headers=auth_headers
        )
        assert response.status_code == 200
        primitives = response.json()

        # Should have at least 4 number primitives
        assert len(primitives) >= 4

        names = [p['name'] for p in primitives]
        assert 'Decimal Number' in names
        assert 'Percentage (Decimal)' in names
        assert 'Probability' in names
        assert 'Monetary Amount' in names

    def test_list_all_array_primitives(self, auth_headers):
        """Test that all array primitives are available."""
        response = client.get(
            '/v1/primitives/test-tenant?category=array',
            headers=auth_headers
        )
        assert response.status_code == 200
        primitives = response.json()

        # Should have at least 4 array primitives
        assert len(primitives) >= 4

        names = [p['name'] for p in primitives]
        assert 'String Array' in names
        assert 'Integer Array' in names
        assert 'Number Array' in names
        assert 'Boolean Array' in names

    def test_boolean_primitive_exists(self, auth_headers):
        """Test that boolean primitive is available."""
        response = client.get(
            '/v1/primitives/test-tenant?category=boolean',
            headers=auth_headers
        )
        assert response.status_code == 200
        primitives = response.json()

        assert len(primitives) >= 1
        assert any(p['name'] == 'Boolean' for p in primitives)

    def test_object_primitive_exists(self, auth_headers):
        """Test that object primitive is available."""
        response = client.get(
            '/v1/primitives/test-tenant?category=object',
            headers=auth_headers
        )
        assert response.status_code == 200
        primitives = response.json()

        assert len(primitives) >= 1
        assert any(p['name'] == 'JSON Object' for p in primitives)

    def test_null_primitive_exists(self, auth_headers):
        """Test that null primitive is available."""
        response = client.get(
            '/v1/primitives/test-tenant?category=null',
            headers=auth_headers
        )
        assert response.status_code == 200
        primitives = response.json()

        assert len(primitives) >= 1
        assert any(p['name'] == 'Null Value' for p in primitives)

    def test_email_primitive_schema(self, auth_headers):
        """Test that email primitive has correct JSON Schema."""
        response = client.get(
            '/v1/primitives/test-tenant?category=string',
            headers=auth_headers
        )
        assert response.status_code == 200
        primitives = response.json()

        email_prim = next((p for p in primitives if p['name'] == 'Email Address'), None)
        assert email_prim is not None
        assert email_prim['schema']['type'] == 'string'
        assert email_prim['schema']['format'] == 'email'
        assert email_prim['schema']['maxLength'] == 254

    def test_uuid_primitive_schema(self, auth_headers):
        """Test that UUID primitive has correct JSON Schema."""
        response = client.get(
            '/v1/primitives/test-tenant?category=string',
            headers=auth_headers
        )
        assert response.status_code == 200
        primitives = response.json()

        uuid_prim = next((p for p in primitives if p['name'] == 'UUID'), None)
        assert uuid_prim is not None
        assert uuid_prim['schema']['type'] == 'string'
        assert uuid_prim['schema']['format'] == 'uuid'
        assert 'pattern' in uuid_prim['schema']

    def test_iso8601_date_primitive(self, auth_headers):
        """Test that ISO 8601 date primitive exists and is correct."""
        response = client.get(
            '/v1/primitives/test-tenant?category=string',
            headers=auth_headers
        )
        assert response.status_code == 200
        primitives = response.json()

        date_prim = next((p for p in primitives if 'ISO 8601' in p['name'] and 'Date' in p['name']), None)
        assert date_prim is not None
        assert 'iso8601' in date_prim['tags']
        assert 'iso-standard' in date_prim['tags']

    def test_primitives_tagged_with_iso_standard(self, auth_headers):
        """Test that primitives are tagged with iso-standard tag."""
        response = client.get(
            '/v1/primitives/test-tenant',
            headers=auth_headers
        )
        assert response.status_code == 200
        primitives = response.json()

        # Count primitives with iso-standard tag
        iso_standard_count = sum(
            1 for p in primitives
            if 'iso-standard' in p.get('tags', [])
        )

        # Should have many iso-standard tagged primitives
        assert iso_standard_count >= 20

    def test_all_primitives_are_enabled(self, auth_headers):
        """Test that all preloaded primitives are enabled."""
        response = client.get(
            '/v1/primitives/test-tenant',
            headers=auth_headers
        )
        assert response.status_code == 200
        primitives = response.json()

        for primitive in primitives:
            assert primitive['enabled'] is True, f"Primitive {primitive['name']} is not enabled"

    def test_all_primitives_are_system_primitives(self, auth_headers):
        """Test that all preloaded primitives are marked as system primitives."""
        response = client.get(
            '/v1/primitives/test-tenant',
            headers=auth_headers
        )
        assert response.status_code == 200
        primitives = response.json()

        for primitive in primitives:
            assert primitive['is_system'] is True, f"Primitive {primitive['name']} is not marked as system"

    def test_percentage_integer_vs_decimal(self, auth_headers):
        """Test that percentage primitives exist for both integer and decimal."""
        response = client.get(
            '/v1/primitives/test-tenant',
            headers=auth_headers
        )
        assert response.status_code == 200
        primitives = response.json()

        names = [p['name'] for p in primitives]
        assert 'Percentage (Integer)' in names
        assert 'Percentage (Decimal)' in names

        # Verify their schemas are different
        pct_int = next(p for p in primitives if p['name'] == 'Percentage (Integer)')
        pct_dec = next(p for p in primitives if p['name'] == 'Percentage (Decimal)')

        assert pct_int['schema']['type'] == 'integer'
        assert pct_dec['schema']['type'] == 'number'

    def test_total_primitive_count(self, auth_headers):
        """Test that we have the expected total number of primitives."""
        response = client.get(
            '/v1/primitives/test-tenant',
            headers=auth_headers
        )
        assert response.status_code == 200
        primitives = response.json()

        # Should have at least 36 primitives (the base ISO set)
        assert len(primitives) >= 36


@pytest.fixture
def auth_headers():
    """Provides valid authentication headers for testing."""
    # This should be populated with valid JWT or API key
    # For now, this is a placeholder
    return {
        'Authorization': 'Bearer test-token',
        'X-API-Key': 'test-key'
    }
