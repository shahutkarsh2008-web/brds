import pymupdf as fitz
from pathlib import Path

def inspect_uceed_2019_pdf():
    key_path = Path("UCEED2019_Answer_Key.pdf")
    key_doc = fitz.open(key_path)

    print(f"Key pages count: {len(key_doc)}")
    for i, page in enumerate(key_doc):
        print(f"--- Page {i+1} ---")
        text = page.get_text()
        print(f"Length: {len(text)}")
        if text.strip():
            print(text[:500])
        else:
            print("No text found directly, checking text blocks/images...")
            blocks = page.get_text("blocks")
            print("Blocks:", blocks)
            images = page.get_images()
            print("Images:", len(images))

if __name__ == "__main__":
    inspect_uceed_2019_pdf()
