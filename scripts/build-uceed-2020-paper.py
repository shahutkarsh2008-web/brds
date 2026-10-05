import pymupdf as fitz
from pathlib import Path
import re, json

def build_uceed_2020_paper():
    paper_path = Path("UCEED2020_Question_Paper.pdf")
    if not paper_path.exists():
        print("UCEED2020_Question_Paper.pdf not found")
        return

    doc = fitz.open(paper_path)

    # Key Data
    nat_keys = {
        1: (1020, 1020), 2: (33, 33), 3: (27, 27), 4: (21, 21),
        5: (140, 140), 6: (16, 16), 7: (9, 9), 8: (10, 10),
        9: (8, 8), 10: (17, 17), 11: (3, 3), 12: (16, 16),
        13: (365, 365), 14: (4, 4), 15: (2, 2), 16: (7, 7),
        17: (44, 44), 18: (2, 2)
    }

    msq_keys = {
        19: ["a", "c"], 20: ["b"], 21: ["a", "c", "d"], 22: ["c", "d"],
        23: ["a", "c"], 24: ["b", "c", "d"], 25: ["b", "d"], 26: ["b", "d"],
        27: ["c", "d"], 28: ["a", "b", "c"], 29: ["d"], 30: ["b", "d"],
        31: ["a", "b", "c"], 32: ["c", "d"], 33: ["a", "b", "c"], 34: ["a", "b", "d"],
        35: ["b", "d"], 36: ["a", "b", "c", "d"] # Full marks
    }

    mcq_keys = {
        37: "a", 38: "c", 39: "d", 40: "b", 41: "a", 42: "c", 43: "a", 44: "c",
        45: "b", 46: "d", 47: "c", 48: "b", 49: "c", 50: "b", 51: "d", 52: "c",
        53: "c", 54: "b", 55: "d", 56: "a", 57: "d", 58: "d", 59: "b", 60: "b",
        61: "c", 62: "a", 63: "a", 64: "a", 65: "a", 66: "b", 67: "c", 68: "a"
    }

    questions = []
    manifest = []
    media_dir = Path("public/media")
    media_dir.mkdir(parents=True, exist_ok=True)
    sub_dir = media_dir / "uceed-2020"
    sub_dir.mkdir(parents=True, exist_ok=True)

    # Process PDF pages up to Part A (end of MCQ)
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
            if n > 68: continue
            stop = starts[j+1][0] if j+1 < len(starts) else len(lines)
            region = lines[start:stop]
            boundary = lines[stop][0] if stop < len(lines) else 780

            texts = [l[1] for l in region if not l[1].startswith(("UCEED 2020", "Page "))]
            if texts:
                texts[0] = re.sub(r"^Q\.\s*\d+\.?\s*", "", texts[0])

            prompt = []
            options = []
            current = None

            for line in texts:
                m = re.match(r"^([ABCD])\.\s*(.*)", line)
                if m:
                    current = {"id": m[1].lower(), "text": m[2]}
                    options.append(current)
                elif current:
                    current["text"] += " " + line
                else:
                    prompt.append(line)

            q_id = f"q{n:02d}"
            q_type = "NAT" if n <= 18 else "MSQ" if n <= 36 else "MCQ"
            sec_id = "nat" if n <= 18 else "msq" if n <= 36 else "mcq"

            # Check for images in this question region on the page
            img_infos = page.get_image_info()
            region_y0 = region[0][0] if region else 0
            images = [fitz.Rect(x["bbox"]) for x in img_infos if x["bbox"][1] >= region_y0 - 5 and x["bbox"][3] <= boundary + 5 and fitz.Rect(x["bbox"]).get_area() > 1500]

            img_rel = None
            if images:
                rect = fitz.Rect(images[0])
                for r in images[1:]: rect = rect | r
                rect = fitz.Rect(max(0, rect.x0 - 4), max(0, rect.y0 - 4), min(page.rect.width, rect.x1 + 4), min(page.rect.height, rect.y1 + 4))

                name = f"uceed-2020-{q_id}.png"
                page.get_pixmap(matrix=fitz.Matrix(2.2, 2.2), clip=rect, alpha=False).save(sub_dir / f"{q_id}.png")
                page.get_pixmap(matrix=fitz.Matrix(2.2, 2.2), clip=rect, alpha=False).save(media_dir / name)
                img_rel = f"/media/{name}"
                manifest.append(n)

            # Define question object
            marks = {"correct": 4 if n <= 36 else 3, "incorrect": 0 if n <= 18 else -1 if n <= 36 else -0.71, "unanswered": 0}

            q_obj = {
                "id": q_id,
                "sectionId": sec_id,
                "type": q_type,
                "prompt": " ".join(prompt).replace("", "•").strip() or f"Question {n}",
                "topic": "Design Aptitude & Visual Observation",
                "difficulty": "Medium",
                "tags": ["uceed-2020", q_type.lower()],
                "marks": marks
            }

            if img_rel:
                q_obj["image"] = img_rel
                q_obj["imageAlt"] = f"UCEED 2020 Question {n} Diagram"

            if q_type == "NAT":
                lo, hi = nat_keys[n]
                q_obj["answer"] = {"min": lo, "max": hi}
            else:
                q_obj["options"] = options or [{"id": c, "text": f"{c.upper()} — see diagram"} for c in "abcd"]
                if q_type == "MCQ":
                    q_obj["answer"] = mcq_keys[n]
                else: # MSQ
                    q_obj["answer"] = msq_keys[n]
                    q_obj["partialCredit"] = {"1": 1, "2": 2, "3": 3}

            questions.append(q_obj)

    # Deduplicate questions if any duplicate page hits
    unique_questions = []
    seen = set()
    for q in questions:
        if q["id"] not in seen:
            seen.add(q["id"])
            unique_questions.append(q)

    # Sort questions by ID
    unique_questions.sort(key=lambda q: int(q["id"].replace("q", "")))
    print(f"Extracted {len(unique_questions)} questions (Images: {len(manifest)})")

    # Verify all 68 questions are extracted
    existing_ids = {q["id"] for q in unique_questions}
    missing_ids = [f"q{n:02d}" for n in range(1, 69) if f"q{n:02d}" not in existing_ids]

    if missing_ids:
        print(f"Missing question IDs: {missing_ids}")

    # Calculate total marks sum
    max_marks = sum(q["marks"]["correct"] for q in unique_questions)

    exam_obj = {
        "id": "uceed-2020",
        "title": "UCEED 2020 Official Paper",
        "durationSeconds": 7200,
        "totalQuestions": len(unique_questions),
        "maxMarks": max_marks,
        "instructions": "Official UCEED 2020 Question Paper & Final Answer Key (Part A: 68 questions, 240 marks, 120 minutes). Section 1 NAT: Q1–18 (+4/0). Section 2 MSQ: Q19–36 (+4/-1 with partial credit). Section 3 MCQ: Q37–68 (+3/-0.71).",
        "sections": [
            {"id": "nat", "title": "Section 1 · NAT (72 marks)"},
            {"id": "msq", "title": "Section 2 · MSQ (72 marks)"},
            {"id": "mcq", "title": "Section 3 · MCQ (96 marks)"}
        ],
        "questions": unique_questions
    }

    out_file = Path("fixtures/uceed-2020.json")
    out_file.write_text(json.dumps(exam_obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"SUCCESS: Generated {out_file} ({out_file.stat().st_size} bytes) with {len(unique_questions)} questions, {max_marks} max marks")

if __name__ == "__main__":
    build_uceed_2020_paper()
