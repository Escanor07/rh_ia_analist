from dataclasses import dataclass
from django.conf import settings
import tiktoken

from hiring.services.shared.cv_classifier import ClassifiedSection


@dataclass
class ChunkPayload:
    section_type: str
    content: str


class CandidateChunker:
    def __init__(
        self,
        model_name: str | None = None,
        target_tokens: int = 550,
        overlap_tokens: int = 60,
        split_threshold: int = 650,
    ) -> None:
        self.target_tokens = target_tokens
        self.overlap_tokens = overlap_tokens
        self.split_threshold = split_threshold

        enc_model = model_name or settings.OPENAI_EMBEDDING_MODEL
        try:
            self.encoding = tiktoken.encoding_for_model(enc_model)
        except Exception:
            self.encoding = tiktoken.get_encoding("cl100k_base")

    def build_chunks(self, sections: list[ClassifiedSection]) -> list[ChunkPayload]:
        """Converts classified sections into chunks for embedding."""
        all_chunks: list[ChunkPayload] = []

        for section in sections:
            content = (section.content or "").strip()
            if not content:
                continue

            token_count = self._count_tokens(content)

            if token_count <= self.split_threshold:
                all_chunks.append(ChunkPayload(
                    section_type=section.section_type,
                    content=content,
                ))
            else:
                parts = self._split_text(content)
                for part in parts:
                    if part.strip():
                        all_chunks.append(ChunkPayload(
                            section_type=section.section_type,
                            content=part.strip(),
                        ))

        return all_chunks

    def _split_text(self, text: str) -> list[str]:
        """Split by paragraphs with token overlap."""
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        if not paragraphs:
            paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
        if not paragraphs:
            return [text] if text.strip() else []

        chunks: list[str] = []
        current_parts: list[str] = []
        current_tokens = 0

        for para in paragraphs:
            p_tokens = self._count_tokens(para)

            if p_tokens > self.target_tokens:
                if current_parts:
                    chunks.append("\n\n".join(current_parts))
                    current_parts = []
                    current_tokens = 0

                chunks.extend(self._hard_split(para))
                continue

            if current_tokens + p_tokens <= self.target_tokens:
                current_parts.append(para)
                current_tokens += p_tokens
            else:
                if current_parts:
                    chunks.append("\n\n".join(current_parts))

                overlap = self._get_overlap(current_parts)
                current_parts = overlap + [para]
                current_tokens = sum(self._count_tokens(p) for p in current_parts)

        if current_parts:
            chunks.append("\n\n".join(current_parts))

        return [c for c in chunks if c.strip()]

    def _count_tokens(self, text: str) -> int:
        return len(self.encoding.encode(text or ""))

    def _hard_split(self, text: str) -> list[str]:
        """Split hard by token window."""
        tokens = self.encoding.encode(text)
        pieces: list[str] = []
        start = 0

        while start < len(tokens):
            end = min(start + self.target_tokens, len(tokens))
            piece = self.encoding.decode(tokens[start:end]).strip()
            if piece:
                pieces.append(piece)
            if end >= len(tokens):
                break
            start = max(end - self.overlap_tokens, start + 1)

        return pieces

    def _get_overlap(self, parts: list[str]) -> list[str]:
        """Get the last paragraphs that fit in the overlap window."""
        if not parts or self.overlap_tokens <= 0:
            return []

        selected: list[str] = []
        total = 0

        for part in reversed(parts):
            pt = self._count_tokens(part)
            if total + pt > self.overlap_tokens and selected:
                break
            selected.insert(0, part)
            total += pt
            if total >= self.overlap_tokens:
                break

        return selected
