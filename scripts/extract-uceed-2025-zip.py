import zipfile
from pathlib import Path
import json

def extract_uceed_2025_zip():
    zip_path = Path("UCEED_2025_Test_Bank.zip")
    if not zip_path.exists():
        print("UCEED_2025_Test_Bank.zip not found, skipping.")
        return

    media_dir = Path("public/media")
    target_dir = media_dir / "uceed-2025"
    target_dir.mkdir(parents=True, exist_ok=True)

    extracted_count = 0
    with zipfile.ZipFile(zip_path) as z:
        for info in z.infolist():
            if not info.is_dir() and info.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                filename = Path(info.filename).name
                out_target = target_dir / filename
                out_target.write_bytes(z.read(info.filename))
                
                # Also write directly under public/media/uceed-2025/ filename
                alt_target = media_dir / filename
                alt_target.write_bytes(z.read(info.filename))
                
                extracted_count += 1

    print(f"Extracted {extracted_count} images from UCEED_2025_Test_Bank.zip into {target_dir} and {media_dir}")

    # Verify fixture images
    fixture_path = Path("fixtures/uceed-2025-official-part-a.json")
    if fixture_path.exists():
        exam = json.loads(fixture_path.read_text(encoding="utf-8"))
        missing = []
        for q in exam["questions"]:
            if "image" in q:
                rel_path = q["image"].lstrip("/")
                full_path = Path("public") / rel_path
                if not full_path.exists():
                    missing.append((q["id"], q["image"]))

        if missing:
            print(f"WARNING: Missing {len(missing)} images referenced in 2025 fixture:")
            for qid, img in missing:
                print(f"  - {qid}: {img}")
        else:
            print("SUCCESS: All image paths in fixtures/uceed-2025-official-part-a.json verified on disk!")

if __name__ == "__main__":
    extract_uceed_2025_zip()
