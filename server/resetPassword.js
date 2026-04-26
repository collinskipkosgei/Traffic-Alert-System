const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const User = require('./src/models/User')
require('dotenv').config()

async function resetPassword() {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('Connected to MongoDB')

    const email = process.argv[2] || 'ckipchumba53@gmail.com'
    const newPassword = process.argv[3] || 'Admin123!'

    const user = await User.findOne({ email })
    if (!user) {
      console.log('❌ User not found:', email)
      await mongoose.disconnect()
      process.exit(1)
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    user.passwordHash = passwordHash
    await user.save()

    console.log('✅ Password reset successfully!')
    console.log('Email:', email)
    console.log('New Password:', newPassword)

    await mongoose.disconnect()
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

resetPassword()
