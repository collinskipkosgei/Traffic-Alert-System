const test = require('node:test')
const assert = require('node:assert/strict')
const { getLoginAttemptKey, isLoginLockedOut } = require('../src/utils/loginAttempts')

test('normalizes the email into a per-account login key', () => {
  assert.equal(getLoginAttemptKey(' Alice@Example.com '), 'login:alice@example.com')
})

test('marks a user as locked while the lockout window is active', () => {
  assert.equal(isLoginLockedOut({ lockUntil: Date.now() + 60_000 }), true)
})

test('allows a user to try again once the lockout window has expired', () => {
  assert.equal(isLoginLockedOut({ lockUntil: Date.now() - 1_000 }), false)
})
