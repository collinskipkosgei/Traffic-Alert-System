const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const User = require('../models/User')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, passwordConfirm } = req.body ?? {}
    console.log('📝 Register request:', { email, password: password ? '***' : undefined, passwordConfirm: passwordConfirm ? '***' : undefined })

    // Validation
    if (!email || !password || !passwordConfirm) {
      return res.status(400).json({ error: 'email, password, and passwordConfirm are required' })
    }

    if (password !== passwordConfirm) {
      return res.status(400).json({ error: 'Passwords do not match' })
    }

    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    
    // Check if user exists
    const existing = await User.findOne({ email: normalizedEmail })
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' })
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({ 
      email: normalizedEmail, 
      passwordHash  // This matches your User model
    })

    console.log('✅ User created:', user._id)
    
    res.status(201).json({ 
      status: 'success',
      user: { _id: user._id, email: user.email } 
    })
  } catch (e) {
    console.error('❌ Registration error:', e)
    next(e)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {}

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const user = await User.findOne({ email: normalizedEmail })
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Check password
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Generate JWT
    const token = jwt.sign(
      { sub: user._id.toString(), email: user.email },
      process.env.JWT_SECRET || 'dev_secret_change_me',
      { expiresIn: '7d' }
    )

    res.json({ 
      status: 'success',
      token, 
      user: { _id: user._id, email: user.email } 
    })
  } catch (e) {
    console.error('❌ Login error:', e)
    next(e)
  }
})

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    res.json({ 
      status: 'success',
      user: { _id: req.user._id, email: req.user.email } 
    })
  } catch (e) {
    next(e)
  }
})

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body ?? {}
    if (!email) {
      return res.status(400).json({ error: 'email is required' })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const user = await User.findOne({ email: normalizedEmail })

    // Do not disclose whether the account exists.
    if (!user) {
      return res.json({
        status: 'success',
        message: 'If an account exists for this email, a reset link has been generated.',
      })
    }

    const resetToken = crypto.randomBytes(32).toString('hex')
    user.resetPasswordToken = resetToken
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000)
    await user.save()

    // In production you would email a reset URL containing this token.
    return res.json({
      status: 'success',
      message: 'Reset token generated.',
      resetToken,
    })
  } catch (e) {
    next(e)
  }
})

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password, passwordConfirm } = req.body ?? {}
    if (!token || !password || !passwordConfirm) {
      return res.status(400).json({ error: 'token, password, and passwordConfirm are required' })
    }

    if (password !== passwordConfirm) {
      return res.status(400).json({ error: 'Passwords do not match' })
    }

    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    })

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' })
    }

    user.passwordHash = await bcrypt.hash(password, 10)
    user.resetPasswordToken = null
    user.resetPasswordExpires = null
    await user.save()

    return res.json({
      status: 'success',
      message: 'Password reset successful. Please login.',
    })
  } catch (e) {
    next(e)
  }
})

module.exports = router