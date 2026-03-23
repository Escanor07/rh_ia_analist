from django.core.management.base import BaseCommand

from hiring.services.ingestion.mysql_source import MySQLSourceService
from hiring.services.ingestion.pipeline import CandidateIngestionPipeline


class Command(BaseCommand):
    help = "Process CVs in batch with full pipeline until embeddings"

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=None,
            help=(
                "Number of new CVs to index successfully. "
                "Already indexed ones are skipped without counting. "
                "Without this flag, process all."
            ),
        )
        parser.add_argument(
            "--doc-ids",
            type=str,
            default="",
            help="List of doc_ids separated by comma. Example: 1819,1826,1818",
        )

    def handle(self, *args, **options):
        batch_size = options["batch_size"]
        doc_ids_raw = (options["doc_ids"] or "").strip()

        source_service = MySQLSourceService()
        pipeline = CandidateIngestionPipeline()

        records = self._resolve_records(source_service, doc_ids_raw)

        if not records:
            self.stdout.write(self.style.WARNING("No records to process"))
            return

        processed = 0
        failed = 0
        total_seen = 0

        mode = f"batch_size={batch_size}" if batch_size else "all"
        self.stdout.write(self.style.SUCCESS(
            f"Available records: {len(records)} | Mode: {mode}"
        ))

        for record in records:
            total_seen += 1

            self.stdout.write("-" * 80)
            self.stdout.write(
                f"[processed={processed} failed={failed}] "
                f"doc_id={record.doc_id}"
            )
            self.stdout.write(f"source_key={record.source_key}")

            result = pipeline.ingest_record(record)
            action = result.get("action", "")

            for key, value in result.items():
                if key == "reason" and not value:
                    continue
                self.stdout.write(f"  {key}={value}")

            if action == "processed":
                processed += 1
            elif action == "failed":
                failed += 1

            if batch_size and processed >= batch_size:
                self.stdout.write(self.style.SUCCESS(
                    f"\nBatch complete: {processed} new indexed."
                ))
                break

        self.stdout.write("=" * 80)
        self.stdout.write(self.style.SUCCESS("Final summary"))
        self.stdout.write(f"  processed={processed}")
        self.stdout.write(f"  failed={failed}")
        self.stdout.write(f"  total_seen={total_seen}")

    def _resolve_records(self, source_service, doc_ids_raw: str):
        if doc_ids_raw:
            records = []
            seen = set()

            for part in doc_ids_raw.split(","):
                value = part.strip()
                if not value:
                    continue

                doc_id = int(value)
                if doc_id in seen:
                    continue
                seen.add(doc_id)

                record = source_service.fetch_cv_record_by_doc_id(doc_id)
                if record is not None:
                    records.append(record)

            return records

        return source_service.fetch_cv_records()
