import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from cmp_run_status import write_run_status


class CmpRunStatusTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.status_path = Path(self.temp_dir.name) / "cmp_status.json"
        self.now = datetime(2026, 11, 12, 20, 0, tzinfo=timezone.utc)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_new_run_resets_progress_and_keeps_history_separate(self):
        self.status_path.write_text(json.dumps({
            "runId": "old-run",
            "phase": "error",
            "page": 44,
            "invoicesFound": 500,
            "error": "old failure",
            "lastSuccessfulSync": {"runId": "success-1", "timestamp": "2026-11-11T20:00:00Z"},
            "lastRunError": {"runId": "old-run", "timestamp": "2026-11-12T19:00:00Z", "message": "old failure"},
        }), encoding="utf-8")

        status = write_run_status(
            self.status_path,
            run_id="new-run",
            running=True,
            phase="starting",
            message="CMP run starting...",
            now=self.now,
        )

        self.assertEqual(status["runId"], "new-run")
        self.assertEqual(status["trigger"], "manual")
        self.assertIsNone(status["error"])
        self.assertEqual(status["page"], 0)
        self.assertEqual(status["invoicesFound"], 0)
        self.assertEqual(status["lastSuccessfulSync"]["runId"], "success-1")
        self.assertEqual(status["lastRunError"]["runId"], "old-run")
        self.assertEqual(json.loads(self.status_path.read_text(encoding="utf-8"))["runId"], "new-run")
        self.assertFalse(self.status_path.with_suffix(".json.tmp").exists())

    def test_only_persisted_complete_run_updates_last_success(self):
        incomplete = write_run_status(
            self.status_path,
            run_id="partial-run",
            running=False,
            phase="done",
            message="partial scrape",
            run_status="incomplete",
            persisted=True,
            now=self.now,
        )
        self.assertIsNone(incomplete["lastSuccessfulSync"])

        complete = write_run_status(
            self.status_path,
            run_id="complete-run",
            running=False,
            phase="done",
            message="complete scrape",
            run_status="complete",
            pages_scraped=5,
            truncated=False,
            persisted=True,
            now=self.now,
        )
        self.assertEqual(complete["lastSuccessfulSync"], {
            "runId": "complete-run", "timestamp": "2026-11-12T20:00:00Z"
        })

    def test_failed_run_records_error_with_run_id_and_timestamp(self):
        status = write_run_status(
            self.status_path,
            run_id="failed-run",
            running=False,
            phase="error",
            message="CMP sync failed",
            error="ingest unavailable",
            run_status="failed",
            now=self.now,
        )
        self.assertEqual(status["lastRunError"], {
            "runId": "failed-run",
            "timestamp": "2026-11-12T20:00:00Z",
            "message": "ingest unavailable",
        })

    def test_failed_run_exposes_structured_failure_reason(self):
        status = write_run_status(
            self.status_path,
            run_id="wrong-page-size",
            running=False,
            phase="error",
            message="Could not verify page size",
            error="CMP did not honor limit=500",
            failure_reason="unexpected_page_size",
            trigger="scheduled",
            run_status="failed",
            now=self.now,
        )
        self.assertEqual(status["failureReason"], "unexpected_page_size")
        self.assertEqual(status["trigger"], "scheduled")


if __name__ == "__main__":
    unittest.main()
