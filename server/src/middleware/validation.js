const Joi = require('joi')

// Registration validation schema
const registerSchema = Joi.object({
  phoneNumber: Joi.string()
    .pattern(/^[0-9]{10,12}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be 10-12 digits',
    }),
  nationalId: Joi.string()
    .pattern(/^[0-9]{8}$/)
    .required()
    .messages({
      'string.pattern.base': 'National ID must be 8 digits',
    }),
  fullName: Joi.string().min(3).max(100).required(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(6).required(),
  vehicleDetails: Joi.object({
    type: Joi.string().valid('private', 'taxi', 'commercial').required(),
    registration: Joi.string().required(),
  }).required(),
  mpesaNumber: Joi.string()
    .pattern(/^[0-9]{10,12}$/)
    .required(),
})

// Login validation schema
const loginSchema = Joi.object({
  phoneNumber: Joi.string().required(),
  password: Joi.string().required(),
})

// Payment validation schema
const paymentSchema = Joi.object({
  tollId: Joi.string().required(),
  tollName: Joi.string().required(),
  amount: Joi.number().positive().required(),
  vehicleRegistration: Joi.string().required(),
  route: Joi.object({
    from: Joi.string().required(),
    to: Joi.string().required(),
  }).required(),
})

module.exports = {
  registerSchema,
  loginSchema,
  paymentSchema,
}

