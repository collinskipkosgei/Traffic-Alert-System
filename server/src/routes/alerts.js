const express = require('express')

const Alert = require('../models/Alert')

const router = express.Router()

function handleError(res, next, error) {
  if (typeof next === 'function') {
    return next(error)
  }
  return res.status(500).json({ error: 'Server error', message: error.message })
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

router.get('/alerts', async (_req, res, next) => {
  try {
    const alerts = await Alert.find({ status: 'approved', expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .limit(50)
    res.json({ alerts })
  } catch (e) {
    handleError(res, next, e)
  }
})

router.get('/alerts/nearby', async (req, res, next) => {
  try {
    const latitude = Number(req.query.latitude)
    const longitude = Number(req.query.longitude)
    const radiusKm = Math.min(Math.max(Number(req.query.radiusKm || 5), 0.5), 50)

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return res.status(400).json({ error: 'latitude and longitude query params are required numbers' })
    }

    const alerts = await Alert.find({
      status: 'approved',
      latitude: { $ne: null },
      longitude: { $ne: null },
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .limit(200)

    const nearby = alerts
      .map((a) => {
        const distanceKm = haversineKm(latitude, longitude, a.latitude, a.longitude)
        return { ...a.toObject(), distanceKm: Number(distanceKm.toFixed(2)) }
      })
      .filter((a) => a.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)

    return res.json({ alerts: nearby, radiusKm })
  } catch (e) {
    handleError(res, next, e)
  }
})

router.post('/alerts', async (req, res, next) => {
  try {
    const { title, location, severity, description, latitude, longitude } = req.body ?? {}

    if (!title || !location || !severity || !description) {
      return res.status(400).json({ error: 'title, location, severity, description are required' })
    }

    const alert = await Alert.create({
      title,
      location,
      severity,
      description,
      latitude: typeof latitude === 'number' ? latitude : null,
      longitude: typeof longitude === 'number' ? longitude : null,
    })

    res.status(201).json({ alert })
  } catch (e) {
    handleError(res, next, e)
  }
})

router.put('/alerts/:id', async (req, res, next) => {
  try {
    const { title, location, severity, description, latitude, longitude } = req.body ?? {}

    if (!title || !location || !severity || !description) {
      return res.status(400).json({ error: 'title, location, severity, description are required' })
    }

    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      {
        title,
        location,
        severity,
        description,
        latitude: typeof latitude === 'number' ? latitude : null,
        longitude: typeof longitude === 'number' ? longitude : null,
      },
      { new: true, runValidators: true },
    )

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' })
    }

    return res.json({ alert })
  } catch (e) {
    handleError(res, next, e)
  }
})

router.delete('/alerts/:id', async (req, res, next) => {
  try {
    const alert = await Alert.findByIdAndDelete(req.params.id)
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' })
    }

    return res.json({ message: 'Alert deleted successfully' })
  } catch (e) {
    handleError(res, next, e)
  }
})

module.exports = router

