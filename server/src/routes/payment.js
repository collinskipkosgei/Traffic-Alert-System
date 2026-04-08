const express = require('express')
const { v4: uuidv4 } = require('uuid')

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

// Backward compatibility with older pages:
router.post('/stkpush', async (_req, res) => {
  res.status(501).json({ error: 'Use /api/payment/initiate or /api/mpesa/stkpush endpoint' })
})

router.post('/callback', (req, res) => {
  console.log('Payment callback received:', req.body)
  res.json({ success: true })
})

module.exports = router