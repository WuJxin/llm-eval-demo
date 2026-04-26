import fs from "node:fs";
import path from "node:path";

const COLORS = [
  "#1368ce",
  "#e35d2f",
  "#1b9c5a",
  "#8f4ed8",
  "#cc2f70",
  "#7a5c1f"
];

function buildSeries(records) {
  const byModel = new Map();

  for (const record of records) {
    if (!byModel.has(record.modelVersion)) {
      byModel.set(record.modelVersion, []);
    }
    byModel.get(record.modelVersion).push(record);
  }

  return Array.from(byModel.entries()).map(([modelVersion, items], index) => ({
    label: modelVersion,
    color: COLORS[index % COLORS.length],
    data: items
      .sort((a, b) => a.testQuestionId.localeCompare(b.testQuestionId))
      .map((item) => item.score)
  }));
}

function scalePoint(value, min, max, size) {
  if (max === min) {
    return size / 2;
  }
  return ((value - min) / (max - min)) * size;
}

export function writeChart(records, outputDir) {
  const labels = [...new Set(records.map((item) => item.testQuestionId))].sort();
  const datasets = buildSeries(records);
  const chartWidth = 920;
  const chartHeight = 420;
  const padding = { top: 28, right: 24, bottom: 56, left: 52 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const yTicks = Array.from({ length: 11 }, (_, index) => index);
  const paths = datasets.map((dataset) => {
    const points = dataset.data.map((value, index) => {
      const x =
        padding.left +
        (labels.length === 1 ? plotWidth / 2 : (index / (labels.length - 1)) * plotWidth);
      const y = padding.top + (plotHeight - scalePoint(value, 0, 10, plotHeight));
      return { x, y, value };
    });

    return {
      ...dataset,
      points,
      d: points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(" ")
    };
  });

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI评测折线图</title>
  <style>
    :root {
      --bg: #f5f1e8;
      --panel: #fffdf8;
      --ink: #1f2937;
      --muted: #5f6b7a;
      --line: #d9d1c3;
      --shadow: 0 18px 48px rgba(80, 59, 24, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(227, 93, 47, 0.18), transparent 30%),
        radial-gradient(circle at right, rgba(19, 104, 206, 0.16), transparent 28%),
        linear-gradient(180deg, #f7f2e9 0%, #f1ece2 100%);
      min-height: 100vh;
      padding: 32px 20px;
    }
    .wrap {
      max-width: 1100px;
      margin: 0 auto;
    }
    .header {
      margin-bottom: 20px;
    }
    h1 {
      margin: 0 0 10px;
      font-size: clamp(28px, 4vw, 44px);
      line-height: 1.05;
      letter-spacing: -0.03em;
    }
    p {
      margin: 0;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.6;
    }
    .panel {
      background: rgba(255, 253, 248, 0.88);
      border: 1px solid rgba(217, 209, 195, 0.9);
      border-radius: 24px;
      box-shadow: var(--shadow);
      padding: 20px;
      backdrop-filter: blur(10px);
    }
    .canvas-box {
      position: relative;
      overflow-x: auto;
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
    }
    .axis, .grid {
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .axis {
      stroke: #6a7280;
      stroke-width: 1.2;
    }
    .grid {
      stroke: rgba(95, 107, 122, 0.16);
      stroke-width: 1;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 18px;
      margin-top: 16px;
      font-size: 14px;
      color: var(--muted);
    }
    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .legend-swatch {
      width: 12px;
      height: 12px;
      border-radius: 999px;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>AI评测结果折线图</h1>
      <p>横轴为测试题号，纵轴为评分（0-10）。每条线代表一个模型在十道题上的得分走势，适合快速对比稳定性与波动情况。</p>
    </div>
    <div class="panel">
      <div class="canvas-box">
        <svg viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="AI评测折线图">
          ${yTicks
            .map((tick) => {
              const y = padding.top + (plotHeight - scalePoint(tick, 0, 10, plotHeight));
              return `
          <line class="grid" x1="${padding.left}" y1="${y}" x2="${chartWidth - padding.right}" y2="${y}" />
          <text x="${padding.left - 12}" y="${y + 4}" font-size="12" text-anchor="end" fill="#6a7280">${tick}</text>`;
            })
            .join("")}
          <line class="axis" x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${chartHeight - padding.bottom}" />
          <line class="axis" x1="${padding.left}" y1="${chartHeight - padding.bottom}" x2="${chartWidth - padding.right}" y2="${chartHeight - padding.bottom}" />
          ${labels
            .map((label, index) => {
              const x =
                padding.left +
                (labels.length === 1 ? plotWidth / 2 : (index / (labels.length - 1)) * plotWidth);
              return `
          <text x="${x}" y="${chartHeight - padding.bottom + 24}" font-size="12" text-anchor="middle" fill="#6a7280">${label}</text>`;
            })
            .join("")}
          ${paths
            .map(
              (dataset) => `
          <path d="${dataset.d}" fill="none" stroke="${dataset.color}" stroke-width="3" />
          ${dataset.points
            .map(
              (point) => `
          <circle cx="${point.x}" cy="${point.y}" r="4.5" fill="${dataset.color}">
            <title>${dataset.label} ${point.value}</title>
          </circle>`
            )
            .join("")}`
            )
            .join("")}
          <text x="${chartWidth / 2}" y="${chartHeight - 12}" font-size="13" text-anchor="middle" fill="#4b5563">测试题号</text>
          <text x="18" y="${chartHeight / 2}" font-size="13" text-anchor="middle" fill="#4b5563" transform="rotate(-90 18 ${chartHeight / 2})">评分</text>
        </svg>
        <div class="legend">
          ${paths
            .map(
              (dataset) => `
          <div class="legend-item">
            <span class="legend-swatch" style="background:${dataset.color}"></span>
            <span>${dataset.label}</span>
          </div>`
            )
            .join("")}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(outputDir, "chart.html"), html, "utf8");
}
