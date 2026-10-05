import pymupdf as fitz
from pathlib import Path
import re, json

def extract_uceed_2023():
    paper_path = Path("UCEED_2023_Question_Paper.pdf")
    key_path = Path("UCEED2023_Answer_Key.pdf")

    doc = fitz.open(paper_path)
    key_doc = fitz.open(key_path)

    key_text = ""
    for page in key_doc:
        key_text += page.get_text() + "\n"

    print("=== Key Text Preview ===")
    print(key_text[:1000])

    print("\nTotal paper pages:", len(doc))

if __name__ == "__main__":
    extract_uceed_2023()
