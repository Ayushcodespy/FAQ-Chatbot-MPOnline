import json
from typing import Any, cast

import numpy as np
from fastapi import HTTPException, status
from openai import OpenAI

from app.config import Settings, get_settings

try:
    from google import genai
    from google.genai import types as genai_types
except ImportError:  # pragma: no cover
    genai = None
    genai_types = None


class AIService:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.provider = self.settings.llm_provider.lower()
        self.openai_client: OpenAI | None = None
        self.gemini_client: Any | None = None

        if self.provider == "openai":
            if not self.settings.openai_api_key:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="OPENAI_API_KEY is not configured",
                )
            self.openai_client = OpenAI(api_key=self.settings.openai_api_key)
        elif self.provider == "gemini":
            if genai is None or genai_types is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="google-genai is not installed",
                )
            if not self.settings.gemini_api_key:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="GEMINI_API_KEY is not configured",
                )
            self.gemini_client = genai.Client(api_key=self.settings.gemini_api_key)
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Unsupported llm_provider: {self.provider}",
            )

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        if self.provider == "openai":
            client = self._openai_client()
            response = client.embeddings.create(
                model=self.settings.openai_embedding_model,
                input=texts,
            )
            return [item.embedding for item in response.data]

        client = self._gemini_client()
        embeddings: list[list[float]] = []
        for text in texts:
            result = client.models.embed_content(
                model=self.settings.gemini_embedding_model,
                contents=text,
                config=self._gemini_embed_config("RETRIEVAL_DOCUMENT"),
            )
            embeddings.append(list(result.embeddings[0].values))
        return embeddings

    def embed_query(self, text: str) -> list[float]:
        if self.provider == "openai":
            client = self._openai_client()
            response = client.embeddings.create(
                model=self.settings.openai_embedding_model,
                input=[text],
            )
            return response.data[0].embedding

        client = self._gemini_client()
        result = client.models.embed_content(
            model=self.settings.gemini_embedding_model,
            contents=text,
            config=self._gemini_embed_config("RETRIEVAL_QUERY"),
        )
        return list(result.embeddings[0].values)

    def generate_grounded_answer(
        self,
        question: str,
        context_chunks: list[dict[str, Any]],
        language: str = "en",
    ) -> dict[str, Any]:
        context_text = "\n\n".join(
            [
                f"[Source: {item['document_name']} | Chunk {item['chunk_index']}] {item['text']}"
                for item in context_chunks
            ]
        )[: self.settings.max_context_characters]

        if not context_text.strip():
            return {
                "answer": "I don't know",
                "grounded": False,
                "confidence": 0.0,
                "sources": [],
            }

        prompt = f"""
You are a FAQ assistant for MPOnline services.
Answer ONLY from the provided context.
If the context is insufficient, respond with "I don't know".
Do not invent policies, prices, deadlines, URLs, or procedures.
Return valid JSON with keys: answer, grounded, confidence, sources.
confidence must be a number between 0 and 1.
sources must be a JSON array of source document names used.
Answer language: {"Hindi" if language == "hi" else "English"}.
The `answer` value may use clean Markdown for readability.
When the answer contains multiple items or sections, format it with short headings, bullet points,
numbered steps, and bold labels where helpful.
You may use light, relevant emojis sparingly, but only if they improve readability.
Do not use Markdown tables.
Keep the answer grounded strictly in the context.

Question:
{question}

Context:
{context_text}
"""

        if self.provider == "openai":
            client = self._openai_client()
            response = client.chat.completions.create(
                model=self.settings.openai_chat_model,
                temperature=0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": "You are a precise grounded assistant."},
                    {"role": "user", "content": prompt},
                ],
            )
            raw_output = response.choices[0].message.content or "{}"
        else:
            client = self._gemini_client()
            response = client.models.generate_content(
                model=self.settings.gemini_chat_model,
                contents=prompt,
                config=self._gemini_generate_config(),
            )
            raw_output = self._strip_code_fences(getattr(response, "text", "{}"))

        return self._parse_answer_payload(raw_output)

    def _openai_client(self) -> OpenAI:
        if self.openai_client is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="OpenAI client is not initialized",
            )
        return self.openai_client

    def _gemini_client(self) -> Any:
        if self.gemini_client is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Gemini client is not initialized",
            )
        return self.gemini_client

    @staticmethod
    def _gemini_embed_config(task_type: str) -> Any:
        types_module = cast(Any, genai_types)
        return types_module.EmbedContentConfig(task_type=task_type)

    @staticmethod
    def _gemini_generate_config() -> Any:
        types_module = cast(Any, genai_types)
        return types_module.GenerateContentConfig(
                    temperature=0,
                    response_mime_type="application/json",
        )

    @staticmethod
    def _parse_answer_payload(raw_output: str) -> dict[str, Any]:
        try:
            data = json.loads(raw_output)
        except json.JSONDecodeError:
            data = {
                "answer": "I don't know",
                "grounded": False,
                "confidence": 0.0,
                "sources": [],
            }

        answer = str(data.get("answer", "I don't know")).strip() or "I don't know"
        grounded = bool(data.get("grounded", False)) and answer.lower() != "i don't know"
        confidence = float(data.get("confidence", 0.0))
        confidence = float(np.clip(confidence, 0.0, 1.0))
        sources = [
            source
            for source in data.get("sources", [])
            if isinstance(source, str) and source.strip()
        ]
        return {
            "answer": answer,
            "grounded": grounded,
            "confidence": confidence,
            "sources": sources,
        }

    @staticmethod
    def _strip_code_fences(text: str) -> str:
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            cleaned = cleaned.removeprefix("json").strip()
        return cleaned
