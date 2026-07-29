"""将训练后的机具/扣件检测模型合并进现有 pose JSON。"""

from __future__ import annotations

import json
from pathlib import Path

import torch
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
VIDEO = ROOT / "public" / "fastener-gauge-adjustment.mp4"
MODEL = ROOT / "ai" / "runs" / "rail_fastener_demo" / "weights" / "best.pt"
RESULT = ROOT / "public" / "analysis" / "latest.json"


def main() -> None:
    if not MODEL.exists():
        raise FileNotFoundError(f"Trained model not found: {MODEL}")
    data = json.loads(RESULT.read_text(encoding="utf-8"))
    frames = data["frames"]
    model = YOLO(MODEL)
    device = 0 if torch.cuda.is_available() else "cpu"
    print(f"Running specialized inference on {device}")
    # 这里仅需要逐帧画出专项物体，不需要跨帧 ID；直接预测可避免 tracker 的额外依赖。
    # 小样本实验模型的分数普遍偏低；0.02 仅用于学习展示，页面会同步标注其适用边界。
    trained_classes = {"pry_bar", "elastic_clip", "gauge_plate", "screw_spike"}
    for index, result in enumerate(model(VIDEO, stream=True, conf=0.02, iou=0.45, device=device, verbose=False)):
        if index >= len(frames):
            break
        objects = []
        if result.boxes is not None:
            xyxy = result.boxes.xyxy.cpu().tolist()
            conf = result.boxes.conf.cpu().tolist()
            cls = result.boxes.cls.cpu().tolist()
            for box, score, class_id in zip(xyxy, conf, cls):
                name = model.names[int(class_id)]
                if name in trained_classes:
                    objects.append({"class": name, "confidence": round(float(score), 4), "box": [round(float(value), 1) for value in box], "source": "rail_fastener_demo"})
        frames[index]["objects"] = objects
    data["specialized_model"] = {"name": "rail_fastener_demo", "scope": "single_video_experiment", "classes": ["pry_bar", "elastic_clip", "gauge_plate", "screw_spike"]}
    RESULT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("Specialized detections merged into latest.json")


if __name__ == "__main__":
    main()
