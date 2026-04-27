"""REPO-11.1 / #2941: attention rollup pure logic."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.repositories.attention import (
    AttentionComputeInput,
    AttentionFileInput,
    REASON_WEIGHTS,
    STALE_CHECKSUM_AGE,
    compute_attention_row,
    compute_attention_score,
)


def test_compute_attention_score_caps_at_100() -> None:
    # All reason tags present — sum of weights is > 100, must cap.
    assert compute_attention_score(list(REASON_WEIGHTS)) == 100


def test_parse_error_and_token_revoke() -> None:
    t = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    f = AttentionFileInput(
        path="a.yaml",
        status="parse_error",
        import_enabled=True,
        auto_import_enabled=True,
        content_checksum="a" * 64,
        last_imported_checksum="b" * 64,
        stale_mismatch_at="2020-01-01T00:00:00+00:00",
        last_import_job_state=None,
    )
    rsn, ocnt, score = compute_attention_row(
        AttentionComputeInput(
            now=t,
            repository_status="healthy",
            is_auto_paused=False,
            last_scan_files=(f,),
            max_consecutive_failures=0,
            any_credential_revoked=True,
        )
    )
    assert "parse_error" in rsn
    assert "token_revoked" in rsn
    assert ocnt == 1
    assert score < 100


def test_stale_checksum_only_after_24h_ready_to_promote() -> None:
    now = datetime(2025, 1, 3, 12, 0, 0, tzinfo=timezone.utc)
    mismatch_at = (now - STALE_CHECKSUM_AGE - timedelta(hours=1)).isoformat()
    f = AttentionFileInput(
        path="x.json",
        status="new",
        import_enabled=True,
        auto_import_enabled=False,
        content_checksum="1" * 64,
        last_imported_checksum="0" * 64,
        stale_mismatch_at=mismatch_at,
        last_import_job_state="committed",
    )
    rsn, ocnt, _s = compute_attention_row(
        AttentionComputeInput(
            now=now,
            repository_status="healthy",
            is_auto_paused=False,
            last_scan_files=(f,),
            max_consecutive_failures=0,
            any_credential_revoked=False,
        )
    )
    assert "stale_checksum" in rsn
    assert ocnt == 1

    f_early = AttentionFileInput(
        path="x.json",
        status="new",
        import_enabled=True,
        auto_import_enabled=False,
        content_checksum="1" * 64,
        last_imported_checksum="0" * 64,
        stale_mismatch_at=(now - timedelta(hours=1)).isoformat(),
        last_import_job_state="committed",
    )
    rsn2, ocnt2, _ = compute_attention_row(
        AttentionComputeInput(
            now=now,
            repository_status="healthy",
            is_auto_paused=False,
            last_scan_files=(f_early,),
            max_consecutive_failures=0,
            any_credential_revoked=False,
        )
    )
    assert "stale_checksum" not in rsn2
    assert ocnt2 == 0
