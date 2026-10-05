import pymupdf as fitz
from pathlib import Path
import re, json

def build_uceed_2022_paper():
    paper_path = Path("UCEED2022_Question_Paper.pdf")
    if not paper_path.exists():
        print("UCEED2022_Question_Paper.pdf not found")
        return

    doc = fitz.open(paper_path)

    # Key Data
    nat_keys = {
        1: (14, 14), 2: (32, 32), 3: (836975, 836975), 4: (742198653, 742198653),
        5: (24, 24), 6: (7, 7), 7: (153.5, 154.5), 8: (0.25, 0.25),
        9: (80, 80), 10: (5724361, 5724361), 11: (50, 50), 12: (43, 43),
        13: (10, 10), 14: (18, 18), 15: (60, 60), 16: (75, 75),
        17: (30, 30), 18: (15, 15)
    }

    msq_keys = {
        19: ["a", "d"], 20: ["a", "d"], 21: ["c", "d"], 22: ["a", "b", "d"],
        23: ["a", "c", "d"], 24: ["a", "d"], 25: ["a", "d"], 26: ["b", "c", "d"],
        27: ["b", "d"], 28: ["a", "b"], 29: ["a", "c"], 30: ["b", "d"],
        31: ["a", "b"], 32: ["a", "c", "d"], 33: ["a", "d"], 34: ["a", "d"],
        35: ["a", "b"], 36: ["a", "c"]
    }

    mcq_keys = {
        37: "a", 38: "b", 39: "d", 40: "d", 41: "d", 42: "c", 43: "a", 44: "c",
        45: "a", 46: "d", 47: "c", 48: "c", 49: "d", 50: "a", 51: "a", 52: "a",
        53: "b", 54: "a", 55: "c", 56: "b", 57: "d", 58: "a", 59: "a", 60: "c",
        61: "b", 62: "c", 63: "a", 64: "b", 65: "b", 66: "b", 67: "d", 68: "b"
    }

    questions = []
    manifest = []
    media_dir = Path("public/media")
    media_dir.mkdir(parents=True, exist_ok=True)
    sub_dir = media_dir / "uceed-2022"
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

            texts = [l[1] for l in region if not l[1].startswith(("UCEED 2022", "Page "))]
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

                name = f"uceed-2022-{q_id}.png"
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
                "topic": "Design Aptitude & Visual Reasoning",
                "difficulty": "Medium",
                "tags": ["uceed-2022", q_type.lower()],
                "marks": marks
            }

            if img_rel:
                q_obj["image"] = img_rel
                q_obj["imageAlt"] = f"UCEED 2022 Question {n} Diagram"

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
        "id": "uceed-2022",
        "title": "UCEED 2022 Official Paper",
        "durationSeconds": 7200,
        "totalQuestions": len(unique_questions),
        "maxMarks": max_marks,
        "instructions": "Official UCEED 2022 Question Paper & Final Answer Key (Part A: 68 questions, 240 marks, 120 minutes). Section 1 NAT: Q1–18 (+4/0). Section 2 MSQ: Q19–36 (+4/-1 with partial credit). Section 3 MCQ: Q37–68 (+3/-0.71).",
        "sections": [
            {"id": "nat", "title": "Section 1 · NAT (72 marks)"},
            {"id": "msq", "title": "Section 2 · MSQ (72 marks)"},
            {"id": "mcq", "title": "Section 3 · MCQ (96 marks)"}
        ],
        "questions": unique_questions
    }

    out_file = Path("fixtures/uceed-2022.json")
    out_file.write_text(json.dumps(exam_obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"SUCCESS: Generated {out_file} ({out_file.stat().st_size} bytes) with {len(unique_questions)} questions, {max_marks} max marks")

if __name__ == "__main__":
    build_uceed_2022_paper()
