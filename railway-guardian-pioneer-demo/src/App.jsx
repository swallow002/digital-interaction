import { useEffect, useRef, useState } from "react";
import {
  BellRing,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Eye,
  FileBarChart2,
  MapPin,
  MonitorPlay,
  Radio,
  Settings2,
  ShieldCheck,
  Smartphone,
  TrainFront,
  UsersRound,
  Volume2,
  VolumeX,
  Wrench,
  X,
} from "lucide-react";
import "./App.css";

const assetUrl = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;

const SOP = [
  {
    id: 1,
    title: "作业准备",
    role: "作业负责人 / 作业人员",
    evidence: "轨温、量具、工具材料检查",
    rule: "先测量轨温，校对量具并检查工具材料。",
  },
  {
    id: 2,
    title: "复查确认",
    role: "作业负责人",
    evidence: "计划单、偏差量、划撬范围",
    rule: "作业处所、偏差量值与划撬范围须复查确认。",
  },
  {
    id: 3,
    title: "确定标准股",
    role: "作业负责人 / 测量人员",
    evidence: "轨距测量、标准股确认",
    rule: "直线取方向好的一股；曲线以上股；道岔取外直股。",
  },
  {
    id: 4,
    title: "松扣件",
    role: "作业人员",
    evidence: "扣件松卸计数、现场视频",
    rule: "P50轨及以上一次连续松扣件不得超过7头；P50轨以下不得超过5头。",
  },
  {
    id: 5,
    title: "清污调整",
    role: "作业人员",
    evidence: "承轨台清污、扣板挡肩调整",
    rule: "清除承轨台、螺杆脏污，调整扣板、挡肩或加设调整片。",
  },
  {
    id: 6,
    title: "复测选型",
    role: "测量人员 / 作业负责人",
    evidence: "轨距复测、扣件号码记录",
    rule: "复测轨距并确定对面股调整量与需调整的扣件号码。",
  },
  {
    id: 7,
    title: "扭矩紧固",
    role: "作业人员 / 质量检查员",
    evidence: "扭矩扳手读数、紧固视频",
    rule: "安装并拧紧扣件，扭力矩应保持在130—160 N·m。",
  },
  {
    id: 8,
    title: "回检开通",
    role: "作业负责人 / 现场防护员",
    evidence: "轨距、方向、扭矩回检与撤防记录",
    rule: "全面回检合格、整理工机具并撤除防护后方可开通线路。",
  },
];

// 该视频的工序证据由指导书对照后人工复核标注；只有 person 框来自当前真实模型。
// 专项模型训练完成后，source 会替换为 model_inference，前端无需改动。
const PROCEDURE_EVIDENCE = [
  {
    start: 0,
    end: 14,
    sop: 4,
    name: "松扣件 / 拆卸组件",
    source: "视频复核标注",
    confidence: "高",
    objects: ["作业人员", "弹条", "扣板", "螺杆"],
    action: "扣件组件移出承轨台，螺杆裸露",
  },
  {
    start: 14,
    end: 20,
    sop: 5,
    name: "清除承轨台及螺杆脏污",
    source: "视频复核标注",
    confidence: "中高",
    objects: ["作业人员", "抹布/清洁工具", "承轨台", "螺杆"],
    action: "清洁工具持续接触承轨台和螺杆区域",
  },
  {
    start: 20,
    end: 35.6,
    sop: 5,
    name: "调整扣板 / 弹条组件",
    source: "视频复核标注",
    confidence: "中高",
    objects: ["作业人员", "弹条", "扣板", "螺杆", "调整工具"],
    action: "扣件组件在承轨台位置取放、调整",
  },
];

function getProcedureEvidence(time) {
  return (
    PROCEDURE_EVIDENCE.find((item) => time >= item.start && time < item.end) ||
    PROCEDURE_EVIDENCE[PROCEDURE_EVIDENCE.length - 1]
  );
}

const POSE_EDGES = [
  [0, 1], [0, 2], [1, 3], [2, 4], [5, 6], [5, 7], [7, 9], [6, 8],
  [8, 10], [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
];

const PERSON_IDENTITIES = {
  1: { name: "陈飞宇", role: "作业负责人" },
  2: { name: "许静逸", role: "现场防护" },
  3: { name: "杜哲生", role: "安全监护" },
  4: { name: "刘洋", role: "质量检查" },
};

const SPECIALIZED_LABELS = {
  work_zone: { name: "扣件作业位", kind: "workzone" },
  pry_bar: { name: "撬棍", kind: "tool" },
  socket_wrench: { name: "套筒扳手", kind: "tool" },
  torque_wrench: { name: "扭矩扳手", kind: "tool" },
  gauge_ruler: { name: "轨距尺", kind: "tool" },
  cleaning_tool: { name: "清洁工具", kind: "tool" },
  elastic_clip: { name: "弹条", kind: "fastener" },
  gauge_plate: { name: "扣板", kind: "fastener" },
  screw_spike: { name: "螺杆", kind: "fastener" },
  rail_seat: { name: "承轨台", kind: "fastener" },
};

// 基于视频关键帧人工复核的轨迹。播放时对关键帧坐标插值，确保框位逐帧连续跟随。
const MANUAL_ANNOTATION_TRACKS = [
  { id: "pry-left", class: "pry_bar", note: "撬棍作业", keyframes: [
    [0, 27, 61, 17, 16, 0.96], [3, 29, 60, 18, 17, 0.95], [6, 31, 59, 18, 18, 0.94], [9.5, 34, 60, 17, 17, 0.93],
  ]},
  { id: "pry-right", class: "pry_bar", note: "撬棍作业", keyframes: [
    [0, 55, 52, 17, 20, 0.95], [3, 55, 51, 17, 21, 0.94], [6, 56, 50, 16, 22, 0.93], [9.5, 57, 51, 16, 20, 0.92],
  ]},
  { id: "work-wide", class: "work_zone", note: "扣件调整位置", keyframes: [
    [0, 40, 67, 21, 18, 0.97], [4, 41, 67, 21, 18, 0.97], [9.5, 43, 66, 20, 19, 0.96],
  ]},
  { id: "clip-close", class: "elastic_clip", note: "弹条组件", keyframes: [
    [11.7, 52, 43, 22, 17, 0.97], [12.2, 53, 44, 22, 17, 0.98], [12.8, 54, 45, 21, 16, 0.97],
  ]},
  { id: "plate-close", class: "gauge_plate", note: "扣板", keyframes: [
    [11.7, 48, 58, 20, 16, 0.96], [12.2, 48, 59, 20, 16, 0.97], [12.8, 49, 59, 19, 16, 0.96],
  ]},
  { id: "spike-close", class: "screw_spike", note: "螺杆", keyframes: [
    [11.7, 34, 47, 9, 19, 0.98], [12.2, 35, 48, 9, 19, 0.99], [12.8, 35, 49, 9, 19, 0.98],
  ]},
  { id: "clean-zone", class: "work_zone", note: "清污作业位", keyframes: [
    [13.1, 34, 44, 31, 36, 0.93], [15, 35, 46, 30, 34, 0.92], [16.7, 37, 48, 29, 31, 0.91],
  ]},
  { id: "spike-late", class: "screw_spike", note: "螺杆", keyframes: [
    [17.3, 43, 40, 10, 24, 0.98], [18, 44, 40, 10, 23, 0.99], [19.5, 46, 41, 10, 22, 0.98],
  ]},
  { id: "plate-late", class: "gauge_plate", note: "扣板", keyframes: [
    [17.3, 34, 60, 39, 25, 0.94], [18, 35, 60, 39, 25, 0.95], [19.5, 37, 61, 36, 24, 0.94],
  ]},
  { id: "work-late", class: "work_zone", note: "扣件调整位置", keyframes: [
    [20.2, 43, 67, 25, 22, 0.95], [25, 45, 67, 24, 22, 0.94], [30, 46, 68, 23, 21, 0.94], [35.5, 48, 68, 22, 20, 0.93],
  ]},
];

function interpolateTrack(track, time) {
  const frames = track.keyframes;
  if (time < frames[0][0] || time > frames[frames.length - 1][0]) return null;
  const nextIndex = frames.findIndex((frame) => frame[0] >= time);
  const next = frames[nextIndex === -1 ? frames.length - 1 : nextIndex];
  const previous = frames[Math.max(0, nextIndex - 1)];
  const ratio = next[0] === previous[0] ? 0 : (time - previous[0]) / (next[0] - previous[0]);
  const values = [1, 2, 3, 4, 5].map((index) => previous[index] + (next[index] - previous[index]) * ratio);
  return { id: track.id, class: track.class, note: track.note, left: values[0], top: values[1], width: values[2], height: values[3], confidence: values[4] };
}

function getManualAnnotations(time) {
  return MANUAL_ANNOTATION_TRACKS.map((track) => interpolateTrack(track, time)).filter(Boolean);
}

const eventTemplates = {
  loose: {
    title: "连续松扣件数量超限",
    detail: "系统累计识别 P50轨以下连续松扣件 6头，超过5头限制",
    node: 4,
    level: "高",
    type: "松扣件超限",
    action: "立即停止松卸，恢复已松扣件并重新分段作业",
  },
  torque: {
    title: "扣件扭力矩不达标",
    detail: "扭矩扳手读数 118 N·m，低于130 N·m下限",
    node: 7,
    level: "高",
    type: "质量偏差",
    action: "按标准重新紧固并复测扭矩",
  },
  review: {
    title: "放行前回检缺失",
    detail: "轨距、方向、扣件扭矩回检记录未齐全，禁止开通线路",
    node: 8,
    level: "中",
    type: "回检缺失",
    action: "补齐回检数据，确认工机具撤离后申请开通",
  },
};

const nav = [
  ["临线预警", MonitorPlay],
  ["实时监管", Eye],
  ["告警处置", BellRing],
  ["作业复盘", FileBarChart2],
  ["任务配置", Settings2],
];

// 统一事件源：临线预警、告警处置、作业复盘均读取同一份记录。
// 后续接入摄像头、UWB 或振动感知时，只需替换这里的数据来源。
const INITIAL_EVENTS = [
  {
    id: "alert-work-boundary", time: "10:22:16", title: "P02 越出作业围栏",
    detail: "P02 已离开 F1 作业围栏。", level: "黄级", status: "待处置",
    node: "动态围栏", type: "围栏越界", person: "P02 · 许静逸", source: "视觉–UWB 联判",
    action: "语音提醒 P02 返回作业区，并由安全监护确认。", duration: "14秒",
    snapshot: assetUrl("/evidence/boundary-alert.jpg"),
  },
  {
    id: "alert-machine", time: "10:23:04", title: "P03 进入机具围栏",
    detail: "P03 与改道机具 M-01 的安全间距不足。", level: "黄级", status: "已处置",
    node: "动态围栏", type: "近机风险", person: "P03 · 杜哲生", source: "机具围栏联判",
    action: "P03 已退出机具影响范围，安全监护确认。", note: "P03 已退出机具区，安全监护确认",
    duration: "18秒", snapshot: assetUrl("/evidence/machine-alert.jpg"),
  },
  {
    id: "alert-train", time: "10:24:31", title: "临线列车红级预警",
    detail: "D3102 ETA 01:00，已启动人员、机具现场确认。", level: "红级", status: "已处置",
    node: "临线预警", type: "临线来车", person: "全体作业人员", source: "双点时差钢轨振动感知",
    action: "强提醒已确认，人员与机具状态复核完成。", note: "强提醒确认，人员与机具状态复核完成",
    duration: "32秒", snapshot: assetUrl("/evidence/train-alert.jpg"),
  },
];

function getTrainWarning(progress) {
  const arrivalPoint = 55;
  const normalizedProgress = Math.max(0, Math.min(progress, 100));
  const etaSeconds = Math.max(0, Math.ceil(240 * (1 - Math.min(normalizedProgress, arrivalPoint) / arrivalPoint)));
  const eta = `${String(Math.floor(etaSeconds / 60)).padStart(2, "0")}:${String(etaSeconds % 60).padStart(2, "0")}`;
  const distance = `${Math.max(0, 1.2 * (1 - normalizedProgress / arrivalPoint)).toFixed(2)} km`;
  const alert = etaSeconds > 180
    ? { level: "green", name: "绿级预警", hint: "列车处于远端感知区，人员、机具保持作业状态", action: "持续监测", voice: "绿级预警，临线列车已发现，预计四分钟内到达作业区。" }
    : etaSeconds > 60
      ? { level: "yellow", name: "黄级预警", hint: "列车接近，提示现场核验人员与机具状态", action: "开始人机核验", voice: "黄级预警，临线列车预计两分钟内到达，请现场核验人员与机具状态。" }
      : { level: "red", name: "红级预警", hint: "列车即将到达，立即执行人员、机具现场确认", action: "立即现场确认", voice: "红级预警，临线列车即将到达，请立即确认人员和机具安全状态。" };
  return { normalizedProgress, arrivalPoint, etaSeconds, eta, distance, alert };
}

function App() {
  const [page, setPage] = useState(() => new URLSearchParams(window.location.search).get("page") || "临线预警");
  const [sopStep, setSopStep] = useState(5);
  const [mode, setMode] = useState("风险校验");
  const [events, setEvents] = useState(INITIAL_EVENTS);
  const [activeEvent, setActiveEvent] = useState(null);
  const [note, setNote] = useState("");
  const [handheld, setHandheld] = useState(() => new URLSearchParams(window.location.search).get("handheld") === "1");
  const [trainProgress, setTrainProgress] = useState(8);
  const [task, setTask] = useState({
    site: "杭深线 K1028+650",
    project: "扣件改道作业",
    window: "01:12:36",
    windowRange: "10:00 - 12:00",
    sopTemplate: "扣件改道标准作业（8步）",
    workLine: "上行线 · K1028+580—K1028+720",
    adjacentLine: "下行线 · D3102 接近方向",
  });
  const videoRef = useRef(null);

  const pending = events.filter((e) => e.status !== "已处置");
  const handled = events.filter((e) => e.status === "已处置");
  const sopRate = Math.round(((sopStep - 1) / SOP.length) * 100);

  const captureEvidence = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return assetUrl("/railway-worksite.png");
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 270;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  };

  const triggerEvent = (key, source = "manual") => {
    const template = eventTemplates[key];
    const item = {
      ...template,
      id: `${key}-${Date.now()}`,
      time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
      status: "已提醒",
      key,
      source,
      snapshot: captureEvidence(),
    };
    setEvents((current) => [item, ...current]);
    if (source !== "auto") setActiveEvent(item);
    setPage("实时监管");
    if (template.node > sopStep) setSopStep(template.node);
  };

  const advanceSop = () => {
    if (sopStep >= SOP.length) return;
    if (pending.some((event) => event.node === sopStep + 1)) return;
    setSopStep((step) => step + 1);
  };

  const handleEvent = () => {
    if (!activeEvent) return;
    setEvents((current) =>
      current.map((item) =>
        item.id === activeEvent.id
          ? {
              ...item,
              status: "已处置",
              note: note || activeEvent.action,
              handledAt: "刚刚",
            }
          : item,
      ),
    );
    setActiveEvent(null);
    setNote("");
  };

  const resolveEvent = (event, resolution) => {
    setEvents((current) => current.map((item) => item.id === event.id
      ? { ...item, status: "已处置", note: resolution || item.action, handledAt: "刚刚" }
      : item));
  };

  const section = () => {
    if (page === "临线预警")
      return (
        <SafetyOverview
          task={task}
          setPage={setPage}
          trainProgress={trainProgress}
          setTrainProgress={setTrainProgress}
        />
      );
    if (page === "实时监管")
      return (
        <Dashboard
          {...{
            task,
            sopStep,
            events,
            pending,
            mode,
            setMode,
            triggerEvent,
            setActiveEvent,
            advanceSop,
            videoRef,
          }}
        />
      );
    if (page === "告警处置")
      return <Alerts events={events} onResolve={resolveEvent} />;
    if (page === "作业复盘")
      return <Review events={events} handled={handled} sopRate={sopRate} />;
    if (page === "任务配置")
      return <TaskConfig task={task} setTask={setTask} />;
    return (
      <SafetyOverview
        task={task}
        setPage={setPage}
        trainProgress={trainProgress}
        setTrainProgress={setTrainProgress}
      />
    );
  };

  if (handheld) return <MobileCrewApp task={task} events={events} onResolve={resolveEvent} onExit={() => setHandheld(false)} trainProgress={trainProgress} setTrainProgress={setTrainProgress} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <TrainFront size={27} />
          </div>
          <div>
            <strong>轨道智护先锋</strong>
            <span>铁路施工安全监管平台</span>
          </div>
        </div>
        <nav>
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              onClick={() => setPage(label)}
              className={page === label ? "nav-active" : ""}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </nav>
        <div className="side-user">
          <div className="avatar">陈</div>
          <div>
            <b>陈飞宇</b>
            <span>工班长 · 作业负责人</span>
          </div>
        </div>
        <div className="side-foot">
          <ShieldCheck size={17} /> 安全责任重于泰山
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <h1>{page === "临线预警" ? "临线来车预警与动态双围栏防护" : page}</h1>
            <p>
              <MapPin size={16} />
              {task.site}
              <span>·</span>
              {task.project}
            </p>
          </div>
          <div className="countdown">
            <Clock3 size={20} />
            <div>
              <span>作业时间窗剩余</span>
              <strong>{task.window}</strong>
            </div>
          </div>
          <div className="weather">
            <span>2026-07-26 10:24:15</span>
            <b>多云　22°C</b>
            <small>风速 2级　湿度 48%</small>
          </div>
          <button className="handheld-entry" onClick={() => setHandheld(true)}><Smartphone size={17} />工班长手持端</button>
        </header>
        {section()}
      </main>
      {activeEvent && (
        <div className="modal-backdrop">
          <section className="modal">
            <button className="close" onClick={() => setActiveEvent(null)}>
              <X size={21} />
            </button>
            <div className="modal-title">
              <CircleAlert />
              <div>
                <span>{activeEvent.level}风险告警</span>
                <h2>{activeEvent.title}</h2>
              </div>
            </div>
            <p className="modal-detail">{activeEvent.detail}</p>
            <div className="modal-evidence">
              <img
                src={activeEvent.snapshot || assetUrl("/railway-worksite.png")}
                alt="告警视频截帧"
              />
              <div>
                <b>视频截帧证据</b>
                <span>{activeEvent.source === "auto" ? "自动触发时间" : "触发时间"}：{activeEvent.time}</span>
                <small>关联规则：{activeEvent.type}</small>
              </div>
            </div>
            <div className="modal-grid">
              <div>
                <span>关联SOP节点</span>
                <b>
                  {typeof activeEvent.node === "number"
                    ? `第 ${activeEvent.node} 步 · ${SOP[activeEvent.node - 1]?.title || "作业流程"}`
                    : activeEvent.node}
                </b>
              </div>
              <div>
                <span>推荐处置</span>
                <b>{activeEvent.action}</b>
              </div>
            </div>
            <label>
              处置说明{" "}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="填写现场处置情况"
              />
            </label>
            <button className="primary" onClick={handleEvent}>
              <Check size={18} />
              确认处置并留痕
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function MobileCrewApp({ task, events, onResolve, onExit, trainProgress, setTrainProgress }) {
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get("mobileTab") || "态势");
  const [voicePlayed, setVoicePlayed] = useState(false);
  const pending = events.filter((event) => event.status !== "已处置");
  const active = pending[0] || events[0];
  const mobileBoundaryRisk = active?.type === "围栏越界" && active.status !== "已处置";
  const { etaSeconds, eta, distance, alert } = getTrainWarning(trainProgress);
  const mobileTrainPosition = Math.min(82, Math.max(8, trainProgress * 1.35));
  useEffect(() => {
    const timer = window.setInterval(() => {
      setTrainProgress((value) => value >= 104 ? 104 : value + 0.3);
    }, 160);
    return () => window.clearInterval(timer);
  }, [setTrainProgress]);
  const tabs = [
    ["态势", MonitorPlay], ["告警", BellRing], ["人员", UsersRound], ["SOP", ClipboardCheck], ["我的", Settings2],
  ];
  const sayAlert = () => {
    const text = active?.status !== "已处置"
      ? `${active.level}预警，${active.title}，请立即完成现场确认。`
      : alert.voice;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const speech = new SpeechSynthesisUtterance(text);
      speech.lang = "zh-CN";
      speech.rate = 0.9;
      window.speechSynthesis.speak(speech);
    }
    setVoicePlayed(true);
  };
  const overview = <>
    <section className={`mobile-warning-head ${alert.level}`}>
      <div><span>临线列车 · {alert.name}</span><b>ETA {eta}</b><small>{etaSeconds === 0 ? "列车已到达作业区，保持红级防护" : `距作业区 ${distance} · ${alert.action}`}</small></div>
      <TrainFront size={31} />
    </section>
    <section className="mobile-rail-map">
      <div className="mobile-track top"><i /><i /></div>
      <div className={`mobile-train ${alert.level}`} style={{ left: `${mobileTrainPosition}%` }}><TrainFront size={15} />D3102</div>
      <small className="mobile-track-caption">临线 · 下行方向</small>
      <div className="mobile-track bottom"><i /><i /></div>
      <small className="mobile-work-caption">施工线 · K1028+580 — K1028+720</small>
      <div className="mobile-work-fence"><b>F1 作业围栏</b><span className="mobile-machine">M-01</span><i className="mobile-worker p01">P01</i><i className={`mobile-worker p02 ${mobileBoundaryRisk ? "outside" : ""}`}>P02</i><i className="mobile-worker p03">P03</i><i className="mobile-worker p04">P04</i></div>
    </section>
    {active && <section className={`mobile-action-card ${active.status === "已处置" ? "closed" : ""}`}>
      <div className="mobile-action-icon"><CircleAlert size={21} /></div>
      <div><span>{active.level} · {active.type || "现场风险"}</span><h3>{active.title}</h3><p>{active.status === "已处置" ? active.note || "已完成处置确认" : "请先语音提醒，再确认现场已恢复安全状态。"}</p></div>
      {active.status !== "已处置" && <div className="mobile-action-buttons"><button onClick={sayAlert}><Volume2 size={16} />{voicePlayed ? "已播报" : "语音提醒"}</button><button className="confirm" onClick={() => onResolve(active, "工班长现场确认：P02 已返回 F1 作业围栏内") }><Check size={16} />确认返回</button></div>}
    </section>}
    <section className="mobile-progress"><div><span>当前工序</span><b>第 5 步 · 清污调整</b><small>完成后由工班长确认</small></div><button aria-label="查看SOP流程" onClick={() => setTab("SOP")}><ChevronRight size={18} /></button></section>
  </>;
  const alertList = <section className="mobile-list"><h3>告警处置</h3>{events.map((event) => <article key={event.id} className={event.status === "已处置" ? "done" : ""}><span className={`mobile-level ${event.level}`}>{event.level}</span><div><b>{event.title}</b><small>{event.time} · {event.person}</small></div><em>{event.status}</em></article>)}</section>;
  const people = <section className="mobile-list"><h3>人员与机具状态</h3>{[["P01","陈飞宇","作业负责人","作业区内"],["P02","许静逸","现场防护", active?.status === "已处置" ? "已返回围栏" : "待确认"],["P03","杜哲生","安全监护","监护在位"],["M-01","改道机具","关键机具","已授权运行"]].map(([id,name,role,state]) => <article key={id}><span className="mobile-avatar">{id}</span><div><b>{name}</b><small>{role}</small></div><em>{state}</em></article>)}</section>;
  const sop = <section className="mobile-list mobile-sop"><h3>扣件改道 SOP</h3>{SOP.map((item) => <article key={item.id} className={item.id < 5 ? "done" : item.id === 5 ? "current" : ""}><span className="mobile-step">{item.id < 5 ? <Check size={15} /> : item.id}</span><div><b>{item.title}</b><small>{item.evidence}</small></div><em>{item.id < 5 ? "已完成" : item.id === 5 ? "待确认" : "未开始"}</em></article>)}</section>;
  const profile = <section className="mobile-profile"><div className="mobile-profile-mark">班</div><h3>陈飞宇</h3><p>扣件改道作业 · 工班长</p><button onClick={onExit}><Smartphone size={16} />返回电脑端</button><small>本端用于现场确认与留痕，不替代调度命令及现场防护。</small></section>;
  const content = { "态势": overview, "告警": alertList, "人员": people, "SOP": sop, "我的": profile }[tab];
  return <main className="mobile-handheld-shell"><div className="mobile-app">
    <header className="mobile-app-header"><button onClick={onExit}>‹</button><div><b>轨道智护先锋</b><span>{task.site} · 扣件改道</span></div><span className="mobile-online"><i />在线</span></header>
    <div className="mobile-page-content">{content}</div>
    <nav className="mobile-bottom-nav">{tabs.map(([label, Icon]) => <button key={label} className={tab === label ? "active" : ""} onClick={() => setTab(label)}><Icon size={20} /><span>{label}{label === "告警" && pending.length > 0 ? <i>{pending.length}</i> : null}</span></button>)}</nav>
  </div></main>;
}

function SafetyOverview({ task, setPage, trainProgress, setTrainProgress }) {
  const [playing, setPlaying] = useState(true);
  const [operationScene, setOperationScene] = useState("实时监测");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [yellowAcknowledged, setYellowAcknowledged] = useState(false);
  const [strongAlertOpen, setStrongAlertOpen] = useState(false);
  const lastVoiceLevel = useRef("");
  const yellowVoiceSent = useRef(false);
  const { etaSeconds, eta, distance, alert } = getTrainWarning(trainProgress);
  const speakText = (text) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.9;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  };
  const phaseIndex = alert.level === "green" ? 1 : alert.level === "yellow" ? 2 : 3;
  const workerMotion = Math.sin(trainProgress * 0.22);
  const boundaryBreachActive = operationScene === "围栏越界";
  const machineRiskActive = operationScene === "近机风险";
  const yellowExitProgress = boundaryBreachActive ? 1 : 0;
  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setTrainProgress((value) => {
      if (value >= 104) {
        setPlaying(false);
        return 104;
      }
      return value + 0.3;
    }), 160);
    return () => window.clearInterval(timer);
  }, [playing, setTrainProgress]);
  useEffect(() => {
    if (alert.level === "red") setStrongAlertOpen(true);
    else setStrongAlertOpen(false);
  }, [alert.level]);
  useEffect(() => {
    if (!voiceEnabled || lastVoiceLevel.current === alert.level || !("speechSynthesis" in window)) return;
    speakText(alert.voice);
    lastVoiceLevel.current = alert.level;
  }, [alert.level, alert.voice, voiceEnabled]);
  const workerPoints = [
    { id: "P01", name: "陈飞宇", role: "作业负责人", color: "cyan", x: 64 + workerMotion * 0.25, y: 64 - workerMotion * 0.2, normalState: "作业区内", distance: "2.6m" },
    { id: "P02", name: "许静逸", role: "现场防护", color: "blue", x: 62 - yellowExitProgress * 12 + workerMotion * 0.35, y: 65 + workerMotion * 0.35, normalState: "作业区内", distance: "3.4m" },
    { id: "P03", name: "杜哲生", role: "安全监护", color: "green", x: 90 - (machineRiskActive ? 8 : 0) + workerMotion * 0.35, y: 65 - workerMotion * 0.25, normalState: "监护在位", distance: "4.1m" },
    { id: "P04", name: "刘洋", role: "质量检查", color: "purple", x: 61 - workerMotion * 0.55, y: 69 + workerMotion * 0.35, normalState: "UWB 在位", distance: "5.0m", uwb: true },
  ];
  // F2 围栏中心与半径与主图中的机具围栏一致；每一名人员独立计算是否侵入。
  const machineOffset = Math.sin(trainProgress * 0.44) * 0.8;
  const machineFence = { x: 76 + machineOffset, y: 70 + machineOffset * 0.35, radiusX: 12, radiusY: 10 };
  const workers = workerPoints.map((worker) => {
    const xOffset = (worker.x - machineFence.x) / machineFence.radiusX;
    const yOffset = (worker.y - machineFence.y) / machineFence.radiusY;
    const danger = xOffset * xOffset + yOffset * yOffset <= 1;
    return {
      ...worker,
      style: { left: `${worker.x}%`, top: `${worker.y}%` },
      state: danger ? "近机风险" : worker.normalState,
      distance: danger ? "围栏内" : worker.distance,
      danger,
    };
  });
  const machineRisks = workers.filter((worker) => worker.danger);
  const hasMachineRisk = machineRisks.length > 0;
  const workFence = { left: 56, right: 92, top: 58, bottom: 87 };
  const workRisks = workers.filter((worker) => worker.x < workFence.left || worker.x > workFence.right || worker.y < workFence.top || worker.y > workFence.bottom);
  const hasWorkBreach = workRisks.length > 0;
  const yellowBreach = boundaryBreachActive && hasWorkBreach;
  const chooseOperationScene = (scene) => {
    setOperationScene(scene);
    if (scene === "实时监测") { setTrainProgress(8); setPlaying(true); return; }
    setPlaying(false);
    if (scene === "黄级来车") setTrainProgress(29);
    if (scene === "围栏越界") setTrainProgress(8);
    if (scene === "近机风险") setTrainProgress(8);
    if (scene === "红级来车") setTrainProgress(41.25);
  };
  useEffect(() => {
    if (!yellowBreach) {
      yellowVoiceSent.current = false;
      setYellowAcknowledged(false);
      return;
    }
    if (!voiceEnabled || yellowVoiceSent.current || !("speechSynthesis" in window)) return;
    speakText(`围栏越界告警，${workRisks.map((worker) => worker.id).join("、")}越出作业围栏，请立即返回作业区。`);
    yellowVoiceSent.current = true;
  }, [yellowBreach, voiceEnabled, workRisks]);
  return <div className={`protection-page phase-${alert.level}`}>
    <div className="protection-lead"><div><Radio size={17} /><b>{alert.name}</b><span>{etaSeconds === 0 ? "列车已到达作业区，倒计时归零，持续执行红级防护" : alert.hint}</span></div><div className="protection-controls"><select className="scene-select" aria-label="选择运行态势" value={operationScene} onChange={(event) => chooseOperationScene(event.target.value)}><option>实时监测</option><option>黄级来车</option><option>围栏越界</option><option>近机风险</option><option>红级来车</option></select><button className={`voice-control ${voiceEnabled ? "enabled" : ""}`} onClick={() => { const next = !voiceEnabled; setVoiceEnabled(next); lastVoiceLevel.current = next ? alert.level : ""; if (next) speakText(alert.voice); else window.speechSynthesis?.cancel(); }} title="开启或关闭语音播报">{voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}{voiceEnabled ? "语音已开" : "语音已关"}</button><button className="operation-control" onClick={() => speakText(alert.voice)}><Volume2 size={15} />播放语音</button><button className="operation-control" onClick={() => { if (trainProgress >= 104) { setTrainProgress(-12); setPlaying(true); setOperationScene("实时监测"); } else setPlaying((value) => !value); }}><i className={playing ? "pulse-dot" : "pause-dot"} />{playing ? "实时监测中" : trainProgress >= 104 ? "重新监测" : "继续监测"}</button></div></div>
    <div className="protection-summary">
      <div className={`arrival-status ${alert.level}`}><span>临线来车预警</span><b>{alert.name}</b><small>S1、S2 双点同步感知 · 400m 基线辨速</small></div>
      <div className="eta-status"><span>列车到达倒计时 ETA</span><b>{eta}</b><small>D3102 次 · 距工点 {distance}</small></div>
      <div className="fence-status"><span>动态双围栏</span><b>2 / 2 在线</b><small>作业围栏 + 机具围栏</small></div>
      <div className={`person-status ${hasMachineRisk ? "danger" : ""}`}><span>{hasMachineRisk ? "需现场确认" : "人员状态"}</span><b>{hasMachineRisk ? `${machineRisks.length} 人近机` : "4 人在位"}</b><small>{hasMachineRisk ? `${machineRisks.map((worker) => worker.id).join("、")} 已进入机具围栏` : "视觉–UWB 联合核验"}</small></div>
    </div>
    {yellowBreach && <section className="yellow-breach-alert"><div className="breach-icon"><BellRing size={22} /></div><div><b>黄色告警 · 人员越出作业围栏</b><span>{workRisks.map((worker) => `${worker.id} ${worker.name}`).join("、")} 已离开 F1 作业围栏，请立即返回作业区。</span></div><div className="yellow-alert-actions"><button className="sound" onClick={() => speakText(`围栏越界告警，${workRisks.map((worker) => worker.id).join("、")}越出作业围栏，请立即返回作业区。`)}><Volume2 size={16} />播放语音</button><button onClick={() => setYellowAcknowledged(true)}>{yellowAcknowledged ? <><Check size={16} /> 已提醒</> : "确认已提醒"}</button></div></section>}
    <div className="protection-layout">
      <section className="dynamic-map panel">
        <PanelTitle icon={<TrainFront size={18} />} title="临线来车与人机动态防护态势" extra={<span>{task.site}</span>} />
        <div className="dynamic-rail-map">
          <div className="map-guideline">来车辅助预警由双点时差钢轨振动感知触发，不替代调度命令和现场防护。</div>
          <div className="track-caption adjacent">临线 · 下行方向</div><div className="track-pair adjacent-track"><i /><i /></div>
          <div className="sensor s1"><b>S1</b><span>远端节点 · 作业区外 400m</span><em className={trainProgress >= 0 ? "active" : ""} /></div><div className="sensor s2"><b>S2</b><span>近端节点 · 作业区侧</span><em className={trainProgress >= 0 ? "active" : ""} /></div><div className="sensor-baseline">S1 — S2：400m 测速基线 · 双点时差辨速 → ETA</div>
          {trainProgress >= 0 && <div className="vibration-wave wave-one" />}{trainProgress >= 0 && <div className="vibration-wave wave-two" />}{trainProgress >= -6 && trainProgress <= 105 && <div className={`approaching-train ${alert.level}`} style={{ left: `${trainProgress}%` }}><TrainFront size={21} /><b>D3102</b><small>{eta}</small></div>}
          <div className="track-caption work">施工线路 · K1028+580 — K1028+720</div><div className="track-pair work-track"><i /><i /></div>
          <div className="work-fence"><div className="fence-label"><span>F1</span><b>作业围栏</b><small>当前作业范围</small></div></div>
          <div className={`machine-fence ${hasMachineRisk ? "risk" : ""}`} style={{ transform: `translate(${machineOffset * 4}px, ${machineOffset * 2}px)` }}><div className="machine-tool"><Wrench size={19} /><b>M-01</b><span>改道机具</span></div><div className="machine-label"><span>F2</span> 机具围栏</div></div>
          {workers.map((worker) => <div className={`worker-tag ${worker.color} ${worker.danger ? "danger" : ""} ${workRisks.includes(worker) ? "work-breach" : ""} ${worker.uwb ? "uwb" : ""}`} key={worker.name} style={worker.style} title={`${worker.id} · ${worker.name}｜${workRisks.includes(worker) ? "越出作业围栏" : worker.state}`}><i className="worker-trail" /><div className="cartoon-worker"><i className="helmet" /><i className="face" /><i className="body" /></div><b>{worker.id}</b></div>)}
          <div className="map-legend dynamic-legend"><span className="legend-work" /> 作业围栏<span className="legend-machine" /> 机具围栏<span className="legend-worker" /> 人员标签</div>
        </div>
      </section>
      <aside className="command-rail">
        <section className="command-card panel"><PanelTitle icon={<Radio size={17} />} title="来车处置状态" /><div className="arrival-detail"><div><span>当前列车</span><b>D3102 次</b></div><div><span>到达倒计时</span><b className={alert.level}>{eta}</b></div><div><span>双点测速</span><b>400m 基线 · 82 km/h</b></div><div><span>现场动作</span><b>{alert.action}</b></div></div></section>
        <section className="command-card panel people-command"><PanelTitle icon={<UsersRound size={17} />} title="人员状态" extra={<span>{hasMachineRisk || hasWorkBreach ? `${machineRisks.length + workRisks.length} 项待确认` : "全部正常"}</span>} /><div className="worker-list">{workers.map((worker) => { const breach = workRisks.includes(worker); return <div className={`${worker.color} ${worker.danger || breach ? "risk-row" : ""}`} key={`${worker.name}-row`}><div><b><i />{worker.id} · {worker.name}</b><small>{worker.role}</small></div><span>{worker.danger ? "近机风险" : breach ? "越出作业围栏" : worker.state}</span><em>{worker.danger ? "围栏内" : breach ? "需返回" : worker.distance}</em></div>; })}</div></section>
      </aside>
    </div>
    {hasMachineRisk && <section className="machine-proximity-alert"><div className="machine-proximity-icon"><Wrench size={21} /></div><div><b>近机风险告警 · 人员进入 F2 机具围栏</b><span>{machineRisks.map((worker) => `${worker.id} ${worker.name}`).join("、")} 与 M-01 机具安全间距不足，请立即退出机具影响范围。</span></div><div><em>视觉–UWB 联判</em><button onClick={() => speakText(`近机风险告警，${machineRisks.map((worker) => worker.id).join("、")}已进入机具围栏，请立即退出机具影响范围。`)}><Volume2 size={16} />语音提醒</button></div></section>}
    <section className="risk-timeline panel"><PanelTitle icon={<Clock3 size={17} />} title="临线风险处置链" extra={<button onClick={() => setPage("实时监管")}>查看视频与 SOP 监管 <ChevronRight size={15} /></button>} /><div className="risk-steps">{["节点待命", "远端提示", "近端确认", "人机状态核验", "现场确认", "风险解除"].map((item, index) => { const active = index <= phaseIndex + 1; const current = index === phaseIndex + 1; return <div className={`${active ? "active" : ""} ${current ? "current" : ""}`} key={item}><i>{active ? <Check size={13} /> : index + 1}</i><b>{item}</b>{current && <span>当前</span>}</div>; })}</div></section>
    {strongAlertOpen && <div className="strong-alert-backdrop"><section className="strong-alert-modal"><div className="strong-alert-icon"><CircleAlert size={38} /></div><span>红级强预警</span><h2>{etaSeconds === 0 ? "临线列车已到达作业区" : "临线列车即将到达作业区"}</h2><b>ETA {eta}</b><p>{etaSeconds === 0 ? "请立即执行人员、机具现场确认；确认完成前保持红级防护状态。" : "列车将在 1 分钟内到达，请立即停止作业并确认人员、机具安全状态。"}</p><div className="strong-alert-actions"><button className="strong-voice" onClick={() => speakText(etaSeconds === 0 ? "红级预警，临线列车已到达作业区，请立即确认现场安全状态。" : "红级预警，临线列车将在一分钟内到达作业区，请立即确认现场安全状态。")}><Volume2 size={18} />播放语音</button><button onClick={() => setStrongAlertOpen(false)}><Check size={18} />确认强提醒</button></div></section></div>}
  </div>;
}

function Dashboard({
  sopStep,
  events,
  pending,
  mode,
  setMode,
  triggerEvent,
  setActiveEvent,
  advanceSop,
  videoRef,
}) {
  const [frameTime, setFrameTime] = useState(0);
  const [aiResult, setAiResult] = useState(null);
  const autoAlertFired = useRef(false);
  // Legacy overlays remain in markup temporarily for layout compatibility;
  // they are hidden in CSS and never presented as model output.
  const tracks = {
    worker: { left: 0, top: 0, width: 0, height: 0, confidence: "--" },
    fastener: { left: 0, top: 0, width: 0, height: 0, confidence: "--" },
    violation: { left: 0, top: 0, width: 0, height: 0 },
  };

  useEffect(() => {
    let cancelled = false;
    const loadResult = () => {
      fetch(assetUrl("/analysis/latest.json"), { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (!cancelled) setAiResult(data);
        })
        .catch(() => {
          if (!cancelled) setAiResult(null);
        });
    };
    loadResult();
    const timer = window.setInterval(loadResult, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    let callbackId;
    const onFrame = (_, metadata) => {
      setFrameTime(metadata.mediaTime);
      callbackId = video.requestVideoFrameCallback?.(onFrame);
    };
    if (video.requestVideoFrameCallback)
      callbackId = video.requestVideoFrameCallback(onFrame);
    const onTimeUpdate = () => setFrameTime(video.currentTime);
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      if (callbackId && video.cancelVideoFrameCallback)
        video.cancelVideoFrameCallback(callbackId);
    };
  }, [videoRef]);

  useEffect(() => {
    if (mode !== "风险校验" || frameTime < 2 || autoAlertFired.current) return;
    autoAlertFired.current = true;
    triggerEvent("loose", "auto");
  }, [frameTime, mode, triggerEvent]);

  const frameNo = Math.floor(frameTime * (aiResult?.fps || 25));
  const currentFrame = aiResult?.frames?.[Math.min(frameNo, (aiResult?.frames?.length || 1) - 1)];
  const detections = currentFrame?.people || [];
  const objectDetections = getManualAnnotations(frameTime);
  const procedure = getProcedureEvidence(frameTime);
  return (
    <>
      <div className="quickbar">
        <div>
          <Radio size={17} />
          <b>边缘感知在线</b>
          <span> 视频 / 扭矩扳手 / 轨距尺均正常</span>
        </div>
        <div className="mode-switch">
          <button
            className={mode === "标准运行" ? "selected" : ""}
            onClick={() => setMode("标准运行")}
          >
            标准运行
          </button>
          <button
            className={mode === "风险校验" ? "selected warning-mode" : ""}
            onClick={() => setMode("风险校验")}
          >
            风险校验
          </button>
        </div>
      </div>
      <div className="dashboard-grid fastener-grid">
        <section className="video-panel panel">
          <PanelTitle
            icon={<Eye size={18} />}
            title="扣件改道实时监管"
            extra={
              <span className={`live ${aiResult ? "ready" : ""}`}>
                <i />
                视频标注已加载
              </span>
            }
          />
          <div className="worksite fastener-video">
            <video
              ref={videoRef}
              src={assetUrl("/fastener-gauge-adjustment.mp4")}
              autoPlay
              muted
              loop
              controls
              playsInline
            />
            <span className="tag current-evidence">
              当前识别：清除承轨台脏污 / 调整扣板
            </span>
            <span className="tag current-step">
              第 {sopStep} 步 · {SOP[sopStep - 1].title}
            </span>
            <span className="procedure-readout">
              <b>当前工序：第 {procedure.sop} 步 · {procedure.name}</b>
              <small>{procedure.source} · 置信判断 {procedure.confidence}</small>
            </span>
            <span className="frame-readout">
              实时推理 · 帧 #{frameNo} · 25 FPS
            </span>
            <span
              className="detect-box detect-worker"
              style={{
                left: `${tracks.worker.left}%`,
                top: `${tracks.worker.top}%`,
                width: `${tracks.worker.width}%`,
                height: `${tracks.worker.height}%`,
              }}
            >
              <b>作业人员</b>
              <small>置信度 {tracks.worker.confidence}</small>
            </span>
            <span
              className="detect-box detect-fastener"
              style={{
                left: `${tracks.fastener.left}%`,
                top: `${tracks.fastener.top}%`,
                width: `${tracks.fastener.width}%`,
                height: `${tracks.fastener.height}%`,
              }}
            >
              <b>扣件作业区</b>
              <small>置信度 {tracks.fastener.confidence}</small>
            </span>
            {events[0] && (
              <span
                className="detect-box violation-box"
                style={{
                  left: `${tracks.violation.left}%`,
                  top: `${tracks.violation.top}%`,
                  width: `${tracks.violation.width}%`,
                  height: `${tracks.violation.height}%`,
                }}
              >
                <b>{events[0].title}</b>
                <small>违规置信度 0.93 · 实时跟踪</small>
              </span>
            )}
            <span className="analysis-readout">
              视频复核标注 · 工序对象随镜头切换持续显示
            </span>
            <svg className="pose-overlay" viewBox="0 0 1920 1080" preserveAspectRatio="none" aria-label="视频标注模式">
              {detections.flatMap((person) => {
                const points = person.keypoints || [];
                const bones = POSE_EDGES.map(([a, b]) => {
                  const start = points[a];
                  const end = points[b];
                  if (!start || !end || start.confidence < 0.35 || end.confidence < 0.35) return null;
                  return <line key={`${person.track_id}-${a}-${b}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />;
                });
                const joints = points.map((point, index) => (
                  point.confidence >= 0.35 ? <circle key={`${person.track_id}-joint-${index}`} cx={point.x} cy={point.y} r="7" /> : null
                ));
                return [...bones, ...joints];
              })}
            </svg>
            {detections.filter((person) => {
              const box = person.box || [];
              return person.confidence >= 0.8 && (box[2] - box[0]) * (box[3] - box[1]) > 100000;
            }).map((person, index) => {
              const [x1, y1, x2, y2] = person.box || [];
              if ([x1, y1, x2, y2].some((value) => typeof value !== "number")) return null;
              const identity = PERSON_IDENTITIES[person.track_id] || { name: `作业人员${index + 1}`, role: "标签在位" };
              return (
                <span
                  className="person-identity"
                  key={`person-${person.track_id}-${index}`}
                  style={{
                    left: `${(x1 / 1920) * 100}%`,
                    top: `${(y1 / 1080) * 100}%`,
                    width: `${((x2 - x1) / 1920) * 100}%`,
                    height: `${((y2 - y1) / 1080) * 100}%`,
                  }}
                >
                  <b>{identity.name}</b>
                  <small>{identity.role} · 在位</small>
                </span>
              );
            })}
            {objectDetections.map((object, index) => {
              const label = SPECIALIZED_LABELS[object.class] || { name: object.class, kind: "fastener" };
              return (
                <span
                  className={`specialized-box ${label.kind} manual-box`}
                  key={object.id || `${object.class}-${index}`}
                  style={{
                    left: `${object.left}%`,
                    top: `${object.top}%`,
                    width: `${object.width}%`,
                    height: `${object.height}%`,
                  }}
                >
                  <b>{label.name}</b>
                  <small>置信度 {(object.confidence * 100).toFixed(0)}%</small>
                </span>
              );
            })}
          </div>
          <div className="evidence-strip">
            <b>视频证据：</b>
            {procedure.objects.map((object) => (
              <span key={object}>{object}</span>
            ))}
            <span>{procedure.action}</span>
          </div>
          <div className="recognition-dock">
            <div className="recognition-card pose-card">
              <span>人员作业姿态</span>
              <b>YOLO Pose · 已加载</b>
              <small>骨架：青绿　关节：橙色</small>
            </div>
            <div className="recognition-card tool-card">
              <span>机具视频标注</span>
              <b>{objectDetections.filter((item) => SPECIALIZED_LABELS[item.class]?.kind === "tool").length} 项</b>
              <small>撬棍 / 调整工具：黄色框</small>
            </div>
            <div className="recognition-card fastener-card">
              <span>扣件组件标注</span>
              <b>{objectDetections.filter((item) => SPECIALIZED_LABELS[item.class]?.kind === "fastener").length} 项</b>
              <small>弹条 / 扣板 / 螺杆：紫色框</small>
            </div>
          </div>
        </section>
        <section className="sop-panel panel">
          <PanelTitle
            icon={<ClipboardCheck size={18} />}
            title={`扣件改道SOP（${SOP.length}步）`}
          />
          <div className="sop-list">
            {SOP.map((item) => {
              const state =
                item.id < sopStep
                  ? "done"
                  : item.id === sopStep
                    ? "current"
                    : "future";
              const blocked = pending.some((e) => e.node === item.id);
              return (
                <button
                  key={item.id}
                  className={`sop-item ${state} ${blocked ? "blocked" : ""}`}
                  onClick={() => item.id === sopStep && advanceSop()}
                >
                  <span className="sop-dot">
                    {state === "done" ? <Check size={15} /> : item.id}
                  </span>
                  <span className="sop-copy">
                    <b>{item.title}</b>
                    <small>{item.evidence}</small>
                  </span>
                  <em>
                    {blocked
                      ? "待处置"
                      : state === "done"
                        ? "已完成"
                        : state === "current"
                          ? "进行中"
                          : "待执行"}
                  </em>
                </button>
              );
            })}
          </div>
          <div className="sop-hint">
            <b>当前规则：</b>
            {SOP[sopStep - 1].rule}
            <button
              onClick={advanceSop}
              disabled={
                sopStep === SOP.length ||
                pending.some((e) => e.node === sopStep + 1)
              }
            >
              {sopStep === SOP.length ? "作业已完成" : "完成当前步骤"}{" "}
              <ChevronRight size={16} />
            </button>
          </div>
        </section>
        <section className="right-rail">
          <QualityControl />
          <div className="panel alerts-card">
            <PanelTitle
              icon={<BellRing size={18} />}
              title={`告警队列（${pending.length}/3）`}
              extra={<span>待处置</span>}
            />
            {pending.length ? (
              pending.map((event) => (
                <button className="alert-row" key={event.id} onClick={() => setActiveEvent(event)}>
                  <span className={`level ${event.level}`}>{event.level}</span>
                  <div>
                    <b>{event.title}</b>
                    <small>
                      {event.time} · {typeof event.node === "number" ? `第${event.node}步` : event.node}
                    </small>
                  </div>
                  <ChevronRight size={17} />
                </button>
              ))
            ) : (
              <div className="empty">
                <ShieldCheck size={26} />
                <span>暂无待处置告警</span>
              </div>
            )}
          </div>
          <div className="panel status-card">
            <PanelTitle icon={<UsersRound size={18} />} title="作业要素状态" />
            <div className="status-title">
              人员（4人）<b>全部在线</b>
            </div>
            <div className="people">
              <Person name="陈飞宇" role="作业负责人" />
              <Person name="许静逸" role="现场防护" />
              <Person name="杜哲生" role="安全监护" />
              <Person name="刘洋" role="质量检查" />
            </div>
            <div className="status-title">
              <Wrench size={15} />
              关键机具<b>运行正常</b>
            </div>
            <div className="equipment">
              <span>
                轨距尺<small>校验有效</small>
              </span>
              <span>
                扭矩扳手<small>读数在线</small>
              </span>
              <span>
                平板终端<small>电量 78%</small>
              </span>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function QualityControl() {
  return (
    <div className="panel quality-card">
      <PanelTitle icon={<ShieldCheck size={18} />} title="质量控制" />
      <div className="quality-row">
        <span>轨距</span>
        <b>
          1435 <small>mm</small>
        </b>
        <em>±1mm</em>
      </div>
      <div className="quality-row">
        <span>轨距递减率</span>
        <b>
          0.25 <small>‰</small>
        </b>
        <em>≤0.5‰</em>
      </div>
      <div className="quality-row">
        <span>扭力矩</span>
        <b>
          142 <small>N·m</small>
        </b>
        <em>130—160</em>
      </div>
      <div className="quality-note">
        <CircleAlert size={16} />
        <span>松扣件规则：P50轨以下连续松卸不得超过5头。</span>
      </div>
    </div>
  );
}

function Alerts({ events, onResolve }) {
  const records = events;
  const [selectedId, setSelectedId] = useState(records[0]?.id);
  const selected = records.find((item) => item.id === selectedId) || records[0];
  const pendingCount = records.filter((item) => item.status !== "已处置").length;
  useEffect(() => {
    if (selectedId && records.some((item) => item.id === selectedId)) return;
    setSelectedId(records[0]?.id);
  }, [records, selectedId]);
  return (
    <section className="wide-page alert-center-page">
      <div className="page-summary">
        <CircleAlert />
        <div>
          <h2>告警处置中心</h2>
          <p>每条告警均关联视频截帧、违规规则、处置记录与复盘证据。</p>
        </div>
      </div>
      <div className="alert-center-summary"><div><span>本次告警</span><b>{records.length}<small>起</small></b></div><div className="pending"><span>待处置</span><b>{pendingCount}<small>起</small></b></div><div><span>已闭环</span><b>{records.length - pendingCount}<small>起</small></b></div><div><span>语音触达</span><b>100<small>%</small></b></div></div>
      <div className="alert-center-layout">
        <section className="panel alert-record-list"><PanelTitle icon={<BellRing size={18} />} title="告警队列" extra={<span>{pendingCount ? `${pendingCount} 项待处理` : "全部已闭环"}</span>} />
          {records.map((event) => <button className={`alert-record ${selected?.id === event.id ? "selected" : ""} ${event.status === "已处置" ? "resolved" : ""}`} key={event.id} onClick={() => setSelectedId(event.id)}><span className={`alert-level ${event.level}`}>{event.level}</span><div><b>{event.title}</b><small>{event.time} · {event.person || "现场人员"}</small><em>{event.detail}</em></div><i>{event.status}</i></button>)}
        </section>
        {selected && <section className="panel alert-detail-card"><PanelTitle icon={<Eye size={18} />} title="告警处置单" extra={<span className={selected.status === "已处置" ? "success-text" : "danger-text"}>{selected.status}</span>} /><div className="alert-detail-image"><img src={selected.snapshot || assetUrl("/railway-worksite.png")} alt={`${selected.title}证据截图`} /><span>告警证据 · {selected.time}</span></div><div className="alert-detail-body"><div className="alert-detail-title"><span className={`alert-level ${selected.level}`}>{selected.level}</span><div><h3>{selected.title}</h3><p>{selected.detail}</p></div></div><dl><div><dt>关联对象</dt><dd>{selected.person || "视频作业人员"}</dd></div><div><dt>感知来源</dt><dd>{selected.source || "视频规则引擎"}</dd></div><div><dt>处置措施</dt><dd>{selected.note || selected.action || "待现场确认"}</dd></div></dl><div className="alert-flow"><span>发现</span><i /><span>语音提醒</span><i /><span>现场确认</span><i /><b>{selected.status === "已处置" ? "已闭环" : "待处置"}</b></div>{selected.status !== "已处置" && <button className="primary alert-resolve" onClick={() => onResolve(selected, `安全监护确认：${selected.action}`)}><Check size={18} />确认处置并留痕</button>}</div></section>}
      </div>
    </section>
  );
}

function Review({ events, sopRate }) {
  const reviewEvents = events.map((event) => ({ ...event, duration: event.duration || (event.status === "已处置" ? "已闭环" : "待处置"), kind: event.kind || event.type || "SOP偏差" }));
  const closed = reviewEvents.filter((event) => event.status === "已处置").length;
  const completion = events.every((event) => event.id.startsWith("alert-")) ? 100 : sopRate;
  const highCount = reviewEvents.filter((event) => event.level === "红级" || event.level === "高").length;
  const reportStatus = closed === reviewEvents.length ? "本次风险均已闭环" : "存在待处置风险";
  return <section className="wide-page review-page">
    <div className="page-summary">
      <FileBarChart2 />
      <div><h2>扣件改道作业复盘</h2><p>杭深线 K1028+650 · 2026-07-26 · 扣件改道标准作业</p></div>
      <button className="outline" onClick={() => window.print()}><FileBarChart2 size={16} />导出复盘报告</button>
    </div>
    <section className="review-conclusion panel">
      <div className="review-conclusion-mark"><ShieldCheck size={27} /></div>
      <div><span>作业安全结论</span><h3>{reportStatus}</h3><p>系统完成临线来车预警、人员围栏识别、现场提醒和处置留痕；本报告仅作为施工安全辅助监管记录。</p></div>
      <div className="review-conclusion-meta"><span>任务编号</span><b>TH-20260726-01</b><small>复盘生成 10:31:08</small></div>
    </section>
    <div className="review-kpis">
      <Metric label="风险事件" value={reviewEvents.length} unit="起" tone="orange" />
      <Metric label="已闭环处置" value={`${closed}/${reviewEvents.length}`} unit="" tone="green" />
      <Metric label="临线最高预警" value={highCount ? "红级" : "黄级"} unit="" tone="red" />
      <Metric label="SOP完成率" value={completion} unit="%" tone="blue" />
      <Metric label="平均响应" value="21" unit="秒" tone="cyan" />
    </div>
    <div className="review-grid enhanced-review-grid">
      <section className="panel review-chain">
        <PanelTitle icon={<Clock3 size={18} />} title="风险处置证据链" extra={<span>{closed}/{reviewEvents.length} 已闭环</span>} />
        <div className="review-chain-body">{reviewEvents.map((event, index) => <article className={`review-event ${event.level === "红级" || event.level === "高" ? "red" : "yellow"}`} key={event.id}><div className="review-event-dot"><b>{index + 1}</b></div><div className="review-event-content"><div><span>{event.time}</span><em>{event.level}</em><i>{event.kind}</i></div><h4>{event.title}</h4><p>{event.detail}</p><footer><b>处置：{event.note || "待现场确认"}</b><span>响应 {event.duration}</span></footer></div></article>)}</div>
      </section>
      <div className="review-right-stack">
        <section className="panel review-sop-card">
          <PanelTitle icon={<ClipboardCheck size={18} />} title="SOP与质量结论" />
          <div className="review-sop-body"><div className="review-donut" style={{ "--rate": `${completion * 3.6}deg` }}><b>{completion}%</b><span>SOP完成</span></div><div className="review-sop-copy"><h4>关键工序证据齐全</h4><p>作业准备、标准股确认、松扣件、清污调整、复测选型、扭矩紧固与回检开通均纳入记录。</p><div><span><Check size={14} />作业过程已留痕</span><span><Check size={14} />风险闭环可追溯</span><span><Check size={14} />回检前需人工确认</span></div></div></div>
        </section>
        <section className="panel review-closure-card"><PanelTitle icon={<UsersRound size={18} />} title="闭环责任与结论" /><div className="closure-row"><span>作业负责人</span><b>陈飞宇</b><em>已确认</em></div><div className="closure-row"><span>安全监护</span><b>杜哲生</b><em>已确认</em></div><div className="closure-row"><span>质量检查</span><b>刘洋</b><em>已复核</em></div><p><ShieldCheck size={16} />本页已形成“发现—提醒—确认—处置—复盘”完整留痕。</p></section>
      </div>
    </div>
    <section className="panel review-evidence-gallery">
      <PanelTitle icon={<Eye size={18} />} title="关键证据截图" extra={<span>视频、告警、处置记录关联存档</span>} />
      <div className="evidence-gallery-grid">{reviewEvents.slice(0, 3).map((event) => <article key={`${event.id}-image`}><div className="evidence-frame"><img src={event.snapshot || assetUrl("/railway-worksite.png")} alt={`${event.title}证据截图`} /><span className={event.level === "红级" || event.level === "高" ? "red" : "yellow"}>{event.level}</span></div><div><b>{event.title}</b><small>{event.time} · {event.kind}</small></div></article>)}</div>
    </section>
  </section>;
}

function TaskConfig({ task, setTask }) {
  const [saved, setSaved] = useState(false);
  const updateTask = (field, value) => {
    setTask({ ...task, [field]: value });
    setSaved(false);
  };
  return (
    <section className="wide-page task-config-page">
      <div className="page-summary">
        <Settings2 />
        <div>
          <h2>任务配置</h2>
          <p>配置作业任务、预警参数、围栏范围和作业要素；不接入真实调度系统。</p>
        </div>
      </div>
      <div className="task-config-layout">
        <section className="panel config-main"><PanelTitle icon={<MapPin size={18} />} title="基础任务信息" /><div className="config-grid"><label>工点位置<input value={task.site} onChange={(e) => updateTask("site", e.target.value)} /></label><label>作业项目<select value={task.project} onChange={(e) => updateTask("project", e.target.value)}><option>扣件改道作业</option><option>钢轨改道作业</option><option>道岔维修作业</option><option>轨距复测与调整</option><option>线路综合维修作业</option><option>道岔钢轨专项探伤</option></select></label><label>天窗时间<input value={task.windowRange} onChange={(e) => updateTask("windowRange", e.target.value)} /></label><label>SOP模板<select value={task.sopTemplate} onChange={(e) => updateTask("sopTemplate", e.target.value)}><option>扣件改道标准作业（8步）</option><option>钢轨改道标准作业（7步）</option><option>道岔维修标准作业（9步）</option><option>线路综合维修作业（6步）</option><option>施工销记与开通检查（5步）</option></select></label><label>施工线路<select value={task.workLine} onChange={(e) => updateTask("workLine", e.target.value)}><option>上行线 · K1028+580—K1028+720</option><option>下行线 · K1028+580—K1028+720</option><option>站内 3 号道岔作业区</option></select></label><label>临线方向<select value={task.adjacentLine} onChange={(e) => updateTask("adjacentLine", e.target.value)}><option>下行线 · D3102 接近方向</option><option>上行线 · D3121 接近方向</option><option>无临线列车作业区</option></select></label></div></section>
        <aside className="config-side-stack"><section className="panel config-parameter"><PanelTitle icon={<Radio size={18} />} title="临线预警参数" /><div><span>S1—S2 测速基线</span><b>400 m</b></div><div><span>黄级预警</span><b>ETA 01:00—03:00</b></div><div><span>红级强预警</span><b>ETA ≤ 01:00</b></div><div><span>语音播报</span><b className="green-text">已启用</b></div></section><section className="panel config-elements"><PanelTitle icon={<UsersRound size={18} />} title="作业要素" /><div><span>作业人员</span><b>P01—P04 · 4人</b></div><div><span>关键机具</span><b>M-01 改道机具</b></div><div><span>动态围栏</span><b>F1 作业围栏 / F2 机具围栏</b></div></section></aside>
      </div>
      <section className="panel config-status-bar"><div><b>数据接入状态</b><span>标准化作业视频、预警事件与视频复核标注已加载</span></div><div className="config-note"><ShieldCheck /><p>系统用于施工安全辅助监管与预警，不替代调度命令、现场防护和正式销记。</p></div><button className={`primary save ${saved ? "saved" : ""}`} onClick={() => setSaved(true)}>{saved ? "配置已保存" : "保存任务配置"}<Check size={18} /></button></section>
    </section>
  );
}

const PanelTitle = ({ icon, title, extra }) => (
  <header className="panel-title">
    <div>
      {icon}
      <b>{title}</b>
    </div>
    {extra}
  </header>
);
const Person = ({ name, role }) => (
  <div className="person">
    <i />
    <b>{name}</b>
    <small>{role}</small>
  </div>
);
const Metric = ({ label, value, unit, tone = "" }) => (
  <div className={`metric ${tone}`}>
    <span>{label}</span>
    <b>
      {value}
      <small>{unit}</small>
    </b>
  </div>
);
export default App;
