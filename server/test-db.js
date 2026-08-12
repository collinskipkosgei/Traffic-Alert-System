const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('❌ MONGODB_URI not found in environment variables!');
  console.log('Please set MONGODB_URI in your .env file');
  process.exit(1);
}

console.log('Testing MongoDB connection...');
console.log(`URI: ${uri.replace(/\/\/[^:]+:[^@]+@/, '//****:****@')}`);

mongoose.connect(uri, {
  maxPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 30000,
})
.then(() => {
  console.log('✅ Connected successfully to MongoDB!');
  console.log('Database:', mongoose.connection.name);
  process.exit(0);
})
.catch(err => {
  console.error('❌ Connection failed:', err.message);
  console.error('\nPlease check:');
  console.error('1. Your MongoDB URI is correct');
  console.error('2. Username and password are correct');
  console.error('3. Database name exists');
  console.error('4. IP whitelist allows connections (0.0.0.0/0 is set)');
  process.exit(1);
});