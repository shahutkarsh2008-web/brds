import zipfile
import json
from pathlib import Path

zip_files = [
    "CEED_2021_Test_Bank.zip",
    "CEED_2022_Test_Bank.zip",
    "CEED_2023_Test_Bank.zip",
    "CEED_2024_Test_Bank.zip",
    "CEED_2025_Test_Bank.zip",
    "CEED_2026_Test_Bank.zip",
    "UCEED_Original_Spatial_Worksheet_260_RD.zip",
    "UCEED_Spatial_Quantitative_300_test_bank.zip"
]

audit_results = {}

for zname in zip_files:
    zpath = Path(zname)
    if not zpath.exists():
        audit_results[zname] = {"error": "File not found"}
        continue

    try:
        with zipfile.ZipFile(zpath) as z:
            file_list = z.namelist()
            json_files = [f for f in file_list if f.endswith('.json')]
            image_files = [f for f in file_list if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
            
            data = None
            main_json = None
            if json_files:
                # Find main json file
                main_json = [f for f in json_files if not f.startswith('validation')][0] if len(json_files) > 1 else json_files[0]
                data = json.loads(z.read(main_json).decode('utf-8'))

            questions = data.get('questions', []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
            
            types_count = {}
            topics_count = {}
            answered_count = 0
            unanswered_count = 0
            part_a_count = 0
            part_b_count = 0
            verified_count = 0
            images_referenced = 0

            for q in questions:
                qtype = q.get('type', 'UNKNOWN')
                types_count[qtype] = types_count.get(qtype, 0) + 1

                topic = q.get('topic') or q.get('topicId') or 'Unclassified'
                topics_count[str(topic)] = topics_count.get(str(topic), 0) + 1

                ans = q.get('answer')
                if ans is not None and ans != "" and ans != []:
                    answered_count += 1
                else:
                    unanswered_count += 1

                if q.get('answerStatus') == 'verified':
                    verified_count += 1

                if q.get('image'):
                    images_referenced += 1

                # Part A vs Part B check
                sec = (q.get('sectionId') or q.get('topicId') or q.get('topic') or '').lower()
                q_num_str = str(q.get('id', '')).replace('Q.', '').replace('q', '').replace('Q', '').strip()
                if 'part_b' in sec or 'part-b' in sec or 'drawing' in sec or qtype == 'DRAWING' or qtype == 'DESCRIPTIVE':
                    part_b_count += 1
                else:
                    part_a_count += 1

            audit_results[zname] = {
                "exists": True,
                "main_json": main_json,
                "total_files_in_zip": len(file_list),
                "total_images_in_zip": len(image_files),
                "total_questions": len(questions),
                "part_a_count": part_a_count,
                "part_b_count": part_b_count,
                "answered_count": answered_count,
                "unanswered_count": unanswered_count,
                "verified_count": verified_count,
                "images_referenced": images_referenced,
                "types_breakdown": types_count,
                "topics_breakdown": topics_count,
                "title": data.get('title') if isinstance(data, dict) else None,
                "id": data.get('id') if isinstance(data, dict) else None,
                "instructions": data.get('instructions') if isinstance(data, dict) else None
            }
    except Exception as e:
        audit_results[zname] = {"error": str(e)}

out_file = Path("reports/8-zip-archives-audit.json")
out_file.parent.mkdir(parents=True, exist_ok=True)
out_file.write_text(json.dumps(audit_results, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Audit completed for {len(zip_files)} archives. Saved report to {out_file}")

# Print summary
for zname, res in audit_results.items():
    if "error" in res:
        print(f"❌ {zname}: ERROR - {res['error']}")
    else:
        print(f"✅ {zname}: {res['total_questions']} Qs (Part A: {res['part_a_count']}, Part B: {res['part_b_count']}, Images in ZIP: {res['total_images_in_zip']}) | Types: {res['types_breakdown']}")
