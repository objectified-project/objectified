"""Long-running import orchestrator without HTTP (#3307). Run from ``objectified-rest`` with ``PYTHONPATH=src``."""

from __future__ import annotations

import asyncio

from app.import_orchestrator import run_standalone_orchestrator


def main() -> None:
    asyncio.run(run_standalone_orchestrator())


if __name__ == "__main__":
    main()
