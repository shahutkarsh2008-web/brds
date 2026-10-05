import pymupdf as fitz
from pathlib import Path
import re, json

def build_uceed_2016_paper():
    paper_path = Path("UCEED2016_Question_Paper.pdf")
    if not paper_path.exists():
        print("Error: UCEED2016_Question_Paper.pdf not found")
        return

    doc = fitz.open(paper_path)

    # Key Data extracted from official UCEED 2016 Final Answer Key
    # Section A (NAT): Q1-20 (+4 / -1)
    nat_keys = {
        1: (19, 19), 2: (26, 26), 3: (8, 8), 4: (11, 11), 5: (50, 50),
        6: (0.26, 27), 7: (12, 12), 8: (85, 85), 9: (65, 66), 10: (12, 12),
        11: (99, 99), 12: (12, 12), 13: (1068, 1068), 14: (21, 22), 15: (33, 33),
        16: (26, 26), 17: (810000, 810000), 18: (10, 10), 19: (451, 451), 20: (0.82, 0.82)
    }

    # Q6 accepted values: 0.26, 0.27, 26, 27
    nat_values = {
        6: [0.26, 0.27, 26, 27]
    }

    # Q51's long word-sequence choices are split into positioned spans in the
    # official PDF and the regular line parser captures only the first column.
    option_overrides = {
        51: {
            "c": "bemused, disinterested, energizing, deprecated, flouted, floundered, fortuitous, interned, luxuriant, simplistic.",
            "d": "amused, disinterested, enervating, depreciated, flaunted, foundered, fortuitous, interned, luxurious, simple."
        }
    }

    # Section B (MSQ): Q21-40 (+5 / -0.5, no partial credit)
    msq_keys = {
        21: ["b", "c"], 22: ["a", "d"], 23: ["a", "d"], 24: ["b", "d"],
        25: ["a", "b", "d"], 26: ["a", "b", "c", "d"], 27: ["c"], 28: ["a", "b", "d"],
        29: ["b", "c"], 30: ["a", "c"], 31: ["a", "b", "c"], 32: ["b", "c"],
        33: ["a", "d"], 34: ["d"], 35: ["a", "c", "d"], 36: ["a", "b", "c", "d"],
        37: ["c"], 38: ["d"], 39: ["a", "b", "c"], 40: ["a", "b", "d"]
    }

    # Section C (MCQ): Q41-80 (+3 / -1)
    mcq_keys = {
        41: "b", 42: "d", 43: "c", 44: "c", 45: "d", 46: "a", 47: "c", 48: "a",
        49: "a", 50: "a", 51: "c", 52: "d", 53: "d", 54: "b", 55: "c", 56: "d",
        57: "c", 58: "b", 59: "c", 60: "a", 61: "b", 62: "a", 63: "c", 64: "a",
        65: "b", 66: "b", 67: "d", 68: "c", 69: "a", 70: "c", 71: "b", 72: "d",
        73: "c", 74: "b", 75: "d", 76: "b", 77: "d", 78: "a", 79: "a", 80: "b"
    }

    mcq_alts = {
        79: ["b"]
    }

    questions = []
    manifest = []
    media_dir = Path("public/media")
    media_dir.mkdir(parents=True, exist_ok=True)
    sub_dir = media_dir / "uceed-2016"
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
            m = re.match(r"^(\d{1,2})\.\s+(.*)", l[1])
            if m:
                n = int(m.group(1))
                if 1 <= n <= 80:
                    starts.append((i, n))

        for j, (start, n) in enumerate(starts):
            stop = starts[j+1][0] if j+1 < len(starts) else len(lines)
            region = lines[start:stop]
            boundary = lines[stop][0] if stop < len(lines) else 780

            texts = [l[1] for l in region if not l[1].startswith(("UCEED 2016", "Page "))]
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

            existing_option_ids = {option["id"] for option in options}
            for option_id, option_text in option_overrides.get(n, {}).items():
                if option_id not in existing_option_ids:
                    options.append({"id": option_id, "text": option_text})
            options.sort(key=lambda option: option["id"])

            q_id = f"q{n:02d}"
            q_type = "NAT" if n <= 20 else "MSQ" if n <= 40 else "MCQ"
            sec_id = "nat" if n <= 20 else "msq" if n <= 40 else "mcq"

            # Check for images in this question region on the page
            img_infos = page.get_image_info()
            region_y0 = region[0][0] if region else 0
            images = [fitz.Rect(x["bbox"]) for x in img_infos if x["bbox"][1] >= region_y0 - 5 and x["bbox"][3] <= boundary + 5 and fitz.Rect(x["bbox"]).get_area() > 1500]

            img_rel = None
            if images:
                rect = fitz.Rect(images[0])
                for r in images[1:]: rect = rect | r
                rect = fitz.Rect(max(0, rect.x0 - 4), max(0, rect.y0 - 4), min(page.rect.width, rect.x1 + 4), min(page.rect.height, rect.y1 + 4))

                name = f"uceed-2016-{q_id}.png"
                page.get_pixmap(matrix=fitz.Matrix(2.2, 2.2), clip=rect, alpha=False).save(sub_dir / f"{q_id}.png")
                page.get_pixmap(matrix=fitz.Matrix(2.2, 2.2), clip=rect, alpha=False).save(media_dir / name)
                img_rel = f"/media/{name}"
                manifest.append(n)

            # Define marks per user explicit table:
            # NAT: +4 / -1
            # MSQ: +5 / -0.5 (No partial marking)
            # MCQ: +3 / -1
            if n <= 20:
                marks = {"correct": 4, "incorrect": -1, "unanswered": 0}
            elif n <= 40:
                marks = {"correct": 5, "incorrect": -0.5, "unanswered": 0}
            else:
                marks = {"correct": 3, "incorrect": -1, "unanswered": 0}

            q_obj = {
                "id": q_id,
                "sectionId": sec_id,
                "type": q_type,
                "prompt": " ".join(prompt).strip() or f"Question {n}",
                "topic": "Design Aptitude & Visual Observation",
                "difficulty": "Medium",
                "tags": ["uceed-2016", q_type.lower()],
                "marks": marks
            }

            if img_rel:
                q_obj["image"] = img_rel
                q_obj["imageAlt"] = f"UCEED 2016 Question {n} Diagram"

            if q_type == "NAT":
                lo, hi = nat_keys[n]
                ans_obj = {"min": lo, "max": hi}
                if n in nat_values:
                    ans_obj["values"] = nat_values[n]
                q_obj["answer"] = ans_obj
            else:
                q_obj["options"] = options or [{"id": c, "text": f"{c.upper()} — see diagram"} for c in "abcd"]
                if q_type == "MCQ":
                    q_obj["answer"] = mcq_keys[n]
                    if n in mcq_alts:
                        q_obj["answerAlternatives"] = mcq_alts[n]
                else: # MSQ
                    q_obj["answer"] = msq_keys[n]
                    # No partialCredit for 2016 per user table

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
        "id": "uceed-2016",
        "title": "UCEED 2016 Official Paper",
        "durationSeconds": 7200,
        "totalQuestions": len(unique_questions),
        "maxMarks": max_marks,
        "instructions": "Official UCEED 2016 Question Paper & Final Answer Key (Part A: 80 questions, 300 marks, 120 minutes). Section 1 NAT: Q1–20 (+4/-1). Section 2 MSQ: Q21–40 (+5/-0.5, no partial credit). Section 3 MCQ: Q41–80 (+3/-1).",
        "sections": [
            {"id": "nat", "title": "Section 1 · NAT (80 marks)"},
            {"id": "msq", "title": "Section 2 · MSQ (100 marks)"},
            {"id": "mcq", "title": "Section 3 · MCQ (120 marks)"}
        ],
        "questions": unique_questions
    }

    out_file = Path("fixtures/uceed-2016.json")
    out_file.write_text(json.dumps(exam_obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"SUCCESS: Generated {out_file} ({out_file.stat().st_size} bytes) with {len(unique_questions)} questions, {max_marks} max marks")

if __name__ == "__main__":
    build_uceed_2016_paper()
