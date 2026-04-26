const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const nodemailer = require('nodemailer')
const User = require('../models/User')
const { requireAuth } = require('../middleware/auth')

// Email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

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
      return res.status(401).json({ error: 'wrong password or username' })
    }

    // Check password
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      return res.status(401).json({ error: 'wrong password or username' })
    }

    // Reject admin users on the user login portal
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Admin accounts must use the admin portal' })
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
      user: { _id: user._id, email: user.email, role: user.role || 'user' } 
    })
  } catch (e) {
    console.error('❌ Login error:', e)
    next(e)
  }
})

router.post('/admin/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {}

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const user = await User.findOne({ email: normalizedEmail })
    
    if (!user) {
      return res.status(401).json({ error: 'wrong password or username' })
    }

    // Check password
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      return res.status(401).json({ error: 'wrong password or username' })
    }

    // Reject non-admin users on the admin login portal
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'This portal is for administrators only' })
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
      user: { _id: user._id, email: user.email, role: user.role || 'user' } 
    })
  } catch (e) {
    console.error('❌ Admin login error:', e)
    next(e)
  }
})

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    res.json({ 
      status: 'success',
      user: { _id: req.user._id, email: req.user.email, role: req.user.role || 'user' } 
    })
  } catch (e) {
    next(e)
  }
})

router.post('/forgot-password', async (req, res, next) => {
  try {
    console.log('📧 Forgot password request received:', req.body)
    const { email } = req.body ?? {}
    if (!email) {
      console.log('❌ No email provided')
      return res.status(400).json({ error: 'email is required' })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    console.log('🔍 Looking for user:', normalizedEmail)
    const user = await User.findOne({ email: normalizedEmail })
    console.log('👤 User found:', user ? 'YES' : 'NO')

    if (!user) {
      return res.json({
        status: 'success',
        message: 'If an account exists, a reset email has been sent.',
      })
    }

    // Check if user is admin
    const isAdmin = user.role === 'admin'
    console.log('👤 User role:', user.role, 'Is Admin:', isAdmin)

    if (isAdmin) {
      // Send reset email only for admin users
      const resetToken = crypto.randomBytes(32).toString('hex')
      user.resetPasswordToken = resetToken
      user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      await user.save()

      // Build reset URL
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
      const resetUrl = `${clientUrl}/reset-password?token=${resetToken}`

      // Send email if SMTP is configured
      const smtpUser = process.env.SMTP_USER
      const smtpPass = process.env.SMTP_PASS
      console.log('🔧 SMTP Config:', { smtpUser: smtpUser ? 'SET' : 'NOT SET', smtpPass: smtpPass ? 'SET' : 'NOT SET' })
      if (smtpUser && smtpPass) {
        try {
          console.log('📤 Attempting to send email to:', user.email)
          const info = await transporter.sendMail({
            from: `"Traffic Alert System" <${smtpUser}>`,
            to: user.email,
            subject: 'Password Reset Request',
            text: `Click this link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
            html: `<p>Click <a href="${resetUrl}">here</a> to reset your password.</p><p>Or copy this link: ${resetUrl}</p><p>This link expires in 1 hour.</p>`,
          })
          console.log('✅ Reset email sent to', user.email, 'MessageId:', info.messageId)
        } catch (emailErr) {
          console.error('❌ Failed to send reset email:', emailErr.message)
          console.error('Error details:', emailErr)
        }
      } else {
        console.log('ℹ️ No SMTP configured. Reset token:', resetToken)
      }

      return res.json({
        status: 'success',
        message: 'If an account exists, a reset email has been sent.',
        isAdmin: true,
      })
    } else {
      // For regular users, just confirm account exists
      return res.json({
        status: 'success',
        message: 'Account found. Please verify your password.',
        isAdmin: false,
      })
    }
  } catch (e) {
    next(e)
  }
})

// Test SMTP configuration
router.get('/test-smtp', async (_req, res) => {
  try {
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    
    if (!smtpUser || !smtpPass) {
      return res.json({ status: 'error', message: 'SMTP not configured', smtpUser: smtpUser ? 'SET' : 'NOT SET', smtpPass: smtpPass ? 'SET' : 'NOT SET' })
    }
    
    // Try to verify connection
    await transporter.verify()
    return res.json({ status: 'success', message: 'SMTP connection verified', user: smtpUser })
  } catch (err) {
    return res.json({ status: 'error', message: err.message || 'SMTP verification failed' })
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
    console.log("user",user)

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