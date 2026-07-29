# 视频分析基线

`analyze_video.py` 是本项目的真实离线推理入口，不依赖网页中的模拟框。

它使用通用 YOLO 人员检测和 ByteTrack 跟踪，对每一帧输出实际检测框、置信度、持续 ID，并生成带框的视频和 JSON 证据。

> 通用权重只识别 `person`，不能可靠识别铁路扣件工序。扣件、撬棍、轨距尺、扭矩扳手和“松扣件 / 清污调整 / 紧固”等工序，必须用本项目采集、标注后的专项数据训练；代码会在 `models/fastener_action.pt` 存在时启用该工序分类器。

运行：

```powershell
.\.venv-ai\Scripts\python.exe ai\analyze_video.py
```

输出：

- `public/analysis/fastener-gauge-adjustment-ai.mp4`：真实检测、跟踪后的证据视频；
- `public/analysis/latest.json`：逐帧检测结果与运行信息；
- `public/analysis/keyframes/`：人员数量变化时的关键截图。

工序标注建议采用三个初始类别：`loosen_fastener`、`clean_rail_seat`、`adjust_fastener`，每类采集不同人员、光照、机位下至少数十个 5–10 秒片段，并保留“走动、取工具、遮挡、非作业”等负样本。扭矩和轨距必须融合智能扳手/电子轨距尺数据，不能由普通视频冒充测量结果。
