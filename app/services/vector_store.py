import json
from pathlib import Path

import faiss
import numpy as np

from app.config import get_settings


class FAISSVectorStore:
    def __init__(self) -> None:
        settings = get_settings()
        self.index_path = Path(settings.vector_store_path)
        self.metadata_path = Path(settings.vector_metadata_path)
        self.index: faiss.Index | None = None
        self.metadata: list[dict] = []
        self.dimension: int | None = None
        self._load()

    def _load(self) -> None:
        if self.metadata_path.exists():
            self.metadata = json.loads(self.metadata_path.read_text(encoding="utf-8"))
        else:
            self.metadata = []

        if self.index_path.exists():
            self.index = faiss.read_index(str(self.index_path))
            self.dimension = self.index.d

    def _save(self) -> None:
        if self.index is not None:
            faiss.write_index(self.index, str(self.index_path))
        self.metadata_path.write_text(
            json.dumps(self.metadata, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _ensure_index(self, dimension: int) -> None:
        if self.index is None:
            self.index = faiss.IndexFlatIP(dimension)
            self.dimension = dimension
        elif self.dimension != dimension:
            raise ValueError("Embedding dimension mismatch with existing FAISS index")

    def add_embeddings(self, embeddings: list[list[float]], metadata: list[dict]) -> None:
        if not embeddings:
            return

        vectors = np.array(embeddings, dtype="float32")
        faiss.normalize_L2(vectors)
        self._ensure_index(vectors.shape[1])
        self.index.add(vectors)
        self.metadata.extend(metadata)
        self._save()

    def search(self, query_embedding: list[float], top_k: int) -> list[dict]:
        if self.index is None or self.index.ntotal == 0:
            return []

        query = np.array([query_embedding], dtype="float32")
        faiss.normalize_L2(query)
        scores, indices = self.index.search(query, top_k)

        results: list[dict] = []
        for score, index in zip(scores[0], indices[0], strict=False):
            if index < 0 or index >= len(self.metadata):
                continue
            item = dict(self.metadata[index])
            item["score"] = float(score)
            results.append(item)
        return results


vector_store = FAISSVectorStore()
