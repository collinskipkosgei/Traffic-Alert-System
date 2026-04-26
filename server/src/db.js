const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const mongoose = require('mongoose')

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000,  // Changed from 5000 to 30000
      connectTimeoutMS: 30000,          // Added this
    })
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`)
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err)
    })
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected')
    })
    
    return conn
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message)
    throw error
  }
}

module.exports = { connectDB }