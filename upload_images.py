"""
upload_images.py - GUI สำหรับอัปโหลดรูปสินค้า
รัน: py upload_images.py
"""

import os, json, shutil, subprocess, sys
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext

BASE = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(BASE, "products.json")
INPUT_DIR = os.path.join(BASE, "รูปสินค้า")
CONFIG_PATH = os.path.join(BASE, "server", ".env.local")

def load_env(key):
    if not os.path.exists(CONFIG_PATH):
        return ""
    with open(CONFIG_PATH, encoding="utf-8") as f:
        for line in f:
            if line.startswith(f"{key}="):
                v = line.split("=", 1)[1].strip()
                return v.strip('"').strip("'")
    return ""

CF_ZONE = load_env("CLOUDFLARE_ZONE_ID")
CF_TOKEN = load_env("CLOUDFLARE_API_TOKEN")

# โหลดรายการสินค้า
def load_products():
    with open(JSON_PATH, encoding="utf-8") as f:
        products = json.load(f)
    return sorted(products, key=lambda p: p.get("name", ""))

# ─── GUI ──────────────────────────────────────────────────
root = tk.Tk()
root.title("อัปโหลดรูปสินค้า - btmusicdrive")
root.geometry("700x550")

products = load_products()
product_options = [f"{p['name']}  ({p['slug']})" for p in products]
selected_files = []

# ── เลือกสินค้า ─────────────────────────────────
tk.Label(root, text="1. เลือกสินค้า:", font=("Arial", 11, "bold")).pack(anchor="w", padx=15, pady=(15, 5))

search_var = tk.StringVar()
combo = ttk.Combobox(root, values=product_options, width=90, textvariable=search_var)
combo.pack(padx=15, fill="x")

def filter_options(*_):
    q = search_var.get().lower()
    filtered = [o for o in product_options if q in o.lower()]
    combo["values"] = filtered if filtered else product_options

combo.bind("<KeyRelease>", filter_options)

# ── เลือกไฟล์ ─────────────────────────────────
tk.Label(root, text="2. เลือกไฟล์รูปภาพ (เลือกหลายไฟล์ได้):", font=("Arial", 11, "bold")).pack(anchor="w", padx=15, pady=(15, 5))

files_frame = tk.Frame(root)
files_frame.pack(padx=15, fill="x")

files_label = tk.Label(files_frame, text="ยังไม่ได้เลือกไฟล์", fg="gray", anchor="w")
files_label.pack(side="left", fill="x", expand=True)

def pick_files():
    global selected_files
    files = filedialog.askopenfilenames(
        title="เลือกรูปภาพ",
        filetypes=[("Images", "*.jpg *.jpeg *.png *.webp *.avif *.bmp")]
    )
    if files:
        selected_files = list(files)
        files_label.config(text=f"เลือกแล้ว {len(files)} ไฟล์", fg="black")

tk.Button(files_frame, text="📁 เลือกไฟล์", command=pick_files, width=15).pack(side="right")

# ── log output ─────────────────────────────────
tk.Label(root, text="ผลการทำงาน:", font=("Arial", 11, "bold")).pack(anchor="w", padx=15, pady=(15, 5))
log = scrolledtext.ScrolledText(root, height=12, font=("Consolas", 9))
log.pack(padx=15, fill="both", expand=True)

def append_log(text):
    log.insert("end", text + "\n")
    log.see("end")
    root.update()

# ── ปุ่มอัปโหลด ─────────────────────────────────
def do_upload():
    sel = combo.get()
    if not sel:
        messagebox.showwarning("ผิดพลาด", "กรุณาเลือกสินค้า")
        return
    if not selected_files:
        messagebox.showwarning("ผิดพลาด", "กรุณาเลือกไฟล์รูป")
        return

    # ดึง slug จาก option
    slug = sel.rsplit("(", 1)[-1].rstrip(")")
    log.delete("1.0", "end")
    append_log(f"=== {slug} ===")

    # คัดลอกไฟล์ไป รูปสินค้า/{slug}/
    dst = os.path.join(INPUT_DIR, slug)
    if os.path.exists(dst):
        shutil.rmtree(dst)
    os.makedirs(dst)

    for i, f in enumerate(selected_files, 1):
        ext = os.path.splitext(f)[1]
        # ตั้งชื่อเป็น 1, 2, 3... เพื่อให้ลำดับถูกต้อง
        shutil.copy(f, os.path.join(dst, f"{i:02d}{ext}"))
    append_log(f"คัดลอก {len(selected_files)} ไฟล์ → รูปสินค้า/{slug}/")

    # รัน add_product.py
    append_log("กำลังแปลงรูป + อัปเดต DB + push Vercel...")
    btn.config(state="disabled", text="กำลังทำงาน...")
    root.update()

    proc = subprocess.run(
        [sys.executable, os.path.join(BASE, "add_product.py")],
        capture_output=True, text=True,
        encoding="utf-8", errors="replace", cwd=BASE
    )
    append_log(proc.stdout or "")
    if proc.stderr:
        append_log("[stderr] " + proc.stderr[:500])

    # purge Cloudflare cache
    if CF_ZONE and CF_TOKEN:
        append_log("ล้าง Cloudflare cache...")
        purge = subprocess.run(
            ["curl", "-s", "-X", "POST",
             f"https://api.cloudflare.com/client/v4/zones/{CF_ZONE}/purge_cache",
             "-H", f"Authorization: Bearer {CF_TOKEN}",
             "-H", "Content-Type: application/json",
             "--data", '{"purge_everything":true}'],
            capture_output=True, text=True
        )
        if '"success":true' in (purge.stdout or ""):
            append_log("ล้าง cache สำเร็จ")
        else:
            append_log("ล้าง cache ไม่สำเร็จ: " + (purge.stdout or "")[:200])
    else:
        append_log("ข้าม Cloudflare cache (ไม่มี config ใน server/.env.local)")

    append_log("\n เสร็จสมบูรณ์! รอ Vercel deploy 1-2 นาทีแล้วเปิดดูหน้าเว็บ")
    btn.config(state="normal", text="อัปโหลดและส่งขึ้นเว็บ")

btn = tk.Button(root, text="อัปโหลดและส่งขึ้นเว็บ",
                command=do_upload, bg="#16a34a", fg="white",
                font=("Arial", 12, "bold"), height=2)
btn.pack(padx=15, pady=15, fill="x")

root.mainloop()
