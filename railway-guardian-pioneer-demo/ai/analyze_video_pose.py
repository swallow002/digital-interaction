"""真实人体姿态识别：YOLO11 Pose ONNX + IoU 身份跟踪。

只输出人体骨架与人员 ID；机具/扣件须由 rail_fastener 专项检测模型输出。
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
MODEL = ROOT / "ai" / "models" / "yolo11n-pose.onnx"
CACHE_MODEL = Path(os.environ["LOCALAPPDATA"]) / "railway-ai-cache" / "yolo11n-pose.onnx"
OUTPUT_DIR = ROOT / "public" / "analysis"
KEYFRAMES = OUTPUT_DIR / "keyframes"
INFERENCE_STRIDE = 5
EDGES = [(0, 1), (0, 2), (1, 3), (2, 4), (5, 6), (5, 7), (7, 9), (6, 8), (8, 10), (5, 11), (6, 12), (11, 12), (11, 13), (13, 15), (12, 14), (14, 16)]


def letterbox(image, size=640):
    height, width = image.shape[:2]
    scale = min(size / width, size / height)
    new_width, new_height = round(width * scale), round(height * scale)
    canvas = np.full((size, size, 3), 114, dtype=np.uint8)
    pad_x, pad_y = (size - new_width) // 2, (size - new_height) // 2
    canvas[pad_y:pad_y + new_height, pad_x:pad_x + new_width] = cv2.resize(image, (new_width, new_height))
    return canvas, scale, pad_x, pad_y


def iou(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    inter = max(0, min(ax2, bx2) - max(ax1, bx1)) * max(0, min(ay2, by2) - max(ay1, by1))
    union = (ax2 - ax1) * (ay2 - ay1) + (bx2 - bx1) * (by2 - by1) - inter
    return inter / union if union else 0


class Tracker:
    def __init__(self):
        self.next_id, self.tracks = 1, {}

    def update(self, boxes):
        found, remaining = [], set(self.tracks)
        for box in boxes:
            track_id, score = None, 0.3
            for candidate in remaining:
                candidate_score = iou(box, self.tracks[candidate]["box"])
                if candidate_score > score:
                    track_id, score = candidate, candidate_score
            if track_id is None:
                track_id = self.next_id
                self.next_id += 1
            else:
                remaining.remove(track_id)
            self.tracks[track_id] = {"box": box, "miss": 0}
            found.append(track_id)
        for track_id in remaining:
            self.tracks[track_id]["miss"] += 1
            if self.tracks[track_id]["miss"] > 20:
                del self.tracks[track_id]
        return found


def detect_poses(net, frame):
    image, scale, pad_x, pad_y = letterbox(frame)
    net.setInput(cv2.dnn.blobFromImage(image, 1 / 255, (640, 640), swapRB=True))
    output = net.forward()
    if output.ndim == 3:
        output = output[0]
    if output.shape[0] < output.shape[1]:
        output = output.T
    candidates = []
    for row in output:
        confidence = float(row[4])
        if confidence < 0.35 or len(row) < 56:
            continue
        cx, cy, width, height = row[:4]
        box = [(cx - width / 2 - pad_x) / scale, (cy - height / 2 - pad_y) / scale, (cx + width / 2 - pad_x) / scale, (cy + height / 2 - pad_y) / scale]
        box = [max(0, box[0]), max(0, box[1]), min(frame.shape[1] - 1, box[2]), min(frame.shape[0] - 1, box[3])]
        if box[2] <= box[0] or box[3] <= box[1]:
            continue
        raw_points = row[5:56].reshape(17, 3)
        keypoints = [{"x": round(float((x - pad_x) / scale), 1), "y": round(float((y - pad_y) / scale), 1), "confidence": round(float(score), 4)} for x, y, score in raw_points]
        candidates.append((box, confidence, keypoints))
    indices = cv2.dnn.NMSBoxes([[box[0], box[1], box[2] - box[0], box[3] - box[1]] for box, _, _ in candidates], [score for _, score, _ in candidates], 0.35, 0.5)
    return [candidates[index] for index in np.array(indices).reshape(-1).tolist()] if len(indices) else []


def render(frame, people, time):
    result = frame.copy()
    for person in people:
        points = person["keypoints"]
        for a, b in EDGES:
            if points[a]["confidence"] >= 0.35 and points[b]["confidence"] >= 0.35:
                cv2.line(result, (int(points[a]["x"]), int(points[a]["y"])), (int(points[b]["x"]), int(points[b]["y"])), (110, 255, 180), 3)
        for point in points:
            if point["confidence"] >= 0.35:
                cv2.circle(result, (int(point["x"]), int(point["y"])), 4, (65, 180, 255), -1)
    cv2.putText(result, f"REAL YOLO11 Pose | {time:.2f}s", (25, 38), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
    return result


def write_result(frames, fps, count):
    payload = {"schema_version": 2, "source": SOURCE.name, "generated_video": "fastener-gauge-adjustment-pose.mp4", "model": "YOLO11n Pose ONNX + IoU Track", "device": "OpenCV DNN", "fps": round(fps, 3), "inference_fps": round(fps / INFERENCE_STRIDE, 3), "frame_count": count, "detection_scope": ["person_pose"], "limitations": ["Real human pose detection and tracking at 5fps. Tools and fasteners require the custom rail_fastener model."], "frames": frames}
    (OUTPUT_DIR / "latest.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main():
    if not MODEL.exists() or not SOURCE.exists():
        raise FileNotFoundError("Pose model or source video is missing")
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    KEYFRAMES.mkdir(parents=True)
    CACHE_MODEL.parent.mkdir(parents=True, exist_ok=True)
    if not CACHE_MODEL.exists() or CACHE_MODEL.stat().st_size != MODEL.stat().st_size:
        shutil.copyfile(MODEL, CACHE_MODEL)
    net = cv2.dnn.readNetFromONNX(str(CACHE_MODEL))
    capture = cv2.VideoCapture(str(SOURCE))
    fps = capture.get(cv2.CAP_PROP_FPS) or 25
    width, height = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH)), int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    writer = cv2.VideoWriter(str(OUTPUT_DIR / "fastener-gauge-adjustment-pose.mp4"), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
    tracker, frames, index, latest_people = Tracker(), [], 0, []
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        inferred = index % INFERENCE_STRIDE == 0
        if inferred:
            result = detect_poses(net, frame)
            boxes = [box for box, _, _ in result]
            ids = tracker.update(boxes)
            latest_people = [{"track_id": track_id, "confidence": round(float(score), 4), "box": [round(float(value), 1) for value in box], "keypoints": points} for track_id, (box, score, points) in zip(ids, result)]
        time = index / fps
        # objects is reserved for the trained rail_fastener detector. Never populate it with guessed boxes.
        frames.append({"frame": index, "time": round(time, 3), "inferred": inferred, "people": latest_people, "objects": []})
        writer.write(render(frame, latest_people, time))
        index += 1
        if index % 25 == 0:
            write_result(frames, fps, index)
    capture.release()
    writer.release()
    write_result(frames, fps, index)
    print(f"Pose analysis complete: {index} frames")


if __name__ == "__main__":
    main()
