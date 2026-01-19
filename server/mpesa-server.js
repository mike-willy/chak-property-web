/**
 * mpesa-server.js - LIVE PAYMENT VERSION
 * Updated for live payments with real-time Firebase updates
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');
const cors = require('cors');
const { FieldValue } = require('firebase-admin/firestore');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ 
  origin: ['http://localhost:3000', 'https://your-react-app.com'], 
  credentials: true 
}));

// ==================== STARTUP DEBUG ====================
console.log('\n==============================');
console.log('🚀 MPESA LIVE PAYMENT SERVER');
console.log('==============================');
console.log('ENVIRONMENT:', process.env.MPESA_ENV || 'sandbox');
console.log('SHORTCODE:', process.env.MPESA_SHORTCODE);
console.log('CALLBACK:', process.env.MPESA_CALLBACK_URL);
console.log('==============================\n');

// ==================== ENV VALIDATION ====================
const requiredEnvVars = ['MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_SHORTCODE', 'MPESA_PASSKEY'];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`❌ FATAL: Missing ${varName} in .env`);
    process.exit(1);
  }
});

// ==================== FIREBASE INIT ====================
let db;
try {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  db = admin.firestore();
  console.log('✅ Firebase initialized');
} catch (err) {
  console.error('❌ Firebase initialization failed:', err.message);
  process.exit(1);
}

// ==================== MPESA CONFIG ====================
const MPESA_CONFIG = {
  consumerKey: process.env.MPESA_CONSUMER_KEY,
  consumerSecret: process.env.MPESA_CONSUMER_SECRET,
  shortCode: process.env.MPESA_SHORTCODE,
  passKey: process.env.MPESA_PASSKEY,
  callbackUrl: process.env.MPESA_CALLBACK_URL,
  environment: process.env.MPESA_ENV || 'sandbox'
};

const MPESA_BASE_URL = MPESA_CONFIG.environment === 'production' 
  ? 'https://api.safaricom.co.ke' 
  : 'https://sandbox.safaricom.co.ke';

// ==================== HELPERS ====================
function generateTimestamp() {
  const date = new Date();
  return (
    date.getFullYear() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0') +
    String(date.getHours()).padStart(2, '0') +
    String(date.getMinutes()).padStart(2, '0') +
    String(date.getSeconds()).padStart(2, '0')
  );
}

function generatePassword() {
  const timestamp = generateTimestamp();
  const password = Buffer.from(
    `${MPESA_CONFIG.shortCode}${MPESA_CONFIG.passKey}${timestamp}`
  ).toString('base64');
  
  return { password, timestamp };
}

async function getMpesaAccessToken() {
  const auth = Buffer.from(
    `${MPESA_CONFIG.consumerKey}:${MPESA_CONFIG.consumerSecret}`
  ).toString('base64');

  try {
    const response = await axios.get(
      `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: { Authorization: `Basic ${auth}` },
        timeout: 10000,
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error('❌ M-Pesa auth error:', error.response?.data || error.message);
    throw new Error(`M-Pesa authentication failed: ${error.message}`);
  }
}

function formatPhoneNumber(phone) {
  let formatted = phone.replace(/\D/g, '');
  
  if (formatted.startsWith('0')) {
    formatted = '254' + formatted.substring(1);
  } else if (formatted.startsWith('+')) {
    formatted = formatted.substring(1);
  }
  
  if (!formatted.startsWith('254')) {
    formatted = '254' + formatted;
  }
  
  return formatted;
}

// ==================== UPDATE ADMIN STATS ====================
async function updateAdminStats(amount = 0, status = 'completed') {
  try {
    const statsRef = db.collection('adminStats').doc('dashboard');
    const statsDoc = await statsRef.get();
    
    if (statsDoc.exists) {
      const updates = {
        lastUpdated: new Date()
      };
      
      if (status === 'completed') {
        updates.totalCollected = FieldValue.increment(parseFloat(amount) || 0);
        updates.completedPayments = FieldValue.increment(1);
        updates.pendingPayments = FieldValue.increment(-1);
      } else if (status === 'pending') {
        updates.pendingPayments = FieldValue.increment(1);
        updates.totalTransactions = FieldValue.increment(1);
      } else if (status === 'failed') {
        updates.pendingPayments = FieldValue.increment(-1);
      }
      
      await statsRef.update(updates);
      console.log(`✅ Updated admin stats: ${status} KSh ${amount}`);
    } else {
      // Initialize stats
      await statsRef.set({
        totalCollected: status === 'completed' ? parseFloat(amount) : 0,
        pendingPayments: status === 'pending' ? 1 : 0,
        completedPayments: status === 'completed' ? 1 : 0,
        totalTransactions: 1,
        lastUpdated: new Date()
      });
    }
  } catch (error) {
    console.error('❌ Error updating admin stats:', error);
  }
}

// ==================== ROUTES ====================

// Test endpoint
app.get('/api/mpesa/test', async (req, res) => {
  try {
    const token = await getMpesaAccessToken();
    res.json({
      success: true,
      environment: MPESA_CONFIG.environment,
      shortCode: MPESA_CONFIG.shortCode,
      tokenPreview: token.substring(0, 20) + '...',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Initiate STK Push
app.post('/api/mpesa/pay', async (req, res) => {
  try {
    const { phoneNumber, amount, tenantId, month, tenantName, propertyId, propertyName } = req.body;

    // Validate required fields
    if (!phoneNumber || !amount || !tenantId || !month) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: phoneNumber, amount, tenantId, month' 
      });
    }

    // Get access token
    const token = await getMpesaAccessToken();
    const { password, timestamp } = generatePassword();
    
    // Format phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    // Generate unique reference
    const reference = `RENT-${month}-${Date.now()}`;
    
    // Create payment record in Firebase FIRST
    const paymentRef = db.collection('payments').doc();
    const paymentData = {
      id: paymentRef.id,
      tenantId,
      tenantName: tenantName || 'Unknown Tenant',
      phoneNumber: formattedPhone,
      amount: parseFloat(amount),
      month,
      year: new Date().getFullYear(),
      status: 'pending',
      mpesaCode: null,
      transactionDate: null,
      createdAt: new Date(),
      propertyId: propertyId || null,
      propertyName: propertyName || null,
      reference: reference,
      description: `${month} Rent Payment`,
      checkoutId: null, // Will be updated after STK push
      completedAt: null
    };

    await paymentRef.set(paymentData);
    console.log(`📝 Created pending payment: ${paymentRef.id}`);
    
    // Update admin stats for pending payment
    await updateAdminStats(amount, 'pending');

    // STK Push payload
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
      AccountReference: reference,
      TransactionDesc: `Rent Payment - ${propertyName || 'CHAK Estates'}`,
    };

    // Initiate STK Push
    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      stkPayload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    // Update payment with checkout ID
    await paymentRef.update({
      checkoutId: response.data.CheckoutRequestID,
      merchantRequestId: response.data.MerchantRequestID
    });

    console.log(`✅ STK Push initiated for ${formattedPhone}: ${response.data.CheckoutRequestID}`);
    
    res.json({
      success: true,
      message: 'STK Push sent successfully. Check your phone.',
      data: {
        paymentId: paymentRef.id,
        checkoutRequestId: response.data.CheckoutRequestID,
        merchantRequestId: response.data.MerchantRequestID,
        reference: reference
      }
    });

  } catch (error) {
    console.error('❌ STK Push error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Payment initiation failed',
      details: error.response?.data || error.message
    });
  }
});

// M-Pesa Callback Webhook
app.post('/api/mpesa/callback', async (req, res) => {
  console.log('📞 M-PESA CALLBACK RECEIVED:', JSON.stringify(req.body, null, 2));
  
  try {
    const callbackData = req.body;
    
    // Validate callback structure
    if (!callbackData.Body || !callbackData.Body.stkCallback) {
      console.error('❌ Invalid callback structure');
      return res.json({ ResultCode: 1, ResultDesc: 'Invalid callback' });
    }
    
    const { ResultCode, ResultDesc, CheckoutRequestID, CallbackMetadata } = callbackData.Body.stkCallback;
    
    // Find payment by CheckoutRequestID
    const paymentsRef = db.collection('payments');
    const querySnapshot = await paymentsRef
      .where('checkoutId', '==', CheckoutRequestID)
      .limit(1)
      .get();
    
    if (querySnapshot.empty) {
      console.error(`❌ Payment not found for checkout: ${CheckoutRequestID}`);
      return res.json({ ResultCode: 1, ResultDesc: 'Payment not found' });
    }
    
    const paymentDoc = querySnapshot.docs[0];
    const paymentRef = paymentDoc.ref;
    const paymentId = paymentDoc.id;
    
    if (ResultCode === 0) {
      // SUCCESSFUL PAYMENT
      const metadata = CallbackMetadata?.Item || [];
      
      const mpesaCode = metadata.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
      const amount = metadata.find(item => item.Name === 'Amount')?.Value;
      const phone = metadata.find(item => item.Name === 'PhoneNumber')?.Value;
      const transactionDate = metadata.find(item => item.Name === 'TransactionDate')?.Value;
      
      // Parse transaction date
      let parsedDate = new Date();
      if (transactionDate) {
        const dateStr = transactionDate.toString();
        try {
          parsedDate = new Date(
            parseInt(dateStr.substring(0, 4)),
            parseInt(dateStr.substring(4, 6)) - 1,
            parseInt(dateStr.substring(6, 8)),
            parseInt(dateStr.substring(8, 10)),
            parseInt(dateStr.substring(10, 12)),
            parseInt(dateStr.substring(12, 14))
          );
        } catch (e) {
          console.warn('⚠️ Could not parse transaction date, using current time');
        }
      }
      
      // Update payment record
      await paymentRef.update({
        status: 'completed',
        mpesaCode: mpesaCode || 'Unknown',
        amount: parseFloat(amount) || paymentDoc.data().amount,
        phoneNumber: phone || paymentDoc.data().phoneNumber,
        transactionDate: parsedDate,
        completedAt: new Date(),
        updatedAt: new Date()
      });
      
      // Update admin stats
      await updateAdminStats(amount || paymentDoc.data().amount, 'completed');
      
      // Update tenant's last payment
      const paymentData = paymentDoc.data();
      if (paymentData.tenantId) {
        try {
          await db.collection('tenants').doc(paymentData.tenantId).update({
            lastPaymentDate: new Date(),
            lastPaymentAmount: parseFloat(amount) || paymentData.amount,
            lastPaymentMonth: paymentData.month,
            updatedAt: new Date()
          });
        } catch (e) {
          console.warn('⚠️ Could not update tenant record:', e.message);
        }
      }
      
      console.log(`✅ Payment ${paymentId} completed: ${mpesaCode} - KSh ${amount}`);
      
    } else {
      // FAILED PAYMENT
      await paymentRef.update({
        status: 'failed',
        failureReason: ResultDesc || 'Payment failed',
        updatedAt: new Date()
      });
      
      // Update admin stats for failed payment
      await updateAdminStats(0, 'failed');
      
      console.log(`❌ Payment ${paymentId} failed: ${ResultDesc}`);
    }
    
    // Always respond with success to M-Pesa
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
    
  } catch (error) {
    console.error('❌ Callback processing error:', error);
    res.json({ ResultCode: 1, ResultDesc: 'Callback processing failed' });
  }
});

// Get payment status
app.get('/api/mpesa/payment/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const paymentDoc = await db.collection('payments').doc(paymentId).get();
    
    if (!paymentDoc.exists) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }
    
    res.json({ success: true, data: paymentDoc.data() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get dashboard statistics
app.get('/api/mpesa/stats', async (req, res) => {
  try {
    const statsRef = db.collection('adminStats').doc('dashboard');
    const statsDoc = await statsRef.get();
    
    if (statsDoc.exists) {
      res.json({ success: true, data: statsDoc.data() });
    } else {
      res.json({ 
        success: true, 
        data: {
          totalCollected: 0,
          pendingPayments: 0,
          completedPayments: 0,
          totalTransactions: 0,
          lastUpdated: null
        }
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'M-Pesa Payment Server',
    environment: MPESA_CONFIG.environment,
    timestamp: new Date().toISOString(),
    firebase: 'Connected',
    mpesa: 'Ready'
  });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ MPESA LIVE SERVER RUNNING ON PORT ${PORT}`);
  console.log(`📡 Environment: ${MPESA_CONFIG.environment}`);
  console.log(`🏪 Till Number: ${MPESA_CONFIG.shortCode}`);
  console.log(`🌐 Callback URL: ${MPESA_CONFIG.callbackUrl}`);
  console.log('==========================================');
});