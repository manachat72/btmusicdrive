"""
add_product.py - ลงสินค้าใหม่ / อัปเดตรูปสินค้า
วิธีใช้:
  1. วางรูปไว้ใน  รูปสินค้า/{slug}/
  2. วางไฟล์     รูปสินค้า/{slug}/info.json  (ถ้าเป็นสินค้าใหม่)
  3. รัน: py add_product.py
"""

import os, sys, json, uuid, shutil, subprocess, hashlib, glob
from PIL import Image, ImageOps

BASE       = os.path.dirname(os.path.abspath(__file__))
INPUT_DIR  = os.path.join(BASE, "รูปสินค้า")
OUTPUT_DIR = os.path.join(BASE, "images", "products")
JSON_PATH  = os.path.join(BASE, "products.json")
TMPL_PATH  = os.path.join(BASE, "info.example.json")

WEBP_QUALITY = 84
PRODUCT_IMAGE_SIZE = 1000
PRODUCT_IMAGE_PADDING = 40

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
    if os.path.exists(dst_folder):
        shutil.rmtree(dst_folder)
    os.makedirs(dst_folder, exist_ok=True)

    paths = []
    errors = []
    for i, fname in enumerate(files, 1):
        src = os.path.join(src_folder, fname)
        try:
            with open(src, "rb") as f:
                digest = hashlib.sha1(f.read()).hexdigest()[:8]
            ext = os.path.splitext(fname)[1].lower()
            base = f"{slug}-{len(paths) + 1}-{digest}"
            out = os.path.join(dst_folder, f"{base}.webp")
            with Image.open(src) as img:
                img = ImageOps.exif_transpose(img)
                if img.mode not in ("RGB", "RGBA"):
                    img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
                if img.mode == "RGBA":
                    white_base = Image.new("RGBA", img.size, (255, 255, 255, 255))
                    white_base.alpha_composite(img)
                    img = white_base.convert("RGB")
                else:
                    img = img.convert("RGB")

                fit_size = PRODUCT_IMAGE_SIZE - (PRODUCT_IMAGE_PADDING * 2)
                img = ImageOps.contain(img, (fit_size, fit_size), Image.Resampling.LANCZOS)
                canvas = Image.new("RGB", (PRODUCT_IMAGE_SIZE, PRODUCT_IMAGE_SIZE), "white")
                x = (PRODUCT_IMAGE_SIZE - img.width) // 2
                y = (PRODUCT_IMAGE_SIZE - img.height) // 2
                canvas.paste(img, (x, y))
                canvas.save(out, "WEBP", quality=WEBP_QUALITY, method=6)

            orig_kb = os.path.getsize(src) // 1024
            webp_kb = os.path.getsize(out) // 1024
            print(f"    {fname} ({orig_kb}KB) -> {base}.webp ({webp_kb}KB)")
            paths.append(f"/images/products/{slug}/{base}.webp")
        except Exception as err:
            errors.append((fname, str(err)))
            print(f"    [ข้าม] {fname}: {err}")

    if errors:
        print("  [!] มีรูปที่แปลงไม่ได้:")
        for fname, err in errors:
            print(f"      - {fname}: {err}")

    return paths

def main():
    os.makedirs(INPUT_DIR, exist_ok=True)
    write_example()
    had_error = False
    processed_slugs = []
    target_slug = sys.argv[1] if len(sys.argv) > 1 else None

    folders = [
        d for d in os.listdir(INPUT_DIR)
        if os.path.isdir(os.path.join(INPUT_DIR, d))
    ]
    if target_slug:
        folders = [d for d in folders if d == target_slug]

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
                found = next((p for p in products if (p.get("sku") or "").upper() == sku_num), None)
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

        # อัปเดตรูปเข้า DB อัตโนมัติ
        script = os.path.join(BASE, "scripts", "push-images-to-db.js")
        result = subprocess.run(["node", script, slug], capture_output=True, text=True, encoding='utf-8', errors='replace', cwd=BASE)
        if result.returncode == 0:
            print(f"  {(result.stdout or '').strip()}")
        else:
            print(f"  [!] push-images-to-db ล้มเหลว: {(result.stderr or '')[:200]}")
            had_error = True

        processed_slugs.append(slug)

        # ลบโฟลเดอร์ต้นทาง
        shutil.rmtree(src_folder)

        print(f"  เสร็จ! รูปอยู่ที่ images/products/{slug}/")

    if processed_slugs:
        print()
        print("  รัน build เพื่ออัปเดต products inline + cache-busting...")
        npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
        r_build = subprocess.run([npm_cmd, "run", "build"], capture_output=True, text=True, encoding='utf-8', errors='replace', cwd=BASE)
        if r_build.returncode == 0:
            print("  build สำเร็จ")
        else:
            print(f"  [!] npm run build ล้มเหลว: {((r_build.stdout or '') + (r_build.stderr or ''))[:500]}")
            had_error = True

        # git commit + push
        paths_to_add = ["products.json"]
        for slug in processed_slugs:
            paths_to_add.append(f"images/products/{slug}")
        paths_to_add.extend([os.path.basename(p) for p in glob.glob(os.path.join(BASE, "*.html"))])
        for asset in ["app.min.css", "tailwind.min.css", "tailwind.css", "sitemap.xml"]:
            if os.path.exists(os.path.join(BASE, asset)):
                paths_to_add.append(asset)

        r_add = subprocess.run(["git", "add", *paths_to_add], capture_output=True, text=True, encoding='utf-8', errors='replace', cwd=BASE)
        if r_add.returncode != 0:
            print(f"  [!] git add ล้มเหลว: {(r_add.stderr or r_add.stdout or '')[:200]}")
            had_error = True

        commit_slug = processed_slugs[0] if len(processed_slugs) == 1 else f"{len(processed_slugs)} products"
        r_commit = subprocess.run(["git", "commit", "-m", f"update product images: {commit_slug}"], capture_output=True, text=True, encoding='utf-8', errors='replace', cwd=BASE)
        commit_output = (r_commit.stdout or "") + (r_commit.stderr or "")
        if r_commit.returncode == 0:
            print("  commit รูปแล้ว")
        elif "nothing to commit" in commit_output.lower():
            print("  ไม่มีไฟล์รูปใหม่ให้ commit")
        else:
            print(f"  [!] git commit ล้มเหลว: {commit_output[:200]}")
            had_error = True

        r_push = subprocess.run(["git", "push"], capture_output=True, text=True, encoding='utf-8', errors='replace', cwd=BASE)
        if r_push.returncode == 0:
            print(f"  push ขึ้น Vercel แล้ว")
        else:
            print(f"  [!] git push ล้มเหลว: {(r_push.stderr or '')[:200]}")
            print("  [!] ลงสินค้าและ build สำเร็จแล้ว แต่ยัง push ขึ้นเว็บไม่สำเร็จ")

    print()
    print("=" * 55)
    print("  เสร็จสิ้นทุกโฟลเดอร์")
    print("=" * 55)
    if had_error:
        sys.exit(1)

if __name__ == "__main__":
    main()
