/*
  Experiment 3: Ultimatum game proposer split choice and chart presentation choice.
  DataPipe conditions are ordered so each color x position block cycles through all
  six chart-order permutations before moving to the next block.
*/

const DATAPIPE_EXPERIMENT_ID = "INKIpFHs456J";
const PROLIFIC_COMPLETION_CODE = "REPLACE_WITH_PROLIFIC_COMPLETION_CODE";
const BASE_PAYMENT_USD = 1.00;
const BONUS_DRAW_PERCENT = 10;
const RADIUS_MANIPULATION_RATIO = 1.3;
const STUDY_TITLE = "Decision-Making Study";
document.title = STUDY_TITLE;

const ORANGE = "#f28e2b";
const BLUE = "#6ea8ff";

const jsPsych = initJsPsych({
  use_webaudio: false,
  on_finish: function () {
    console.log("Final jsPsych data CSV:", getFilteredDataCsv());
  }
});

const experimentStartPerf = performance.now();
let fullscreenAbortArmed = false;
let plannedFullscreenExit = false;
let comprehensionAttempts = 0;
let comprehensionPassed = false;
let excludedForComprehension = false;
let dataSavedToDatapipe = false;
let assignedConditionInfo = null;
let selectedSplit = null;
let selectedChartInfo = null;

function currentFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || null;
}

const prolific_pid = jsPsych.data.getURLVariable("PROLIFIC_PID") || "missing";
const study_id = jsPsych.data.getURLVariable("STUDY_ID") || "missing";
const session_id = jsPsych.data.getURLVariable("SESSION_ID") || jsPsych.randomization.randomID(12);
const subject_id = prolific_pid !== "missing" ? prolific_pid : jsPsych.randomization.randomID(10);
const data_filename = `${subject_id}_${session_id}_${Date.now()}_ultimatum_exp3.csv`;
const preview_mode = jsPsych.data.getURLVariable("preview") === "1" || prolific_pid === "missing";
const studyLockKey = `ultimatum_exp3_status_${prolific_pid}_${study_id}`;

function desktopCheck() {
  const ua = navigator.userAgent || "";
  const mobileLike = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const smallWindow = window.innerWidth < 900 || window.innerHeight < 600;
  return {
    pass: !mobileLike && !smallWindow,
    mobileLike,
    smallWindow,
    windowInnerWidth: window.innerWidth,
    windowInnerHeight: window.innerHeight
  };
}

const device = desktopCheck();

const splitOptions = [
  { split_id: "proposer90_receiver10", proposer: 90, receiver: 10, label: "You get 90 cents; receiver gets 10 cents" },
  { split_id: "proposer80_receiver20", proposer: 80, receiver: 20, label: "You get 80 cents; receiver gets 20 cents" },
  { split_id: "proposer70_receiver30", proposer: 70, receiver: 30, label: "You get 70 cents; receiver gets 30 cents" },
  { split_id: "proposer60_receiver40", proposer: 60, receiver: 40, label: "You get 60 cents; receiver gets 40 cents" }
];

const randomizedSplitOptions = jsPsych.randomization.shuffle(splitOptions.slice());

jsPsych.data.addProperties({
  Subject: subject_id,
  prolific_pid: prolific_pid,
  study_id: study_id,
  session_id: session_id,
  data_filename: data_filename,
  datapipe_experiment_id: DATAPIPE_EXPERIMENT_ID,
  screen_width: window.screen.width,
  screen_height: window.screen.height,
  device_check_pass: device.pass ? 1 : 0,
  device_mobile_like: device.mobileLike ? 1 : 0,
  device_small_window: device.smallWindow ? 1 : 0,
  timezone_offset_minutes: new Date().getTimezoneOffset(),
  split_option_order: randomizedSplitOptions.map(option => option.split_id).join("|"),
  split_option_order_labels: randomizedSplitOptions.map(option => option.label).join("|")
});

function shellHtml(innerHtml, topTitle = STUDY_TITLE, extraClass = "") {
  return `
    <div class="study-shell ${extraClass}">
      <div class="qualtrics-topbar">${topTitle}</div>
      <div class="qualtrics-card">${innerHtml}</div>
    </div>
  `;
}

function getStoredStudyStatus() {
  if (preview_mode) {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(studyLockKey);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    return null;
  }
}

function setStoredStudyStatus(status) {
  if (preview_mode) {
    return;
  }
  try {
    window.localStorage.setItem(studyLockKey, JSON.stringify({
      status: status,
      timestamp: Date.now(),
      prolific_pid: prolific_pid,
      study_id: study_id
    }));
  } catch (error) {
    // Continue without browser-side locking if localStorage is unavailable.
  }
}

function lockedStatusTrial(statusRecord) {
  const status = statusRecord && statusRecord.status;
  const completed = status === "completed";
  const message = completed
    ? "Your response has already been saved."
    : "You are not eligible to continue this study.";
  const detail = completed
    ? "Thank you for completing this study."
    : "Please return this study on Prolific. Do not submit a completion code.";
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: shellHtml(`
      <h2 class="intro-title">${completed ? "Your response has been saved." : "The study has ended."}</h2>
      <p class="${completed ? "" : "warning"}">${message}</p>
      <p>${detail}</p>
      ${completed && isCompletionCodeConfigured()
        ? `<p>Click the button below to return to Prolific.</p>`
        : ""}
    `, STUDY_TITLE, completed ? "" : "abort-shell"),
    choices: [completed && isCompletionCodeConfigured() ? "Return to Prolific" : "Exit"],
    data: { phase: "locked_status", locked_status: status || "unknown" },
    on_finish: function () {
      if (completed && isCompletionCodeConfigured()) {
        window.location.href = `https://app.prolific.com/submissions/complete?cc=${PROLIFIC_COMPLETION_CODE}`;
      }
    }
  };
}

function handleFullscreenChange() {
  if (fullscreenAbortArmed && !plannedFullscreenExit && !currentFullscreenElement()) {
    const storedStatus = getStoredStudyStatus();
    if (storedStatus && storedStatus.status === "completed") {
      fullscreenAbortArmed = false;
      if (isCompletionCodeConfigured()) {
        window.location.href = `https://app.prolific.com/submissions/complete?cc=${PROLIFIC_COMPLETION_CODE}`;
      } else {
        jsPsych.endExperiment(lockedStatusTrial(storedStatus).stimulus);
      }
      return;
    }
    setStoredStudyStatus("fullscreen_exit");
    fullscreenAbortArmed = false;
    jsPsych.data.addProperties({
      fullscreen_exit_abort: 1,
      fullscreen_exit_abort_time_ms: Math.round(performance.now() - experimentStartPerf)
    });
    jsPsych.endExperiment(shellHtml(`
      <h2 class="intro-title">The study has ended.</h2>
      <p class="warning">You exited fullscreen mode during the study.</p>
      <p>Please return this study on Prolific. Do not submit a completion code.</p>
    `, STUDY_TITLE, "abort-shell"));
  }
}

document.addEventListener("fullscreenchange", handleFullscreenChange);
document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
document.addEventListener("mozfullscreenchange", handleFullscreenChange);
document.addEventListener("MSFullscreenChange", handleFullscreenChange);

const chartTypes = [
  { chart_type: "equal_radius", proposer_radius_multiplier: 1, receiver_radius_multiplier: 1 },
  { chart_type: "proposer_larger", proposer_radius_multiplier: RADIUS_MANIPULATION_RATIO, receiver_radius_multiplier: 1 },
  { chart_type: "receiver_larger", proposer_radius_multiplier: 1, receiver_radius_multiplier: RADIUS_MANIPULATION_RATIO }
];

const chartTypeById = chartTypes.reduce(function (lookup, chartType) {
  lookup[chartType.chart_type] = chartType;
  return lookup;
}, {});

const chartOrderPermutations = [
  ["equal_radius", "proposer_larger", "receiver_larger"],
  ["equal_radius", "receiver_larger", "proposer_larger"],
  ["proposer_larger", "equal_radius", "receiver_larger"],
  ["proposer_larger", "receiver_larger", "equal_radius"],
  ["receiver_larger", "equal_radius", "proposer_larger"],
  ["receiver_larger", "proposer_larger", "equal_radius"]
];

const positionConditions = [
  { position_condition: "proposer_left", center_angle_degrees: 270 },
  { position_condition: "proposer_right", center_angle_degrees: 90 }
];

const colorConditions = [
  { color_balance: "proposer_orange_receiver_blue", proposer_color: ORANGE, receiver_color: BLUE },
  { color_balance: "proposer_blue_receiver_orange", proposer_color: BLUE, receiver_color: ORANGE }
];

function buildConditionTable() {
  const rows = [];
  colorConditions.forEach(function (color) {
    positionConditions.forEach(function (position) {
      chartOrderPermutations.forEach(function (chartOrder, orderIndex) {
        rows.push({
          condition_index: rows.length,
          condition_label: `${color.color_balance}_${position.position_condition}_chart_order_${orderIndex + 1}`,
          chart_order_index: orderIndex + 1,
          chart_order: chartOrder.join("|"),
          ...color,
          ...position
        });
      });
    });
  });
  return rows;
}

const conditionTable = buildConditionTable();

function isDatapipeConfigured() {
  return DATAPIPE_EXPERIMENT_ID && !DATAPIPE_EXPERIMENT_ID.includes("REPLACE_WITH");
}

function isCompletionCodeConfigured() {
  return PROLIFIC_COMPLETION_CODE && !PROLIFIC_COMPLETION_CODE.includes("REPLACE_WITH");
}

async function getDatapipeCondition() {
  if (!isDatapipeConfigured()) {
    return {
      conditionNumber: Math.floor(Math.random() * conditionTable.length),
      source: "fallback_datapipe_not_configured"
    };
  }

  try {
    const condition = await jsPsychPipe.getCondition(DATAPIPE_EXPERIMENT_ID);
    const conditionNumber = Number(condition);
    if (Number.isInteger(conditionNumber) && conditionNumber >= 0 && conditionNumber < conditionTable.length) {
      return { conditionNumber, source: "datapipe" };
    }
    return {
      conditionNumber: Math.floor(Math.random() * conditionTable.length),
      source: "fallback_invalid_datapipe_condition"
    };
  } catch (error) {
    console.warn("DataPipe condition assignment failed. Falling back to random condition.", error);
    return {
      conditionNumber: Math.floor(Math.random() * conditionTable.length),
      source: "fallback_datapipe_error"
    };
  }
}

function getAssignedConditionInfo() {
  if (!assignedConditionInfo) {
    throw new Error("Condition has not been assigned yet.");
  }
  return assignedConditionInfo;
}

function assignCondition(conditionNumber, source) {
  assignedConditionInfo = conditionTable[conditionNumber];
  jsPsych.data.addProperties({
    datapipe_condition_source: source,
    condition_index: assignedConditionInfo.condition_index,
    condition_label: assignedConditionInfo.condition_label,
    chart_order_index: assignedConditionInfo.chart_order_index,
    chart_order: assignedConditionInfo.chart_order,
    color_balance: assignedConditionInfo.color_balance,
    proposer_color: assignedConditionInfo.proposer_color,
    receiver_color: assignedConditionInfo.receiver_color,
    position_condition: assignedConditionInfo.position_condition,
    center_angle_degrees: assignedConditionInfo.center_angle_degrees
  });
  return assignedConditionInfo;
}

function conditionAssignmentTrial() {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `<div class="study-shell"><div class="qualtrics-card standalone saving-card"><h2>Loading study...</h2><p>Please do not close this page.</p></div></div>`,
    choices: "NO_KEYS",
    data: { phase: "condition_assignment" },
    on_load: async function () {
      const assignmentStart = performance.now();
      const { conditionNumber, source } = await getDatapipeCondition();
      const conditionInfo = assignCondition(conditionNumber, source);
      jsPsych.finishTrial({
        datapipe_condition_source: source,
        condition_index: conditionInfo.condition_index,
        condition_label: conditionInfo.condition_label,
        chart_order_index: conditionInfo.chart_order_index,
        chart_order: conditionInfo.chart_order,
        color_balance: conditionInfo.color_balance,
        position_condition: conditionInfo.position_condition,
        condition_assignment_rt: Math.round(performance.now() - assignmentStart)
      });
    }
  };
}

function polarToCartesian(cx, cy, radius, angleDegrees) {
  const angleRadians = (angleDegrees - 90) * Math.PI / 180.0;
  return {
    x: cx + radius * Math.cos(angleRadians),
    y: cy + radius * Math.sin(angleRadians)
  };
}

function sectorPath(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M", cx, cy,
    "L", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
    "Z"
  ].join(" ");
}

function angleWithinArc(angle, startAngle, endAngle) {
  const span = endAngle - startAngle;
  for (let shift = -720; shift <= 720; shift += 360) {
    const candidate = angle + shift;
    if (candidate >= startAngle && candidate <= startAngle + span) {
      return true;
    }
  }
  return false;
}

function sectorBounds(cx, cy, radius, startAngle, endAngle) {
  const points = [
    { x: cx, y: cy },
    polarToCartesian(cx, cy, radius, startAngle),
    polarToCartesian(cx, cy, radius, endAngle)
  ];
  [0, 90, 180, 270].forEach(function (angle) {
    if (angleWithinArc(angle, startAngle, endAngle)) {
      points.push(polarToCartesian(cx, cy, radius, angle));
    }
  });
  return points.reduce(function (bounds, point) {
    return {
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y)
    };
  }, { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
}

function mergeBounds(first, second) {
  return {
    minX: Math.min(first.minX, second.minX),
    maxX: Math.max(first.maxX, second.maxX),
    minY: Math.min(first.minY, second.minY),
    maxY: Math.max(first.maxY, second.maxY)
  };
}

function calloutTextHtml(x, y, label, amount, anchor = "middle") {
  const lineGap = 40;
  return `
    <g class="callout-group">
      <text class="callout-text" x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="hanging">
        <tspan class="callout-person" x="${x}" y="${y}">${label}</tspan>
        <tspan class="callout-amount" x="${x}" y="${y + lineGap}">${amount} cents</tspan>
      </text>
    </g>
  `;
}

function roseChartHtml(condition, options = {}) {
  const compact = options.compact === true;
  const viewBoxWidth = compact ? 900 : 780;
  const cx = viewBoxWidth / 2;
  const baseCy = compact ? 250 : 382;
  const baseRadius = compact ? 118 : 124;
  const calloutCenterGap = compact ? 170 : 70;
  const lineGap = 40;
  const amountTextHeight = 25;
  const viewBoxHeight = compact ? 500 : 700;
  const formalGroupCenterY = viewBoxHeight / 2;
  const proposerRadius = baseRadius * condition.proposer_radius_multiplier;
  const receiverRadius = baseRadius * condition.receiver_radius_multiplier;
  let cy = baseCy;
  const proposerAngle = condition.proposer / 100 * 360;
  const receiverAngle = 360 - proposerAngle;
  const proposerStart = condition.center_angle_degrees - proposerAngle / 2;
  const proposerEnd = condition.center_angle_degrees + proposerAngle / 2;
  const receiverStart = proposerEnd;
  const receiverEnd = proposerEnd + receiverAngle;
  const shapeBounds = mergeBounds(
    sectorBounds(0, 0, receiverRadius, receiverStart, receiverEnd),
    sectorBounds(0, 0, proposerRadius, proposerStart, proposerEnd)
  );

  const labelTop = -24;
  const labelBottom = labelTop + lineGap + amountTextHeight;
  const groupTop = Math.min(shapeBounds.minY, labelTop);
  const groupBottom = Math.max(shapeBounds.maxY, labelBottom);
  if (!compact) {
    cy = formalGroupCenterY - (groupTop + groupBottom) / 2;
  }

  const left = condition.position_condition === "proposer_left"
    ? { label: "Proposer", amount: condition.proposer }
    : { label: "Receiver", amount: condition.receiver };
  const right = condition.position_condition === "proposer_left"
    ? { label: "Receiver", amount: condition.receiver }
    : { label: "Proposer", amount: condition.proposer };
  const sideY = cy - 24;
  const chartLeftEdgeX = cx + shapeBounds.minX;
  const chartRightEdgeX = cx + shapeBounds.maxX;
  const leftCalloutCenterX = chartLeftEdgeX - calloutCenterGap;
  const rightCalloutCenterX = chartRightEdgeX + calloutCenterGap;
  const labelHtml = `
    ${calloutTextHtml(leftCalloutCenterX, sideY, left.label, left.amount)}
    ${calloutTextHtml(rightCalloutCenterX, sideY, right.label, right.amount)}
  `;

  return `
    <svg class="rose-chart" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" role="img" aria-label="Pie chart showing the proposed allocation">
      <path class="sector" d="${sectorPath(cx, cy, receiverRadius, receiverStart, receiverEnd)}" fill="${condition.receiver_color}"></path>
      <path class="sector" d="${sectorPath(cx, cy, proposerRadius, proposerStart, proposerEnd)}" fill="${condition.proposer_color}"></path>
      ${labelHtml}
    </svg>
  `;
}

function exampleRoseChartHtml(condition, proposer = 50, receiver = 50) {
  return roseChartHtml({
    proposer: proposer,
    receiver: receiver,
    proposer_radius_multiplier: 1,
    receiver_radius_multiplier: 1,
    position_condition: condition.position_condition,
    center_angle_degrees: condition.center_angle_degrees,
    proposer_color: condition.proposer_color,
    receiver_color: condition.receiver_color
  }, { compact: true });
}

function collectFormData(form) {
  const formData = new FormData(form);
  const response = {};
  formData.forEach(function (value, key) {
    response[key] = value;
  });
  return response;
}

function getFilteredDataCsv() {
  const fieldsToRemove = new Set([
    "platform",
    "experiment_name",
    "base_payment_usd",
    "bonus_draw_percent",
    "user_agent",
    "center_angle_degrees",
    "datapipe_condition_source",
    "proposer_color",
    "receiver_color",
    "comprehension_passed",
    "comprehension_response_json",
    "stimulus",
    "rt"
  ]);
  const totalRt = Math.round(performance.now() - experimentStartPerf);
  const rows = jsPsych.data.get().values().map(function (row) {
    const filtered = {};
    Object.keys(row).forEach(function (key) {
      if (!fieldsToRemove.has(key)) {
        filtered[key] = row[key];
      }
    });
    filtered.total_rt = totalRt;
    return filtered;
  });
  const columns = Array.from(rows.reduce(function (set, row) {
    Object.keys(row).forEach(key => set.add(key));
    return set;
  }, new Set()));
  const escapeCsv = function (value) {
    if (value === undefined || value === null) {
      return "";
    }
    const text = String(value);
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  return [
    columns.map(escapeCsv).join(","),
    ...rows.map(row => columns.map(column => escapeCsv(row[column])).join(","))
  ].join("\n");
}

function desktopGateTrial() {
  const smallWindowOnly = device.smallWindow && !device.mobileLike;
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: shellHtml(`
      <h2 class="intro-title">${smallWindowOnly ? "Browser window too small" : "Desktop or laptop required"}</h2>
      <p class="warning">${smallWindowOnly
        ? "Please maximize your browser window and refresh the page to continue."
        : "This study must be completed on a desktop or laptop computer with a sufficiently large browser window."}</p>
      ${smallWindowOnly ? "" : "<p>Please return the study on Prolific and do not continue on this device.</p>"}
      <p class="muted">Detected window size: ${window.innerWidth} x ${window.innerHeight}</p>
    `),
    choices: [smallWindowOnly ? "Refresh after maximizing" : "Exit"],
    data: { phase: "device_block" },
    on_finish: function () {
      if (smallWindowOnly) {
        window.location.reload();
      }
    }
  };
}

function humanVerificationTrial(imagePath) {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
      <form id="human-verification-form" class="human-verification-form" novalidate>
        <div class="verification-question">Do the two straight lines below have the same length?</div>
        <img class="verification-image" src="${imagePath}" alt="Two horizontal lines with arrowheads for a visual verification question.">
        <div class="verification-options" role="radiogroup" aria-label="Human verification">
          <label class="single-choice-option">
            <input type="radio" name="human_verification_response" value="yes">
            <span>Yes</span>
          </label>
          <label class="single-choice-option">
            <input type="radio" name="human_verification_response" value="no">
            <span>No</span>
          </label>
        </div>
      </form>
    `,
    choices: "NO_KEYS",
    data: { phase: "human_verification" },
    on_load: function () {
      const pageStart = performance.now();
      const form = document.getElementById("human-verification-form");
      let answered = false;
      Array.from(form.querySelectorAll('input[name="human_verification_response"]')).forEach(function (input) {
        input.addEventListener("change", function () {
          if (answered) {
            return;
          }
          answered = true;
          const response = input.value;
          const rt = Math.round(performance.now() - pageStart);
          Array.from(form.querySelectorAll('input[name="human_verification_response"]')).forEach(option => option.disabled = true);
          setTimeout(function () {
            if (response === "yes") {
              setStoredStudyStatus("failed_verification");
              jsPsych.data.addProperties({
                human_verification_response: response,
                human_verification_passed: 0,
                human_verification_rt: rt
              });
              window.alert("You did not pass the verification check and therefore cannot participate in this study.");
              jsPsych.endExperiment(shellHtml(`
                <h2 class="intro-title">The study has ended.</h2>
                <p class="warning">You did not pass the verification check and therefore cannot participate in this study.</p>
                <p>Please return this study on Prolific. Do not submit a completion code.</p>
              `, STUDY_TITLE, "abort-shell"));
              return;
            }
            jsPsych.finishTrial({
              human_verification_response: response,
              human_verification_passed: 1,
              human_verification_rt: rt
            });
          }, 450);
        });
      });
    }
  };
}

function instructionFlowImagePath(conditionInfo) {
  return conditionInfo.color_balance === "proposer_blue_receiver_orange"
    ? "instruction-flow_proposerblue.png"
    : "instruction-flow_proposerorange.png";
}

function instructionTrial() {
  const renderHtml = function () {
    const conditionInfo = getAssignedConditionInfo();
    const imagePath = instructionFlowImagePath(conditionInfo);
    return shellHtml(`
      <h2 class="intro-title">Instructions</h2>
      <p>In this study, you will complete a short economic decision-making task. Please read the instructions carefully. Your decisions may affect bonus payments for you and another participant. You will receive a base payment of <span class="doc-red">$${BASE_PAYMENT_USD.toFixed(2)}</span> for completing the study carefully.</p>
      <p>There are two roles in this task: <span class="doc-red">proposer</span> and <span class="doc-red">receiver</span>. The proposer decides how to divide <span class="doc-red">100 cents</span> between themself and a receiver. The receiver then decides whether to accept or reject the proposal.</p>
      <div class="instruction-flow-wrap">
        <img class="instruction-flow-image" src="${imagePath}" alt="Diagram showing the proposer decision, receiver decision, and possible outcomes.">
      </div>
      <p>You have been assigned to the role of <span class="doc-red">PROPOSER</span>.</p>
      <p>You will make a decision by choosing one allocation of <span class="doc-red">100 cents</span> to send to the receiver.</p>
      <ul>
        <li>If the receiver <span class="doc-red">accepts</span> your proposal, you and the receiver receive the proposed amounts.</li>
        <li>If the receiver <span class="doc-red">rejects</span> your proposal, both you and the receiver receive 0 cents from the proposal.</li>
      </ul>
      <p>You and the receiver will not know any personal information about each other.</p>
      <p>After data collection is complete, <span class="doc-red">${BONUS_DRAW_PERCENT}%</span> of receivers will be randomly selected for real bonus payment. If a receiver is selected, your decision may be paired with that receiver's response, and the outcome will determine the bonus for you and the receiver. The bonus will be paid as a Prolific bonus. Bonus payments will be processed within two months after data collection is complete.</p>
      <p>Therefore, please consider your choice carefully, because your decision may affect a real bonus for both you and another participant.</p>
    `, STUDY_TITLE, "instruction-shell");
  };

  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: renderHtml,
    choices: ["Continue"],
    data: { phase: "instructions" }
  };
}

function buildComprehensionQuestions() {
  return [
    {
      name: "role",
      text: "1. Which statement is correct about this study?",
      options: [
        { value: "receiver_real_proposal", label: "You will be the receiver and decide whether to accept or reject a real proposal." },
        { value: "evaluation_only", label: "You will only answer evaluation questions; your decisions will not affect payment." },
        { value: "proposer_real_split", label: "You will be the proposer, choose one split of 100 cents, and your decision may be used to determine bonus payments for you and another participant." },
        { value: "proposer_not_real", label: "You will be the proposer, but your choice is not real and will not be recorded." }
      ],
      correct: "proposer_real_split"
    },
    {
      name: "accept",
      text: "2. Suppose this proposal is selected for bonus payment: you give yourself 50 cents and gives the receiver 50 cents. What happens if the receiver accepts it?",
      options: [
        { value: "shown_amounts", label: "You receive 50 cents and the receiver receives 50 cents." },
        { value: "both_zero", label: "Both participants receive 0 cents." },
        { value: "you_all", label: "You receive all 100 cents." }
      ],
      correct: "shown_amounts"
    },
    {
      name: "reject",
      text: "3. Suppose this proposal is selected for bonus payment: you give yourself 50 cents and gives the receiver 50 cents. What happens if the receiver rejects it?",
      options: [
        { value: "shown_amounts", label: "You receive 50 cents and the receiver receives 50 cents." },
        { value: "both_zero", label: "Both participants receive 0 cents." },
        { value: "receiver_all", label: "The receiver receives all 100 cents." }
      ],
      correct: "both_zero"
    },
    {
      name: "bonus",
      text: "4. How are bonus outcomes determined?",
      options: [
        { value: "ten_percent_receivers_real", label: "10% of receivers are randomly selected. If selected, you and the receiver will both be paid according to the outcome of your decisions." },
        { value: "everyone_bonus", label: "All the participants involving both receivers and proposer will be paid bonus." },
        { value: "hypothetical_only", label: "The game is hypothetical and no bonuses can be paid." }
      ],
      correct: "ten_percent_receivers_real"
    },
    {
      name: "total",
      text: "5. How much money is divided in the proposal?",
      options: [
        { value: "100_cents", label: "100 cents" },
        { value: "10_dollars", label: "10 dollars" },
        { value: "unknown", label: "The amount is not specified" }
      ],
      correct: "100_cents"
    }
  ];
}

function comprehensionTrial() {
  let questions = [];
  const renderHtml = function () {
    questions = buildComprehensionQuestions();
    return shellHtml(`
      <form id="comprehension-form" novalidate>
        <h2 class="intro-title">Comprehension Check</h2>
        <p class="muted">Please answer the following questions to make sure you understand the rules.</p>
        ${questions.map(function (q) {
          return `
            <div class="form-question">
              <div class="question-text">${q.text}</div>
              ${q.exampleHtml || ""}
              <div class="single-choice-list" role="radiogroup" aria-label="${q.name}">
                ${q.options.map(function (o) {
                  return `
                    <label class="single-choice-option">
                      <input type="radio" name="${q.name}" value="${o.value}">
                      <span>${o.label}</span>
                    </label>
                  `;
                }).join("")}
              </div>
              <div class="question-required" data-required-for="${q.name}">Please answer this question.</div>
            </div>
          `;
        }).join("")}
        <button type="submit" class="form-submit">Submit</button>
        <div id="comprehension-required" class="required-note">Please answer all questions before continuing.</div>
      </form>
    `);
  };

  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: renderHtml,
    choices: "NO_KEYS",
    data: { phase: "comprehension_check" },
    on_load: function () {
      const pageStart = performance.now();
      const form = document.getElementById("comprehension-form");
      const warning = document.getElementById("comprehension-required");
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        const response = collectFormData(form);
        Array.from(form.querySelectorAll(".question-required")).forEach(function (message) {
          message.style.display = "none";
        });
        const unanswered = questions
          .filter(q => !response[q.name])
          .map(q => q.name);
        if (unanswered.length > 0) {
          unanswered.forEach(function (name) {
            const message = form.querySelector(`[data-required-for="${name}"]`);
            if (message) {
              message.style.display = "block";
            }
          });
          warning.textContent = unanswered.length === 1
            ? "Please answer this question before continuing."
            : "Please answer all questions before continuing.";
          warning.style.display = "block";
          return;
        }
        comprehensionAttempts += 1;
        warning.style.display = "none";
        const incorrect = questions
          .filter(q => response[q.name] !== q.correct)
          .map(q => q.name);
        comprehensionPassed = incorrect.length === 0;
        excludedForComprehension = !comprehensionPassed && comprehensionAttempts >= 2;
        if (excludedForComprehension) {
          setStoredStudyStatus("excluded_comprehension");
        }
        jsPsych.finishTrial({
          comprehension_attempt: comprehensionAttempts,
          comprehension_passed: comprehensionPassed ? 1 : 0,
          comprehension_incorrect_items: incorrect.join("|"),
          comprehension_response_json: JSON.stringify(response),
          comprehension_rt: Math.round(performance.now() - pageStart)
        });
      });
    }
  };
}

function warningTrial() {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: shellHtml(`
      <h2 class="intro-title">Incorrect response.</h2>
      <p class="warning">Please reread the instructions carefully.</p>
    `),
    choices: "NO_KEYS",
    trial_duration: 3000,
    data: { phase: "comprehension_warning" }
  };
}

function exclusionTrial() {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: shellHtml(`
      <h2 class="intro-title">The study has ended.</h2>
      <p class="warning">Based on your comprehension-check responses, you are not eligible to continue this study.</p>
      <p>Please return this study on Prolific. Do not submit a completion code.</p>
    `, STUDY_TITLE, "abort-shell"),
    choices: ["Exit"],
    data: { phase: "comprehension_exclusion" },
    on_finish: function () {
      plannedFullscreenExit = true;
      fullscreenAbortArmed = false;
      if (currentFullscreenElement() && document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };
}

function stageMessageTrial() {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
      <div class="stage-message">
        <h2>Decision Stage</h2>
        <p>You will now make your actual decisions as the proposer. Please consider carefully.</p>
        <button id="stage-continue-button" class="primary-btn" type="button">Continue</button>
      </div>
    `,
    choices: "NO_KEYS",
    data: { phase: "decision_stage_intro" },
    on_load: function () {
      document.getElementById("stage-continue-button").addEventListener("click", function () {
        jsPsych.finishTrial();
      });
    }
  };
}

function splitChoiceButtonContent(label, selected = false) {
  const marker = selected
    ? `<span class="decision-check" aria-hidden="true">&#10003;</span>`
    : `<span class="split-choice-dot" aria-hidden="true"></span>`;
  return `${marker}<span class="split-choice-label">${label}</span>`;
}

function splitDecisionTrial() {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: shellHtml(`
      <div class="stimulus-content exp3-split-content">
        <div class="offer-title">Decision : Choose one proposal.</div>
        <div class="offer-subtitle">
          This is your <span class="doc-red">actual decision</span> for this proposal. Please choose one proposal from the four options to send to the receiver.
          You can submit this decision <span class="doc-red">only once</span>. Please consider the proposal carefully before confirming your choice.
        </div>
        <div class="split-option-list">
          ${randomizedSplitOptions.map(function (option) {
            return `
              <button class="decision-button split-decision-button" type="button" data-split-id="${option.split_id}" data-label="${option.label}">
                ${splitChoiceButtonContent(option.label)}
              </button>
            `;
          }).join("")}
        </div>
        <div id="decision-confirm-panel" class="decision-confirm-panel" hidden>
          <div id="selected-choice-text" class="selected-choice-text"></div>
          <div class="confirm-choice-wrap">
            <div class="confirm-tooltip">Once confirmed, your decision cannot be changed.</div>
            <button id="confirm-choice-button" class="confirm-choice-button" type="button">Confirm choice</button>
          </div>
        </div>
      </div>
    `, "Decision Stage", "stimulus-shell"),
    choices: "NO_KEYS",
    data: {
      phase: "proposal_split_decision",
      split_option_order: randomizedSplitOptions.map(option => option.split_id).join("|"),
      split_option_order_labels: randomizedSplitOptions.map(option => option.label).join("|")
    },
    on_load: function () {
      const pageStart = performance.now();
      const buttons = Array.from(document.querySelectorAll(".split-decision-button"));
      const confirmPanel = document.getElementById("decision-confirm-panel");
      const selectedText = document.getElementById("selected-choice-text");
      const confirmButton = document.getElementById("confirm-choice-button");
      const choiceHistory = [];
      let currentSplitId = null;
      let firstSplitId = null;
      let choiceChangedCount = 0;

      buttons.forEach(function (button) {
        button.addEventListener("click", function () {
          const clickRt = Math.round(performance.now() - pageStart);
          const splitId = button.getAttribute("data-split-id");
          const label = button.getAttribute("data-label");
          if (!firstSplitId) {
            firstSplitId = splitId;
          } else if (splitId !== currentSplitId) {
            choiceChangedCount += 1;
          }
          currentSplitId = splitId;
          choiceHistory.push({ split_id: splitId, rt: clickRt });
          buttons.forEach(function (b) {
            b.classList.remove("selected");
            b.innerHTML = splitChoiceButtonContent(b.getAttribute("data-label"));
          });
          button.classList.add("selected");
          button.innerHTML = splitChoiceButtonContent(label, true);
          selectedText.innerHTML = `You selected: <strong>${label}</strong>.`;
          confirmPanel.hidden = false;
          confirmPanel.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
      });

      confirmButton.addEventListener("click", function () {
        if (!currentSplitId) {
          return;
        }
        selectedSplit = splitOptions.find(option => option.split_id === currentSplitId);
        buttons.forEach(b => b.disabled = true);
        confirmButton.disabled = true;
        jsPsych.finishTrial({
          chosen_split_id: selectedSplit.split_id,
          chosen_split_label: selectedSplit.label,
          proposer_cents: selectedSplit.proposer,
          receiver_cents: selectedSplit.receiver,
          first_split_choice: firstSplitId,
          split_choice_changed_count: choiceChangedCount,
          split_choice_history_json: JSON.stringify(choiceHistory),
          split_decision_rt: Math.round(performance.now() - pageStart)
        });
      });
    }
  };
}

function chartOptionCondition(baseCondition, split, chartType) {
  return {
    proposer: split.proposer,
    receiver: split.receiver,
    proposer_radius_multiplier: chartType.proposer_radius_multiplier,
    receiver_radius_multiplier: chartType.receiver_radius_multiplier,
    position_condition: baseCondition.position_condition,
    center_angle_degrees: baseCondition.center_angle_degrees,
    proposer_color: baseCondition.proposer_color,
    receiver_color: baseCondition.receiver_color
  };
}

function chartDecisionTrial() {
  const renderHtml = function () {
    const condition = getAssignedConditionInfo();
    const split = selectedSplit || splitOptions[0];
    const order = condition.chart_order.split("|");
    const chartLetters = ["A", "B", "C"];
    return shellHtml(`
      <div class="stimulus-content exp3-chart-content">
        <div class="offer-title">Decision : Choose one way of presenting the allocation.</div>
        <div class="offer-subtitle">
          Now please <span class="doc-red">choose one way of presenting the allocation to the receiver</span>.
          The receiver will see the selected presentation with the numerical amounts shown.
          You can submit this decision <span class="doc-red">only once</span>.
        </div>
        <div class="selected-split-summary">Selected proposal: ${split.label}</div>
        <div class="chart-choice-grid">
          ${order.map(function (chartTypeId, index) {
            const chartType = chartTypeById[chartTypeId];
            const chartLabel = chartLetters[index];
            const displayCondition = chartOptionCondition(condition, split, chartType);
            return `
              <button class="chart-choice-button" type="button" data-chart-label="${chartLabel}" data-chart-type="${chartTypeId}">
                <div class="chart-option-visual">${roseChartHtml(displayCondition, { compact: true })}</div>
                <div class="chart-option-label">Option ${chartLabel}</div>
              </button>
            `;
          }).join("")}
        </div>
        <div id="decision-confirm-panel" class="decision-confirm-panel" hidden>
          <div id="selected-choice-text" class="selected-choice-text"></div>
          <div class="confirm-choice-wrap">
            <div class="confirm-tooltip">Once confirmed, your decision cannot be changed.</div>
            <button id="confirm-choice-button" class="confirm-choice-button" type="button">Confirm choice</button>
          </div>
        </div>
      </div>
    `, "Decision Stage", "stimulus-shell exp3-wide-shell");
  };

  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: renderHtml,
    choices: "NO_KEYS",
    data: { phase: "chart_presentation_decision" },
    on_start: function (trial) {
      const condition = getAssignedConditionInfo();
      trial.data = {
        ...trial.data,
        chosen_split_id: selectedSplit ? selectedSplit.split_id : "",
        proposer_cents: selectedSplit ? selectedSplit.proposer : "",
        receiver_cents: selectedSplit ? selectedSplit.receiver : "",
        chart_order_index: condition.chart_order_index,
        chart_order: condition.chart_order,
        color_balance: condition.color_balance,
        position_condition: condition.position_condition
      };
    },
    on_load: function () {
      const pageStart = performance.now();
      const buttons = Array.from(document.querySelectorAll(".chart-choice-button"));
      const confirmPanel = document.getElementById("decision-confirm-panel");
      const selectedText = document.getElementById("selected-choice-text");
      const confirmButton = document.getElementById("confirm-choice-button");
      const choiceHistory = [];
      let currentChartLabel = null;
      let currentChartType = null;
      let firstChartType = null;
      let chartChoiceChangedCount = 0;

      buttons.forEach(function (button) {
        button.addEventListener("click", function () {
          const clickRt = Math.round(performance.now() - pageStart);
          const chartLabel = button.getAttribute("data-chart-label");
          const chartType = button.getAttribute("data-chart-type");
          if (!firstChartType) {
            firstChartType = chartType;
          } else if (chartType !== currentChartType) {
            chartChoiceChangedCount += 1;
          }
          currentChartLabel = chartLabel;
          currentChartType = chartType;
          choiceHistory.push({ chart_label: chartLabel, chart_type: chartType, rt: clickRt });
          buttons.forEach(b => b.classList.remove("selected"));
          button.classList.add("selected");
          selectedText.innerHTML = `You selected: <strong>Option ${chartLabel}</strong>.`;
          confirmPanel.hidden = false;
          confirmPanel.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
      });

      confirmButton.addEventListener("click", function () {
        if (!currentChartType) {
          return;
        }
        const chartType = chartTypeById[currentChartType];
        selectedChartInfo = {
          selected_chart_label: currentChartLabel,
          selected_chart_type: currentChartType,
          selected_proposer_radius_multiplier: chartType.proposer_radius_multiplier,
          selected_receiver_radius_multiplier: chartType.receiver_radius_multiplier
        };
        buttons.forEach(b => b.disabled = true);
        confirmButton.disabled = true;
        jsPsych.finishTrial({
          selected_chart_label: currentChartLabel,
          selected_chart_type: currentChartType,
          selected_proposer_radius_multiplier: chartType.proposer_radius_multiplier,
          selected_receiver_radius_multiplier: chartType.receiver_radius_multiplier,
          first_chart_choice: firstChartType,
          chart_choice_changed_count: chartChoiceChangedCount,
          chart_choice_history_json: JSON.stringify(choiceHistory),
          chart_decision_rt: Math.round(performance.now() - pageStart)
        });
      });
    }
  };
}

function scaleQuestionHtml(name, text, left, right) {
  return `
    <div class="form-question">
      <div class="question-text">${text}</div>
      <div class="scale-anchors"><span>${left}</span><span>${right}</span></div>
      <div class="radio-row" role="radiogroup" aria-label="${name}">
        ${[1,2,3,4,5,6,7].map(v => `
          <label class="radio-tile">
            <input type="radio" name="${name}" value="${v}">
            <span>${v}</span>
          </label>
        `).join("")}
      </div>
    </div>
  `;
}

function postScaleTrial(questions, pageNumber) {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: shellHtml(`
      <form id="post-form" novalidate>
        <h2 class="intro-title">Follow-up Questions</h2>
        <p class="muted post-instruction">There are no right or wrong answers. Please answer based on how you feel.</p>
        ${questions.map(q => scaleQuestionHtml(q.name, q.text, q.left, q.right)).join("")}
        <button type="submit" class="form-submit">Continue</button>
        <div id="post-required" class="required-note">Please answer all questions before continuing.</div>
      </form>
    `),
    choices: "NO_KEYS",
    data: {
      phase: `post_questionnaire_page_${pageNumber}`,
      chosen_split_id: selectedSplit ? selectedSplit.split_id : "",
      selected_chart_type: selectedChartInfo ? selectedChartInfo.selected_chart_type : ""
    },
    on_load: function () {
      const pageStart = performance.now();
      const form = document.getElementById("post-form");
      const warning = document.getElementById("post-required");
      const questionRt = {};
      questions.forEach(function (q) {
        Array.from(form.querySelectorAll(`input[name="${q.name}"]`)).forEach(function (input) {
          input.addEventListener("change", function () {
            questionRt[q.name] = Math.round(performance.now() - pageStart);
          });
        });
      });
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        const response = collectFormData(form);
        const unanswered = questions.filter(q => !response[q.name]).map(q => q.name);
        if (unanswered.length > 0) {
          warning.style.display = "block";
          return;
        }
        warning.style.display = "none";
        const pageRt = Math.round(performance.now() - pageStart);
        const trialData = {
          post_questionnaire_page: pageNumber,
          chosen_split_id: selectedSplit ? selectedSplit.split_id : "",
          proposer_cents: selectedSplit ? selectedSplit.proposer : "",
          receiver_cents: selectedSplit ? selectedSplit.receiver : "",
          selected_chart_label: selectedChartInfo ? selectedChartInfo.selected_chart_label : "",
          selected_chart_type: selectedChartInfo ? selectedChartInfo.selected_chart_type : "",
          [`post_page${pageNumber}_rt`]: pageRt,
          [`post_page${pageNumber}_rt_json`]: JSON.stringify(questionRt)
        };
        questions.forEach(function (q) {
          trialData[q.name] = response[q.name];
        });
        jsPsych.finishTrial(trialData);
      });
    }
  };
}

function postReasonTrial() {
  const options = [
    { value: "accurate", label: "It represented the split most accurately." },
    { value: "receiver_larger", label: "It made the receiver's amount look larger." },
    { value: "own_larger", label: "It made my own amount look larger." },
    { value: "fairer", label: "It made the proposal look fairer." },
    { value: "acceptance", label: "It made the proposal more likely to be accepted." },
    { value: "clear_appealing", label: "It looked clearer or more visually appealing." },
    { value: "random", label: "I chose randomly / I had no particular reason." },
    { value: "other", label: "Other:" }
  ];
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: shellHtml(`
      <form id="post-reason-form" novalidate>
        <h2 class="intro-title">Follow-up Questions</h2>
        <div class="form-question">
          <div class="question-text">What was your main reason for choosing this chart? (Select all that apply.)</div>
          <div class="single-choice-list" role="group" aria-label="Chart choice reasons">
            ${options.map(function (option) {
              if (option.value === "other") {
                return `
                  <label class="single-choice-option">
                    <input type="checkbox" name="chart_choice_reason" value="other">
                    <span class="reason-other-row">
                      <span>${option.label}</span>
                      <input id="chart-reason-other" class="reason-other-input" name="chart_choice_reason_other" type="text" autocomplete="off">
                    </span>
                  </label>
                `;
              }
              return `
                <label class="single-choice-option">
                  <input type="checkbox" name="chart_choice_reason" value="${option.value}">
                  <span>${option.label}</span>
                </label>
              `;
            }).join("")}
          </div>
        </div>
        <button type="submit" class="form-submit">Continue</button>
        <div id="post-required" class="required-note">Please choose at least one option before continuing.</div>
      </form>
    `),
    choices: "NO_KEYS",
    data: {
      phase: "post_questionnaire_page_4",
      chosen_split_id: selectedSplit ? selectedSplit.split_id : "",
      selected_chart_type: selectedChartInfo ? selectedChartInfo.selected_chart_type : ""
    },
    on_load: function () {
      const pageStart = performance.now();
      const form = document.getElementById("post-reason-form");
      const warning = document.getElementById("post-required");
      const otherInput = document.getElementById("chart-reason-other");
      const questionRt = {};
      Array.from(form.querySelectorAll('input[name="chart_choice_reason"]')).forEach(function (input) {
        input.addEventListener("change", function () {
          questionRt.chart_choice_reasons = Math.round(performance.now() - pageStart);
        });
      });
      otherInput.addEventListener("focus", function () {
        const otherCheckbox = form.querySelector('input[name="chart_choice_reason"][value="other"]');
        if (otherCheckbox) {
          otherCheckbox.checked = true;
          questionRt.chart_choice_reasons = Math.round(performance.now() - pageStart);
        }
      });
      otherInput.addEventListener("input", function () {
        questionRt.chart_choice_reason_other = Math.round(performance.now() - pageStart);
      });
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        const response = collectFormData(form);
        const selectedReasons = Array.from(form.querySelectorAll('input[name="chart_choice_reason"]:checked')).map(input => input.value);
        const otherText = (response.chart_choice_reason_other || "").trim();
        if (selectedReasons.length === 0) {
          warning.textContent = "Please choose at least one option before continuing.";
          warning.style.display = "block";
          return;
        }
        if (selectedReasons.includes("other") && otherText.length === 0) {
          warning.textContent = "Please describe your other reason before continuing.";
          warning.style.display = "block";
          return;
        }
        warning.style.display = "none";
        jsPsych.finishTrial({
          post_questionnaire_page: 4,
          chosen_split_id: selectedSplit ? selectedSplit.split_id : "",
          proposer_cents: selectedSplit ? selectedSplit.proposer : "",
          receiver_cents: selectedSplit ? selectedSplit.receiver : "",
          selected_chart_label: selectedChartInfo ? selectedChartInfo.selected_chart_label : "",
          selected_chart_type: selectedChartInfo ? selectedChartInfo.selected_chart_type : "",
          chart_choice_reasons: selectedReasons.join("|"),
          chart_choice_reason_other: otherText,
          post_page4_rt: Math.round(performance.now() - pageStart),
          post_page4_rt_json: JSON.stringify(questionRt)
        });
      });
    }
  };
}

function postOpenEndedTrial() {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: shellHtml(`
      <form id="post-open-form" novalidate>
        <h2 class="intro-title">Follow-up Questions</h2>
        <div class="form-question">
          <label class="question-text post-open-question" for="study-issue-comment">Was anything unclear, confusing, or unexpected in this task?</label>
          <p>You may leave this blank if everything was clear.</p>
          <textarea id="study-issue-comment" class="text-area post-open-textarea" name="study_issue_comment" rows="5"></textarea>
        </div>
        <button type="submit" class="form-submit">Submit</button>
      </form>
    `),
    choices: "NO_KEYS",
    data: {
      phase: "post_questionnaire_page_5",
      chosen_split_id: selectedSplit ? selectedSplit.split_id : "",
      selected_chart_type: selectedChartInfo ? selectedChartInfo.selected_chart_type : ""
    },
    on_start: function () {
      plannedFullscreenExit = true;
      fullscreenAbortArmed = false;
      if (currentFullscreenElement() && document.exitFullscreen) {
        document.exitFullscreen();
      }
    },
    on_load: function () {
      const pageStart = performance.now();
      const form = document.getElementById("post-open-form");
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        const response = collectFormData(form);
        jsPsych.finishTrial({
          post_questionnaire_page: 5,
          chosen_split_id: selectedSplit ? selectedSplit.split_id : "",
          proposer_cents: selectedSplit ? selectedSplit.proposer : "",
          receiver_cents: selectedSplit ? selectedSplit.receiver : "",
          selected_chart_label: selectedChartInfo ? selectedChartInfo.selected_chart_label : "",
          selected_chart_type: selectedChartInfo ? selectedChartInfo.selected_chart_type : "",
          study_issue_comment: response.study_issue_comment.trim(),
          post_page5_rt: Math.round(performance.now() - pageStart)
        });
      });
    }
  };
}

function postQuestionnaireTrials() {
  return [
    postScaleTrial([
      {
        name: "split_fair_to_receiver_7",
        text: "How fair do you think your proposed split was to the receiver?",
        left: "1 = Very unfair",
        right: "7 = Very fair"
      },
      {
        name: "split_maximize_own_payoff_7",
        text: "To what extent did you choose this split to maximize your own payoff?",
        left: "1 = Not at all",
        right: "7 = Very much"
      },
      {
        name: "split_make_receiver_accept_7",
        text: "To what extent did you choose this split to make the receiver likely to accept?",
        left: "1 = Not at all",
        right: "7 = Very much"
      }
    ], 1),
    postScaleTrial([
      {
        name: "receiver_accept_likelihood_chart_7",
        text: "How likely do you think the receiver would be to accept your proposal with the chart you selected?",
        left: "1 = Very unlikely",
        right: "7 = Very likely"
      },
      {
        name: "receiver_perceived_fairness_chart_7",
        text: "How fair do you think the receiver would perceive your proposal to be with the chart you selected?",
        left: "1 = Very unfair",
        right: "7 = Very fair"
      },
      {
        name: "receiver_anger_chart_7",
        text: "How angry do you think the receiver would feel about your proposal with the chart you selected?",
        left: "1 = Not angry at all",
        right: "7 = Extremely angry"
      }
    ], 2),
    postScaleTrial([
      {
        name: "chart_more_acceptable_7",
        text: "How much did the chart you selected make the proposal look more acceptable to the receiver?",
        left: "1 = Not at all",
        right: "7 = Very much"
      },
      {
        name: "chart_misleading_7",
        text: "How misleading do you think the chart you selected was?",
        left: "1 = Not misleading at all",
        right: "7 = Very misleading"
      }
    ], 3),
    postReasonTrial(),
    postOpenEndedTrial()
  ];
}

function recordedBlankTrial() {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `<div class="recorded-blank">Your response has been recorded.</div>`,
    choices: "NO_KEYS",
    trial_duration: 1000,
    data: { phase: "response_recorded_blank" }
  };
}

function exp3TaskTrials() {
  return [
    stageMessageTrial(),
    splitDecisionTrial(),
    recordedBlankTrial(),
    chartDecisionTrial()
  ];
}

function localSaveNoticeTrial() {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: shellHtml(`
      <h2 class="intro-title">DataPipe is not configured yet.</h2>
      <p class="warning">This preview run cannot save to OSF/DataPipe because <code>DATAPIPE_EXPERIMENT_ID</code> is still a placeholder.</p>
      <p>The data are available in the browser console for testing. Replace the placeholder before running on Prolific.</p>
    `),
    choices: ["Continue"],
    data: { phase: "datapipe_not_configured_notice" },
    on_start: function () {
      if (comprehensionPassed) {
        setStoredStudyStatus("completed");
      }
    }
  };
}

function savingTrial() {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `<div class="study-shell"><div class="qualtrics-card standalone saving-card"><h2>Saving your data...</h2><p>Please do not close this page.</p></div></div>`,
    choices: "NO_KEYS",
    trial_duration: 500,
    data: { phase: "before_save" }
  };
}

function pipeSaveTrial() {
  return {
    type: jsPsychPipe,
    action: "save",
    experiment_id: DATAPIPE_EXPERIMENT_ID,
    filename: data_filename,
    data_string: () => getFilteredDataCsv(),
    wait_message: "<div class='study-shell'><div class='qualtrics-card standalone saving-card'><h2>Saving your data...</h2><p>Please do not close this page.</p></div></div>",
    on_finish: function () {
      if (comprehensionPassed) {
        dataSavedToDatapipe = true;
        setStoredStudyStatus("completed");
      }
    }
  };
}

function finalPageTrial() {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: shellHtml(`
      <h2 class="intro-title">Your response has been saved.</h2>
      <p>Thank you for completing this study.</p>
      ${isCompletionCodeConfigured()
        ? `<p>Click the button below to return to Prolific.</p>`
        : `<p class="muted">The Prolific completion code is still a placeholder. Add the real code before launch.</p>`}
    `),
    choices: [isCompletionCodeConfigured() ? "Return to Prolific" : "Finish"],
    data: { phase: "final_page" },
    on_finish: function () {
      plannedFullscreenExit = true;
      fullscreenAbortArmed = false;
      if (currentFullscreenElement() && document.exitFullscreen) {
        document.exitFullscreen();
      }
      if (isCompletionCodeConfigured()) {
        window.location.href = `https://app.prolific.com/submissions/complete?cc=${PROLIFIC_COMPLETION_CODE}`;
      }
    }
  };
}

async function buildAndRunExperiment() {
  const timeline = [];

  const storedStatus = getStoredStudyStatus();
  if (storedStatus && ["failed_verification", "fullscreen_exit", "excluded_comprehension", "completed"].includes(storedStatus.status)) {
    if (storedStatus.status === "completed" && isCompletionCodeConfigured()) {
      window.location.href = `https://app.prolific.com/submissions/complete?cc=${PROLIFIC_COMPLETION_CODE}`;
      return;
    }
    timeline.push(lockedStatusTrial(storedStatus));
    jsPsych.run(timeline);
    return;
  }

  if (!device.pass) {
    timeline.push(desktopGateTrial());
    jsPsych.run(timeline);
    return;
  }

  timeline.push({
    type: jsPsychPreload,
    images: ["ModifiedMullerLyer.png", "instruction-flow_proposerblue.png", "instruction-flow_proposerorange.png"],
    continue_after_error: true,
    data: { phase: "preload" }
  });

  timeline.push(humanVerificationTrial("ModifiedMullerLyer.png"));

  timeline.push({
    type: jsPsychFullscreen,
    fullscreen_mode: true,
    message: `<div class="fullscreen-message">
      <h2>Welcome to the Study</h2>
      <p>The purpose of this study is to examine how people make decisions in social and economic contexts. Your careful participation is very important to us.</p>
      <p>This study does not involve any foreseeable risks or sensitive content. All personal data collected in this study will be used for research purposes only and will not be used for any commercial purposes. Your responses will be analyzed anonymously.</p>
      <p>Your participation is voluntary. You have the right to withdraw from the study at any time.</p>
      <p>This study must be completed on a <strong>desktop</strong> or <strong>laptop computer</strong>. Please enter fullscreen mode to begin. <span class="fullscreen-warning">If you exit fullscreen mode before the study ends, the study will stop automatically.</span></p>
      <p>By checking the box below and continuing, you confirm that you have read the information above and agree to participate in this study.</p>
      <label class="fullscreen-consent">
        <input id="ethics-consent" type="checkbox">
        <span>I acknowledge the information above and agree to participate in this study.</span>
      </label>
    </div>`,
    button_label: "Enter fullscreen and start",
    data: { phase: "fullscreen_start" },
    on_load: function () {
      const consent = document.getElementById("ethics-consent");
      const button = document.querySelector("#jspsych-fullscreen-btn") || document.querySelector(".jspsych-btn");
      if (consent && button) {
        button.disabled = true;
        button.classList.add("is-disabled");
        consent.addEventListener("change", function () {
          button.disabled = !consent.checked;
          button.classList.toggle("is-disabled", !consent.checked);
        });
      }
    },
    on_finish: function () {
      plannedFullscreenExit = false;
      fullscreenAbortArmed = true;
      jsPsych.data.addProperties({
        fullscreen_started: currentFullscreenElement() ? 1 : 0
      });
      if (window.innerWidth < 900 || window.innerHeight < 600) {
        fullscreenAbortArmed = false;
        jsPsych.endExperiment(shellHtml(`
          <h2 class="intro-title">Screen size too small</h2>
          <p class="warning">This study requires a fullscreen display of at least 900 x 600 pixels.</p>
          <p>Please return the study on Prolific and do not submit a completion code.</p>
          <p class="muted">Detected fullscreen size: ${window.innerWidth} x ${window.innerHeight}</p>
        `, STUDY_TITLE, "abort-shell"));
      }
    }
  });

  timeline.push(conditionAssignmentTrial());
  timeline.push(instructionTrial());
  timeline.push(comprehensionTrial());

  timeline.push({
    timeline: [warningTrial(), instructionTrial(), comprehensionTrial()],
    conditional_function: function () {
      return !comprehensionPassed && !excludedForComprehension;
    }
  });

  timeline.push({
    timeline: [...exp3TaskTrials(), ...postQuestionnaireTrials()],
    conditional_function: function () {
      return comprehensionPassed;
    }
  });

  timeline.push({
    timeline: [savingTrial(), pipeSaveTrial()],
    conditional_function: function () {
      return isDatapipeConfigured() && (comprehensionPassed || excludedForComprehension);
    }
  });

  timeline.push({
    timeline: [localSaveNoticeTrial()],
    conditional_function: function () {
      return !isDatapipeConfigured() && (comprehensionPassed || excludedForComprehension);
    }
  });

  timeline.push({
    timeline: [finalPageTrial()],
    conditional_function: function () {
      return comprehensionPassed && (!isDatapipeConfigured() || dataSavedToDatapipe);
    }
  });

  timeline.push({
    timeline: [exclusionTrial()],
    conditional_function: function () {
      return excludedForComprehension;
    }
  });

  jsPsych.run(timeline);
}

buildAndRunExperiment();
