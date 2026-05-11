"""
add_product.py - ลงสินค้าใหม่ / อัปเดตรูปสินค้า
วิธีใช้:
  1. วางรูปไว้ใน  รูปสินค้า/{slug}/
  2. วางไฟล์     รูปสินค้า/{slug}/info.json  (ถ้าเป็นสินค้าใหม่)
  3. รัน: py add_product.py
"""

import os, sys, json, uuid, shutil
from PIL import Image

BASE       = os.path.dirname(os.path.abspath(__file__))
INPUT_DIR  = os.path.join(BASE, "รูปสินค้า")
OUTPUT_DIR = os.path.join(BASE, "images", "products")
JSON_PATH  = os.path.join(BASE, "products.json")
TMPL_PATH  = os.path.join(BASE, "info.example.json")

MAX_SIZE = (800, 800)

# ---- สร้าง info.example.json ให้เป็นตัวอย่าง ----
EXAMPLE = {
    "name":          "USB แฟลชไดรฟ์ MP3 ชื่อสินค้า",
    "slug":          "usb-mp3-slug-สินค้า",
    "price":         279,
    "originalPrice": 399,
    "description":   "คำอธิบายสินค้า MP3 128kbps รับประกัน 100%",
    "sku":           "SKU-000",
    "capacity":      "1GB",
    "categoryId":    "3",
    "categoryName":  "เพลงสตริง",
    "tags":          ["USB", "MP3"],
    "tracklist":     [],
    "_categories": {
        "1": "เพื่อชีวิต", "3": "เพลงสตริง", "5": "เพลงใต้",
        "6": "เพลงสากล",  "7": "ลูกกรุง",   "8": "ลูกทุ่ง",
        "9": "อุปกรณ์เสริม", "10": "แดนซ์",  "11": "วิทยุ", "12": "ธรรมะ"
    }
}

def write_example():
    with open(TMPL_PATH, "w", encoding="utf-8") as f:
        json.dump(EXAMPLE, f, ensure_ascii=False, indent=2)

def process_images(src_folder, slug):
    exts = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".bmp"}
    files = sorted([
        f for f in os.listdir(src_folder)
        if os.path.isfile(os.path.join(src_folder, f))
        and os.path.splitext(f)[1].lower() in exts
    ])
    if not files:
        return []

    dst_folder = os.path.join(OUTPUT_DIR, slug)
    os.makedirs(dst_folder, exist_ok=True)

    paths = []
    for i, fname in enumerate(files, 1):
        src = os.path.join(src_folder, fname)
        base = f"{slug}-{i}"
        img  = Image.open(src).convert("RGB")
        img.thumbnail(MAX_SIZE, Image.LANCZOS)

        img.save(os.path.join(dst_folder, f"{base}.jpg"),  "JPEG", quality=85, optimize=True)
        img.save(os.path.join(dst_folder, f"{base}.webp"), "WEBP", quality=82, method=6)
        img.save(os.path.join(dst_folder, f"{base}.avif"), "AVIF", quality=70)

        orig_kb = os.path.getsize(src) // 1024
        jpg_kb  = os.path.getsize(os.path.join(dst_folder, f"{base}.jpg")) // 1024
        print(f"    {fname} ({orig_kb}KB) -> {base}.jpg/webp/avif ({jpg_kb}KB)")
        paths.append(f"/images/products/{slug}/{base}.jpg")

    return paths

def main():
    os.makedirs(INPUT_DIR, exist_ok=True)
    write_example()

    folders = [
        d for d in os.listdir(INPUT_DIR)
        if os.path.isdir(os.path.join(INPUT_DIR, d))
    ]

    if not folders:
        print("=" * 55)
        print("ไม่พบโฟลเดอร์ใน รูปสินค้า/")
        print()
        print("วิธีใช้:")
        print("  1. สร้างโฟลเดอร์ใน รูปสินค้า/  ชื่อเป็น slug")
        print("     เช่น  รูปสินค้า/usb-mp3-carabao/")
        print("  2. วางรูปภาพลงในโฟลเดอร์")
        print("  3. ถ้าเป็นสินค้าใหม่ ให้วาง info.json ลงด้วย")
        print("     (ดูตัวอย่างที่ info.example.json)")
        print("  4. รัน: py add_product.py")
        print("=" * 55)
        return

    with open(JSON_PATH, encoding="utf-8") as f:
        products = json.load(f)
    existing = {p["slug"]: p for p in products}

    for folder in folders:
        src_folder = os.path.join(INPUT_DIR, folder)
        info_file  = os.path.join(src_folder, "info.json")

        print()
        print("=" * 55)
        print(f"  {folder}")
        print("=" * 55)

        # อ่าน info.json ถ้ามี
        info = None
        if os.path.exists(info_file):
            with open(info_file, encoding="utf-8") as f:
                info = json.load(f)

        slug = (info.get("slug") if info else None) or folder.lower().replace(" ", "-")

        # ถ้า slug ไม่ตรง ลอง match จาก SKU ที่ฝังในชื่อโฟลเดอร์ เช่น sku-077
        if slug not in existing:
            import re
            sku_match = re.search(r'sku[-_](\d+)', folder, re.IGNORECASE)
            if sku_match:
                sku_num = f"SKU-{sku_match.group(1)}"
                found = next((p for p in products if p.get("sku","").upper() == sku_num), None)
                if found:
                    slug = found["slug"]
                    print(f"  match SKU {sku_num} -> slug: {slug}")

        print(f"  slug : {slug}")

        # ประมวลผลรูป
        print("  แปลงรูป...")
        image_paths = process_images(src_folder, slug)
        if not image_paths:
            print("  [ข้าม] ไม่พบรูปภาพ")
            continue

        # อัปเดตหรือสร้างใหม่
        if slug in existing:
            existing[slug]["imageUrl"] = image_paths[0]
            existing[slug]["images"]   = image_paths
            print(f"  [อัปเดต] รูปสินค้า '{slug}'")
        elif info:
            cap = info.get("capacity", "1GB")
            new_product = {
                "id":            str(uuid.uuid4()),
                "name":          info.get("name", slug),
                "slug":          slug,
                "price":         info.get("price", 279),
                "originalPrice": info.get("originalPrice", 399),
                "description":   info.get("description", ""),
                "imageUrl":      image_paths[0],
                "images":        image_paths,
                "brand":         "btmusicdrive",
                "sku":           info.get("sku", ""),
                "stock":         100,
                "tags":          info.get("tags", ["USB", "MP3"]),
                "tracklist":     info.get("tracklist", []),
                "specs": {
                    "ความจุ":    cap,
                    "รองรับ":   "เครื่องเสียงรถยนต์ / คอมพิวเตอร์ / ลำโพง",
                    "รูปแบบ":   "USB แฟลชไดรฟ์ 2.0",
                    "แบรนด์":   "btmusicdrive",
                    "ไฟล์เพลง": "MP3 128kbps",
                },
                "categoryId": info.get("categoryId", "3"),
                "category": {
                    "id":   info.get("categoryId", "3"),
                    "name": info.get("categoryName", "เพลงสตริง"),
                },
            }
            products.append(new_product)
            existing[slug] = new_product
            print(f"  [ใหม่] เพิ่มสินค้า '{slug}'")
        else:
            print(f"  [!] ไม่มี info.json — สร้างรูปแต่ไม่อัปเดต products.json")
            print(f"      วาง info.json แล้วรันใหม่เพื่อสร้างสินค้าใน products.json")

        # บันทึก JSON
        with open(JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(products, f, ensure_ascii=False, indent=2)

        # ลบโฟลเดอร์ต้นทาง
        shutil.rmtree(src_folder)
        print(f"  เสร็จ! รูปอยู่ที่ images/products/{slug}/")

    print()
    print("=" * 55)
    print("  เสร็จสิ้นทุกโฟลเดอร์")
    print("=" * 55)

if __name__ == "__main__":
    main()
