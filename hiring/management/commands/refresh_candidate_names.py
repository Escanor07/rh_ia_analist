from django.core.management.base import BaseCommand

from hiring.models import CandidateDocument
from hiring.services.shared.mysql_client import MySQLClient


class Command(BaseCommand):
    help = "Refresh candidate_name in processing_meta_json from MySQL without re-indexing"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be updated without saving changes",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        docs = list(
            CandidateDocument.objects.exclude(processing_meta_json__isnull=True)
            .only("id", "processing_meta_json")
        )

        # Collect doc_ids stored in meta to fetch names in bulk from MySQL
        doc_id_to_pg_ids: dict[int, list[int]] = {}
        for doc in docs:
            source_doc_id = (doc.processing_meta_json or {}).get("source", {}).get("doc_id")
            if source_doc_id:
                doc_id_to_pg_ids.setdefault(int(source_doc_id), []).append(doc.id)

        if not doc_id_to_pg_ids:
            self.stdout.write(self.style.WARNING("No documents with source.doc_id found"))
            return

        self.stdout.write(f"Documents to check: {len(docs)} | Unique source doc_ids: {len(doc_id_to_pg_ids)}")

        # Fetch names from MySQL in one query
        source_doc_ids = list(doc_id_to_pg_ids.keys())
        ph = ",".join(["%s"] * len(source_doc_ids))
        rows = MySQLClient().fetch_all(
            f"""
            SELECT
                d.id AS doc_id,
                COALESCE(CONCAT_WS(' ', vc.name, vc.paternal_last_name, vc.maternal_last_name), '') AS candidate_name,
                COALESCE(vc.correo, '') AS candidate_email
            FROM gestor_rh_candidato_documento d
            LEFT JOIN gestor_rh_candidate vc ON vc.id = d.candidato_id
            WHERE d.id IN ({ph})
            """,
            tuple(source_doc_ids),
        )

        name_by_doc_id = {int(r["doc_id"]): r for r in rows}

        updated = 0
        skipped_no_mysql = 0
        skipped_same = 0

        to_save = []
        for doc in docs:
            source = (doc.processing_meta_json or {}).get("source", {})
            source_doc_id = source.get("doc_id")
            if not source_doc_id:
                continue

            mysql_row = name_by_doc_id.get(int(source_doc_id))
            if not mysql_row:
                skipped_no_mysql += 1
                continue

            new_name = mysql_row["candidate_name"]
            current_name = source.get("candidate_name", "")

            if new_name == current_name:
                skipped_same += 1
                continue

            self.stdout.write(
                f"  doc_id={source_doc_id} pg_id={doc.id} "
                f"'{current_name}' → '{new_name}'"
            )

            if not dry_run:
                doc.processing_meta_json["source"]["candidate_name"] = new_name
                doc.processing_meta_json["source"]["candidate_email"] = mysql_row["candidate_email"]
                to_save.append(doc)

            updated += 1

        if not dry_run and to_save:
            CandidateDocument.objects.bulk_update(to_save, ["processing_meta_json"])

        self.stdout.write("=" * 60)
        if dry_run:
            self.stdout.write(self.style.WARNING(f"DRY RUN — no changes saved"))
        self.stdout.write(self.style.SUCCESS(f"updated={updated}"))
        self.stdout.write(f"skipped_same_name={skipped_same}")
        self.stdout.write(f"skipped_not_in_mysql={skipped_no_mysql}")
