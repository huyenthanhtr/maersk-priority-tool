// queue.js — Case Queue Page Logic

let allTickets = []

async function loadTickets() {
  const res = await fetch('../data/tickets.json')
  const data = await res.json()

  allTickets = data.map(ticket => {
    const score = calculateScore({
      urgencyFlag: ticket.urgencyFlag,
      etdDays: ticket.etdDays,
      requestType: ticket.requestType,
      customerTier: ticket.customerTier
    })
    const lane = getLane(score)
    const sla = getSLA(lane)
    return { ...ticket, score, lane, sla }
  })

  allTickets.sort((a, b) => b.score - a.score)
  updateLaneCounts(allTickets)
  renderTable(allTickets)
}

function updateLaneCounts(tickets) {
  document.getElementById('countCritical').textContent =
    tickets.filter(t => t.lane === 'Critical').length
  document.getElementById('countPriority').textContent =
    tickets.filter(t => t.lane === 'Priority').length
  document.getElementById('countStandard').textContent =
    tickets.filter(t => t.lane === 'Standard').length
  document.getElementById('countTotal').textContent = tickets.length
}

function renderTable(tickets) {
  const tbody = document.getElementById('queueBody')
  document.getElementById('resultInfo').textContent =
    `Showing ${tickets.length} of ${allTickets.length} tickets`

  if (tickets.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="loading-text">No tickets match the selected filters.</td></tr>`
    return
  }

  tbody.innerHTML = tickets.map(t => {
    const rowClass = t.lane === 'Critical' ? 'row-critical'
                   : t.lane === 'Priority' ? 'row-priority'
                   : 'row-standard'

    const urgencyLabel = t.urgencyFlag === 'urgent' ? 'Urgent'
                       : t.urgencyFlag === 'semi_urgent' ? 'Semi-urgent'
                       : 'Normal'

    const urgencyClass = t.urgencyFlag === 'urgent' ? 'urgency-urgent'
                       : t.urgencyFlag === 'semi_urgent' ? 'urgency-semi'
                       : 'urgency-normal'

    const badgeClass = getLaneBadgeClass(t.lane)
    const statusClass = t.status === 'Met' ? 'status-met' : 'status-missed'

    return `
      <tr class="${rowClass}">
        <td><strong>${t.id}</strong></td>
        <td>${t.requestType}</td>
        <td class="${urgencyClass}">${urgencyLabel}</td>
        <td>${t.etdDays} day${t.etdDays === 1 ? '' : 's'}</td>
        <td>${t.customerTier}</td>
        <td class="score-cell">${t.score}</td>
        <td><span class="badge ${badgeClass}">${t.lane}</span></td>
        <td>${t.sla}</td>
        <td class="${statusClass}">${t.status}</td>
      </tr>
    `
  }).join('')
}

function applyFilters() {
  const lane = document.getElementById('filterLane').value
  const type = document.getElementById('filterType').value
  const status = document.getElementById('filterStatus').value

  let filtered = allTickets

  if (lane !== 'all') filtered = filtered.filter(t => t.lane === lane)
  if (type !== 'all') filtered = filtered.filter(t => t.requestType === type)
  if (status !== 'all') filtered = filtered.filter(t => t.status === status)

  renderTable(filtered)
}

document.getElementById('filterLane').addEventListener('change', applyFilters)
document.getElementById('filterType').addEventListener('change', applyFilters)
document.getElementById('filterStatus').addEventListener('change', applyFilters)

document.getElementById('btnReset').addEventListener('click', () => {
  document.getElementById('filterLane').value = 'all'
  document.getElementById('filterType').value = 'all'
  document.getElementById('filterStatus').value = 'all'
  renderTable(allTickets)
})

loadTickets()