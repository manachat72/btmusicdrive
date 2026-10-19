"""Core file naming and saving logic for BT Cover Auto Saver."""

from __future__ import annotations

import ntpath
from pathlib import Path

from PIL import Image, ImageOps


DEFAULT_DESTINATION = Path(r"Z:\photos\Product\output\01input\_generated\_album\_covers")


def sku_filename(sku: str) -> str:
    """Return a PNG filename from the numeric segment after the final SKU dash."""
    value = str(sku or "").strip()
    final_segment = value.rsplit("-", 1)[-1].strip()
    if not final_segment.isdigit():
        raise ValueError("SKU ต้องลงท้ายด้วยตัวเลขหลังขีด (-)")
    return f"{int(final_segment)}.png"


def destination_for_sku(sku: str, destination_dir: str | Path = DEFAULT_DESTINATION) -> Path:
    return Path(destination_dir) / sku_filename(sku)


def ensure_destination_ready(destination_dir: str | Path) -> Path:
    """Verify a Windows drive is mounted before creating the requested destination folder."""
    destination = Path(destination_dir)
    drive, _ = ntpath.splitdrive(str(destination))
    if drive:
        drive_root = Path(f"{drive}\\")
        if not drive_root.is_dir():
            raise OSError(f"ไม่พบไดรฟ์ {drive} กรุณาตรวจสอบว่าไดรฟ์ Z: พร้อมใช้งาน")
    try:
        destination.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise OSError(f"ไม่สามารถเข้าถึงโฟลเดอร์ปลายทาง: {destination}\n{exc}") from exc
    if not destination.is_dir():
        raise OSError(f"โฟลเดอร์ปลายทางใช้งานไม่ได้: {destination}")
    return destination


def save_cover(
    source_path: str | Path,
    sku: str,
    destination_dir: str | Path = DEFAULT_DESTINATION,
) -> Path:
    """Convert an image to PNG and overwrite its SKU-derived destination path."""
    source = Path(source_path)
    if not source.is_file():
        raise FileNotFoundError(f"ไม่พบไฟล์ภาพ: {source}")

    destination = ensure_destination_ready(destination_dir)
    target = destination_for_sku(sku, destination)
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened)
        image.save(target, "PNG")
    return target
