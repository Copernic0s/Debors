import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def write_run_status(
    status_path: Path,
    *,
    run_id: str,
    parent_run_id: str | None = None,
    running: bool,
    phase: str,
    message: str,
    page: int = 0,
    invoices_found: int = 0,
    error: str | None = None,
    run_status: str | None = None,
    pages_scraped: int | None = None,
    truncated: bool | None = None,
    persisted: bool = False,
    failure_reason: str | None = None,
    trigger: str = "manual",
    now: datetime | None = None,
) -> dict[str, Any]:
    previous: dict[str, Any] = {}
    try:
        previous = json.loads(status_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        pass

    timestamp = (now or datetime.now(timezone.utc)).isoformat().replace("+00:00", "Z")
    last_success = previous.get("lastSuccessfulSync")
    last_error = previous.get("lastRunError")
    if phase == "done" and run_status == "complete" and persisted:
        last_success = {"runId": run_id, "timestamp": timestamp}
    if error:
        last_error = {"runId": run_id, "timestamp": timestamp, "message": error}

    payload = {
        "runId": run_id,
        "parentRunId": parent_run_id or run_id,
        "running": running,
        "phase": phase,
        "message": message,
        "page": page,
        "invoicesFound": invoices_found,
        "error": error,
        "runStatus": run_status,
        "pagesScraped": pages_scraped,
        "truncated": truncated,
        "persisted": persisted,
        "failureReason": failure_reason,
        "trigger": trigger,
        "updatedAt": timestamp,
        "lastSuccessfulSync": last_success,
        "lastRunError": last_error,
    }
    status_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = status_path.with_suffix(status_path.suffix + ".tmp")
    temporary_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary_path.replace(status_path)
    return payload
