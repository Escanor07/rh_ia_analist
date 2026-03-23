import re
from dataclasses import dataclass, field
from pathlib import Path

from docling.document_converter import DocumentConverter


@dataclass
class ExtractionResult:
    text: str
    metadata: dict = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)


class DocumentExtractionService:
    NOISE_LINE_PATTERNS = [
        re.compile(r"^\s*<!--.*?-->\s*$"),
        re.compile(r"^\s*image\s*$", re.IGNORECASE),
        re.compile(r"^\s*imagen\s*$", re.IGNORECASE),
        re.compile(r"^\s*page\s+\d+\s*$", re.IGNORECASE),
        re.compile(r"^\s*página\s+\d+\s*$", re.IGNORECASE),
    ]

    def __init__(self) -> None:
        self.converter = DocumentConverter()

    def extract(self, file_path: str | Path) -> ExtractionResult:
        path = Path(file_path)

        result = self.converter.convert(str(path))
        document = result.document
        markdown = document.export_to_markdown()

        text = self._clean_markdown(markdown)

        warnings: list[str] = []
        if not text.strip():
            warnings.append("empty_text_after_cleaning")
        elif len(text) < 300:
            warnings.append("very_short_text")

        metadata = {
            "file_path": str(path),
            "text_length": len(text),
            "line_count": len([ln for ln in text.splitlines() if ln.strip()]),
        }

        return ExtractionResult(
            text=text,
            metadata=metadata,
            warnings=warnings,
        )

    def _clean_markdown(self, markdown: str) -> str:
        text = markdown or ""

        text = text.replace("\r\n", "\n").replace("\r", "\n")
        text = text.replace("\u00a0", " ")
        text = text.replace("\ufeff", "")
        text = text.replace("```", "")

        text = re.sub(r"^\s*#{1,6}\s*", "", text, flags=re.MULTILINE)
        text = re.sub(r"^\s*[-*]\s+", "• ", text, flags=re.MULTILINE)
        text = text.replace("|", " ")

        lines = []
        for raw_line in text.split("\n"):
            line = raw_line.strip()
            line = re.sub(r"[ \t]+", " ", line)

            if not line:
                lines.append("")
                continue

            if self._is_noise_line(line):
                continue

            lines.append(line)

        text = "\n".join(lines)
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r"\s+-\s+", " • ", text)

        return text.strip()

    def _is_noise_line(self, line: str) -> bool:
        for pattern in self.NOISE_LINE_PATTERNS:
            if pattern.match(line):
                return True
        return False