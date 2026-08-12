const express = require('express')
const Alert = require('../models/Alert')
const User = require('../models/User')
const Settings = require('../models/Settings')
const ActivityLog = require('../models/ActivityLog')
const Payment = require('../models/Payment')
const PDFDocument = require('pdfkit')
const { requireAdmin } = require('../middleware/auth')

const router = express.Router()

function logAction(req, action, targetType, targetId, details, metadata = {}) {
  const actor = req.user
  ActivityLog.create({
    actorId: actor?._id || null,
    actorEmail: actor?.email || '',
    action,
    targetType,
    targetId,
    details,
    metadata,
  }).catch(() => {})
}

// Incident Approval Queue
router.get('/alerts/pending', requireAdmin, async (_req, res, next) => {
  try {
    const alerts = await Alert.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(100)
    res.json({ alerts })
  } catch (e) {
    next(e)
  }
})

router.post('/alerts/:id/approve', requireAdmin, async (req, res, next) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { status: 'approved' },
      { new: true, runValidators: true },
    )
    if (!alert) return res.status(404).json({ error: 'Alert not found' })
    logAction(req, 'approve_alert', 'alert', alert._id.toString(), `Approved incident "${alert.title}"`)
    res.json({ alert })
  } catch (e) {
    next(e)
  }
})

router.post('/alerts/:id/reject', requireAdmin, async (req, res, next) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected' },
      { new: true, runValidators: true },
    )
    if (!alert) return res.status(404).json({ error: 'Alert not found' })
    logAction(req, 'reject_alert', 'alert', alert._id.toString(), `Rejected incident "${alert.title}"`)
    res.json({ alert })
  } catch (e) {
    next(e)
  }
})

router.delete('/alerts/:id', requireAdmin, async (req, res, next) => {
  try {
    const alert = await Alert.findByIdAndDelete(req.params.id)
    if (!alert) return res.status(404).json({ error: 'Alert not found' })
    logAction(req, 'delete_alert', 'alert', alert._id.toString(), `Deleted incident "${alert.title}"`)
    res.json({ message: 'Alert deleted' })
  } catch (e) {
    next(e)
  }
})

// Approve all pending alerts
router.post('/alerts/approve-all', requireAdmin, async (req, res, next) => {
  try {
    const result = await Alert.updateMany({ status: 'pending' }, { status: 'approved' })
    logAction(req, 'approve_all', 'alert', '', `Approved all pending incidents (${result.modifiedCount})`)
    res.json({ message: `Approved ${result.modifiedCount} pending alerts` })
  } catch (e) {
    next(e)
  }
})

// User Management
router.get('/users', requireAdmin, async (_req, res, next) => {
  try {
    const users = await User.find({})
      .select('-passwordHash -resetPasswordToken -resetPasswordExpires')
      .sort({ createdAt: -1 })
    res.json({ users })
  } catch (e) {
    next(e)
  }
})

router.put('/users/:id/role', requireAdmin, async (req, res, next) => {
  try {
    const { role } = req.body ?? {}
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role must be user or admin' })
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true },
    ).select('-passwordHash')
    if (!user) return res.status(404).json({ error: 'User not found' })
    logAction(req, 'change_role', 'user', user._id.toString(), `Changed ${user.email} role to ${role}`)
    res.json({ user })
  } catch (e) {
    next(e)
  }
})

router.put('/users/:id/suspend', requireAdmin, async (req, res, next) => {
  try {
    const { suspended } = req.body ?? {}
    if (typeof suspended !== 'boolean') {
      return res.status(400).json({ error: 'suspended must be a boolean' })
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { suspended },
      { new: true, runValidators: true },
    ).select('-passwordHash')
    if (!user) return res.status(404).json({ error: 'User not found' })
    logAction(req, suspended ? 'suspend_user' : 'unsuspend_user', 'user', user._id.toString(), `${suspended ? 'Suspended' : 'Unsuspended'} ${user.email}`)
    res.json({ user })
  } catch (e) {
    next(e)
  }
})

// Stats
router.get('/stats', requireAdmin, async (_req, res, next) => {
  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000)

    const totalAlerts = await Alert.countDocuments()
    const pendingAlerts = await Alert.countDocuments({ status: 'pending' })
    const todayAlerts = await Alert.countDocuments({ createdAt: { $gte: todayStart } })
    const weekAlerts = await Alert.countDocuments({ createdAt: { $gte: weekStart } })
    const totalUsers = await User.countDocuments()
    const activeUsers = await User.countDocuments({ suspended: false })

    // Daily incident counts for last 7 days
    const dailyCounts = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000)
      const nextD = new Date(d.getTime() + 24 * 60 * 60 * 1000)
      const count = await Alert.countDocuments({ createdAt: { $gte: d, $lt: nextD } })
      dailyCounts.push({ date: d.toISOString().slice(0, 10), count })
    }

    // Weekly user signups for last 4 weeks
    const weeklySignups = []
    for (let i = 3; i >= 0; i--) {
      const d = new Date(todayStart.getTime() - i * 7 * 24 * 60 * 60 * 1000)
      const prevD = new Date(d.getTime() - 7 * 24 * 60 * 60 * 1000)
      const count = await User.countDocuments({ createdAt: { $gte: prevD, $lt: d } })
      weeklySignups.push({ week: `Week ${4 - i}`, count })
    }

    // Top reported locations
    const topLocations = await Alert.aggregate([
      { $match: { location: { $ne: null, $ne: '' } } },
      { $group: { _id: '$location', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ])

    res.json({
      totalAlerts,
      pendingAlerts,
      todayAlerts,
      weekAlerts,
      totalUsers,
      activeUsers,
      dailyCounts,
      weeklySignups,
      topLocations: topLocations.map(l => ({ location: l._id, count: l.count })),
    })
  } catch (e) {
    next(e)
  }
})

// Activity Feed
router.get('/activity', requireAdmin, async (_req, res, next) => {
  try {
    const logs = await ActivityLog.find({})
      .sort({ createdAt: -1 })
      .limit(50)
    res.json({ logs })
  } catch (e) {
    next(e)
  }
})

// System Health
router.get('/health', requireAdmin, async (_req, res, next) => {
  try {
    const checks = {
      database: 'unknown',
      googleMaps: 'unknown',
      weather: 'unknown',
      mpesa: 'unknown',
    }

    // DB check
    try {
      await User.findOne().select('_id').lean()
      checks.database = 'healthy'
    } catch {
      checks.database = 'unhealthy'
    }

    // Google Maps API (check via env or simple heuristic)
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY
    checks.googleMaps = mapsKey && String(mapsKey).length > 10 ? 'healthy' : 'not_configured'

    // Weather API
    const weatherKey = process.env.WEATHER_API_KEY
    checks.weather = weatherKey && String(weatherKey).length > 5 ? 'healthy' : 'not_configured'

    // M-Pesa
    const mpesaConsumer = process.env.MPESA_CONSUMER_KEY
    const mpesaSecret = process.env.MPESA_CONSUMER_SECRET
    checks.mpesa = mpesaConsumer && mpesaSecret ? 'healthy' : 'not_configured'

    res.json({ checks })
  } catch (e) {
    next(e)
  }
})

// Export incidents CSV
router.get('/alerts/export', requireAdmin, async (_req, res, next) => {
  try {
    const alerts = await Alert.find({}).sort({ createdAt: -1 }).lean()
    const headers = ['ID', 'Title', 'Location', 'Severity', 'Status', 'Description', 'Latitude', 'Longitude', 'CreatedAt', 'ExpiresAt']
    const rows = alerts.map(a => [
      a._id,
      `"${(a.title || '').replace(/"/g, '""')}"`,
      `"${(a.location || '').replace(/"/g, '""')}"`,
      a.severity,
      a.status || 'approved',
      `"${(a.description || '').replace(/"/g, '""')}"`,
      a.latitude ?? '',
      a.longitude ?? '',
      a.createdAt ? new Date(a.createdAt).toISOString() : '',
      a.expiresAt ? new Date(a.expiresAt).toISOString() : '',
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="incidents.csv"')
    res.send(csv)
  } catch (e) {
    next(e)
  }
})

// Send test notification (placeholder)
router.post('/test-notification', requireAdmin, async (req, res) => {
  console.log('Test notification endpoint hit by:', req.user?.email)
  res.json({ status: 'success', message: 'Test notification queued (no SMS provider configured)' })
})

// Settings
router.get('/settings', requireAdmin, async (_req, res, next) => {
  try {
    const settings = await Settings.getSingleton()
    res.json({ settings })
  } catch (e) {
    next(e)
  }
})

router.put('/settings', requireAdmin, async (req, res, next) => {
  try {
    const { alertRadiusKm, severityLevels } = req.body ?? {}
    const update = {}
    if (typeof alertRadiusKm === 'number') update.alertRadiusKm = alertRadiusKm
    if (severityLevels && typeof severityLevels === 'object') {
      if (typeof severityLevels.low === 'boolean') update['severityLevels.low'] = severityLevels.low
      if (typeof severityLevels.medium === 'boolean') update['severityLevels.medium'] = severityLevels.medium
      if (typeof severityLevels.high === 'boolean') update['severityLevels.high'] = severityLevels.high
    }
    const settings = await Settings.findOneAndUpdate({}, update, { new: true, upsert: true })
    logAction(req, 'update_settings', 'settings', '', 'Updated alert settings')
    res.json({ settings })
  } catch (e) {
    next(e)
  }
})

// Payment Reports
router.get('/payments/report/pdf', requireAdmin, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query
    
    const query = { status: 'completed' }
    
    if (startDate || endDate) {
      query.paidAt = {}
      if (startDate) query.paidAt.$gte = new Date(startDate)
      if (endDate) query.paidAt.$lte = new Date(endDate)
    }
    
    const payments = await Payment.find(query)
      .populate('userId', 'email')
      .sort({ paidAt: -1 })
    
    if (payments.length === 0) {
      return res.status(200).json({ message: 'No completed payments found for the selected period' })
    }
    
    const doc = new PDFDocument({ margin: 50 })
    
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="payment_report.pdf"')
    
    doc.pipe(res)
    
    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('Payment Report', { align: 'center' })
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })
    
    if (startDate || endDate) {
      const dateRange = `${startDate ? new Date(startDate).toLocaleDateString() : 'Start'} to ${endDate ? new Date(endDate).toLocaleDateString() : 'End'}`
      doc.fontSize(10).text(`Period: ${dateRange}`, { align: 'center' })
    }
    
    doc.moveDown()
    
    // Summary Section
    const totalAmount = payments.reduce((sum, p) => sum + p.amountKes, 0)
    const totalCount = payments.length
    
    doc.fontSize(14).font('Helvetica-Bold').text('Summary', { underline: true })
    doc.fontSize(11).font('Helvetica')
    doc.text(`Total Payments: ${totalCount}`)
    doc.text(`Total Amount: KES ${totalAmount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`)
    doc.text(`Average Payment: KES ${(totalAmount / totalCount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`)
    
    // Breakdown by Payment Method
    const methodBreakdown = {}
    payments.forEach(p => {
      if (!methodBreakdown[p.paymentMethod]) {
        methodBreakdown[p.paymentMethod] = { count: 0, amount: 0 }
      }
      methodBreakdown[p.paymentMethod].count += 1
      methodBreakdown[p.paymentMethod].amount += p.amountKes
    })
    
    doc.moveDown()
    doc.fontSize(14).font('Helvetica-Bold').text('By Payment Method', { underline: true })
    doc.fontSize(11).font('Helvetica')
    Object.entries(methodBreakdown).forEach(([method, data]) => {
      doc.text(`${method.toUpperCase()}: ${data.count} payments - KES ${data.amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`)
    })
    
    // Breakdown by Toll
    const tollBreakdown = {}
    payments.forEach(p => {
      if (!tollBreakdown[p.tollName]) {
        tollBreakdown[p.tollName] = { count: 0, amount: 0 }
      }
      tollBreakdown[p.tollName].count += 1
      tollBreakdown[p.tollName].amount += p.amountKes
    })
    
    doc.moveDown()
    doc.fontSize(14).font('Helvetica-Bold').text('By Toll Station', { underline: true })
    doc.fontSize(10).font('Helvetica')
    Object.entries(tollBreakdown).forEach(([tollName, data]) => {
      doc.text(`${tollName}: ${data.count} payments - KES ${data.amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`)
    })
    
    // Detailed Table
    doc.addPage()
    doc.fontSize(14).font('Helvetica-Bold').text('Detailed Payment Records', { underline: true })
    doc.moveDown()
    
    const tableTop = doc.y
    const pageHeight = doc.page.height
    let yPosition = tableTop
    
    // Table headers
    doc.fontSize(9).font('Helvetica-Bold')
    const colWidths = { date: 80, user: 100, toll: 100, amount: 80, method: 70, receipt: 90 }
    const startX = 50
    
    doc.text('Date', startX, yPosition)
    doc.text('User Email', startX + colWidths.date, yPosition)
    doc.text('Toll', startX + colWidths.date + colWidths.user, yPosition)
    doc.text('Amount', startX + colWidths.date + colWidths.user + colWidths.toll, yPosition)
    doc.text('Method', startX + colWidths.date + colWidths.user + colWidths.toll + colWidths.amount, yPosition)
    doc.text('Receipt', startX + colWidths.date + colWidths.user + colWidths.toll + colWidths.amount + colWidths.method, yPosition)
    
    yPosition += 15
    doc.moveTo(startX, yPosition - 5).lineTo(doc.page.width - 50, yPosition - 5).stroke()
    
    // Table rows
    doc.fontSize(8).font('Helvetica')
    payments.forEach(payment => {
      if (yPosition > pageHeight - 50) {
        doc.addPage()
        yPosition = 50
        doc.fontSize(9).font('Helvetica-Bold')
        doc.text('Date', startX, yPosition)
        doc.text('User Email', startX + colWidths.date, yPosition)
        doc.text('Toll', startX + colWidths.date + colWidths.user, yPosition)
        doc.text('Amount', startX + colWidths.date + colWidths.user + colWidths.toll, yPosition)
        doc.text('Method', startX + colWidths.date + colWidths.user + colWidths.toll + colWidths.amount, yPosition)
        doc.text('Receipt', startX + colWidths.date + colWidths.user + colWidths.toll + colWidths.amount + colWidths.method, yPosition)
        yPosition += 15
        doc.moveTo(startX, yPosition - 5).lineTo(doc.page.width - 50, yPosition - 5).stroke()
        doc.fontSize(8).font('Helvetica')
      }
      
      const date = new Date(payment.paidAt).toLocaleDateString('en-KE')
      const userEmail = payment.userId?.email || 'Unknown'
      const amount = `KES ${payment.amountKes.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
      const receipt = payment.mpesaReceiptNumber || 'N/A'
      
      doc.text(date, startX, yPosition, { width: colWidths.date })
      doc.text(userEmail, startX + colWidths.date, yPosition, { width: colWidths.user })
      doc.text(payment.tollName, startX + colWidths.date + colWidths.user, yPosition, { width: colWidths.toll })
      doc.text(amount, startX + colWidths.date + colWidths.user + colWidths.toll, yPosition, { width: colWidths.amount })
      doc.text(payment.paymentMethod, startX + colWidths.date + colWidths.user + colWidths.toll + colWidths.amount, yPosition, { width: colWidths.method })
      doc.text(receipt, startX + colWidths.date + colWidths.user + colWidths.toll + colWidths.amount + colWidths.method, yPosition, { width: colWidths.receipt })
      
      yPosition += 12
    })
    
    doc.end()
    logAction(req, 'export_payment_report', 'payment', '', `Exported payment report with ${payments.length} records`)
  } catch (e) {
    next(e)
  }
})

// Payment Summary Stats
router.get('/payments/summary', requireAdmin, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query
    
    const query = { status: 'completed' }
    if (startDate || endDate) {
      query.paidAt = {}
      if (startDate) query.paidAt.$gte = new Date(startDate)
      if (endDate) query.paidAt.$lte = new Date(endDate)
    }
    
    const payments = await Payment.find(query)
    
    const totalAmount = payments.reduce((sum, p) => sum + p.amountKes, 0)
    const totalCount = payments.length
    
    const methodBreakdown = {}
    payments.forEach(p => {
      if (!methodBreakdown[p.paymentMethod]) {
        methodBreakdown[p.paymentMethod] = { count: 0, amount: 0 }
      }
      methodBreakdown[p.paymentMethod].count += 1
      methodBreakdown[p.paymentMethod].amount += p.amountKes
    })
    
    res.json({
      totalAmount,
      totalCount,
      averagePayment: totalCount > 0 ? totalAmount / totalCount : 0,
      methodBreakdown,
      period: { startDate: startDate || null, endDate: endDate || null },
    })
  } catch (e) {
    next(e)
  }
})

module.exports = router
