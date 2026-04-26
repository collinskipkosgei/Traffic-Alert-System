const mongoose = require('mongoose')
const User = require('./src/models/User')
require('dotenv').config()

async function listUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('Connected to MongoDB\n')

    const users = await User.find({}).select('email role suspended createdAt')

    if (users.length === 0) {
      console.log('No users found in database.')
    } else {
      console.log('Users in database:')
      console.log('='.repeat(60))
      users.forEach((u, i) => {
        console.log(`${i + 1}. ${u.email}`)
        console.log(`   Role: ${u.role}`)
        console.log(`   Status: ${u.suspended ? 'SUSPENDED' : 'Active'}`)
        console.log(`   Created: ${u.createdAt}`)
        console.log('')
      })
    }

    const adminCount = await User.countDocuments({ role: 'admin' })
    const totalCount = await User.countDocuments()
    console.log('='.repeat(60))
    console.log(`Total: ${totalCount} users (${adminCount} admins)`)

    await mongoose.disconnect()
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

listUsers()
