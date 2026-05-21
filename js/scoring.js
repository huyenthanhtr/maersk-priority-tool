// scoring.js - Page 1 Priority Scoring logic

const scoringForm = document.getElementById('scoringForm')
const requestTypeInput = document.getElementById('requestType')
const channelInput = document.getElementById('channel')
const orderNumberInput = document.getElementById('orderNumber')
const factoryVendorInput = document.getElementById('factoryVendor')
const vendorList = document.getElementById('vendorList')
const etdDaysInput = document.getElementById('etdDays')
const customerTierInput = document.getElementById('customerTier')
const otherNoteGroup = document.getElementById('otherNoteGroup')
const otherNoteInput = document.getElementById('otherNote')
const validationMessage = document.getElementById('validationMessage')
const saveButton = document.getElementById('btnSave')

const resultCard = document.getElementById('resultCard')
const scoreValue = document.getElementById('scoreValue')
const laneBadge = document.getElementById('laneBadge')
const laneCaption = document.getElementById('laneCaption')
const slaValue = document.getElementById('slaValue')
const actionValue = document.getElementById('actionValue')
const ticketIdValue = document.getElementById('ticketIdValue')
const assignedAgentValue = document.getElementById('assignedAgentValue')
const toastContainer = document.getElementById('toastContainer')
const resetButton = document.getElementById('btnReset')

const VENDOR_STORAGE_KEY = 'priorityToolVendorSuggestions'
const AGENT_COUNTS_STORAGE_KEY = 'priorityToolAgentCounts'
const SCORING_STATE_KEY = 'priorityToolScoringState'

let ticketsData = []
let vendorEntries = []
let vendorMap = {}
let agentPool = []
let currentResult = null
let nextTicketNumber = 1001
let toastTimer = null

function normalizeText(value) {
  return String(value || '').trim()
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getSelectedUrgentFlag() {
  const selected = document.querySelector('input[name="urgentFlag"]:checked')
  return selected ? selected.value : 'no'
}

function isUrgentValue(value) {
  return ['yes', 'urgent'].includes(String(value || '').trim().toLowerCase())
}

function clearValidation() {
  validationMessage.hidden = true
  validationMessage.textContent = ''
  requestTypeInput.classList.remove('input-error')
  etdDaysInput.classList.remove('input-error')
  customerTierInput.classList.remove('input-error')
  channelInput.classList.remove('input-error')
  factoryVendorInput.classList.remove('input-error')
}

function clearToast() {
  if (!toastContainer) return
  toastContainer.innerHTML = ''
  toastContainer.classList.add('hidden')
  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }
}

function showToast(message) {
  if (!toastContainer) return
  clearToast()
  toastContainer.classList.remove('hidden')

  const toast = document.createElement('div')
  toast.className = 'toast-message show weak'
  toast.textContent = message
  toastContainer.appendChild(toast)

  toastTimer = setTimeout(() => {
    toast.classList.remove('show')
    toastTimer = setTimeout(() => {
      clearToast()
    }, 240)
  }, 3200)
}

function showValidation(message, field) {
  validationMessage.hidden = false
  validationMessage.textContent = message

  if (field) {
    field.classList.add('input-error')
    field.focus()
  }
}

function getStoredVendors() {
  try {
    const stored = localStorage.getItem(VENDOR_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    return []
  }
}

function saveVendorSuggestion(name, tier) {
  const normalized = normalizeText(name)
  if (!normalized) return
  if (vendorMap[normalized.toLowerCase()]) return

  const stored = getStoredVendors()
  stored.push({ name: normalized, customerTier: tier || 'Standard' })
  localStorage.setItem(VENDOR_STORAGE_KEY, JSON.stringify(stored))
  vendorEntries.push({ name: normalized, customerTier: tier || 'Standard' })
  vendorMap[normalized.toLowerCase()] = { name: normalized, customerTier: tier || 'Standard' }
  vendorList.innerHTML += `<option value="${escapeHtml(normalized)}">`
}

function getVendorEntry(name) {
  return vendorMap[normalizeText(name).toLowerCase()] || null
}

function buildVendorList(data) {
  const stored = getStoredVendors()
  const merged = [...data]
  const lowerNames = new Set(data.map(v => v.name.toLowerCase()))

  stored.forEach(storedItem => {
    if (!lowerNames.has(storedItem.name.toLowerCase())) {
      merged.push(storedItem)
    }
  })

  vendorEntries = merged.map(entry => ({
    name: normalizeText(entry.name),
    customerTier: normalizeText(entry.customerTier) || 'Standard'
  }))

  vendorMap = {}
  vendorEntries.forEach(entry => {
    vendorMap[entry.name.toLowerCase()] = entry
  })

  vendorList.innerHTML = vendorEntries
    .map(entry => `<option value="${escapeHtml(entry.name)}">`)
    .join('')
}

function loadAgentAssignmentCounts() {
  try {
    const stored = localStorage.getItem(AGENT_COUNTS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function saveAgentAssignmentCounts() {
  const counts = {}
  agentPool.forEach(agent => {
    counts[agent.name] = agent.assignedCount || 0
  })
  localStorage.setItem(AGENT_COUNTS_STORAGE_KEY, JSON.stringify(counts))
}

function initAgentPool(data) {
  const counts = loadAgentAssignmentCounts()
  agentPool = data.map(agent => ({
    name: normalizeText(agent.name),
    lane: normalizeText(agent.lane),
    assignedCount: Number(counts[normalizeText(agent.name)]) || 0
  }))
}

function selectAgentForLane(lane) {
  const laneAgents = agentPool.filter(agent => agent.lane === lane)
  if (laneAgents.length === 0) return 'Unassigned'

  const minCount = Math.min(...laneAgents.map(agent => agent.assignedCount))
  const candidates = laneAgents.filter(agent => agent.assignedCount === minCount)
  return candidates[0].name
}

function assignAgentForLane(lane) {
  const selectedName = selectAgentForLane(lane)
  const selected = agentPool.find(agent => agent.name === selectedName)
  if (!selected) return 'Unassigned'
  selected.assignedCount += 1
  saveAgentAssignmentCounts()
  return selected.name
}

function getMaxTicketNumber() {
  return ticketsData.reduce((max, ticket) => {
    const rawId = ticket.ticket_id || ticket.id || ''
    const match = String(rawId).match(/TKT-(\d+)/)
    if (!match) return max
    return Math.max(max, Number(match[1]))
  }, 1000)
}

function refreshNextTicketNumber() {
  const maxId = getMaxTicketNumber()
  nextTicketNumber = Math.max(nextTicketNumber, maxId + 1)
}

function formatTicketId(number) {
  return `TKT-${String(number).padStart(4, '0')}`
}

function getDraftTicketId() {
  const maxId = getMaxTicketNumber()
  return formatTicketId(maxId + 1)
}

function validateForm() {
  const requestType = requestTypeInput.value
  const channel = channelInput.value
  const orderNumber = normalizeText(orderNumberInput.value)
  const factoryVendor = normalizeText(factoryVendorInput.value)
  const urgentFlagValue = getSelectedUrgentFlag()
  const etdRawValue = etdDaysInput.value.trim()
  const customerTier = customerTierInput.value
  const otherNote = normalizeText(otherNoteInput.value)

  if (!channel) {
    showValidation('Please select the case channel before calculating the score.', channelInput)
    return null
  }

  if (!factoryVendor) {
    showValidation('Please enter the factory or vendor name.', factoryVendorInput)
    return null
  }

  if (!requestType) {
    showValidation('Please select a request type before calculating the score.', requestTypeInput)
    return null
  }

  if (requestType === 'Other' && !otherNote) {
    showValidation('Please describe the request when Other is selected.', otherNoteInput)
    return null
  }

  if (etdRawValue === '') {
    showValidation('Please enter the remaining ETD in days. Use a whole number from 0 to 30.', etdDaysInput)
    return null
  }

  const etdDays = Number(etdRawValue)
  if (!Number.isInteger(etdDays)) {
    showValidation('ETD must be a whole number. Please enter a value from 0 to 30.', etdDaysInput)
    return null
  }

  if (etdDays < 0 || etdDays > 30) {
    showValidation('ETD must be between 0 and 30 days.', etdDaysInput)
    return null
  }

  if (!customerTier) {
    showValidation('Please select a customer tier before calculating the score.', customerTierInput)
    return null
  }

  return {
    requestType,
    channel,
    orderNumber,
    factoryVendor,
    urgencyFlag: urgentFlagValue === 'yes' ? 'urgent' : 'normal',
    etdDays,
    customerTier,
    otherNote
  }
}

function formatScore(score) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}

function getLaneCaption(lane) {
  const map = {
    Critical: 'Route this case first and treat it as the highest handling priority.',
    Priority: 'Move this case into the priority queue and complete it within the current shift.',
    Standard: 'This case can follow the standard queue and be handled on a first-come, first-served basis.'
  }

  return map[lane]
}

function saveScoringState(state) {
  try {
    localStorage.setItem(SCORING_STATE_KEY, JSON.stringify(state))
  } catch {
    // ignore storage failures
  }
}

function loadScoringState() {
  try {
    const stored = localStorage.getItem(SCORING_STATE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function clearScoringState() {
  localStorage.removeItem(SCORING_STATE_KEY)
}

function clearResultDisplay() {
  scoreValue.textContent = '--'
  laneBadge.textContent = 'Waiting for input'
  laneBadge.className = 'badge badge-placeholder'
  laneCaption.textContent = 'Complete the form to see the recommended routing lane.'
  slaValue.textContent = '--'
  actionValue.textContent = 'Fill in the case details and calculate the score to view the recommended next step.'
  ticketIdValue.textContent = '--'
  assignedAgentValue.textContent = '--'
  updateResultState()
  saveButton.disabled = true
  saveButton.textContent = 'Save Case'
  clearToast()
}

function toggleOtherNoteField() {
  if (requestTypeInput.value === 'Other') {
    otherNoteGroup.classList.remove('hidden')
  } else {
    otherNoteGroup.classList.add('hidden')
    otherNoteInput.value = ''
  }
}

function restoreScoringState() {
  const saved = loadScoringState()
  if (!saved) {
    clearResultDisplay()
    toggleOtherNoteField()
    return
  }

  requestTypeInput.value = saved.requestType || ''
  channelInput.value = saved.channel || ''
  orderNumberInput.value = saved.orderNumber || ''
  factoryVendorInput.value = saved.factoryVendor || ''
  const urgentValue = isUrgentValue(saved.urgencyFlag) ? 'yes' : 'no'
  const urgentRadio = document.querySelector(`input[name="urgentFlag"][value="${urgentValue}"]`)
  if (urgentRadio) urgentRadio.checked = true
  etdDaysInput.value = saved.etdDays ?? ''
  customerTierInput.value = saved.customerTier || ''
  otherNoteInput.value = saved.otherNote || ''
  toggleOtherNoteField()

  currentResult = buildResultContext({
    requestType: saved.requestType || '',
    channel: saved.channel || '',
    orderNumber: saved.orderNumber || '',
    factoryVendor: saved.factoryVendor || '',
    urgencyFlag: isUrgentValue(saved.urgencyFlag) ? 'urgent' : 'normal',
    etdDays: Number(saved.etdDays) || 0,
    customerTier: saved.customerTier || '',
    otherNote: saved.otherNote || ''
  })
  renderResult(currentResult)
}

function resetFormAndResult() {
  scoringForm.reset()
  clearValidation()
  otherNoteGroup.classList.add('hidden')
  clearResultDisplay()
  currentResult = null
  clearScoringState()
}

function updateResultState(lane) {
  resultCard.classList.remove('state-empty', 'state-critical', 'state-priority', 'state-standard')

  if (!lane) {
    resultCard.classList.add('state-empty')
    return
  }

  resultCard.classList.add(`state-${lane.toLowerCase()}`)
}

function buildResultContext(formData) {
  const score = calculateScore(formData)
  const lane = getLane(score)
  const sla = getSLA(lane)
  const action = getAction(lane)
  const assignedAgent = selectAgentForLane(lane)
  const ticketId = getDraftTicketId()

  return {
    ...formData,
    score,
    lane,
    sla,
    action,
    assignedAgent,
    ticketId
  }
}

function renderResult(data) {
  scoreValue.textContent = formatScore(data.score)
  laneBadge.textContent = data.lane
  laneBadge.className = `badge ${getLaneBadgeClass(data.lane)}`
  laneCaption.textContent = getLaneCaption(data.lane)
  slaValue.textContent = data.sla
  actionValue.textContent = data.action
  ticketIdValue.textContent = data.ticketId
  assignedAgentValue.textContent = data.assignedAgent
  updateResultState(data.lane)
  saveButton.disabled = false
  saveButton.textContent = 'Save Case'
  saveScoringState(data)
  showToast('Calculation completed. Latest score is shown above.')
}

function createNewTicketObject(result) {
  const now = new Date()
  const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const etdDate = new Date(now)
  etdDate.setDate(etdDate.getDate() + result.etdDays)
  const etd = `${etdDate.getFullYear()}-${String(etdDate.getMonth() + 1).padStart(2, '0')}-${String(etdDate.getDate()).padStart(2, '0')}`

  return {
    ticket_id: result.ticketId,
    created_at: createdAt,
    channel: result.channel,
    document_type: result.requestType,
    order_reference: result.orderNumber || '',
    factory_vendor: result.factoryVendor,
    assigned_agent: result.assignedAgent,
    urgent_flag: isUrgentValue(result.urgencyFlag) ? 'Yes' : 'No',
    etd,
    lead_time_days: result.etdDays,
    assignment_delay_minutes: 0,
    first_response_at: '',
    first_response_time_hours: 0,
    sla_status: 'Pending',
    external_dependency: 'No',
    external_delay_minutes: 0,
    priority_handling: '',
    resolved_at: '',
    total_resolution_hours: 0,
    csat: '',
    breach_reason: '',
    other_note: result.otherNote || '',
    customer_tier: result.customerTier
  }
}

async function saveTicketsToServer(data) {
  const response = await fetch('/api/tickets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error('Failed to save tickets')
  }

  return response.json()
}

async function saveCurrentResult() {
  if (!currentResult) return

  const newTicket = createNewTicketObject(currentResult)

  if (!getVendorEntry(currentResult.factoryVendor)) {
    saveVendorSuggestion(currentResult.factoryVendor, currentResult.customerTier)
  }

  assignAgentForLane(currentResult.lane)

  // Try server save, fallback to localStorage + dispatch event for UI sync
  try {
    await saveTicketsToServer(newTicket)
  } catch (error) {
    // server not available — persist locally
    try {
      const key = 'localTickets'
      const stored = localStorage.getItem(key)
      const arr = stored ? JSON.parse(stored) : []
      arr.push(newTicket)
      localStorage.setItem(key, JSON.stringify(arr))
      console.warn('Saved ticket to localStorage fallback')
    } catch (err) {
      console.error('Failed to persist ticket locally', err)
      alert('Failed to save ticket to server or local storage.')
      return
    }
  }

  // Update in-memory ticketsData and next id
  ticketsData = Array.isArray(ticketsData) ? [...ticketsData, newTicket] : [newTicket]
  refreshNextTicketNumber()

  // Disable save button and give feedback
  saveButton.disabled = true
  saveButton.textContent = 'Saved Successfully'

  // Notify other pages (queue/dashboard) to reload
  try {
    window.dispatchEvent(new CustomEvent('ticketsUpdated', { detail: { ticket: newTicket } }))
  } catch (e) {
    // ignore
  }

  alert('Ticket saved.')
}

function loadVendorData() {
  return fetch('../data/vendors.json')
    .then(res => res.json())
    .then(buildVendorList)
}

function loadAgentData() {
  return fetch('../data/agents.json')
    .then(res => res.json())
    .then(initAgentPool)
}

function loadTicketData() {
  return fetch('/api/tickets')
    .then(res => res.json())
    .then(data => {
      ticketsData = Array.isArray(data) ? data : data.tickets || []
      refreshNextTicketNumber()
    })
}

function updateCustomerTierFromVendor() {
  const vendorEntry = getVendorEntry(factoryVendorInput.value)
  if (vendorEntry) {
    customerTierInput.value = vendorEntry.customerTier
  } else if (!customerTierInput.value) {
    customerTierInput.value = 'Standard'
  }
}

function initPage() {
  Promise.all([loadTicketData(), loadVendorData(), loadAgentData()])
    .then(() => restoreScoringState())
    .catch(() => {
      validationMessage.hidden = false
      validationMessage.textContent = 'Unable to load initial data. Please open the page from a server or check your file paths.'
    })
}

factoryVendorInput.addEventListener('blur', updateCustomerTierFromVendor)
factoryVendorInput.addEventListener('change', updateCustomerTierFromVendor)
requestTypeInput.addEventListener('change', toggleOtherNoteField)
resetButton.addEventListener('click', resetFormAndResult)

saveButton.addEventListener('click', saveCurrentResult)

scoringForm.addEventListener('submit', event => {
  event.preventDefault()
  clearValidation()

  const formData = validateForm()
  if (!formData) return

  currentResult = buildResultContext(formData)
  renderResult(currentResult)
})

initPage()
