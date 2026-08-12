const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const User = require('./src/models/User')
require('dotenv').config()

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('Connected to MongoDB')

    const email = 'ckipchumba53@gmail.com'
    const password = 'Admin123!'

    // Delete existing user with this email
    await User.deleteOne({ email })
    console.log('Cleaned up existing user')

    // Create new admin
    const passwordHash = await bcrypt.hash(password, 10)
    const admin = await User.create({
      email,
      passwordHash,
      role: 'admin',
      suspended: false
    })

    console.log('✅ Admin created successfully!')
    console.log('Email:', email)
    console.log('Password:', password)
    console.log('Role:', admin.role)

    await mongoose.disconnect()
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

createAdmin()
