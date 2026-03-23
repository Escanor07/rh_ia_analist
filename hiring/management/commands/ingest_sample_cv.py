from django.core.management.base import BaseCommand

from hiring.services.ingestion.mysql_source import MySQLSourceService
from hiring.services.ingestion.pipeline import CandidateIngestionPipeline


class Command(BaseCommand):
    help = "Full ingestion of a CV: extraction, LLM classification, chunks and embeddings"

    def add_arguments(self, parser):
        parser.add_argument(
            "--doc-id",
            type=int,
            required=True,
            help="Source document ID in MySQL",
        )

    def handle(self, *args, **options):
        doc_id = options["doc_id"]

        source_service = MySQLSourceService()
        target = source_service.fetch_cv_record_by_doc_id(doc_id)

        if target is None:
            self.stdout.write(self.style.ERROR("No found doc_id in MySQL"))
            return

        pipeline = CandidateIngestionPipeline()
        result = pipeline.ingest_record(target)

        self.stdout.write(self.style.SUCCESS("Ingestion result"))
        for key, value in result.items():
            self.stdout.write(f"{key}={value}")
