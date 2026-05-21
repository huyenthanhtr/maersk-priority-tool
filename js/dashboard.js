// Dashboard - Load real data from tickets.json and compute metrics dynamically

let ticketData = []

// Lane classification based on priority score
function getLane(score) {
  if (score >= 80) return 'Critical'
  if (score >= 50) return 'Priority'
  return 'Standard'
}

function average(values) {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function formatNumber(value, digits = 1) {
  const rounded = Number(value.toFixed(digits))
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits)
}

function setText(id, value) {
  const element = document.getElementById(id)
  if (element) {
    element.textContent = value
  }
}

// Load and compute metrics
async function loadAndComputeMetrics() {
  try {
    const response = await fetch('../data/tickets.json')
    const data = await response.json()
    ticketData = data.tickets || []

    // Calculate priority scores for each ticket
    ticketData.forEach(ticket => {
      ticket.priorityScore = calculateScore({
        urgent_flag: ticket.urgent_flag,
        lead_time_days: ticket.lead_time_days,
        document_type: ticket.document_type,
        customer_tier: ticket.customer_tier
      })
      ticket.lane = getLane(ticket.priorityScore)
    })

    // Compute metrics
    computeMetrics()
  } catch (error) {
    console.error('Error loading tickets:', error)
  }
}

function computeMetrics() {
  // Before: FCFS (average of all first_response_time_hours)
  // After: Priority-based (simulate faster response for high-priority tickets)
  
  const beforeMetrics = {
    frt: average(ticketData.map(t => t.first_response_time_hours)),
    slaCompliance: (ticketData.filter(t => t.sla_status === 'Met').length / ticketData.length) * 100,
    assignmentDelay: average(ticketData.map(t => t.assignment_delay_minutes)),
    urgentOnTime: 0,
    workload: 0
  }

  // Estimate priority handling consistency
  const criticalTickets = ticketData.filter(t => t.lane === 'Critical')
  const criticalOnTime = criticalTickets.filter(t => t.first_response_time_hours <= 1).length
  beforeMetrics.urgentOnTime = criticalTickets.length > 0 ? (criticalOnTime / criticalTickets.length) * 100 : 0

  // Workload distribution - standard deviation
  const picWorkload = {}
  ticketData.forEach(t => {
    if (!picWorkload[t.assigned_agent]) {
      picWorkload[t.assigned_agent] = 0
    }
    picWorkload[t.assigned_agent]++
  })
  const workloadValues = Object.values(picWorkload)
  const workloadMean = average(workloadValues)
  const variance = average(workloadValues.map(w => Math.pow(w - workloadMean, 2)))
  beforeMetrics.workload = Math.sqrt(variance)

  // After: Simulate improvement with priority framework
  const afterMetrics = {
    frt: beforeMetrics.frt * 0.7, // 30% improvement in FRT
    slaCompliance: Math.min(100, beforeMetrics.slaCompliance * 1.18), // 18% improvement
    assignmentDelay: beforeMetrics.assignmentDelay * 0.35, // 65% improvement
    urgentOnTime: Math.min(100, beforeMetrics.urgentOnTime * 1.6), // 60% improvement
    workload: beforeMetrics.workload * 0.44 // 56% improvement
  }

  // Store metrics globally for chart rendering
  window.dashboardMetrics = {
    before: beforeMetrics,
    after: afterMetrics
  }

  // Compute chart data
  computeBarChartData()
  computePieChartData()
  computeLineChartData()

  // Render all charts and KPIs
  renderKpisAccent()
  renderBarChart()
  renderPieChart()
  renderLineChart()
}

function computeBarChartData() {
  // Group by document type and calculate avg FRT before/after
  const docTypeMap = {}
  
  ticketData.forEach(ticket => {
    if (!docTypeMap[ticket.document_type]) {
      docTypeMap[ticket.document_type] = { tickets: [], type: ticket.document_type }
    }
    docTypeMap[ticket.document_type].tickets.push(ticket)
  })

  window.barSeries = Object.values(docTypeMap).map(group => {
    const before = average(group.tickets.map(t => t.first_response_time_hours))
    const after = before * 0.7 // 30% improvement with priority framework
    return {
      type: group.type,
      before: parseFloat(before.toFixed(1)),
      after: parseFloat(after.toFixed(1))
    }
  }).sort((a, b) => b.before - a.before).slice(0, 6) // Top 6 types
}

function computePieChartData() {
  const laneCounts = {}
  ticketData.forEach(ticket => {
    if (!laneCounts[ticket.lane]) {
      laneCounts[ticket.lane] = 0
    }
    laneCounts[ticket.lane]++
  })

  const total = ticketData.length
  window.pieSeries = [
    { label: 'Critical', value: Math.round((laneCounts['Critical'] || 0) / total * 100), color: '#C0392B' },
    { label: 'Priority', value: Math.round((laneCounts['Priority'] || 0) / total * 100), color: '#E67E22' },
    { label: 'Standard', value: Math.round((laneCounts['Standard'] || 0) / total * 100), color: '#27AE60' }
  ]
}

function computeLineChartData() {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayStats = Object.fromEntries(labels.map(day => [day, { total: 0, met: 0 }]))

  ticketData.forEach(ticket => {
    const createdAt = new Date(String(ticket.created_at || '').replace(' ', 'T'))
    if (Number.isNaN(createdAt.getTime())) return

    const day = dayNames[createdAt.getDay()]
    if (!dayStats[day]) return

    dayStats[day].total += 1
    if (ticket.sla_status === 'Met') {
      dayStats[day].met += 1
    }
  })

  const plottedDays = labels.filter(day => dayStats[day].total > 0)
  const activeLabels = plottedDays.length > 1 ? plottedDays : labels
  const slaBefore = activeLabels.map(day => {
    const stat = dayStats[day]
    if (!stat.total) return Math.round(window.dashboardMetrics.before.slaCompliance)
    return Math.round((stat.met / stat.total) * 100)
  })
  const slaAfter = slaBefore.map(value => Math.min(100, Math.round(value * 1.18)))

  window.lineSeries = {
    labels: activeLabels,
    before: slaBefore,
    after: slaAfter
  }
}

function renderBarChart() {
  const chart = document.getElementById('barChart')
  const maxSeriesValue = Math.max(...window.barSeries.flatMap(entry => [entry.before, entry.after]))
  const maxValue = Math.ceil(maxSeriesValue / 2) * 2
  const axisStep = maxValue / 5
  chart.innerHTML = ''

  const reductions = window.barSeries.map(entry => entry.before - entry.after)
  const bestGain = Math.max(...reductions)
  const avgReduction = average(reductions)
  setText('barBestGain', `${formatNumber(Math.abs(bestGain))}h`)
  setText('barAvgReduction', `${formatNumber(Math.abs(avgReduction))}h`)

  const legend = document.createElement('div')
  legend.className = 'bar-legend'
  legend.innerHTML = `
    <div class="bar-legend-item"><span class="bar-swatch" style="background:#A8C4D4"></span><span>Current FCFS</span></div>
    <div class="bar-legend-item"><span class="bar-swatch" style="background:#003F6B"></span><span>Simulated Priority</span></div>`

  const plot = document.createElement('div')
  plot.className = 'bar-chart-plot'

  const yAxis = document.createElement('div')
  yAxis.className = 'bar-y-axis'
  const axisValues = Array.from({ length: 6 }, (_, index) => maxValue - index * axisStep)
  axisValues.forEach(value => {
    const tick = document.createElement('div')
    tick.className = 'bar-y-tick'
    tick.textContent = `${formatNumber(value)}h`
    yAxis.appendChild(tick)
  })

  const groups = document.createElement('div')
  groups.className = 'bar-groups'
  const groupElements = []

  const gridLines = document.createElement('div')
  gridLines.className = 'bar-grid-lines'
  axisValues.forEach(() => {
    const line = document.createElement('div')
    line.className = 'bar-grid-line'
    gridLines.appendChild(line)
  })
  groups.appendChild(gridLines)

  window.barSeries.forEach(entry => {
    const group = document.createElement('div')
    group.className = 'bar-group'

    const bars = document.createElement('div')
    bars.className = 'bar-group-bars'

    const footer = document.createElement('div')
    footer.className = 'bar-group-footer'

    const delta = document.createElement('div')
    delta.className = 'bar-delta'
    delta.innerHTML = `<span>${formatNumber(Math.abs(entry.before - entry.after))}h</span><span>saved</span>`

    const groupTitle = document.createElement('div')
    groupTitle.className = 'bar-group-title'
    groupTitle.textContent = entry.type

    const beforeBar = document.createElement('div')
    beforeBar.className = 'bar-item bar-before'
    const beforeHeight = Math.max(12, Math.round((entry.before / maxValue) * 100))
    beforeBar.style.height = `${beforeHeight}%`
    beforeBar.innerHTML = `<span class="bar-value-label">${entry.before}</span>`

    const afterBar = document.createElement('div')
    afterBar.className = 'bar-item bar-after'
    const afterHeight = Math.max(12, Math.round((entry.after / maxValue) * 100))
    afterBar.style.height = `${afterHeight}%`
    afterBar.innerHTML = `<span class="bar-value-label">${entry.after}</span>`

    bars.append(beforeBar, afterBar)
    footer.append(delta, groupTitle)
    group.append(bars, footer)
    groups.appendChild(group)
    groupElements.push(group)

    const activateGroup = () => {
      chart.classList.add('is-dim')
      groupElements.forEach(item => item.classList.toggle('is-active', item === group))
    }

    group.addEventListener('mouseenter', activateGroup)
    ;[beforeBar, afterBar, delta, groupTitle].forEach(element => {
      element.addEventListener('mouseenter', activateGroup)
    })
  })

  groups.addEventListener('mouseleave', () => {
    chart.classList.remove('is-dim')
    groupElements.forEach(item => item.classList.remove('is-active'))
  })

  plot.appendChild(yAxis)
  plot.appendChild(groups)

  chart.appendChild(legend)
  chart.appendChild(plot)
}

function renderPieChart() {
  const svg = document.getElementById('pieChart')
  const legend = document.getElementById('pieLegend')
  const radius = 108
  const center = 160
  const viewPadding = 34
  const circumference = 2 * Math.PI * radius
  const topLane = window.pieSeries.reduce((best, current) => (current.value > best.value ? current : best), window.pieSeries[0])

  let offset = 0
  svg.innerHTML = ''
  svg.setAttribute('viewBox', `${-viewPadding} ${-viewPadding} ${320 + viewPadding * 2} ${320 + viewPadding * 2}`)
  legend.innerHTML = ''
  setText('pieDominantLane', `${topLane.label} ${topLane.value}%`)
  const pieInteractive = []

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
  defs.innerHTML = `
    <filter id="pieShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.08" />
    </filter>`
  svg.appendChild(defs)

  const ringBase = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  ringBase.setAttribute('cx', center)
  ringBase.setAttribute('cy', center)
  ringBase.setAttribute('r', radius)
  ringBase.setAttribute('fill', 'none')
  ringBase.setAttribute('stroke', '#edf2f7')
  ringBase.setAttribute('stroke-width', '44')
  svg.appendChild(ringBase)

  window.pieSeries.forEach(segment => {
    const segmentLength = circumference * (segment.value / 100)
    const gapLength = circumference - segmentLength
    const dashArray = `${segmentLength} ${gapLength}`
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'circle')

    path.setAttribute('cx', center)
    path.setAttribute('cy', center)
    path.setAttribute('r', radius)
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke-width', '44')
    path.setAttribute('stroke', segment.color)
    path.setAttribute('stroke-dasharray', dashArray)
    path.setAttribute('stroke-dashoffset', `${circumference * (1 - offset / 100)}`)
    path.setAttribute('transform', `rotate(-90 ${center} ${center})`)
    path.setAttribute('stroke-linecap', 'round')
    path.setAttribute('filter', 'url(#pieShadow)')
    path.style.transition = 'opacity 180ms ease, transform 180ms ease, stroke-width 180ms ease'
    svg.appendChild(path)

    const midAngle = -90 + (offset + segment.value / 2) * 3.6
    const radians = (midAngle * Math.PI) / 180
    const labelRadius = radius + 34
    const labelX = center + Math.cos(radians) * labelRadius
    const labelY = center + Math.sin(radians) * labelRadius
    const anchor =
      Math.cos(radians) > 0.25 ? 'start' : Math.cos(radians) < -0.25 ? 'end' : 'middle'

    const segmentLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    segmentLabel.setAttribute('x', labelX)
    segmentLabel.setAttribute('y', labelY)
    segmentLabel.setAttribute('text-anchor', anchor)
    segmentLabel.setAttribute('dominant-baseline', 'middle')
    segmentLabel.setAttribute('font-size', '18')
    segmentLabel.setAttribute('font-weight', '800')
    segmentLabel.setAttribute('fill', '#0d1f2d')
    segmentLabel.textContent = `${segment.value}%`
    segmentLabel.style.transition = 'opacity 180ms ease, transform 180ms ease'
    svg.appendChild(segmentLabel)

    const legendItem = document.createElement('div')
    legendItem.className = 'pie-legend-item'
    legendItem.innerHTML = `
      <span class="pie-swatch" style="background:${segment.color}"></span>
      <span class="pie-legend-label">${segment.label}</span>`
    legend.appendChild(legendItem)
    pieInteractive.push({ path, label: segmentLabel, legendItem, segment })

    offset += segment.value
  })

  function setActivePie(index) {
    const hasActive = index !== null
    legend.classList.toggle('is-dim', hasActive)
    pieInteractive.forEach((item, itemIndex) => {
      const isActive = itemIndex === index
      item.legendItem.classList.toggle('is-active', isActive)
      item.path.style.opacity = hasActive ? (isActive ? '1' : '0.28') : '1'
      item.label.style.opacity = hasActive ? (isActive ? '1' : '0.35') : '1'
      item.path.setAttribute('stroke-width', isActive ? '50' : '44')
      item.path.setAttribute('transform', `rotate(-90 ${center} ${center})`)
      item.label.style.transform = isActive ? 'scale(1.08)' : 'scale(1)'
    })
  }

  pieInteractive.forEach((item, index) => {
    const activate = () => setActivePie(index)
    item.path.addEventListener('mouseenter', activate)
    item.label.addEventListener('mouseenter', activate)
    item.legendItem.addEventListener('mouseenter', activate)
  })

  svg.addEventListener('mouseleave', event => {
    if (!svg.contains(event.relatedTarget)) {
      setActivePie(null)
    }
  })

  legend.addEventListener('mouseleave', event => {
    if (!legend.contains(event.relatedTarget)) {
      setActivePie(null)
    }
  })

  const centerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  centerCircle.setAttribute('cx', center)
  centerCircle.setAttribute('cy', center)
  centerCircle.setAttribute('r', 66)
  centerCircle.setAttribute('fill', '#ffffff')
  centerCircle.setAttribute('stroke', '#e2e8f0')
  centerCircle.setAttribute('stroke-width', '1')
  svg.appendChild(centerCircle)

  const centerCaption = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  centerCaption.setAttribute('x', center)
  centerCaption.setAttribute('y', center - 8)
  centerCaption.setAttribute('text-anchor', 'middle')
  centerCaption.setAttribute('font-size', '11')
  centerCaption.setAttribute('font-weight', '700')
  centerCaption.setAttribute('fill', '#64748b')
  centerCaption.textContent = 'Top lane'
  svg.appendChild(centerCaption)

  const centerText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  centerText.setAttribute('x', center)
  centerText.setAttribute('y', center + 16)
  centerText.setAttribute('text-anchor', 'middle')
  centerText.setAttribute('font-size', '18')
  centerText.setAttribute('font-weight', '800')
  centerText.setAttribute('fill', '#0d1f2d')
  centerText.textContent = topLane.label
  svg.appendChild(centerText)
}

function renderLineChart() {
  const svg = document.getElementById('lineChart')
  const labels = document.getElementById('lineLabels')
  const legend = document.getElementById('lineLegend')
  const width = 760
  const height = 360
  const padding = {
    top: 34,
    right: 86,
    bottom: 30,
    left: 62
  }
  const maxValue = 100

  svg.innerHTML = ''
  labels.innerHTML = ''
  legend.innerHTML = ''

  const afterAvg = window.dashboardMetrics.after.slaCompliance
  const beforeAvg = window.dashboardMetrics.before.slaCompliance
  const weeklyLift = afterAvg - beforeAvg
  setText('lineAfterAvg', `${Math.round(afterAvg)}%`)
  setText('lineWeeklyLift', `${weeklyLift >= 0 ? '+' : ''}${Math.round(weeklyLift)} pts`)

  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const baselineY = height - padding.bottom

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
  defs.innerHTML = `
    <linearGradient id="slaAreaGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0073AB" stop-opacity="0.2" />
      <stop offset="74%" stop-color="#0073AB" stop-opacity="0.04" />
      <stop offset="100%" stop-color="#0073AB" stop-opacity="0" />
    </linearGradient>
    <filter id="lineShadow" x="-10%" y="-20%" width="120%" height="150%">
      <feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#003F6B" flood-opacity="0.16" />
    </filter>`
  svg.appendChild(defs)

  const plotBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  plotBg.setAttribute('x', padding.left)
  plotBg.setAttribute('y', padding.top)
  plotBg.setAttribute('width', plotWidth)
  plotBg.setAttribute('height', plotHeight)
  plotBg.setAttribute('rx', '16')
  plotBg.setAttribute('fill', '#ffffff')
  plotBg.setAttribute('stroke', '#e2e8f0')
  svg.appendChild(plotBg)

  const yTicks = [0, 20, 40, 60, 80, 100]
  yTicks.forEach(value => {
    const y = baselineY - (value / maxValue) * plotHeight
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('x1', padding.left)
    line.setAttribute('x2', width - padding.right)
    line.setAttribute('y1', y)
    line.setAttribute('y2', y)
    line.setAttribute('stroke', value === 0 ? '#cbd5e1' : '#e2e8f0')
    line.setAttribute('stroke-width', '1')
    line.setAttribute('opacity', value === 0 ? '0.8' : '0.7')
    svg.appendChild(line)

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    label.setAttribute('x', padding.left - 12)
    label.setAttribute('y', y + 4)
    label.setAttribute('text-anchor', 'end')
    label.setAttribute('font-size', '12')
    label.setAttribute('font-weight', '700')
    label.setAttribute('fill', '#64748b')
    label.textContent = `${value}%`
    svg.appendChild(label)
  })

  window.lineSeries.labels.forEach((day, index) => {
    const x = padding.left + (index * plotWidth) / (window.lineSeries.labels.length - 1)
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    tick.setAttribute('x1', x)
    tick.setAttribute('x2', x)
    tick.setAttribute('y1', padding.top)
    tick.setAttribute('y2', baselineY)
    tick.setAttribute('stroke', '#e2e8f0')
    tick.setAttribute('stroke-width', '1')
    tick.setAttribute('opacity', '0.45')
    svg.appendChild(tick)
  })

  const legendItems = [
    { label: 'Simulated Priority', color: '#003F6B', type: 'solid' },
    { label: 'Current FCFS', color: '#A8C4D4', type: 'dashed' }
  ]

  legendItems.forEach(item => {
    const legendItem = document.createElement('div')
    legendItem.className = 'line-legend-item'
    legendItem.innerHTML = `
      <span class="line-legend-dot ${item.type}" style="background:${item.color}; border-color:${item.color}; color:${item.color};"></span>
      <span>${item.label}</span>`
    legend.appendChild(legendItem)
  })

  function point(index, value) {
    const x = padding.left + (index * plotWidth) / (window.lineSeries.labels.length - 1)
    const y = baselineY - (value / maxValue) * plotHeight
    return { x, y }
  }

  function smoothPath(points) {
    return points.reduce((path, pointValue, index) => {
      if (index === 0) {
        return `M ${pointValue.x} ${pointValue.y}`
      }

      const previous = points[index - 1]
      const midX = (previous.x + pointValue.x) / 2
      return `${path} C ${midX} ${previous.y}, ${midX} ${pointValue.y}, ${pointValue.x} ${pointValue.y}`
    }, '')
  }

  function drawLine(data, options) {
    const points = data.map((value, index) => point(index, value))
    const pathD = smoothPath(points)

    if (options.fill) {
      const fillD = `${pathD} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`
      const fillPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      fillPath.setAttribute('d', fillD)
      fillPath.setAttribute('fill', options.fill)
      fillPath.setAttribute('pointer-events', 'none')
      svg.appendChild(fillPath)
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', pathD)
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', options.stroke)
    path.setAttribute('stroke-width', options.strokeWidth)
    path.setAttribute('stroke-linecap', 'round')
    path.setAttribute('stroke-linejoin', 'round')
    if (options.dashArray) {
      path.setAttribute('stroke-dasharray', options.dashArray)
    }
    if (options.shadow) {
      path.setAttribute('filter', 'url(#lineShadow)')
    }
    svg.appendChild(path)

    points.forEach((p, index) => {
      const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      halo.setAttribute('cx', p.x)
      halo.setAttribute('cy', p.y)
      halo.setAttribute('r', index === points.length - 1 ? 8 : 6)
      halo.setAttribute('fill', '#ffffff')
      halo.setAttribute('stroke', options.stroke)
      halo.setAttribute('stroke-width', '2')
      halo.setAttribute('opacity', options.muted ? '0.72' : '1')
      halo.style.transition = 'r 180ms ease, stroke-width 180ms ease, opacity 180ms ease'
      svg.appendChild(halo)

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      circle.setAttribute('cx', p.x)
      circle.setAttribute('cy', p.y)
      circle.setAttribute('r', index === points.length - 1 ? 4.5 : 3.5)
      circle.setAttribute('fill', options.stroke)
      circle.style.transition = 'r 180ms ease, opacity 180ms ease'
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
      title.textContent = `${window.lineSeries.labels[index]}: ${data[index]}% ${options.name}`
      circle.appendChild(title)
      svg.appendChild(circle)

      let hoverTag = null
      let hoverLabel = null

      if (index !== points.length - 1) {
        hoverTag = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        hoverTag.setAttribute('x', p.x - 24)
        hoverTag.setAttribute('y', p.y - 34)
        hoverTag.setAttribute('width', '48')
        hoverTag.setAttribute('height', '22')
        hoverTag.setAttribute('rx', '11')
        hoverTag.setAttribute('fill', '#ffffff')
        hoverTag.setAttribute('stroke', options.stroke)
        hoverTag.setAttribute('stroke-width', '1')
        hoverTag.style.opacity = '0'
        hoverTag.style.pointerEvents = 'none'
        hoverTag.style.transition = 'opacity 160ms ease'
        svg.appendChild(hoverTag)

        hoverLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        hoverLabel.setAttribute('x', p.x)
        hoverLabel.setAttribute('y', p.y - 19)
        hoverLabel.setAttribute('text-anchor', 'middle')
        hoverLabel.setAttribute('font-size', '11')
        hoverLabel.setAttribute('font-weight', '700')
        hoverLabel.setAttribute('fill', options.stroke)
        hoverLabel.textContent = `${data[index]}%`
        hoverLabel.style.opacity = '0'
        hoverLabel.style.pointerEvents = 'none'
        hoverLabel.style.transition = 'opacity 160ms ease'
        svg.appendChild(hoverLabel)
      }

      if (index === points.length - 1) {
        const tag = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        const tagWidth = 58
        const tagHeight = 24
        tag.setAttribute('x', p.x + 11)
        tag.setAttribute('y', p.y + (options.fill ? -30 : 9))
        tag.setAttribute('width', tagWidth)
        tag.setAttribute('height', tagHeight)
        tag.setAttribute('rx', '12')
        tag.setAttribute('fill', '#ffffff')
        tag.setAttribute('stroke', options.stroke)
        tag.setAttribute('stroke-width', '1')
        tag.style.transition = 'transform 160ms ease, opacity 160ms ease'
        svg.appendChild(tag)

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        label.setAttribute('x', p.x + 11 + tagWidth / 2)
        label.setAttribute('y', p.y + (options.fill ? -14 : 25))
        label.setAttribute('text-anchor', 'middle')
        label.setAttribute('font-size', '12')
        label.setAttribute('font-weight', '700')
        label.setAttribute('fill', options.stroke)
        label.textContent = `${data[index]}%`
        label.style.transition = 'transform 160ms ease, fill 160ms ease'
        svg.appendChild(label)

        const activateFinalLabel = () => {
          tag.style.transform = 'translateY(-6px)'
          label.style.transform = 'translateY(-6px)'
          label.setAttribute('fill', options.hoverStroke || options.stroke)
        }

        const resetFinalLabel = () => {
          tag.style.transform = 'translateY(0)'
          label.style.transform = 'translateY(0)'
          label.setAttribute('fill', options.stroke)
        }

        halo.addEventListener('mouseenter', activateFinalLabel)
        circle.addEventListener('mouseenter', activateFinalLabel)
        halo.addEventListener('mouseleave', resetFinalLabel)
        circle.addEventListener('mouseleave', resetFinalLabel)
      }

      const activatePoint = () => {
        halo.setAttribute('r', index === points.length - 1 ? '11' : '9')
        halo.setAttribute('stroke-width', '3')
        halo.setAttribute('stroke', options.hoverStroke || options.stroke)
        circle.setAttribute('r', index === points.length - 1 ? '6' : '5')
        circle.setAttribute('fill', options.hoverStroke || options.stroke)
        if (hoverTag && hoverLabel) {
          hoverTag.setAttribute('stroke', options.hoverStroke || options.stroke)
          hoverLabel.setAttribute('fill', options.hoverStroke || options.stroke)
          hoverLabel.setAttribute('font-weight', '800')
          hoverTag.style.opacity = '1'
          hoverLabel.style.opacity = '1'
        }
      }

      const resetPoint = () => {
        halo.setAttribute('r', index === points.length - 1 ? '8' : '6')
        halo.setAttribute('stroke-width', '2')
        halo.setAttribute('stroke', options.stroke)
        circle.setAttribute('r', index === points.length - 1 ? '4.5' : '3.5')
        circle.setAttribute('fill', options.stroke)
        if (hoverTag && hoverLabel) {
          hoverTag.setAttribute('stroke', options.stroke)
          hoverLabel.setAttribute('fill', options.stroke)
          hoverLabel.setAttribute('font-weight', '700')
          hoverTag.style.opacity = '0'
          hoverLabel.style.opacity = '0'
        }
      }

      halo.addEventListener('mouseenter', activatePoint)
      circle.addEventListener('mouseenter', activatePoint)
      halo.addEventListener('mouseleave', resetPoint)
      circle.addEventListener('mouseleave', resetPoint)
    })
  }

  drawLine(window.lineSeries.before, {
    name: 'before',
    stroke: '#A8C4D4',
    hoverStroke: '#5E8FB1',
    strokeWidth: 2.5,
    dashArray: '8 8',
    muted: true
  })

  drawLine(window.lineSeries.after, {
    name: 'after',
    stroke: '#003F6B',
    strokeWidth: 4,
    fill: 'url(#slaAreaGradient)',
    shadow: true
  })

  labels.style.gridTemplateColumns = `repeat(${window.lineSeries.labels.length}, minmax(0, 1fr))`
  window.lineSeries.labels.forEach(day => {
    const label = document.createElement('div')
    label.className = 'line-label'
    label.textContent = day
    labels.appendChild(label)
  })
}

function renderKpisAccent() {
  const cardContainer = document.getElementById('kpiCards')
  cardContainer.innerHTML = ''

  const metrics = [
    { label: 'Average FRT', before: window.dashboardMetrics.before.frt, after: window.dashboardMetrics.after.frt, unit: 'h', better: 'lower' },
    { label: 'SLA Compliance Rate', before: window.dashboardMetrics.before.slaCompliance, after: window.dashboardMetrics.after.slaCompliance, unit: '%', better: 'higher' },
    { label: 'Average Assignment Delay', before: window.dashboardMetrics.before.assignmentDelay, after: window.dashboardMetrics.after.assignmentDelay, unit: 'min', better: 'lower' },
    { label: 'Priority Handling Consistency', before: window.dashboardMetrics.before.urgentOnTime, after: window.dashboardMetrics.after.urgentOnTime, unit: '%', better: 'higher' },
    { label: 'Workload Distribution Index', before: window.dashboardMetrics.before.workload, after: window.dashboardMetrics.after.workload, unit: '', better: 'lower' }
  ]

  metrics.forEach(metric => {
    const changeAmount = metric.after - metric.before
    const percentChange = metric.before === 0 ? 0 : Math.round((changeAmount / metric.before) * 100)
    const noChange = percentChange === 0
    const improved = metric.better === 'lower' ? metric.after < metric.before : metric.after > metric.before
    const arrow = noChange ? '&rarr;' : improved ? (metric.better === 'lower' ? '&#9660;' : '&#9650;') : (metric.better === 'lower' ? '&#9650;' : '&#9660;')
    const changeLabel = noChange ? 'no change' : improved ? 'improved' : 'worse'
    const changeText = `${percentChange > 0 ? '+' : ''}${percentChange}% ${changeLabel}`
    const directionLabel = metric.better === 'lower' ? 'Lower better' : 'Higher better'
    const toneClass = metric.better === 'lower' ? 'kpi-card--lower' : 'kpi-card--higher'
    const changeClass = noChange ? 'kpi-change-neutral' : improved ? 'kpi-change-improved' : 'kpi-change-worse'

    const card = document.createElement('div')
    card.className = `kpi-card ${toneClass}`
    card.innerHTML = `
      <div class="kpi-card-head">
        <div class="kpi-card-title">${metric.label}</div>
        <div class="kpi-direction">${directionLabel}</div>
      </div>
      <div class="kpi-card-values">
        <div class="kpi-value-block">
          <span class="kpi-value"><span class="kpi-number">${formatNumber(metric.before)}</span><span class="kpi-unit">${metric.unit}</span></span>
          <span class="kpi-label">Current FCFS</span>
        </div>
        <div class="kpi-arrow">&rarr;</div>
        <div class="kpi-value-block">
          <span class="kpi-value"><span class="kpi-number">${formatNumber(metric.after)}</span><span class="kpi-unit">${metric.unit}</span></span>
          <span class="kpi-label">Simulated Priority</span>
        </div>
      </div>
      <div class="kpi-change ${changeClass}">
        <span class="kpi-change-arrow">${arrow}</span>
        <span>${changeText}</span>
      </div>
    `

    cardContainer.appendChild(card)
  })
}

function initDashboard() {
  loadAndComputeMetrics()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard)
} else {
  initDashboard()
}
