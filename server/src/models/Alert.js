const mongoose = require('mongoose')

const AlertSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    severity: { type: String, required: true, enum: ['low', 'medium', 'high'] },
    description: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } },
)

module.exports = mongoose.model('Alert', AlertSchema)

