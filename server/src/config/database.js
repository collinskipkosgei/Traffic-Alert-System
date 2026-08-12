const mongoose = require('mongoose')
const winston = require('winston')
const dotenv = require('dotenv')

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({ format: winston.format.simple() }),
  ],
})

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb+srv://marakwet1:marakwet1@traffic.cwkyyvx.mongodb.net/?appName=Traffic',
      {
        serverSelectionTimeoutMS: 5000,
      },
    )

    logger.info(`MongoDB Connected: ${conn.connection.host}`)

    mongoose.connection.on('error', (err) => {
      // logger.error('MongoDB connection error:', err)
      console.error('MongoDB connection error:', err)
    })

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected')
    })

    return conn
  } catch (error) {
    logger.error('MongoDB connection failed:', error)
    process.exit(1)
  }
}

module.exports = connectDB

