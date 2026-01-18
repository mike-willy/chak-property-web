const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const admin = require('firebase-admin');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Debug startup
console.log('\n=== SERVER STARTUP DEBUG ===');
console.log('Environment variables loaded:');
console.log('- PORT:', process.env.PORT || 5000);
console.log('- MPESA_SHORTCODE:', process.env.MPESA_SHORTCODE || '174379');
console.log('- MPESA_CALLBACK_URL:', process.env.MPESA_CALLBACK_URL || 'http://localhost:5000/api/mpesa/callback');
console.log('- MPESA_CONSUMER_KEY exists:', !!process.env.MPESA_CONSUMER_KEY);
console.log('- MPESA_CONSUMER_SECRET exists:', !!process.env.MPESA_CONSUMER_SECRET);

if (process.env.MPESA_CONSUMER_KEY) {
  console.log('Consumer Key preview:', 
    process.env.MPESA_CONSUMER_KEY.substring(0, 10) + 
    '...' + 
    process.env.MPESA_CONSUMER_KEY.substring(process.env.MPESA_CONSUMER_KEY.length - 10)
  );
}

// CORS configuration
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

// Initialize Firebase
let db;
try {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
  console.log('✅ Firebase initialized');
} catch (error) {
  console.log('⚠️  Firebase not initialized - running without database');
  // Create mock db for development
  db = {
    collection: () => ({
      add: async (data) => {
        console.log('📝 Mock DB - Would save:', data);
        return { id: 'mock-id-' + Date.now() };
      },
      where: () => ({
        limit: () => ({
          get: async () => ({ empty: true, docs: [] })
        })
      }),
      doc: () => ({
        update: async (data) => {
          console.log('📝 Mock DB - Would update:', data);
          return true;
        },
        collection: () => ({
          doc: () => ({
            update: async (data) => {
              console.log('📝 Mock DB - Would update subcollection:', data);
              return true;
            }
          })
        })
      })
    })
  };
}

// M-Pesa Configuration
const MPESA_CONFIG = {
  consumerKey: process.env.MPESA_CONSUMER_KEY,
  consumerSecret: process.env.MPESA_CONSUMER_SECRET,
  shortCode: process.env.MPESA_SHORTCODE || '174379',
  passKey: process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
  callbackUrl: process.env.MPESA_CALLBACK_URL || 'http://localhost:5000/api/mpesa/callback'
};

// Generate M-Pesa password
function generatePassword() {
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
  const password = Buffer.from(
    `${MPESA_CONFIG.shortCode}${MPESA_CONFIG.passKey}${timestamp}`
  ).toString('base64');
  return { password, timestamp };
}

// Get M-Pesa Access Token with DEBUG
async function getMpesaAccessToken() {
  try {
    console.log('\n=== DEBUG: M-Pesa Authentication ===');
    console.log('Checking credentials...');
    
    // Check if credentials are valid
    if (!MPESA_CONFIG.consumerKey || !MPESA_CONFIG.consumerSecret) {
      throw new Error('Consumer Key or Secret is missing from .env file');
    }
    
    if (MPESA_CONFIG.consumerKey.includes('your_') || MPESA_CONFIG.consumerKey === 'test_consumer_key') {
      throw new Error('You are using placeholder credentials. Get real ones from Daraja Portal');
    }
    
    console.log('✅ Credentials look valid');
    console.log('Key length:', MPESA_CONFIG.consumerKey.length);
    console.log('Secret length:', MPESA_CONFIG.consumerSecret.length);
    
    const auth = Buffer.from(
      `${MPESA_CONFIG.consumerKey}:${MPESA_CONFIG.consumerSecret}`
    ).toString('base64');

    console.log('Making request to Daraja API...');
    const response = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        headers: { 
          Authorization: `Basic ${auth}`,
          'Cache-Control': 'no-cache'
        },
        timeout: 10000
      }
    );

    console.log('✅ SUCCESS: Got access token!');
    console.log('Token preview:', response.data.access_token?.substring(0, 30) + '...');
    return response.data.access_token;
    
  } catch (error) {
    console.error('\n❌ FAILED: M-Pesa Authentication Error');
    console.error('Error message:', error.message);
    
    if (error.response) {
      console.error('Status code:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    console.error('\n💡 SOLUTION:');
    console.error('1. Go to https://developer.safaricom.co.ke/apps');
    console.error('2. Create Sandbox App (Lipa Na M-Pesa Online)');
    console.error('3. Copy Consumer Key & Secret to server/.env file');
    console.error('4. Restart server');
    
    throw error;
  }
}

// TEST ENDPOINT: Verify credentials
app.get('/api/mpesa/test-auth', async (req, res) => {
  try {
    console.log('\n=== Testing M-Pesa Authentication ===');
    const token = await getMpesaAccessToken();
    
    res.json({
      success: true,
      message: '✅ M-Pesa authentication successful!',
      hasToken: !!token,
      credentialsOk: true
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      message: error.message,
      help: 'Get credentials from https://developer.safaricom.co.ke/apps'
    });
  }
});

// 1. Initiate STK Push Payment
app.post('/api/mpesa/pay', async (req, res) => {
  try {
    console.log('\n=== PAYMENT REQUEST ===');
    console.log('Payment data:', req.body);
    
    const { phoneNumber, amount, tenantId, propertyId, unit, month, paymentType } = req.body;

    // Validate
    if (!phoneNumber || !amount || !tenantId || !month) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const accessToken = await getMpesaAccessToken();
    const { password, timestamp } = generatePassword();

    // Format phone (2547...)
    const formattedPhone = phoneNumber.startsWith('254') 
      ? phoneNumber 
      : `254${phoneNumber.slice(-9)}`;

    // Create payment reference
    const accountReference = `${propertyId}-${unit}-${month}`.toUpperCase();
    
    // Payment description
    const paymentDesc = paymentType === 'deposit' 
      ? 'Deposit Payment' 
      : `Rent Payment - ${month}`;

    // STK Push request
    const stkPushData = {
      BusinessShortCode: MPESA_CONFIG.shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: MPESA_CONFIG.shortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: MPESA_CONFIG.callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: paymentDesc
    };

    console.log('Sending STK Push to Daraja...');
    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      stkPushData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ STK Push initiated successfully');
    console.log('Response:', response.data);

    // Create pending payment record
    const paymentData = {
      tenantId,
      propertyId,
      unit,
      month,
      amount: Number(amount),
      phoneNumber: formattedPhone,
      status: 'pending',
      paymentType: paymentType || 'rent',
      mpesaCheckoutId: response.data.CheckoutRequestID,
      accountReference,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const paymentRef = await db.collection('payments').add(paymentData);

    res.json({
      success: true,
      message: 'Payment initiated. Check your phone to complete.',
      checkoutId: response.data.CheckoutRequestID,
      paymentId: paymentRef.id,
      note: 'Use test phone 254708374149 and PIN 410410'
    });

  } catch (error) {
    console.error('❌ STK Push Error:');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    
    res.status(500).json({
      error: 'Payment initiation failed',
      details: error.response?.data || error.message,
      help: 'Check if using correct test phone: 254708374149'
    });
  }
});

// 2. M-Pesa Callback Webhook
app.post('/api/mpesa/callback', async (req, res) => {
  try {
    console.log('📞 M-Pesa Callback received:', req.body);
    
    const callbackData = req.body;
    
    // Check if payment was successful
    if (callbackData.Body?.stkCallback?.ResultCode === 0) {
      const metadata = callbackData.Body.stkCallback.CallbackMetadata?.Item || [];
      const amount = metadata.find(item => item.Name === 'Amount')?.Value;
      const mpesaReceipt = metadata.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
      const phone = metadata.find(item => item.Name === 'PhoneNumber')?.Value;
      const checkoutId = callbackData.Body.stkCallback.CheckoutRequestID;
      
      console.log('✅ Payment successful!');
      console.log('Amount:', amount);
      console.log('Receipt:', mpesaReceipt);
      console.log('Phone:', phone);
      console.log('Checkout ID:', checkoutId);
    }
    
    // Always acknowledge receipt
    res.json({
      ResultCode: 0,
      ResultDesc: 'Callback processed successfully'
    });
    
  } catch (error) {
    console.error('Callback Error:', error);
    res.json({
      ResultCode: 1,
      ResultDesc: 'Error processing callback'
    });
  }
});

// 3. Check Payment Status
app.get('/api/mpesa/status/:checkoutId', async (req, res) => {
  try {
    const { checkoutId } = req.params;
    
    const paymentsQuery = await db.collection('payments')
      .where('mpesaCheckoutId', '==', checkoutId)
      .limit(1)
      .get();
    
    if (paymentsQuery.empty) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    const payment = paymentsQuery.docs[0].data();
    res.json(payment);
    
  } catch (error) {
    console.error('Status Check Error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'M-Pesa API is running',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 M-Pesa Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔑 Auth test: http://localhost:${PORT}/api/mpesa/test-auth`);
  console.log(`📱 Test endpoint: http://localhost:${PORT}/api/mpesa/pay`);
});