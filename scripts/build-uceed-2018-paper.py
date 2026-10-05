import zipfile
import json
from pathlib import Path

def build_uceed_2018():
    zip_path = Path("UCEED_2018_Test_Bank.zip")
    if not zip_path.exists():
        print("Error: UCEED_2018_Test_Bank.zip not found")
        return

    media_dir = Path("public/media")
    target_dir = media_dir / "uceed-2018"
    target_dir.mkdir(parents=True, exist_ok=True)

    extracted_images = 0
    test_bank_raw = None

    with zipfile.ZipFile(zip_path) as z:
        for info in z.infolist():
            if info.filename.endswith("uceed_2018_test_bank.json"):
                test_bank_raw = json.loads(z.read(info.filename).decode('utf-8'))
            elif not info.is_dir() and (info.filename.startswith("images/") or "/images/" in info.filename or info.filename.endswith(('.png', '.jpg', '.jpeg', '.webp'))):
                filename = Path(info.filename).name # e.g. q01.png
                try:
                    data = z.read(info.filename)
                    # Write to public/media/uceed-2018/q01.png
                    (target_dir / filename).write_bytes(data)
                    
                    # Also write to public/media/uceed-2018-q01.png
                    q_num_str = filename.replace("q", "").replace(".png", "").replace(".jpg", "").replace(".jpeg", "")
                    if q_num_str.isdigit():
                        alt_target = media_dir / f"uceed-2018-q{int(q_num_str):02d}.png"
                        alt_target.write_bytes(data)
                    
                    extracted_images += 1
                except Exception as e:
                    print(f"Warning extracting {filename}: {e}")

    if not test_bank_raw:
        print("Error: uceed_2018_test_bank.json not found in ZIP")
        return

    print(f"Extracted {extracted_images} images into {target_dir} and {media_dir}")

    questions = []
    nat_count = 0
    msq_count = 0
    mcq_count = 0

    raw_questions = test_bank_raw.get("questions", [])
    print(f"Source questions count: {len(raw_questions)}")

    for q in raw_questions:
        raw_id = str(q.get("id", ""))
        q_num_str = raw_id.replace("Q.", "").replace("q", "").replace("Q", "").strip()
        if not q_num_str.isdigit():
            continue
        q_num = int(q_num_str)

        if q_num > 85: # UCEED 2018 Part A total questions count (85 questions)
            continue

        q_id = f"q{q_num:02d}"

        # UCEED 2018 Section structure: NAT (Q1-20), MSQ (Q21-45), MCQ (Q46-85)
        # NAT: Q1-20 (20 questions, +4/0)
        # MSQ: Q21-45 (25 questions, +4/0 with partial credit or +4/-1)
        # MCQ: Q46-85 (40 questions, +3/-0.71)
        if q_num <= 20:
            section_id = "nat"
            q_type = "NAT"
            nat_count += 1
            marks = {"correct": 4, "incorrect": 0, "unanswered": 0}
        elif q_num <= 45:
            section_id = "msq"
            q_type = "MSQ"
            msq_count += 1
            # Check marking rules from test bank or standard 2018 scheme
            m_data = q.get("marking", {})
            inc = m_data.get("incorrect", 0)
            marks = {"correct": 4, "incorrect": inc, "unanswered": 0}
        else:
            section_id = "mcq"
            q_type = "MCQ"
            mcq_count += 1
            marks = {"correct": 3, "incorrect": -0.71, "unanswered": 0}

        prompt = (q.get("prompt") or "").strip()

        # Image mapping
        img_path = None
        img_alt = None
        media_img = media_dir / f"uceed-2018-q{q_num:02d}.png"
        if media_img.exists():
            img_path = f"/media/uceed-2018-q{q_num:02d}.png"
            img_alt = f"UCEED 2018 Question {q_num} Diagram"

        question_obj = {
            "id": q_id,
            "sectionId": section_id,
            "type": q_type,
            "prompt": prompt,
            "marks": marks
        }

        # Topic metadata per PAPER_IMPORT_GUIDE.md Section 5
        topic = q.get("topic") or "Design Aptitude & Visual Observation"
        if topic.startswith("Section "):
            topic = "Design Aptitude & Visual Observation"
        question_obj["topic"] = topic
        question_obj["difficulty"] = q.get("difficulty") or "Medium"
        question_obj["tags"] = q.get("tags") or ["uceed-2018", q_type.lower()]

        if img_path:
            question_obj["image"] = img_path
            question_obj["imageAlt"] = img_alt

        if q_type == "NAT":
            ans_data = q.get("answer", {})
            if isinstance(ans_data, dict):
                if "acceptedValues" in ans_data:
                    vals = ans_data["acceptedValues"]
                    ans_obj = {"min": min(vals), "max": max(vals), "values": vals}
                else:
                    ans_obj = {"min": ans_data.get("min"), "max": ans_data.get("max")}
            else:
                ans_obj = {"min": float(ans_data), "max": float(ans_data)}

            question_obj["answer"] = ans_obj
        else:
            options = []
            for opt in q.get("options", []):
                opt_id = opt["id"].lower()
                raw_text = opt.get("text")
                opt_text = (raw_text if raw_text is not None else f"{opt['id'].upper()} — see diagram").strip()
                if not opt_text:
                    opt_text = f"{opt['id'].upper()} — see diagram"
                options.append({"id": opt_id, "text": opt_text})

            if not options:
                options = [{"id": c, "text": f"{c.upper()} — see diagram"} for c in "abcd"]

            question_obj["options"] = options

            ans = q.get("answer")
            if q_type == "MCQ":
                if isinstance(ans, list):
                    ans = ans[0].lower()
                else:
                    ans = str(ans).lower()
                question_obj["answer"] = ans
            else: # MSQ
                if isinstance(ans, str):
                    ans = list(ans.lower())
                else:
                    ans = [str(x).lower() for x in ans]
                ans.sort()
                question_obj["answer"] = ans
                question_obj["partialCredit"] = {"1": 1, "2": 2, "3": 3}

        questions.append(question_obj)

    print(f"Processed 2018 Part A questions: {len(questions)} (NAT: {nat_count}, MSQ: {msq_count}, MCQ: {mcq_count})")

    # Deduplicate questions if any duplicate page hits
    unique_questions = []
    seen = set()
    for q in questions:
        if q["id"] not in seen:
            seen.add(q["id"])
            unique_questions.append(q)

    # Sort questions by ID
    unique_questions.sort(key=lambda q: int(q["id"].replace("q", "")))

    max_marks = sum(q["marks"]["correct"] for q in unique_questions)

    exam_obj = {
        "id": "uceed-2018",
        "title": "UCEED 2018 Official Paper",
        "durationSeconds": 7200,
        "totalQuestions": len(unique_questions),
        "maxMarks": max_marks,
        "instructions": "Official UCEED 2018 Question Paper & Final Answer Key (Part A: 85 questions, 300 marks, 120 minutes). Section 1 NAT: Q1–20 (+4/0). Section 2 MSQ: Q21–45 (+4/0 with partial credit). Section 3 MCQ: Q46–85 (+3/-0.71).",
        "sections": [
            {"id": "nat", "title": "Section 1 · NAT (80 marks)"},
            {"id": "msq", "title": "Section 2 · MSQ (100 marks)"},
            {"id": "mcq", "title": "Section 3 · MCQ (120 marks)"}
        ],
        "questions": unique_questions
    }

    out_file = Path("fixtures/uceed-2018.json")
    out_file.write_text(json.dumps(exam_obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"SUCCESS: Generated {out_file} ({out_file.stat().st_size} bytes) with {len(unique_questions)} questions, {max_marks} max marks")

    # Verify images referenced in fixture exist on disk
    missing = [q["id"] for q in unique_questions if "image" in q and not (Path("public") / q["image"].lstrip("/")).exists()]
    if missing:
        print(f"WARNING: Missing images for questions: {missing}")
    else:
        print("SUCCESS: All image paths in fixtures/uceed-2018.json verified on disk!")

if __name__ == "__main__":
    build_uceed_2018()
