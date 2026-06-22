"""Unit tests for ``document_bytes_from_spec`` serialization.

Guards the YAML serialization path, which regressed when the helper imported a
non-existent ``yaml12.dump``: ``py-yaml12`` exposes ``format_yaml`` (string) /
``write_yaml`` (file), not ``dump``. The catalog publish step
(``import openapi ../objectified-rest/openapi.yaml``) exercises exactly this
branch, so the import must round-trip a ``.yaml`` filename back to YAML bytes.
"""

from __future__ import annotations

import json

from yaml12 import parse_yaml

from objectified_cli.import_.spec_import import document_bytes_from_spec

_SPEC = {
    "openapi": "3.1.0",
    "info": {"title": "Objectified REST API", "version": "1.0.63"},
    "paths": {},
}


def test_yaml_filename_serializes_to_roundtrippable_yaml():
    out = document_bytes_from_spec(_SPEC, filename="openapi.yaml")
    assert isinstance(out, bytes)
    assert parse_yaml(out.decode("utf-8")) == _SPEC


def test_yml_extension_uses_yaml_path():
    out = document_bytes_from_spec(_SPEC, filename="spec.YML")
    assert parse_yaml(out.decode("utf-8")) == _SPEC


def test_json_filename_serializes_to_json():
    out = document_bytes_from_spec(_SPEC, filename="openapi.json")
    assert json.loads(out.decode("utf-8")) == _SPEC


def test_default_filename_serializes_to_json():
    out = document_bytes_from_spec(_SPEC)
    assert json.loads(out.decode("utf-8")) == _SPEC
