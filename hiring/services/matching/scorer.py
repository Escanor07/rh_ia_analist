from dataclasses import dataclass, field
from hiring.services.matching.searcher import ChunkMatch

# Section weights for the section-by-section matching layer.
DEFAULT_WEIGHTS: dict[str, float] = {
    "skills": 0.30,
    "experience": 0.30,
    "education": 0.10,
    "certifications": 0.10,
    "languages": 0.10,
    "general": 0.05,
    "summary": 0.05,
}

# Layer weights for the final score composition.
WEIGHT_AFFINITY = 0.55
WEIGHT_SECTIONS = 0.30
WEIGHT_STANDARDS = 0.15

# Cosine similarity calibration for text-embedding-3-large.
SIMILARITY_FLOOR = 0.25
SIMILARITY_CEILING = 0.72


def calibrate(raw: float) -> float:
    if raw <= SIMILARITY_FLOOR:
        return 0.0
    if raw >= SIMILARITY_CEILING:
        return 1.0
    return (raw - SIMILARITY_FLOOR) / (SIMILARITY_CEILING - SIMILARITY_FLOOR)


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
    raw_similarity: float
    calibrated: float
    weight: float
    matched: bool

    @property
    def label(self) -> str:
        return SECTION_LABELS.get(self.section_type, self.section_type.title())

    @property
    def score_100(self) -> int:
        return round(self.calibrated * 100)


@dataclass
class CandidateScore:
    document_id: int
    source_candidate_id: int | None
    final_score: float
    affinity_score: float = 0.0
    sections_score: float = 0.0
    standards_score: float = 0.0
    section_scores: list[SectionScore] = field(default_factory=list)
    full_profile_similarity: float = 0.0

    @property
    def score_100(self) -> int:
        return round(self.final_score * 100)


class MatchScorer:
    def __init__(
        self,
        weights: dict[str, float] | None = None,
        standards_score_by_doc: dict[int, float] | None = None,
    ):
        self.weights = weights or DEFAULT_WEIGHTS
        self.standards_scores = standards_score_by_doc or {}
        self.has_standards = bool(self.standards_scores)

    def score_candidates(
        self,
        section_matches: dict[str, list[ChunkMatch]],
        full_matches: list[ChunkMatch],
        vacancy_section_types: set[str] | None = None,
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

        # Determine which section types to evaluate
        # Only score sections the vacancy actually has
        active_sections = vacancy_section_types or set(section_matches.keys())

        candidate_scores: list[CandidateScore] = []
        for doc_id in all_doc_ids:
            section_scores = self._compute_section_scores(doc_id, section_matches, active_sections)
            full_sim = self._best_similarity_for_doc(doc_id, full_matches)

            affinity = calibrate(full_sim)
            sections = self._aggregate_sections(section_scores)
            standards = self.standards_scores.get(doc_id, 0.0)

            if self.has_standards:
                final = (WEIGHT_AFFINITY * affinity) + (WEIGHT_SECTIONS * sections) + (WEIGHT_STANDARDS * standards)
            else:
                final = (0.65 * affinity) + (0.35 * sections)

            candidate_scores.append(CandidateScore(
                document_id=doc_id,
                source_candidate_id=doc_to_candidate.get(doc_id),
                final_score=round(final, 4),
                affinity_score=round(affinity, 4),
                sections_score=round(sections, 4),
                standards_score=round(standards, 4),
                section_scores=section_scores,
                full_profile_similarity=full_sim,
            ))

        candidate_scores.sort(key=lambda cs: cs.final_score, reverse=True)
        return candidate_scores

    def _compute_section_scores(
        self, doc_id: int,
        section_matches: dict[str, list[ChunkMatch]],
        active_sections: set[str],
    ) -> list[SectionScore]:
        scores: list[SectionScore] = []

        for section_type, weight in self.weights.items():
            if weight <= 0:
                continue

            in_vacancy = section_type in active_sections
            matches = section_matches.get(section_type, [])
            doc_matches = [m for m in matches if m.document_id == doc_id]

            if doc_matches:
                best_sim = max(m.similarity for m in doc_matches)
                cal = calibrate(best_sim)
                matched = True
            else:
                best_sim = 0.0
                cal = 0.0
                matched = False

            scores.append(SectionScore(
                section_type=section_type,
                raw_similarity=round(best_sim, 4),
                calibrated=round(cal, 4),
                weight=weight if in_vacancy else 0.0,
                matched=matched,
            ))
        return scores

    def _aggregate_sections(self, section_scores: list[SectionScore]) -> float:
        active = [s for s in section_scores if s.weight > 0]
        if not active:
            return 0.0
        total_weight = sum(s.weight for s in active)
        if total_weight <= 0:
            return 0.0
        weighted_sum = sum(s.calibrated * s.weight for s in active)
        return weighted_sum / total_weight

    def _best_similarity_for_doc(self, doc_id: int, matches: list[ChunkMatch]) -> float:
        doc_matches = [m for m in matches if m.document_id == doc_id]
        if not doc_matches:
            return 0.0
        return max(m.similarity for m in doc_matches)
