// Add this at the VERY TOP (line 1 and 2)
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

// Then your existing code continues...
require('dotenv').config();
// ... rest of your code

require('dotenv').config()

const express = require('express')
const cors = require('cors')
const unirest = require('unirest')
const ngrok = require('ngrok')

const { connectDB } = require('./src/db')
const healthRoutes = require('./src/routes/health')
const alertRoutes = require('./src/routes/alerts')
const authRoutes = require('./src/routes/auth')
const paymentRoutes = require('./src/routes/payment')


const app = express()
connectDB()
app.use(cors())
const PORT = process.env.PORT || 5000  // Changed from 5001 to 5000

// M-Pesa Variables
let mpesaAccessToken = ""
let checkoutRequestID = ""

// Generate timestamp for M-Pesa
const generateTimestamp = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}${hours}${minutes}${seconds}`
}

// Get M-Pesa Access Token
const getMpesaAccessToken = async () => {
  const consumerKey = process.env.consumerKey
  const consumerSecret = process.env.consumerSecret
  
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')
  
  try {
    const response = await unirest.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials')
      .headers({
        'Authorization': `Basic ${auth}`
      })
    
    mpesaAccessToken = response.body.access_token
    console.log('✅ M-Pesa Access Token obtained')
    return mpesaAccessToken
  } catch (error) {
    console.error('❌ Failed to get M-Pesa token:', error)
    throw error
  }
}

// STK Push (Lipa Na M-Pesa Online)
const stkPush = async (phoneNumber, amount, accountReference, transactionDesc) => {
  try {
    const timestamp = generateTimestamp()
    const password = Buffer.from(`174379${process.env.passkey}${timestamp}`).toString('base64')
    
    const response = await unirest.post('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest')
      .headers({
        'Authorization': `Bearer ${mpesaAccessToken}`,
        'Content-Type': 'application/json'
      })
      .send({
        BusinessShortCode: '174379',
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: phoneNumber,
        PartyB: '174379',
        PhoneNumber: phoneNumber,
        CallBackURL: `${process.env.NGROK_URL || 'https://your-ngrok-url.ngrok.io'}/api/payment/callback`,
        AccountReference: accountReference,
        TransactionDesc: transactionDesc
      })
    
    checkoutRequestID = response.body.CheckoutRequestID
    console.log('✅ STK Push sent:', response.body)
    return response.body
  } catch (error) {
    console.error('❌ STK Push failed:', error)
    throw error
  }
}

// Middleware
app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.use((req, res, next) => {
  console.log('---------------------------');
  console.log(`📥 ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('---------------------------');
  next();
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({ 
    message: 'Traffic Alert System API with M-Pesa',
    endpoints: {
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      mpesaSTKPush: 'POST /api/mpesa/stkpush',
      mpesaCallback: 'POST /api/mpesa/callback',
      mpesaStatus: 'POST /api/mpesa/status',
      health: 'GET /api/health'
    }
  })
})

// Routes
// app.use('/api', healthRoutes)
app.use('/api', alertRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/payment', paymentRoutes)
app.use('/api/', healthRoutes)  

// M-Pesa Routes
app.post('/api/mpesa/stkpush', async (req, res) => {
  try {
    const { phoneNumber, amount, accountReference, transactionDesc } = req.body
    
    if (!phoneNumber || !amount) {
      return res.status(400).json({ error: 'Phone number and amount are required' })
    }
    
    // Format phone number
    let formattedPhone = phoneNumber.toString().replace(/\s/g, '')
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1)
    } else if (formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.substring(1)
    }
    
    const result = await stkPush(formattedPhone, amount, accountReference || 'Payment', transactionDesc || 'Traffic Alert Payment')
    
    res.json({ 
      success: true, 
      checkoutRequestID: result.CheckoutRequestID,
      message: 'STK Push sent successfully' 
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/mpesa/callback', (req, res) => {
  console.log('M-Pesa Callback received:', req.body)
  
  const { Body } = req.body
  if (Body && Body.stkCallback) {
    const { ResultCode, ResultDesc, CallbackMetadata } = Body.stkCallback
    
    if (ResultCode === 0) {
      console.log('✅ Payment successful:', ResultDesc)
      const items = CallbackMetadata.Item
      const amount = items.find(item => item.Name === 'Amount')?.Value
      const mpesaReceiptNumber = items.find(item => item.Name === 'MpesaReceiptNumber')?.Value
      const phoneNumber = items.find(item => item.Name === 'PhoneNumber')?.Value
      
      console.log(`💰 Payment: Amount=${amount}, Receipt=${mpesaReceiptNumber}, Phone=${phoneNumber}`)
    } else {
      console.log('❌ Payment failed:', ResultDesc)
    }
  }
  
  res.json({ ResultCode: 0, ResultDesc: 'Success' })
})

// Get transaction status
app.post('/api/mpesa/status', async (req, res) => {
  try {
    const { checkoutRequestID } = req.body
    
    const timestamp = generateTimestamp()
    const password = Buffer.from(`174379${process.env.passkey}${timestamp}`).toString('base64')
    
    const response = await unirest.post('https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query')
      .headers({
        'Authorization': `Bearer ${mpesaAccessToken}`,
        'Content-Type': 'application/json'
      })
      .send({
        BusinessShortCode: '174379',
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestID
      })
    
    res.json(response.body)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Error handler
app.use((err, _req, res, _next) => {
  console.error('❌ Server error:', err)
  res.status(500).json({ error: 'Server error', message: err.message })
})

// Initialize Ngrok and Start Server
const initializeNgrok = async () => {
  try {
    console.log('🔄 Initializing Ngrok tunnel...')
    
    const url = await ngrok.connect({
      proto: "http",
      authtoken: process.env.ngrokauth,
      addr: PORT,
    })
    
    console.log(`✅ Ngrok tunnel initialized!`)
    console.log(`🌐 Public URL: ${url}`)
    
    process.env.NGROK_URL = url
    return url
  } catch (error) {
    console.error('❌ Ngrok initialization failed:', error)
    console.log('⚠️ Continuing without Ngrok')
    return null
  }
}

// Start Server
const startServer = async () => {
  try {
    
    console.log('✅ MongoDB connected')
    
    await getMpesaAccessToken()
    
    setInterval(async () => {
      await getMpesaAccessToken()
    }, 30 * 60 * 1000)
    
    if (process.env.ngrokauth) {
      await initializeNgrok()
    }
    
    app.listen(PORT, () => {
      console.log(`\n=================================`)
      console.log(`🚀 TRAFFIC ALERT SYSTEM WITH M-PESA`)
      console.log(`=================================`)
      console.log(`✅ Server: http://localhost:${PORT}`)
      console.log(`💳 M-Pesa: POST /api/mpesa/stkpush`)
      console.log(`=================================\n`)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

startServer()