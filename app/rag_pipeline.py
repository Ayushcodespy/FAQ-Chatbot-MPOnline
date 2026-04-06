from app.services.ai_service import AIService
from app.services.vector_store import vector_store


class RAGPipeline:
    def __init__(self) -> None:
        self.ai_service = AIService()
        self.vector_store = vector_store

    def retrieve(self, question: str, top_k: int) -> list[dict]:
        query_embedding = self.ai_service.embed_query(question)
        return self.vector_store.search(query_embedding, top_k)

    def answer(self, question: str, language: str, top_k: int) -> dict:
        context = self.retrieve(question, top_k)
        return self.ai_service.generate_grounded_answer(question, context, language)
