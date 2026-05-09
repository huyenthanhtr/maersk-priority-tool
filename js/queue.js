// queue.js - Case Queue Page Logic

let allTickets = []

const DOCUMENT_TYPE_MAP = {
  'B/L': 'B/L Amendment'
}

const VENDOR_TIER_MAP = {
  'MekongRice Export': 'Key Account',
  'Hanoi Textile Ltd': 'Key Account',
  'SunFurniture Corp': 'Key Account',
  'PhuMy Plastics': 'Standard',
  'VN Rubber Co.': 'Standard',
  'VinaTech Components': 'Standard',
  'SaiGon Foam Co.': 'Occasional',
  'EcoWood Vietnam': 'Occasional',
  'Delta Seafood': 'Occasional',
  'Viet Tin Garment': 'Occasional'
}

async function loadTickets() {
  const res = await fetch('../data/tickets.json')
  const data = await res.json()
  const tickets = Array.isArray(data) ? data : data.tickets

  allTickets = tickets.map(ticket => {
    const normalizedTicket = normalizeTicket(ticket)
    const score = calculateScore({
      urgencyFlag: normalizedTicket.urgencyFlag,
      etdDays: normalizedTicket.etdDays,
      requestType: normalizedTicket.requestType,
      customerTier: normalizedTicket.customerTier
    })
    const lane = getLane(score)
    const sla = getSLA(lane)
    return { ...normalizedTicket, score, lane, sla }
  })

  allTickets.sort((a, b) => b.score - a.score)
  updateLaneCounts(allTickets)
  renderTable(allTickets)
}

function normalizeTicket(ticket) {
  const requestType = ticket.requestType || getRequestType(ticket.document_type)
  const customerTier = ticket.customerTier
                    || ticket.customer_tier
                    || VENDOR_TIER_MAP[ticket.factory_vendor]
                    || 'Standard'
  const etdDays = Number.isFinite(Number(ticket.etdDays))
                ? Number(ticket.etdDays)
                : getETDDays(ticket.created_at, ticket.etd)

  return {
    ...ticket,
    id: ticket.id || ticket.ticket_id,
    requestType,
    urgencyFlag: ticket.urgencyFlag || getUrgencyFlag(ticket.urgent_flag),
    etdDays,
    customerTier,
    assignedPIC: ticket.assignedPIC || ticket.assigned_agent,
    createdTime: ticket.createdTime || getTime(ticket.created_at),
    firstResponseTime: ticket.firstResponseTime || getTime(ticket.first_response_at),
    status: ticket.status || getStatus(ticket.sla_status)
  }
}

function getRequestType(documentType) {
  return DOCUMENT_TYPE_MAP[documentType] || documentType || 'General Inquiry'
}

function getUrgencyFlag(urgentFlag) {
  return urgentFlag === 'Yes' ? 'urgent' : 'normal'
}

function getStatus(slaStatus) {
  return slaStatus === 'Breached' ? 'Missed' : slaStatus || 'Met'
}

function getTime(dateTime) {
  const match = String(dateTime || '').match(/(\d{2}:\d{2})$/)
  return match ? match[1] : ''
}

function getDateUTC(dateValue) {
  const match = String(dateValue || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  return Date.UTC(year, month, day)
}

function getETDDays(createdAt, etd) {
  const createdDate = getDateUTC(createdAt)
  const etdDate = getDateUTC(etd)

  if (createdDate === null || etdDate === null) return 0

  const days = Math.round((etdDate - createdDate) / 86400000)
  return Math.max(0, days)
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
