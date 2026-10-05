import json
from pathlib import Path

def convert_uceed_2024_test_bank():
    src_file = Path("uceed_2024_test_bank.json")
    if not src_file.exists():
        print("Error: uceed_2024_test_bank.json not found")
        return

    raw = json.loads(src_file.read_text(encoding="utf-8"))

    print(f"Loaded test bank: {raw.get('title')} ({raw.get('id')})")
    print(f"Total questions in source: {len(raw.get('questions', []))}")

    questions = []
    nat_count = 0
    msq_count = 0
    mcq_count = 0

    for q in raw["questions"]:
        q_num = int(q["id"].replace("Q.", "").strip())
        if q_num > 57:
            # Skip Part B drawing questions (Q58, Q59) for auto-scored CBT Part A
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

        img_path = None
        img_alt = None
        # Check image in public/media or uceed-2024-qXX.png
        media_img = Path("public/media") / f"uceed-2024-{q_id}.png"
        if media_img.exists():
            img_path = f"/media/uceed-2024-{q_id}.png"
            img_alt = f"UCEED 2024 Question {q_num} Diagram"

        question_obj = {
            "id": q_id,
            "sectionId": section_id,
            "type": q_type,
            "prompt": prompt,
            "marks": marks
        }

        # Include topic, difficulty, tags per PAPER_IMPORT_GUIDE.md Section 5
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
                    min_val = min(vals)
                    max_val = max(vals)
                    ans_obj = {"min": min_val, "max": max_val, "values": vals}
                else:
                    min_val = ans_data.get("min")
                    max_val = ans_data.get("max")
                    ans_obj = {"min": min_val, "max": max_val}
            else:
                min_val = float(ans_data)
                max_val = float(ans_data)
                ans_obj = {"min": min_val, "max": max_val}

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

    print(f"Processed Part A questions: {len(questions)} (NAT: {nat_count}, MSQ: {msq_count}, MCQ: {mcq_count})")

    exam_obj = {
        "id": "uceed-2024",
        "title": "UCEED 2024",
        "durationSeconds": 7200,
        "totalQuestions": len(questions),
        "maxMarks": 200,
        "instructions": raw.get("instructions", "Part A: 57 questions, 200 marks, 120 minutes."),
        "sections": [
            {"id": "nat", "title": "Section 1 · NAT (56 marks)"},
            {"id": "msq", "title": "Section 2 · MSQ (60 marks)"},
            {"id": "mcq", "title": "Section 3 · MCQ (84 marks)"}
        ],
        "questions": questions
    }

    out_file = Path("fixtures/uceed-2024.json")
    out_file.write_text(json.dumps(exam_obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Successfully generated fixture with topic metadata: {out_file} ({out_file.stat().st_size} bytes)")

if __name__ == "__main__":
    convert_uceed_2024_test_bank()
