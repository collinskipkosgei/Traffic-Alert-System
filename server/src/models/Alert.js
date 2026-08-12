const mongoose = require('mongoose')

const SEVERITY_TTL_MINUTES = {
  low: 30,
  medium: 60,
  high: 120,
}

const AlertSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    severity: { type: String, required: true, enum: ['low', 'medium', 'high'] },
    description: { type: String, required: true, trim: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } },
)

AlertSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
AlertSchema.index({ status: 1, createdAt: -1 })

AlertSchema.pre('validate', function () {
  if (!this.expiresAt) {
    const minutes = SEVERITY_TTL_MINUTES[this.severity] || SEVERITY_TTL_MINUTES.medium
    this.expiresAt = new Date(Date.now() + minutes * 60 * 1000)
  }
})

module.exports = mongoose.model('Alert', AlertSchema)

