import json
import logging
import re
from dataclasses import dataclass, field
from django.conf import settings
from django.utils import timezone
from openai import OpenAI

logger = logging.getLogger(__name__)


VALID_SECTION_TYPES = {
    "summary", "experience", "education", "skills",
    "languages", "certifications", "general",
}

VALID_QUALITY = {"good", "weak", "poor"}
VALID_EDU = {"none", "secundaria", "preparatoria", "tecnico", "licenciatura", "maestria", "doctorado"}

SYSTEM_PROMPT = """You are an expert CV/resume classifier.

You will receive text extracted from a CV and must return structured JSON.

Classify the content into these sections:
- summary: professional profile, summary, objective, about me
- experience: work experience, employment history, achievements, positions held
- education: education, academic background, studies, degrees
- skills: technical skills, software, tools, technologies, competencies
- languages: languages and proficiency level
- certifications: certifications, courses, training, diplomas
- general: contact details, references, and anything else

Rules:
- Retain original and relevant content, formatting with appropriate line breaks.
- Do not invent experience, education, or certifications.
- Each block goes in ONE category only. Produce exactly ONE section per category — merge if needed.
- ALWAYS include a "skills" section. If none are explicit, extract tools, software, equipment and action verbs from experience. Minimum 3 skills.
- ALWAYS include a "summary" section. If the CV has none, generate 2-3 lines from experience and roles.
- ALWAYS include a "languages" section with at least "Español (Nativo)" and "español" in languages_detected.

quality:
- good: clear, well-structured, sufficient content
- weak: partially readable or incomplete
- poor: unreadable, too short, corrupted, or noise

Also extract:
- experience_years: integer or null
- education_level: one of [none, secundaria, preparatoria, tecnico, licenciatura, maestria, doctorado] or null
- skills_list: lowercase array without duplicates
- languages_detected: lowercase array without duplicates
- positions: array of objects with title, months (integer), recent (true if current or ended within last 3 years)

If a date says "currently" or "present", calculate up to the reference date given by the user.

Return only valid JSON."""

CV_CLASSIFICATION_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "quality": {
            "type": "string",
            "enum": ["good", "weak", "poor"],
        },
        "sections": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "type": {
                        "type": "string",
                        "enum": ["summary", "experience", "education", "skills", "languages", "certifications", "general"]
                    },
                    "content": {"type": "string"},
                },
                "required": ["type", "content"],
            },
        },
        "attributes": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "experience_years": {
                    "anyOf": [{"type": "integer"}, {"type": "null"}],
                },
                "education_level": {
                    "anyOf": [
                        {"type": "string", "enum": ["none", "secundaria", "preparatoria", "tecnico", "licenciatura", "maestria", "doctorado"]},
                        {"type": "null"},
                    ],
                },
                "skills_list": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "languages_detected": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "positions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "title": {"type": "string"},
                            "months": {"type": "integer"},
                            "recent": {"type": "boolean"},
                        },
                        "required": ["title", "months", "recent"],
                    },
                },
            },
            "required": [
                "experience_years", "education_level",
                "skills_list", "languages_detected", "positions",
            ],
        },
    },
    "required": ["quality", "sections", "attributes"],
}


@dataclass
class ClassifiedSection:
    section_type: str
    content: str


@dataclass
class CVClassificationResult:
    quality: str
    sections: list[ClassifiedSection] = field(default_factory=list)
    attributes: dict = field(default_factory=dict)
    llm_usage: dict = field(default_factory=dict)


class CVClassifier:
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_LLM_MODEL

    def classify(self, text: str) -> CVClassificationResult:
        text = self._normalize_input(text)

        if not self._has_minimum_signal(text):
            return CVClassificationResult(quality="poor", sections=[], llm_usage={})

        reference_date = timezone.localdate().isoformat()
        user_prompt = f"Fecha de referencia: {reference_date}\n\nTexto del CV:\n{text}"

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "cv_classification",
                    "strict": True,
                    "schema": CV_CLASSIFICATION_SCHEMA,
                },
            },
            temperature=0.0,
        )

        raw_content = response.choices[0].message.content or ""
        usage = {
            "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
            "completion_tokens": response.usage.completion_tokens if response.usage else 0,
            "total_tokens": response.usage.total_tokens if response.usage else 0,
        }

        return self._parse_response(raw_content, usage)

    # --- Input processing ---

    def _normalize_input(self, text: str) -> str:
        text = (text or "").strip()
        if not text:
            return ""
        text = text.replace("\x00", " ")
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def _has_minimum_signal(self, text: str) -> bool:
        if not text or len(text) < 50:
            return False
        useful = sum(ch.isalpha() or ch.isdigit() for ch in text)
        return useful >= 30

    # --- Response parsing ---

    def _parse_response(self, raw: str, usage: dict) -> CVClassificationResult:
        try:
            data = json.loads(raw.strip())
        except json.JSONDecodeError:
            logger.error("LLM returned invalid JSON: %s", raw[:300])
            return CVClassificationResult(quality="poor", sections=[], llm_usage=usage)

        quality = data.get("quality", "weak")
        if quality not in VALID_QUALITY:
            quality = "weak"

        sections: list[ClassifiedSection] = []
        for item in data.get("sections", []):
            if not isinstance(item, dict):
                continue
            section_type = (item.get("type") or "general").lower().strip()
            content = (item.get("content") or "").strip()
            if not content:
                continue
            if section_type not in VALID_SECTION_TYPES:
                section_type = "general"
            sections.append(ClassifiedSection(section_type=section_type, content=content))

        attrs = self._parse_attributes(data.get("attributes", {}))
        sections = self._ensure_section_defaults(sections)

        return CVClassificationResult(
            quality=quality, sections=sections,
            attributes=attrs, llm_usage=usage,
        )

    # --- Attribute parsing ---

    def _parse_attributes(self, raw: dict) -> dict:
        if not isinstance(raw, dict):
            raw = {}

        attrs = {}

        val = raw.get("experience_years")
        if val is not None:
            try:
                attrs["experience_years"] = max(0, int(val))
            except (ValueError, TypeError):
                pass

        edu = raw.get("education_level")
        if isinstance(edu, str) and edu.lower().strip() in VALID_EDU:
            attrs["education_level"] = edu.lower().strip()

        skills = raw.get("skills_list")
        if isinstance(skills, list):
            attrs["skills_list"] = list(dict.fromkeys(
                s.strip().lower() for s in skills if isinstance(s, str) and s.strip()
            ))
        else:
            attrs["skills_list"] = []

        langs = raw.get("languages_detected")
        if isinstance(langs, list):
            attrs["languages_detected"] = list(dict.fromkeys(
                la.strip().lower() for la in langs if isinstance(la, str) and la.strip()
            ))
        else:
            attrs["languages_detected"] = []

        if not attrs["languages_detected"]:
            attrs["languages_detected"] = ["español"]

        positions = raw.get("positions")
        parsed_positions = []
        if isinstance(positions, list):
            for p in positions:
                if not isinstance(p, dict):
                    continue
                title = (p.get("title") or "").strip()
                months = p.get("months")
                if not title or months is None:
                    continue
                try:
                    parsed_positions.append({
                        "title": title,
                        "months": max(0, int(months)),
                        "recent": bool(p.get("recent", False)),
                    })
                except (ValueError, TypeError):
                    continue
        attrs["positions"] = parsed_positions
        attrs["stability"] = self._compute_stability(parsed_positions)

        return attrs

    # --- Post-processing defaults ---

    def _ensure_section_defaults(self, sections: list[ClassifiedSection]) -> list[ClassifiedSection]:
        has_languages = any(s.section_type == "languages" for s in sections)
        if not has_languages:
            sections.append(ClassifiedSection(section_type="languages", content="Español (Nativo)"))
        return sections

    # --- Stability computation ---

    def _compute_stability(self, positions: list[dict]) -> dict:
        if not positions:
            return {"level": "unknown", "recent_avg_months": 0, "total_positions": 0}

        recent = [p for p in positions if p.get("recent")]
        all_months = [p["months"] for p in positions if p["months"] > 0]

        if recent:
            avg = sum(p["months"] for p in recent) / len(recent)
        elif all_months:
            avg = sum(all_months) / len(all_months)
        else:
            return {"level": "unknown", "recent_avg_months": 0, "total_positions": len(positions)}

        if avg >= 24:
            level = "alta"
        elif avg >= 12:
            level = "media"
        else:
            level = "baja"

        return {"level": level, "recent_avg_months": round(avg), "total_positions": len(positions)}
