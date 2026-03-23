from dataclasses import dataclass, field
from hiring.services.matching.searcher import ChunkMatch


DEFAULT_WEIGHTS: dict[str, float] = {
    "skills": 0.35,
    "experience": 0.25,
    "education": 0.10,
    "certifications": 0.05,
    "languages": 0.05,
    "general": 0.05,
    "summary": 0.00,
}

FULL_PROFILE_WEIGHT = 0.15


def prepare_matching_weights(custom: dict[str, float] | None) -> dict[str, float] | None:
    if custom is None:
        return None
    merged = dict(DEFAULT_WEIGHTS)
    for k, v in custom.items():
        if k in merged:
            merged[k] = float(v)
    total = sum(merged.values())
    if total <= 0:
        return dict(DEFAULT_WEIGHTS)
    return {k: round(v / total, 6) for k, v in merged.items()}


SECTION_LABELS: dict[str, str] = {
    "education": "Educación",
    "experience": "Experiencia",
    "skills": "Skills / Software",
    "languages": "Idiomas",
    "certifications": "Capacitación",
    "general": "General",
    "summary": "Resumen",
}


@dataclass
class SectionScore:
    section_type: str
    similarity: float
    weight: float
    weighted_score: float
    matched_chunks: int

    @property
    def label(self) -> str:
        return SECTION_LABELS.get(self.section_type, self.section_type.title())

    @property
    def score_100(self) -> int:
        return round(self.similarity * 100)


@dataclass
class CandidateScore:
    document_id: int
    source_candidate_id: int | None
    final_score: float
    section_scores: list[SectionScore] = field(default_factory=list)
    full_profile_similarity: float = 0.0

    @property
    def score_100(self) -> int:
        return round(self.final_score * 100)

    @property
    def score_label(self) -> str:
        s = self.score_100
        if s >= 70:
            return "alta"
        elif s >= 50:
            return "media"
        return "baja"


class MatchScorer:
    def __init__(self, weights: dict[str, float] | None = None):
        self.weights = weights or DEFAULT_WEIGHTS

    def score_candidates(
        self,
        section_matches: dict[str, list[ChunkMatch]],
        full_matches: list[ChunkMatch],
    ) -> list[CandidateScore]:
        all_doc_ids: set[int] = set()
        doc_to_candidate: dict[int, int | None] = {}

        for matches in section_matches.values():
            for m in matches:
                all_doc_ids.add(m.document_id)
                doc_to_candidate[m.document_id] = m.source_candidate_id

        for m in full_matches:
            all_doc_ids.add(m.document_id)
            doc_to_candidate[m.document_id] = m.source_candidate_id

        if not all_doc_ids:
            return []

        candidate_scores: list[CandidateScore] = []

        for doc_id in all_doc_ids:
            section_scores = self._compute_section_scores(doc_id, section_matches)
            full_sim = self._best_similarity_for_doc(doc_id, full_matches)
            final = self._compute_final_score(section_scores, full_sim)

            candidate_scores.append(
                CandidateScore(
                    document_id=doc_id,
                    source_candidate_id=doc_to_candidate.get(doc_id),
                    final_score=final,
                    section_scores=section_scores,
                    full_profile_similarity=full_sim,
                )
            )

        candidate_scores.sort(key=lambda cs: cs.final_score, reverse=True)
        return candidate_scores

    def _compute_section_scores(
        self,
        doc_id: int,
        section_matches: dict[str, list[ChunkMatch]],
    ) -> list[SectionScore]:
        scores: list[SectionScore] = []

        for section_type, weight in self.weights.items():
            if weight <= 0:
                continue

            matches = section_matches.get(section_type, [])
            doc_matches = [m for m in matches if m.document_id == doc_id]

            if doc_matches:
                best_sim = max(m.similarity for m in doc_matches)
                matched_count = len(doc_matches)
            else:
                best_sim = 0.0
                matched_count = 0

            scores.append(
                SectionScore(
                    section_type=section_type,
                    similarity=round(best_sim, 4),
                    weight=weight,
                    weighted_score=round(best_sim * weight, 4),
                    matched_chunks=matched_count,
                )
            )

        return scores

    def _best_similarity_for_doc(
        self,
        doc_id: int,
        matches: list[ChunkMatch],
    ) -> float:
        doc_matches = [m for m in matches if m.document_id == doc_id]
        if not doc_matches:
            return 0.0
        return max(m.similarity for m in doc_matches)

    def _compute_final_score(
        self,
        section_scores: list[SectionScore],
        full_profile_similarity: float,
    ) -> float:
        total_weighted = sum(ss.weighted_score for ss in section_scores)
        total_weight = sum(
            ss.weight for ss in section_scores if ss.matched_chunks > 0
        )

        if total_weight > 0:
            section_score = total_weighted / total_weight
        else:
            section_score = 0.0

        section_portion = 1.0 - FULL_PROFILE_WEIGHT
        final = (section_portion * section_score) + (FULL_PROFILE_WEIGHT * full_profile_similarity)
        return round(final, 4)
