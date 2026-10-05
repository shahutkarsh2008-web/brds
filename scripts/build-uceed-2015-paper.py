import pymupdf as fitz
from pathlib import Path
import re, json

def build_uceed_2015_paper():
    paper_path = Path("UCEED2015_Question_Paper.pdf")
    if not paper_path.exists():
        print("Error: UCEED2015_Question_Paper.pdf not found")
        return

    doc = fitz.open(paper_path)

    # Key Data extracted from official UCEED 2015 Final Answer Key
    # Section A (NAT): Q1-20 (+3 / -1)
    nat_keys = {
        1: (22, 22), 2: (8, 8), 3: (37, 37), 4: (14, 14), 5: (9, 9),
        6: (286, 286), 7: (7, 7), 8: (70, 70), 9: (7, 7), 10: (7, 7),
        11: (15, 15), 12: (35, 35), 13: (7, 7), 14: (4, 4), 15: (2823, 2823),
        16: (3, 3), 17: (5, 5), 18: (18, 18), 19: (158, 158), 20: (2, 2)
    }

    # Section B (MSQ): Q21-50 (+3 / 0, no partial credit)
    msq_keys = {
        21: ["a", "b", "d"], 22: ["a", "b", "c"], 23: ["a", "d"], 24: ["b", "c", "d"],
        25: ["a", "c", "d"], 26: ["b", "c"], 27: ["a", "b", "c"], 28: ["a", "b"],
        29: ["c", "d"], 30: ["d"], 31: ["a", "b", "d"], 32: ["a", "b", "d"],
        33: ["a", "b"], 34: ["a", "b", "c", "d"], 35: ["b", "d"], 36: ["a", "b", "d"],
        37: ["b", "c"], 38: ["a", "d"], 39: ["a", "c"], 40: ["a", "b", "d"],
        41: ["a", "c"], 42: ["a", "c"], 43: ["a", "b", "c"], 44: ["c", "d"],
        45: ["b", "d"], 46: ["d"], 47: ["b", "d"], 48: ["b", "d"], 49: ["c"], 50: ["b"]
    }

    # Section C (MCQ): Q51-100 (+3 / -1)
    mcq_keys = {
        51: "d", 52: "b", 53: "d", 54: "c", 55: "b", 56: "d", 57: "d", 58: "a",
        59: "a", 60: "c", 61: "c", 62: "b", 63: "b", 64: "b", 65: "c", 66: "a",
        67: "a", 68: "d", 69: "d", 70: "d", 71: "c", 72: "b", 73: "d", 74: "c",
        75: "d", 76: "b", 77: "b", 78: "b", 79: "a", 80: "c", 81: "d", 82: "a",
        83: "a", 84: "c", 85: "a", 86: "b", 87: "c", 88: "b", 89: "d", 90: "c",
        91: "b", 92: "d", 93: "a", 94: "a", 95: "a", 96: "a", 97: "a", 98: "b",
        99: "c", 100: "b"
    }

    mcq_alts = {
        67: ["b", "c", "d"], # Dropped question: full marks awarded to all
        78: ["c"]
    }

    # PyMuPDF may omit columns when option text is split across positioned spans.
    # Preserve missing choices verified against the official question paper.
    option_overrides = {
        37: {
            "c": "Q is unmarried.",
            "d": "If the Diplomat is married, then so is the Banker."
        },
        40: {
            "d": "It is good to differentiate between a novice user and an expert user by keeping track of the number of interactions that the user has with the device, and tailoring an audio experience for first-time users, while playing shortened prompts to expert users."
        }
    }

    questions = []
    manifest = []
    media_dir = Path("public/media")
    media_dir.mkdir(parents=True, exist_ok=True)
    sub_dir = media_dir / "uceed-2015"
    sub_dir.mkdir(parents=True, exist_ok=True)

    for pn in range(len(doc)):
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

        starts = []
        for i, l in enumerate(lines):
            m = re.match(r"^\s*(\d{1,3})\.\s*(.*)", l[1])
            if m:
                n = int(m.group(1))
                if 1 <= n <= 100:
                    starts.append((i, n))

        for j, (start, n) in enumerate(starts):
            stop = starts[j+1][0] if j+1 < len(starts) else len(lines)
            region = lines[start:stop]
            boundary = lines[stop][0] if stop < len(lines) else 780

            texts = [l[1] for l in region if not l[1].startswith(("UCEED 2015", "Page "))]
            if texts:
                texts[0] = re.sub(r"^\d{1,3}\.\s*", "", texts[0])

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
                    if line.strip():
                        prompt.append(line)

            existing_option_ids = {option["id"] for option in options}
            for option_id, option_text in option_overrides.get(n, {}).items():
                if option_id not in existing_option_ids:
                    options.append({"id": option_id, "text": option_text})
            options.sort(key=lambda option: option["id"])

            q_id = f"q{n:02d}" if n < 100 else "q100"
            q_type = "NAT" if n <= 20 else "MSQ" if n <= 50 else "MCQ"
            sec_id = "nat" if n <= 20 else "msq" if n <= 50 else "mcq"

            # Check for images in this question region on the page
            img_infos = page.get_image_info()
            region_y0 = region[0][0] if region else 0
            images = [fitz.Rect(x["bbox"]) for x in img_infos if x["bbox"][1] >= region_y0 - 5 and x["bbox"][3] <= boundary + 5 and fitz.Rect(x["bbox"]).get_area() > 1500]

            img_rel = None
            if images:
                rect = fitz.Rect(images[0])
                for r in images[1:]: rect = rect | r
                rect = fitz.Rect(max(0, rect.x0 - 4), max(0, rect.y0 - 4), min(page.rect.width, rect.x1 + 4), min(page.rect.height, rect.y1 + 4))

                name = f"uceed-2015-{q_id}.png"
                page.get_pixmap(matrix=fitz.Matrix(2.2, 2.2), clip=rect, alpha=False).save(sub_dir / f"{q_id}.png")
                page.get_pixmap(matrix=fitz.Matrix(2.2, 2.2), clip=rect, alpha=False).save(media_dir / name)
                img_rel = f"/media/{name}"
                manifest.append(n)

            # Define marks per user explicit table:
            # NAT: +3 / -1
            # MSQ: +3 / 0 (No partial marking)
            # MCQ: +3 / -1
            if n <= 20:
                marks = {"correct": 3, "incorrect": -1, "unanswered": 0}
            elif n <= 50:
                marks = {"correct": 3, "incorrect": 0, "unanswered": 0}
            else:
                marks = {"correct": 3, "incorrect": -1, "unanswered": 0}

            q_obj = {
                "id": q_id,
                "sectionId": sec_id,
                "type": q_type,
                "prompt": " ".join(prompt).strip() or f"Question {n}",
                "topic": "Design Aptitude & Visual Observation",
                "difficulty": "Medium",
                "tags": ["uceed-2015", q_type.lower()],
                "marks": marks
            }

            if img_rel:
                q_obj["image"] = img_rel
                q_obj["imageAlt"] = f"UCEED 2015 Question {n} Diagram"

            if q_type == "NAT":
                lo, hi = nat_keys[n]
                q_obj["answer"] = {"min": lo, "max": hi}
            else:
                q_obj["options"] = options or [{"id": c, "text": f"{c.upper()} — see diagram"} for c in "abcd"]
                if q_type == "MCQ":
                    q_obj["answer"] = mcq_keys[n]
                    if n in mcq_alts:
                        q_obj["answerAlternatives"] = mcq_alts[n]
                else: # MSQ
                    q_obj["answer"] = msq_keys[n]

            questions.append(q_obj)

    unique_questions = []
    seen = set()
    for q in questions:
        if q["id"] not in seen:
            seen.add(q["id"])
            unique_questions.append(q)

    unique_questions.sort(key=lambda q: int(q["id"].replace("q", "")))
    print(f"Extracted {len(unique_questions)} questions (Images: {len(manifest)})")

    max_marks = sum(q["marks"]["correct"] for q in unique_questions)

    exam_obj = {
        "id": "uceed-2015",
        "title": "UCEED 2015 Official Paper",
        "durationSeconds": 7200,
        "totalQuestions": len(unique_questions),
        "maxMarks": max_marks,
        "instructions": "Official UCEED 2015 Question Paper & Final Answer Key (Part A: 100 questions, 300 marks, 120 minutes). Section 1 NAT: Q1–20 (+3/-1). Section 2 MSQ: Q21–50 (+3/0, no partial credit). Section 3 MCQ: Q51–100 (+3/-1).",
        "sections": [
            {"id": "nat", "title": "Section 1 · NAT (60 marks)"},
            {"id": "msq", "title": "Section 2 · MSQ (90 marks)"},
            {"id": "mcq", "title": "Section 3 · MCQ (150 marks)"}
        ],
        "questions": unique_questions
    }

    out_file = Path("fixtures/uceed-2015.json")
    out_file.write_text(json.dumps(exam_obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"SUCCESS: Generated {out_file} ({out_file.stat().st_size} bytes) with {len(unique_questions)} questions, {max_marks} max marks")

if __name__ == "__main__":
    build_uceed_2015_paper()
