const crypto = require('crypto')

const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const LOGIN_ATTEMPT_MAX = 5
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000

const getLoginAttemptKey = (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  return `login:${normalizedEmail}`
}

const isLoginLockedOut = (userRecord) => {
  if (!userRecord || !userRecord.lockUntil) return false
  return Date.now() < userRecord.lockUntil
}

const getLoginAttemptState = (attemptsStore, email) => {
  const key = getLoginAttemptKey(email)
  const existing = attemptsStore.get(key) || { count: 0, lockUntil: null }
  return { key, existing }
}

const markLoginAttempt = (attemptsStore, email, { success = false } = {}) => {
  const { key, existing } = getLoginAttemptState(attemptsStore, email)

  if (success) {
    attemptsStore.set(key, { count: 0, lockUntil: null })
    return { key, state: attemptsStore.get(key) }
  }

  const now = Date.now()
  const nextCount = existing.count + 1
  const nextState = {
    count: nextCount,
    lockUntil: nextCount >= LOGIN_ATTEMPT_MAX ? now + LOGIN_LOCKOUT_MS : existing.lockUntil,
  }

  attemptsStore.set(key, nextState)
  return { key, state: nextState }
}

const shouldThrottleLogin = (attemptsStore, email) => {
  const { existing } = getLoginAttemptState(attemptsStore, email)
  if (isLoginLockedOut(existing)) return true
  return false
}

module.exports = {
  LOGIN_ATTEMPT_WINDOW_MS,
  LOGIN_ATTEMPT_MAX,
  LOGIN_LOCKOUT_MS,
  getLoginAttemptKey,
  isLoginLockedOut,
  getLoginAttemptState,
  markLoginAttempt,
  shouldThrottleLogin,
}
