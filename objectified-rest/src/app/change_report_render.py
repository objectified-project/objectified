"""
Placeholder rendering from persisted ChangeReportModel JSON until CR-03 templates exist.
"""

from __future__ import annotations

from typing import Any, Dict, Tuple


def placeholder_render_from_change_model(change_model: Dict[str, Any]) -> Tuple[str, str, str]:
    """
    Produce header, body, and footnote strings from stored change_model_json.

    CR-03 will replace this with the real template pipeline. Output is Markdown/plain text.
    """
    sv = change_model.get("schemaVersion") or change_model.get("schema_version") or "?"
    schemas = change_model.get("schemas") or {}
    added = schemas.get("added") or []
    removed = schemas.get("removed") or []
    modified = schemas.get("modified") or []

    lines = [
        f"Schema change summary (engine schemaVersion={sv})",
        "",
        f"- Schemas added: {len(added)}",
        f"- Schemas removed: {len(removed)}",
        f"- Schemas modified: {len(modified)}",
    ]
    props = change_model.get("properties") or []
    if props:
        lines.append(f"- Property changes: {len(props)}")
    refs = change_model.get("references") or []
    if refs:
        lines.append(f"- Reference changes: {len(refs)}")
    docs = change_model.get("documentation") or []
    if docs:
        lines.append(f"- Documentation changes: {len(docs)}")

    body = "\n".join(lines)
    header = "Publication change report"
    footnote = "Rendered with placeholder pipeline (CR-02); templates ship in CR-03."
    return header, body, footnote
