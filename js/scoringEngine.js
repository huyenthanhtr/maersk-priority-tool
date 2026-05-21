// scoringEngine.js — Core Priority Scoring Logic
// Maersk Vietnam | Priority Routing Tool
// Based on Priority Rule Matrix 

const URGENCY_SCORES = {
  'Yes': 10,
  'No': 2
}

const REQUEST_TYPE_SCORES = {
  'B/L': 10,
  'Packing List': 8,
  'COO': 8,
  'Invoice': 6,
  'Inspection Certificate': 9,
  'Quarantine Documents': 9
}

const CUSTOMER_TIER_SCORES = {
  'Key Account': 10,
  'Standard': 6,
  'Occasional': 3
}

function getETDScore(days) {
  if (days <= 1) return 10
  if (days <= 2) return 8
  if (days <= 3) return 6
  if (days <= 5) return 4
  return 2
}

function calculateScore({ urgencyFlag, urgency_flag, etdDays, lead_time_days, requestType, document_type, customerTier, customer_tier }) {
  const urgencyValue = urgencyFlag ?? urgency_flag
  const etdValue = etdDays ?? lead_time_days
  const requestTypeValue = requestType ?? document_type
  const customerTierValue = customerTier ?? customer_tier

  const c1 = URGENCY_SCORES[urgencyValue] ?? 2
  const c2 = getETDScore(Number(etdValue))
  const c3 = REQUEST_TYPE_SCORES[requestTypeValue] ?? 2
  const c4 = CUSTOMER_TIER_SCORES[customerTierValue] ?? 3

  const score = (c1 * 10 * 0.35)
              + (c2 * 10 * 0.30)
              + (c3 * 10 * 0.20)
              + (c4 * 10 * 0.15)

  return Math.round(score * 10) / 10
}

function getLane(score) {
  if (score >= 80) return 'Critical'
  if (score >= 50) return 'Priority'
  return 'Standard'
}

function getSLA(lane) {
  const map = {
    'Critical': '1 working hour',
    'Priority': '2 working hours',
    'Standard': '4 working hours'
  }
  return map[lane]
}

function getAction(lane) {
  const map = {
    'Critical': 'Assign to Senior PIC immediately, notify Team Lead',
    'Priority': 'Add to priority queue, handle within current shift',
    'Standard': 'Add to standard queue, handle FCFS'
  }
  return map[lane]
}

function getLaneColor(lane) {
  const map = {
    'Critical': '#ef4444',
    'Priority': '#f59e0b',
    'Standard': '#22c55e'
  }
  return map[lane]
}

function getLaneBadgeClass(lane) {
  const map = {
    'Critical': 'badge-critical',
    'Priority': 'badge-priority',
    'Standard': 'badge-standard'
  }
  return map[lane]
}