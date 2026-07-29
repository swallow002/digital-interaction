# 铁路扣件专项视觉数据集

## 类别

`person`、`pry_bar`、`socket_wrench`、`torque_wrench`、`gauge_ruler`、`cleaning_tool`、`elastic_clip`、`gauge_plate`、`screw_spike`、`rail_seat`。

## 标注要求

1. 以 YOLO 格式标注目标框：`class x_center y_center width height`，坐标归一化。
2. 每一段视频另在 `ai/annotations` 中记录工序起止时间、SOP 节点和可见证据。
3. 每个工序至少采集不同人员、距离、光照和机位的正样本；同时标注取工具、行走、遮挡、非作业等负样本。
4. 轨距与扭矩不是普通视频的可信测量量，必须关联轨距尺 OCR、电子轨距尺或智能扭矩扳手读数。

## 工序状态规则

- `loosen_fastener`：撬棍/套筒工具与扣件工位交互，且弹条/扣板移出或螺杆可见。
- `clean_rail_seat`：清洁工具持续进入承轨台/螺杆区域，扣件尚未完全复位。
- `adjust_fastener`：扣板、挡肩、垫片或弹条在承轨台位置取放、调整。
- `tighten_fastener`：扭矩扳手与已复位扣件交互；只有接收到扭矩数据后可判定“合格”。
