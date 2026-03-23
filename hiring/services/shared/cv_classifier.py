import json
import logging
from dataclasses import dataclass, field
from django.conf import settings
from openai import OpenAI

logger = logging.getLogger(__name__)


VALID_SECTION_TYPES = {
    "summary",
    "experience",
    "education",
    "skills",
    "languages",
    "certifications",
    "general",
}

SYSTEM_PROMPT = """You are an expert CV/resume classifier.

Your task is to receive extracted text from a CV/resume and return a structured JSON
with the CV sections correctly classified.

CLASSIFICATION RULES:
1. Classify each content block into ONE of these categories:
   - summary: professional profile, summary, objective, about me, career summary
   - experience: work experience, employment history, career trajectory, professional achievements, positions held
   - education: education, academic background, studies, degrees, qualifications
   - skills: skills, technical competencies, software, tools, technologies, knowledge areas
   - languages: languages, language proficiency, bilingual skills
   - certifications: certifications, courses, training, diplomas, professional development
   - general: any content that doesn't clearly fit the above categories

2. PRESERVE ALL relevant content from the CV. Do NOT summarize, omit, or truncate details.
3. If a section has mixed content, classify it by its primary theme or most significant content.
4. Contact information (name, email, phone, address, LinkedIn) goes in "general".
5. Evaluate the quality of the extracted text:
   - "good": clear text, well-structured, sufficient content, all major sections present
   - "weak": partially legible text, missing sections, incomplete content, or poor formatting
   - "poor": mostly illegible text, very short, corrupted, or contains mostly noise

OUTPUT FORMAT:
Respond ONLY with a valid JSON object, no markdown formatting, no explanations, no code blocks:
{
  "quality": "good" | "weak" | "poor",
  "sections": [
    {"type": "summary", "content": "..."},
    {"type": "experience", "content": "..."},
    ...
  ]
}"""


@dataclass
class ClassifiedSection:
    section_type: str
    content: str


@dataclass
class CVClassificationResult:
    quality: str
    sections: list[ClassifiedSection] = field(default_factory=list)
    llm_usage: dict = field(default_factory=dict)


class CVClassifier:
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_LLM_MODEL

    def classify(self, text: str) -> CVClassificationResult:
        text = (text or "").strip()

        if not text or len(text) < 50:
            return CVClassificationResult(
                quality="poor",
                sections=[],
                llm_usage={},
            )

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            temperature=0.0,
        )

        raw_content = response.choices[0].message.content or ""
        usage = {
            "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
            "completion_tokens": response.usage.completion_tokens if response.usage else 0,
            "total_tokens": response.usage.total_tokens if response.usage else 0,
        }

        return self._parse_response(raw_content, usage)

    def _parse_response(self, raw: str, usage: dict) -> CVClassificationResult:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            logger.error("LLM returned invalid JSON: %s", raw[:200])
            return CVClassificationResult(
                quality="poor",
                sections=[],
                llm_usage=usage,
            )

        quality = data.get("quality", "weak")
        if quality not in ("good", "weak", "poor"):
            quality = "weak"

        sections: list[ClassifiedSection] = []
        for item in data.get("sections", []):
            section_type = (item.get("type") or "general").lower().strip()
            content = (item.get("content") or "").strip()

            if not content:
                continue

            if section_type not in VALID_SECTION_TYPES:
                section_type = "general"

            sections.append(ClassifiedSection(
                section_type=section_type,
                content=content,
            ))

        return CVClassificationResult(
            quality=quality,
            sections=sections,
            llm_usage=usage,
        )
