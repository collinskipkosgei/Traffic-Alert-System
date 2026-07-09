const dns = require('dns');
const path = require('path');
const fs = require('fs');
const os = require('os');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express')
const cors = require('cors')
const unirest = require('unirest')
const NgrokLib = require('@ngrok/ngrok')
const rateLimit = require('express-rate-limit')
const { shouldThrottleLogin, markLoginAttempt, LOGIN_ATTEMPT_MAX } = require('./src/utils/loginAttempts')

const { connectDB } = require('./src/db')
const { getCheckoutResult, ingestSafaricomStkCallback, receiptFromCallbackItems } = require('./src/mpesaCheckoutStore')
const Payment = require('./src/models/Payment')
const User = require('./src/models/User')
const mongoose = require('mongoose')
const healthRoutes = require('./src/routes/health')
const alertRoutes = require('./src/routes/alerts')
const authRoutes = require('./src/routes/auth')
const paymentRoutes = require('./src/routes/payment')
const locationRoutes = require('./src/routes/location')
const adminRoutes = require('./src/routes/admin')

const app = express()
const PORT = process.env.PORT || 5000
const loginAttemptsStore = new Map()

// ========== RATE LIMITING ==========
// Global limiter - all API endpoints
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    success: false,
    error: 'Too many requests from this IP. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
})

// Stricter limiter for M-Pesa (prevent payment abuse)
const mpesaLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 STK push attempts per hour
  message: {
    success: false,
    error: 'Too many payment attempts. Please try again in an hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Apply global rate limit to all API routes
app.use('/api/', globalLimiter)

// ========== END RATE LIMITING ==========

let mpesaAccessToken = ""
let checkoutRequestID = ""

function getMpesaCallbackUrl() {
  const explicit = process.env.MPESA_CALLBACK_URL
  if (explicit && String(explicit).trim() !== '') return String(explicit).trim()
  const base = process.env.NGROK_URL
  if (base && String(base).trim() !== '') {
    return `${String(base).replace(/\/+$/, '')}/api/mpesa/callback`
  }
  return 'https://your-ngrok-url.ngrok.io/api/mpesa/callback'
}

function extractMpesaReceiptNumber(body) {
  if (!body || typeof body !== 'object') return undefined
  if (body.MpesaReceiptNumber != null && String(body.MpesaReceiptNumber).trim() !== '') {
    return String(body.MpesaReceiptNumber)
  }
  const pickFromItems = (items) => {
    if (items == null) return undefined
    const list = Array.isArray(items) ? items : [items]
    const names = ['MpesaReceiptNumber', 'ReceiptNo', 'MpesaReceiptNo']
    for (const name of names) {
      const hit = list.find((x) => x && x.Name === name)
      if (hit != null && hit.Value != null && String(hit.Value).trim() !== '') {
        return String(hit.Value)
      }
    }
    return undefined
  }
  if (body.CallbackMetadata && body.CallbackMetadata.Item) {
    const r = pickFromItems(body.CallbackMetadata.Item)
    if (r) return r
  }
  if (body.ResultParameters && body.ResultParameters.ResultParameter) {
    const rp = body.ResultParameters.ResultParameter
    const list = Array.isArray(rp) ? rp : [rp]
    for (const p of list) {
      if (!p) continue
      if (p.Name === 'MpesaReceiptNumber' || p.Name === 'ReceiptNo') {
        if (p.Value != null && String(p.Value).trim() !== '') return String(p.Value)
      }
    }
  }
  return undefined
}

function normalizeDarajaStkQueryBody(body) {
  if (!body || typeof body !== 'object') return body
  const out = { ...body }
  const receipt = extractMpesaReceiptNumber(body)
  if (receipt) {
    out.MpesaReceiptNumber = receipt
  }
  return out
}

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

const getMpesaAccessToken = async () => {
  const consumerKey = process.env.consumerKey
  const consumerSecret = process.env.consumerSecret
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')
  try {
    const response = await unirest.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials')
      .headers({ 'Authorization': `Basic ${auth}` })
    mpesaAccessToken = response.body.access_token
    console.log('✅ M-Pesa Access Token obtained')
    return mpesaAccessToken
  } catch (error) {
    console.error('❌ Failed to get M-Pesa token:', error)
    throw error
  }
}

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
        CallBackURL: getMpesaCallbackUrl(),
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

// Apply specific rate limits to sensitive routes
app.use('/api/mpesa/stkpush', mpesaLimiter)

app.use((req, res, next) => {
  console.log('---------------------------');
  console.log(`📥 ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('---------------------------');
  next();
});

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

app.use('/api', alertRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/payment', paymentRoutes)
app.use('/api/location', locationRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/', healthRoutes)

app.post('/api/mpesa/stkpush', async (req, res) => {
  try {
    const { phoneNumber, amount, accountReference, transactionDesc, paymentDetails } = req.body
    if (!phoneNumber || !amount) {
      return res.status(400).json({ error: 'Phone number and amount are required' })
    }
    let formattedPhone = phoneNumber.toString().replace(/\s/g, '')
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1)
    } else if (formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.substring(1)
    }
    if (!mpesaAccessToken) {
      try {
        await getMpesaAccessToken()
      } catch {
        return res.status(503).json({ error: 'M-Pesa service is currently unavailable. Try again later.' })
      }
    }
    const result = await stkPush(formattedPhone, amount, accountReference || 'Payment', transactionDesc || 'Traffic Alert Payment')
    if (paymentDetails && req.user?._id) {
      try {
        await Payment.create({
          userId: req.user._id,
          checkoutRequestID: result.CheckoutRequestID,
          paymentMethod: 'mpesa',
          amountKes: Number(amount),
          tollId: paymentDetails.tollId || 'unknown',
          tollName: paymentDetails.tollName || 'Unknown Toll',
          vehicleRegistration: paymentDetails.vehicleRegistration || 'Unknown',
          routeFrom: paymentDetails.routeFrom || 'Unknown',
          routeTo: paymentDetails.routeTo || 'Unknown',
          distanceKm: String(paymentDetails.distanceKm || '0'),
          mpesaReceiptNumber: null,
          status: 'pending',
          failureReason: null,
          pendingNote: 'Awaiting M-Pesa callback confirmation',
          paidAt: new Date(),
        })
        console.log(`💾 Payment record created for ${result.CheckoutRequestID}`)
      } catch (dbErr) {
        console.error('Failed to create Payment record:', dbErr)
      }
    }
    res.json({ success: true, checkoutRequestID: result.CheckoutRequestID, message: 'STK Push sent successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/mpesa/callback', async (req, res) => {
  console.log('M-Pesa Callback received:', req.body)
  try {
    const parsed = ingestSafaricomStkCallback(req.body)
    if (parsed?.receipt) {
      console.log(`✅ Stored M-Pesa receipt for ${parsed.checkoutRequestID}: ${parsed.receipt}`)
    }
  } catch (e) {
    console.error('M-Pesa callback ingest error:', e)
  }
  const { Body } = req.body ?? {}
  if (Body && Body.stkCallback) {
    const { ResultCode, ResultDesc, CallbackMetadata, CheckoutRequestID } = Body.stkCallback
    const items = CallbackMetadata?.Item
    const itemList = items == null ? [] : Array.isArray(items) ? items : [items]
    const amount = itemList.find(item => item.Name === 'Amount')?.Value
    const mpesaReceiptNumber = itemList.find(item => item.Name === 'MpesaReceiptNumber')?.Value
    const phoneNumber = itemList.find(item => item.Name === 'PhoneNumber')?.Value
    if (ResultCode === 0) {
      console.log('✅ Payment successful:', ResultDesc)
      console.log(`💰 Payment: Amount=${amount}, Receipt=${mpesaReceiptNumber}, Phone=${phoneNumber}`)
      if (CheckoutRequestID && mpesaReceiptNumber) {
        try {
          await Payment.findOneAndUpdate(
            { checkoutRequestID: String(CheckoutRequestID) },
            { mpesaReceiptNumber: String(mpesaReceiptNumber), status: 'completed', pendingNote: null },
            { new: true }
          )
          console.log(`💾 Payment record updated with receipt ${mpesaReceiptNumber} for ${CheckoutRequestID}`)
        } catch (dbErr) {
          console.error('Failed to update Payment record with receipt:', dbErr)
        }
      }
    } else {
      console.log('❌ Payment failed:', ResultDesc)
      if (CheckoutRequestID) {
        try {
          await Payment.findOneAndUpdate(
            { checkoutRequestID: String(CheckoutRequestID) },
            { status: 'failed', failureReason: ResultDesc || 'Payment failed', pendingNote: null }
          )
        } catch (dbErr) {
          console.error('Failed to update Payment record as failed:', dbErr)
        }
      }
    }
  }
  res.json({ ResultCode: 0, ResultDesc: 'Success' })
})

app.post('/api/mpesa/status', async (req, res) => {
  try {
    const { checkoutRequestID } = req.body
    if (!mpesaAccessToken) {
      try {
        await getMpesaAccessToken()
      } catch {
        return res.status(503).json({ error: 'M-Pesa service is currently unavailable. Try again later.' })
      }
    }
    const timestamp = generateTimestamp()
    const password = Buffer.from(`174379${process.env.passkey}${timestamp}`).toString('base64')
    const response = await unirest.post('https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query')
      .headers({ 'Authorization': `Bearer ${mpesaAccessToken}`, 'Content-Type': 'application/json' })
      .send({ BusinessShortCode: '174379', Password: password, Timestamp: timestamp, CheckoutRequestID: checkoutRequestID })
    const out = normalizeDarajaStkQueryBody(response.body)
    const stored = getCheckoutResult(checkoutRequestID)
    if (stored?.mpesaReceiptNumber && !out.MpesaReceiptNumber) {
      out.MpesaReceiptNumber = String(stored.mpesaReceiptNumber)
    }
    const callbackItems = response.body?.Body?.stkCallback?.CallbackMetadata?.Item
    if (callbackItems && !out.MpesaReceiptNumber) {
      const receipt = receiptFromCallbackItems(callbackItems)
      if (receipt) out.MpesaReceiptNumber = receipt
    }
    if (out.MpesaReceiptNumber && `${out.ResultCode}` === '0') {
      try {
        await Payment.findOneAndUpdate(
          { checkoutRequestID: String(checkoutRequestID) },
          { mpesaReceiptNumber: String(out.MpesaReceiptNumber), status: 'completed', pendingNote: null }
        )
      } catch (dbErr) {
        console.error('Failed to update Payment from status query:', dbErr)
      }
    }
    res.json(out)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

const nodemailer = require('nodemailer')
const bcrypt = require('bcryptjs')

app.post('/api/setup-admin', async (req, res) => {
  try {
    const email = 'ckipchumba53@gmail.com'
    const defaultPassword = 'Admin123!'
    const user = await User.findOne({ email })
    if (!user) {
      const passwordHash = await bcrypt.hash(defaultPassword, 10)
      const newUser = await User.create({ email, passwordHash, role: 'admin' })
      return res.json({ status: 'success', message: `${email} created as admin. Default password: ${defaultPassword}`, user: { _id: newUser._id, email: newUser.email, role: newUser.role } })
    }
    const result = await User.updateOne({ email }, { $set: { role: 'admin' } })
    res.json({ status: 'success', message: `${email} is now admin`, result })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
})

app.post('/api/sos', async (req, res) => {
  try {
    const { latitude, longitude, message } = req.body ?? {}
    const emergencyEmail = process.env.EMERGENCY_EMAIL || 'ckipchumba53@gmail.com'
    let adminEmails = []
    try {
      const adminUsers = await User.find({ role: 'admin', suspended: false }).select('email')
      adminEmails = adminUsers.map(u => u.email)
    } catch { }
    const allRecipients = Array.from(new Set([emergencyEmail, ...adminEmails].filter(Boolean)))
    const emailTo = allRecipients.join(', ')
    const text = message || `SOS: I need assistance. Location: https://maps.google.com/?q=${latitude},${longitude}`
    console.log(`🚨 SOS triggered. Recipients: ${emailTo}, Message: ${text}`)
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    if (smtpUser && smtpPass) {
      transporter.sendMail({
        from: `"Traffic Alert System" <${smtpUser}>`,
        to: emailTo,
        subject: '🚨 Emergency SOS Alert',
        text,
        html: `<p><strong>Emergency SOS Alert</strong></p><p>${text}</p><p><strong>Time:</strong> ${new Date().toISOString()}</p>`,
      }).then(info => console.log('✅ SOS email sent:', info.messageId))
        .catch(err => console.warn('⚠️ SOS email failed:', err.message || err))
    } else {
      console.log('ℹ️ No SMTP credentials. SOS request received but email not sent.')
    }
    res.json({ status: 'success', message: 'Emergency alert received.', emailTo, text })
  } catch (error) {
    console.error('❌ SOS endpoint error:', error)
    res.status(500).json({ error: 'Failed to process SOS' })
  }
})

app.use((err, _req, res, _next) => {
  console.error('❌ Server error:', err)
  res.status(500).json({ error: 'Server error', message: err.message })
})

// ========== AUTOMATIC Ngrok INITIALIZATION ==========
const ensureNgrokConfig = () => {
  const home = os.homedir();
  const isWindows = process.platform === 'win32';
  const configDir = isWindows
    ? path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'ngrok')
    : path.join(home, '.ngrok2');
  const configPath = path.join(configDir, 'ngrok.yml');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
    console.log('📁 Created ngrok config directory');
  }
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, `version: "2"\nauthtoken: ${process.env.ngrokauth}\n`, 'utf8');
    console.log('📝 Created ngrok config file');
  }
};

const initializeNgrok = async (retries = 3) => {
  try {
    console.log('🔄 Initializing Ngrok tunnel...');
    ensureNgrokConfig();

    const listener = await NgrokLib.forward({
      addr: PORT,
      authtoken: process.env.ngrokauth,
    });

    const url = listener.url();
    console.log(`✅ Ngrok tunnel initialized!`);
    console.log(`🌐 Public URL: ${url}`);
    process.env.NGROK_URL = url;
    return url;

  } catch (error) {
    console.error('❌ Ngrok error:', error.message || error);
    if (retries > 0) {
      console.log(`⚠️ Retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return initializeNgrok(retries - 1);
    }
    console.log('⚠️ Continuing without Ngrok');
    return null;
  }
};

// ========== HEALTH CHECK ENDPOINT ==========
app.get('/api/health', async (req, res) => {
  const checks = {
    mongo: mongoose.connection.readyState === 1,
    mpesa: !!mpesaAccessToken,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };
  const healthy = Object.values(checks).every(v => v !== false);
  res.status(healthy ? 200 : 503).json({ 
    status: healthy ? 'ok' : 'degraded', 
    checks 
  });
});

// ========== START SERVER ==========
const startServer = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await connectDB();
    console.log("✅ MongoDB connection successful");

    try {
      await getMpesaAccessToken();
    } catch (e) {
      console.warn("⚠️ M-Pesa token unavailable:", e.message);
    }

    setInterval(async () => {
      try {
        await getMpesaAccessToken();
      } catch (e) {
        console.warn("⚠️ Token refresh failed:", e.message);
      }
    }, 30 * 60 * 1000);

    if (process.env.ngrokauth) {
      await initializeNgrok();
    } else {
      console.log('⚠️ No ngrok authtoken found. Set ngrokauth in .env to auto-start tunnel.');
    }

    console.log(`🔔 M-Pesa callback URL: ${getMpesaCallbackUrl()}`);

    app.listen(PORT, () => {
      console.log(`\n=================================`)
      console.log(`🚀 TRAFFIC ALERT SYSTEM WITH M-PESA`)
      console.log(`=================================`)
      console.log(`✅ Server: http://localhost:${PORT}`)
      console.log(`💳 M-Pesa: POST /api/mpesa/stkpush`)
      console.log(`🔒 Rate Limiting: Enabled`)
      console.log(`   - Global: 100 req/15min`)
      console.log(`   - M-Pesa: 10 req/hour`)
      console.log(`   - Auth: 5 req/15min`)
      console.log(`=================================\n`)
    });

  } catch (err) {
    console.error("❌ Server startup failed");
    console.error(err);
    process.exit(1);
  }
};

module.exports = app

if (require.main === module) {
  startServer()
}