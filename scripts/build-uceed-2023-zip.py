import zipfile
import json
from pathlib import Path

def build_uceed_2023():
    zip_path = Path("UCEED_2023_Test_Bank.zip")
    if not zip_path.exists():
        print("Error: UCEED_2023_Test_Bank.zip not found")
        return

    media_dir = Path("public/media")
    target_dir = media_dir / "uceed-2023"
    target_dir.mkdir(parents=True, exist_ok=True)

    extracted_images = 0
    test_bank_raw = None

    with zipfile.ZipFile(zip_path) as z:
        for info in z.infolist():
            if info.filename == "uceed_2023_test_bank.json" or info.filename.endswith("/uceed_2023_test_bank.json"):
                test_bank_raw = json.loads(z.read(info.filename).decode('utf-8'))
            elif not info.is_dir() and (info.filename.startswith("images/") or "/images/" in info.filename or info.filename.endswith(('.png', '.jpg', '.jpeg', '.webp'))):
                filename = Path(info.filename).name # e.g. q01.png
                data = z.read(info.filename)
                
                # Write to public/media/uceed-2023/q01.png
                (target_dir / filename).write_bytes(data)
                
                # Also write to public/media/uceed-2023-q01.png
                q_num = filename.replace("q", "").replace(".png", "")
                if q_num.isdigit():
                    alt_target = media_dir / f"uceed-2023-q{int(q_num):02d}.png"
                    alt_target.write_bytes(data)
                
                extracted_images += 1

    if not test_bank_raw:
        print("Error: uceed_2023_test_bank.json not found in ZIP")
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
        q_num_str = raw_id.replace("Q.", "").replace("q", "").strip()
        if not q_num_str.isdigit():
            continue
        q_num = int(q_num_str)

        if q_num > 57:
            # Skip Part B drawing questions for auto-scored Part A
            continue

        q_id = f"q{q_num:02d}"

        if q_num <= 14:
            section_id = "nat"
            q_type = "NAT"
            nat_count += 1
            marks = {"correct": 4, "incorrect": 0, "unanswered": 0}
        elif q_num <= 29:
            section_id = "msq"
            q_type = "MSQ"
            msq_count += 1
            marks = {"correct": 4, "incorrect": -1, "unanswered": 0}
        else:
            section_id = "mcq"
            q_type = "MCQ"
            mcq_count += 1
            marks = {"correct": 3, "incorrect": -0.71, "unanswered": 0}

        prompt = (q.get("prompt") or "").strip()

        # Image mapping
        img_path = None
        img_alt = None
        media_img = media_dir / f"uceed-2023-q{q_num:02d}.png"
        if media_img.exists():
            img_path = f"/media/uceed-2023-q{q_num:02d}.png"
            img_alt = f"UCEED 2023 Question {q_num} Diagram"

        question_obj = {
            "id": q_id,
            "sectionId": section_id,
            "type": q_type,
            "prompt": prompt,
            "marks": marks
        }

        # Topic metadata per PAPER_IMPORT_GUIDE.md Section 5
        if q.get("topic"):
            question_obj["topic"] = q["topic"]
        if q.get("difficulty"):
            question_obj["difficulty"] = q["difficulty"]
        if q.get("tags"):
            question_obj["tags"] = q["tags"]

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

    print(f"Processed 2023 Part A questions: {len(questions)} (NAT: {nat_count}, MSQ: {msq_count}, MCQ: {mcq_count})")

    exam_obj = {
        "id": "uceed-2023",
        "title": "UCEED 2023 Official Paper",
        "durationSeconds": 7200,
        "totalQuestions": len(questions),
        "maxMarks": 200,
        "instructions": test_bank_raw.get("instructions", "Part A: 57 questions, 200 marks, 120 minutes."),
        "sections": [
            {"id": "nat", "title": "Section 1 · NAT (56 marks)"},
            {"id": "msq", "title": "Section 2 · MSQ (60 marks)"},
            {"id": "mcq", "title": "Section 3 · MCQ (84 marks)"}
        ],
        "questions": questions
    }

    out_file = Path("fixtures/uceed-2023.json")
    out_file.write_text(json.dumps(exam_obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Successfully generated fixture: {out_file} ({out_file.stat().st_size} bytes)")

    # Verify images referenced in fixture exist on disk
    missing = [q["id"] for q in questions if "image" in q and not (Path("public") / q["image"].lstrip("/")).exists()]
    if missing:
        print(f"WARNING: Missing images for questions: {missing}")
    else:
        print("SUCCESS: All image paths in fixtures/uceed-2023.json verified on disk!")

if __name__ == "__main__":
    build_uceed_2023()
