"""
add_product.py — ลงสินค้าใหม่หรืออัปเดตรูปสินค้า btmusicdrive
วิธีใช้: py add_product.py
"""

import os, sys, json, uuid, shutil
from PIL import Image

BASE       = os.path.dirname(os.path.abspath(__file__))
INPUT_DIR  = os.path.join(BASE, "รูปสินค้า")
OUTPUT_DIR = os.path.join(BASE, "images", "products")
JSON_PATH  = os.path.join(BASE, "products.json")

MAX_SIZE = (800, 800)
QUALITY  = {"jpg": 85, "webp": 82, "avif": 70}

CATEGORIES = {
    "1":  "เพื่อชีวิต",
    "3":  "เพลงสตริง",
    "5":  "เพลงใต้",
    "6":  "เพลงสากล",
    "7":  "ลูกกรุง",
    "8":  "ลูกทุ่ง",
    "9":  "อุปกรณ์เสริม",
    "10": "แดนซ์",
    "11": "วิทยุ",
    "12": "ธรรมะ",
}

def hr(): print("-" * 55)

def ask(prompt, default=None):
    suffix = f" [{default}]" if default else ""
    val = input(f"{prompt}{suffix}: ").strip()
    return val or default

def pick_category():
    print("\nหมวดหมู่:")
    for cid, name in CATEGORIES.items():
        print(f"  {cid:>2}. {name}")
    cid = ask("เลือกหมวด (ใส่ตัวเลข)")
    return cid, CATEGORIES.get(cid, "")

def process_images(src_folder, slug):
    """Resize + แปลง 3 format + rename"""
    image_exts = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".bmp"}
    files = sorted([
        f for f in os.listdir(src_folder)
        if os.path.splitext(f)[1].lower() in image_exts
    ])
    if not files:
        print("  ไม่พบไฟล์รูปภาพ")
        return []

    dst_folder = os.path.join(OUTPUT_DIR, slug)
    os.makedirs(dst_folder, exist_ok=True)

    paths = []
    print(f"\n  แปลง {len(files)} รูป → images/products/{slug}/")
    hr()
    for i, fname in enumerate(files, 1):
        src = os.path.join(src_folder, fname)
        base = f"{slug}-{i}"

        img = Image.open(src).convert("RGB")
        orig_size = img.size
        img.thumbnail(MAX_SIZE, Image.LANCZOS)

        results = []
        for fmt in ("jpg", "webp", "avif"):
            dst = os.path.join(dst_folder, f"{base}.{fmt}")
            pil_fmt = "JPEG" if fmt == "jpg" else fmt.upper()
            img.save(dst, pil_fmt, quality=QUALITY[fmt],
                     **({"optimize": True} if fmt == "jpg" else {}))
            kb = os.path.getsize(dst) // 1024
            results.append(f"{fmt}:{kb}KB")

        orig_kb = os.path.getsize(src) // 1024
        print(f"  {fname} ({orig_kb}KB) → {base} | {' | '.join(results)}")
        paths.append(f"/images/products/{slug}/{base}.jpg")

    return paths

def update_json(slug, image_paths, new_entry=None):
    with open(JSON_PATH, encoding="utf-8") as f:
        products = json.load(f)

    existing = next((p for p in products if p.get("slug") == slug), None)

    if existing:
        existing["imageUrl"] = image_paths[0]
        existing["images"]   = image_paths
        print(f"\n  อัปเดตรูปสินค้า '{slug}' ใน products.json แล้ว")
    elif new_entry:
        new_entry["imageUrl"] = image_paths[0]
        new_entry["images"]   = image_paths
        products.append(new_entry)
        print(f"\n  เพิ่มสินค้าใหม่ '{slug}' ใน products.json แล้ว")
    else:
        print("  ไม่มีสินค้าและไม่มีข้อมูลใหม่ — ข้ามการอัปเดต JSON")
        return

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)

def collect_new_product_info(slug):
    print("\n--- ข้อมูลสินค้าใหม่ ---")
    name    = ask("ชื่อสินค้า (ภาษาไทย)")
    price   = int(ask("ราคาขาย (บาท)", "279"))
    orig    = int(ask("ราคาเต็ม (บาท)", "399"))
    desc    = ask("คำอธิบายสั้นๆ", f"USB แฟลชไดรฟ์ MP3 {name} เสียงชัด 128kbps รับประกัน 100%")
    sku_no  = ask("รหัส SKU", f"SKU-{slug[-3:]}")
    capacity= ask("ความจุ", "1GB")
    cat_id, cat_name = pick_category()

    return {
        "id":          str(uuid.uuid4()),
        "name":        name,
        "slug":        slug,
        "price":       price,
        "originalPrice": orig,
        "description": desc,
        "imageUrl":    "",
        "images":      [],
        "brand":       "btmusicdrive",
        "sku":         sku_no,
        "stock":       100,
        "tags":        ["USB", "MP3"],
        "tracklist":   [],
        "specs": {
            "ความจุ":  capacity,
            "รองรับ":  "เครื่องเสียงรถยนต์ / คอมพิวเตอร์ / ลำโพง",
            "รูปแบบ":  "USB แฟลชไดรฟ์ 2.0",
            "แบรนด์":  "btmusicdrive",
            "ไฟล์เพลง": "MP3 128kbps",
        },
        "categoryId": cat_id,
        "category":   {"id": cat_id, "name": cat_name},
    }

def main():
    print("=" * 55)
    print("  btmusicdrive — เพิ่ม/อัปเดตรูปสินค้า")
    print("=" * 55)

    # ตรวจโฟลเดอร์ input
    os.makedirs(INPUT_DIR, exist_ok=True)
    pending = [
        d for d in os.listdir(INPUT_DIR)
        if os.path.isdir(os.path.join(INPUT_DIR, d))
    ]

    if not pending:
        print(f"\nไม่พบโฟลเดอร์ใน รูปสินค้า/")
        print(f"วางรูปที่ต้องการลงใน: {INPUT_DIR}")
        print(f"ตั้งชื่อโฟลเดอร์เป็น slug สินค้า เช่น: usb-mp3-bodyslam")
        sys.exit(0)

    print(f"\nพบโฟลเดอร์รอดำเนินการ:")
    for i, d in enumerate(pending, 1):
        n = len([f for f in os.listdir(os.path.join(INPUT_DIR, d))
                 if os.path.splitext(f)[1].lower() in {".jpg",".jpeg",".png",".webp",".avif",".bmp"}])
        print(f"  {i}. {d}  ({n} รูป)")

    hr()

    with open(JSON_PATH, encoding="utf-8") as f:
        products = json.load(f)
    existing_slugs = {p["slug"] for p in products}

    for folder in pending:
        src_folder = os.path.join(INPUT_DIR, folder)
        print(f"\n>> โฟลเดอร์: {folder}")

        # ถามหรือยืนยัน slug
        slug = ask("Slug สินค้า", folder.lower().replace(" ", "-"))

        is_existing = slug in existing_slugs
        if is_existing:
            print(f"  พบสินค้า '{slug}' อยู่แล้ว — จะอัปเดตรูปเท่านั้น")
            new_entry = None
        else:
            print(f"  ไม่พบสินค้า '{slug}' — จะสร้างรายการใหม่")
            add_new = ask("สร้างสินค้าใหม่ใน products.json ด้วยไหม? (y/n)", "y")
            new_entry = collect_new_product_info(slug) if add_new == "y" else None

        # Preview
        image_files = sorted([
            f for f in os.listdir(src_folder)
            if os.path.splitext(f)[1].lower() in {".jpg",".jpeg",".png",".webp",".avif",".bmp"}
        ])
        print(f"\n  จะแปลงรูป {len(image_files)} ไฟล์:")
        for i, f in enumerate(image_files, 1):
            print(f"    {f}  →  {slug}-{i}.jpg / .webp / .avif")

        confirm = ask("\nดำเนินการต่อ? (y/n)", "y")
        if confirm.lower() != "y":
            print("  ข้ามโฟลเดอร์นี้")
            continue

        # ประมวลผล
        image_paths = process_images(src_folder, slug)
        if not image_paths:
            continue

        update_json(slug, image_paths, new_entry)

        # ลบโฟลเดอร์ต้นทาง
        shutil.rmtree(src_folder)
        print(f"  ลบโฟลเดอร์ต้นทาง '{folder}' แล้ว")

    hr()
    print("\nเสร็จสิ้น!")
    print(f"รูปทั้งหมดอยู่ที่: images/products/")
    print(f"ข้อมูลสินค้าอยู่ที่: products.json")

if __name__ == "__main__":
    main()
