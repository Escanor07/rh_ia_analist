import threading
import time
import logging
import traceback

logger = logging.getLogger(__name__)

_state = {
    "running": False,
    "task": None,
    "total": 0,
    "processed": 0,
    "skipped": 0,
    "failed": 0,
    "started_at": None,
    "finished_at": None,
    "error": None,
}
_lock = threading.Lock()

DEFAULT_INGEST_BATCH = 50


def get_status() -> dict:
    with _lock:
        elapsed = 0
        if _state["started_at"]:
            end = _state["finished_at"] or time.time()
            elapsed = round(end - _state["started_at"], 1)
        return {
            "running": _state["running"],
            "task": _state["task"],
            "total": _state["total"],
            "processed": _state["processed"],
            "skipped": _state["skipped"],
            "failed": _state["failed"],
            "elapsed_seconds": elapsed,
            "finished": _state["finished_at"] is not None,
            "error": _state["error"],
        }


def start_ingest(batch_size: int | None = None) -> bool:
    with _lock:
        if _state["running"]:
            return False
        _state.update({
            "running": True, "task": "ingest", "total": 0,
            "processed": 0, "skipped": 0, "failed": 0,
            "started_at": time.time(), "finished_at": None, "error": None,
        })

    bs = batch_size or DEFAULT_INGEST_BATCH
    threading.Thread(target=_run_ingest, args=(bs,), daemon=True).start()
    return True


def start_sync_vacancies() -> bool:
    with _lock:
        if _state["running"]:
            return False
        _state.update({
            "running": True, "task": "sync_vacancies", "total": 0,
            "processed": 0, "skipped": 0, "failed": 0,
            "started_at": time.time(), "finished_at": None, "error": None,
        })

    threading.Thread(target=_run_sync, daemon=True).start()
    return True


def _run_ingest(batch_size: int):
    try:
        from hiring.models import CandidateDocument
        from hiring.services.ingestion.mysql_source import MySQLSourceService
        from hiring.services.ingestion.pipeline import CandidateIngestionPipeline

        source = MySQLSourceService()
        pipeline = CandidateIngestionPipeline()

        all_records = source.fetch_cv_records()
        logger.info("Ingest: %d total records from MySQL", len(all_records))

        already_processed = set(
            CandidateDocument.objects
            .filter(status="processed")
            .values_list("source_key", flat=True)
        )
        logger.info("Ingest: %d already processed, skipping", len(already_processed))

        new_records = [r for r in all_records if r.source_key not in already_processed]
        to_process = new_records[:batch_size]
        logger.info("Ingest: %d new to process", len(to_process))

        with _lock:
            _state["total"] = len(to_process)
            _state["skipped"] = len(already_processed)

        if not to_process:
            _finish()
            return

        for i, record in enumerate(to_process):
            try:
                result = pipeline.ingest_record(record)
                action = result.get("action", "unknown")
                logger.info("CV %d/%d doc_id=%d → %s", i + 1, len(to_process), record.doc_id, action)

                with _lock:
                    if action == "processed":
                        _state["processed"] += 1
                    elif action == "skipped":
                        _state["skipped"] += 1
                    else:
                        _state["failed"] += 1

            except Exception as e:
                logger.error("Error doc_id=%d: %s", record.doc_id, e)
                with _lock:
                    _state["failed"] += 1

        _finish()
        proc, skip, fail = _snapshot_counts()
        logger.info("Ingest done: processed=%d skipped=%d failed=%d", proc, skip, fail)

    except Exception as e:
        logger.error("Ingest fatal: %s\n%s", e, traceback.format_exc())
        _finish(error=e)


def _run_sync():
    try:
        from hiring.services.matching.vacancy_sync import VacancySyncService

        service = VacancySyncService()

        raw_vacancies = service._fetch_all_vacancies()
        logger.info("Sync: %d vacancies fetched from MySQL", len(raw_vacancies))

        with _lock:
            _state["total"] = len(raw_vacancies)

        if not raw_vacancies:
            _finish()
            return

        for i, raw in enumerate(raw_vacancies):
            try:
                if not raw.characteristics:
                    with _lock:
                        _state["skipped"] += 1
                    continue

                result = service._sync_single(raw)
                logger.info(
                    "Sync %d/%d vacancy #%d '%s' → %s",
                    i + 1, len(raw_vacancies), raw.source_id, raw.profile_name, result,
                )

                with _lock:
                    if result in ("created", "updated"):
                        _state["processed"] += 1
                    else:
                        _state["skipped"] += 1

            except Exception as e:
                logger.error("Sync error vacancy #%d: %s", raw.source_id, e)
                with _lock:
                    _state["failed"] += 1

        _finish()
        proc, skip, fail = _snapshot_counts()
        logger.info("Sync done: processed=%d skipped=%d failed=%d", proc, skip, fail)

    except Exception as e:
        logger.error("Sync fatal: %s\n%s", e, traceback.format_exc())
        _finish(error=e)


def _snapshot_counts() -> tuple[int, int, int]:
    with _lock:
        return _state["processed"], _state["skipped"], _state["failed"]


def _finish(error=None):
    with _lock:
        _state["running"] = False
        _state["finished_at"] = time.time()
        if error:
            _state["error"] = str(error)
