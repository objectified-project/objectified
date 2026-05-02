from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def reset_mcp_logging_state() -> None:
    from objectified_mcp.logging_config import reset_logging_state_for_tests

    reset_logging_state_for_tests()
    yield
    reset_logging_state_for_tests()
