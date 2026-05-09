"""Shared pytest fixtures for objectified-rest tests."""

import os
from pathlib import Path

import pytest

# Default-off import orchestrator subprocess workers so TestClient(app) does not spawn importers.
os.environ.setdefault("OBJECTIFIED_IMPORT_WORKERS", "0")


@pytest.fixture
def repo_root() -> Path:
    """Monorepo root (parent of ``objectified-rest/``)."""
    return Path(__file__).resolve().parents[2]
