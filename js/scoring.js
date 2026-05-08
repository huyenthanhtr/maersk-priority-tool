// scoring.js - Page 1 Priority Scoring logic

const scoringForm = document.getElementById('scoringForm')
const requestTypeInput = document.getElementById('requestType')
const etdDaysInput = document.getElementById('etdDays')
const customerTierInput = document.getElementById('customerTier')
const validationMessage = document.getElementById('validationMessage')

const resultCard = document.getElementById('resultCard')
const scoreValue = document.getElementById('scoreValue')
const laneBadge = document.getElementById('laneBadge')
const laneCaption = document.getElementById('laneCaption')
const slaValue = document.getElementById('slaValue')
const actionValue = document.getElementById('actionValue')

function getSelectedUrgentFlag() {
  const selected = document.querySelector('input[name="urgentFlag"]:checked')
  return selected ? selected.value : 'no'
}

function clearValidation() {
  validationMessage.hidden = true
  validationMessage.textContent = ''
  requestTypeInput.classList.remove('input-error')
  etdDaysInput.classList.remove('input-error')
  customerTierInput.classList.remove('input-error')
}

function showValidation(message, field) {
  validationMessage.hidden = false
  validationMessage.textContent = message

  if (field) {
    field.classList.add('input-error')
    field.focus()
  }
}

function validateForm() {
  const requestType = requestTypeInput.value
  const urgentFlagValue = getSelectedUrgentFlag()
  const etdRawValue = etdDaysInput.value.trim()
  const customerTier = customerTierInput.value

  if (!requestType) {
    showValidation('Please select a request type before calculating the score.', requestTypeInput)
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
    urgencyFlag: urgentFlagValue === 'yes' ? 'urgent' : 'normal',
    etdDays,
    customerTier
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

function updateResultState(lane) {
  resultCard.classList.remove('state-empty', 'state-critical', 'state-priority', 'state-standard')

  if (!lane) {
    resultCard.classList.add('state-empty')
    return
  }

  resultCard.classList.add(`state-${lane.toLowerCase()}`)
}

function renderResult(data) {
  const score = calculateScore(data)
  const lane = getLane(score)
  const sla = getSLA(lane)
  const action = getAction(lane)
  const badgeClass = getLaneBadgeClass(lane)

  scoreValue.textContent = formatScore(score)
  laneBadge.textContent = lane
  laneBadge.className = `badge ${badgeClass}`
  laneCaption.textContent = getLaneCaption(lane)
  slaValue.textContent = sla
  actionValue.textContent = action
  updateResultState(lane)
}

scoringForm.addEventListener('submit', event => {
  event.preventDefault()
  clearValidation()

  const formData = validateForm()
  if (!formData) return

  renderResult(formData)
})
