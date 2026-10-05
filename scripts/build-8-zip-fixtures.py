import zipfile
import json
from pathlib import Path
import re

ROOT = Path(__file__).parent.parent
MEDIA_DIR = ROOT / "public" / "media"
FIXTURES_DIR = ROOT / "fixtures"
REPORTS_DIR = ROOT / "reports"

# Canonical topic taxonomy mapping helper
def map_canonical_topic(raw_topic, prompt="", qtype=""):
    t = str(raw_topic or "").lower().strip()
    p = str(prompt or "").lower().strip()
    
    if "solid" in t or "cuboid" in t or "cube" in t or "unpainted" in t or "net" in t:
        return "2D and 3D visualization", "Visualization & Spatial Reasoning"
    if "rotation" in t or "shadow" in t or "angle" in t:
        return "Rotation and reflection", "Visualization & Spatial Reasoning"
    if "counting" in t or "bead" in t or "circle packing" in t or "font counting" in t:
        return "Pattern Counting", "Observation & Design Sensitivity"
    if "font" in t or "logo" in t or "typography" in t:
        return "Typography & Fonts", "Language & Creativity"
    if "gear" in t or "pulley" in t or "mechanism" in t or "lock" in t:
        return "Everyday objects and mechanisms", "Practical & Scientific Knowledge"
    if "distance" in t or "speed" in t or "road" in t:
        return "Distance and speed", "Analytical & Logical Reasoning"
    if "area" in t or "perimeter" in t or "geometry" in t or "hexagon" in t:
        return "Area, perimeter, volume and surface area", "Analytical & Logical Reasoning"
    if "graph" in t or "chart" in t or "table" in t or "statistics" in t:
        return "Tables, charts and graphs", "Analytical & Logical Reasoning"
    if "reading" in t or "comprehension" in t or "text" in t:
        return "Reading comprehension", "Language"
    if "sketching" in t or "drawing" in t or "visual sensitivity" in t or "form sensitivity" in t or "creativity" in t:
        return "Visual Sensitivity", "Observation & Design Sensitivity"
    if "perspective" in t or "depth" in t:
        return "Perspective and depth", "Visualization & Spatial Reasoning"
    if "pattern" in t or "sequence" in t or "grid" in t or "tile" in t:
        return "Texture & Pattern Matching", "Observation & Design Sensitivity"
    if "fold" in t or "paper" in t or "unfolding" in t:
        return "Paper folding, cutting and punching", "Visualization & Spatial Reasoning"
    if "balance" in t or "stability" in t or "weight" in t:
        return "Balance and stability", "Practical & Scientific Knowledge"
    if "usability" in t or "ergonomic" in t:
        return "Usability", "Observation & Design Sensitivity"
    if "light" in t or "reflection" in t or "refraction" in t:
        return "Light, reflection and refraction", "Practical & Scientific Knowledge"
    if "material" in t or "casting" in t or "expansion" in t:
        return "Materials and their properties (Wood, metal, glass, plastic, paper, rubber, fabric)", "Practical & Scientific Knowledge"
    if "culture" in t or "monument" in t or "craft" in t:
        return "Traditional crafts and objects", "Environment & Society"
    if "ratio" in t or "arithmetic" in t or "fraction" in t or "percentage" in t:
        return "Arithmetic", "Analytical & Logical Reasoning"
    if "probability" in t:
        return "Counting and arrangements", "Analytical & Logical Reasoning"
    if "logic" in t or "puzzle" in t or "assignment" in t:
        return "Logical conditions and statements", "Analytical & Logical Reasoning"
    
    return "2D and 3D visualization", "Visualization & Spatial Reasoning"

def parse_fraction(s):
    if isinstance(s, (int, float)):
        return float(s)
    if isinstance(s, str):
        s = s.strip()
        if '/' in s:
            parts = s.split('/')
            if len(parts) == 2:
                try:
                    num = float(parts[0].strip())
                    den = float(parts[1].strip())
                    if den != 0:
                        return num / den
                except ValueError:
                    pass
        try:
            return float(s)
        except ValueError:
            return None
    return None

def normalize_nat_answer(ans, key_text=None):
    if isinstance(ans, dict) and 'min' in ans and 'max' in ans:
        min_v = parse_fraction(ans['min'])
        max_v = parse_fraction(ans['max'])
        if min_v is not None and max_v is not None:
            res = {"min": round(min_v, 4), "max": round(max_v, 4)}
            if ans.get('values'):
                res['values'] = [round(v, 4) for v in ans['values'] if isinstance(v, (int, float))]
            return res

    if isinstance(ans, (int, float)):
        v = float(ans)
        return {"min": round(v, 4), "max": round(v, 4)}

    if isinstance(ans, str):
        v = parse_fraction(ans)
        if v is not None:
            if abs(v - round(v, 4)) < 1e-6:
                v_round = round(v, 4)
                return {"min": v_round, "max": v_round}
            else:
                v_2 = round(v, 2)
                v_3 = round(v, 3)
                v_4 = round(v, 4)
                min_b = min(v_2, v_3, v_4)
                max_b = max(v_2, v_3, v_4)
                vals = list(dict.fromkeys([min_b, max_b, v_2, v_3, v_4]))
                return {"min": min_b, "max": max_b, "values": vals}

    if key_text:
        nums = [float(x) for x in re.findall(r"[-+]?\d*\.\d+|\d+", str(key_text))]
        if nums:
            if len(nums) == 1:
                return {"min": nums[0], "max": nums[0]}
            else:
                return {"min": min(nums), "max": max(nums), "values": nums}

    return {"min": 0.0, "max": 0.0}

def build_ceed_fixture(year, zip_filename, target_media_subfolder):
    zip_path = ROOT / zip_filename
    out_media_dir = MEDIA_DIR / target_media_subfolder
    out_media_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(zip_path) as z:
        # Extract images
        for member in z.namelist():
            if member.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg')):
                fname = Path(member).name
                (out_media_dir / fname).write_bytes(z.read(member))

        main_json = [f for f in z.namelist() if f.endswith('.json') and 'validation' not in f][0]
        raw_data = json.loads(z.read(main_json).decode('utf-8'))

    raw_questions = raw_data.get('questions', []) if isinstance(raw_data, dict) else raw_data

    # Marking schemes:
    # 2021-2023: NAT (+3/0), MSQ (+3/-0.2), MCQ (+2/-0.5), Part A = 100 marks
    # 2024-2026: NAT (+4/0), MSQ (+4/-1, partial 1:1, 2:2, 3:3), MCQ (+3/-0.5), Part A = 150 marks
    is_newer = year >= 2024

    sections = [
        {"id": f"sec_nat_{year}", "title": "Section I: Numerical Answer Type (NAT)"},
        {"id": f"sec_msq_{year}", "title": "Section II: Multiple Select Questions (MSQ)"},
        {"id": f"sec_mcq_{year}", "title": "Section III: Multiple Choice Questions (MCQ)"}
    ]

    part_a_questions = []
    part_b_questions = []

    q_counter = 1

    for q in raw_questions:
        qtype = q.get('type')

        # Check image reference
        img_file = q.get('image') or (q.get('images')[0] if q.get('images') else None)
        if img_file:
            img_fname = Path(img_file).name
            image_path = f"/media/{target_media_subfolder}/{img_fname}"
        else:
            image_path = None

        prompt = (q.get('prompt') or '').strip()
        # Fallbacks for CEED 2023 Q31 / Q34 blank prompts
        if not prompt:
            if year == 2023 and q.get('id') == 'T31-01':
                prompt = "Portrait pattern matching (See diagram)"
            elif year == 2023 and q.get('id') == 'T34-01':
                prompt = "Shape-grid patterns (See diagram)"
            else:
                prompt = f"Question {q.get('id', q_counter)} (See diagram)"

        if qtype in ('DRAWING_DESIGN', 'DRAWING', 'DESCRIPTIVE') or 'part_b' in str(q.get('sectionId')).lower():
            part_b_questions.append({
                "id": f"ceed-{year}-pb-q{len(part_b_questions)+1:02d}",
                "originalQuestionId": q.get('originalQuestionId') or f"Part B Q.{len(part_b_questions)+1}",
                "type": "DRAWING_DESIGN",
                "prompt": prompt,
                "marks": q.get('marks', 20),
                "evaluationCriteria": q.get('explanation') or "Visual composition, line quality, proportion and detail.",
                "image": image_path,
                "imageAlt": f"CEED {year} Part B Q{len(part_b_questions)+1} diagram" if image_path else None,
                "sourceFile": q.get('sourceFile'),
                "sourcePage": q.get('sourcePage')
            })
            continue

        qid = f"ceed-{year}-q{q_counter:02d}"
        q_counter += 1

        topic_name, cat_name = map_canonical_topic(q.get('topic'), prompt, qtype)

        # Assign section
        if qtype == 'NAT':
            sec_id = f"sec_nat_{year}"
            marks = {"correct": 4.0 if is_newer else 3.0, "incorrect": 0.0, "unanswered": 0.0}
        elif qtype == 'MSQ':
            sec_id = f"sec_msq_{year}"
            marks = {"correct": 4.0 if is_newer else 3.0, "incorrect": -1.0 if is_newer else -0.2, "unanswered": 0.0}
        else:
            sec_id = f"sec_mcq_{year}"
            marks = {"correct": 3.0 if is_newer else 2.0, "incorrect": -0.5, "unanswered": 0.0}

        # Build options
        raw_options = q.get('options') or []
        options = []
        if qtype in ('MCQ', 'MSQ'):
            if not raw_options:
                raw_options = [{"id": "a"}, {"id": "b"}, {"id": "c"}, {"id": "d"}]
            for opt in raw_options:
                opt_id = str(opt.get('id', '')).lower()
                opt_text = (opt.get('text') or '').strip()
                if not opt_text:
                    opt_text = f"Option {opt_id.upper()}"
                options.append({"id": opt_id, "text": opt_text})

        # Answer key
        ans = q.get('answer')
        key_text = q.get('sourceAnswerKeyText')
        answer_alts = None

        if qtype == 'NAT':
            parsed_ans = normalize_nat_answer(ans, key_text)
            answer_obj = parsed_ans
        elif qtype == 'MCQ':
            if isinstance(ans, str) and ans:
                answer_obj = ans.lower()
            elif key_text and key_text.strip().lower() in ('a', 'b', 'c', 'd'):
                answer_obj = key_text.strip().lower()
            else:
                answer_obj = "a" # fallback
        elif qtype == 'MSQ':
            if isinstance(ans, list) and ans:
                answer_obj = [x.lower() for x in ans]
            elif isinstance(ans, str) and ans:
                answer_obj = [ans.lower()]
            elif key_text:
                # Handle key text like "C, D" or "B or B, D"
                if "or" in key_text.lower():
                    # Alternate keys
                    parts = [p.strip() for p in key_text.lower().split("or")]
                    k1 = [c.strip() for c in parts[0].replace(",", " ").split() if c.strip() in ("a","b","c","d")]
                    k2 = [c.strip() for c in parts[1].replace(",", " ").split() if c.strip() in ("a","b","c","d")]
                    answer_obj = k1 if k1 else ["a"]
                    if k2 and k2 != answer_obj:
                        answer_alts = [k2]
                else:
                    k = [c.strip() for c in key_text.lower().replace(",", " ").split() if c.strip() in ("a","b","c","d")]
                    answer_obj = k if k else ["a"]
            else:
                answer_obj = ["a"]

        q_item = {
            "id": qid,
            "sectionId": sec_id,
            "type": qtype,
            "prompt": prompt,
            "topic": topic_name,
            "category": cat_name,
            "sourceTopic": q.get('topic') or "General",
            "originalQuestionId": q.get('originalQuestionId') or f"Q.{q_counter-1:02d}",
            "marks": marks,
            "answer": answer_obj
        }

        if image_path:
            q_item["image"] = image_path
            q_item["imageAlt"] = f"CEED {year} Q{q_counter-1} diagram"

        if options:
            q_item["options"] = options

        if answer_alts:
            q_item["answerAlternatives"] = answer_alts

        if qtype == 'MSQ' and is_newer:
            q_item["partialCredit"] = {"1": 1.0, "2": 2.0, "3": 3.0}

        part_a_questions.append(q_item)

    total_marks = sum(q['marks']['correct'] for q in part_a_questions)

    fixture_obj = {
        "id": f"ceed-{year}",
        "title": f"Common Entrance Examination for Design CEED {year}",
        "durationSeconds": 3600,
        "totalQuestions": len(part_a_questions),
        "maxMarks": total_marks,
        "instructions": f"CEED {year} Part A Official Examination Paper.",
        "sections": sections,
        "questions": part_a_questions,
        "partBQuestions": part_b_questions
    }

    out_file = FIXTURES_DIR / f"ceed-{year}.json"
    out_file.write_text(json.dumps(fixture_obj, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Generated {out_file.name}: {len(part_a_questions)} Part A Qs ({total_marks} marks), {len(part_b_questions)} Part B Qs.")

def build_worksheet_fixture(zip_filename, fixture_filename, target_media_subfolder, exam_id, title, default_duration):
    zip_path = ROOT / zip_filename
    out_media_dir = MEDIA_DIR / target_media_subfolder
    out_media_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(zip_path) as z:
        for member in z.namelist():
            if member.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg')):
                fname = Path(member).name
                (out_media_dir / fname).write_bytes(z.read(member))

        main_json = [f for f in z.namelist() if f.endswith('.json') and 'validation' not in f][0]
        raw_data = json.loads(z.read(main_json).decode('utf-8'))

    raw_questions = raw_data.get('questions', []) if isinstance(raw_data, dict) else raw_data

    # Collect sections by topic
    sec_map = {}
    sections = []
    
    # Pre-scan topics for sections
    for q in raw_questions:
        sec_name = q.get('section') or q.get('topic') or "General Practice"
        if sec_name not in sec_map:
            sec_id = f"sec_ws_{len(sec_map)+1:02d}"
            sec_map[sec_name] = sec_id
            sections.append({"id": sec_id, "title": sec_name})

    questions = []
    for i, q in enumerate(raw_questions):
        raw_qtype = q.get('type', 'MCQ')
        qid = f"ws-{exam_id[:10]}-q{i+1:03d}"

        prompt = (q.get('prompt') or '').strip()
        if not prompt:
            prompt = f"Practice Question {i+1} (See diagram)"

        img_file = q.get('image') or (q.get('images')[0] if q.get('images') else None)
        if img_file:
            img_fname = Path(img_file).name
            image_path = f"/media/{target_media_subfolder}/{img_fname}"
        else:
            image_path = None

        sec_name = q.get('section') or q.get('topic') or "General Practice"
        sec_id = sec_map[sec_name]

        # Options processing first so we know if options exist
        raw_options = q.get('options') or []
        options = []
        if raw_options:
            for opt in raw_options:
                opt_id = str(opt.get('id', '')).lower()
                opt_text = (opt.get('text') or '').strip()
                if not opt_text:
                    opt_text = f"Option {opt_id.upper()}"
                options.append({"id": opt_id, "text": opt_text})

        ans = q.get('answer')
        exp = q.get('explanation') or ""

        # Resolve qtype
        if raw_qtype == 'SA':
            if options or (isinstance(ans, str) and ans.lower() in ('a', 'b', 'c', 'd')):
                qtype = 'MCQ'
            elif isinstance(ans, list):
                qtype = 'MSQ'
            else:
                qtype = 'NAT'
        else:
            qtype = raw_qtype

        topic_name, cat_name = map_canonical_topic(q.get('topic'), prompt, qtype)

        # Marks
        marks = {"correct": 4.0 if qtype in ('NAT', 'MSQ') else 3.0, "incorrect": 0.0 if qtype == 'NAT' else -1.0 if qtype == 'MSQ' else -0.71, "unanswered": 0.0}

        # Build fallback options if choice question lacks options
        if qtype in ('MCQ', 'MSQ') and not options:
            options = [{"id": "a", "text": "Option A"}, {"id": "b", "text": "Option B"}, {"id": "c", "text": "Option C"}, {"id": "d", "text": "Option D"}]

        # Answer key
        ans = q.get('answer')
        exp = q.get('explanation') or ""

        if qtype == 'NAT':
            parsed_ans = normalize_nat_answer(ans)
            answer_obj = parsed_ans
        elif qtype == 'MCQ':
            if isinstance(ans, str) and ans:
                answer_obj = ans.lower()
            else:
                answer_obj = "a"
        elif qtype == 'MSQ':
            if isinstance(ans, list) and ans:
                answer_obj = [x.lower() for x in ans]
            elif isinstance(ans, str) and ans:
                answer_obj = [ans.lower()]
            else:
                # Extract from explanation if available (e.g. "Valid options: BD.")
                match = re.search(r"Valid (?:options|groups):\s*([A-D]+)", exp)
                if match:
                    answer_obj = [c.lower() for c in match.group(1)]
                else:
                    answer_obj = ["a"]

        q_item = {
            "id": qid,
            "sectionId": sec_id,
            "type": qtype,
            "prompt": prompt,
            "topic": topic_name,
            "category": cat_name,
            "sourceTopic": q.get('topic') or "General",
            "originalQuestionId": q.get('originalQuestionId') or f"Q.{i+1:03d}",
            "marks": marks,
            "answer": answer_obj
        }

        if image_path:
            q_item["image"] = image_path
            q_item["imageAlt"] = f"Practice Q{i+1} diagram"

        if options:
            q_item["options"] = options

        if qtype == 'MSQ':
            q_item["partialCredit"] = {"1": 1.0, "2": 2.0, "3": 3.0}

        questions.append(q_item)

    total_marks = sum(q['marks']['correct'] for q in questions)

    fixture_obj = {
        "id": exam_id,
        "title": title,
        "durationSeconds": default_duration,
        "totalQuestions": len(questions),
        "maxMarks": round(total_marks, 2),
        "instructions": f"BRDS Original Practice Worksheet ({len(questions)} questions).",
        "sections": sections,
        "questions": questions
    }

    out_file = FIXTURES_DIR / fixture_filename
    out_file.write_text(json.dumps(fixture_obj, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Generated {out_file.name}: {len(questions)} Qs ({round(total_marks,2)} marks).")

if __name__ == "__main__":
    print("Building 8 ZIP Test Bank Fixtures...")
    
    # CEED 2021 to 2026
    for y in range(2021, 2027):
        build_ceed_fixture(y, f"CEED_{y}_Test_Bank.zip", f"ceed-{y}")

    # UCEED 260
    build_worksheet_fixture(
        "UCEED_Original_Spatial_Worksheet_260_RD.zip",
        "uceed-spatial-worksheet-260-revised.json",
        "uceed-spatial-260",
        "uceed-spatial-worksheet-260-revised",
        "BRDS / ORIGINAL UCEED PRACTICE / REVISED - 260 questions / 13 topics / revised diversity edition",
        7800
    )

    # UCEED 300
    build_worksheet_fixture(
        "UCEED_Spatial_Quantitative_300_test_bank.zip",
        "uceed-spatial-quantitative-worksheet-300-revised.json",
        "uceed-spatial-quant-300",
        "uceed-spatial-quantitative-worksheet-300-revised",
        "BRDS / ORIGINAL UCEED PRACTICE / REVISED - 300 questions / 15 topics / revised diversity edition",
        9000
    )
    print("Done building all 8 fixtures!")
