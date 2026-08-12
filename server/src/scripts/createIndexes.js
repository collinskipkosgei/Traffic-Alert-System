const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Import models
const Payment = require('../models/Payment');
const User = require('../models/User');

async function createIndexes() {
  try {
    console.log('📡 Connecting to MongoDB...');
    
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoURI) {
      throw new Error('No MongoDB URI found. Set MONGODB_URI or MONGO_URI in .env');
    }
    
    await mongoose.connect(mongoURI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 30000,
    });
    
    console.log('✅ MongoDB connected');
    console.log('📊 Creating indexes...');

    // Payment indexes
    console.log('📌 Creating Payment indexes...');
    await Payment.collection.createIndex({ userId: 1, createdAt: -1 });
    console.log('  ✅ Payment.userId + createdAt index created');
    
    await Payment.collection.createIndex({ checkoutRequestID: 1 });
    console.log('  ✅ Payment.checkoutRequestID index created');
    
    await Payment.collection.createIndex({ status: 1, createdAt: -1 });
    console.log('  ✅ Payment.status + createdAt index created');
    
    await Payment.collection.createIndex({ mpesaReceiptNumber: 1 });
    console.log('  ✅ Payment.mpesaReceiptNumber index created');

    // User indexes
    console.log('📌 Creating User indexes...');
    await User.collection.createIndex({ email: 1 }, { unique: true });
    console.log('  ✅ User.email unique index created');
    
    await User.collection.createIndex({ role: 1 });
    console.log('  ✅ User.role index created');

    console.log('\n✅ All indexes created successfully!');
    
    // List all indexes
    console.log('\n📋 Payment indexes:');
    const paymentIndexes = await Payment.collection.indexes();
    console.log(JSON.stringify(paymentIndexes, null, 2));
    
    console.log('\n📋 User indexes:');
    const userIndexes = await User.collection.indexes();
    console.log(JSON.stringify(userIndexes, null, 2));

  } catch (error) {
    console.error('❌ Error creating indexes:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the script
createIndexes();
