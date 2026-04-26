const express = require('express')
const { v4: uuidv4 } = require('uuid')
const { ingestSafaricomStkCallback } = require('../mpesaCheckoutStore')
const Payment = require('../models/Payment')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

const transactions = new Map()

const tolls = [
  { id: 'nrb_exp_1', name: 'Nairobi Expressway - Mlolongo to Westlands', rate: 150 },
  { id: 'nrb_exp_2', name: 'Nairobi Expressway - Westlands to Mlolongo', rate: 150 },
  { id: 'nrb_exp_3', name: 'Nairobi Expressway - JKIA to Westlands', rate: 200 },
  { id: 'msa_corr_1', name: 'Mombasa-Mariakani Corridor', rate: 100 },
]

router.get('/toll-rates', (req, res) => {
  res.json({ tolls })
})

router.post('/initiate', (req, res) => {
  const { tollId, tollName, amount, vehicleRegistration, route } = req.body ?? {}

  if (!tollId || !tollName || !amount || !vehicleRegistration || !route?.from || !route?.to) {
    return res.status(400).json({ message: 'Missing required payment fields' })
  }

  const transactionId = uuidv4()

  const tx = {
    transactionId,
    tollId,
    tollName,
    amount,
    vehicleRegistration,
    route,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }

  transactions.set(transactionId, tx)

  // Simulate completion
  setTimeout(() => {
    const existing = transactions.get(transactionId)
    if (!existing) return
    transactions.set(transactionId, {
      ...existing,
      status: 'completed',
      mpesaReceiptNumber: `SIM-${transactionId.slice(0, 8).toUpperCase()}`,
      completedAt: new Date().toISOString(),
    })
  }, 3500)

  res.status(201).json(tx)
})

router.get('/status/:transactionId', (req, res) => {
  const tx = transactions.get(req.params.transactionId)
  if (!tx) return res.status(404).json({ message: 'Transaction not found' })
  res.json(tx)
})

router.get('/history', (_req, res) => {
  const history = Array.from(transactions.values()).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  )
  res.json({ history })
})

router.get('/reviews', async (req, res, next) => {
  try {
    const limitRaw = Number(req.query.limit)
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 12

    const rows = await Payment.find({
      status: 'completed',
      rating: { $ne: null },
      review: { $nin: [null, ''] },
    })
      .sort({ reviewedAt: -1, updatedAt: -1 })
      .limit(limit)
      .populate('userId', 'email')
      .lean()

    const reviews = rows.map((row) => ({
      checkoutRequestID: row.checkoutRequestID,
      routeTo: row.routeTo,
      status: row.status,
      rating: row.rating,
      review: row.review,
      reviewedAt: row.reviewedAt,
      reviewerName:
        row.userId && typeof row.userId === 'object' && row.userId.email
          ? String(row.userId.email).split('@')[0]
          : 'User',
    }))

    res.json({ reviews })
  } catch (e) {
    next(e)
  }
})

router.get('/summary', requireAuth, async (req, res, next) => {
  try {
    const recentPayments = await Payment.find({ userId: req.user._id, status: 'completed' })
      .sort({ paidAt: -1, createdAt: -1 })
      .limit(20)
      .lean()

    const lastPayment = recentPayments[0] || null
    let nextTollDue = null

    if (recentPayments.length > 0) {
      const freq = new Map()
      for (const p of recentPayments) {
        const key = `${p.tollId}__${p.tollName}`
        const current = freq.get(key) || { count: 0, totalAmount: 0, tollId: p.tollId, tollName: p.tollName }
        current.count += 1
        current.totalAmount += Number(p.amountKes || 0)
        freq.set(key, current)
      }

      const top = Array.from(freq.values()).sort((a, b) => b.count - a.count)[0]
      if (top) {
        nextTollDue = {
          tollId: top.tollId,
          tollName: top.tollName,
          amountKes: Math.max(1, Math.round(top.totalAmount / top.count)),
        }
      }
    }

    res.json({
      nextTollDue,
      lastPayment: lastPayment
        ? {
            paidAt: lastPayment.paidAt,
            mpesaReceiptNumber: lastPayment.mpesaReceiptNumber,
            checkoutRequestID: lastPayment.checkoutRequestID,
            amountKes: lastPayment.amountKes,
            tollName: lastPayment.tollName,
          }
        : null,
    })
  } catch (e) {
    next(e)
  }
})

router.post('/record', requireAuth, async (req, res, next) => {
  try {
    const {
      checkoutRequestID,
      paymentMethod,
      amountKes,
      tollId,
      tollName,
      vehicleRegistration,
      routeFrom,
      routeTo,
      distanceKm,
      mpesaReceiptNumber,
      status,
      failureReason,
      pendingNote,
      paidAt,
    } = req.body ?? {}

    if (
      !checkoutRequestID ||
      !paymentMethod ||
      !amountKes ||
      !tollId ||
      !tollName ||
      !vehicleRegistration ||
      !routeFrom ||
      !routeTo ||
      !distanceKm ||
      !status ||
      !paidAt
    ) {
      return res.status(400).json({ error: 'Missing required payment fields' })
    }

    const update = {
      userId: req.user._id,
      checkoutRequestID: String(checkoutRequestID),
      paymentMethod: String(paymentMethod),
      amountKes: Number(amountKes),
      tollId: String(tollId),
      tollName: String(tollName),
      vehicleRegistration: String(vehicleRegistration),
      routeFrom: String(routeFrom),
      routeTo: String(routeTo),
      distanceKm: String(distanceKm),
      mpesaReceiptNumber: mpesaReceiptNumber ? String(mpesaReceiptNumber) : null,
      status: String(status),
      failureReason: failureReason ? String(failureReason) : null,
      pendingNote: pendingNote ? String(pendingNote) : null,
      paidAt: new Date(paidAt),
    }

    const payment = await Payment.findOneAndUpdate(
      { userId: req.user._id, checkoutRequestID: String(checkoutRequestID) },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    res.status(201).json({ status: 'success', payment })
  } catch (e) {
    next(e)
  }
})

router.post('/review', requireAuth, async (req, res, next) => {
  try {
    const { checkoutRequestID, rating, review } = req.body ?? {}
    if (!checkoutRequestID || !rating || !review) {
      return res.status(400).json({ error: 'checkoutRequestID, rating, and review are required' })
    }

    const payment = await Payment.findOneAndUpdate(
      { userId: req.user._id, checkoutRequestID: String(checkoutRequestID) },
      { rating: Number(rating), review: String(review).trim(), reviewedAt: new Date() },
      { new: true },
    )

    if (!payment) return res.status(404).json({ error: 'Payment not found' })
    res.json({ status: 'success', payment })
  } catch (e) {
    next(e)
  }
})

// Backward compatibility with older pages:
router.post('/stkpush', async (_req, res) => {
  res.status(501).json({ error: 'Use /api/payment/initiate or /api/mpesa/stkpush endpoint' })
})

router.post('/callback', (req, res) => {
  console.log('Payment callback received:', req.body)

  try {
    const parsed = ingestSafaricomStkCallback(req.body)
    if (parsed?.receipt) {
      console.log(`✅ Stored M-Pesa receipt for ${parsed.checkoutRequestID}: ${parsed.receipt}`)
    }
  } catch (e) {
    console.error('Payment callback parse error:', e)
  }

  res.json({ ResultCode: 0, ResultDesc: 'Success' })
})

module.exports = router