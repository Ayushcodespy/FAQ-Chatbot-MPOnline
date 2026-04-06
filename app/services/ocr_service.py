from pathlib import Path

import fitz
import pytesseract
from PIL import Image

from app.config import get_settings
from app.utils.chunking import clean_text


def configure_tesseract() -> None:
    settings = get_settings()
    if settings.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd


def extract_text_from_image(file_path: str) -> str:
    configure_tesseract()
    image = Image.open(file_path)
    text = pytesseract.image_to_string(image, lang="eng+hin")
    return clean_text(text)


def extract_text_from_pdf(file_path: str) -> str:
    configure_tesseract()
    document = fitz.open(file_path)
    pages: list[str] = []

    for page in document:
        page_text = clean_text(page.get_text("text"))
        if len(page_text) >= 60:
            pages.append(page_text)
            continue

        pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        temp_image_path = Path(file_path).with_suffix(f".page-{page.number}.png")
        pixmap.save(temp_image_path.as_posix())
        try:
            pages.append(extract_text_from_image(str(temp_image_path)))
        finally:
            temp_image_path.unlink(missing_ok=True)

    return clean_text(" ".join(pages))


def extract_text(file_path: str) -> str:
    suffix = Path(file_path).suffix.lower()
    if suffix == ".pdf":
        return extract_text_from_pdf(file_path)
    return extract_text_from_image(file_path)

