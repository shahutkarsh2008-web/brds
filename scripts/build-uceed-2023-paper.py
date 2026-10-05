import pymupdf as fitz
from pathlib import Path
import re, json

def build_uceed_2023_paper():
    paper_path = Path("UCEED_2023_Question_Paper.pdf")
    if not paper_path.exists():
        print("UCEED_2023_Question_Paper.pdf not found")
        return

    doc = fitz.open(paper_path)

    # Key Data
    nat_keys = {
        1: (4, 4),
        2: (132.8, 133.1),
        3: (6, 6),
        4: (5, 5),
        5: (27, 27),
        6: (30, 30),
        7: (6, 6),
        8: (46, 46),
        9: (9, 9),
        10: (11, 11),
        11: (81, 81),
        12: (20.5, 21.5),
        13: (5.9, 6.1),
        14: (20, 20),
        15: (0.17, 0.19),
        16: (23, 23),
        17: (21, 21),
        18: (10, 10)
    }

    msq_keys = {
        19: ["a", "b", "c"], 20: ["a", "d"], 21: ["a", "d"], 22: ["a", "b", "d"],
        23: ["a", "c"], 24: ["a", "b", "c"], 25: ["a", "d"], 26: ["b", "c", "d"],
        27: ["a", "b", "d"], 28: ["a", "b", "d"], 29: ["a", "c"], 30: ["a", "d"],
        31: ["b", "c", "d"], 32: ["c", "d"], 33: ["b", "c"], 34: ["a", "b"],
        35: ["b", "c"], 36: ["c", "d"]
    }

    mcq_keys = {
        37: "c", 38: "b", 39: "a", 40: "c", 41: "c", 42: "d", 43: "b", 44: "a",
        45: "b", 46: "b", 47: "d", 48: "d", 49: "d", 50: "c", 51: "b", 52: "b",
        53: "b", 54: "b", 55: "c", 56: "c", 57: "d", 58: "c", 59: "d", 60: "d",
        61: "b", 62: "a", 63: "c", 64: "b", 65: "c", 66: "a", 67: "c", 68: "a"
    }

    questions = []
    manifest = []
    media_dir = Path("public/media")
    media_dir.mkdir(parents=True, exist_ok=True)
    sub_dir = media_dir / "uceed-2023"
    sub_dir.mkdir(parents=True, exist_ok=True)

    # Process PDF pages up to Part A (end of MCQ)
    for pn, page in enumerate(doc): # Part A pages
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

            texts = [l[1] for l in region if not l[1].startswith(("UCEED 2023", "Page "))]
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

                name = f"uceed-2023-{q_id}.png"
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
                "topic": "Design Aptitude & Reasoning",
                "difficulty": "Medium",
                "tags": ["uceed-2023", q_type.lower()],
                "marks": marks
            }

            if img_rel:
                q_obj["image"] = img_rel
                q_obj["imageAlt"] = f"UCEED 2023 Question {n} Diagram"

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

    # Sort questions by ID
    questions.sort(key=lambda q: int(q["id"].replace("q", "")))
    print(f"Extracted {len(questions)} questions (Images: {len(manifest)})")

    # Verify all 68 questions are extracted
    existing_ids = {q["id"] for q in questions}
    missing_ids = [f"q{n:02d}" for n in range(1, 69) if f"q{n:02d}" not in existing_ids]

    if missing_ids:
        print(f"Missing question IDs: {missing_ids}")

    # Deduplicate questions if any duplicate page hits
    unique_questions = []
    seen = set()
    for q in questions:
        if q["id"] not in seen:
            seen.add(q["id"])
            unique_questions.append(q)

    # Calculate total marks sum
    max_marks = sum(q["marks"]["correct"] for q in unique_questions)

    exam_obj = {
        "id": "uceed-2023",
        "title": "UCEED 2023",
        "durationSeconds": 7200,
        "totalQuestions": len(unique_questions),
        "maxMarks": max_marks,
        "instructions": "Official UCEED 2023 Question Paper & Final Answer Key (Part A: 68 questions, 240 marks, 120 minutes). Section 1 NAT: Q1–18 (+4/0). Section 2 MSQ: Q19–36 (+4/-1 with partial credit). Section 3 MCQ: Q37–68 (+3/-0.71).",
        "sections": [
            {"id": "nat", "title": "Section 1 · NAT (72 marks)"},
            {"id": "msq", "title": "Section 2 · MSQ (72 marks)"},
            {"id": "mcq", "title": "Section 3 · MCQ (96 marks)"}
        ],
        "questions": unique_questions
    }

    out_file = Path("fixtures/uceed-2023.json")
    out_file.write_text(json.dumps(exam_obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"SUCCESS: Generated {out_file} ({out_file.stat().st_size} bytes) with {len(unique_questions)} questions, {max_marks} max marks")

if __name__ == "__main__":
    build_uceed_2023_paper()
