import fitz # PyMuPDF
from pathlib import Path
import json, re

def inspect_uceed_2023_pdf():
    paper_path = Path("UCEED_2023_Question_Paper.pdf")
    key_path = Path("UCEED2023_Answer_Key.pdf")

    if not paper_path.exists() or not key_path.exists():
        print("PDF files not found")
        return

    doc = fitz.open(paper_path)
    key_doc = fitz.open(key_path)

    print(f"Paper pages: {len(doc)}")
    key_text = ""
    for page in key_doc:
        key_text += page.get_text() + "\n"

    print("--- Answer Key Text ---")
    print(key_text)

if __name__ == "__main__":
    inspect_uceed_2023_pdf()
