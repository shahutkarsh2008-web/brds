import pymupdf as fitz
from pathlib import Path
import re, json

def build_uceed_2021_paper():
    paper_path = Path("UCEED2021_Question_Paper.pdf")
    if not paper_path.exists():
        print("UCEED2021_Question_Paper.pdf not found")
        return

    doc = fitz.open(paper_path)

    # Key Data
    nat_keys = {
        1: {"min": 4900, "max": 4900},
        2: {"min": 21, "max": 21},
        3: {"min": 16, "max": 16},
        4: {"min": 35, "max": 35},
        5: {"min": 6.28, "max": 6.28},
        6: {"min": 233, "max": 233},
        7: {"min": 9, "max": 9},
        8: {"min": 6, "max": 6},
        9: {"min": 7, "max": 7},
        10: {"min": 21, "max": 21},
        11: {"min": 48, "max": 48},
        12: {"min": 13, "max": 13},
        13: {"min": 2044, "max": 2044},
        14: {"min": 15.00, "max": 16.50},
        15: {"min": 24, "max": 49, "values": [24, 49]},
        16: {"min": 600, "max": 600},
        17: {"min": 40, "max": 40},
        18: {"min": 2, "max": 2}
    }

    msq_keys = {
        19: ["a", "d"], 20: ["a", "b", "c", "d"], 21: ["c", "d"], 22: ["a", "b"],
        23: ["b", "c", "d"], 24: ["a", "b", "d"], 25: ["a", "b"], 26: ["b", "c"],
        27: ["b", "c"], 28: ["c"], 29: ["b", "c", "d"], 30: ["a", "b", "c", "d"],
        31: ["b", "d"], 32: ["a", "c"], 33: ["c", "d"], 34: ["b", "c"],
        35: ["a", "c"], 36: ["b", "c", "d"]
    }

    mcq_keys = {
        37: "c", 38: "d", 39: "c", 40: "b", 41: "b", 42: "c", 43: "c", 44: "c",
        45: "c", 46: "a", 47: "d", 48: "b", 49: "b", 50: "d", 51: "a", 52: "d",
        53: "c", 54: "c", 55: "a", 56: "c", 57: "b", 58: "b", 59: "c", 60: "d",
        61: "a", 62: "a", 63: "c", 64: "d", 65: "b", 66: "d", 67: "c", 68: "b"
    }

    questions = []
    manifest = []
    media_dir = Path("public/media")
    media_dir.mkdir(parents=True, exist_ok=True)
    sub_dir = media_dir / "uceed-2021"
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

            texts = [l[1] for l in region if not l[1].startswith(("UCEED 2021", "Page "))]
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

                name = f"uceed-2021-{q_id}.png"
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
                "topic": "Design Aptitude & Spatial Reasoning",
                "difficulty": "Medium",
                "tags": ["uceed-2021", q_type.lower()],
                "marks": marks
            }

            if img_rel:
                q_obj["image"] = img_rel
                q_obj["imageAlt"] = f"UCEED 2021 Question {n} Diagram"

            if q_type == "NAT":
                q_obj["answer"] = nat_keys[n]
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
        "id": "uceed-2021",
        "title": "UCEED 2021 Official Paper",
        "durationSeconds": 7200,
        "totalQuestions": len(unique_questions),
        "maxMarks": max_marks,
        "instructions": "Official UCEED 2021 Question Paper & Final Answer Key (Part A: 68 questions, 240 marks, 120 minutes). Section 1 NAT: Q1–18 (+4/0). Section 2 MSQ: Q19–36 (+4/-1 with partial credit). Section 3 MCQ: Q37–68 (+3/-0.71).",
        "sections": [
            {"id": "nat", "title": "Section 1 · NAT (72 marks)"},
            {"id": "msq", "title": "Section 2 · MSQ (72 marks)"},
            {"id": "mcq", "title": "Section 3 · MCQ (96 marks)"}
        ],
        "questions": unique_questions
    }

    out_file = Path("fixtures/uceed-2021.json")
    out_file.write_text(json.dumps(exam_obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"SUCCESS: Generated {out_file} ({out_file.stat().st_size} bytes) with {len(unique_questions)} questions, {max_marks} max marks")

if __name__ == "__main__":
    build_uceed_2021_paper()
