from django.conf import settings
from openai import OpenAI
from typing import Any
 

class EmbeddingService:
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_EMBEDDING_MODEL
        self.dimensions = settings.OPENAI_EMBEDDING_DIMENSIONS
        self.batch_size = settings.EMBED_BATCH_SIZE

    def embed_texts_with_usage(self, texts: list[str]) -> dict[str, Any]:
        cleaned = [(text or "").strip() for text in texts]
        cleaned = [text if text else "[empty]" for text in cleaned]

        all_embeddings: list[list[float]] = []
        total_prompt_tokens = 0
        total_total_tokens = 0
        batch_count = 0

        for i in range(0, len(cleaned), self.batch_size):
            batch = cleaned[i : i + self.batch_size]
            response = self.client.embeddings.create(
                model=self.model,
                input=batch,
                dimensions=self.dimensions,
            )
            batch_count += 1
            all_embeddings.extend(item.embedding for item in response.data)

            usage = getattr(response, "usage", None)
            if usage is not None:
                total_prompt_tokens += getattr(usage, "prompt_tokens", 0) or 0
                total_total_tokens += getattr(usage, "total_tokens", 0) or 0

        return {
            "embeddings": all_embeddings,
            "prompt_tokens": total_prompt_tokens,
            "total_tokens": total_total_tokens,
            "batch_count": batch_count,
        }
