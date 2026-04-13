import logging
from dataclasses import dataclass, field

from pgvector.django import CosineDistance

from hiring.models import CandidateChunk, CandidateDocument, GlobalStandard
from hiring.services.matching.scorer import calibrate

logger = logging.getLogger(__name__)

EDUCATION_ORDER = ["none", "secundaria", "preparatoria", "tecnico", "licenciatura", "maestria", "doctorado"]
EDUCATION_LABELS = {
    "none": "Sin estudios", "secundaria": "Secundaria", "preparatoria": "Preparatoria",
    "tecnico": "Técnico", "licenciatura": "Licenciatura",
    "maestria": "Maestría", "doctorado": "Doctorado",
}
STABILITY_ORDER = ["baja", "media", "alta"]

# Catalog of available attribute rules
ATTRIBUTE_CATALOG = {
    "stability": {
        "name": "Estabilidad Laboral",
        "description": "Evalúa la permanencia promedio en los últimos puestos del candidato.",
        "config_schema": {
            "min_level": {"type": "select", "options": ["baja", "media", "alta"], "default": "media", "label": "Nivel mínimo"},
        },
    },
    "min_experience": {
        "name": "Experiencia Mínima",
        "description": "Años mínimos de experiencia profesional del candidato.",
        "config_schema": {
            "min_years": {"type": "number", "min": 0, "max": 30, "default": 2, "label": "Años mínimos"},
        },
    },
    "min_education": {
        "name": "Nivel Educativo Mínimo",
        "description": "Grado académico mínimo requerido.",
        "config_schema": {
            "min_level": {"type": "select", "options": EDUCATION_ORDER[1:], "default": "preparatoria", "label": "Nivel mínimo"},
        },
    },
    "cv_completeness": {
        "name": "Completitud del CV",
        "description": "Mínimo de secciones presentes en el CV (de 6 posibles: experiencia, educación, habilidades, idiomas, certificaciones, perfil).",
        "config_schema": {
            "min_sections": {"type": "number", "min": 1, "max": 6, "default": 4, "label": "Secciones mínimas"},
        },
    },
}


@dataclass
class StandardResult:
    name: str
    standard_type: str
    eval_mode: str
    score_100: int
    passed: bool
    value: str
    weight: float


@dataclass
class StandardsEvaluation:
    score: float
    all_filters_passed: bool
    results: list[StandardResult] = field(default_factory=list)


def load_active_standards() -> list[GlobalStandard]:
    return list(GlobalStandard.objects.filter(is_active=True))


def get_attribute_catalog() -> dict:
    return ATTRIBUTE_CATALOG


# --- Batch scoring for matching pipeline integration ---

def compute_standards_scores(
    standards: list[GlobalStandard],
    doc_ids: list[int],
) -> dict[int, float]:
    if not standards or not doc_ids:
        return {}

    text_standards = [s for s in standards if s.standard_type == "text" and s.embedding is not None]
    attr_standards = [s for s in standards if s.standard_type == "attribute"]

    docs = {d.id: d for d in CandidateDocument.objects.filter(id__in=doc_ids)}
    section_types_by_doc = _get_section_types_by_doc(doc_ids)

    result: dict[int, list[tuple[float, float, str]]] = {did: [] for did in doc_ids}

    # Text standards: embedding similarity
    for std in text_standards:
        best_by_doc = _text_similarity_batch(std, doc_ids)
        for did in doc_ids:
            raw = best_by_doc.get(did, 0.0)
            result[did].append((calibrate(raw), std.weight, std.eval_mode))

    # Attribute standards: rule evaluation
    for std in attr_standards:
        for did in doc_ids:
            doc = docs.get(did)
            if not doc:
                result[did].append((0.0, std.weight, std.eval_mode))
                continue
            attrs = (doc.processing_meta_json or {}).get("attributes", {})
            score = _evaluate_attribute(std, attrs, section_types_by_doc.get(did, set()))
            result[did].append((score, std.weight, std.eval_mode))

    # Aggregate: weighted average of score-mode standards only
    output: dict[int, float] = {}
    for did, scores in result.items():
        score_items = [(s, w) for s, w, mode in scores if mode == "score"]
        if not score_items:
            output[did] = 0.0
            continue
        total_w = sum(w for _, w in score_items)
        if total_w <= 0:
            output[did] = 0.0
            continue
        output[did] = round(sum(s * w for s, w in score_items) / total_w, 4)

    return output


# --- Detailed evaluation for a single candidate ---

def evaluate_candidate(
    standards: list[GlobalStandard],
    doc_id: int,
) -> StandardsEvaluation:
    if not standards:
        return StandardsEvaluation(score=0.0, all_filters_passed=True)

    doc = CandidateDocument.objects.filter(id=doc_id).first()
    attrs = (doc.processing_meta_json or {}).get("attributes", {}) if doc else {}
    section_types = _get_section_types_by_doc([doc_id]).get(doc_id, set())

    results: list[StandardResult] = []

    for std in standards:
        if std.standard_type == "text" and std.embedding is not None:
            score, value = _eval_text_single(std, doc_id)
        elif std.standard_type == "attribute":
            score, value = _eval_attribute_single(std, attrs, section_types)
        else:
            continue

        score_100 = round(score * 100)

        if std.eval_mode == "filter":
            passed = score >= 0.5
        else:
            passed = True

        results.append(StandardResult(
            name=std.name,
            standard_type=std.standard_type, eval_mode=std.eval_mode,
            score_100=score_100, passed=passed, value=value, weight=std.weight,
        ))

    all_passed = all(r.passed for r in results if r.eval_mode == "filter")

    score_results = [r for r in results if r.eval_mode == "score"]
    if score_results:
        total_w = sum(r.weight for r in score_results)
        score = sum(r.score_100 / 100 * r.weight for r in score_results) / total_w if total_w > 0 else 0
    else:
        score = 0.0

    return StandardsEvaluation(
        score=round(score, 4), all_filters_passed=all_passed, results=results,
    )


# --- Internal helpers ---

def _get_section_types_by_doc(doc_ids: list[int]) -> dict[int, set[str]]:
    out: dict[int, set[str]] = {did: set() for did in doc_ids}
    for row in (
        CandidateChunk.objects.filter(document_id__in=doc_ids)
        .values("document_id", "section_type").distinct()
    ):
        out[row["document_id"]].add(row["section_type"])
    return out


def _text_similarity_batch(std: GlobalStandard, doc_ids: list[int], top_k: int = 10) -> dict[int, float]:
    results = (
        CandidateChunk.objects
        .filter(embedding__isnull=False, document__status="processed", document_id__in=doc_ids)
        .annotate(distance=CosineDistance("embedding", std.embedding))
        .order_by("distance")
        [:top_k * len(doc_ids)]
    )
    best: dict[int, float] = {}
    for chunk in results:
        sim = 1.0 - chunk.distance
        did = chunk.document_id
        if did not in best or sim > best[did]:
            best[did] = sim
    return best


def _eval_text_single(std: GlobalStandard, doc_id: int) -> tuple[float, str]:
    chunks = (
        CandidateChunk.objects
        .filter(embedding__isnull=False, document__status="processed", document_id=doc_id)
        .annotate(distance=CosineDistance("embedding", std.embedding))
        .order_by("distance")[:5]
    )
    if not chunks:
        return 0.0, "Sin datos"
    best = max(1.0 - c.distance for c in chunks)
    cal = calibrate(best)
    return cal, f"{round(cal * 100)}% afinidad"


def _evaluate_attribute(
    std: GlobalStandard, attrs: dict, section_types: set[str],
) -> float:
    slug = std.attribute_slug
    config = std.attribute_config or {}

    if slug == "stability":
        return _eval_stability(attrs, config)
    elif slug == "min_experience":
        return _eval_min_experience(attrs, config)
    elif slug == "min_education":
        return _eval_min_education(attrs, config)
    elif slug == "cv_completeness":
        return _eval_cv_completeness(section_types, config)
    return 0.0


def _eval_attribute_single(
    std: GlobalStandard, attrs: dict, section_types: set[str],
) -> tuple[float, str]:
    slug = std.attribute_slug
    config = std.attribute_config or {}

    if slug == "stability":
        score = _eval_stability(attrs, config)
        stability = attrs.get("stability", {})
        level = stability.get("level", "unknown")
        months = stability.get("recent_avg_months", 0)
        labels = {"alta": "Alta", "media": "Media", "baja": "Baja", "unknown": "No determinado"}
        if level == "unknown":
            return score, "No determinado"
        return score, f"{labels.get(level, level)} (~{months}m/puesto)"

    elif slug == "min_experience":
        score = _eval_min_experience(attrs, config)
        years = attrs.get("experience_years")
        min_y = config.get("min_years", 2)
        if years is None:
            return score, "No determinado"
        return score, f"{years} años (mín. {min_y})"

    elif slug == "min_education":
        score = _eval_min_education(attrs, config)
        level = attrs.get("education_level", "")
        label = EDUCATION_LABELS.get(level, "No determinado")
        return score, label

    elif slug == "cv_completeness":
        score = _eval_cv_completeness(section_types, config)
        expected = {"experience", "education", "skills", "languages", "certifications", "summary"}
        present = len(section_types & expected)
        return score, f"{present}/6 secciones"

    return 0.0, "—"


# --- Attribute evaluators ---

def _eval_stability(attrs: dict, config: dict) -> float:
    stability = attrs.get("stability", {})
    level = stability.get("level", "unknown")
    if level == "unknown":
        return 0.0
    min_level = config.get("min_level", "media")
    candidate_idx = STABILITY_ORDER.index(level) if level in STABILITY_ORDER else -1
    required_idx = STABILITY_ORDER.index(min_level) if min_level in STABILITY_ORDER else 1
    if candidate_idx < 0:
        return 0.0
    if candidate_idx >= required_idx:
        return 1.0
    return candidate_idx / max(required_idx, 1)


def _eval_min_experience(attrs: dict, config: dict) -> float:
    years = attrs.get("experience_years")
    if years is None:
        return 0.0
    min_y = config.get("min_years", 2)
    if min_y <= 0:
        return 1.0
    return min(years / min_y, 1.0)


def _eval_min_education(attrs: dict, config: dict) -> float:
    level = attrs.get("education_level", "")
    if not level or level not in EDUCATION_ORDER:
        return 0.0
    min_level = config.get("min_level", "preparatoria")
    candidate_idx = EDUCATION_ORDER.index(level)
    required_idx = EDUCATION_ORDER.index(min_level) if min_level in EDUCATION_ORDER else 2
    if candidate_idx >= required_idx:
        return 1.0
    return candidate_idx / max(required_idx, 1)


def _eval_cv_completeness(section_types: set[str], config: dict) -> float:
    expected = {"experience", "education", "skills", "languages", "certifications", "summary"}
    present = len(section_types & expected)
    min_sections = config.get("min_sections", 4)
    if min_sections <= 0:
        return 1.0
    return min(present / min_sections, 1.0)
