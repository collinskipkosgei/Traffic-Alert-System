const express = require('express')
const DriverLocation = require('../models/DriverLocation')
const BroadcastMessage = require('../models/BroadcastMessage')
const { requireAuth, requireAdmin } = require('../middleware/auth')

const router = express.Router()

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

router.post('/update', requireAuth, async (req, res, next) => {
  try {
    const { latitude, longitude, accuracy, speed, heading, isActive = true } = req.body ?? {}
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'latitude and longitude are required numbers' })
    }

    const doc = await DriverLocation.create({
      userId: req.user._id,
      latitude,
      longitude,
      accuracy: typeof accuracy === 'number' ? accuracy : null,
      speed: typeof speed === 'number' ? speed : null,
      heading: typeof heading === 'number' ? heading : null,
      isActive: Boolean(isActive),
      source: 'web',
    })

    return res.status(201).json({ location: doc })
  } catch (e) {
    return next(e)
  }
})

router.post('/heartbeat', requireAuth, async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body ?? {}

    let lat = typeof latitude === 'number' ? latitude : null
    let lng = typeof longitude === 'number' ? longitude : null

    if (lat == null || lng == null) {
      const latest = await DriverLocation.findOne({ userId: req.user._id }).sort({ createdAt: -1 })
      if (latest) {
        lat = latest.latitude
        lng = latest.longitude
      }
    }

    if (lat == null || lng == null) {
      // Fallback to Nairobi CBD if no location was ever shared yet.
      lat = -1.2921
      lng = 36.8219
    }

    const doc = await DriverLocation.create({
      userId: req.user._id,
      latitude: lat,
      longitude: lng,
      accuracy: null,
      speed: null,
      heading: null,
      isActive: true,
      source: 'heartbeat',
    })

    return res.status(201).json({ status: 'ok', location: doc })
  } catch (e) {
    return next(e)
  }
})

router.post('/offline', requireAuth, async (req, res, next) => {
  try {
    const latest = await DriverLocation.findOne({ userId: req.user._id }).sort({ createdAt: -1 })
    const lat = latest?.latitude ?? -1.2921
    const lng = latest?.longitude ?? 36.8219

    const doc = await DriverLocation.create({
      userId: req.user._id,
      latitude: lat,
      longitude: lng,
      accuracy: null,
      speed: null,
      heading: null,
      isActive: false,
      source: 'offline',
    })

    return res.status(201).json({ status: 'ok', location: doc })
  } catch (e) {
    return next(e)
  }
})

router.get('/me/latest', requireAuth, async (req, res, next) => {
  try {
    const latest = await DriverLocation.findOne({ userId: req.user._id }).sort({ createdAt: -1 })
    return res.json({ location: latest })
  } catch (e) {
    return next(e)
  }
})

router.get('/me/history', requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 500)
    const history = await DriverLocation.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
    return res.json({ history })
  } catch (e) {
    return next(e)
  }
})

router.get('/active', requireAdmin, async (req, res, next) => {
  try {
    const minutes = Math.min(Math.max(Number(req.query.minutes || 10), 1), 120)
    const since = new Date(Date.now() - minutes * 60 * 1000)

    const points = await DriverLocation.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$userId',
          latest: { $first: '$$ROOT' },
        },
      },
      { $match: { 'latest.isActive': true } },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          latitude: '$latest.latitude',
          longitude: '$latest.longitude',
          accuracy: '$latest.accuracy',
          speed: '$latest.speed',
          heading: '$latest.heading',
          updatedAt: '$latest.createdAt',
        },
      },
    ])

    return res.json({ activeDrivers: points, windowMinutes: minutes })
  } catch (e) {
    return next(e)
  }
})

router.post('/optimize-route', requireAuth, async (req, res, next) => {
  try {
    const { destination, origin, preference = 'fastest' } = req.body ?? {}
    if (
      !destination ||
      typeof destination.latitude !== 'number' ||
      typeof destination.longitude !== 'number'
    ) {
      return res
        .status(400)
        .json({ error: 'destination.latitude and destination.longitude are required numbers' })
    }

    const hasOriginOverride =
      origin && typeof origin.latitude === 'number' && typeof origin.longitude === 'number'

    const latest = hasOriginOverride
      ? null
      : await DriverLocation.findOne({ userId: req.user._id }).sort({ createdAt: -1 })

    if (!hasOriginOverride && !latest) {
      return res.status(400).json({
        error:
          'No current location found. Turn on Live Location first or allow browser location when optimizing route.',
      })
    }

    const originLat = hasOriginOverride ? origin.latitude : latest.latitude
    const originLng = hasOriginOverride ? origin.longitude : latest.longitude

    const distanceKm = haversineKm(
      originLat,
      originLng,
      destination.latitude,
      destination.longitude,
    )
    const avgUrbanSpeedKmh = 35
    const freeMinutes = Math.max(3, Math.round((distanceKm / avgUrbanSpeedKmh) * 60))
    const tollMinutes = Math.max(2, Math.round(freeMinutes * 0.72))
    const tollCost = Math.round(120 + distanceKm * 35)
    const chosen = preference === 'cheapest' ? 'free' : 'toll'

    return res.json({
      origin: {
        latitude: originLat,
        longitude: originLng,
      },
      destination,
      distanceKm: Number(distanceKm.toFixed(2)),
      recommendation: chosen,
      routes: {
        free: {
          etaMinutes: freeMinutes,
          tollCostKes: 0,
        },
        toll: {
          etaMinutes: tollMinutes,
          tollCostKes: tollCost,
        },
      },
    })
  } catch (e) {
    return next(e)
  }
})

// Allow both admins and regular users to broadcast messages to drivers
router.post('/broadcast', requireAuth, async (req, res, next) => {
  try {
    const { message } = req.body ?? {}
    console.log('📢 Broadcast request from:', req.user?.email, 'Message:', message)
    
    if (!message || String(message).trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' })
    }

    if (!req.user || !req.user._id) {
      console.error('❌ User not found in request')
      return res.status(401).json({ error: 'Unauthorized - user not found' })
    }

    const broadcast = await BroadcastMessage.create({
      senderId: req.user._id,
      senderEmail: req.user.email,
      message: String(message).trim(),
      readBy: [],
    })
    
    console.log('✅ Broadcast created:', broadcast._id)

    res.status(201).json({
      status: 'success',
      message: 'Broadcast sent successfully',
      broadcast: {
        _id: broadcast._id,
        senderEmail: broadcast.senderEmail,
        message: broadcast.message,
      },
    })
  } catch (e) {
    console.error('❌ Broadcast error:', e.message)
    return next(e)
  }
})

router.get('/messages', requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100)
    const messages = await BroadcastMessage.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()

    const enriched = messages.map((m) => ({
      ...m,
      isRead: m.readBy?.some((id) => String(id) === String(req.user._id)) ?? false,
    }))

    res.json({ messages: enriched })
  } catch (e) {
    return next(e)
  }
})

router.post('/messages/:id/read', requireAuth, async (req, res, next) => {
  try {
    await BroadcastMessage.updateOne(
      { _id: req.params.id },
      { $addToSet: { readBy: req.user._id } },
    )
    res.json({ status: 'success' })
  } catch (e) {
    return next(e)
  }
})

module.exports = router

