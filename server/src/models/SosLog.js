const mongoose = require('mongoose')

const SosLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    emailTo: { type: String, required: true },
    message: { type: String, required: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
    },
    smtpResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } },
)

module.exports = mongoose.model('SosLog', SosLogSchema)
