"""BT Cover Auto Saver - Windows GUI for SKU-based cover storage."""

from __future__ import annotations

import json
import os
import subprocess
import threading
from datetime import datetime
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

from bt_cover_auto_saver_core import DEFAULT_DESTINATION, destination_for_sku, save_cover, sku_filename


APP_NAME = "BT Cover Auto Saver"
APP_DIR = Path(__file__).resolve().parent
SETTINGS_FILE = Path(os.getenv("APPDATA", Path.home())) / "BTMusicDrive" / "cover_auto_saver.json"
IMAGE_TYPES = [("ไฟล์ภาพ", "*.png *.jpg *.jpeg *.webp"), ("ทุกไฟล์", "*.*")]

BG = "#0e0f11"
PANEL = "#17191c"
RAISED = "#1f2226"
RULE = "#2b2f34"
AMBER = "#e8a33d"
TEXT = "#e7e5e1"
MUTED = "#8b9098"
OK = "#5bc98d"
ERR = "#e4675f"


def load_settings() -> dict:
    try:
        value = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError, TypeError):
        return {}


def save_settings(data: dict) -> None:
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


class CoverAutoSaverApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(APP_NAME)
        self.geometry("900x720")
        self.minsize(760, 620)
        self.configure(bg=BG)
        self.settings = load_settings()
        self._auto_after = None
        self._saving = False

        self.sku_var = tk.StringVar(value=str(self.settings.get("last_sku", "")))
        self.image_var = tk.StringVar(value="")
        self.destination_var = tk.StringVar(value=str(self.settings.get("destination", DEFAULT_DESTINATION)))
        self.filename_var = tk.StringVar(value="กรอก SKU เพื่อดูชื่อไฟล์")
        self.target_var = tk.StringVar(value="")
        self.auto_save_var = tk.BooleanVar(value=bool(self.settings.get("auto_save", False)))
        self.status_var = tk.StringVar(value="พร้อมใช้งาน")
        self.logs = list(self.settings.get("recent_logs", []))[:10]

        self._setup_theme()
        self._build_ui()
        self.sku_var.trace_add("write", self._on_sku_changed)
        self._on_sku_changed()
        self._refresh_logs()

    def _setup_theme(self):
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure("Cover.Treeview", background=RAISED, fieldbackground=RAISED, foreground=TEXT, rowheight=28)
        style.configure("Cover.Treeview.Heading", background=PANEL, foreground=MUTED, relief="flat")
        style.map("Cover.Treeview", background=[("selected", "#343942")], foreground=[("selected", TEXT)])

    def _button(self, parent, text, command, primary=False, **kwargs):
        bg = AMBER if primary else RAISED
        fg = BG if primary else TEXT
        active = "#f2b65a" if primary else RULE
        button = tk.Button(
            parent, text=text, command=command, bg=bg, fg=fg,
            activebackground=active, activeforeground=fg, relief="flat", bd=0,
            highlightthickness=0, cursor="hand2", font=("Leelawadee UI", 10, "bold"), **kwargs,
        )
        button.bind("<Enter>", lambda _event: button.config(bg=active))
        button.bind("<Leave>", lambda _event: button.config(bg=bg))
        return button

    def _entry(self, parent, variable, readonly=False):
        return tk.Entry(
            parent, textvariable=variable, bg=RAISED, fg=TEXT,
            disabledbackground=RAISED, disabledforeground=MUTED,
            insertbackground=AMBER, relief="flat", bd=0, highlightthickness=1,
            highlightbackground=RULE, highlightcolor=AMBER, font=("Consolas", 10),
            state="readonly" if readonly else "normal",
        )

    def _row(self, parent, label):
        row = tk.Frame(parent, bg=PANEL)
        row.pack(fill="x", padx=22, pady=9)
        tk.Label(row, text=label, bg=PANEL, fg=TEXT, width=19, anchor="w", font=("Leelawadee UI", 10)).pack(side="left")
        return row

    def _build_ui(self):
        header = tk.Frame(self, bg=BG)
        header.pack(fill="x", padx=26, pady=(22, 16))
        tk.Label(header, text="BT MUSIC DRIVE", bg=BG, fg=AMBER, font=("Consolas", 9, "bold")).pack(anchor="w")
        tk.Label(header, text=APP_NAME, bg=BG, fg=TEXT, font=("Leelawadee UI", 19, "bold")).pack(anchor="w", pady=(4, 0))
        tk.Label(
            header, text="บันทึกภาพปกเป็น PNG ตามเลขท้าย SKU โดยเขียนทับไฟล์เดิมได้",
            bg=BG, fg=MUTED, font=("Leelawadee UI", 10),
        ).pack(anchor="w", pady=(4, 0))

        form = tk.Frame(self, bg=PANEL, highlightthickness=1, highlightbackground=RULE)
        form.pack(fill="x", padx=26)

        sku_row = self._row(form, "SKU")
        self.sku_entry = self._entry(sku_row, self.sku_var)
        self.sku_entry.pack(side="left", fill="x", expand=True, ipady=8)
        self.sku_entry.focus_set()

        image_row = self._row(form, "ไฟล์ภาพ")
        self.image_entry = self._entry(image_row, self.image_var, readonly=True)
        self.image_entry.pack(side="left", fill="x", expand=True, ipady=8)
        self.pick_button = self._button(image_row, "เลือกไฟล์ภาพ", self.pick_image, width=13)
        self.pick_button.pack(side="left", padx=(8, 0), ipady=5)

        file_row = self._row(form, "ชื่อไฟล์ปลายทาง")
        tk.Label(file_row, textvariable=self.filename_var, bg=RAISED, fg=AMBER, anchor="w", padx=10, pady=8, font=("Consolas", 11, "bold")).pack(side="left", fill="x", expand=True)

        target_row = self._row(form, "บันทึกไปที่")
        self.destination_entry = self._entry(target_row, self.destination_var, readonly=True)
        self.destination_entry.pack(side="left", fill="x", expand=True, ipady=8)
        self.open_button = self._button(target_row, "Open Folder", self.open_folder, width=12)
        self.open_button.pack(side="left", padx=(8, 0), ipady=5)

        full_row = self._row(form, "ไฟล์เต็ม")
        tk.Label(full_row, textvariable=self.target_var, bg=PANEL, fg=MUTED, anchor="w", font=("Consolas", 8), wraplength=610, justify="left").pack(side="left", fill="x", expand=True)

        options = tk.Frame(form, bg=PANEL)
        options.pack(fill="x", padx=22, pady=(3, 18))
        tk.Checkbutton(
            options, text="Auto Save เมื่อ SKU และไฟล์ภาพพร้อม", variable=self.auto_save_var,
            command=self._persist_settings, bg=PANEL, fg=TEXT, activebackground=PANEL,
            activeforeground=AMBER, selectcolor=BG, bd=0, highlightthickness=0,
            font=("Leelawadee UI", 10), cursor="hand2",
        ).pack(side="left")

        actions = tk.Frame(self, bg=BG)
        actions.pack(fill="x", padx=26, pady=18)
        self.save_button = self._button(actions, "Save", self.save_manual, primary=True, width=16)
        self.save_button.pack(side="left", ipady=8)
        tk.Label(actions, textvariable=self.status_var, bg=BG, fg=MUTED, anchor="w", justify="left", font=("Leelawadee UI", 10)).pack(side="left", fill="x", expand=True, padx=14)

        logs_panel = tk.Frame(self, bg=PANEL, highlightthickness=1, highlightbackground=RULE)
        logs_panel.pack(fill="both", expand=True, padx=26, pady=(0, 24))
        log_head = tk.Frame(logs_panel, bg=PANEL)
        log_head.pack(fill="x", padx=14, pady=(13, 8))
        tk.Label(log_head, text="บันทึกล่าสุด 10 รายการ", bg=PANEL, fg=TEXT, font=("Leelawadee UI", 10, "bold")).pack(side="left")
        self.log_tree = ttk.Treeview(logs_panel, style="Cover.Treeview", columns=("time", "sku", "file"), show="headings", height=8)
        self.log_tree.heading("time", text="เวลา")
        self.log_tree.heading("sku", text="SKU")
        self.log_tree.heading("file", text="ไฟล์ที่บันทึก")
        self.log_tree.column("time", width=145, stretch=False)
        self.log_tree.column("sku", width=180, stretch=False)
        self.log_tree.column("file", width=470, stretch=True)
        self.log_tree.pack(fill="both", expand=True, padx=14, pady=(0, 14))

    def _on_sku_changed(self, *_args):
        sku = self.sku_var.get()
        try:
            filename = sku_filename(sku)
            target = destination_for_sku(sku, self.destination_var.get())
        except ValueError:
            self.filename_var.set("SKU ต้องลงท้ายด้วยตัวเลขหลังขีด (-)")
            self.target_var.set("")
        else:
            self.filename_var.set(filename)
            self.target_var.set(str(target))
        self._schedule_auto_save()

    def pick_image(self):
        path = filedialog.askopenfilename(title="เลือกภาพปก", filetypes=IMAGE_TYPES)
        if path:
            self.image_var.set(path)
            self.status_var.set(f"เลือกไฟล์: {Path(path).name}")
            self._schedule_auto_save()

    def _schedule_auto_save(self):
        if not self.auto_save_var.get() or self._saving:
            return
        if self._auto_after is not None:
            self.after_cancel(self._auto_after)
        self._auto_after = self.after(350, lambda: self._start_save(auto=True))

    def _persist_settings(self):
        save_settings({
            "last_sku": self.sku_var.get().strip(),
            "destination": self.destination_var.get(),
            "auto_save": bool(self.auto_save_var.get()),
            "recent_logs": self.logs[:10],
        })

    def _refresh_logs(self):
        self.log_tree.delete(*self.log_tree.get_children())
        for entry in self.logs:
            self.log_tree.insert("", "end", values=(entry.get("time", ""), entry.get("sku", ""), entry.get("file", "")))

    def save_manual(self):
        self._start_save(auto=False)

    def _start_save(self, auto: bool):
        self._auto_after = None
        if self._saving:
            return
        sku = self.sku_var.get().strip()
        image = self.image_var.get().strip()
        try:
            sku_filename(sku)
        except ValueError as exc:
            if not auto:
                messagebox.showwarning("SKU ไม่ถูกต้อง", str(exc), parent=self)
            self.status_var.set(str(exc))
            return
        if not image:
            if not auto:
                messagebox.showwarning("ยังไม่ได้เลือกภาพ", "กรุณาเลือกไฟล์ภาพก่อนบันทึก", parent=self)
            self.status_var.set("กรุณาเลือกไฟล์ภาพก่อนบันทึก")
            return

        self._saving = True
        self.save_button.config(state="disabled")
        self.pick_button.config(state="disabled")
        self.status_var.set("กำลังบันทึกภาพ...")
        threading.Thread(target=self._save_worker, args=(Path(image), sku, auto), daemon=True).start()

    def _save_worker(self, image: Path, sku: str, auto: bool):
        try:
            target = save_cover(image, sku, self.destination_var.get())
        except Exception as exc:
            self.after(0, self._finish_save, None, sku, auto, str(exc))
        else:
            self.after(0, self._finish_save, target, sku, auto, "")

    def _finish_save(self, target: Path | None, sku: str, auto: bool, error: str):
        self._saving = False
        self.save_button.config(state="normal")
        self.pick_button.config(state="normal")
        if error:
            self.status_var.set(f"ผิดพลาด: {error}")
            if not auto:
                messagebox.showerror("บันทึกภาพไม่สำเร็จ", error, parent=self)
            return

        self.status_var.set(f"บันทึกสำเร็จ: {target}")
        self.logs.insert(0, {
            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "sku": sku,
            "file": str(target),
        })
        self.logs = self.logs[:10]
        self._refresh_logs()
        self._persist_settings()
        if not auto:
            messagebox.showinfo("บันทึกสำเร็จ", f"บันทึกภาพแล้ว\n{target}", parent=self)

    def open_folder(self):
        folder = Path(self.destination_var.get())
        if not folder.is_dir():
            self.status_var.set(f"เปิดโฟลเดอร์ไม่ได้: ไม่พบ {folder} (ตรวจสอบว่าไดรฟ์ Z: พร้อมใช้งาน)")
            return
        try:
            if os.name == "nt":
                os.startfile(str(folder))
            elif os.uname().sysname == "Darwin":
                subprocess.Popen(["open", str(folder)])
            else:
                subprocess.Popen(["xdg-open", str(folder)])
        except OSError as exc:
            self.status_var.set(f"เปิดโฟลเดอร์ไม่ได้: {exc}")


def main():
    app = CoverAutoSaverApp()
    app.mainloop()


if __name__ == "__main__":
    main()
