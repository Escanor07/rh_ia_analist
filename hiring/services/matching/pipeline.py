import logging

from hiring.models import Vacancy
from hiring.services.matching.scorer import CandidateScore, MatchScorer
from hiring.services.matching.searcher import ProfileSearcher

logger = logging.getLogger(__name__)


class MatchingPipeline:
    def __init__(self, top_k_per_section: int = 30, top_k_full: int = 40, weights: dict[str, float] | None = None):
        self.searcher = ProfileSearcher(top_k=top_k_per_section)
        self.scorer = MatchScorer(weights=weights)
        self.top_k_full = top_k_full

    def match_vacancy(self, vacancy: Vacancy, top_n: int = 10) -> list[CandidateScore]:
        sections = list(vacancy.sections.all())

        if not sections and vacancy.full_embedding is None:
            logger.warning("Vacancy #%d without embeddings.", vacancy.source_id)
            return []

        section_matches: dict[str, list] = {}
        for section in sections:
            logger.info(
                "Searching section '%s' of vacancy #%d...",
                section.section_type, vacancy.source_id,
            )
            matches = self.searcher.search_by_section(
                embedding=section.embedding,
                section_type=section.section_type,
            )
            section_matches[section.section_type] = matches

        logger.info("Searching with full profile of vacancy #%d...", vacancy.source_id)
        full_matches = self.searcher.search_full(
            embedding=vacancy.full_embedding,
            top_k=self.top_k_full,
        )

        all_scores = self.scorer.score_candidates(section_matches, full_matches)

        logger.info(
            "Matching vacancy #%d '%s': %d candidates, top=%.4f",
            vacancy.source_id, vacancy.profile_name,
            len(all_scores),
            all_scores[0].final_score if all_scores else 0.0,
        )

        return all_scores[:top_n]
