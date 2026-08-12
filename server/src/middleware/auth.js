const jwt = require('jsonwebtoken')
const User = require('../models/User')

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    
    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_change_me')
    
    const user = await User.findById(decoded.sub)
    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }
    
    req.user = user
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

const requireAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    
    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_change_me')
    
    const user = await User.findById(decoded.sub)
    if (!user) {
      console.log('❌ Admin auth failed: User not found for ID:', decoded.sub)
      return res.status(401).json({ error: 'User not found' })
    }
    
    console.log('🔍 Admin check:', { email: user.email, role: user.role, expected: 'admin', match: user.role === 'admin' })
    
    if (user.role !== 'admin') {
      console.log('❌ Admin auth failed: User', user.email, 'has role', user.role)
      return res.status(403).json({ error: 'Admin access required' })
    }
    
    req.user = user
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

module.exports = { requireAuth, requireAdmin }