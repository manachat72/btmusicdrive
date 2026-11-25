"""
ขั้นตรวจงานแบบวัดผลได้ของระบบทำวิดีโอ (ส่วนที่ต้องใช้ "ตา" เอเจนต์ video-qa ทำต่อจากเฟรมที่ได้)

    py -3.12 scripts/video/qa-check.py BT-ST-04-043

อ่าน videos/flow/<SKU>/video.mp4 + script.json → เขียน qa-auto.json และ qa-frames/*.jpg
เช็ก: ความยาว, สัดส่วน 9:16, มีเสียง, ถอดเสียงไทย (faster-whisper) เทียบกับบทพูด
"""
import difflib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

MIN_SEC, MAX_SEC = 6.0, 20.0
MIN_VO_MATCH = 0.55  # whisper ไทยไม่เป๊ะ ตั้งเกณฑ์ไว้แค่ "พูดเรื่องเดียวกัน"


def ffprobe(video):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(video)],
        capture_output=True, text=True, check=True,
    ).stdout
    return json.loads(out)


def norm(text):
    return re.sub(r"[\s\W_]+", "", text or "")


def transcribe(video):
    from faster_whisper import WhisperModel

    model = WhisperModel("small", device="cpu", compute_type="int8")
    segments, _ = model.transcribe(str(video), language="th", vad_filter=True)
    return "".join(s.text for s in segments).strip()


def main():
    if len(sys.argv) < 2:
        print("usage: py -3.12 scripts/video/qa-check.py <SKU>")
        sys.exit(1)
    sku = sys.argv[1].upper()
    job = ROOT / "videos" / "flow" / sku
    video = job / "video.mp4"
    if not video.exists():
        print(f"✗ ไม่พบ {video}")
        sys.exit(1)

    script = json.loads((job / "script.json").read_text(encoding="utf-8")) if (job / "script.json").exists() else {}
    probe = ffprobe(video)
    v = next((s for s in probe["streams"] if s["codec_type"] == "video"), {})
    has_audio = any(s["codec_type"] == "audio" for s in probe["streams"])
    duration = float(probe["format"].get("duration", 0))
    w, h = int(v.get("width", 0)), int(v.get("height", 0))

    frames_dir = job / "qa-frames"
    frames_dir.mkdir(exist_ok=True)
    frames = []
    for i, frac in enumerate((0.1, 0.5, 0.9)):
        out = frames_dir / f"frame-{i + 1}.jpg"
        subprocess.run(
            ["ffmpeg", "-y", "-v", "error", "-ss", f"{duration * frac:.2f}", "-i", str(video), "-frames:v", "1", "-q:v", "3", str(out)],
            check=True,
        )
        frames.append(str(out.relative_to(ROOT)).replace("\\", "/"))

    transcript = transcribe(video) if has_audio else ""
    expected = script.get("voiceover", "")
    match = difflib.SequenceMatcher(None, norm(expected), norm(transcript)).ratio() if expected else None

    checks = {
        "duration": {"value": round(duration, 2), "pass": MIN_SEC <= duration <= MAX_SEC},
        "vertical_9_16": {"value": f"{w}x{h}", "pass": h > w and abs(w / h - 9 / 16) < 0.03},
        "has_audio": {"value": has_audio, "pass": has_audio},
        "voiceover_match": {
            "value": None if match is None else round(match, 2),
            "pass": match is None or match >= MIN_VO_MATCH,
        },
    }
    result = {
        "sku": sku,
        "pass": all(c["pass"] for c in checks.values()),
        "checks": checks,
        "transcript": transcript,
        "expectedVoiceover": expected,
        "frames": frames,
    }
    (job / "qa-auto.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    for k, c in checks.items():
        print(f"{'✓' if c['pass'] else '✗'} {k}: {c['value']}")
    print("PASS" if result["pass"] else "FAIL")


if __name__ == "__main__":
    main()
