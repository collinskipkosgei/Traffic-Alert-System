const mongoose = require('mongoose')

const BroadcastMessageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    senderEmail: { type: String, required: true },
    message: { type: String, required: true, trim: true },
    targetDriverIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    ],
    readBy: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    ],
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } },
)

// Auto-delete old broadcasts after 24 hours
BroadcastMessageSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 24 * 60 * 60 },
)

module.exports = mongoose.model('BroadcastMessage', BroadcastMessageSchema)
