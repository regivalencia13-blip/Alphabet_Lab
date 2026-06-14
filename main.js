const canvas = document.querySelector("#bacteria");
const ctx = canvas.getContext("2d", { alpha: false });

const TAU = Math.PI * 2;
const LOOP_SECONDS = 5.4;
const rand = (seed) => {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
};

const field = Array.from({ length: 46 }, (_, y) =>
  Array.from({ length: 46 }, (_, x) => ({
    x,
    y,
    offset: rand(x * 31.7 + y * 19.3),
  }))
).flat();

const easeInOutSine = (x) => -(Math.cos(Math.PI * x) - 1) / 2;

function burstPulse(phase) {
  if (phase < 0.36) return easeInOutSine(phase / 0.36);
  if (phase < 0.62) {
    const creep = (phase - 0.36) / 0.26;
    return 1 + Math.sin(creep * Math.PI) * 0.14;
  }
  return 1 - easeInOutSine((phase - 0.62) / 0.38);
}

function resize() {
  const size = Math.min(window.innerWidth, window.innerHeight, 720);
  const ratio = Math.min(window.devicePixelRatio || 1, 2);

  canvas.style.width = `${size * 0.94}px`;
  canvas.style.height = `${size * 0.94}px`;
  canvas.width = Math.round(size * ratio);
  canvas.height = Math.round(size * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
}

function edgeRadius(angle, phase, pulse) {
  const impact = phase < 0.36
    ? Math.sin((phase / 0.36) * Math.PI) * 14
    : 0;
  const creep = phase > 0.36 && phase < 0.62
    ? Math.sin(((phase - 0.36) / 0.26) * Math.PI) * 26
    : 0;
  const liquid =
    Math.sin(angle * 2.2 + phase * TAU * 1.1) * (13 + pulse * 7) +
    Math.sin(angle * 3.7 - phase * TAU * 0.8 + 1.4) * (9 + pulse * 5) +
    Math.cos(angle * 6.1 + phase * TAU * 1.35) * (5 + pulse * 4);

  return (
    58 + pulse * 210 +
    impact +
    creep +
    liquid +
    Math.sin(angle * 10 + phase * TAU * 0.5) * 4
  );
}

function densityAt(x, y, center, phase, pulse) {
  const dx = x - center;
  const dy = (y - center) / 0.9;
  const angle = Math.atan2(dy, dx);
  const dist = Math.hypot(dx / 1.08, dy);
  const rim = edgeRadius(angle, phase, pulse);
  const core = Math.max(0, 1 - dist / rim);
  const edgeBand = Math.max(0, 1 - Math.abs(dist - rim * 0.93) / 18);
  const membrane = edgeBand * 0.88;
  const wash = Math.max(0, 1 - Math.abs(dist - rim * 0.63) / 64) * 0.24;
  const grain =
    Math.sin(x * 0.06 + y * 0.035 + phase * TAU * 1.15) * 0.08 +
    Math.cos(x * 0.028 - y * 0.07 - phase * TAU * 0.9) * 0.06;

  return Math.max(0, Math.min(1, core * 0.42 + membrane + wash + grain));
}

function drawCellShape(x, y, radius, angle, morph, ink) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = `rgb(${ink}, ${ink}, ${ink})`;

  if (morph < 0.08) {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fill();
    ctx.restore();
    return;
  }

  const tip = radius * (1 + morph * 1.15);
  const back = radius * (0.82 - morph * 0.1);
  const side = radius * (0.92 - morph * 0.22);

  ctx.beginPath();
  ctx.moveTo(tip, 0);
  ctx.bezierCurveTo(radius * 0.4, -side, -back, -side * 0.72, -back, 0);
  ctx.bezierCurveTo(-back, side * 0.72, radius * 0.4, side, tip, 0);
  ctx.fill();
  ctx.restore();
}

function drawTransferPair(x, y, radius, angle, phase, offset, ink) {
  const speed = phase * TAU * 7.2 + offset * TAU;
  const rawTravel = 0.5 - Math.cos(speed) * 0.5;
  const travel = easeInOutSine(rawTravel);
  const distance = radius * 8.2;
  const ax = x - Math.cos(angle) * distance * 0.5;
  const ay = y - Math.sin(angle) * distance * 0.5;
  const bx = x + Math.cos(angle) * distance * 0.5;
  const by = y + Math.sin(angle) * distance * 0.5;
  const leftX = ax + (bx - ax) * travel;
  const leftY = ay + (by - ay) * travel;
  const rightX = bx + (ax - bx) * travel;
  const rightY = by + (ay - by) * travel;
  const morph = Math.sin(travel * Math.PI);
  const body = radius * (1.18 + morph * 0.3);

  ctx.save();
  ctx.lineCap = "round";
  const lineInk = Math.round(ink * (0.34 + morph * 0.34));
  ctx.strokeStyle = `rgb(${lineInk}, ${lineInk}, ${lineInk})`;
  ctx.lineWidth = radius * (0.24 + morph * 0.3);
  ctx.beginPath();
  ctx.moveTo(leftX, leftY);
  ctx.lineTo(rightX, rightY);
  ctx.stroke();
  ctx.restore();

  drawCellShape(leftX, leftY, body, angle, morph * 0.92, Math.min(252, ink + 16));
  drawCellShape(rightX, rightY, body, angle + Math.PI, morph * 0.92, Math.min(252, ink + 16));
}

function drawHalftone(center, phase, pulse, size) {
  const spacing = size / 46;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);

  for (const dot of field) {
    const baseX = dot.x * spacing + spacing * 0.5;
    const baseY = dot.y * spacing + spacing * 0.5;
    const dx = baseX - center;
    const dy = baseY - center;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const travellingWave = Math.sin(distance * 0.055 - phase * TAU * 2.4 + dot.offset * TAU);
    const swirl = Math.cos(distance * 0.035 - phase * TAU * 1.35 + dot.offset * TAU);
    const innerCalm = Math.max(0, 1 - distance / (spacing * 6.3));
    const burstFollow = (pulse - 0.18) * 16;
    const push = (travellingWave * (1.1 + pulse * 2.7) + burstFollow) * (1 - innerCalm * 0.68);
    const slide = swirl * (0.45 + pulse * 0.95) * (1 - innerCalm * 0.78);
    const centerPull = 1 + pulse * (0.038 - innerCalm * 0.02);
    const x = center + dx * centerPull + Math.cos(angle) * push + Math.cos(angle + Math.PI / 2) * slide;
    const y = center + dy * centerPull + Math.sin(angle) * push + Math.sin(angle + Math.PI / 2) * slide;
    const density = densityAt(x, y, center, phase, pulse);

    if (density < 0.16) continue;

    const waveScale = 0.78 + pulse * 0.22 + Math.max(0, travellingWave) * 0.28;
    const flicker = 0.93 + Math.sin(phase * TAU * 1.8 + dot.offset * TAU) * 0.07;
    const baseRadius = spacing * (0.095 + Math.min(density, 0.72) * 0.17) * flicker;
    const ink = 35 + Math.round(density * 215);
    const centerDistance = Math.hypot(x - center, y - center);
    if (dot.offset < 0.24 + density * 0.08) continue;

    const clusterCount = centerDistance < spacing * 5.4
      ? 1
      : 1 + Math.floor(Math.max(0, density - 0.3) * 2.4 + Math.max(0, travellingWave) * pulse * 0.8);

    for (let i = 0; i < clusterCount; i += 1) {
      const seed = dot.offset * 100 + i * 3.17;
      const scatterAngle = seed * TAU;
      const scatterRadius = i === 0 ? 0 : spacing * (0.18 + rand(seed) * 0.48) * density;
      const px = x + Math.cos(scatterAngle) * scatterRadius;
      const py = y + Math.sin(scatterAngle) * scatterRadius;
      const radius = baseRadius * (i === 0 ? 1 : 0.54 + rand(seed + 2) * 0.2) * waveScale;
      const localInk = Math.min(245, ink + (i === 0 ? 0 : 16));
      const transferSize = centerDistance < spacing * 5.4 ? radius * 1.34 : radius * 1.06;
      const transferAngle = angle + dot.offset * TAU * 0.3 + i * 0.7;

      drawTransferPair(px, py, transferSize, transferAngle, phase, dot.offset + i * 0.11, localInk);
    }
  }
}

function draw(time) {
  const size = canvas.clientWidth;
  const center = size / 2;
  const phase = ((time / 1000) % LOOP_SECONDS) / LOOP_SECONDS;
  const pulse = burstPulse(phase);

  drawHalftone(center, phase, pulse, size);

  requestAnimationFrame(draw);
}

window.addEventListener("resize", resize);
resize();
requestAnimationFrame(draw);
