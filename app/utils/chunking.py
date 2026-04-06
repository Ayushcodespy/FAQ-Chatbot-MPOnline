import re


def clean_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def chunk_text(text: str, chunk_size_words: int, overlap_words: int) -> list[str]:
    normalized = clean_text(text)
    if not normalized:
        return []

    words = normalized.split(" ")
    chunks: list[str] = []
    start = 0

    while start < len(words):
        end = min(start + chunk_size_words, len(words))
        chunk = " ".join(words[start:end]).strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(words):
            break
        start = max(end - overlap_words, start + 1)

    return chunks

