const mongoose = require('mongoose')

const PaymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    checkoutRequestID: { type: String, required: true, trim: true, index: true },
    paymentMethod: { type: String, enum: ['mpesa', 'cash'], required: true },
    amountKes: { type: Number, required: true, min: 0 },
    tollId: { type: String, required: true, trim: true },
    tollName: { type: String, required: true, trim: true },
    vehicleRegistration: { type: String, required: true, trim: true },
    routeFrom: { type: String, required: true, trim: true },
    routeTo: { type: String, required: true, trim: true },
    distanceKm: { type: String, required: true, trim: true },
    mpesaReceiptNumber: { type: String, trim: true, default: null },
    status: { type: String, enum: ['completed', 'failed', 'pending'], required: true },
    failureReason: { type: String, trim: true, default: null },
    pendingNote: { type: String, trim: true, default: null },
    paidAt: { type: Date, required: true },
    rating: { type: Number, min: 1, max: 5, default: null },
    review: { type: String, trim: true, default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

PaymentSchema.index({ userId: 1, checkoutRequestID: 1 }, { unique: true })

module.exports = mongoose.model('Payment', PaymentSchema)
