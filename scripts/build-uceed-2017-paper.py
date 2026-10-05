import pymupdf as fitz
from pathlib import Path
import re, json

def build_uceed_2017_paper():
    paper_path = Path("UCEED2017_Question_Paper.pdf")
    if not paper_path.exists():
        print("Error: UCEED2017_Question_Paper.pdf not found")
        return

    doc = fitz.open(paper_path)

    # Key Data extracted from official UCEED 2017 Final Answer Key
    nat_keys = {
        1: (12, 12), 2: (25, 25), 3: (7, 7), 4: (28, 28),
        5: (11, 11), 6: (7669, 7669), 7: (1.5, 1.5), 8: (11, 11),
        9: (8, 8), 10: (8, 8), 11: (17, 17), 12: (10, 10),
        13: (10, 10), 14: (3, 3), 15: (0.7, 0.72), 16: (0.7, 0.71),
        17: (36, 36), 18: (55, 55), 19: (15, 15), 20: (10, 10)
    }

    msq_keys = {
        21: ["a", "c"], 22: ["b", "c", "d"], 23: ["b", "d"], 24: ["c", "d"],
        25: ["b", "d"], 26: ["a", "b"], 27: ["a", "b", "c", "d"], 28: ["a", "b", "d"],
        29: ["a", "b", "c", "d"], 30: ["c", "d"], 31: ["a", "b", "c"], 32: ["b", "c"],
        33: ["a", "c", "d"], 34: ["a", "b"], 35: ["a", "c", "d"], 36: ["a", "c", "d"],
        37: ["b", "c", "d"], 38: ["a", "d"], 39: ["b", "d"], 40: ["a", "c"],
        41: ["c", "d"], 42: ["a", "c", "d"], 43: ["a", "c", "d"], 44: ["b", "c"],
        45: ["a", "c"]
    }

    mcq_keys = {
        46: "d", 47: "a", 48: "a", 49: "b", 50: "d", 51: "c", 52: "a", 53: "b",
        54: "b", 55: "a", 56: "b", 57: "a", 58: "b", 59: "b", 60: "d", 61: "d",
        62: "b", 63: "c", 64: "b", 65: "a", 66: "c", 67: "d", 68: "a", 69: "b",
        70: "c", 71: "d", 72: "c", 73: "b", 74: "c", 75: "a", 76: "b", 77: "a",
        78: "c", 79: "b", 80: "d", 81: "c", 82: "c", 83: "d", 84: "c", 85: "c"
    }

    questions = []
    manifest = []
    media_dir = Path("public/media")
    media_dir.mkdir(parents=True, exist_ok=True)
    sub_dir = media_dir / "uceed-2017"
    sub_dir.mkdir(parents=True, exist_ok=True)

    # Process PDF pages starting from question paper pages (skip page 1-3 intro if needed)
    for pn in range(len(doc)):
        if pn < 2:  # Skip cover and numbered paper-specific instructions.
            continue
        page = doc[pn]
        blocks = page.get_text("dict")["blocks"]
        lines = []
        for b in blocks:
            if b.get("type") != 0: continue
            for l in b["lines"]:
                text = "".join(s["text"] for s in l["spans"]).strip()
                if text and l["bbox"][1] < 780:
                    lines.append((l["bbox"][1], text, l["bbox"]))

        lines.sort(key=lambda l: (round(l[0], 1), l[2][0]))

        # Find question boundaries like "1. ", "2. ", ..., "85. "
        starts = []
        for i, l in enumerate(lines):
            m = re.match(r"^(\d{1,2})\.\s+(.*)", l[1])
            if m:
                n = int(m.group(1))
                if 1 <= n <= 85:
                    starts.append((i, n))

        for j, (start, n) in enumerate(starts):
            stop = starts[j+1][0] if j+1 < len(starts) else len(lines)
            region = lines[start:stop]
            boundary = lines[stop][0] if stop < len(lines) else 780

            texts = [l[1] for l in region if not l[1].startswith(("UCEED 2017", "Page "))]
            if texts:
                texts[0] = re.sub(r"^\d{1,2}\.\s*", "", texts[0])

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
            q_type = "NAT" if n <= 20 else "MSQ" if n <= 45 else "MCQ"
            sec_id = "nat" if n <= 20 else "msq" if n <= 45 else "mcq"

            # Check for images in this question region on the page
            img_infos = page.get_image_info()
            region_y0 = region[0][0] if region else 0
            images = [fitz.Rect(x["bbox"]) for x in img_infos if x["bbox"][1] >= region_y0 - 5 and x["bbox"][3] <= boundary + 5 and fitz.Rect(x["bbox"]).get_area() > 1500]

            img_rel = None
            if images:
                rect = fitz.Rect(images[0])
                for r in images[1:]: rect = rect | r
                rect = fitz.Rect(max(0, rect.x0 - 4), max(0, rect.y0 - 4), min(page.rect.width, rect.x1 + 4), min(page.rect.height, rect.y1 + 4))

                name = f"uceed-2017-{q_id}.png"
                page.get_pixmap(matrix=fitz.Matrix(2.2, 2.2), clip=rect, alpha=False).save(sub_dir / f"{q_id}.png")
                page.get_pixmap(matrix=fitz.Matrix(2.2, 2.2), clip=rect, alpha=False).save(media_dir / name)
                img_rel = f"/media/{name}"
                manifest.append(n)

            # Define marks
            # NAT: +4/0, MSQ: +4/0 (with partial credit), MCQ: +3/-1
            if n <= 20:
                marks = {"correct": 4, "incorrect": 0, "unanswered": 0}
            elif n <= 45:
                marks = {"correct": 4, "incorrect": 0, "unanswered": 0}
            else:
                marks = {"correct": 3, "incorrect": -1, "unanswered": 0}

            q_obj = {
                "id": q_id,
                "sectionId": sec_id,
                "type": q_type,
                "prompt": " ".join(prompt).replace("•", "•").strip() or f"Question {n}",
                "topic": "Design Aptitude & Visual Observation",
                "difficulty": "Medium",
                "tags": ["uceed-2017", q_type.lower()],
                "marks": marks
            }

            if img_rel:
                q_obj["image"] = img_rel
                q_obj["imageAlt"] = f"UCEED 2017 Question {n} Diagram"

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
                    if n == 42:
                        q_obj["answerAlternatives"] = [["a", "c"]]

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

    # Verify all 85 questions are extracted
    existing_ids = {q["id"] for q in unique_questions}
    missing_ids = [f"q{n:02d}" for n in range(1, 86) if f"q{n:02d}" not in existing_ids]

    if missing_ids:
        print(f"Missing question IDs: {missing_ids}")

    # Calculate total marks sum
    max_marks = sum(q["marks"]["correct"] for q in unique_questions)

    exam_obj = {
        "id": "uceed-2017",
        "title": "UCEED 2017 Official Paper",
        "durationSeconds": 7200,
        "totalQuestions": len(unique_questions),
        "maxMarks": max_marks,
        "instructions": "Official UCEED 2017 Question Paper & Final Answer Key (Part A: 85 questions, 300 marks, 120 minutes). Section 1 NAT: Q1–20 (+4/0). Section 2 MSQ: Q21–45 (+4/0 with partial credit). Section 3 MCQ: Q46–85 (+3/-1).",
        "sections": [
            {"id": "nat", "title": "Section 1 · NAT (80 marks)"},
            {"id": "msq", "title": "Section 2 · MSQ (100 marks)"},
            {"id": "mcq", "title": "Section 3 · MCQ (120 marks)"}
        ],
        "questions": unique_questions
    }

    out_file = Path("fixtures/uceed-2017.json")
    out_file.write_text(json.dumps(exam_obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"SUCCESS: Generated {out_file} ({out_file.stat().st_size} bytes) with {len(unique_questions)} questions, {max_marks} max marks")

if __name__ == "__main__":
    build_uceed_2017_paper()
