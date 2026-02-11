/**
 * HYPE DIAL — Kinetic Typography
 *
 * 100 도달 → 슬라이더 자동 복귀 (느리게, 문장별 다른 속도)
 * 복귀하면서 파티클들이 다음 문장으로 부드럽게 모핑.
 * 각 파티클마다 stagger delay + cubic easing.
 */

const SEQUENCE = [
  {
    text: "Technology alone never delivers meaning—it's a means to an end",
    font: '800 {s}px "Syne", sans-serif',
    returnSpeed: 0.35,
  },
  {
    text: "When language fails you, your world contracts",
    font: '900 {s}px "Playfair Display", serif',
    returnSpeed: 0.5,
  },
  {
    text: "The real problem isn't that AI is too fast It's that we're too willing to accept its output without asking hard questions",
    font: '700 {s}px "Space Grotesk", sans-serif',
    returnSpeed: 0.25,
  },
  {
    text: "The machine processes the human interprets",
    font: '400 {s}px "Bebas Neue", sans-serif',
    returnSpeed: 0.55,
  },
  {
    text: "The strength of AI is in scaling what we already know—not in imagining what we don't",
    font: '400 {s}px "DM Serif Display", serif',
    returnSpeed: 0.3,
  },
  {
    text: "AI as a question not an answer",
    font: '400 {s}px "Anton", sans-serif',
    returnSpeed: 0.6,
  },
  {
    text: "If we accept AI as an endpoint rather than a tool for exploration we risk losing our agency",
    font: '800 {s}px "Outfit", sans-serif',
    returnSpeed: 0.3,
  },
];

let currentIndex = 0;

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
let W, H, centerX, centerY;
const dpr = window.devicePixelRatio || 1;
const PAD = 0.07;

let currentValue = 0;
let targetValue = 0;
let velocity = 0;
let autoReturning = false;
let inputLocked = false;
let returnSpeed = 0.35;

const dial = document.getElementById("dial");
const dialLabel = document.getElementById("dial-label");
const hint = document.getElementById("hint");

let points = [];

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/* ---- SAMPLING ---- */

function getFont(idx, size) {
  return SEQUENCE[idx].font.replace("{s}", size);
}

function sampleSentence(idx) {
  const result = [];
  const sentence = SEQUENCE[idx].text;
  const off = document.createElement("canvas");
  const octx = off.getContext("2d");
  off.width = W;
  off.height = H;

  const px = W * PAD,
    py = H * PAD;
  const aw = W - px * 2,
    ah = H - py * 2;
  const words = sentence.split(" ");
  let fontSize, lines, lh;

  let lo = 14,
    hi = Math.min(aw * 0.45, ah * 0.7);
  for (let i = 0; i < 30; i++) {
    fontSize = (lo + hi) / 2;
    lh = fontSize * 1.1;
    octx.font = getFont(idx, fontSize);
    lines = wrap(octx, words, aw);
    const th = lines.length * lh;
    let mw = 0;
    for (const l of lines) mw = Math.max(mw, octx.measureText(l).width);
    if (th > ah || mw > aw * 1.01) hi = fontSize;
    else lo = fontSize;
  }

  fontSize = lo;
  lh = fontSize * 1.1;
  octx.font = getFont(idx, fontSize);
  lines = wrap(octx, words, aw);

  octx.fillStyle = "#000";
  octx.fillRect(0, 0, W, H);
  octx.fillStyle = "#fff";
  octx.font = getFont(idx, fontSize);
  octx.textAlign = "center";
  octx.textBaseline = "top";

  const th = lines.length * lh;
  const sy = py + (ah - th) / 2;
  lines.forEach((l, i) => octx.fillText(l, centerX, sy + i * lh));

  const data = octx.getImageData(0, 0, W, H).data;
  let wc = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i] > 128) wc++;
  const step = Math.max(2, Math.round(Math.sqrt(wc / 4000)));

  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      if (data[(y * W + x) * 4] > 128) {
        const dx = x - centerX,
          dy = y - centerY;
        result.push({
          x,
          y,
          angle: Math.atan2(dy, dx),
          dist: Math.sqrt(dx * dx + dy * dy),
          seed: Math.random(),
          phase: Math.random() * Math.PI * 2,
        });
      }
    }
  }
  return result;
}

function wrap(octx, words, maxW) {
  const lines = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (octx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  lines.push(cur);
  return lines;
}

/* ---- INIT ---- */

function initPoints() {
  const sampled = sampleSentence(currentIndex);
  points = sampled.map((p) => ({
    x: p.x,
    y: p.y,
    homeX: p.x,
    homeY: p.y,
    nextX: p.x,
    nextY: p.y,
    angle: p.angle,
    dist: p.dist,
    seed: p.seed,
    phase: p.phase,
    delay: Math.random() * 0.3,
  }));
}

/* ---- TRANSITION ---- */

function startTransition() {
  if (autoReturning) return;

  const nextIdx = (currentIndex + 1) % SEQUENCE.length;
  const nextSampled = sampleSentence(nextIdx);
  const maxLen = Math.max(points.length, nextSampled.length);

  while (points.length < maxLen) {
    const src = points[Math.floor(Math.random() * points.length)];
    points.push({
      ...src,
      seed: Math.random(),
      phase: Math.random() * Math.PI * 2,
      delay: Math.random() * 0.3,
    });
  }
  while (nextSampled.length < maxLen) {
    const src = nextSampled[Math.floor(Math.random() * nextSampled.length)];
    nextSampled.push({
      ...src,
      seed: Math.random(),
      phase: Math.random() * Math.PI * 2,
    });
  }

  shuffleArray(nextSampled);

  for (let i = 0; i < maxLen; i++) {
    points[i].nextX = nextSampled[i].x;
    points[i].nextY = nextSampled[i].y;
    points[i].delay = Math.random() * 0.35;
  }

  returnSpeed = SEQUENCE[nextIdx].returnSpeed;
  autoReturning = true;
  inputLocked = true;
  currentIndex = nextIdx;

  if (hint) hint.style.opacity = "0";
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* ---- RESIZE ---- */

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  centerX = W / 2;
  centerY = H / 2;
  initPoints();
}
window.addEventListener("resize", resize);

/* ---- DIAL ---- */

dial.addEventListener("input", (e) => {
  if (inputLocked) return;
  const v = parseFloat(e.target.value);
  velocity = Math.abs(v - targetValue);
  targetValue = v;
  if (v > 5 && hint) hint.style.opacity = "0";
  if (targetValue >= 99.5) startTransition();
});

/* ---- ANIMATION ---- */

let frame = 0;

function animate() {
  requestAnimationFrame(animate);
  frame++;

  if (autoReturning) {
    targetValue = Math.max(0, targetValue - returnSpeed);
    dial.value = targetValue;
    if (targetValue <= 0.05) {
      targetValue = 0;
      dial.value = 0;
      autoReturning = false;
      inputLocked = false;
      for (const p of points) {
        p.homeX = p.nextX;
        p.homeY = p.nextY;
        p.x = p.nextX;
        p.y = p.nextY;
        const dx = p.homeX - centerX,
          dy = p.homeY - centerY;
        p.angle = Math.atan2(dy, dx);
        p.dist = Math.sqrt(dx * dx + dy * dy);
      }
    }
  }

  currentValue += (targetValue - currentValue) * 0.06;
  if (Math.abs(currentValue - targetValue) < 0.01) currentValue = targetValue;
  velocity *= 0.95;

  const t = currentValue / 100;
  const boost = 1 + Math.min(velocity * 0.3, 1.2);
  const time = frame * 0.02;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < points.length; i++) {
    const p = points[i];

    let baseX, baseY;
    if (autoReturning) {
      const raw = 1 - t;
      const delayed = Math.max(0, (raw - p.delay) / (1 - p.delay));
      const eased = easeInOutCubic(delayed);
      baseX = p.homeX + (p.nextX - p.homeX) * eased;
      baseY = p.homeY + (p.nextY - p.homeY) * eased;
    } else {
      baseX = p.homeX;
      baseY = p.homeY;
    }

    let x = baseX,
      y = baseY;
    let sLen = 3,
      sAng = p.angle,
      op = 0.9,
      sW = 1.4;

    if (t > 0) {
      const p1 = Math.min(t / 0.3, 1);
      const j = p1 * 2.0 * boost;
      x += Math.sin(time * 3 + p.phase * 10) * j;
      y += Math.cos(time * 2.7 + p.phase * 8) * j;
      if (!autoReturning) {
        x += (centerX - x) * p1 * 0.025 * boost;
        y += (centerY - y) * p1 * 0.025 * boost;
      }
      sLen = 3 + p1 * 1.5;
    }

    if (t > 0.3) {
      const p2 = Math.min((t - 0.3) / 0.3, 1);
      sLen += p2 * 10 * boost;
      sAng += p2 * Math.PI * 0.35 * (p.seed > 0.5 ? 1 : -1);
      const dr = p2 * 8 * boost;
      x += Math.cos(p.angle) * dr;
      y += Math.sin(p.angle) * dr;
      sW = 1.4 + p2 * 0.8;
      op = 0.9 - p2 * 0.15 * (p.seed > 0.7 ? 1 : 0);
    }

    if (t > 0.6) {
      const p3 = Math.min((t - 0.6) / 0.25, 1);
      const sc = p3 * (35 + p.dist * 0.3) * boost;
      x += Math.cos(p.angle + Math.sin(time + p.phase) * 0.2) * sc;
      y += Math.sin(p.angle + Math.cos(time + p.phase) * 0.2) * sc;
      sAng = p.angle + Math.PI / 2 + p3 * Math.sin(p.phase * 5) * 0.5;
      sLen += p3 * 14 * boost;
      x += Math.sin(p.angle * 3 + time) * p3 * 6;
      y += Math.cos(p.angle * 3 + time) * p3 * 6;
      sW = 2 + p3 * 0.6;
    }

    if (t > 0.85) {
      const p4 = Math.min((t - 0.85) / 0.15, 1);
      const ex = p4 * (70 + p.dist * 0.45) * boost;
      x += Math.cos(p.angle + time * 0.5 * (p.seed - 0.5)) * ex;
      y += Math.sin(p.angle + time * 0.5 * (p.seed - 0.5)) * ex;
      sAng += p4 * Math.sin(time * 2 + p.seed * 20) * Math.PI;
      sLen = (4 + p4 * 22 * p.seed) * boost;
      if (p4 > 0.5 && Math.sin(time * 10 + p.seed * 100) > 0.3)
        op *= 0.4 + Math.random() * 0.6;
      sW = 1 + p4 * 1.5 * p.seed;
    }

    const h = sLen / 2;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(sAng) * h, y - Math.sin(sAng) * h);
    ctx.lineTo(x + Math.cos(sAng) * h, y + Math.sin(sAng) * h);
    ctx.strokeStyle = `rgba(235,235,235,${op})`;
    ctx.lineWidth = sW;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  if (t > 0.85) {
    const go = ((t - 0.85) / 0.15) * 0.05;
    ctx.fillStyle = `rgba(255,255,255,${go})`;
    for (let sy = 0; sy < H; sy += 4) {
      if (Math.sin(sy * 0.5 + time * 5) > 0.5) ctx.fillRect(0, sy, W, 1);
    }
  }

  dialLabel.style.color = `rgba(68,68,68,${1 - t * 0.6})`;
}

// 모든 폰트를 강제로 프리로드한 뒤 시작
// document.fonts.ready만으로는 CDN 폰트가 실제 렌더 가능한 상태인지 보장 안 됨
// → 각 폰트를 FontFace로 명시적 load + DOM에 숨긴 텍스트로 강제 사용

const FONT_LIST = [
  { family: "Syne", weight: "800" },
  { family: "Playfair Display", weight: "900" },
  { family: "Space Grotesk", weight: "700" },
  { family: "Bebas Neue", weight: "400" },
  { family: "DM Serif Display", weight: "400" },
  { family: "Anton", weight: "400" },
  { family: "Outfit", weight: "800" },
];

function preloadFonts() {
  return new Promise((resolve) => {
    // DOM에 숨긴 span으로 각 폰트 강제 사용
    const container = document.createElement("div");
    container.style.cssText =
      "position:absolute;top:-9999px;left:-9999px;visibility:hidden;";
    FONT_LIST.forEach((f) => {
      const span = document.createElement("span");
      span.style.fontFamily = `"${f.family}", sans-serif`;
      span.style.fontWeight = f.weight;
      span.style.fontSize = "48px";
      span.textContent =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789—'";
      container.appendChild(span);
    });
    document.body.appendChild(container);

    // document.fonts.ready + 추가 딜레이로 안전하게
    document.fonts.ready.then(() => {
      // 브라우저가 실제로 폰트를 렌더링할 시간을 줌
      setTimeout(() => {
        document.body.removeChild(container);
        resolve();
      }, 300);
    });
  });
}

preloadFonts().then(() => {
  resize();
  animate();
});
