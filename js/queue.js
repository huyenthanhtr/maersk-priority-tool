// queue.js - Case Queue Page (Page 3) Logic
// Real-time case list with filtering, pagination, and status management

let allTickets = []
let filteredTickets = []
let currentPage = 1
const ITEMS_PER_PAGE = 20
let _autoRefreshInterval = 15000 // 15 seconds
let _autoRefreshHandle = null
let _isLoading = false

// Get SLA target based on lane
function getSLATarget(lane) {
  return lane === 'Critical' ? '1h' : lane === 'Priority' ? '2h' : '4h'
}

// escape HTML for safe rendering
function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Classify lane based on priority score
function getLane(score) {
  if (score >= 80) return 'Critical'
  if (score >= 50) return 'Priority'
  return 'Standard'
}

// Format date/time from created_at
function formatDateTime(dateTime) {
  const match = String(dateTime || '').match(/^(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2})/)
  if (!match) return '-'
  const [, year, month, day, hour, minute] = match
  return `${day}/${month}/${year} ${hour}:${minute}`
}

function getStatusClass(status) {
  if (status === 'Met') return 'status-dropdown status-dropdown-met'
  if (status === 'Missed') return 'status-dropdown status-dropdown-missed'
  return 'status-dropdown'
}

// Load and process tickets
async function loadTickets() {
  try {
    if (_isLoading) return
    _isLoading = true
    // Load base dataset
    let tickets = []
    // Prefer server endpoint if available so persisted tickets are loaded
    try {
      const resApi = await fetch('/api/tickets')
      if (resApi && resApi.ok) {
        const dataApi = await resApi.json()
        tickets = Array.isArray(dataApi) ? dataApi : dataApi.tickets || []
      } else {
        // fallback to static JSON file if API not available
        const res = await fetch('../data/tickets.json')
        const data = await res.json()
        tickets = data.tickets || []
      }
    } catch (e) {
      console.warn('Could not load tickets from server or static file, proceeding with local tickets only', e)
    }

    // Load locally saved tickets (from scoring page fallback)
    try {
      const stored = localStorage.getItem('localTickets')
      const local = stored ? JSON.parse(stored) : []
      // merge by ticket_id, prefer local newer entries
      const map = {}
      tickets.forEach(t => { map[t.ticket_id || t.id] = t })
      local.forEach(t => { map[t.ticket_id || t.id] = t })
      tickets = Object.values(map)
    } catch (e) {
      console.warn('Failed to read local tickets', e)
    }

    allTickets = tickets.map(ticket => {
      // Calculate priority score using scoringEngine (normalize fields if needed)
      const urgent = ticket.urgent_flag || ticket.urgentFlag || 'No'
      const lead = ticket.lead_time_days || ticket.lead_time_days === 0 ? ticket.lead_time_days : ticket.lead_time_days
      const doc = ticket.document_type || ticket.requestType || ticket.documentType || 'General Inquiry'
      const cust = ticket.customer_tier || ticket.customerTier || ticket.customer_tier || 'Standard'

      const score = calculateScore({
        urgent_flag: urgent,
        lead_time_days: lead,
        document_type: doc,
        customer_tier: cust
      })

        const createdTs = ticket.created_at ? Date.parse(ticket.created_at.replace(' ', 'T')) : Date.now()

        return {
          ticket_id: ticket.ticket_id || ticket.id || ticket.TKT,
          created_at: ticket.created_at,
          _created_ts: Number.isFinite(createdTs) ? createdTs : Date.now(),
          factory_vendor: ticket.factory_vendor || ticket.factoryVendor || ticket.vendor || '',
          document_type: doc,
          urgent_flag: urgent,
          lead_time_days: Number(ticket.lead_time_days) || 0,
          customer_tier: cust,
          priority_score: score,
          lane: getLane(score),
          sla_target: getSLATarget(getLane(score)),
          first_response_time_hours: Number(ticket.first_response_time_hours) || 0,
          sla_status: ticket.sla_status || ticket.status || 'Met',
          assigned_agent: ticket.assigned_agent || ticket.assignedPIC || ''
        }
    })

      // Sort by created_at (newest first), fallback to priority score
      allTickets.sort((a, b) => {
        if (b._created_ts !== a._created_ts) return b._created_ts - a._created_ts
        return b.priority_score - a.priority_score
      })

    // Initialize filtering
    filteredTickets = [...allTickets]
    updateLaneCounts()
    renderPage(1)
    setupPagination()
    _isLoading = false
  } catch (error) {
    console.error('Error loading tickets:', error)
    document.getElementById('queueBody').innerHTML = 
      `<tr><td colspan="12" class="loading-text">Error loading tickets</td></tr>`
    _isLoading = false
  }
}

// Update lane count badges
function updateLaneCounts() {
  document.getElementById('countCritical').textContent =
    filteredTickets.filter(t => t.lane === 'Critical').length
  document.getElementById('countPriority').textContent =
    filteredTickets.filter(t => t.lane === 'Priority').length
  document.getElementById('countStandard').textContent =
    filteredTickets.filter(t => t.lane === 'Standard').length
  document.getElementById('countTotal').textContent = filteredTickets.length
}

// Apply all filters
function applyFilters() {
  const lane = document.getElementById('filterLane').value
  const urgency = document.getElementById('filterUrgency').value
  const type = document.getElementById('filterType').value
  const status = document.getElementById('filterStatus').value
  const search = document.getElementById('filterSearch') ? document.getElementById('filterSearch').value.trim().toLowerCase() : ''

  filteredTickets = allTickets.filter(ticket => {
    if (lane && ticket.lane !== lane) return false
    if (urgency && ticket.urgent_flag !== urgency) return false
    if (type && ticket.document_type !== type) return false
    if (status && ticket.sla_status !== status) return false
    if (search) {
      const hay = [ticket.ticket_id, ticket.document_type, ticket.assigned_agent, ticket.customer_tier, ticket.created_at, ticket.factory_vendor].join(' ').toLowerCase()
      if (!hay.includes(search)) return false
    }
    return true
  })

  currentPage = 1
  updateLaneCounts()
  renderPage(1)
  setupPagination()
}

// Render table for current page
function renderPage(page) {
  const start = (page - 1) * ITEMS_PER_PAGE
  const end = start + ITEMS_PER_PAGE
  const pageTickets = filteredTickets.slice(start, end)

  const tbody = document.getElementById('queueBody')
  
  // Update result info
  const total = filteredTickets.length
  const showing = Math.min(ITEMS_PER_PAGE, total - start)
  document.getElementById('resultInfo').textContent =
    `Showing ${start + 1}–${start + showing} of ${total} tickets`

  if (pageTickets.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" class="loading-text">No tickets match the selected filters.</td></tr>`
    return
  }

  tbody.innerHTML = pageTickets.map(t => {
    const rowClass = t.lane === 'Critical' ? 'row-critical'
                   : t.lane === 'Priority' ? 'row-priority'
                   : 'row-standard'

    const badgeClass = t.lane === 'Critical' ? 'badge-critical'
                     : t.lane === 'Priority' ? 'badge-priority'
                     : 'badge-standard'

    const urgencyLabel = t.urgent_flag === 'Yes' ? 'Yes' : 'No'

    return `
      <tr class="${rowClass}">
        <td><strong>${t.ticket_id}</strong></td>
        <td>${escapeHtml(t.factory_vendor || '')}</td>
        <td>${formatDateTime(t.created_at)}</td>
        <td>${escapeHtml(t.document_type)}</td>
        <td>${urgencyLabel}</td>
        <td class="col-lead-time">${t.lead_time_days}</td>
        <td>${t.customer_tier}</td>
        <td class="score-cell"><strong>${t.priority_score}</strong></td>
        <td><span class="badge ${badgeClass}">${t.lane}</span></td>
        <td>${t.sla_target}</td>
        <td>${t.first_response_time_hours.toFixed(2)}</td>
        <td class="col-status">
          <select class="${getStatusClass(t.sla_status)}" onchange="updateStatus('${t.ticket_id}', this.value); this.className = getStatusClass(this.value);">
            <option value="Met" ${t.sla_status === 'Met' ? 'selected' : ''}>Met</option>
            <option value="Missed" ${t.sla_status === 'Missed' ? 'selected' : ''}>Missed</option>
          </select>
        </td>
      </tr>
    `
  }).join('')

  currentPage = page
}

// Setup pagination buttons
function setupPagination() {
  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE)
  const pagination = document.getElementById('pagination')
  pagination.innerHTML = ''

  if (totalPages <= 1) return

  // Previous button
  if (currentPage > 1) {
    const prev = document.createElement('button')
    prev.textContent = '← Previous'
    prev.onclick = () => {
      renderPage(currentPage - 1)
      setupPagination()
    }
    pagination.appendChild(prev)
  }

  // Page numbers
  for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
    const btn = document.createElement('button')
    btn.textContent = i
    btn.className = i === currentPage ? 'active' : ''
    btn.onclick = () => {
      renderPage(i)
      setupPagination()
    }
    pagination.appendChild(btn)
  }

  // Next button
  if (currentPage < totalPages) {
    const next = document.createElement('button')
    next.textContent = 'Next →'
    next.onclick = () => {
      renderPage(currentPage + 1)
      setupPagination()
    }
    pagination.appendChild(next)
  }
}

// Update ticket status
function updateStatus(ticketId, newStatus) {
  const ticket = allTickets.find(t => t.ticket_id === ticketId)
  if (ticket) {
    ticket.sla_status = newStatus
    console.log(`Ticket ${ticketId} status updated to: ${newStatus}`)

    // Persist status change to localTickets if present
    try {
      const key = 'localTickets'
      const stored = localStorage.getItem(key)
      const arr = stored ? JSON.parse(stored) : []
      const idx = arr.findIndex(t => (t.ticket_id || t.id) === ticketId)
      if (idx >= 0) {
        arr[idx].sla_status = newStatus
      } else {
        // if not local, add a small patch record
        arr.push({ ticket_id: ticketId, sla_status: newStatus })
      }
      localStorage.setItem(key, JSON.stringify(arr))
    } catch (e) {
      console.warn('Failed to persist status change locally', e)
    }
  }
}

// Export currently filtered tickets to CSV
function exportCsv() {
  const rows = filteredTickets.map(t => ({
    ticket_id: t.ticket_id,
    created_at: t.created_at,
    document_type: t.document_type,
    urgent_flag: t.urgent_flag,
    lead_time_days: t.lead_time_days,
    customer_tier: t.customer_tier,
    priority_score: t.priority_score,
    lane: t.lane,
    sla_target: t.sla_target,
    first_response_time_hours: t.first_response_time_hours,
    sla_status: t.sla_status
  }))

  const header = Object.keys(rows[0] || {}).join(',')
  const csv = [header, ...rows.map(r => Object.values(r).map(v => `"${String(v || '')}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cases_export_${new Date().toISOString().slice(0,10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Listen for ticketsUpdated (from scoring page)
window.addEventListener('ticketsUpdated', event => {
  // when notified, reload tickets fully so created timestamps and vendor fields are recalculated
  try {
    loadTickets().then(() => {
      try { applyFilters(); setupPagination() } catch (e) {}
    })
  } catch (e) {
    console.warn('Failed to reload tickets after update', e)
  }
})

// wire export and search
document.getElementById('filterSearch')?.addEventListener('input', applyFilters)
document.getElementById('btnExport')?.addEventListener('click', exportCsv)

// Event listeners
document.getElementById('filterLane').addEventListener('change', applyFilters)
document.getElementById('filterUrgency').addEventListener('change', applyFilters)
document.getElementById('filterType').addEventListener('change', applyFilters)
document.getElementById('filterStatus').addEventListener('change', applyFilters)

document.getElementById('btnReset').addEventListener('click', () => {
  document.getElementById('filterLane').value = ''
  document.getElementById('filterUrgency').value = ''
  document.getElementById('filterType').value = ''
  document.getElementById('filterStatus').value = ''
  applyFilters()
})

// Load on page ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadTickets)
} else {
  loadTickets()
}

// Start auto-refresh to reload tickets every 30s (keeps UI up-to-date)
function startAutoRefresh() {
  if (_autoRefreshHandle) return
  _autoRefreshHandle = setInterval(() => {
    // reload tickets silently and reapply filters
    loadTickets().then(() => {
      try { applyFilters(); setupPagination(); } catch(e){}
    })
  }, _autoRefreshInterval)
}

function stopAutoRefresh() {
  if (_autoRefreshHandle) {
    clearInterval(_autoRefreshHandle)
    _autoRefreshHandle = null
  }
}

// kick off auto-refresh after initial load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startAutoRefresh)
} else {
  startAutoRefresh()
}
