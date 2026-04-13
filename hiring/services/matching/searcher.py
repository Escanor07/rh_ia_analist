from dataclasses import dataclass
from pgvector.django import CosineDistance
from hiring.models import CandidateChunk


@dataclass
class ChunkMatch:
    chunk_id: int
    document_id: int
    source_candidate_id: int | None
    section_type: str
    content: str
    distance: float

    @property
    def similarity(self) -> float:
        return 1.0 - self.distance


class ProfileSearcher:
    def __init__(self, top_k: int = 20, allowed_document_ids: set[int] | None = None):
        self.top_k = top_k
        self.allowed_document_ids = allowed_document_ids

    def search_by_section(
        self,
        embedding,
        section_type: str,
        top_k: int | None = None,
    ) -> list[ChunkMatch]:
        if embedding is None:
            return []

        k = top_k or self.top_k
        target_types = self._get_candidate_section_types(section_type)

        qs = CandidateChunk.objects.filter(
            embedding__isnull=False,
            document__status="processed",
            section_type__in=target_types,
        )
        if self.allowed_document_ids is not None:
            qs = qs.filter(document_id__in=self.allowed_document_ids)

        results = (
            qs
            .select_related("document")
            .annotate(distance=CosineDistance("embedding", embedding))
            .order_by("distance")
            [:k]
        )

        return [self._map_chunk(r) for r in results]

    def search_full(
        self,
        embedding,
        top_k: int | None = None,
    ) -> list[ChunkMatch]:
        if embedding is None:
            return []

        k = top_k or self.top_k

        qs = CandidateChunk.objects.filter(
            embedding__isnull=False,
            document__status="processed",
        )
        if self.allowed_document_ids is not None:
            qs = qs.filter(document_id__in=self.allowed_document_ids)

        results = (
            qs
            .select_related("document")
            .annotate(distance=CosineDistance("embedding", embedding))
            .order_by("distance")
            [:k]
        )

        return [self._map_chunk(r) for r in results]

    def _get_candidate_section_types(self, profile_section_type: str) -> list[str]:
        mapping = {
            "education": ["education"],
            "experience": ["experience"],
            "skills": ["skills"],
            "languages": ["languages"],
            "certifications": ["certifications", "education"],
            "general": ["general", "summary"],
        }
        return mapping.get(profile_section_type, [profile_section_type])

    def _map_chunk(self, chunk: CandidateChunk) -> ChunkMatch:
        return ChunkMatch(
            chunk_id=chunk.id,
            document_id=chunk.document_id,
            source_candidate_id=chunk.document.source_candidate_id,
            section_type=chunk.section_type,
            content=chunk.content,
            distance=chunk.distance,
        )
