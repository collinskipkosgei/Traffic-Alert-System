const mongoose = require('mongoose')

const SettingsSchema = new mongoose.Schema(
  {
    alertRadiusKm: { type: Number, default: 5, min: 0.5, max: 50 },
    severityLevels: {
      low: { type: Boolean, default: true },
      medium: { type: Boolean, default: true },
      high: { type: Boolean, default: true },
    },
  },
  { timestamps: false },
)

// Singleton pattern — always keep one settings doc
SettingsSchema.statics.getSingleton = async function () {
  let doc = await this.findOne()
  if (!doc) {
    doc = await this.create({})
  }
  return doc
}

module.exports = mongoose.model('Settings', SettingsSchema)
