const mongoose = require('mongoose')

const activityLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actorEmail: { type: String, default: '' },
  action: { type: String, required: true },
  targetType: { type: String, default: '' },
  targetId: { type: String, default: '' },
  details: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
})

activityLogSchema.index({ createdAt: -1 })
activityLogSchema.index({ action: 1 })

module.exports = mongoose.model('ActivityLog', activityLogSchema)
