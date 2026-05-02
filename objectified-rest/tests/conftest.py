"""Shared pytest fixtures for objectified-rest tests."""

from pathlib import Path

import pytest


@pytest.fixture
def repo_root() -> Path:
    """Monorepo root (parent of ``objectified-rest/``)."""
    return Path(__file__).resolve().parents[2]
