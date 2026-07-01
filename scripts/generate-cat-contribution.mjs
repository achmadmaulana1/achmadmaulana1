import { mkdirSync, writeFileSync } from "node:fs";

const cols = 53;
const rows = 7;
const step = 16;
const cell = 12;
const radius = 2;
const duration = 52000;
const consumeEnd = 96;

function x(col) {
  return col * step + 2;
}

function y(row) {
  return row * step + 2;
}

function cx(col) {
  return col * step + 8;
}

function cy(row) {
  return row * step + 8;
}

function keyOf(cell) {
  return `${cell.col},${cell.row}`;
}

function hash(col, row) {
  return (col * 37 + row * 61 + col * row * 17) % 101;
}

function level(col, row) {
  const streakMonth = col >= 28 && col <= 35;
  const secondWave = col >= 42 && col <= 47 && row !== 6;
  const practiceWeeks = col >= 14 && col <= 20 && row % 2 !== 0;
  const h = hash(col, row);

  if (streakMonth) return (row + col) % 3 === 0 ? 4 : 3;
  if (secondWave) return h % 4 === 0 ? 4 : 2;
  if (practiceWeeks) return h % 3 === 0 ? 3 : 1;
  if (h < 17) return 1;
  if (h < 25) return 2;
  if (h < 30) return 3;
  if (h === 42 || h === 77) return 4;
  return 0;
}

function collectGreenCells() {
  const cells = [];
  for (let col = 0; col < cols; col += 1) {
    for (let row = 0; row < rows; row += 1) {
      const lv = level(col, row);
      if (lv > 0) cells.push({ col, row, level: lv });
    }
  }
  return cells;
}

function distance(a, b) {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function greedyCatRoute(greenCells) {
  const remaining = new Map(greenCells.map((cell) => [keyOf(cell), cell]));
  const eatenIndex = new Map();
  const route = [{ col: cols - 1, row: 0 }];
  let current = route[0];

  function markCurrent() {
    const key = keyOf(current);
    if (remaining.has(key)) {
      remaining.delete(key);
      if (!eatenIndex.has(key)) eatenIndex.set(key, route.length - 1);
    }
  }

  function pushStep(next) {
    current = next;
    route.push(current);
    markCurrent();
  }

  function nearestTarget() {
    let best = null;
    for (const cell of remaining.values()) {
      if (!best) {
        best = cell;
        continue;
      }
      const d = distance(current, cell);
      const bestD = distance(current, best);
      const tieBreaker = cell.col > best.col || (cell.col === best.col && cell.row < best.row);
      if (d < bestD || (d === bestD && tieBreaker)) best = cell;
    }
    return best;
  }

  markCurrent();
  while (remaining.size > 0) {
    const target = nearestTarget();

    while (current.col !== target.col) {
      const dir = target.col > current.col ? 1 : -1;
      pushStep({ col: current.col + dir, row: current.row });
    }

    while (current.row !== target.row) {
      const dir = target.row > current.row ? 1 : -1;
      pushStep({ col: current.col, row: current.row + dir });
    }
  }

  route.push(route[route.length - 1]);
  return { route, eatenIndex };
}

const greenCells = collectGreenCells();
const { route: path, eatenIndex } = greedyCatRoute(greenCells);

function keyframesForCell(name, index, color, empty) {
  const p = (index / (path.length - 1)) * consumeEnd;
  const before = Math.max(0, p - 0.08).toFixed(2);
  const at = p.toFixed(2);
  return `@keyframes ${name}{0%,${before}%{fill:${color}}${at}%,99.4%{fill:${empty}}100%{fill:${color}}}`;
}

function pointAt(index) {
  const p = path[Math.max(0, Math.min(path.length - 1, index))];
  return `translate(${cx(p.col)}px,${cy(p.row)}px)`;
}

function pathKeyframes(name, lag = 0) {
  const lines = [`@keyframes ${name}{`];
  for (let i = 0; i < path.length; i += 1) {
    const pct = ((i / (path.length - 1)) * consumeEnd).toFixed(2);
    lines.push(`${pct}%{transform:${pointAt(i - lag)}}`);
  }
  lines.push(`99.4%{transform:${pointAt(0)}}`);
  lines.push(`100%{transform:${pointAt(0)}}`);
  lines.push("}");
  return lines.join("");
}

function svg(theme) {
  const dark = theme === "dark";
  const empty = dark ? "#161b22" : "#ebedf0";
  const border = dark ? "#30363d" : "#1b1f230a";
  const bg = dark ? "#0d1117" : "transparent";
  const colors = dark
    ? ["#0e4429", "#006d32", "#26a641", "#39d353"]
    : ["#9be9a8", "#40c463", "#30a14e", "#216e39"];

  let css = `
:root{--empty:${empty};--border:${border};--cat:#fbbf24;--cat2:#f59e0b;--ink:#1f2937}
.c{shape-rendering:geometricPrecision;fill:var(--empty);stroke-width:1px;stroke:var(--border);width:${cell}px;height:${cell}px}
.cat,.body{animation-duration:${duration}ms;animation-timing-function:linear;animation-iteration-count:infinite}
.cat{animation-name:catHead,runnerFade}
.b1{animation-name:body1,runnerFade}
.b2{animation-name:body2,runnerFade}
.b3{animation-name:body3,runnerFade}
.tail{animation:tail 850ms ease-in-out infinite;transform-origin:-7px 0}
.mouth{animation:chomp 460ms ease-in-out infinite;transform-origin:17px 0}
.bar{animation:bar ${duration}ms linear infinite;transform-origin:0 0}
@keyframes runnerFade{0%,96.4%{opacity:1}97%,99.4%{opacity:0}100%{opacity:1}}
@keyframes tail{0%,100%{transform:rotate(-16deg)}50%{transform:rotate(18deg)}}
@keyframes chomp{0%,100%{transform:rotate(0)}50%{transform:rotate(-18deg)}}
@keyframes bar{0%{transform:scaleX(1)}96%{transform:scaleX(.04)}100%{transform:scaleX(1)}}
${pathKeyframes("catHead", 0)}
${pathKeyframes("body1", 1)}
${pathKeyframes("body2", 2)}
${pathKeyframes("body3", 3)}
`;

  const rects = [];
  let greenIndex = 0;
  for (let col = 0; col < cols; col += 1) {
    for (let row = 0; row < rows; row += 1) {
      const lv = level(col, row);
      const id = lv > 0 ? ` g${greenIndex}` : "";
      const fill = lv > 0 ? colors[lv - 1] : empty;
      if (lv > 0) {
        const pathIndex = eatenIndex.get(`${col},${row}`);
        css += keyframesForCell(`eat${greenIndex}`, pathIndex, fill, empty);
        css += `.g${greenIndex}{fill:${fill};animation:eat${greenIndex} ${duration}ms steps(1,end) infinite}`;
        greenIndex += 1;
      }
      rects.push(`<rect class="c${id}" x="${x(col)}" y="${y(row)}" rx="${radius}" ry="${radius}"/>`);
    }
  }

  return `<svg viewBox="-16 -32 880 192" width="880" height="192" xmlns="http://www.w3.org/2000/svg">
<style>${css}</style>
${dark ? `<rect x="-16" y="-32" width="880" height="192" rx="16" fill="${bg}"/>` : ""}
${rects.join("")}
<rect height="12" width="848" x="0" y="144" rx="2" fill="${dark ? "#161b22" : "#ebedf0"}"/>
<rect class="bar" height="12" width="848" x="0" y="144" rx="2" fill="${colors[2]}"/>
<g class="body b3"><circle r="7" fill="#92400e"/><path class="tail" d="M-7 0C-20 -9 -22 9 -8 10" stroke="var(--cat)" stroke-width="4" stroke-linecap="round"/></g>
<g class="body b2"><circle r="8" fill="#b45309"/></g>
<g class="body b1"><circle r="9" fill="var(--cat2)"/></g>
<g class="cat">
  <ellipse cx="0" cy="0" rx="18" ry="15" fill="var(--cat)" stroke="#78350f" stroke-width="2.4"/>
  <path d="M-13 -10L-8 -22L-2 -9Z" fill="var(--cat)" stroke="#78350f" stroke-width="2"/>
  <path d="M9 -9L15 -22L18 -7Z" fill="var(--cat)" stroke="#78350f" stroke-width="2"/>
  <circle cx="-6" cy="-2" r="2.3" fill="#111827"/>
  <circle cx="7" cy="-2" r="2.3" fill="#111827"/>
  <path d="M1 4L-3 8H5L1 4Z" fill="#111827"/>
  <path class="mouth" d="M17 0L31 -7L31 8L17 3Z" fill="#ef4444"/>
  <path d="M-12 7L-22 11M-12 2L-23 2M13 7L23 11M13 2L24 2" stroke="#78350f" stroke-width="1.6" stroke-linecap="round"/>
</g>
</svg>`;
}

mkdirSync("dist", { recursive: true });
writeFileSync("dist/github-contribution-grid-cat.svg", svg("light"));
writeFileSync("dist/github-contribution-grid-cat-dark.svg", svg("dark"));
