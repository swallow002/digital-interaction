const steps = [
  { id: "task", label: "任务接收", hint: "明确作业场景、学生身份和最终成果。" },
  { id: "structure", label: "构件识别", hint: "点击左侧整体模型，右侧查看单个部件模型与说明。" },
  { id: "diagnosis", label: "轨距调整", hint: "依据任务接收模块的精测数据，完成轨距调整判定。" },
  { id: "plan", label: "水平调整", hint: "依据同一组精测数据，完成水平调整判定。" },
  { id: "review", label: "成果交付", hint: "生成任务单、复测记录与考核评价结果。" },
];

const STANDARD_GAUGE = 1435;
const surveyPointMeta = [
  { point: "C01", mileage: "K128+332" },
  { point: "C02", mileage: "K128+334" },
  { point: "C03", mileage: "K128+336" },
  { point: "C04", mileage: "K128+338" },
  { point: "C05", mileage: "K128+340" },
];

let measureData = createSurveyData();

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function signedText(value, suffix = "mm") {
  if (value === 0) return `0${suffix}`;
  return `${value > 0 ? "+" : ""}${value}${suffix}`;
}

function gaugeDiff(row) {
  return row.gauge - STANDARD_GAUGE;
}

function formatGauge(row) {
  return `${row.gauge}（${signedText(gaugeDiff(row))}）`;
}

function targetPointIds() {
  return measureData.filter((row) => row.isTarget).map((row) => row.point);
}

function targetPointLabel() {
  return targetPointIds().join("、") || "异常测点";
}

function targetRows() {
  return measureData.filter((row) => row.isTarget);
}

function splitSignedDeviation(total) {
  const sign = total >= 0 ? 1 : -1;
  const amount = Math.abs(total);
  const leftAmount = randInt(0, amount);
  const rightAmount = amount - leftAmount;
  return [sign * leftAmount, sign * rightAmount];
}

function pickNonZero(values) {
  return values[randInt(0, values.length - 1)];
}

function createSurveyData() {
  const gaugePool = [-4, -3, -2, -1, 1, 2, 3, 4, 5];
  const levelPool = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5];

  return surveyPointMeta.map((meta) => {
    const gaugeDelta = pickNonZero(gaugePool);
    const [alignLeft, alignRight] = splitSignedDeviation(gaugeDelta);

    const level = pickNonZero(levelPool);
    const highLowLeft = Math.round(level / 2) + randInt(-1, 1);
    const highLowRight = highLowLeft - level;

    return {
      point: meta.point,
      mileage: meta.mileage,
      gauge: STANDARD_GAUGE + gaugeDelta,
      level,
      alignLeft,
      alignRight,
      highLowLeft,
      highLowRight,
      isTarget: true,
    };
  });
}

function regenerateSurveyData() {
  measureData = createSurveyData();
  state.selectedPoints.clear();
  state.selectedDeviations.clear();
  state.selectedPlans.clear();
  state.activeGaugePoint = measureData[0]?.point || "C01";
  state.activeLevelPoint = measureData[0]?.point || "C01";
  state.gaugeChoices = {};
  state.pendingGaugeChoices = {};
  state.gaugeConfirmedPoints = new Set();
  state.levelChoices = {};
}

const componentNotes = {
  sleeper: {
    title: "轨枕 / 轨道板承轨台",
    type: "基础承托件",
    spec: "本模型中用于承托 WJ-8C 扣件系统，不计入扣件 11 个部件。",
    position: "位于扣件系统最下方，预埋套管埋设在其内部。",
    function: "为扣件系统提供安装基础和承托面，承接并传递上部荷载。",
    tip: "识别时注意：最下方灰色基础不是预埋套管，预埋套管应位于轨枕或轨道板内部。",
    layer: "基础层",
    role: "承托",
    countable: false,
  },
  rail: {
    title: "钢轨",
    type: "配套对象",
    spec: "本课件中作为扣件扣压、定位和支承的对象显示。",
    position: "位于轨下垫板上方，由扣件系统从两侧进行扣压和限位。",
    function: "承受列车荷载并传递轮轨作用，是几何形位调整的直接对象。",
    tip: "钢轨不是 WJ-8C 扣件部件本身，但它的位置变化决定轨距、高低和水平调整方向。",
    layer: "对象层",
    role: "被调整对象",
    countable: false,
  },
  screw: {
    title: "螺旋道钉",
    type: "锁固件",
    spec: "S2 型、S3 型。正常安装或钢轨高低调整量不大于 15mm 时采用 S2 型，调整量大于 15mm 时采用 S3 型。",
    position: "套上平垫圈后穿过扣压部件，拧入预埋套管。",
    function: "提供扣压力，使弹条、轨距挡板等部件可靠连接并保持扣件系统稳定。",
    tip: "安装时应先用手拧入预埋套管，避免斜拧；现场复紧时需要使用可控扭矩工具。",
    layer: "锁固层",
    role: "紧固",
    countable: true,
  },
  washer: {
    title: "平垫圈",
    type: "传力件",
    spec: "与螺旋道钉配套使用。",
    position: "位于螺旋道钉头部下方，随螺旋道钉一起安装。",
    function: "分散螺旋道钉紧固压力，保护扣件受力面并改善紧固传力。",
    tip: "识别时可把它理解为螺旋道钉的配套传力部件，调整后与螺旋道钉一并检查。",
    layer: "锁固层",
    role: "传力",
    countable: true,
  },
  clip: {
    title: "弹条",
    type: "扣压件",
    spec: "W1 型，直径 14mm。",
    position: "后端放置在轨距挡板凹槽内，前端支撑在绝缘轨距块上。",
    function: "扣压钢轨并提供弹性夹持力，是保持钢轨稳定的重要扣压部件。",
    tip: "调整和复紧后，应检查弹条是否安装到位。",
    layer: "扣压层",
    role: "扣压",
    countable: true,
  },
  insulator: {
    title: "绝缘轨距块",
    type: "横向定位件",
    spec: "非接头处用Ⅰ型，钢轨接头处用Ⅱ型；常用 7、8、9、10、11 号，正常安装 9 号。",
    position: "位于钢轨两侧，安装时两边耳应卡住铁垫板挡肩。",
    function: "起绝缘、限位和轨距调整作用，与轨距挡板配合控制钢轨左右位置。",
    tip: "后续轨距偏大或偏小时，通常需要结合轨距挡板调换不同规格。",
    layer: "定位层",
    role: "横向调整",
    countable: true,
  },
  gaugePlate: {
    title: "轨距挡板",
    type: "横向定位件",
    spec: "分 4 号、7 号、10 号三种规格，正常情况安装 7 号。",
    position: "位于承轨槽两侧，圆弧凸台应安放在承轨槽底脚凹槽内。",
    function: "与绝缘轨距块配合控制钢轨左右位置，用于轨距和轨向调整。",
    tip: "安装时不得猛烈敲击；钢轨左右位置调整时可调换规格。",
    layer: "定位层",
    role: "横向调整",
    countable: true,
  },
  railPad: {
    title: "轨下垫板",
    type: "支承垫板",
    spec: "2mm、3mm、4mm、5mm、6mm 五种厚度，正常安装采用 6mm。",
    position: "位于钢轨与铁垫板之间，凸缘应扣住铁垫板。",
    function: "支承钢轨，改善受力和缓冲，同时参与钢轨高低位置调整。",
    tip: "根据钢轨高低调整需要，可选用不同厚度。",
    layer: "支承层",
    role: "支承 / 调高",
    countable: true,
  },
  basePlate: {
    title: "铁垫板",
    type: "承载件",
    spec: "WJ-8C 扣件主要承载构件。",
    position: "位于轨下垫板下方，安装时螺栓孔中心应与预埋套管中心对正。",
    function: "承接钢轨和扣压系统荷载，并为轨距挡板、弹条等部件提供安装基础。",
    tip: "识别时重点看它的承载和定位基础作用，一般不是小幅精调的首选更换件。",
    layer: "承载层",
    role: "承载",
    countable: true,
  },
  elasticPad: {
    title: "铁垫板下弹性垫板",
    type: "缓冲垫板",
    spec: "WJ8-B 型。",
    position: "位于铁垫板下方，铺设在承轨台中间位置，孔位需与预埋套管孔对中。",
    function: "改善铁垫板下部受力和振动传递，起弹性缓冲作用。",
    tip: "它属于支承缓冲部件，识别时注意与铁垫板下调高垫板区分。",
    layer: "缓冲层",
    role: "减振",
    countable: true,
  },
  sleeve: {
    title: "预埋套管",
    type: "锚固件",
    spec: "预埋于轨枕或轨道板中，顶面应低于承轨面 0～2mm。",
    position: "位于轨道板或轨枕内部，与螺旋道钉连接。",
    function: "为螺旋道钉提供可靠锚固基础。",
    tip: "需要卸下螺旋道钉时，应避免泥污进入预埋套管。",
    layer: "锚固层",
    role: "锚固",
    countable: true,
  },
  railShim: {
    title: "轨下微调垫板",
    type: "竖向调整件",
    spec: "1mm、2mm、5mm 三种规格。",
    position: "放置于轨下垫板与铁垫板之间。",
    function: "用于钢轨高低位置的精细调整。",
    tip: "本任务中的右股钢轨偏低，可通过轨下微调垫板进行小幅抬高调整。",
    layer: "调整层",
    role: "竖向调整",
    countable: true,
  },
  baseShim: {
    title: "铁垫板下调高垫板",
    type: "竖向调整件",
    spec: "10mm、20mm 两种规格，由两片组成，应成对使用。",
    position: "放置于铁垫板下弹性垫板与轨道板或轨枕承轨面之间。",
    function: "用于较大幅度的钢轨高低位置调整。",
    tip: "从承轨台侧面成副放入，不能简单当作普通薄垫片叠加使用。",
    layer: "调整层",
    role: "竖向调整",
    countable: true,
  },
};

const GAUGE_RULE_SMALL = {
  "-2": { outerPlate: 7, outerBlock: 11, innerBlock: 7, innerPlate: 7 },
  "-1": { outerPlate: 7, outerBlock: 10, innerBlock: 8, innerPlate: 7 },
  "0": { outerPlate: 7, outerBlock: 9, innerBlock: 9, innerPlate: 7 },
  "1": { outerPlate: 7, outerBlock: 8, innerBlock: 10, innerPlate: 7 },
  "2": { outerPlate: 7, outerBlock: 7, innerBlock: 11, innerPlate: 7 },
};

const DEFAULT_GAUGE_CHOICE = { outerPlate: 7, outerBlock: 9, innerBlock: 9, innerPlate: 7 };
const GAUGE_FIELD_LABELS = {
  outerPlate: "外侧轨距挡板",
  outerBlock: "外侧绝缘轨距块",
  innerBlock: "内侧绝缘轨距块",
  innerPlate: "内侧轨距挡板",
};

const GAUGE_RULE_LARGE = {
  "-5": { outerPlate: 10, outerBlock: 11, innerBlock: 7, innerPlate: 4 },
  "-4": { outerPlate: 10, outerBlock: 10, innerBlock: 8, innerPlate: 4 },
  "-3": { outerPlate: 10, outerBlock: 9, innerBlock: 9, innerPlate: 4 },
  "3": { outerPlate: 4, outerBlock: 9, innerBlock: 9, innerPlate: 10 },
  "4": { outerPlate: 4, outerBlock: 8, innerBlock: 10, innerPlate: 10 },
  "5": { outerPlate: 4, outerBlock: 7, innerBlock: 11, innerPlate: 10 },
};

function clampGaugeAdjust(delta) {
  return Math.max(-5, Math.min(5, delta));
}

function gaugeAdjustAmount(row) {
  return clampGaugeAdjust(gaugeDiff(row));
}

function getGaugeRule(delta) {
  const key = String(clampGaugeAdjust(delta));
  if (Math.abs(Number(key)) <= 2) return GAUGE_RULE_SMALL[key];
  return GAUGE_RULE_LARGE[key];
}

function getGaugeRuleType(delta) {
  return Math.abs(delta) <= 2 ? "±2mm以内：以绝缘轨距块调整为主" : "大于±2mm：轨距挡板与绝缘轨距块联动调整";
}

function getGaugeChoice(point, rail) {
  const pointChoice = state.gaugeChoices?.[point] || {};
  if (!rail) return pointChoice;
  return { ...DEFAULT_GAUGE_CHOICE, ...(pointChoice[rail] || {}) };
}

function getPendingGaugeChoice(point, rail) {
  const pointChoice = state.pendingGaugeChoices?.[point] || {};
  if (!rail) return pointChoice;
  return pointChoice[rail] || {};
}

function getDraftGaugeChoice(point, rail) {
  return { ...getGaugeChoice(point, rail), ...getPendingGaugeChoice(point, rail) };
}

function setGaugeChoice(point, rail, field, value) {
  if (!state.gaugeChoices) state.gaugeChoices = {};
  if (!state.gaugeChoices[point]) state.gaugeChoices[point] = {};
  if (!state.gaugeChoices[point][rail]) state.gaugeChoices[point][rail] = {};
  state.gaugeChoices[point][rail] = {
    ...state.gaugeChoices[point][rail],
    [field]: Number(value),
  };
}

function setPendingGaugeChoice(point, rail, field, value) {
  if (!state.pendingGaugeChoices) state.pendingGaugeChoices = {};
  if (!state.pendingGaugeChoices[point]) state.pendingGaugeChoices[point] = {};
  if (!state.pendingGaugeChoices[point][rail]) state.pendingGaugeChoices[point][rail] = {};
  state.pendingGaugeChoices[point][rail] = {
    ...state.pendingGaugeChoices[point][rail],
    [field]: Number(value),
  };
}

function commitGaugeChoice(point) {
  if (!state.gaugeChoices) state.gaugeChoices = {};
  state.gaugeChoices[point] = {
    left: { ...getDraftGaugeChoice(point, "left") },
    right: { ...getDraftGaugeChoice(point, "right") },
  };
  if (state.pendingGaugeChoices?.[point]) delete state.pendingGaugeChoices[point];
  if (!state.gaugeConfirmedPoints) state.gaugeConfirmedPoints = new Set();
  state.gaugeConfirmedPoints.add(point);
}

function isGaugePointConfirmed(point) {
  return Boolean(state.gaugeConfirmedPoints?.has(point));
}

function railAdjustPlan(row, rail) {
  // 以任务接收模块的“左轨向 / 右轨向”作为单股钢轨调整量来源。
  // 正值表示向内，负值表示向外；后续再按左右股方向换算到标准组合表。
  const signed = rail === "left" ? row.alignLeft : row.alignRight;
  const amount = Math.min(5, Math.abs(signed));
  const direction = amount === 0 ? "none" : signed > 0 ? "in" : "out";
  return { amount, direction };
}

function railAdjustSigned(row, rail) {
  const plan = railAdjustPlan(row, rail);
  if (!plan.amount) return 0;
  if (rail === "left") return plan.direction === "in" ? plan.amount : -plan.amount;
  return plan.direction === "in" ? -plan.amount : plan.amount;
}

function railAdjustLabel(row, rail) {
  const plan = railAdjustPlan(row, rail);
  if (!plan.amount) return "不调整";
  return `${rail === "left" ? "左股" : "右股"}${plan.direction === "in" ? "向内" : "向外"}${plan.amount}mm`;
}

function expectedGaugeChoice(row, rail) {
  return getGaugeRule(railAdjustSigned(row, rail));
}

function fillGaugeChoice(point, rail) {
  const row = measureData.find((item) => item.point === point) || measureData[0];
  if (rail) {
    state.gaugeChoices[point] = {
      ...(state.gaugeChoices[point] || {}),
      [rail]: { ...expectedGaugeChoice(row, rail) },
    };
    if (state.pendingGaugeChoices?.[point]?.[rail]) delete state.pendingGaugeChoices[point][rail];
    return;
  }
  state.gaugeChoices[point] = {
    left: { ...expectedGaugeChoice(row, "left") },
    right: { ...expectedGaugeChoice(row, "right") },
  };
  if (state.pendingGaugeChoices?.[point]) delete state.pendingGaugeChoices[point];
}

function ruleAmountFromChoice(choice) {
  if (!choice || !choice.outerPlate || !choice.outerBlock || !choice.innerBlock || !choice.innerPlate) return null;
  const allRules = { ...GAUGE_RULE_SMALL, ...GAUGE_RULE_LARGE };
  const entry = Object.entries(allRules).find(([, rule]) =>
    ["outerPlate", "outerBlock", "innerBlock", "innerPlate"].every((field) => Number(rule[field]) === Number(choice[field])),
  );
  return entry ? Number(entry[0]) : null;
}

function gaugeEffectFromRailChoice(point, rail) {
  const signed = ruleAmountFromChoice(getGaugeChoice(point, rail));
  if (signed === null) return 0;
  return rail === "left" ? -signed : signed;
}

function adjustedGauge(row) {
  return row.gauge + gaugeEffectFromRailChoice(row.point, "left") + gaugeEffectFromRailChoice(row.point, "right");
}

function railChoiceRawAlignAdjustment(point, rail) {
  const signed = ruleAmountFromChoice(getGaugeChoice(point, rail));
  if (signed === null) return 0;
  // 与任务接收模块中的轨向符号保持一致：正值表示向内，负值表示向外。
  // 右股扣件为镜像关系，因此标准表中的单股调整量需要反向换算。
  return rail === "left" ? signed : -signed;
}

function displayGauge(row) {
  return isGaugePointConfirmed(row.point) ? adjustedGauge(row) : row.gauge;
}

function displayGaugeDiff(row) {
  return displayGauge(row) - STANDARD_GAUGE;
}

function displayRailAlign(row, rail) {
  const original = rail === "left" ? row.alignLeft : row.alignRight;
  if (!isGaugePointConfirmed(row.point)) return original;
  return original - railChoiceRawAlignAdjustment(row.point, rail);
}

function isRailGaugeChoiceCorrect(point, rail) {
  const row = measureData.find((item) => item.point === point);
  if (!row) return false;
  const expected = expectedGaugeChoice(row, rail);
  const choice = getGaugeChoice(point, rail);
  return ["outerPlate", "outerBlock", "innerBlock", "innerPlate"].every((field) => Number(choice[field]) === Number(expected[field]));
}

function isGaugeChoiceCorrect(point) {
  return isRailGaugeChoiceCorrect(point, "left") && isRailGaugeChoiceCorrect(point, "right");
}

function gaugePassed() {
  return measureData.every((row) => isGaugePointConfirmed(row.point));
}

function getLevelChoice(point) {
  const raw = state.levelChoices?.[point] || {};
  const left = raw.left || {};
  const right = raw.right || {};
  return {
    left: {
      railPad: left.railPad === undefined || left.railPad === "" ? 6 : Number(left.railPad),
      railShim: left.railShim === undefined || left.railShim === "" ? 0 : Number(left.railShim),
      heightShim: left.heightShim === undefined || left.heightShim === "" ? 0 : Number(left.heightShim),
    },
    right: {
      railPad: right.railPad === undefined || right.railPad === "" ? 6 : Number(right.railPad),
      railShim: right.railShim === undefined || right.railShim === "" ? 0 : Number(right.railShim),
      heightShim: right.heightShim === undefined || right.heightShim === "" ? 0 : Number(right.heightShim),
    },
    side: raw.side || "",
    amount: raw.amount === undefined || raw.amount === "" ? 0 : Number(raw.amount),
    resultLevel: raw.resultLevel === undefined || raw.resultLevel === "" ? null : Number(raw.resultLevel),
    confirmed: Boolean(raw.confirmed),
  };
}

function levelPadConfig(amount) {
  const value = Math.round(Number(amount) || 0);
  if (value < -4 || value > 26) return null;
  if (value <= 0) {
    return { railPad: 6 + value, railShim: 0, heightShim: 0 };
  }
  if (value <= 6) {
    return { railPad: 6, railShim: value, heightShim: 0 };
  }
  if (value <= 10) {
    return { railPad: value - 4, railShim: 0, heightShim: 10 };
  }
  if (value <= 16) {
    return { railPad: 6, railShim: value - 10, heightShim: 10 };
  }
  if (value <= 20) {
    return { railPad: value - 14, railShim: 0, heightShim: 20 };
  }
  return { railPad: 6, railShim: value - 20, heightShim: 20 };
}

function expectedLevelChoice(row) {
  const amount = Math.abs(row.level);
  return {
    side: row.level > 0 ? "right" : "left",
    amount,
    ...(levelPadConfig(amount) || { railPad: 6, railShim: 0, heightShim: 0 }),
  };
}

function levelAdjustmentFromSideChoice(sideChoice) {
  const railPad = Number(sideChoice?.railPad ?? 6);
  const railShim = Number(sideChoice?.railShim ?? 0);
  const heightShim = Number(sideChoice?.heightShim ?? 0);
  return railPad + railShim + heightShim - 6;
}

function levelAmountFromChoice(sideChoice) {
  return levelAdjustmentFromSideChoice(sideChoice);
}

function isValidLevelPadConfig(sideChoice) {
  const adjustment = levelAdjustmentFromSideChoice(sideChoice);
  const expected = levelPadConfig(adjustment);
  if (!expected) return false;
  return Number(sideChoice?.railPad ?? 6) === expected.railPad
    && Number(sideChoice?.railShim ?? 0) === expected.railShim
    && Number(sideChoice?.heightShim ?? 0) === expected.heightShim;
}

function levelConfigLabel(sideChoice) {
  return `${Number(sideChoice?.railPad ?? 6)}/${Number(sideChoice?.railShim ?? 0)}/${Number(sideChoice?.heightShim ?? 0)}`;
}

function levelResultAfterChoice(row, choice) {
  const leftAdjustment = levelAdjustmentFromSideChoice(choice.left);
  const rightAdjustment = levelAdjustmentFromSideChoice(choice.right);
  return row.level + leftAdjustment - rightAdjustment;
}

function adjustedHighLowValues(row, choice) {
  const leftAdjustment = levelAdjustmentFromSideChoice(choice.left);
  const rightAdjustment = levelAdjustmentFromSideChoice(choice.right);
  return {
    leftAdjustment,
    rightAdjustment,
    highLowLeft: row.highLowLeft + leftAdjustment,
    highLowRight: row.highLowRight + rightAdjustment,
    level: row.level + leftAdjustment - rightAdjustment,
  };
}

function isLevelChoiceValid(point) {
  const choice = getLevelChoice(point);
  return choice.confirmed && isValidLevelPadConfig(choice.left) && isValidLevelPadConfig(choice.right);
}

function setLevelChoice(point, field, value, side = null) {
  if (!state.levelChoices) state.levelChoices = {};
  const current = getLevelChoice(point);
  const next = {
    ...current,
    left: { ...current.left },
    right: { ...current.right },
  };
  if (side && ["railPad", "railShim", "heightShim"].includes(field)) {
    next[side][field] = Number(value);
    next.confirmed = false;
  } else {
    next[field] = ["amount", "resultLevel"].includes(field) ? Number(value) : value;
  }
  state.levelChoices[point] = next;
}

function fillLevelChoice(point) {
  const row = measureData.find((item) => item.point === point) || measureData[0];
  const expected = expectedLevelChoice(row);
  state.levelChoices[point] = {
    left: { railPad: 6, railShim: 0, heightShim: 0 },
    right: { railPad: 6, railShim: 0, heightShim: 0 },
    side: expected.side,
    amount: expected.amount,
    resultLevel: 0,
    confirmed: true,
    [expected.side]: { railPad: expected.railPad, railShim: expected.railShim, heightShim: expected.heightShim },
  };
}

function confirmLevelChoice(point) {
  const row = measureData.find((item) => item.point === point);
  if (!row) return;
  const current = getLevelChoice(point);
  const adjusted = adjustedHighLowValues(row, current);
  const side = Math.abs(adjusted.leftAdjustment) >= Math.abs(adjusted.rightAdjustment) ? "left" : "right";
  state.levelChoices[point] = {
    ...current,
    side,
    amount: side === "left" ? adjusted.leftAdjustment : adjusted.rightAdjustment,
    leftAdjustment: adjusted.leftAdjustment,
    rightAdjustment: adjusted.rightAdjustment,
    resultLevel: adjusted.level,
    confirmed: true,
  };
}

function isLevelChoiceCorrect(point) {
  const row = measureData.find((item) => item.point === point);
  if (!row) return false;
  const choice = getLevelChoice(point);
  return choice.confirmed
    && isValidLevelPadConfig(choice.left)
    && isValidLevelPadConfig(choice.right)
    && Number(choice.resultLevel) === 0;
}

function levelPassed() {
  return measureData.every((row) => isLevelChoiceCorrect(row.point));
}

function activeGaugeRow() {
  return measureData.find((row) => row.point === state.activeGaugePoint) || measureData[0];
}

function activeLevelRow() {
  return measureData.find((row) => row.point === state.activeLevelPoint) || measureData[0];
}

function gaugeLeadRow() {
  return measureData.reduce((maxRow, row) => (Math.abs(gaugeDiff(row)) > Math.abs(gaugeDiff(maxRow)) ? row : maxRow), measureData[0]);
}

function levelLeadRow() {
  return measureData.reduce((maxRow, row) => (Math.abs(row.level) > Math.abs(maxRow.level) ? row : maxRow), measureData[0]);
}

function getRenderedLevelRow(row) {
  const choice = getLevelChoice(row.point);
  if (!choice.confirmed) return { ...row };
  const adjusted = adjustedHighLowValues(row, choice);
  return {
    ...row,
    level: adjusted.level,
    highLowLeft: adjusted.highLowLeft,
    highLowRight: adjusted.highLowRight,
  };
}

function renderedLevelData() {
  return measureData.map((row) => getRenderedLevelRow(row));
}



const state = {
  step: 0,
  taskAccepted: false,
  componentsSeen: new Set(),
  activeComponent: "",
  exploded: false,
  selectedPoints: new Set(),
  selectedDeviations: new Set(),
  selectedPlans: new Set(),
  activeGaugePoint: measureData[0]?.point || "C01",
  activeLevelPoint: measureData[0]?.point || "C01",
  gaugeChoices: {},
  pendingGaugeChoices: {},
  gaugeConfirmedPoints: new Set(),
  levelChoices: {},
};

const stepperEl = document.querySelector("#stepper");
const contentEl = document.querySelector("#stepContent");
const prevBtn = document.querySelector("#prevBtn");
const nextBtn = document.querySelector("#nextBtn");
const actionHint = document.querySelector("#actionHint");
const statusScore = document.querySelector("#status-score");
const statusStage = document.querySelector("#status-stage");
const sceneTitle = document.querySelector("#scene-title");
const sceneBadge = document.querySelector("#scene-badge");
const sceneNote = document.querySelector("#sceneNote");
const componentLayer = document.querySelector("#componentLayer");
const scenePanel = document.querySelector(".scene-panel");
const workspaceEl = document.querySelector(".workspace");
const modelSlot = document.querySelector("#modelSlot");

function countableComponentIds() {
  return Object.entries(componentNotes)
    .filter(([, item]) => item.countable)
    .map(([id]) => id);
}

function seenCountableComponentCount() {
  const validIds = new Set(countableComponentIds());
  return [...state.componentsSeen].filter((id) => validIds.has(id)).length;
}

function score() {
  let value = 0;
  value += Math.min(seenCountableComponentCount(), 4) * 5;

  const targets = targetPointIds();
  const pointScore = targets.filter((point) => state.selectedPoints.has(point)).length * 10;
  const wrongPoints = [...state.selectedPoints].filter((point) => !targets.includes(point)).length;
  value += Math.max(0, pointScore - wrongPoints * 5);

  const gaugeCorrect = measureData.filter((row) => isGaugePointConfirmed(row.point) && isGaugeChoiceCorrect(row.point)).length;
  value += gaugeCorrect * 5;

  const levelCorrect = measureData.filter((row) => isLevelChoiceCorrect(row.point)).length;
  value += levelCorrect * 5;

  return Math.min(100, value);
}

function isStepDone(index) {
  if (index === 0) return state.taskAccepted;
  if (index === 1) return seenCountableComponentCount() >= 6;
  if (index === 2) return diagnosisPassed();
  if (index === 3) return planPassed();
  if (index === 4) return score() >= 80;
  return false;
}

function diagnosisPassed() {
  return gaugePassed();
}

function planPassed() {
  return levelPassed();
}

function render() {
  renderStepper();
  renderStep();
  renderScene();
  renderFooter();
  renderTaskBriefModal();
  statusScore.textContent = `得分 ${score()}`;
  statusStage.textContent = steps[state.step].label;
  syncViewers();
}


function taskBriefHtml(isModal = false) {
  if (!isModal) {
    return `
      <div class="task-brief-strip" aria-label="模块1项目任务书摘要">
        <div class="task-brief-strip-main">
          <span class="task-brief-strip-badge">项目任务书</span>
          <div class="task-brief-strip-text">
            <strong>沪宁城际铁路桥上无砟轨道几何形位精调任务</strong>
            <em>角色：工务段精调作业小组成员｜任务：读取精测数据，完成偏差判读与调整方案选择</em>
          </div>
        </div>
        <div class="task-brief-strip-actions">
          <span class="task-brief-strip-code">WJ8C-K128-01</span>
          <button class="ghost compact-btn task-brief-reopen" type="button" data-action="reopen-task-brief">查看任务书</button>
        </div>
      </div>
    `;
  }
  const modeClass = "task-brief-modal-card";
  return `
    <div class="task-brief-card ${modeClass}">
      <div class="task-brief-topline">
        <span>项目任务书</span>
        <em>Project Task</em>
      </div>
      <div class="task-brief-head">
        <div>
          <p class="task-brief-eyebrow">虚拟项目</p>
          <h3>沪宁城际铁路桥上无砟轨道几何形位精调任务</h3>
        </div>
        <div class="task-brief-code">
          <span>任务编号</span>
          <strong>WJ8C-K128-01</strong>
        </div>
      </div>
      <div class="task-brief-grid">
        <div class="task-brief-tile role">
          <span>你的角色</span>
          <strong>工务段精调作业小组成员</strong>
          <p>以现场作业人员身份接收精测数据，完成扣件识别、偏差判读、调整方案选择和成果交付。</p>
        </div>
        <div class="task-brief-tile">
          <span>作业场景</span>
          <strong>K128+332—K128+340 桥上无砟轨道</strong>
          <p>线路精测小车完成复测后，发现该区段轨距、轨向、高低与水平存在不同程度偏差，需要进行扣件精调。</p>
        </div>
      </div>
      <div class="task-brief-goals">
        <div>
          <b>任务目标</b>
          <p>根据精测数据判断偏差类型，选择 WJ-8C 扣件调整构件，完成轨距调整、水平调整和复测记录交付。</p>
        </div>
        <ul>
          <li><span>01</span>读取 C01—C05 精测数据，识别异常偏差。</li>
          <li><span>02</span>认识 WJ-8C 扣件组成及各构件作用。</li>
          <li><span>03</span>完成轨距、轨向、高低、水平调整判定。</li>
          <li><span>04</span>形成调整记录、复测结果和考核得分。</li>
        </ul>
      </div>
      <div class="task-brief-actions">
        <button class="primary task-brief-accept" type="button" data-action="accept-task">领取任务</button>
        <span>领取后进入精测数据分析页面</span>
      </div>
    </div>
  `;
}

function renderTaskBriefModal() {
  const existing = document.querySelector("#taskBriefModal");
  if (state.step !== 0 || state.taskAccepted) {
    existing?.remove();
    return;
  }
  if (existing) return;
  const modal = document.createElement("div");
  modal.id = "taskBriefModal";
  modal.className = "task-brief-mask";
  modal.innerHTML = `
    <section class="task-brief-dialog" role="dialog" aria-modal="true" aria-label="模块1任务领取">
      ${taskBriefHtml(true)}
    </section>
  `;
  document.body.appendChild(modal);
}

function openTaskBriefModal() {
  const existing = document.querySelector("#taskBriefModal");
  existing?.remove();
  const modal = document.createElement("div");
  modal.id = "taskBriefModal";
  modal.className = "task-brief-mask";
  modal.innerHTML = `
    <section class="task-brief-dialog" role="dialog" aria-modal="true" aria-label="模块1任务书">
      ${taskBriefHtml(true).replace('data-action="accept-task"', 'data-action="close-task-brief"').replace('领取任务', '返回任务页面').replace('领取后进入精测数据分析页面', '已领取任务，可继续查看精测数据')}
    </section>
  `;
  document.body.appendChild(modal);
}

function renderStepper() {
  stepperEl.innerHTML = steps
    .map((step, index) => {
      const classes = ["step-btn"];
      if (index === state.step) classes.push("active");
      else if (isStepDone(index)) classes.push("done");
      return `<button class="${classes.join(" ")}" type="button" data-step="${index}">
        <span class="step-label">${step.label}</span>
      </button>`;
    })
    .join("");
}

function renderScene() {
  const activeStep = steps[state.step];
  const isStructure = activeStep.id === "structure";
  const isGaugeAdjustment = activeStep.id === "diagnosis";
  const isLevelAdjustment = activeStep.id === "plan";
  const isReview = activeStep.id === "review";
  const isFastenerAdjustment = isGaugeAdjustment || isLevelAdjustment;
  workspaceEl?.classList.toggle("task-step-active", activeStep.id === "task");
  workspaceEl?.classList.toggle("structure-step-active", isStructure);
  workspaceEl?.classList.toggle("gauge-step-active", isFastenerAdjustment);
  workspaceEl?.classList.toggle("review-step-active", isReview);
  scenePanel?.classList.toggle("gauge-step-active", isFastenerAdjustment);
  scenePanel?.classList.toggle("review-step-active", isReview);
  sceneTitle.textContent = isReview
    ? "成果交付看板"
    : isStructure
    ? "WJ-8C 扣件整体模型"
    : isFastenerAdjustment
      ? "扣件三维模型"
      : "桥上无砟轨道区段";
  sceneBadge.textContent = isStructure
    ? "WJ-8C"
    : isGaugeAdjustment
      ? "轨距 / 轨向"
      : isLevelAdjustment
        ? "高低 / 水平"
        : activeStep.id === "review"
          ? "复测"
          : "三维模型";

  document.querySelectorAll(".measure-point").forEach((btn) => {
    const point = btn.dataset.point;
    btn.classList.toggle("active", state.step === 2 || state.step === 3);
    btn.classList.toggle("warning", targetPointIds().includes(point) && state.step >= 2);
    btn.classList.toggle("selected", state.selectedPoints.has(point));
  });

  const notes = {
    task: "请结合精测数据和二维示意图判断各测点偏差。",
    structure: "点击整体模型中的任一可见部件，右侧将显示该部件三维模型及规格、位置、作用说明。",
    diagnosis: "选择测点后，扣件三维模型同步显示轨距、左轨向和右轨向偏差。",
    plan: "左侧沿用轨距调整模块的同一套扣件三维模型，仅高亮影响高低调整的垫板类构件。",
    review: "交付页集中呈现任务单、复测记录、扣件配置清单与考核评价结果。",
  };
  sceneNote.textContent = notes[activeStep.id];
  renderModelToolbar();
  renderTaskSceneOverlay(activeStep.id === "task");
  renderGaugeSceneOverlay(isFastenerAdjustment, isLevelAdjustment ? "level" : "gauge");
}


function renderTaskSceneOverlay(visible) {
  if (!modelSlot) return;
  let overlay = document.querySelector("#taskSceneOverlay");
  const pointsOverlay = document.querySelector("#taskMeasureOverlay");
  pointsOverlay?.remove();
  if (!visible) {
    overlay?.remove();
    return;
  }
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "taskSceneOverlay";
    overlay.className = "task-scene-overlay";
    modelSlot.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div><strong>作业区段</strong><span>K128+332—K128+340</span></div>
    <div><strong>作业对象</strong><span>桥上无砟轨道 · WJ-8 扣件 · 钢轨</span></div>
  `;
}


function renderGaugeSceneOverlay(visible, mode = "gauge") {
  if (!modelSlot) return;
  const isLevelMode = mode === "level";
  let overlay = document.querySelector("#gaugeSceneOverlay");
  modelSlot.classList.toggle("gauge-scene-mode", visible);
  modelSlot.classList.toggle("level-scene-mode", visible && isLevelMode);
  if (!visible) {
    overlay?.remove();
    return;
  }

  const row = isLevelMode ? activeLevelRow() : activeGaugeRow();
  const pointTabs = measureData
    .map((item) => {
      const isActive = isLevelMode ? item.point === state.activeLevelPoint : item.point === state.activeGaugePoint;
      const isDone = isLevelMode ? isLevelChoiceCorrect(item.point) : isGaugePointConfirmed(item.point);
      const attr = isLevelMode ? `data-level-point="${item.point}"` : `data-gauge-point="${item.point}"`;
      return `<button class="fastener-point-chip ${isActive ? "active" : ""} ${isDone ? "done" : ""}" type="button" ${attr}>${item.point}</button>`;
    })
    .join("");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "gaugeSceneOverlay";
    modelSlot.appendChild(overlay);
  }
  overlay.className = `gauge-scene-overlay ${isLevelMode ? "level-scene-overlay" : ""}`;

  const gaugeDelta = isLevelMode ? 0 : displayGaugeDiff(row);
  const shownGauge = isLevelMode ? 0 : displayGauge(row);
  const leftAlignText = isLevelMode ? "" : signedText(displayRailAlign(row, "left"));
  const rightAlignText = isLevelMode ? "" : signedText(displayRailAlign(row, "right"));
  const leftDone = isLevelMode ? false : isGaugePointConfirmed(row.point);
  const rightDone = isLevelMode ? false : isGaugePointConfirmed(row.point);

  overlay.innerHTML = `
    <div class="gauge-scene-stack gauge-fastener-only real-model-stack ${isLevelMode ? "level-fastener-only" : ""}">
      <section class="gauge-scene-layer fastener-layer" aria-label="扣件三维模型">
        <div class="gauge-scene-layer-head">
          <div class="gauge-scene-title-group">
            <strong>扣件三维模型</strong>
            <span>${isLevelMode ? "高亮：影响高低的垫板类构件" : "高亮：轨距调整构件"}</span>
          </div>
          ${isLevelMode ? `<button class="gauge-strategy-open level-strategy-open" type="button" data-action="open-level-strategy">水平调整策略</button>` : `<button class="gauge-strategy-open" type="button" data-action="open-gauge-strategy">轨距调整策略</button>`}
        </div>
        <div class="fastener-dual-stage actual-model-card core-fastener-stage ${isLevelMode ? "level-fastener-stage" : ""}">
          <span class="front-label front-label-left">左股钢轨扣件</span>
          <span class="front-label front-label-right">右股钢轨扣件</span>
          <canvas
            class="aux-model-canvas fastener-dual-canvas"
            data-preset="wj8c"
            data-dual="true"
            data-locked="true"
            data-zoomable="false"
            data-ortho="true"
            data-gauge-focus="${isLevelMode ? "false" : "true"}"
            data-level-focus="${isLevelMode ? "true" : "false"}"
            data-yaw="-1.5708"
            data-pitch="0.015"
            data-zoom="${isLevelMode ? "1.92" : "2.18"}"
            aria-label="左右股钢轨扣件三维正视模型"
          ></canvas>
          <div class="fastener-measure-layer ${isLevelMode ? "level-measure-layer" : ""}" aria-label="当前测点调整示意">
            <div class="fastener-point-tabs" aria-label="测点选择">
              ${pointTabs}
            </div>
            ${isLevelMode ? renderLevelSceneCards(row) : `
              <div class="fastener-gauge-dimension">
                <strong>轨距 ${shownGauge} mm</strong>
                <i class="dimension-line"></i>
                <span>${signedText(gaugeDelta)}</span>
              </div>
              <div class="fastener-align-card align-left ${leftDone ? "done" : ""}">
                <em>左轨向</em>
                <strong>${leftAlignText}</strong>
              </div>
              <div class="fastener-align-card align-right ${rightDone ? "done" : ""}">
                <em>右轨向</em>
                <strong>${rightAlignText}</strong>
              </div>
              ${renderGaugeComponentLinks()}
              ${renderCurrentGaugeChoicePanel(row)}
            `}
          </div>
          <div class="aux-model-status">正在加载扣件模型...</div>
        </div>
      </section>
    </div>
  `;
}


function renderGaugeStrategyModal() {
  const withinRows = [
    [-2, 7, 11, 7, 7],
    [-1, 7, 10, 8, 7],
    [0, 7, 9, 9, 7],
    [1, 7, 8, 10, 7],
    [2, 7, 7, 11, 7],
  ];
  const overRows = [
    [-5, 10, 11, 7, 4],
    [-4, 10, 10, 8, 4],
    [-3, 10, 9, 9, 4],
    [3, 4, 9, 9, 10],
    [4, 4, 8, 10, 10],
    [5, 4, 7, 11, 10],
  ];

  const formatDelta = (value) => (value > 0 ? `+${value}` : `${value}`);
  const renderRows = (rows) => rows.map(([delta, outerPlate, outerBlock, innerBlock, innerPlate]) => `
    <tr>
      <td>${formatDelta(delta)}</td>
      <td>${outerPlate}</td>
      <td>${outerBlock}</td>
      <td>${innerBlock}</td>
      <td>${innerPlate}</td>
    </tr>
  `).join("");

  return `
    <div class="strategy-modal-mask" data-action="close-gauge-strategy" role="presentation">
      <section class="strategy-modal" role="dialog" aria-modal="true" aria-label="单股钢轨轨距调整策略" onclick="event.stopPropagation()">
        <div class="strategy-modal-head">
          <div>
            <strong>轨距调整策略</strong>
            <span>根据单股钢轨调整量，选择对应的轨距挡板与绝缘轨距块规格</span>
          </div>
          <button type="button" class="strategy-modal-close" data-action="close-gauge-strategy" aria-label="关闭" onclick="event.stopPropagation(); closeGaugeStrategyModal()">×</button>
        </div>
        <div class="strategy-note-grid">
          <div class="strategy-note-card">
            <b>使用方法</b>
            <p>先判断左股或右股需要向内、向外调整多少毫米，再按表选择外侧和内侧部件型号。</p>
          </div>
          <div class="strategy-note-card">
            <b>判定原则</b>
            <p>±2mm以内以绝缘轨距块调整为主；大于±2mm时，轨距挡板与绝缘轨距块联动调整。</p>
          </div>
        </div>
        <div class="strategy-table-wrap">
          <div class="strategy-table-card">
            <h4>调整量 ±2mm 以内</h4>
            <table class="strategy-table">
              <thead>
                <tr>
                  <th rowspan="2">单股调整量<br><em>mm</em></th>
                  <th colspan="2">钢轨外侧</th>
                  <th colspan="2">钢轨内侧</th>
                </tr>
                <tr>
                  <th>轨距挡板</th><th>绝缘轨距块</th><th>绝缘轨距块</th><th>轨距挡板</th>
                </tr>
              </thead>
              <tbody>${renderRows(withinRows)}</tbody>
            </table>
          </div>
          <div class="strategy-table-card">
            <h4>调整量大于 ±2mm</h4>
            <table class="strategy-table">
              <thead>
                <tr>
                  <th rowspan="2">单股调整量<br><em>mm</em></th>
                  <th colspan="2">钢轨外侧</th>
                  <th colspan="2">钢轨内侧</th>
                </tr>
                <tr>
                  <th>轨距挡板</th><th>绝缘轨距块</th><th>绝缘轨距块</th><th>轨距挡板</th>
                </tr>
              </thead>
              <tbody>${renderRows(overRows)}</tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  `;
}

function openGaugeStrategyModal() {
  document.querySelector(".strategy-modal-mask")?.remove();
  document.body.insertAdjacentHTML("beforeend", renderGaugeStrategyModal());
}

function closeGaugeStrategyModal() {
  document.querySelector(".strategy-modal-mask")?.remove();
}

function renderLevelStrategyModal() {
  const lowerRows = [
    [-4, 2, 0, 0],
    [-3, 3, 0, 0],
    [-2, 4, 0, 0],
    [-1, 5, 0, 0],
    [0, 6, 0, 0],
  ];
  const raiseRows = [
    [0, 6, 0, 0],
    ["+1～+6", 6, "1～6", 0],
    ["+7", 3, 0, 10],
    ["+8", 4, 0, 10],
    ["+9", 5, 0, 10],
    ["+10", 6, 0, 10],
    ["+11～+16", 6, "1～6", 10],
    ["+17", 3, 0, 20],
    ["+18", 4, 0, 20],
    ["+19", 5, 0, 20],
    ["+20", 6, 0, 20],
    ["+21～+26", 6, "1～6", 20],
  ];

  const formatLevelDelta = (value) => {
    if (typeof value === "number") return value > 0 ? `+${value}` : `${value}`;
    return value;
  };
  const renderLevelRows = (rows) => rows.map(([delta, railPad, railShim, heightShim]) => `
    <tr>
      <td>${formatLevelDelta(delta)}</td>
      <td>${railPad}</td>
      <td>${railShim}</td>
      <td>${heightShim}</td>
    </tr>
  `).join("");

  return `
    <div class="strategy-modal-mask" data-action="close-level-strategy" role="presentation">
      <section class="strategy-modal level-strategy-modal" role="dialog" aria-modal="true" aria-label="钢轨高低与水平调整策略" onclick="event.stopPropagation()">
        <div class="strategy-modal-head">
          <div>
            <strong>水平调整策略</strong>
            <span>根据左右股高低差，选择较低股的调高垫板组合</span>
          </div>
          <button type="button" class="strategy-modal-close" data-action="close-level-strategy" aria-label="关闭" onclick="event.stopPropagation(); closeLevelStrategyModal()">×</button>
        </div>
        <div class="strategy-note-grid level-note-grid">
          <div class="strategy-note-card">
            <b>使用方法</b>
            <p>先判断左股或右股哪一侧偏低，再按需抬升的毫米数，选择轨下垫板、轨下微调垫板和铁垫板下调高垫板。</p>
          </div>
          <div class="strategy-note-card">
            <b>配置原则</b>
            <p>负调整主要通过更换较薄轨下垫板实现；正调整通过轨下微调垫板与铁垫板下调高垫板组合实现。</p>
          </div>
          <div class="strategy-note-card">
            <b>使用限制</b>
            <p>轨下微调垫板总厚度不大于6mm，总数不超过2块；铁垫板下调高垫板成对使用，不能摞叠。</p>
          </div>
        </div>
        <div class="strategy-table-wrap level-strategy-table-wrap">
          <div class="strategy-table-card">
            <h4>-4mm～0mm 调整</h4>
            <table class="strategy-table level-strategy-table">
              <thead>
                <tr>
                  <th>钢轨高低位置调整量<br><em>mm</em></th>
                  <th>WJ8C 轨下垫板厚度<br><em>mm</em></th>
                  <th>WJ8C 轨下微调垫板总厚度<br><em>mm</em></th>
                  <th>WJ8C 铁垫板下调高垫板厚度<br><em>mm</em></th>
                </tr>
              </thead>
              <tbody>${renderLevelRows(lowerRows)}</tbody>
            </table>
          </div>
          <div class="strategy-table-card">
            <h4>0mm～+26mm 调整</h4>
            <table class="strategy-table level-strategy-table">
              <thead>
                <tr>
                  <th>钢轨高低位置调整量<br><em>mm</em></th>
                  <th>WJ8C 轨下垫板厚度<br><em>mm</em></th>
                  <th>WJ8C 轨下微调垫板总厚度<br><em>mm</em></th>
                  <th>WJ8C 铁垫板下调高垫板厚度<br><em>mm</em></th>
                </tr>
              </thead>
              <tbody>${renderLevelRows(raiseRows)}</tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  `;
}

function openLevelStrategyModal() {
  document.querySelector(".strategy-modal-mask")?.remove();
  document.body.insertAdjacentHTML("beforeend", renderLevelStrategyModal());
}

function closeLevelStrategyModal() {
  document.querySelector(".strategy-modal-mask")?.remove();
}

function renderLevelComponentSelect(point, side, field, label, values, unit = "mm", disabled = false) {
  const choice = getLevelChoice(point);
  return `
    <label class="level-config-row ${disabled ? "disabled" : ""}">
      <span>${label}</span>
      <select class="level-config-select" data-level-point="${point}" data-level-side="${side}" data-level-field="${field}" ${disabled ? "disabled" : ""}>
        ${values.map((value) => `<option value="${value}" ${Number(choice[side][field]) === Number(value) ? "selected" : ""}>${value}${unit}</option>`).join("")}
      </select>
    </label>
  `;
}

function renderLevelSidePanel(row, side) {
  return `
    <div class="level-side-panel ${side}">
      <div class="level-side-head">
        <strong>${side === "left" ? "左股调整" : "右股调整"}</strong>
      </div>
      <div class="level-config-grid compact">
        ${renderLevelComponentSelect(row.point, side, "railPad", "轨下垫板", [2, 3, 4, 5, 6], "mm", false)}
        ${renderLevelComponentSelect(row.point, side, "railShim", "轨下微调垫板", [0, 1, 2, 3, 4, 5, 6], "mm", false)}
        ${renderLevelComponentSelect(row.point, side, "heightShim", "调高垫板", [0, 10, 20], "mm", false)}
      </div>
    </div>
  `;
}

function renderLevelControlPanel(row) {
  const choice = getLevelChoice(row.point);
  return `
    <div class="level-control-wrap ${choice.confirmed ? "confirmed" : ""}">
      ${renderLevelSidePanel(row, "left")}
      <div class="level-confirm-row">
        <button class="primary compact-btn" type="button" data-action="confirm-level-current">确认</button>
      </div>
      ${renderLevelSidePanel(row, "right")}
    </div>
  `;
}

function renderLevelSceneCards(row) {
  const isDone = isLevelChoiceCorrect(row.point);
  const displayRow = getRenderedLevelRow(row);
  return `
    <div class="fastener-level-summary ${isDone ? "done" : ""}">
      <strong>当前水平 ${signedText(displayRow.level)}</strong>
      <span>根据左右股高低数据，选择下方 3 个调整构件并确认</span>
    </div>
    <div class="fastener-level-card level-left">
      <em>左高低</em>
      <strong>${signedText(displayRow.highLowLeft)}</strong>
    </div>
    <div class="fastener-level-card level-right">
      <em>右高低</em>
      <strong>${signedText(displayRow.highLowRight)}</strong>
    </div>
    ${renderLevelControlPanel(row)}
  `;
}

function renderFastenerActualCanvas(label, side) {
  return `
    <div class="fastener-front-card actual-model-card ${side}">
      <span class="front-label">${label}</span>
      <canvas
        class="aux-model-canvas fastener-actual-canvas"
        data-preset="wj8c"
        data-locked="true"
        data-ortho="true"
        data-yaw="-1.5708"
        data-pitch="0.08"
        data-zoom="1.55"
        aria-label="${label}三维正视模型"
      ></canvas>
      <div class="aux-model-status">正在加载扣件模型...</div>
    </div>
  `;
}

function renderFastenerFrontModel(label) {
  return `
    <div class="fastener-front-card">
      <span class="front-label">${label}</span>
      <div class="fastener-front-model" aria-hidden="true">
        <div class="front-slab"></div>
        <div class="front-elastic-pad"></div>
        <div class="front-base-plate"></div>
        <div class="front-rail-pad"></div>
        <div class="front-rail-section"><i></i></div>
        <div class="front-gauge-block outer">绝缘轨距块</div>
        <div class="front-gauge-block inner">绝缘轨距块</div>
        <div class="front-gauge-plate outer">轨距挡板</div>
        <div class="front-gauge-plate inner">轨距挡板</div>
        <div class="front-clip left"></div>
        <div class="front-clip right"></div>
        <div class="front-screw left"></div>
        <div class="front-screw right"></div>
        <div class="front-arrow left">↔</div>
        <div class="front-arrow right">↔</div>
      </div>
    </div>
  `;
}

function renderSlabMiniModel() {
  const sleepers = Array.from({ length: 8 }, (_, i) => i + 1)
    .map((i) => `<span class="slab-fastener f${i}"></span>`)
    .join("");
  return `
    <div class="slab-mini-model" aria-hidden="true">
      <div class="slab-mini-base"></div>
      <div class="slab-mini-deck"></div>
      <div class="slab-mini-rail rail-a"></div>
      <div class="slab-mini-rail rail-b"></div>
      ${sleepers}
    </div>
  `;
}

function syncViewers() {
  const isStructure = steps[state.step].id === "structure";
  window.dispatchEvent(
    new CustomEvent("demo:model-change", {
      detail: { preset: isStructure ? "wj8c" : "track" },
    }),
  );
  window.dispatchEvent(
    new CustomEvent("demo:model-component", {
      detail: {
        id: isStructure ? state.activeComponent : "",
        fadedOthers: false,
        exploded: isStructure && state.exploded,
      },
    }),
  );
  window.dispatchEvent(
    new CustomEvent("demo:part-component-change", {
      detail: { id: isStructure ? state.activeComponent : "" },
    }),
  );
}

function renderModelToolbar() {
  if (state.step !== 1) {
    componentLayer.innerHTML = "";
    return;
  }

  componentLayer.innerHTML = `<div class="model-toolbar">
    <button class="model-toolbar-btn ${state.exploded ? "active" : ""}" type="button" data-action="toggle-explosion">
      ${state.exploded ? "收起爆炸图" : "爆炸图"}
    </button>
  </div>`;
}

function renderStep() {
  const id = steps[state.step].id;
  if (id === "task") renderTaskStep();
  if (id === "structure") renderStructureStep();
  if (id === "diagnosis") renderDiagnosisStep();
  if (id === "plan") renderPlanStep();
  if (id === "review") renderReviewStep();
}

function renderSurveyDataTable(mode = "task") {
  const selectable = mode === "diagnosis";
  return `
    <table class="data-table compact-table survey-table">
      <thead>
        <tr>
          <th>测点</th><th>里程</th><th>轨距</th><th>水平</th><th>左轨向</th><th>右轨向</th><th>左高低</th><th>右高低</th>
        </tr>
      </thead>
      <tbody>
        ${measureData
          .map((row) => {
            const classes = [];
            if (selectable) classes.push("selectable");
            if (state.selectedPoints.has(row.point)) classes.push("selected");
            return `<tr class="${classes.join(" ")}" ${selectable ? `data-point-row="${row.point}"` : ""}>
              <td><strong>${row.point}</strong></td>
              <td>${row.mileage}</td>
              <td>${formatGauge(row)}</td>
              <td>${signedText(row.level)}</td>
              <td>${signedText(row.alignLeft)}</td>
              <td>${signedText(row.alignRight)}</td>
              <td>${signedText(row.highLowLeft)}</td>
              <td>${signedText(row.highLowRight)}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function svgPointString(rows, getY) {
  return rows.map((row, index) => `${74 + index * 138},${getY(row, index)}`).join(" ");
}

function renderDeviationSketch() {
  const xs = measureData.map((_, index) => 104 + index * 210);
  const toPoints = (rows, getY) => rows.map((row, index) => `${xs[index]},${getY(row, index)}`).join(" ");

  const leftBaseY = 88;
  const rightBaseY = 142;
  const planScale = 8;
  const profileBaseY = 306;
  const profileScale = 12;

  const planLeftY = (row) => leftBaseY - row.alignLeft * planScale;
  const planRightY = (row) => rightBaseY + row.alignRight * planScale;
  const levelLeftY = (row) => profileBaseY - row.highLowLeft * profileScale;
  const levelRightY = (row) => profileBaseY - row.highLowRight * profileScale;

  const leftPlan = toPoints(measureData, planLeftY);
  const rightPlan = toPoints(measureData, planRightY);
  const leftHigh = toPoints(measureData, levelLeftY);
  const rightHigh = toPoints(measureData, levelRightY);

  return `
    <div class="survey-sketch" aria-label="二维几何形位偏差示意图">
      <div class="survey-sketch-head">
        <div>
          <strong>二维几何形位偏差示意图</strong>
          <span>上：轨向与轨距；下：高低与水平</span>
        </div>
        <em>数据与图形同步</em>
      </div>
      <svg viewBox="0 0 1040 430" role="img" aria-label="轨距、轨向、水平与高低偏差示意">
        <defs>
          <filter id="pointShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#25324a" flood-opacity="0.12" />
          </filter>
          <marker id="gaugeArrowTop" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="strokeWidth">
            <path d="M0,4 L8,0 L8,8 Z" fill="#596b86" />
          </marker>
          <marker id="gaugeArrowBottom" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="strokeWidth">
            <path d="M8,4 L0,0 L0,8 Z" fill="#596b86" />
          </marker>
        </defs>

        <rect x="28" y="28" width="984" height="156" rx="18" class="sketch-panel" />
        <rect x="28" y="236" width="984" height="156" rx="18" class="sketch-panel" />
        <text x="52" y="54" class="sketch-block-title">平面偏差</text>
        <text x="136" y="54" class="sketch-subtitle">左、右轨向偏移共同形成轨距变化</text>
        <text x="52" y="262" class="sketch-block-title">纵断偏差</text>
        <text x="136" y="262" class="sketch-subtitle">左、右高低差形成水平偏差</text>

        <line x1="78" y1="${leftBaseY}" x2="964" y2="${leftBaseY}" class="sketch-design-line" />
        <line x1="78" y1="${rightBaseY}" x2="964" y2="${rightBaseY}" class="sketch-design-line" />
        <line x1="78" y1="${profileBaseY}" x2="964" y2="${profileBaseY}" class="sketch-axis" />

        <polyline points="${leftPlan}" class="sketch-rail left" />
        <polyline points="${rightPlan}" class="sketch-rail right" />
        <polyline points="${leftHigh}" class="sketch-profile left" />
        <polyline points="${rightHigh}" class="sketch-profile right" />

        ${measureData.map((row, index) => {
          const x = xs[index];
          const yLeftPlan = planLeftY(row);
          const yRightPlan = planRightY(row);
          const yLeft = levelLeftY(row);
          const yRight = levelRightY(row);
          const gaugeChipY = Math.min(Math.max(((yLeftPlan + yRightPlan) / 2) - 14, 70), 132);
          const levelChipY = Math.min(Math.max(Math.max(yLeft, yRight) + 16, 320), 360);
          return `<g>
            <line x1="${x}" y1="62" x2="${x}" y2="166" class="sketch-guide" />
            <line x1="${x}" y1="278" x2="${x}" y2="372" class="sketch-guide" />
            <line x1="${x}" y1="${yLeftPlan}" x2="${x}" y2="${yRightPlan}" class="gauge-span" marker-start="url(#gaugeArrowTop)" marker-end="url(#gaugeArrowBottom)" />
            <circle cx="${x}" cy="${yLeftPlan}" r="4" class="sketch-solid left" filter="url(#pointShadow)" />
            <circle cx="${x}" cy="${yRightPlan}" r="5" class="sketch-solid right" filter="url(#pointShadow)" />
            <circle cx="${x}" cy="${yLeft}" r="4" class="sketch-solid left" filter="url(#pointShadow)" />
            <circle cx="${x}" cy="${yRight}" r="5" class="sketch-solid right" filter="url(#pointShadow)" />
            <text x="${x}" y="180" class="sketch-point-text">${row.point}</text>
            <text x="${x}" y="390" class="sketch-point-text">${row.point}</text>
            <g class="sketch-chip" transform="translate(${x - 58},${gaugeChipY})">
              <rect width="116" height="26" rx="9" class="chip-bg" />
              <text x="58" y="17" class="chip-main">轨距 ${row.gauge} / ${signedText(gaugeDiff(row))}</text>
            </g>
            <g class="sketch-chip" transform="translate(${x - 56},${levelChipY})">
              <rect width="112" height="26" rx="9" class="chip-bg alt" />
              <text x="56" y="17" class="chip-main">水平 ${signedText(row.level)}</text>
            </g>
          </g>`;
        }).join('')}

        <g class="sketch-legend compact-legend">
          <circle cx="760" cy="414" r="5" class="legend-left" /><text x="774" y="418">左股</text>
          <circle cx="830" cy="414" r="5" class="legend-right" /><text x="844" y="418">右股</text>
          <line x1="910" y1="414" x2="950" y2="414" class="sketch-design-line" /><text x="958" y="418">设计基准</text>
        </g>
      </svg>
    </div>
  `;
}

function svgPointStringWide(rows, getY) {
  return rows.map((row, index) => `${90 + index * 180},${getY(row, index)}`).join(" ");
}

function renderTaskStep() {
  contentEl.innerHTML = `
    <div class="section-block task-reception-block">
      ${taskBriefHtml(false)}
      <div class="survey-layout">
        <div class="survey-data-card">
          <div class="survey-card-head survey-card-head-action">
            <div>
              <strong>精测数据记录</strong>
              <span>标准轨距 ${STANDARD_GAUGE}mm，偏差单位均为 mm</span>
            </div>
            <button class="ghost compact-btn" type="button" data-action="generate-survey">随机生成</button>
          </div>
          ${renderSurveyDataTable("task")}
        </div>
        ${renderDeviationSketch()}
      </div>
    </div>
  `;
}

function renderPointRibbon() {
  return `
    <div class="point-ribbon" aria-label="测点快速定位">
      <div class="ribbon-rail rail-a"></div>
      <div class="ribbon-rail rail-b"></div>
      ${measureData
        .map((row, index) => {
          const classes = ["measure-point", "ribbon-point", "active"];
          if (row.isTarget) classes.push("warning");
          if (state.selectedPoints.has(row.point)) classes.push("selected");
          return `<button class="${classes.join(" ")}" type="button" data-point="${row.point}" style="--point-index:${index}">
            <span>${row.point}</span>
          </button>`;
        })
        .join("")}
    </div>
  `;
}


function gaugeLeadRow() {
  return measureData.reduce((maxRow, row) => (Math.abs(gaugeDiff(row)) > Math.abs(gaugeDiff(maxRow)) ? row : maxRow), measureData[0]);
}

function levelLeadRow() {
  return measureData.reduce((maxRow, row) => (Math.abs(row.level) > Math.abs(maxRow.level) ? row : maxRow), measureData[0]);
}

function renderGaugeTable() {
  return `
    <table class="data-table compact-table adjustment-table">
      <thead><tr><th>测点</th><th>当前轨距</th><th>偏差</th><th>左轨向</th><th>右轨向</th><th>规则</th></tr></thead>
      <tbody>
        ${measureData.map((row) => `<tr class="${row.point === state.activeGaugePoint ? "selected-row" : ""}">
          <td><strong>${row.point}</strong></td>
          <td>${row.gauge}mm</td>
          <td>${signedText(gaugeDiff(row))}</td>
          <td>${signedText(row.alignLeft)}</td>
          <td>${signedText(row.alignRight)}</td>
          <td>${getGaugeRuleType(gaugeAdjustAmount(row))}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  `;
}

function renderStructureStep() {
  const activeItem = componentNotes[state.activeComponent];
  const viewed = seenCountableComponentCount();
  const total = countableComponentIds().length;
  contentEl.innerHTML = `
    <div class="section-block component-learning-shell">
      <div class="section-title-row compact-title-row">
        <div>
          <h3>构件识别：认识 WJ-8C 扣件组成</h3>
        </div>
        <span class="component-progress">已查看 ${viewed}/${total}</span>
      </div>

      <div class="component-study-layout">
        <div class="part-model-card">
          <div class="part-model-head">
            <div>
              <span>当前部件</span>
              <strong>${activeItem ? activeItem.title : "未选择"}</strong>
            </div>

          </div>
          <div class="part-model-stage">
            <canvas id="partCanvas" class="part-model-canvas" aria-label="单个部件三维模型"></canvas>
            <div class="part-model-status" id="partModelStatus">请点击左侧整体模型中的任一可见部件</div>
          </div>
        </div>

        <div class="part-detail-stack">
          <div class="part-info-card ${activeItem ? "has-data" : ""}">
            ${activeItem ? renderPartInfo(activeItem) : renderEmptyPartInfo()}
          </div>

        </div>
      </div>

      ${renderInstallFlow(activeItem)}

    </div>
  `;
}

function renderPartInfo(item) {
  return `
    <div class="part-info-title">
      <span>${item.layer}</span>
      <strong>${item.title}</strong>
    </div>
    <div class="part-info-grid">
      <div class="part-info-item"><em>规格型号</em><p>${item.spec}</p></div>
      <div class="part-info-item"><em>安装位置</em><p>${item.position}</p></div>
      <div class="part-info-item wide"><em>功能作用</em><p>${item.function}</p></div>
      <div class="part-info-item wide tip"><em>学习提示</em><p>${item.tip}</p></div>
    </div>
  `;
}

function renderEmptyPartInfo() {
  return `
    <div class="part-info-empty">
      <strong>请先点击左侧整体模型</strong>
      <p>选中部件后，这里将显示该部件的规格型号、安装位置、功能作用和学习提示。</p>
    </div>
  `;
}


function renderInstallFlow(activeItem) {
  const activeId = state.activeComponent;
  const steps = [
    { id: "elasticPad", no: "01", title: "安放弹性垫板", desc: "孔位与预埋套管对中" },
    { id: "basePlate", no: "02", title: "安放铁垫板", desc: "螺栓孔与套管对正" },
    { id: "railPad", no: "03", title: "安放轨下垫板", desc: "凸缘扣住铁垫板" },
    { id: "gaugePlate", no: "04", title: "安放轨距挡板", desc: "圆弧凸台入槽" },
    { id: "insulator", no: "05", title: "安放绝缘轨距块", desc: "两边耳卡住挡肩" },
    { id: "clip", no: "06", title: "安放弹条", desc: "后端入槽、前端支承" },
    { id: "screw", alt: "washer", no: "07", title: "紧固螺旋道钉", desc: "套平垫圈并控扭复紧" },
  ];
  return `
    <div class="install-flow-card">
      <div class="install-flow-head">
        <strong>安装步骤流程图</strong>
      </div>
      <div class="install-flow-track">
        ${steps
          .map((step) => {
            const isActive = activeId === step.id || activeId === step.alt;
            return `<div class="install-step ${isActive ? "active" : ""}">
              <em>${step.no}</em>
              <strong>${step.title}</strong>
              <span>${step.desc}</span>
            </div>`;
          })
          .join("")}
      </div>

    </div>
  `;
}


function renderGaugeAdjustmentSketch(row) {
  const xs = measureData.map((_, index) => 86 + index * 147);
  const scale = 4.6;
  const clampY = (value, min, max) => Math.min(max, Math.max(min, value));
  const designGap = 68;

  const cfg = {
    title: "调整后状态",
    subtitle: "确认后按所选扣件组合显示复测轨距结果",
    panelY: 58,
    panelH: 176,
    titleY: 84,
    leftBaseY: 122,
    rightBaseY: 122 + designGap,
  };

  const railY = (item, rail) => {
    const leftAlign = displayRailAlign(item, "left");
    const rightAlign = displayRailAlign(item, "right");
    if (rail === "left") return clampY(cfg.leftBaseY - leftAlign * scale, cfg.panelY + 54, cfg.panelY + 92);
    return clampY(cfg.rightBaseY + rightAlign * scale, cfg.panelY + 116, cfg.panelY + 154);
  };

  const railPoints = (rail) => measureData
    .map((item, index) => `${xs[index]},${railY(item, rail)}`)
    .join(" ");

  const activeGauge = displayGauge(row);
  const activeAfterText = isGaugePointConfirmed(row.point) ? `${activeGauge}mm` : "待确认";

  return `
    <div class="gauge-work-card gauge-plan-card gauge-geometry-card gauge-geometry-card-after-only">
      <div class="card-head">
        <strong>轨距二维示意图</strong>
        <span>保留调整后状态：用二维几何示意表达复测轨距结果</span>
      </div>
      <svg class="gauge-plan-svg gauge-geometry-svg gauge-geometry-svg-after-only" viewBox="0 0 760 280" aria-label="轨距调整后二维几何示意图">
        <defs>
          <filter id="gaugeActiveShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#1d4fb5" flood-opacity="0.20" />
          </filter>
        </defs>
        <rect x="14" y="14" width="732" height="252" rx="22" class="gauge-schematic-bg" />
        <g class="gauge-focus-badge">
          <rect x="510" y="22" width="206" height="31" rx="12" />
          <text x="526" y="42">${row.point}：调整后 ${activeAfterText}</text>
        </g>
        <g class="gauge-schematic-phase gauge-schematic-after gauge-schematic-after-only">
          <rect x="28" y="${cfg.panelY}" width="704" height="${cfg.panelH}" rx="18" class="sketch-panel" />
          <text x="50" y="${cfg.titleY}" class="sketch-block-title gauge-phase-title">${cfg.title}</text>
          <text x="152" y="${cfg.titleY}" class="sketch-subtitle gauge-phase-subtitle">${cfg.subtitle}</text>
          <line x1="78" y1="${cfg.leftBaseY}" x2="682" y2="${cfg.leftBaseY}" class="gauge-design-rail" />
          <line x1="78" y1="${cfg.rightBaseY}" x2="682" y2="${cfg.rightBaseY}" class="gauge-design-rail" />
          <polyline points="${railPoints("left")}" class="sketch-rail left gauge-geometry-rail" />
          <polyline points="${railPoints("right")}" class="sketch-rail right gauge-geometry-rail" />
          ${measureData.map((item, index) => {
            const x = xs[index];
            const yLeft = railY(item, "left");
            const yRight = railY(item, "right");
            const midY = (yLeft + yRight) / 2;
            const active = item.point === row.point;
            const confirmed = isGaugePointConfirmed(item.point);
            const gaugeValue = displayGauge(item);
            const diff = gaugeValue - STANDARD_GAUGE;
            const chipText = confirmed ? `${gaugeValue}mm` : "待确认";
            const detailText = confirmed ? signedText(diff) : "--";
            return `<g class="gauge-schematic-point ${active ? "active" : ""} ${confirmed ? "confirmed" : ""}">
              <line x1="${x}" y1="${cfg.panelY + 36}" x2="${x}" y2="${cfg.panelY + cfg.panelH - 28}" class="sketch-guide" />
              <line x1="${x}" y1="${yLeft}" x2="${x}" y2="${yRight}" class="gauge-span gauge-schematic-span" />
              <circle cx="${x}" cy="${yLeft}" r="${active ? 5.2 : 4.1}" class="sketch-solid left" />
              <circle cx="${x}" cy="${yRight}" r="${active ? 5.2 : 4.1}" class="sketch-solid right" />
              <g class="sketch-chip gauge-chip ${active ? "active" : ""}" transform="translate(${x - 43},${yLeft - 35})">
                <rect width="86" height="25" rx="9" class="chip-bg alt" />
                <text x="43" y="16" class="chip-main">${chipText}</text>
              </g>
              <text x="${x}" y="${yRight + 30}" class="gauge-diff-text ${diff === 0 && confirmed ? "ok" : ""}">${detailText}</text>
              <text x="${x}" y="${yRight + 47}" class="sketch-point-text gauge-point-text-after">${item.point}</text>
            </g>`;
          }).join("")}
        </g>
        <g class="sketch-legend gauge-schematic-legend gauge-schematic-legend-after-only">
          <circle cx="70" cy="254" r="4.5" class="legend-left" /><text x="82" y="258">左股钢轨</text>
          <circle cx="158" cy="254" r="4.5" class="legend-right" /><text x="170" y="258">右股钢轨</text>
          <line x1="270" y1="254" x2="306" y2="254" class="gauge-design-rail" /><text x="314" y="258">标准轨距基准</text>
        </g>
      </svg>
    </div>
  `;
}

function renderGaugeComponentLinks() {
  // 坐标按 1000×620 视口标定：圆点就是竖线的上端点，同时压在对应三维构件上。
  // 下方选择框按同一 x 坐标收窄对齐，避免“线指到空处”。
  const yChoice = 492;
  const items = [
    // 手工校准：圆点固定压在构件本体中心，竖线从圆点正下方引到对应型号框。
    { cls: "link-left-plate-outer", x: 74, y: 190, kind: "plate" },
    { cls: "link-left-block-outer", x: 145, y: 173, kind: "block" },
    { cls: "link-left-block-inner", x: 277, y: 176, kind: "block" },
    { cls: "link-left-plate-inner", x: 364, y: 204, kind: "plate" },
    { cls: "link-right-plate-inner", x: 636, y: 204, kind: "plate" },
    { cls: "link-right-block-inner", x: 723, y: 176, kind: "block" },
    { cls: "link-right-block-outer", x: 855, y: 173, kind: "block" },
    { cls: "link-right-plate-outer", x: 926, y: 190, kind: "plate" },
  ];
  return `
    <svg class="gauge-component-links" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">
      ${items.map((item) => `
        <g class="gauge-component-link ${item.cls} ${item.kind}">
          <path d="M ${item.x} ${item.y} L ${item.x} ${yChoice}" />
          <circle class="component-dot" cx="${item.x}" cy="${item.y}" r="5.2" />
        </g>
      `).join("")}
    </svg>
  `;
}

function gaugeChoiceFieldsByRail(rail) {
  const physicalLeftToRight = {
    left: [
      ["outerPlate", [4, 7, 10], "轨距挡板"],
      ["outerBlock", [7, 8, 9, 10, 11], "轨距块"],
      ["innerBlock", [7, 8, 9, 10, 11], "轨距块"],
      ["innerPlate", [4, 7, 10], "轨距挡板"],
    ],
    right: [
      ["innerPlate", [4, 7, 10], "轨距挡板"],
      ["innerBlock", [7, 8, 9, 10, 11], "轨距块"],
      ["outerBlock", [7, 8, 9, 10, 11], "轨距块"],
      ["outerPlate", [4, 7, 10], "轨距挡板"],
    ],
  };
  return physicalLeftToRight[rail] || physicalLeftToRight.left;
}

function renderGaugeChoiceRow(row, rail) {
  const choice = getDraftGaugeChoice(row.point, rail);
  const correct = isGaugePointConfirmed(row.point) && isRailGaugeChoiceCorrect(row.point, rail);
  const railName = rail === "left" ? "左股钢轨扣件" : "右股钢轨扣件";
  const fields = gaugeChoiceFieldsByRail(rail);
  const fieldLefts = {
    left: [7.4, 14.5, 27.7, 36.4],
    right: [63.6, 72.3, 85.5, 92.6],
  };
  return `
    <div class="gauge-choice-row gauge-choice-row-${rail} ${correct ? "correct" : ""}">
      <div class="gauge-row-title">
        <strong>${railName}</strong>
        <span>${rail === "left" ? "外侧 → 内侧" : "内侧 → 外侧"}</span>
      </div>
      <div class="gauge-choice-fields gauge-choice-fields-${rail} gauge-choice-fields-absolute" aria-label="${railName}部件型号选择，按上方模型实际位置从左到右排列">
        ${fields.map(([field, values, shortLabel], index) => `
          <label class="gauge-choice-field gauge-choice-field-${field} gauge-choice-pos-${index + 1}" data-field="${field}" style="left:${fieldLefts[rail][index]}%;">
            <span>${shortLabel}</span>
            ${renderGaugeSelect(row.point, rail, field, values, choice)}
          </label>
        `).join("")}
      </div>
    </div>
  `;
}

function renderCurrentGaugeChoicePanel(row) {
  const leftOk = isGaugePointConfirmed(row.point) && isRailGaugeChoiceCorrect(row.point, "left");
  const rightOk = isGaugePointConfirmed(row.point) && isRailGaugeChoiceCorrect(row.point, "right");
  return `
    <div class="fastener-adjust-panel gauge-combo-panel ${leftOk && rightOk ? "done" : ""}" aria-label="当前测点扣件型号选择">
      <div class="gauge-choice-table gauge-choice-table-split">
        ${renderGaugeChoiceRow(row, "left")}
        ${renderGaugeChoiceRow(row, "right")}
      </div>
      <div class="gauge-confirm-bar">
        <button class="primary gauge-confirm-btn" type="button" data-action="confirm-gauge-current">确认并更新数据</button>
      </div>
    </div>
  `;
}

function renderGaugeSelect(point, rail, field, values, choice) {
  return `
    <select class="gauge-mini-select" data-gauge-point="${point}" data-gauge-rail="${rail}" data-gauge-field="${field}" aria-label="${rail === "left" ? "左股" : "右股"}${GAUGE_FIELD_LABELS[field]}">
      ${values.map((v) => `<option value="${v}" ${Number(choice[field]) === Number(v) ? "selected" : ""}>${v}</option>`).join("")}
    </select>
  `;
}

function renderGaugeTable() {
  const rows = measureData.flatMap((row) => [
    { ...row, rail: "left", railName: "左股扣件" },
    { ...row, rail: "right", railName: "右股扣件" },
  ]);
  return `
    <table class="data-table compact-table adjustment-table gauge-config-table">
      <thead>
        <tr>
          <th>测点</th>
          <th>扣件位置</th>
          <th>当前轨距</th>
          <th>调整要求</th>
          <th>外侧轨距挡板</th>
          <th>外侧绝缘轨距块</th>
          <th>内侧绝缘轨距块</th>
          <th>内侧轨距挡板</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => {
          const choice = getGaugeChoice(row.point, row.rail);
          const correct = isRailGaugeChoiceCorrect(row.point, row.rail);
          return `<tr class="${row.point === state.activeGaugePoint ? "selected-row" : ""}">
            <td><button type="button" class="table-point-btn" data-gauge-point="${row.point}">${row.point}</button></td>
            <td>${row.railName}</td>
            <td>${row.gauge}mm <span class="muted">${signedText(gaugeDiff(row))}</span></td>
            <td>${railAdjustLabel(row, row.rail)}</td>
            <td>${renderGaugeSelect(row.point, row.rail, "outerPlate", [4, 7, 10], choice)}</td>
            <td>${renderGaugeSelect(row.point, row.rail, "outerBlock", [7, 8, 9, 10, 11], choice)}</td>
            <td>${renderGaugeSelect(row.point, row.rail, "innerBlock", [7, 8, 9, 10, 11], choice)}</td>
            <td>${renderGaugeSelect(row.point, row.rail, "innerPlate", [4, 7, 10], choice)}</td>
            <td><span class="status-pill ${correct ? "ok" : "pending"}">${correct ? "正确" : "待选"}</span></td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
}

function gaugeChoiceProgress(point) {
  if (isGaugePointConfirmed(point)) return { text: "已完成", cls: "ok" };
  return { text: "待确认", cls: "pending" };
}

function renderGaugeResultTable() {
  return `
    <table class="data-table compact-table adjustment-table gauge-result-table">
      <thead>
        <tr>
          <th>测点</th>
          <th>轨距</th>
          <th>偏差</th>
          <th>左轨向</th>
          <th>右轨向</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        ${measureData.map((row) => {
          const progress = gaugeChoiceProgress(row.point);
          const selected = row.point === state.activeGaugePoint ? "selected-row" : "";
          return `<tr class="${selected}">
            <td><button type="button" class="table-point-btn" data-gauge-point="${row.point}">${row.point}</button></td>
            <td>${displayGauge(row)}mm</td>
            <td>${signedText(displayGaugeDiff(row))}</td>
            <td>${signedText(displayRailAlign(row, "left"))}</td>
            <td>${signedText(displayRailAlign(row, "right"))}</td>
            <td><span class="status-pill ${progress.cls}">${progress.text}</span></td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
}

function renderDiagnosisStep() {
  const row = activeGaugeRow();
  contentEl.innerHTML = `
    <div class="section-block gauge-adjust-page gauge-adjust-page-simple gauge-adjust-page-clean gauge-adjust-page-core">
      <div class="gauge-right-stack">
        <div class="adjustment-main-card small-table-card gauge-result-card">
          <div class="card-head gauge-result-head">
            <div>
              <strong>轨距调整结果表</strong>
            </div>
          </div>
          <div class="diagnosis-table-wrap">
            ${renderGaugeResultTable()}
          </div>
        </div>
        ${renderGaugeAdjustmentSketch(row)}
      </div>
    </div>
  `;
}


function diagnosisFeedback() {
  const count = measureData.filter((row) => isGaugePointConfirmed(row.point)).length;
  if (diagnosisPassed()) return `<div class="feedback good">轨距调整完成：5个测点均已确认，得分按选型正确性计算。</div>`;
  return `<div class="feedback">当前已确认 ${count}/5 个测点。请选择型号并点击确认。</div>`;
}

function renderLevelAdjustmentSketch(row) {
  const displayData = renderedLevelData();
  const displayRow = getRenderedLevelRow(row);
  const xs = displayData.map((_, index) => 110 + index * 136);
  const panelTop = 42;
  const panelHeight = 250;
  const baseY = 180;
  const scale = 16;
  const leftY = (item) => baseY - item.highLowLeft * scale;
  const rightY = (item) => baseY - item.highLowRight * scale;
  const leftProfile = displayData.map((item, index) => `${xs[index]},${leftY(item)}`).join(" ");
  const rightProfile = displayData.map((item, index) => `${xs[index]},${rightY(item)}`).join(" ");
  const currentIndex = Math.max(0, displayData.findIndex((item) => item.point === row.point));
  const currentX = xs[currentIndex];
  const currentLeftY = leftY(displayRow);
  const currentRightY = rightY(displayRow);
  const focusLabelY = 76;
  const activeLevelText = Math.abs(displayRow.level) === 0 ? "水平 0mm" : `水平 ${signedText(displayRow.level)}`;
  return `
    <div class="gauge-work-card gauge-plan-card level-plan-card level-plan-card-plain level-plan-card-refined">
      <div class="card-head"><strong>水平二维示意图</strong><span>参考模块一与模块三，仅显示调整后状态</span></div>
      <svg class="level-adjust-svg level-plan-svg level-plan-svg-refined" viewBox="0 0 760 332" aria-label="水平调整二维示意">
        <rect x="24" y="10" width="712" height="294" rx="20" class="sketch-panel" />
        <text x="48" y="38" class="sketch-block-title">调整后状态</text>
        <text x="144" y="38" class="sketch-subtitle">显示左、右股高低变化及各测点水平结果</text>

        <line x1="88" y1="${baseY}" x2="678" y2="${baseY}" class="sketch-axis" />
        <polyline points="${leftProfile}" class="sketch-profile left" />
        <polyline points="${rightProfile}" class="sketch-profile right" />

        ${displayData.map((item, index) => {
          const x = xs[index];
          const ly = leftY(item);
          const ry = rightY(item);
          const active = item.point === row.point;
          const chipY = Math.min(258, Math.max(Math.max(ly, ry) + 18, 208));
          return `<g class="${active ? "level-current-point" : ""}">
            <line x1="${x}" y1="78" x2="${x}" y2="270" class="sketch-guide ${active ? "active-guide" : ""}" />
            <circle cx="${x}" cy="${ly}" r="${active ? 6 : 4}" class="sketch-solid left" />
            <circle cx="${x}" cy="${ry}" r="${active ? 6 : 4}" class="sketch-solid right" />
            <text x="${x}" y="288" class="sketch-point-text">${item.point}</text>
            <g class="sketch-chip" transform="translate(${x - 50},${chipY})">
              <rect width="100" height="24" rx="9" class="chip-bg alt" />
              <text x="50" y="16" class="chip-main">${signedText(item.level)}</text>
            </g>
          </g>`;
        }).join('')}

        <line x1="${currentX}" y1="${currentLeftY}" x2="${currentX}" y2="${currentRightY}" class="gauge-span level-gap-span" />
        <g transform="translate(36,${focusLabelY})" class="level-focus-note level-focus-note-fixed">
          <rect width="156" height="48" rx="12" class="sketch-badge" />
          <text x="78" y="18" class="sketch-badge-value">左高低 ${signedText(displayRow.highLowLeft)}</text>
          <text x="78" y="36" class="sketch-badge-sub">右高低 ${signedText(displayRow.highLowRight)}</text>
        </g>

        <g class="sketch-legend compact-legend level-legend-inside">
          <circle cx="406" cy="292" r="5" class="legend-left" /><text x="420" y="296">左股钢轨</text>
          <circle cx="514" cy="292" r="5" class="legend-right" /><text x="528" y="296">右股钢轨</text>
          <line x1="626" y1="292" x2="664" y2="292" class="sketch-axis" /><text x="672" y="296">基准线</text>
        </g>
      </svg>
    </div>
  `;
}

function renderLevelSelect(field, label, values, choice) {
  return `
    <label class="select-row">
      <span>${label}</span>
      <select data-level-field="${field}">
        <option value="">请选择</option>
        ${values.map((item) => {
          const value = typeof item === "object" ? item.value : item;
          const text = typeof item === "object" ? item.text : `${item}mm`;
          return `<option value="${value}" ${String(choice[field] ?? "") === String(value) ? "selected" : ""}>${text}</option>`;
        }).join("")}
      </select>
    </label>
  `;
}

function renderLevelDecisionPanel(row) {
  const choice = getLevelChoice(row.point);
  const expected = expectedLevelChoice(row);
  const correct = isLevelChoiceCorrect(row.point);
  return `
    <div class="decision-card">
      <div class="card-head"><strong>水平调整决策区</strong><span>判断抬升股别和调整量</span></div>
      <div class="point-tabs">
        ${measureData.map((item) => `<button class="point-tab ${item.point === row.point ? "active" : ""} ${isLevelChoiceCorrect(item.point) ? "done" : ""}" type="button" data-level-point="${item.point}">${item.point}</button>`).join("")}
      </div>
      <div class="decision-info-grid">
        <div><em>当前测点</em><strong>${row.point}</strong><span>${row.mileage}</span></div>
        <div><em>水平偏差</em><strong>${signedText(row.level)}</strong><span>左高低 ${signedText(row.highLowLeft)} / 右高低 ${signedText(row.highLowRight)}</span></div>
        <div><em>需抬升股别</em><strong>${expected.side === "right" ? "右股" : "左股"}</strong><span>以较低股为调整对象</span></div>
        <div><em>调整量</em><strong>${expected.amount}mm</strong><span>轨下微调垫板组合</span></div>
      </div>
      <div class="choice-form two-grid">
        ${renderLevelSelect("side", "抬升股别", [{ value: "left", text: "左股" }, { value: "right", text: "右股" }], choice)}
        ${renderLevelSelect("amount", "抬升量", [1, 2, 3, 4, 5], choice)}
      </div>
      <div class="button-row tight-row">
        <button class="ghost compact-btn" type="button" data-action="fill-level-current">自动带入推荐方案</button>
      </div>
      <div class="feedback ${correct ? "good" : ""}">${correct ? "本测点水平调整方案正确。" : "请根据水平符号和左右股高低关系，选择抬升股别和调整量。"}</div>
    </div>
  `;
}

function renderLevelInlineSelect(point, field, values, choice, label) {
  return `
    <select class="level-inline-select" data-level-point="${point}" data-level-field="${field}" aria-label="${point}${label}">
      <option value="">请选择</option>
      ${values.map((item) => {
        const value = typeof item === "object" ? item.value : item;
        const text = typeof item === "object" ? item.text : `${item}mm`;
        return `<option value="${value}" ${String(choice[field] ?? "") === String(value) ? "selected" : ""}>${text}</option>`;
      }).join("")}
    </select>
  `;
}

function levelChoiceProgress(point) {
  const choice = getLevelChoice(point);
  if (!choice.confirmed) return { text: "待确认", cls: "pending" };
  if (!isValidLevelPadConfig(choice.left) || !isValidLevelPadConfig(choice.right)) return { text: "组合无效", cls: "partial" };
  if (isLevelChoiceCorrect(point)) return { text: "正确", cls: "ok" };
  return { text: "需修正", cls: "partial" };
}

function renderLevelTable() {
  return `
    <table class="data-table compact-table adjustment-table level-config-table level-result-table level-result-table-fixed level-result-table-simple">
      <thead>
        <tr>
          <th>测点</th>
          <th>原始水平</th>
          <th>左股调整</th>
          <th>右股调整</th>
          <th>调整后水平</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        ${measureData.map((row) => {
          const choice = getLevelChoice(row.point);
          const progress = levelChoiceProgress(row.point);
          const leftAdjustment = choice.confirmed ? levelAdjustmentFromSideChoice(choice.left) : null;
          const rightAdjustment = choice.confirmed ? levelAdjustmentFromSideChoice(choice.right) : null;
          const resultLevel = choice.confirmed ? levelResultAfterChoice(row, choice) : null;
          return `<tr class="${row.point === state.activeLevelPoint ? "selected-row" : ""}">
            <td><button type="button" class="table-point-btn" data-level-point="${row.point}">${row.point}</button></td>
            <td><strong>${signedText(row.level)}</strong></td>
            <td>${choice.confirmed ? signedText(leftAdjustment) : "--"}</td>
            <td>${choice.confirmed ? signedText(rightAdjustment) : "--"}</td>
            <td><strong>${choice.confirmed ? signedText(resultLevel) : "待确认"}</strong></td>
            <td><span class="status-pill ${progress.cls}">${progress.text}</span></td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
}

function renderPlanStep() {
  const row = activeLevelRow();
  contentEl.innerHTML = `
    <div class="section-block gauge-adjust-page gauge-adjust-page-simple gauge-adjust-page-clean gauge-adjust-page-core level-adjust-page-core">
      <div class="gauge-right-stack level-right-stack">
        <div class="adjustment-main-card small-table-card gauge-result-card level-result-card">
          <div class="card-head gauge-result-head">
            <div>
              <strong>水平调整结果表</strong>
              <span>确认左、右股调整后，结果表与二维示意图同步更新</span>
            </div>
          </div>
          <div class="diagnosis-table-wrap level-table-wrap">
            ${renderLevelTable()}
          </div>
        </div>
        ${renderLevelAdjustmentSketch(row)}
      </div>
    </div>
  `;
}

function planFeedback() {
  const count = measureData.filter((row) => isLevelChoiceCorrect(row.point)).length;
  if (planPassed()) return `<div class="feedback good">水平调整完成：5个测点的抬升股别和调整量均正确。</div>`;
  return `<div class="feedback">当前已完成 ${count}/5 个测点。请逐点完成水平调整方案。</div>`;
}



function computeReviewMetrics() {
  const taskReceived = true;
  const componentSeen = Math.min(seenCountableComponentCount(), 6);
  const gaugeDoneCount = measureData.filter((row) => isGaugePointConfirmed(row.point)).length;
  const gaugeCorrectCount = measureData.filter((row) => isGaugeChoiceCorrect(row.point)).length;
  const levelDoneCount = measureData.filter((row) => getLevelChoice(row.point).confirmed).length;
  const levelCorrectCount = measureData.filter((row) => isLevelChoiceCorrect(row.point)).length;
  const totalItems = measureData.length * 2;
  const completedItems = gaugeDoneCount + levelDoneCount;
  const correctItems = gaugeCorrectCount + levelCorrectCount;
  const completionRate = Math.round((completedItems / totalItems) * 100);
  const deliveryStageScore = Math.round((completedItems / totalItems) * 4 + (correctItems / totalItems) * 6);

  const stageMetrics = [
    {
      title: '任务接收',
      key: 'task',
      weight: 10,
      focus: '接收任务单，明确测点数据和调整目标',
      progress: '已接收',
      score: 10,
      status: '完成'
    },
    {
      title: '构件识别',
      key: 'structure',
      weight: 20,
      focus: '识别WJ-8C关键构件及作用',
      progress: `${componentSeen}/6`,
      score: Math.round((componentSeen / 6) * 20),
      status: componentSeen >= 6 ? '完成' : '待完善'
    },
    {
      title: '轨距调整',
      key: 'gauge',
      weight: 30,
      focus: '扣件组合选择、轨距偏差归零',
      progress: `${gaugeCorrectCount}/${measureData.length}`,
      score: gaugeCorrectCount * 6,
      status: gaugeCorrectCount === measureData.length ? '达标' : (gaugeDoneCount === measureData.length ? '需修正' : '未完成')
    },
    {
      title: '水平调整',
      key: 'level',
      weight: 30,
      focus: '抬升股别判断、水平偏差归零',
      progress: `${levelCorrectCount}/${measureData.length}`,
      score: levelCorrectCount * 6,
      status: levelCorrectCount === measureData.length ? '达标' : (levelDoneCount === measureData.length ? '需修正' : '未完成')
    },
    {
      title: '成果交付',
      key: 'delivery',
      weight: 10,
      focus: '记录完整、复测结论清晰、可交付',
      progress: `${completedItems}/${totalItems}`,
      score: deliveryStageScore,
      status: completedItems === totalItems ? (correctItems === totalItems ? '通过' : '待修正') : '待完善'
    }
  ];

  const totalScore = stageMetrics.reduce((sum, item) => sum + item.score, 0);
  const passed = gaugeCorrectCount === measureData.length && levelCorrectCount === measureData.length;

  return {
    taskReceived,
    componentSeen,
    gaugeDoneCount,
    gaugeCorrectCount,
    levelDoneCount,
    levelCorrectCount,
    totalItems,
    completedItems,
    correctItems,
    completionRate,
    deliveryStageScore,
    stageMetrics,
    totalScore,
    passed,
  };
}

function deliverySummaryChips(metrics) {
  return `
    <div class="delivery-summary-chip ok">任务接收 10分</div>
    <div class="delivery-summary-chip ${metrics.componentSeen >= 6 ? 'ok' : 'warn'}">构件识别 ${metrics.componentSeen}/6</div>
    <div class="delivery-summary-chip ${metrics.gaugeCorrectCount === measureData.length ? 'ok' : 'warn'}">轨距 ${metrics.gaugeCorrectCount}/${measureData.length}</div>
    <div class="delivery-summary-chip ${metrics.levelCorrectCount === measureData.length ? 'ok' : 'warn'}">水平 ${metrics.levelCorrectCount}/${measureData.length}</div>
  `;
}

function deliveryConclusion(metrics) {
  if (metrics.totalScore >= 90 && metrics.passed) return { title: '优秀，可交付', desc: '各模块完成度高，轨距与水平结果均已归零。', cls: 'ok' };
  if (metrics.totalScore >= 75 && metrics.completedItems === metrics.totalItems) return { title: '基本完成', desc: '记录已完整形成，但仍需修正未达标测点。', cls: 'warn' };
  return { title: '待修正', desc: '请根据评价结果返回前序模块继续修改。', cls: 'bad' };
}

function renderStageRubric(metrics) {
  return `
    <div class="delivery-scroll-area">
    <table class="data-table compact-table delivery-rubric-table">
      <thead>
        <tr><th>模块</th><th>考核要点</th><th>权重</th><th>完成</th><th>得分</th><th>评价</th></tr>
      </thead>
      <tbody>
        ${metrics.stageMetrics.map((item) => `
          <tr>
            <td><strong>${item.title}</strong></td>
            <td>${item.focus}</td>
            <td>${item.weight}</td>
            <td>${item.progress}</td>
            <td><strong>${item.score}</strong></td>
            <td><span class="status-pill ${item.status === '完成' || item.status === '达标' || item.status === '通过' ? 'ok' : item.status === '待完善' || item.status === '未完成' ? 'pending' : 'partial'}">${item.status}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    </div>
  `;
}

function renderDeliveryCompactTable() {
  return `
    <div class="delivery-scroll-area">
    <table class="data-table compact-table delivery-review-table delivery-review-table-v2">
      <thead>
        <tr><th>测点</th><th>轨距结果</th><th>水平结果</th><th>结论</th></tr>
      </thead>
      <tbody>
        ${measureData.map((row) => {
          const gaugeResult = isGaugePointConfirmed(row.point) ? signedText(displayGaugeDiff(row)) : '待确认';
          const levelChoice = getLevelChoice(row.point);
          const levelAfter = levelChoice.confirmed ? signedText(levelResultAfterChoice(row, levelChoice)) : '待确认';
          const status = deliveryPointStatus(row);
          return `<tr>
            <td><strong>${row.point}</strong></td>
            <td>${gaugeResult}</td>
            <td>${levelAfter}</td>
            <td><span class="status-pill ${status.cls}">${status.text}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    </div>
  `;
}

function renderDeliveryIssueList(metrics) {
  const items = [];
  if (metrics.componentSeen < 6) items.push(`构件识别模块尚有 ${6 - metrics.componentSeen} 个关键构件未学习。`);
  if (metrics.gaugeCorrectCount < measureData.length) items.push(`轨距调整模块尚有 ${measureData.length - metrics.gaugeCorrectCount} 个测点未归零。`);
  if (metrics.levelCorrectCount < measureData.length) items.push(`水平调整模块尚有 ${measureData.length - metrics.levelCorrectCount} 个测点未归零。`);
  if (!items.length) items.push('全部测点调整正确，记录完整，可直接打印或保存任务单。');
  return `<ul class="delivery-issue-list">${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
}

function renderDeliveryInfoPanel(metrics) {
  return `
    <div class="delivery-info-panel">
      <div class="delivery-check-mini">
        ${renderDeliveryCheckItem('任务接收', '任务单与精测数据已接收', true)}
        ${renderDeliveryCheckItem('构件识别', `${metrics.componentSeen}/6 个关键构件已学习`, metrics.componentSeen >= 6)}
        ${renderDeliveryCheckItem('轨距记录', `正确 ${metrics.gaugeCorrectCount}/${measureData.length} 个测点`, metrics.gaugeCorrectCount === measureData.length)}
        ${renderDeliveryCheckItem('水平记录', `正确 ${metrics.levelCorrectCount}/${measureData.length} 个测点`, metrics.levelCorrectCount === measureData.length)}
      </div>

    </div>
  `;
}

function renderReviewStep() {
  const metrics = computeReviewMetrics();
  const conclusion = deliveryConclusion(metrics);
  contentEl.innerHTML = `
    <div class="section-block delivery-block delivery-block-v2">
      <div class="delivery-overview-v2 delivery-overview-v3">
        <div class="delivery-overview-copy">
          <div class="delivery-title-row">
            <div>
              <p class="eyebrow">成果交付</p>
              <h3>几何形位调整任务交付单</h3>
              <p class="lead compact">按五个环节形成综合评价，集中显示得分、复测结果和整改建议。</p>
            </div>
            <div class="delivery-score-inline ${conclusion.cls}">
              <span>综合得分</span>
              <strong>${metrics.totalScore}</strong>
              <em>${conclusion.title}</em>
              <p>${conclusion.desc}</p>
            </div>
          </div>
          <div class="delivery-summary-strip">${deliverySummaryChips(metrics)}</div>
        </div>
      </div>

      <div class="delivery-grid-v2">
        <section class="delivery-card delivery-rubric-card">
          <div class="delivery-card-head">
            <div>
              <strong>评价体系</strong>
              <span>按步骤给出权重、完成情况与阶段得分</span>
            </div>
          </div>
          ${renderStageRubric(metrics)}
        </section>

        <section class="delivery-card delivery-result-card-v2">
          <div class="delivery-card-head">
            <div>
              <strong>复测结果表</strong>
              <span>直接查看 5 个测点的调整后结果</span>
            </div>
          </div>
          ${renderDeliveryCompactTable()}
        </section>

        <section class="delivery-card delivery-info-card-v2">
          <div class="delivery-card-head">
            <div>
              <strong>交付信息</strong>
              <span>材料完整性与任务摘要</span>
            </div>
          </div>
          ${renderDeliveryInfoPanel(metrics)}
        </section>

        <section class="delivery-card delivery-advice-card-v2">
          <div class="delivery-card-head">
            <div>
              <strong>评价结论与整改建议</strong>
              <span>根据前序模块完成情况给出交付意见</span>
            </div>
          </div>
          <div class="delivery-advice-body ${conclusion.cls}">
            <div class="delivery-advice-title">${conclusion.title}</div>
            ${renderDeliveryIssueList(metrics)}
          </div>
          <div class="delivery-actions compact-actions">
            <button class="ghost" type="button" data-step="2">返回轨距调整</button>
            <button class="ghost" type="button" data-step="3">返回水平调整</button>
            <button class="primary" type="button" data-action="print-sheet">打印 / 保存任务单</button>
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderDeliveryKpi(title, value, desc, stateClass = "") {
  return `<div class="delivery-kpi ${stateClass}">
    <span>${title}</span>
    <strong>${value}</strong>
    <em>${desc}</em>
  </div>`;
}

function renderDeliveryCheckItem(title, desc, done) {
  return `<div class="delivery-check-item ${done ? "done" : "todo"}">
    <i>${done ? "✓" : "!"}</i>
    <div><strong>${title}</strong><span>${desc}</span></div>
  </div>`;
}

function renderEvaluationItem(title, desc, done) {
  return `<div class="evaluation-item ${done ? "done" : "todo"}">
    <strong>${title}</strong>
    <span>${desc}</span>
  </div>`;
}

function deliveryPointStatus(row) {
  const gaugeConfirmed = isGaugePointConfirmed(row.point);
  const gaugeOk = gaugeConfirmed && isGaugeChoiceCorrect(row.point) && displayGaugeDiff(row) === 0;
  const levelChoice = getLevelChoice(row.point);
  const levelOk = isLevelChoiceCorrect(row.point);
  if (gaugeOk && levelOk) return { text: "合格", cls: "ok" };
  if (gaugeConfirmed || levelChoice.confirmed) return { text: "需修正", cls: "bad" };
  return { text: "待确认", cls: "pending" };
}

function renderDeliveryReviewTable() {
  return `
    <table class="data-table compact-table delivery-review-table">
      <thead>
        <tr><th>测点</th><th>轨距偏差</th><th>调整后轨距</th><th>水平偏差</th><th>调整后水平</th><th>结论</th></tr>
      </thead>
      <tbody>
        ${measureData.map((row) => {
          const levelChoice = getLevelChoice(row.point);
          const levelAfter = levelChoice.confirmed ? signedText(levelResultAfterChoice(row, levelChoice)) : "待确认";
          const status = deliveryPointStatus(row);
          return `<tr>
            <td><strong>${row.point}</strong></td>
            <td>${signedText(gaugeDiff(row))}</td>
            <td>${isGaugePointConfirmed(row.point) ? signedText(displayGaugeDiff(row)) : "待确认"}</td>
            <td>${signedText(row.level)}</td>
            <td>${levelAfter}</td>
            <td><span class="status-pill ${status.cls}">${status.text}</span></td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
}

function renderDeliveryConfigTable() {
  return `
    <table class="data-table compact-table delivery-config-table">
      <thead>
        <tr><th>测点</th><th>左股轨距件</th><th>右股轨距件</th><th>水平抬升</th><th>垫板配置</th></tr>
      </thead>
      <tbody>
        ${measureData.map((row) => {
          const left = isGaugePointConfirmed(row.point) ? gaugeConfigLabel(getGaugeChoice(row.point, "left")) : "待确认";
          const right = isGaugePointConfirmed(row.point) ? gaugeConfigLabel(getGaugeChoice(row.point, "right")) : "待确认";
          const level = getLevelChoice(row.point);
          const sideText = level.side === "left" ? "左股" : level.side === "right" ? "右股" : "待确认";
          const levelText = level.confirmed ? `${sideText} ${Math.abs(Number(level.amount) || 0)}mm` : "待确认";
          const padText = level.confirmed ? `${levelConfigLabel(level.left)} / ${levelConfigLabel(level.right)}` : "待确认";
          return `<tr>
            <td><strong>${row.point}</strong></td>
            <td>${left}</td>
            <td>${right}</td>
            <td>${levelText}</td>
            <td>${padText}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
}

function gaugeConfigLabel(choice) {
  return `${choice.outerPlate}/${choice.outerBlock}/${choice.innerBlock}/${choice.innerPlate}`;
}

function taskSheetRows() {
  const gaugeCorrectCount = measureData.filter((row) => isGaugeChoiceCorrect(row.point)).length;
  const levelCorrectCount = measureData.filter((row) => isLevelChoiceCorrect(row.point)).length;
  const passed = gaugeCorrectCount + levelCorrectCount === measureData.length * 2;
  return [
    ["作业区段", "K128+332—K128+340"],
    ["测点数量", `${measureData.length} 个`],
    ["轨距调整", `${gaugeCorrectCount}/${measureData.length} 个测点正确`],
    ["水平调整", `${levelCorrectCount}/${measureData.length} 个测点正确`],
    ["主要偏差", `最大轨距 ${gaugeLeadRow().point} ${signedText(gaugeDiff(gaugeLeadRow()))}；最大水平 ${levelLeadRow().point} ${signedText(levelLeadRow().level)}`],
    ["交付结论", passed ? "调整记录完整，复测结果合格。" : "存在未完成或未归零项，需修正后交付。"],
    ["综合得分", `${score()}分`],
  ];
}

function renderFooter() {
  prevBtn.disabled = state.step === 0;
  nextBtn.disabled = state.step === 0 && !state.taskAccepted;
  nextBtn.textContent = state.step === steps.length - 1 ? "完成交付" : state.step === 0 && !state.taskAccepted ? "先领取任务" : "进入下一步";
  actionHint.textContent = state.step === 0 && !state.taskAccepted ? "请先领取项目任务，再进入构件识别。" : steps[state.step].hint;
}

function goToStep(index) {
  state.step = Math.max(0, Math.min(steps.length - 1, index));
  render();
}

document.addEventListener("click", (event) => {
  const stepBtn = event.target.closest("[data-step]");
  if (stepBtn) {
    goToStep(Number(stepBtn.dataset.step));
    return;
  }

  const action = event.target.closest("[data-action]");
  if (action?.dataset.action === "generate-survey") {
    regenerateSurveyData();
    render();
    return;
  }
  if (action?.dataset.action === "accept-task") {
    state.taskAccepted = true;
    document.querySelector("#taskBriefModal")?.remove();
    render();
    return;
  }
  if (action?.dataset.action === "reopen-task-brief") {
    openTaskBriefModal();
    return;
  }
  if (action?.dataset.action === "close-task-brief") {
    document.querySelector("#taskBriefModal")?.remove();
    return;
  }
  if (action?.dataset.action === "fill-gauge-left") {
    fillGaugeChoice(state.activeGaugePoint, "left");
    render();
    return;
  }
  if (action?.dataset.action === "fill-gauge-right") {
    fillGaugeChoice(state.activeGaugePoint, "right");
    render();
    return;
  }
  if (action?.dataset.action === "fill-gauge-current") {
    fillGaugeChoice(state.activeGaugePoint);
    render();
    return;
  }
  if (action?.dataset.action === "fill-gauge-all") {
    measureData.forEach((row) => fillGaugeChoice(row.point));
    render();
    return;
  }
  if (action?.dataset.action === "confirm-gauge-current") {
    // 只提交学生当前选择，不再自动套用标准答案。
    commitGaugeChoice(state.activeGaugePoint);
    render();
    return;
  }
  if (action?.dataset.action === "open-gauge-strategy") {
    openGaugeStrategyModal();
    return;
  }
  if (action?.dataset.action === "close-gauge-strategy") {
    closeGaugeStrategyModal();
    return;
  }
  if (action?.dataset.action === "open-level-strategy") {
    openLevelStrategyModal();
    return;
  }
  if (action?.dataset.action === "close-level-strategy") {
    closeLevelStrategyModal();
    return;
  }
  if (action?.dataset.action === "fill-level-current") {
    fillLevelChoice(state.activeLevelPoint);
    render();
    return;
  }
  if (action?.dataset.action === "confirm-level-current") {
    confirmLevelChoice(state.activeLevelPoint);
    render();
    return;
  }
  if (action?.dataset.action === "print-sheet") {
    window.print();
    return;
  }
  if (action?.dataset.action === "toggle-explosion") {
    state.exploded = !state.exploded;
    render();
    return;
  }

  const component = event.target.closest("[data-component]");
  if (component) {
    selectComponent(component.dataset.component);
    return;
  }

  const pointRow = event.target.closest("[data-point-row]");
  if (pointRow) {
    toggleSet(state.selectedPoints, pointRow.dataset.pointRow);
    render();
    return;
  }

  const pointBtn = event.target.closest(".measure-point");
  if (pointBtn && state.step === 2) {
    toggleSet(state.selectedPoints, pointBtn.dataset.point);
    render();
    return;
  }

  const gaugePoint = event.target.closest("[data-gauge-point]");
  if (gaugePoint) {
    state.activeGaugePoint = gaugePoint.dataset.gaugePoint;
    render();
    return;
  }

  const levelPoint = event.target.closest("button[data-level-point]");
  if (levelPoint) {
    state.activeLevelPoint = levelPoint.dataset.levelPoint;
    render();
    return;
  }

  const deviation = event.target.closest("[data-deviation]");
  if (deviation) {
    toggleSet(state.selectedDeviations, deviation.dataset.deviation);
    render();
    return;
  }

  const plan = event.target.closest("[data-plan]");
  if (plan) {
    toggleSet(state.selectedPlans, plan.dataset.plan);
    render();
  }
});

prevBtn.addEventListener("click", () => goToStep(state.step - 1));
nextBtn.addEventListener("click", () => {
  if (state.step === 0 && !state.taskAccepted) {
    renderTaskBriefModal();
    return;
  }
  if (state.step === steps.length - 1) {
    renderReviewStep();
    return;
  }
  goToStep(state.step + 1);
});

function selectComponent(id) {
  if (!componentNotes[id]) return;
  state.activeComponent = id;
  if (componentNotes[id].countable) state.componentsSeen.add(id);
  render();
}

function toggleSet(set, value) {
  if (set.has(value)) set.delete(value);
  else set.add(value);
}

window.addEventListener("demo:model-component-picked", (event) => {
  const id = event.detail?.id;
  if (!id || !componentNotes[id]) return;
  selectComponent(id);
});

document.addEventListener("change", (event) => {
  const gaugeField = event.target.closest("[data-gauge-field]");
  if (gaugeField) {
    setPendingGaugeChoice(
      gaugeField.dataset.gaugePoint || state.activeGaugePoint,
      gaugeField.dataset.gaugeRail || "right",
      gaugeField.dataset.gaugeField,
      gaugeField.value,
    );
    return;
  }
  const levelField = event.target.closest("[data-level-field]");
  if (levelField) {
    const point = levelField.dataset.levelPoint || state.activeLevelPoint;
    state.activeLevelPoint = point;
    setLevelChoice(point, levelField.dataset.levelField, levelField.value, levelField.dataset.levelSide || null);
    render();
  }
});

render();
