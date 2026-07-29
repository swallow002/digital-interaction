"""从当前单视频构造学习用的小样本专项检测集。

标签基于可见、相对清晰的扣件近景和撬棍画面人工复核生成。
这是用于理解训练流程的实验集，不应用于实际线路安全判定。
"""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "ai" / "dataset" / "rail_fastener" / "images" / "train"
DATASET = ROOT / "ai" / "dataset" / "rail_fastener_demo"
WIDTH, HEIGHT = 1920, 1080

# (class_id, x1, y1, x2, y2). 1=撬棍, 6=弹条, 7=扣板, 8=螺杆。
# 只选择可人工复核的画面，避免把遮挡或模糊目标当作真值。
SAMPLES = {
    "frame-00s.jpg": [(1, 570, 585, 1050, 870), (1, 1210, 540, 1530, 730)],
    "frame-01s.jpg": [(1, 570, 590, 1040, 875), (1, 1190, 535, 1510, 735)],
    "frame-02s.jpg": [(1, 570, 600, 1050, 875), (1, 1170, 540, 1500, 745)],
    "frame-03s.jpg": [(1, 570, 610, 1040, 880), (1, 1150, 545, 1490, 750)],
    "frame-04s.jpg": [(1, 560, 610, 1030, 885), (1, 1135, 545, 1470, 755)],
    "frame-12s.jpg": [(8, 630, 470, 805, 815), (6, 1020, 470, 1510, 810), (7, 900, 480, 1600, 820)],
    "frame-13s.jpg": [(8, 620, 470, 805, 815), (6, 1020, 470, 1510, 810), (7, 900, 480, 1600, 820)],
    "frame-14s.jpg": [(8, 630, 470, 810, 815), (6, 1010, 465, 1510, 815), (7, 900, 480, 1600, 820)],
    "frame-18s.jpg": [(8, 640, 470, 820, 815), (6, 1010, 470, 1500, 815), (7, 900, 475, 1600, 820)],
    "frame-20s.jpg": [(8, 730, 465, 900, 780), (6, 1040, 480, 1480, 790), (7, 925, 470, 1580, 800)],
    "frame-24s.jpg": [(8, 1140, 470, 1260, 740), (6, 1280, 450, 1650, 730), (7, 1100, 440, 1700, 760)],
    "frame-28s.jpg": [(6, 350, 760, 700, 980), (7, 250, 700, 760, 1000)],
    "frame-32s.jpg": [(6, 300, 760, 660, 1000), (7, 220, 700, 720, 1020)],
    "frame-35s.jpg": [(1, 120, 180, 1000, 740), (6, 650, 690, 1160, 1010), (7, 560, 640, 1200, 1030)],
}


def yolo_line(class_id: int, box: tuple[int, int, int, int]) -> str:
    x1, y1, x2, y2 = box
    cx, cy = ((x1 + x2) / 2) / WIDTH, ((y1 + y2) / 2) / HEIGHT
    width, height = (x2 - x1) / WIDTH, (y2 - y1) / HEIGHT
    return f"{class_id} {cx:.6f} {cy:.6f} {width:.6f} {height:.6f}"


def main() -> None:
    if DATASET.exists():
        shutil.rmtree(DATASET)
    for split in ("train", "val"):
        (DATASET / "images" / split).mkdir(parents=True)
        (DATASET / "labels" / split).mkdir(parents=True)
    names = list(SAMPLES)
    for index, name in enumerate(names):
        split = "val" if index in (4, 9, 13) else "train"
        shutil.copyfile(SOURCE / name, DATASET / "images" / split / name)
        lines = [yolo_line(class_id, box) for class_id, *box in SAMPLES[name]]
        (DATASET / "labels" / split / f"{Path(name).stem}.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Created {len(names)} labeled images at {DATASET}")


if __name__ == "__main__":
    main()
