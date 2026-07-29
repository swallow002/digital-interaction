"""真实视频检测基线：人员检测 + ByteTrack 跟踪 + 可复核证据输出。

运行前先安装 requirements-ai.txt。默认使用 GPU；没有可用 CUDA 时自动退回 CPU。
该脚本刻意不把通用 YOLO 的 person 结果伪装成“扣件工序识别”。
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import cv2
import torch
from ultralytics import YOLO


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "fastener-gauge-adjustment.mp4"
OUTPUT_DIR = ROOT / "public" / "analysis"
KEYFRAMES = OUTPUT_DIR / "keyframes"
OUTPUT_VIDEO = OUTPUT_DIR / "fastener-gauge-adjustment-ai.mp4"
OUTPUT_JSON = OUTPUT_DIR / "latest.json"
MODEL_NAME = "yolo11n.pt"


def ensure_output_dir() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if KEYFRAMES.exists():
        shutil.rmtree(KEYFRAMES)
    KEYFRAMES.mkdir()


def annotation(frame, people, timestamp, device):
    rendered = frame.copy()
    for person in people:
        x1, y1, x2, y2 = (int(value) for value in person["box"])
        cv2.rectangle(rendered, (x1, y1), (x2, y2), (20, 222, 142), 3)
        label = f"person #{person['track_id']} {person['confidence']:.2f}"
        cv2.putText(rendered, label, (x1, max(28, y1 - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (20, 222, 142), 2)
    cv2.rectangle(rendered, (18, 18), (420, 74), (7, 23, 46), -1)
    cv2.putText(rendered, "REAL YOLO + ByteTrack", (30, 43), cv2.FONT_HERSHEY_SIMPLEX, 0.63, (255, 255, 255), 2)
    cv2.putText(rendered, f"{timestamp:.2f}s | {device}", (30, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (187, 208, 226), 1)
    return rendered


def main() -> int:
    if not SOURCE.exists():
        print(f"Video not found: {SOURCE}", file=sys.stderr)
        return 2

    ensure_output_dir()
    device = 0 if torch.cuda.is_available() else "cpu"
    device_label = f"CUDA:{torch.cuda.get_device_name(0)}" if device == 0 else "CPU"
    print(f"Loading {MODEL_NAME} on {device_label}")
    model = YOLO(MODEL_NAME)

    capture = cv2.VideoCapture(str(SOURCE))
    fps = float(capture.get(cv2.CAP_PROP_FPS) or 25)
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    writer = cv2.VideoWriter(str(OUTPUT_VIDEO), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
    frame_index, previous_count = 0, None
    records = []

    while True:
        ok, frame = capture.read()
        if not ok:
            break
        result = model.track(
            frame,
            persist=True,
            tracker="bytetrack.yaml",
            classes=[0],  # COCO class 0: person; specialized railway classes require custom training.
            conf=0.25,
            iou=0.5,
            device=device,
            verbose=False,
        )[0]
        people = []
        if result.boxes is not None and len(result.boxes):
            xyxy = result.boxes.xyxy.detach().cpu().tolist()
            conf = result.boxes.conf.detach().cpu().tolist()
            ids = result.boxes.id.detach().cpu().tolist() if result.boxes.id is not None else [-1] * len(xyxy)
            for box, score, track_id in zip(xyxy, conf, ids):
                people.append({"track_id": int(track_id), "confidence": round(float(score), 4), "box": [round(float(v), 1) for v in box]})
        timestamp = frame_index / fps
        records.append({"frame": frame_index, "time": round(timestamp, 3), "people": people})
        if previous_count != len(people):
            cv2.imwrite(str(KEYFRAMES / f"t-{timestamp:05.2f}s-persons-{len(people)}.jpg"), annotation(frame, people, timestamp, device_label))
            previous_count = len(people)
        writer.write(annotation(frame, people, timestamp, device_label))
        frame_index += 1
        if frame_index % 100 == 0:
            print(f"processed {frame_index}/{total_frames}")

    capture.release()
    writer.release()
    payload = {
        "schema_version": 1,
        "source": SOURCE.name,
        "generated_video": OUTPUT_VIDEO.name,
        "model": MODEL_NAME,
        "device": device_label,
        "fps": round(fps, 3),
        "frame_count": frame_index,
        "detection_scope": ["person"],
        "limitations": [
            "This is real person detection and tracking, not a trained fastener-process classifier.",
            "Gauge and torque compliance require dedicated instrument data or calibrated close-up views.",
        ],
        "frames": records,
    }
    OUTPUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Saved {OUTPUT_VIDEO}")
    print(f"Saved {OUTPUT_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
