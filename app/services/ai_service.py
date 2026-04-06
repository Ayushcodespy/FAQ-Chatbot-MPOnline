import json
from typing import Any

import numpy as np
from fastapi import HTTPException, status
from openai import OpenAI

from app.config import Settings, get_settings

try:
    import google.generativeai as genai
except ImportError:  # pragma: no cover
    genai = None


class AIService:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.provider = self.settings.llm_provider.lower()

        if self.provider == "openai":
            if not self.settings.openai_api_key:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="OPENAI_API_KEY is not configured",
                )
            self.client = OpenAI(api_key=self.settings.openai_api_key)
        elif self.provider == "gemini":
            if genai is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="google-generativeai is not installed",
                )
            if not self.settings.gemini_api_key:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="GEMINI_API_KEY is not configured",
                )
            genai.configure(api_key=self.settings.gemini_api_key)
            self.client = genai
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Unsupported llm_provider: {self.provider}",
            )

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        if self.provider == "openai":
            response = self.client.embeddings.create(
                model=self.settings.openai_embedding_model,
                input=texts,
            )
            return [item.embedding for item in response.data]

        embeddings: list[list[float]] = []
        for text in texts:
            result = self.client.embed_content(
                model=self.settings.gemini_embedding_model,
                content=text,
                task_type="retrieval_document",
            )
            embeddings.append(result["embedding"])
        return embeddings

    def embed_query(self, text: str) -> list[float]:
        if self.provider == "openai":
            response = self.client.embeddings.create(
                model=self.settings.openai_embedding_model,
                input=[text],
            )
            return response.data[0].embedding

        result = self.client.embed_content(
            model=self.settings.gemini_embedding_model,
            content=text,
            task_type="retrieval_query",
        )
        return result["embedding"]

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
            response = self.client.chat.completions.create(
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
            model = self.client.GenerativeModel(self.settings.gemini_chat_model)
            response = model.generate_content(prompt)
            raw_output = self._strip_code_fences(getattr(response, "text", "{}"))

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
