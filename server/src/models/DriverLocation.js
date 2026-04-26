const mongoose = require('mongoose')

const DriverLocationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number, default: null },
    speed: { type: Number, default: null },
    heading: { type: Number, default: null },
    isActive: { type: Boolean, default: true, index: true },
    source: { type: String, default: 'web' },
  },
  { timestamps: true },
)

DriverLocationSchema.index({ userId: 1, createdAt: -1 })

module.exports = mongoose.model('DriverLocation', DriverLocationSchema)

