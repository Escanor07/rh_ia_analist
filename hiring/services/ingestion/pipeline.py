import os
import time

from django.db import transaction
from django.utils import timezone

from hiring.models import CandidateChunk, CandidateDocument
from hiring.services.ingestion.chunker import CandidateChunker
from hiring.services.ingestion.extractor import DocumentExtractionService
from hiring.services.ingestion.mysql_source import SourceCVRecord
from hiring.services.ingestion.s3_storage import S3StorageService
from hiring.services.shared.cv_classifier import CVClassifier
from hiring.services.shared.embeddings import EmbeddingService


def _sanitize_json(obj):
    if isinstance(obj, str):
        return obj.replace('\u0000', '').replace('\x00', '')
    if isinstance(obj, dict):
        return {k: _sanitize_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_json(v) for v in obj]
    return obj


class CandidateIngestionPipeline:
    def __init__(self) -> None:
        self.storage = S3StorageService()
        self.extractor = DocumentExtractionService()
        self.classifier = CVClassifier()
        self.chunker = CandidateChunker()
        self.embedding_service = EmbeddingService()

    def ingest_record(self, record: SourceCVRecord) -> dict:
        downloaded = None
        start_time = time.time()

        try:
            # 1. Download from S3
            downloaded = self.storage.download_to_temp(record.source_key)

            # 2. Extract text
            extracted = self.extractor.extract(downloaded.local_path)

            # 3. Classify with LLM
            classification = self.classifier.classify(extracted.text)

            # 4. Chunking
            chunk_payloads = self.chunker.build_chunks(classification.sections)

            with transaction.atomic():
                existing = CandidateDocument.objects.filter(
                    source_key=record.source_key,
                ).first()

                document = existing or CandidateDocument(source_key=record.source_key)
                document.filename = downloaded.filename
                document.source_candidate_id = record.candidate_id
                document.source_vacante_id = record.vacante_id
                document.status = CandidateDocument.Status.PENDING
                document.last_error = ""
                document.processing_meta_json = _sanitize_json({
                    "source": {
                        "doc_id": record.doc_id,
                        "candidate_id": record.candidate_id,
                        "candidate_name": record.candidate_name,
                        "candidate_email": record.candidate_email,
                    },
                    "quality": classification.quality,
                    "attributes": classification.attributes,
                    "llm_usage": classification.llm_usage,
                })
                document.save()

                document.chunks.all().delete()

                # 5. Create chunks
                chunk_objects = [
                    CandidateChunk(
                        document=document,
                        chunk_index=idx,
                        section_type=payload.section_type,
                        content=_sanitize_json(payload.content),
                    )
                    for idx, payload in enumerate(chunk_payloads)
                ]

                if chunk_objects:
                    CandidateChunk.objects.bulk_create(chunk_objects)

                # 6. Embeddings
                texts = [c.content for c in chunk_objects]
                embed_result = (
                    self.embedding_service.embed_texts_with_usage(texts)
                    if texts
                    else {"embeddings": [], "prompt_tokens": 0, "total_tokens": 0}
                )

                for chunk, emb in zip(chunk_objects, embed_result["embeddings"]):
                    chunk.embedding = emb

                if chunk_objects:
                    CandidateChunk.objects.bulk_update(chunk_objects, ["embedding"])

                # 7. Finish
                elapsed = round(time.time() - start_time, 2)
                embed_tokens = embed_result.get("prompt_tokens", 0)

                document.processing_meta_json["pipeline"] = {
                    "chunks_count": len(chunk_objects),
                    "sections": [p.section_type for p in chunk_payloads],
                    "embedding_tokens": embed_tokens,
                    "processing_time_seconds": elapsed,
                }
                document.status = CandidateDocument.Status.PROCESSED
                document.indexed_at = timezone.now()
                document.save(update_fields=[
                    "processing_meta_json", "status", "indexed_at", "updated_at",
                ])

            return {
                "action": "processed",
                "document_id": document.id,
                "source_key": document.source_key,
                "chunks_count": len(chunk_objects),
                "quality": classification.quality,
            }

        except Exception as exc:
            document = CandidateDocument.objects.filter(
                source_key=record.source_key,
            ).first()
            if document is None:
                document = CandidateDocument(
                    source_key=record.source_key,
                    filename=os.path.basename(record.source_key) or "unknown",
                )

            document.status = CandidateDocument.Status.FAILED
            document.last_error = str(exc)
            meta = document.processing_meta_json or {}
            meta.setdefault("source", {}).update({
                "doc_id": record.doc_id,
                "candidate_id": record.candidate_id,
            })
            document.processing_meta_json = meta
            document.save()

            return {
                "action": "failed",
                "reason": str(exc),
                "document_id": document.id,
                "source_key": record.source_key,
            }

        finally:
            if downloaded and os.path.exists(downloaded.local_path):
                os.unlink(downloaded.local_path)
