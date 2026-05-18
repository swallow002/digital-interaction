const slotOrder = ["G", "A", "C", "EF", "D", "B", "HI"];
const slotLabels = {
  G: "槽位1",
  A: "槽位2",
  C: "槽位3",
  EF: "槽位4",
  D: "槽位5",
  B: "槽位6",
  HI: "槽位7"
};

const slotPositions = {
  G: { x: 12.0 },
  A: { x: 23.2 },
  C: { x: 35.8 },
  EF: { x: 49.8 },
  D: { x: 64.0 },
  B: { x: 76.6 },
  HI: { x: 87.8 }
};

const probes = {
  G: {
    id: "G",
    title: "G 探头",
    badge: "单探头",
    desc: "G · 37°↑ · 水平摆放",
    colors: ["#D0B44D"],
    axisDirection: "left",
    sideLines: ["37°↑", "G"],
    topLines: ["G 37°↑"],
    sideVisual: { type: "single", variant: "right", beams: [{ x: 42, y: 39, length: 70, angle: 135 }] },
    topVisual: { type: "single", rotation: 0, lineMode: "single-left" }
  },
  A: {
    id: "A",
    title: "A 探头",
    badge: "单探头",
    desc: "A · 70°↗ · 斜向摆放",
    colors: ["#8D6ED6"],
    axisDirection: "left",
    sideLines: ["70°↗", "A"],
    topLines: ["A 70°↗"],
    sideVisual: { type: "single", variant: "right", beams: [{ x: 46, y: 39, length: 86, angle: 145 }] },
    topVisual: { type: "single", rotation: 25, lineMode: "single-left" }
  },
  C: {
    id: "C",
    title: "C 探头",
    badge: "单探头",
    desc: "C · 70°↖ · 斜向摆放",
    colors: ["#46B6D8"],
    axisDirection: "left",
    sideLines: ["70°↖", "C"],
    topLines: ["C 70°↖"],
    sideVisual: { type: "single", variant: "left", beams: [{ x: 48, y: 39, length: 86, angle: 150 }] },
    topVisual: { type: "single", rotation: -25, lineMode: "single-left" }
  },
  EF: {
    id: "EF",
    title: "E/F 组合",
    badge: "组合探头",
    desc: "E · 70°↑，F · 70°↓",
    colors: ["#6E5DD5", "#47484C"],
    sideLines: ["70°↑   70°↓", "E      F"],
    topLines: ["F 70°↓   E 70°↑"],
    sideVisual: {
      type: "combo-ef",
      beams: [
        { x: 36, y: 39, length: 72, angle: 42 },
        { x: 68, y: 39, length: 72, angle: 138 }
      ]
    },
    topVisual: { type: "combo-ef" }
  },
  D: {
    id: "D",
    title: "D 探头",
    badge: "单探头",
    desc: "D · 70°↙ · 斜向摆放",
    colors: ["#2F86E4"],
    axisDirection: "right",
    sideLines: ["70°↙", "D"],
    topLines: ["D 70°↙"],
    sideVisual: { type: "single", variant: "right", beams: [{ x: 46, y: 39, length: 88, angle: 35 }] },
    topVisual: { type: "single", rotation: 25, lineMode: "single-right" }
  },
  B: {
    id: "B",
    title: "B 探头",
    badge: "单探头",
    desc: "B · 70°↘ · 斜向摆放",
    colors: ["#6CBF66"],
    axisDirection: "right",
    sideLines: ["70°↘", "B"],
    topLines: ["B 70°↘"],
    sideVisual: { type: "single", variant: "right", beams: [{ x: 46, y: 39, length: 90, angle: 35 }] },
    topVisual: { type: "single", rotation: -25, lineMode: "single-right" }
  },
  HI: {
    id: "HI",
    title: "H/I 组合",
    badge: "组合探头",
    desc: "H · 37°↓，I · 0°",
    colors: ["#E28A33", "#3675D8"],
    sideLines: ["0°   37°↓", "I      H"],
    topLines: ["H 37°↓   I 0°"],
    sideVisual: {
      type: "combo-hi",
      beams: [
        { x: 38, y: 39, length: 54, angle: 90 },
        { x: 66, y: 39, length: 64, angle: 45 }
      ]
    },
    topVisual: { type: "combo-hi" }
  }
};

const libraryEl = document.getElementById("library");
const sideDiagramEl = document.getElementById("sideDiagram");
const topDiagramEl = document.getElementById("topDiagram");
const feedbackContentEl = document.getElementById("feedbackContent");
const scoreTextEl = document.getElementById("scoreText");
const modeTextEl = document.getElementById("modeText");
const timerTextEl = document.getElementById("timerText");
const btnPractice = document.getElementById("btnPractice");
const btnExam = document.getElementById("btnExam");
const btnCheck = document.getElementById("btnCheck");
const btnReset = document.getElementById("btnReset");
const btnAnswer = document.getElementById("btnAnswer");

let selectedProbeId = null;
let dragProbeId = null;
let mode = "practice";
let placements = createEmptyPlacements();
let scoreMarks = {};
let examStartAt = Date.now();
let timerHandle = null;
let libraryOrder = [...slotOrder];

function createEmptyPlacements() {
  return Object.fromEntries(slotOrder.map((slotId) => [slotId, null]));
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getCurrentPlacedSlotByProbe(probeId) {
  return slotOrder.find((slotId) => placements[slotId] === probeId) || null;
}

function clearScoreMarks() {
  scoreMarks = {};
  scoreTextEl.textContent = "--";
}

function resetFeedback() {
  feedbackContentEl.innerHTML = "当前未提交。请先完成布置后点击“检查答案”。";
}

function startTimer() {
  if (timerHandle) clearInterval(timerHandle);
  examStartAt = Date.now();
  timerTextEl.textContent = "00:00";
  timerHandle = setInterval(() => {
    timerTextEl.textContent = formatTime(Date.now() - examStartAt);
  }, 1000);
}

function setMode(nextMode) {
  mode = nextMode;
  modeTextEl.textContent = mode === "practice" ? "练习模式" : "考核模式";
  btnPractice.classList.toggle("active", mode === "practice");
  btnExam.classList.toggle("active", mode === "exam");
  btnAnswer.disabled = mode === "exam";
  btnAnswer.style.opacity = mode === "exam" ? ".55" : "1";
  clearScoreMarks();
  libraryOrder = mode === "exam" ? shuffle(slotOrder) : [...slotOrder];
  resetFeedback();
  renderAll();
  startTimer();
}

function selectProbe(probeId) {
  selectedProbeId = selectedProbeId === probeId ? null : probeId;
  renderLibrary();
  renderDiagrams();
}

function unplaceSlot(slotId) {
  placements[slotId] = null;
  clearScoreMarks();
  resetFeedback();
  renderAll();
}

function placeProbe(slotId, probeId) {
  if (!probeId) return;

  const oldSlotOfProbe = getCurrentPlacedSlotByProbe(probeId);
  if (oldSlotOfProbe) placements[oldSlotOfProbe] = null;

  if (placements[slotId] && placements[slotId] !== probeId) {
    placements[slotId] = null;
  }

  placements[slotId] = probeId;
  selectedProbeId = null;
  clearScoreMarks();
  resetFeedback();
  renderAll();
}

function checkAnswer() {
  let correctCount = 0;
  scoreMarks = {};
  const errors = [];
  const empties = [];

  slotOrder.forEach((slotId) => {
    const placed = placements[slotId];
    if (!placed) {
      scoreMarks[slotId] = "empty";
      empties.push(slotId);
      return;
    }
    if (placed === slotId) {
      scoreMarks[slotId] = "correct";
      correctCount += 1;
    } else {
      scoreMarks[slotId] = "wrong";
      errors.push({ slotId, placed });
    }
  });

  const score = Math.round((correctCount / slotOrder.length) * 100);
  scoreTextEl.textContent = `${score}`;

  const errText = errors.length
    ? errors.map((item) => `位置 ${slotLabels[item.slotId]} 放成了 ${probes[item.placed].title}`).join("<br>")
    : "";

  const emptyText = empties.length
    ? `未放置槽位：${empties.map((slotId) => slotLabels[slotId]).join("、")}`
    : "";

  if (correctCount === slotOrder.length) {
    feedbackContentEl.innerHTML = `<strong>提交成功：</strong><span class="ok">全部正确</span>，共 ${slotOrder.length} 个位置均布置正确。`;
  } else {
    feedbackContentEl.innerHTML = [
      `<strong>提交完成：</strong>共正确 <span class="ok">${correctCount}</span> 个，错误 <span class="err">${errors.length}</span> 个，空缺 ${empties.length} 个。`,
      errText,
      emptyText
    ].filter(Boolean).join("<br>");
  }

  renderDiagrams();
}

function showAnswer() {
  if (mode === "exam") return;
  placements = Object.fromEntries(slotOrder.map((slotId) => [slotId, slotId]));
  selectedProbeId = null;
  scoreMarks = Object.fromEntries(slotOrder.map((slotId) => [slotId, "correct"]));
  scoreTextEl.textContent = "100";
  feedbackContentEl.innerHTML = "<strong>标准答案已显示。</strong>当前布局已按正确探头布置填入，可直接用于课堂讲解。";
  renderAll();
}

function applyProbeTheme(el, probe, index = 0) {
  const color = probe.colors[index] || probe.colors[0] || "#7aa7c8";
  el.style.setProperty("--probe-fill", color);
  el.style.setProperty("--probe-stroke", darkenColor(color, -18));
}

function applySecondaryTheme(el, probe, index = 1) {
  const color = probe.colors[index] || probe.colors[0] || "#7aa7c8";
  el.style.setProperty("--probe-fill-2", color);
  el.style.setProperty("--probe-stroke-2", darkenColor(color, -18));
}

function darkenColor(hex, amount) {
  const color = hex.replace("#", "");
  const num = parseInt(color, 16);
  let r = (num >> 16) + amount;
  let g = ((num >> 8) & 0x00ff) + amount;
  let b = (num & 0x0000ff) + amount;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r}, ${g}, ${b})`;
}

function createAxisLine(mode) {
  const line = document.createElement("div");
  line.className = "probe-axis";
  if (mode === "single-left") line.classList.add("axis-single", "to-left");
  if (mode === "single-right") line.classList.add("axis-single", "to-right");
  if (mode === "half-left") line.classList.add("axis-half-left", "to-left");
  if (mode === "half-right") line.classList.add("axis-half-right", "to-right");
  if (mode === "full-right") line.classList.add("axis-full", "to-right");
  if (mode === "full-left") line.classList.add("axis-full", "to-left");
  return line;
}

function createTopShape(probe, visual, isMini = false) {
  const shape = document.createElement("div");
  shape.className = isMini ? "top-probe-shape-mini" : "top-probe-shape";
  if (visual.rotation === 0) shape.classList.add("top-shape-rotate-0");
  if (visual.rotation > 0) shape.classList.add("top-shape-rotate-pos");
  if (visual.rotation < 0) shape.classList.add("top-shape-rotate-neg");
  applyProbeTheme(shape, probe, 0);
  shape.appendChild(createAxisLine(visual.lineMode));
  return shape;
}

function createTopComboVisual(probe, type, isMini = false) {
  const wrap = document.createElement("div");
  wrap.className = "top-flat-wrap";

  const shape = document.createElement("div");
  shape.className = isMini ? "top-probe-shape-mini top-shape-rotate-0" : "top-probe-shape top-shape-rotate-0";
  if (probe.colors.length > 1) {
    shape.style.background = `linear-gradient(90deg, ${probe.colors[0]} 0 50%, ${probe.colors[1]} 50% 100%)`;
    shape.style.borderColor = darkenColor(probe.colors[0], -22);
  } else {
    applyProbeTheme(shape, probe, 0);
  }

  wrap.appendChild(shape);

  if (type === "combo-ef") {
    wrap.appendChild(createAxisLine("half-left"));
    wrap.appendChild(createAxisLine("half-right"));
  } else if (type === "combo-hi") {
    wrap.appendChild(createAxisLine("full-right"));
  }

  return wrap;
}

function createSlotHint(slotId) {
  const hint = document.createElement("div");
  hint.className = "slot-hint";
  hint.textContent = slotLabels[slotId];
  return hint;
}

function createSideSlot(slotId) {
  const slotEl = document.createElement("div");
  slotEl.className = "slot side-slot";
  slotEl.style.left = `${slotPositions[slotId].x}%`;
  slotEl.dataset.slotId = slotId;

  const mark = scoreMarks[slotId];
  if (mark === "correct") slotEl.classList.add("correct");
  if (mark === "wrong") slotEl.classList.add("wrong");
  if (selectedProbeId) slotEl.classList.add("selected");

  slotEl.addEventListener("click", () => {
    if (selectedProbeId) {
      placeProbe(slotId, selectedProbeId);
    } else if (placements[slotId]) {
      unplaceSlot(slotId);
    }
  });

  slotEl.addEventListener("dragover", (e) => e.preventDefault());
  slotEl.addEventListener("drop", (e) => {
    e.preventDefault();
    const probeId = e.dataTransfer.getData("text/plain") || dragProbeId;
    placeProbe(slotId, probeId);
  });

  const placedProbeId = placements[slotId];
  if (placedProbeId) {
    slotEl.appendChild(renderSidePlacement(placedProbeId));
  }

  slotEl.appendChild(createSlotHint(slotId));
  return slotEl;
}

function createTopSlot(slotId) {
  const slotEl = document.createElement("div");
  slotEl.className = "slot top-slot";
  slotEl.style.left = `${slotPositions[slotId].x}%`;
  slotEl.dataset.slotId = slotId;

  const mark = scoreMarks[slotId];
  if (mark === "correct") slotEl.classList.add("correct");
  if (mark === "wrong") slotEl.classList.add("wrong");
  if (selectedProbeId) slotEl.classList.add("selected");

  slotEl.addEventListener("click", () => {
    if (selectedProbeId) {
      placeProbe(slotId, selectedProbeId);
    } else if (placements[slotId]) {
      unplaceSlot(slotId);
    }
  });

  slotEl.addEventListener("dragover", (e) => e.preventDefault());
  slotEl.addEventListener("drop", (e) => {
    e.preventDefault();
    const probeId = e.dataTransfer.getData("text/plain") || dragProbeId;
    placeProbe(slotId, probeId);
  });

  const placedProbeId = placements[slotId];
  if (placedProbeId) {
    slotEl.appendChild(renderTopPlacement(placedProbeId));
  }

  slotEl.appendChild(createSlotHint(slotId));
  return slotEl;
}

function renderBeam({ x, y, length, angle }) {
  const beamEl = document.createElement("div");
  beamEl.className = "beam";
  beamEl.style.left = `${x}px`;
  beamEl.style.top = `${y}px`;
  beamEl.style.width = `${length}px`;
  beamEl.style.transform = `rotate(${angle}deg)`;
  return beamEl;
}

function createSideWedge(className, probe, colorIndex = 0) {
  const wedge = document.createElement("div");
  wedge.className = `side-wedge ${className}`;
  wedge.style.setProperty("--probe-fill", probe.colors[colorIndex] || probe.colors[0]);
  wedge.style.setProperty("--probe-stroke", darkenColor(probe.colors[colorIndex] || probe.colors[0], -18));
  return wedge;
}

function renderSidePlacement(probeId) {
  const probe = probes[probeId];
  const wrap = document.createElement("div");

  const seat = document.createElement("div");
  seat.className = "side-probe-seat";

  if (probe.sideVisual.type === "single") {
    const body = createSideWedge(probe.sideVisual.variant === "left" ? "single-left" : "single-right", probe, 0);
    wrap.append(seat, body);
  }

  if (probe.sideVisual.type === "combo-ef") {
    const comboWrap = document.createElement("div");
    comboWrap.className = "side-combo-wrap";
    const left = createSideWedge("left-in", probe, 0);
    const right = createSideWedge("right-in", probe, 1);
    comboWrap.append(left, right);
    wrap.append(seat, comboWrap);
  }

  if (probe.sideVisual.type === "combo-hi") {
    const comboWrap = document.createElement("div");
    comboWrap.className = "side-combo-wrap";
    const left = createSideWedge("left-single", probe, 0);
    const right = document.createElement("div");
    right.className = "side-hi-vertical";
    applySecondaryTheme(right, probe, 1);
    comboWrap.append(left, right);
    wrap.append(seat, comboWrap);
  }

  probe.sideVisual.beams.forEach((beam) => wrap.appendChild(renderBeam(beam)));

  const labels = document.createElement("div");
  labels.className = "side-labels";
  const line1 = document.createElement("div");
  line1.className = "side-main-line";
  line1.textContent = probe.sideLines[0] || "";
  labels.appendChild(line1);
  if (probe.sideLines[1]) {
    const line2 = document.createElement("div");
    line2.className = "side-sub-line";
    line2.textContent = probe.sideLines[1];
    labels.appendChild(line2);
  }
  wrap.appendChild(labels);

  return wrap;
}

function renderTopPlacement(probeId) {
  const probe = probes[probeId];
  const wrap = document.createElement("div");

  if (probe.topVisual.type === "single") {
    wrap.appendChild(createTopShape(probe, probe.topVisual, false));
  }

  if (probe.topVisual.type === "combo-ef") {
    wrap.appendChild(createTopComboVisual(probe, "combo-ef", false));
  }

  if (probe.topVisual.type === "combo-hi") {
    wrap.appendChild(createTopComboVisual(probe, "combo-hi", false));
  }

  const labels = document.createElement("div");
  labels.className = "top-labels";
  probe.topLines.forEach((text, idx) => {
    const line = document.createElement("div");
    line.className = idx === 0 ? "top-main-line" : "top-sub-line";
    line.textContent = text;
    labels.appendChild(line);
  });
  wrap.appendChild(labels);

  return wrap;
}

function renderLibraryCard(probeId) {
  const probe = probes[probeId];
  const card = document.createElement("div");
  card.className = "probe-card";
  card.draggable = true;
  card.style.setProperty("--accent", probe.colors[0]);

  if (selectedProbeId === probeId) card.classList.add("selected");
  if (getCurrentPlacedSlotByProbe(probeId)) card.classList.add("placed");

  card.addEventListener("click", () => selectProbe(probeId));
  card.addEventListener("dragstart", (e) => {
    dragProbeId = probeId;
    e.dataTransfer.setData("text/plain", probeId);
    e.dataTransfer.effectAllowed = "move";
    selectProbe(probeId);
  });
  card.addEventListener("dragend", () => {
    dragProbeId = null;
  });

  const title = document.createElement("h4");
  title.textContent = probe.title;
  const badge = document.createElement("span");
  badge.className = probe.badge.includes("组合") ? "combo-badge" : "placement-chip";
  badge.textContent = probe.badge;
  title.appendChild(badge);

  const desc = document.createElement("p");
  desc.textContent = probe.desc;

  const miniVisual = document.createElement("div");
  miniVisual.className = "card-mini-visual";

  if (probe.topVisual.type === "single") {
    miniVisual.appendChild(createTopShape(probe, probe.topVisual, true));
  } else if (probe.topVisual.type === "combo-ef") {
    miniVisual.appendChild(createTopComboVisual(probe, "combo-ef", true));
  } else if (probe.topVisual.type === "combo-hi") {
    miniVisual.appendChild(createTopComboVisual(probe, "combo-hi", true));
  }

  card.append(title, desc, miniVisual);
  return card;
}

function renderLibrary() {
  libraryEl.innerHTML = "";
  libraryOrder.forEach((probeId) => libraryEl.appendChild(renderLibraryCard(probeId)));
}

function renderDiagrams() {
  sideDiagramEl.innerHTML = "";
  topDiagramEl.innerHTML = "";

  const sideRail = document.createElement("div");
  sideRail.className = "rail-area";
  sideDiagramEl.append(sideRail);

  const topRail = document.createElement("div");
  topRail.className = "rail-area";
  topDiagramEl.append(topRail);

  slotOrder.forEach((slotId) => {
    sideDiagramEl.appendChild(createSideSlot(slotId));
    topDiagramEl.appendChild(createTopSlot(slotId));
  });
}

function renderAll() {
  renderLibrary();
  renderDiagrams();
}

btnPractice.addEventListener("click", () => setMode("practice"));
btnExam.addEventListener("click", () => setMode("exam"));
btnCheck.addEventListener("click", checkAnswer);
btnReset.addEventListener("click", () => {
  placements = createEmptyPlacements();
  selectedProbeId = null;
  libraryOrder = mode === "exam" ? shuffle(slotOrder) : [...slotOrder];
  clearScoreMarks();
  resetFeedback();
  renderAll();
  startTimer();
});
btnAnswer.addEventListener("click", showAnswer);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    selectedProbeId = null;
    renderLibrary();
    renderDiagrams();
  }
});

setMode("practice");
renderAll();