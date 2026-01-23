const ENGAGEMENT_SERIES = [
  { label: "Video Plays", values: [80, 110, 95, 120, 140, 130], color: "#0f172a" },
  { label: "Video Completions", values: [60, 78, 66, 84, 100, 92], color: "#22c38e" },
]

const API_USAGE_SERIES = [
  { label: "API Requests", values: [30, 45, 38, 55, 61, 58], color: "#f97316" },
]

const VIEW_CONFIG = {
  engagement: {
    name: "Engagement",
    legend: [
      { label: "Video Plays", className: "usage-graph__legend-mark--plays" },
      { label: "Video Completions", className: "usage-graph__legend-mark--completions" },
    ],
    series: ENGAGEMENT_SERIES,
  },
  api: {
    name: "API Usage",
    legend: [{ label: "Total API Requests", className: "usage-graph__legend-mark--api" }],
    series: API_USAGE_SERIES,
  },
}

const CHART_WIDTH = 600
const CHART_HEIGHT = 260
const HORIZONTAL_PADDING = 30
const VERTICAL_PADDING = 30
const WEEKS = ["W1", "W2", "W3", "W4", "W5", "W6"]

const renderLegend = (legend) =>
  legend
    .map(
      (item) => `
        <span class="usage-graph__legend">
          <span class="usage-graph__legend-mark ${item.className}"></span>
          ${item.label}
        </span>
      `
    )
    .join("")

const getPoint = (value, index, total, max) => {
  const x =
    HORIZONTAL_PADDING +
    (index / Math.max(1, total - 1)) * (CHART_WIDTH - HORIZONTAL_PADDING * 2)
  const usableHeight = CHART_HEIGHT - VERTICAL_PADDING * 2
  const y = CHART_HEIGHT - VERTICAL_PADDING - (value / max) * usableHeight
  return { x, y }
}

const buildPoints = (values, max) =>
  values.map((value, index) => {
    return getPoint(value, index, values.length, max)
  })

const catmullRom2bezier = (points) => {
  const result = []
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = i === 0 ? points[i] : points[i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = i + 2 < points.length ? points[i + 2] : p2

    const cp1 = {
      x: p1.x + (p2.x - p0.x) / 6,
      y: p1.y + (p2.y - p0.y) / 6,
    }
    const cp2 = {
      x: p2.x - (p3.x - p1.x) / 6,
      y: p2.y - (p3.y - p1.y) / 6,
    }

    result.push({ cp1, cp2, p2 })
  }
  return result
}

const renderSvg = (series) => {
  const maxValue = Math.max(...series.flatMap((line) => line.values)) || 1
  const polylines = series
    .map((line) => {
      const points = buildPoints(line.values, maxValue)
      if (points.length < 2) return ""
      const controls = catmullRom2bezier(points)
      const path =
        `M ${points[0].x},${points[0].y} ` +
        controls
          .map(({ cp1, cp2, p2 }) => `C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${p2.x},${p2.y}`)
          .join(" ")
      return `<path class="usage-graph__line" d="${path}" stroke="${line.color}"></path>`
    })
    .join("")
  const dots = series
    .map((line) =>
      line.values
        .map((value, index) => {
          const { x, y } = getPoint(value, index, line.values.length, maxValue)
          return `<circle class="usage-graph__line-dot" cx="${x}" cy="${y}" r="5" fill="${line.color}"></circle>`
        })
        .join("")
    )
    .join("")

  const gridLines = Array.from({ length: 4 })
    .map((_, index) => {
      const y = VERTICAL_PADDING + (index / 4) * (CHART_HEIGHT - VERTICAL_PADDING * 2)
      return `<line x1="${HORIZONTAL_PADDING}" y1="${y}" x2="${
        CHART_WIDTH - HORIZONTAL_PADDING
      }" y2="${y}" stroke="rgba(15, 23, 42, 0.08)" stroke-width="1" />`
    })
    .join("")

  return `
    <svg viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" role="img" aria-label="Usage graph" preserveAspectRatio="none">
      ${gridLines}
      ${polylines}
      ${dots}
    </svg>
  `
}

export function mountUsageGraph(selector = "#usage-graph-slot") {
  const slot = document.querySelector(selector)
  if (!slot) return

  slot.innerHTML = `
    <div class="usage-graph">
      <div class="usage-graph__header">
        <div class="usage-graph__title">Usage Graph</div>
        <div class="usage-graph__tabs">
          <button class="usage-graph__tab active" data-view="engagement">Engagement</button>
          <button class="usage-graph__tab" data-view="api">API Usage</button>
        </div>
      </div>
      <div class="usage-graph__chart-wrapper">
        <div class="usage-graph__chart" aria-live="polite"></div>
      </div>
      <div class="usage-graph__legend-wrapper"></div>
    </div>
  `

  const chart = slot.querySelector(".usage-graph__chart")
  const legendWrapper = slot.querySelector(".usage-graph__legend-wrapper")
  const tabs = slot.querySelectorAll(".usage-graph__tab")

  const updateView = (view) => {
    const config = VIEW_CONFIG[view]
    if (!config) return
    chart.innerHTML = renderSvg(config.series)
    legendWrapper.innerHTML = renderLegend(config.legend)
    tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view))
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => updateView(tab.dataset.view))
  })

  updateView("engagement")
}
