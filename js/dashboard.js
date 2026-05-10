const dashboardMetrics = {
  before: {
    frt: 7.4,
    sla: 78,
    delay: 34,
    urgentOnTime: 58,
    workload: 4.8
  },
  after: {
    frt: 5.2,
    sla: 92,
    delay: 12,
    urgentOnTime: 93,
    workload: 2.1
  }
}

const barSeries = [
  { type: 'B/L Amendment', before: 8.8, after: 6.2 },
  { type: 'FCR', before: 7.6, after: 5.1 },
  { type: 'Inspection Certificate', before: 9.1, after: 6.8 },
  { type: 'Packing List', before: 6.4, after: 4.6 },
  { type: 'COO', before: 8.0, after: 5.7 }
]

const pieSeries = [
  { label: 'Critical', value: 25, color: '#ef4444' },
  { label: 'Priority', value: 40, color: '#f59e0b' },
  { label: 'Standard', value: 35, color: '#22c55e' }
]

const lineSeries = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  before: [75, 77, 79, 81, 78, 72, 70],
  after: [91, 93, 94, 92, 90, 89, 88]
}

function formatMetric(value, suffix = '') {
  return `${value}${suffix}`
}

function renderKpis() {
  document.getElementById('beforeFrt').textContent = formatMetric(dashboardMetrics.before.frt, 'h')
  document.getElementById('afterFrt').textContent = formatMetric(dashboardMetrics.after.frt, 'h')
  document.getElementById('beforeSla').textContent = formatMetric(dashboardMetrics.before.sla, '%')
  document.getElementById('afterSla').textContent = formatMetric(dashboardMetrics.after.sla, '%')
  document.getElementById('beforeDelay').textContent = formatMetric(dashboardMetrics.before.delay, '%')
  document.getElementById('afterDelay').textContent = formatMetric(dashboardMetrics.after.delay, '%')
  document.getElementById('beforeUrgentOnTime').textContent = formatMetric(dashboardMetrics.before.urgentOnTime, '%')
  document.getElementById('afterUrgentOnTime').textContent = formatMetric(dashboardMetrics.after.urgentOnTime, '%')
  document.getElementById('beforeWorkload').textContent = formatMetric(dashboardMetrics.before.workload)
  document.getElementById('afterWorkload').textContent = formatMetric(dashboardMetrics.after.workload)
}

function renderBarChart() {
  const chart = document.getElementById('barChart')
  const maxValue = Math.max(...barSeries.flatMap(item => [item.before, item.after]))
  chart.innerHTML = ''

  const legend = document.createElement('div')
  legend.className = 'bar-legend'
  legend.innerHTML = `
    <div class="bar-legend-item"><span class="bar-swatch" style="background:#7dd3fc"></span><span>Before</span></div>
    <div class="bar-legend-item"><span class="bar-swatch" style="background:#0f172a"></span><span>After</span></div>`
  chart.appendChild(legend)

  barSeries.forEach(entry => {
    const row = document.createElement('div')
    row.className = 'bar-row'

    const titleRow = document.createElement('div')
    titleRow.className = 'bar-row-title'

    const label = document.createElement('div')
    label.className = 'bar-label'
    label.textContent = entry.type

    titleRow.appendChild(label)
    row.appendChild(titleRow)

    const group = document.createElement('div')
    group.className = 'bar-track-group'

    const beforeTrack = document.createElement('div')
    beforeTrack.className = 'bar-track'
    const beforeFill = document.createElement('div')
    beforeFill.className = 'bar-fill bar-before'
    const beforeWidth = Math.round((entry.before / maxValue) * 100)
    beforeFill.style.width = `${beforeWidth}%`
    beforeTrack.appendChild(beforeFill)
    const beforeLabel = document.createElement('span')
    beforeLabel.textContent = `Before ${entry.before}h`
    beforeTrack.appendChild(beforeLabel)

    const afterTrack = document.createElement('div')
    afterTrack.className = 'bar-track'
    const afterFill = document.createElement('div')
    afterFill.className = 'bar-fill bar-after'
    const afterWidth = Math.round((entry.after / maxValue) * 100)
    afterFill.style.width = `${afterWidth}%`
    afterTrack.appendChild(afterFill)
    const afterLabel = document.createElement('span')
    afterLabel.textContent = `After ${entry.after}h`
    afterTrack.appendChild(afterLabel)

    group.appendChild(beforeTrack)
    group.appendChild(afterTrack)
    row.appendChild(group)
    chart.appendChild(row)
  })
}

function renderPieChart() {
  const svg = document.getElementById('pieChart')
  const legend = document.getElementById('pieLegend')
  const radius = 100
  const center = 120
  const circumference = 2 * Math.PI * radius

  let offset = 0
  svg.innerHTML = ''
  legend.innerHTML = ''

  pieSeries.forEach(segment => {
    const dashArray = `${circumference * (segment.value / 100)} ${circumference}`
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'circle')

    path.setAttribute('cx', center)
    path.setAttribute('cy', center)
    path.setAttribute('r', radius)
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke-width', '40')
    path.setAttribute('stroke', segment.color)
    path.setAttribute('stroke-dasharray', dashArray)
    path.setAttribute('stroke-dashoffset', `${circumference * (1 - offset / 100)}`)
    path.setAttribute('transform', `rotate(-90 ${center} ${center})`)
    path.setAttribute('stroke-linecap', 'butt')

    svg.appendChild(path)

    const legendItem = document.createElement('div')
    legendItem.className = 'pie-legend-item'
    legendItem.innerHTML = `
      <span class="pie-swatch" style="background:${segment.color}"></span>
      <span>${segment.label}</span>
      <strong>${segment.value}%</strong>`
    legend.appendChild(legendItem)

    offset += segment.value
  })

  const centerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  centerCircle.setAttribute('cx', center)
  centerCircle.setAttribute('cy', center)
  centerCircle.setAttribute('r', 58)
  centerCircle.setAttribute('fill', '#ffffff')
  svg.appendChild(centerCircle)

  const centerText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  centerText.setAttribute('x', center)
  centerText.setAttribute('y', center + 8)
  centerText.setAttribute('text-anchor', 'middle')
  centerText.setAttribute('font-size', '16')
  centerText.setAttribute('font-weight', '700')
  centerText.setAttribute('fill', '#0f172a')
  centerText.textContent = 'After'
  svg.appendChild(centerText)
}

function renderLineChart() {
  const svg = document.getElementById('lineChart')
  const labels = document.getElementById('lineLabels')
  const width = 680
  const height = 320
  const padding = 44
  const maxValue = 100

  svg.innerHTML = ''
  labels.innerHTML = ''

  const lineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  const axis = document.createElementNS('http://www.w3.org/2000/svg', 'line')
  axis.setAttribute('x1', padding)
  axis.setAttribute('y1', height - padding)
  axis.setAttribute('x2', width - padding)
  axis.setAttribute('y2', height - padding)
  axis.setAttribute('stroke', '#d1d5db')
  axis.setAttribute('stroke-width', '1')
  svg.appendChild(axis)

  function point(index, value) {
    const x = padding + (index * (width - padding * 2)) / (lineSeries.labels.length - 1)
    const y = (height - padding) - (value / maxValue) * (height - padding * 1.5)
    return { x, y }
  }

  function drawLine(data, color) {
    const points = data.map((value, index) => point(index, value))
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', color)
    path.setAttribute('stroke-width', '3')
    path.setAttribute('points', points.map(p => `${p.x},${p.y}`).join(' '))
    svg.appendChild(path)

    points.forEach(p => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      circle.setAttribute('cx', p.x)
      circle.setAttribute('cy', p.y)
      circle.setAttribute('r', 4)
      circle.setAttribute('fill', color)
      svg.appendChild(circle)
    })
  }

  drawLine(lineSeries.before, '#7dd3fc')
  drawLine(lineSeries.after, '#0f172a')

  lineSeries.labels.forEach(day => {
    const label = document.createElement('div')
    label.className = 'line-label'
    label.textContent = day
    labels.appendChild(label)
  })
}

function initDashboard() {
  renderKpis()
  renderBarChart()
  renderPieChart()
  renderLineChart()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard)
} else {
  initDashboard()
}
