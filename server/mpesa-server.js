/**
 * mpesa-server.js
 * Fully hardened version
 * Runs correctly when started from project root via `npm run dev`
 */

const path = require('path');

/* ============================
   ENVIRONMENT LOADING (CRITICAL)
   ============================ */
require('dotenv').config({
  path: path.resolve(__dirname, '.env'),
});

/* ============================
   DEPENDENCIES
   ============================ */
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const admin = require('firebase-admin');
const cors = require('cors');

/* ============================
   BASIC APP SETUP
   ============================ */
const app = express();
app.use(express.json());
app.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true,
  })
);

/* ============================
   STARTUP DEBUG (READ THIS)
   ============================ */
console.log('\n==============================');
console.log('🚀 MPESA SERVER STARTING');
console.log('==============================');
console.log('CWD:', process.cwd());
console.log('ENV PATH:', path.resolve(__dirname, '.env'));
console.log('PORT:', process.env.PORT);
console.log('MPESA_SHORTCODE:', process.env.MPESA_SHORTCODE);
console.log('MPESA_CALLBACK_URL:', process.env.MPESA_CALLBACK_URL);
console.log('MPESA_CONSUMER_KEY exists:', !!process.env.MPESA_CONSUMER_KEY);
console.log('MPESA_CONSUMER_SECRET exists:', !!process.env.MPESA_CONSUMER_SECRET);
console.log('==============================\n');

/* ============================
   HARD FAIL IF ENV IS MISSING
   ============================ */
if (!process.env.MPESA_CONSUMER_KEY || !process.env.MPESA_CONSUMER_SECRET) {
  console.error('❌ FATAL: M-Pesa credentials missing.');
  console.error('👉 Check server/.env and restart.');
  process.exit(1);
}

/* ============================
   FIREBASE INITIALIZATION
   ============================ */
let db;

try {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  db = admin.firestore();
  console.log('✅ Firebase initialized');
} catch (err) {
  console.warn('⚠️ Firebase failed, using mock DB');
  db = {
    collection: () => ({
      add: async (data) => {
        console.log('📝 MOCK DB ADD:', data);
        return { id: 'mock-' + Date.now() };
      },
      where: () => ({
        limit: () => ({
          get: async () => ({ empty: true, docs: [] }),
        }),
      }),
    }),
  };
}

/* ============================
   MPESA CONFIG
   ============================ */
const MPESA_CONFIG = {
  consumerKey: process.env.MPESA_CONSUMER_KEY,
  consumerSecret: process.env.MPESA_CONSUMER_SECRET,
  shortCode: process.env.MPESA_SHORTCODE || '174379',
  passKey: process.env.MPESA_PASSKEY,
  callbackUrl: process.env.MPESA_CALLBACK_URL,
};

/* ============================
   HELPERS
   ============================ */
function generatePassword() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, -3);

  const password = Buffer.from(
    `${MPESA_CONFIG.shortCode}${MPESA_CONFIG.passKey}${timestamp}`
  ).toString('base64');

  return { password, timestamp };
}

async function getMpesaAccessToken() {
  const auth = Buffer.from(
    `${MPESA_CONFIG.consumerKey}:${MPESA_CONFIG.consumerSecret}`
  ).toString('base64');

  const response = await axios.get(
    'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${auth}`,
      },
      timeout: 10000,
    }
  );

  return response.data.access_token;
}

/* ============================
   ROUTES
   ============================ */

app.get('/api/mpesa/test-auth', async (req, res) => {
  try {
    const token = await getMpesaAccessToken();
    res.json({
      success: true,
      tokenPreview: token.substring(0, 20) + '...',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

app.post('/api/mpesa/pay', async (req, res) => {
  try {
    const { phoneNumber, amount, tenantId, month } = req.body;

    if (!phoneNumber || !amount || !tenantId || !month) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const token = await getMpesaAccessToken();
    const { password, timestamp } = generatePassword();

    const formattedPhone = phoneNumber.startsWith('254')
      ? phoneNumber
      : `254${phoneNumber.slice(-9)}`;

    const stkPayload = {
      BusinessShortCode: MPESA_CONFIG.shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: MPESA_CONFIG.shortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: MPESA_CONFIG.callbackUrl,
      AccountReference: `RENT-${month}`,
      TransactionDesc: `Rent Payment ${month}`,
    };

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      stkPayload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    await db.collection('payments').add({
      tenantId,
      amount,
      month,
      phoneNumber: formattedPhone,
      status: 'pending',
      checkoutId: response.data.CheckoutRequestID,
      createdAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      checkoutId: response.data.CheckoutRequestID,
    });
  } catch (err) {
    console.error('❌ STK ERROR:', err.response?.data || err.message);
    res.status(500).json({
      error: 'STK Push failed',
      details: err.response?.data || err.message,
    });
  }
});

app.post('/api/mpesa/callback', (req, res) => {
  console.log('📞 CALLBACK RECEIVED:', JSON.stringify(req.body, null, 2));
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

app.get('/health', (_, res) => {
  res.json({
    status: 'OK',
    time: new Date().toISOString(),
  });
});

/* ============================
   START SERVER
   ============================ */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ MPESA SERVER RUNNING ON PORT ${PORT}`);
});
