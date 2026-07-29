"""专项目标模型训练入口。需要已完成 YOLO 标注的数据集和 ultralytics 训练环境。"""

from pathlib import Path
import torch
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "ai" / "dataset" / "rail_fastener_demo.yaml"

if __name__ == "__main__":
    model = YOLO("yolo11n.pt")
    device = 0 if torch.cuda.is_available() else "cpu"
    model.train(data=str(DATA), epochs=45, imgsz=640, batch=2, device=device, project=str(ROOT / "ai" / "runs"), name="rail_fastener_demo")
