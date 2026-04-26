const { connectDB } = require('./src/db')
const User = require('./src/models/User')

async function makeAdmin() {
  await connectDB()
  const result = await User.updateOne(
    { email: 'ckipchumba53@gmail.com' },
    { $set: { role: 'admin' } },
    { upsert: false }
  )
  console.log('Update result:', result)
  if (result.matchedCount === 0) {
    console.log('User not found. No changes made.')
  } else if (result.modifiedCount === 1) {
    console.log('ckipchumba53@gmail.com is now an ADMIN.')
  } else {
    console.log('User already had admin role.')
  }
  process.exit(0)
}

makeAdmin().catch((e) => {
  console.error('Error:', e)
  process.exit(1)
})
