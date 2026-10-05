import pymupdf as fitz
from pathlib import Path
import re

def crop_2019_pdf_images():
    paper_path = Path("UCEED2019_Question_Paper.pdf")
    if not paper_path.exists():
        print("PDF not found")
        return

    doc = fitz.open(paper_path)
    media_dir = Path("public/media")
    sub_dir = media_dir / "uceed-2019"
    sub_dir.mkdir(parents=True, exist_ok=True)

    cropped = 0
    for pn, page in enumerate(doc):
        blocks = page.get_text("dict")["blocks"]
        lines = []
        for b in blocks:
            if b.get("type") != 0: continue
            for l in b["lines"]:
                text = "".join(s["text"] for s in l["spans"]).strip()
                if text and l["bbox"][1] < 780:
                    lines.append((l["bbox"][1], text, l["bbox"]))

        lines.sort(key=lambda l: (round(l[0], 1), l[2][0]))
        starts = [(i, int(m.group(1))) for i, l in enumerate(lines) if (m := re.match(r"^Q\.\s*(\d+)\.?\s*", l[1]))]

        for j, (start, n) in enumerate(starts):
            stop = starts[j+1][0] if j+1 < len(starts) else len(lines)
            region = lines[start:stop]
            boundary = lines[stop][0] if stop < len(lines) else 780
            region_y0 = region[0][0] if region else 0

            img_infos = page.get_image_info()
            images = [fitz.Rect(x["bbox"]) for x in img_infos if x["bbox"][1] >= region_y0 - 5 and x["bbox"][3] <= boundary + 5 and fitz.Rect(x["bbox"]).get_area() > 1500]

            if images:
                rect = fitz.Rect(images[0])
                for r in images[1:]: rect = rect | r
                rect = fitz.Rect(max(0, rect.x0 - 4), max(0, rect.y0 - 4), min(page.rect.width, rect.x1 + 4), min(page.rect.height, rect.y1 + 4))

                q_id = f"q{n:02d}"
                out_name = f"uceed-2019-{q_id}.png"
                target_file = media_dir / out_name
                
                # If target file is missing or <= 100 bytes, write clean crop from PDF
                if not target_file.exists() or target_file.stat().st_size <= 100:
                    page.get_pixmap(matrix=fitz.Matrix(2.2, 2.2), clip=rect, alpha=False).save(sub_dir / f"{q_id}.png")
                    page.get_pixmap(matrix=fitz.Matrix(2.2, 2.2), clip=rect, alpha=False).save(target_file)
                    cropped += 1
                    print(f"Cropped clean diagram for Q{n} from PDF: {out_name}")

    print(f"Cropped {cropped} clean images directly from PDF.")

if __name__ == "__main__":
    crop_2019_pdf_images()
