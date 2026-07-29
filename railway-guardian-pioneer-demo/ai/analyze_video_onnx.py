"""轻量真实检测：OpenCV DNN + YOLO ONNX + 简易 IoU 持续跟踪。

不需要 PyTorch；模型文件由 run-ai-analysis.ps1 下载到 ai/models/yolo11n.onnx。
当前模型范围是 COCO 的 person，铁路专用工序仍需专项训练后替换模型。
"""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "fastener-gauge-adjustment.mp4"
MODEL = ROOT / "ai" / "models" / "yolo11n.onnx"
CACHE_MODEL = Path(os.environ["LOCALAPPDATA"]) / "railway-ai-cache" / "yolo11n.onnx"
OUTPUT_DIR = ROOT / "public" / "analysis"
KEYFRAMES = OUTPUT_DIR / "keyframes"
INFERENCE_STRIDE = 5  # 25fps source -> real DNN inference at 5fps for lightweight local playback.


def letterbox(image, size=640):
    height, width = image.shape[:2]
    scale = min(size / width, size / height)
    new_width, new_height = round(width * scale), round(height * scale)
    resized = cv2.resize(image, (new_width, new_height))
    canvas = np.full((size, size, 3), 114, dtype=np.uint8)
    pad_x, pad_y = (size - new_width) // 2, (size - new_height) // 2
    canvas[pad_y:pad_y + new_height, pad_x:pad_x + new_width] = resized
    return canvas, scale, pad_x, pad_y


def iou(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    inter = max(0, min(ax2, bx2) - max(ax1, bx1)) * max(0, min(ay2, by2) - max(ay1, by1))
    union = (ax2 - ax1) * (ay2 - ay1) + (bx2 - bx1) * (by2 - by1) - inter
    return inter / union if union else 0


class Tracker:
    def __init__(self):
        self.next_id = 1
        self.tracks = {}

    def update(self, boxes):
        assigned = []
        unmatched = set(self.tracks)
        for box in boxes:
            best_id, best_iou = None, 0.3
            for track_id in unmatched:
                score = iou(box, self.tracks[track_id]["box"])
                if score > best_iou:
                    best_id, best_iou = track_id, score
            if best_id is None:
                best_id = self.next_id
                self.next_id += 1
            else:
                unmatched.discard(best_id)
            self.tracks[best_id] = {"box": box, "miss": 0}
            assigned.append(best_id)
        for track_id in unmatched:
            self.tracks[track_id]["miss"] += 1
            if self.tracks[track_id]["miss"] > 20:
                del self.tracks[track_id]
        return assigned


def detect_people(net, frame):
    image, scale, pad_x, pad_y = letterbox(frame)
    blob = cv2.dnn.blobFromImage(image, 1 / 255, (640, 640), swapRB=True)
    net.setInput(blob)
    output = net.forward()
    if output.ndim == 3:
        output = output[0]
    if output.shape[0] < output.shape[1]:
        output = output.T
    boxes, scores = [], []
    for row in output:
        score = float(row[4])  # class 0: person in COCO; YOLO11 has no separate objectness column.
        if score < 0.35:
            continue
        cx, cy, width, height = row[:4]
        x1 = (cx - width / 2 - pad_x) / scale
        y1 = (cy - height / 2 - pad_y) / scale
        x2 = (cx + width / 2 - pad_x) / scale
        y2 = (cy + height / 2 - pad_y) / scale
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(frame.shape[1] - 1, x2), min(frame.shape[0] - 1, y2)
        if x2 > x1 and y2 > y1:
            boxes.append([x1, y1, x2, y2])
            scores.append(score)
    indices = cv2.dnn.NMSBoxes([[b[0], b[1], b[2] - b[0], b[3] - b[1]] for b in boxes], scores, 0.35, 0.5)
    indices = np.array(indices).reshape(-1).tolist() if len(indices) else []
    return [boxes[index] for index in indices], [scores[index] for index in indices]


def render(frame, people, time):
    result = frame.copy()
    for person in people:
        x1, y1, x2, y2 = map(int, person["box"])
        cv2.rectangle(result, (x1, y1), (x2, y2), (20, 222, 142), 3)
        cv2.putText(result, f"person #{person['track_id']} {person['confidence']:.2f}", (x1, max(28, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (20, 222, 142), 2)
    cv2.rectangle(result, (18, 18), (395, 72), (7, 23, 46), -1)
    cv2.putText(result, "REAL YOLO11 ONNX + IoU Track", (30, 43), cv2.FONT_HERSHEY_SIMPLEX, 0.58, (255, 255, 255), 2)
    cv2.putText(result, f"{time:.2f}s", (30, 64), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (187, 208, 226), 1)
    return result


def write_result(frames, fps, frame_count):
    payload = {
        "schema_version": 1,
        "source": SOURCE.name,
        "generated_video": "fastener-gauge-adjustment-ai.mp4",
        "model": "YOLO11n ONNX + IoU Track",
        "device": "OpenCV DNN",
        "fps": round(fps, 3),
        "inference_fps": round(fps / INFERENCE_STRIDE, 3),
        "frame_count": frame_count,
        "detection_scope": ["person"],
        "limitations": ["Real person detection and tracking at 5fps; railway procedure recognition requires a custom trained action model."],
        "frames": frames,
    }
    (OUTPUT_DIR / "latest.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main():
    if not MODEL.exists():
        raise FileNotFoundError(f"Missing model: {MODEL}")
    if not SOURCE.exists():
        raise FileNotFoundError(f"Missing video: {SOURCE}")
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    KEYFRAMES.mkdir(parents=True)
    # Some Windows OpenCV builds cannot open ONNX weights from a Unicode path.
    # Keep the source model in the project, but load an ASCII-path cache copy.
    CACHE_MODEL.parent.mkdir(parents=True, exist_ok=True)
    if not CACHE_MODEL.exists() or CACHE_MODEL.stat().st_size != MODEL.stat().st_size:
        shutil.copyfile(MODEL, CACHE_MODEL)
    net = cv2.dnn.readNetFromONNX(str(CACHE_MODEL))
    capture = cv2.VideoCapture(str(SOURCE))
    fps = capture.get(cv2.CAP_PROP_FPS) or 25
    width, height = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH)), int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    writer = cv2.VideoWriter(str(OUTPUT_DIR / "fastener-gauge-adjustment-ai.mp4"), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
    tracker, frames, index, previous, latest_people = Tracker(), [], 0, None, []
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        inferred = index % INFERENCE_STRIDE == 0
        if inferred:
            boxes, scores = detect_people(net, frame)
            track_ids = tracker.update(boxes)
            latest_people = [{"track_id": track_id, "confidence": round(float(score), 4), "box": [round(float(value), 1) for value in box]} for track_id, score, box in zip(track_ids, scores, boxes)]
        people = latest_people
        time = index / fps
        frames.append({"frame": index, "time": round(time, 3), "inferred": inferred, "people": people})
        rendered = render(frame, people, time)
        writer.write(rendered)
        if previous != len(people):
            cv2.imwrite(str(KEYFRAMES / f"t-{time:05.2f}s-persons-{len(people)}.jpg"), rendered)
            previous = len(people)
        index += 1
        if index % 25 == 0:
            write_result(frames, fps, index)
    capture.release()
    writer.release()
    write_result(frames, fps, index)
    print(f"Analysis complete: {index} frames")


if __name__ == "__main__":
    main()
