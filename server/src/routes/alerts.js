const express = require('express')

const Alert = require('../models/Alert')

const router = express.Router()

router.get('/alerts', async (_req, res, next) => {
  try {
    const alerts = await Alert.find().sort({ createdAt: -1 }).limit(50)
    res.json({ alerts })
  } catch (e) {
    next(e)
  }
})

router.post('/alerts', async (req, res, next) => {
  try {
    const { title, location, severity, description } = req.body ?? {}

    if (!title || !location || !severity || !description) {
      return res.status(400).json({ error: 'title, location, severity, description are required' })
    }

    const alert = await Alert.create({
      title,
      location,
      severity,
      description,
    })

    res.status(201).json({ alert })
  } catch (e) {
    next(e)
  }
})

module.exports = router

