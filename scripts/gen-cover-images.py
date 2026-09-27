#!/usr/bin/env python
"""เจนรูปปกสินค้าจากพรอมของ skill `ทำปก`

ใช้:
    python scripts/gen-cover-images.py <spec.json>

spec.json:
    {"sku": "BT-PC-04-040",
     "scenes": {"A-pickup-field": "<พรอมฉาก A>", "B-...": "<พรอม B>"}}

- NEGATIVE มาตรฐานถูกต่อท้ายให้อัตโนมัติ ไม่ต้องใส่มาใน scenes
- โมเดล gpt-image-2 → fallback gpt-image-1
- ต้องมี env OPENAI_API_KEY (ห้าม hardcode / ห้ามแปะ key ในแชต)
- ไฟล์ออกที่ cover-output/<sku>-<key>.png ขนาด 1024x1024
"""
import sys, json, base64, pathlib
from openai import OpenAI

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "cover-output"

NEGATIVE = (
    "Do NOT include any of the following: real person's face, celebrity likeness, "
    "recognizable album cover, band logos, brand names, headstock logo, trademarks, "
    "emblem or mascot crest, readable text of any language, watermark, signature, "
    "record label mark, cartoon characters, busy detail in the bottom third, "
    "clutter in the top-left and top-right corners."
)


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2

    spec = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    sku = spec["sku"]
    scenes = spec["scenes"]
    OUT.mkdir(parents=True, exist_ok=True)

    client = OpenAI()
    failed = 0

    for key, scene in scenes.items():
        prompt = f"{scene}\n\n{NEGATIVE}"
        result = None
        for model in ("gpt-image-2", "gpt-image-1"):
            try:
                r = client.images.generate(
                    model=model, prompt=prompt, size="1024x1024", n=1
                )
                result = (model, r.data[0].b64_json)
                break
            except Exception as e:
                print(f"[{key}] {model} FAIL: {type(e).__name__}: {str(e)[:200]}", flush=True)
        if not result:
            print(f"[{key}] ไม่สำเร็จทุกโมเดล", flush=True)
            failed += 1
            continue
        model, b64 = result
        path = OUT / f"{sku}-{key}.png"
        path.write_bytes(base64.b64decode(b64))
        print(f"[{key}] OK via {model} -> {path} ({path.stat().st_size // 1024} KB)", flush=True)

    print("DONE" if not failed else f"DONE ({failed} ล้มเหลว)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
