/**
 * mpesa-server.js - LIVE PAYMENT VERSION with Rent Automation
 * Updated for live payments with real-time Firebase updates + Rent automation
 * FIXED: Now updates rentCycles when M-Pesa payments come in
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');
const cors = require('cors');
const { FieldValue } = require('firebase-admin/firestore');
const cron = require('node-cron');

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

// ==================== NEW: UPDATE RENT CYCLE FOR PAYMENT ====================
async function updateRentCycleForPayment(paymentData) {
  try {
    const { tenantId, month, amount, mpesaCode } = paymentData;
    
    if (!tenantId || !month) {
      console.warn(`⚠️ Missing tenantId or month for payment update`);
      return null;
    }
    
    // Find the matching rent cycle (tenantId + month)
    const rentCyclesRef = db.collection('rentCycles');
    const querySnapshot = await rentCyclesRef
      .where('tenantId', '==', tenantId)
      .where('cycleMonth', '==', month)
      .where('status', 'in', ['pending', 'overdue', 'partial'])
      .limit(1)
      .get();
    
    if (querySnapshot.empty) {
      console.warn(`⚠️ No rent cycle found for tenant ${tenantId}, month ${month}`);
      
      // Try to find by tenant name and month
      const paymentDoc = await db.collection('payments').where('tenantId', '==', tenantId).limit(1).get();
      if (!paymentDoc.empty) {
        const paymentData = paymentDoc.docs[0].data();
        const tenantName = paymentData.tenantName;
        
        const nameQuery = await rentCyclesRef
          .where('tenantName', '==', tenantName)
          .where('cycleMonth', '==', month)
          .where('status', 'in', ['pending', 'overdue', 'partial'])
          .limit(1)
          .get();
          
        if (!nameQuery.empty) {
          const cycleDoc = nameQuery.docs[0];
          const cycleRef = cycleDoc.ref;
          const cycleData = cycleDoc.data();
          
          const paidAmount = (cycleData.paidAmount || 0) + amount;
          const newStatus = paidAmount >= cycleData.amountDue ? 'paid' : 'partial';
          
          await cycleRef.update({
            status: newStatus,
            paidAmount: paidAmount,
            paidDate: new Date(),
            paymentMethod: 'mpesa',
            mpesaTransactionId: mpesaCode,
            'timestamps.updatedAt': new Date()
          });
          
          console.log(`✅ Updated rent cycle ${cycleDoc.id} (by name): ${cycleData.status} → ${newStatus}, KSh ${paidAmount}/${cycleData.amountDue}`);
          return cycleDoc.id;
        }
      }
      
      return null;
    }
    
    const cycleDoc = querySnapshot.docs[0];
    const cycleRef = cycleDoc.ref;
    const cycleData = cycleDoc.data();
    
    // Calculate new status
    const paidAmount = (cycleData.paidAmount || 0) + amount;
    const newStatus = paidAmount >= cycleData.amountDue ? 'paid' : 'partial';
    
    // Update rent cycle
    const updateData = {
      status: newStatus,
      paidAmount: paidAmount,
      paidDate: new Date(),
      paymentMethod: 'mpesa',
      mpesaTransactionId: mpesaCode,
      'timestamps.updatedAt': new Date()
    };
    
    // If it was overdue, update overdue amount
    if (cycleData.status === 'overdue') {
      updateData.overdueAmount = Math.max(0, cycleData.amountDue - paidAmount);
      updateData.daysOverdue = 0; // Reset days overdue when paid
    }
    
    await cycleRef.update(updateData);
    
    console.log(`✅ Updated rent cycle ${cycleDoc.id}: ${cycleData.status} → ${newStatus}, KSh ${paidAmount}/${cycleData.amountDue}`);
    
    // Create a payment record in tenant's subcollection
    try {
      const tenantPaymentRef = db.collection('tenants').doc(tenantId).collection('payments').doc();
      await tenantPaymentRef.set({
        id: tenantPaymentRef.id,
        rentCycleId: cycleDoc.id,
        amount: amount,
        paymentMethod: 'mpesa',
        mpesaCode: mpesaCode,
        month: month,
        status: 'completed',
        paidAt: new Date(),
        createdAt: new Date()
      });
    } catch (error) {
      console.warn('⚠️ Could not create tenant payment record:', error.message);
    }
    
    return cycleDoc.id;
    
  } catch (error) {
    console.error('❌ Error updating rent cycle:', error);
    throw error;
  }
}

// ==================== RENT AUTOMATION FUNCTIONS ====================

// Function to create monthly rent cycles
async function createMonthlyRentCycles() {
  console.log('🔄 Creating monthly rent cycles...');
  
  try {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
    
    // Find all active tenants
    const tenantsSnapshot = await db.collection('tenants')
      .where('status', '==', 'active')
      .get();
    
    console.log(`📋 Found ${tenantsSnapshot.size} active tenants`);
    
    let createdCount = 0;
    
    for (const tenantDoc of tenantsSnapshot.docs) {
      const tenant = tenantDoc.data();
      
      if (!tenant.propertyId) continue;
      
      // Get property details
      let propertyData = {};
      try {
        const propertyDoc = await db.collection('properties').doc(tenant.propertyId).get();
        if (propertyDoc.exists) {
          propertyData = propertyDoc.data();
        }
      } catch (err) {
        console.warn(`⚠️ Could not fetch property ${tenant.propertyId}:`, err.message);
      }
      
      const rentCycleId = `${tenantDoc.id}_${nextMonthStr}`;
      
      // Check if cycle already exists
      const existingCycle = await db.collection('rentCycles').doc(rentCycleId).get();
      if (existingCycle.exists) {
        console.log(`⏭️ Cycle already exists for ${tenant.fullName} - ${nextMonthStr}`);
        continue;
      }
      
      // Create rent cycle
      const rentCycleData = {
        id: rentCycleId,
        tenantId: tenantDoc.id,
        tenantName: tenant.fullName || 'Unknown',
        tenantPhone: tenant.phone || '',
        tenantEmail: tenant.email || '',
        
        propertyId: tenant.propertyId,
        propertyCode: propertyData.propertyCode || `PROP-${tenant.propertyId.substring(0, 8)}`,
        propertyAddress: propertyData.address || 'Address not set',
        
        cycleMonth: nextMonthStr,
        amountDue: tenant.monthlyRent || propertyData.rentAmount || 0,
        dueDate: nextMonth,
        gracePeriodEnds: new Date(nextMonth.getTime() + (3 * 24 * 60 * 60 * 1000)), // +3 days
        
        status: 'pending',
        paidAmount: 0,
        paidDate: null,
        paymentMethod: null,
        mpesaTransactionId: null, // NEW: For M-Pesa transaction tracking
        
        daysOverdue: 0,
        overdueAmount: 0,
        lastReminderSent: null,
        remindersSent: 0,
        
        riskLevel: 'low',
        notes: `Monthly rent for ${nextMonthStr}`,
        
        timestamps: {
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };
      
      await db.collection('rentCycles').doc(rentCycleId).set(rentCycleData);
      createdCount++;
      
      if (createdCount % 10 === 0) {
        console.log(`📝 Created ${createdCount} rent cycles...`);
      }
    }
    
    console.log(`✅ Created ${createdCount} new rent cycles for ${nextMonthStr}`);
    
    // Create system alert
    await db.collection('alerts').add({
      type: 'system_notification',
      priority: 'low',
      targetUserId: 'system',
      targetEmail: 'admin@chakestates.com',
      title: 'Monthly Rent Cycles Created',
      message: `Created ${createdCount} rent cycles for ${nextMonthStr}`,
      data: {
        month: nextMonthStr,
        cyclesCreated: createdCount,
        timestamp: new Date().toISOString()
      },
      status: 'unread',
      actionRequired: false,
      channels: ['in_app'],
      sentAt: new Date(),
      createdAt: new Date()
    });
    
    return createdCount;
  } catch (error) {
    console.error('❌ Error creating rent cycles:', error);
    throw error;
  }
}

// Function to check overdue rent
async function checkOverdueRent() {
  console.log('🔍 Checking for overdue rent...');
  
  try {
    const now = new Date();
    
    // Find pending rent cycles past grace period
    const overdueQuery = db.collection('rentCycles')
      .where('status', 'in', ['pending', 'partial'])
      .where('gracePeriodEnds', '<', now);
    
    const overdueSnapshot = await overdueQuery.get();
    
    console.log(`📊 Found ${overdueSnapshot.size} potentially overdue cycles`);
    
    let updatedCount = 0;
    let alertCount = 0;
    
    for (const cycleDoc of overdueSnapshot.docs) {
      const rentCycle = cycleDoc.data();
      const graceEnd = rentCycle.gracePeriodEnds.toDate();
      
      const daysOverdue = Math.max(0, Math.floor((now - graceEnd) / (1000 * 60 * 60 * 24)));
      
      if (daysOverdue > 0) {
        // Determine risk level
        let riskLevel = 'low';
        if (daysOverdue >= 30) riskLevel = 'critical';
        else if (daysOverdue >= 15) riskLevel = 'high';
        else if (daysOverdue >= 7) riskLevel = 'medium';
        
        // Update rent cycle
        await cycleDoc.ref.update({
          status: 'overdue',
          daysOverdue: daysOverdue,
          overdueAmount: rentCycle.amountDue - (rentCycle.paidAmount || 0),
          riskLevel: riskLevel,
          'timestamps.updatedAt': new Date()
        });
        
        updatedCount++;
        
        // Create alert
        await db.collection('alerts').add({
          type: 'rent_overdue',
          priority: riskLevel === 'critical' ? 'critical' : riskLevel === 'high' ? 'high' : 'medium',
          targetUserId: 'admin',
          targetEmail: 'admin@chakestates.com',
          title: `Rent Overdue: ${rentCycle.propertyCode}`,
          message: `Tenant ${rentCycle.tenantName} has overdue rent of KSh ${rentCycle.amountDue} (${daysOverdue} days overdue)`,
          data: {
            tenantId: rentCycle.tenantId,
            tenantName: rentCycle.tenantName,
            propertyId: rentCycle.propertyId,
            propertyCode: rentCycle.propertyCode,
            amountDue: rentCycle.amountDue,
            daysOverdue: daysOverdue,
            riskLevel: riskLevel
          },
          status: 'unread',
          actionRequired: true,
          channels: ['in_app'],
          sentAt: new Date(),
          createdAt: new Date()
        });
        
        alertCount++;
        
        // Send reminder based on days overdue
        await sendReminder(rentCycle, daysOverdue);
        
        console.log(`⚠️ Marked ${rentCycle.tenantName} as overdue (${daysOverdue} days)`);
      }
    }
    
    console.log(`✅ Updated ${updatedCount} cycles, created ${alertCount} alerts`);
    
    return { updatedCount, alertCount };
  } catch (error) {
    console.error('❌ Error checking overdue rent:', error);
    throw error;
  }
}

// Function to send reminders
async function sendReminder(rentCycle, daysOverdue) {
  try {
    let reminderType = '';
    let message = '';
    
    if (daysOverdue === 1) {
      reminderType = 'first_reminder';
      message = `Gentle reminder: Rent for ${rentCycle.propertyCode} is now overdue. Amount: KSh ${rentCycle.amountDue}`;
    } else if (daysOverdue === 7) {
      reminderType = 'second_reminder';
      message = `Second reminder: Rent for ${rentCycle.propertyCode} is ${daysOverdue} days overdue. Amount: KSh ${rentCycle.amountDue}`;
    } else if (daysOverdue === 15) {
      reminderType = 'final_notice';
      message = `FINAL NOTICE: Rent for ${rentCycle.propertyCode} is ${daysOverdue} days overdue. Legal action may follow.`;
    } else if (daysOverdue === 30) {
      reminderType = 'legal_notice';
      message = `LEGAL NOTICE: Rent for ${rentCycle.propertyCode} is ${daysOverdue} days overdue. Preparing for legal action.`;
    } else {
      return; // Skip if not a reminder day
    }
    
    // Create reminder log
    await db.collection('reminderLogs').add({
      rentCycleId: rentCycle.id,
      tenantId: rentCycle.tenantId,
      tenantName: rentCycle.tenantName,
      tenantPhone: rentCycle.tenantPhone,
      type: reminderType,
      sentVia: ['in_app'],
      message: message,
      sentBy: 'system',
      sentAt: new Date(),
      acknowledged: false,
      createdAt: new Date()
    });
    
    // Update rent cycle
    await db.collection('rentCycles').doc(rentCycle.id).update({
      lastReminderSent: new Date(),
      remindersSent: FieldValue.increment(1)
    });
    
    console.log(`📧 Sent ${reminderType} to ${rentCycle.tenantName}`);
    
  } catch (error) {
    console.error('❌ Error sending reminder:', error);
  }
}

// ==================== CRON SCHEDULES ====================

// Schedule: Create rent cycles on 1st of every month at midnight
cron.schedule('0 0 1 * *', async () => {
  console.log('⏰ Scheduled: Creating monthly rent cycles...');
  try {
    const result = await createMonthlyRentCycles();
    console.log(`✅ Scheduled task completed: Created ${result} rent cycles`);
  } catch (error) {
    console.error('❌ Scheduled task failed:', error);
  }
});

// Schedule: Check overdue rent daily at 9 AM Nairobi time
cron.schedule('0 9 * * *', async () => {
  console.log('⏰ Scheduled: Checking overdue rent...');
  try {
    const result = await checkOverdueRent();
    console.log(`✅ Scheduled task completed: Updated ${result.updatedCount} cycles`);
  } catch (error) {
    console.error('❌ Scheduled task failed:', error);
  }
});

// Schedule: Run every 5 minutes for testing (comment out in production)
cron.schedule('*/5 * * * *', async () => {
  console.log('🧪 Test schedule: Running every 5 minutes');
  // Uncomment for testing:
  // await checkOverdueRent();
});

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

// M-Pesa Callback Webhook - UPDATED TO UPDATE RENT CYCLES
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
    const paymentData = paymentDoc.data();
    
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
        amount: parseFloat(amount) || paymentData.amount,
        phoneNumber: phone || paymentData.phoneNumber,
        transactionDate: parsedDate,
        completedAt: new Date(),
        updatedAt: new Date()
      });
      
      // ✅ NEW: UPDATE THE RENT CYCLE FOR THIS PAYMENT
      try {
        await updateRentCycleForPayment({
          tenantId: paymentData.tenantId,
          month: paymentData.month,
          amount: parseFloat(amount) || paymentData.amount,
          mpesaCode: mpesaCode || 'Unknown'
        });
      } catch (cycleError) {
        console.error('❌ Failed to update rent cycle:', cycleError.message);
        // Don't fail the whole callback if rent cycle update fails
      }
      
      // Update admin stats
      await updateAdminStats(amount || paymentData.amount, 'completed');
      
      // Update tenant's last payment
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
      
      // Create M-Pesa transaction record
      try {
        await db.collection('mpesaTransactions').add({
          paymentId: paymentId,
          rentCycleId: paymentData.rentCycleId || null,
          tenantId: paymentData.tenantId,
          tenantName: paymentData.tenantName,
          amount: parseFloat(amount) || paymentData.amount,
          mpesaCode: mpesaCode,
          phoneNumber: phone || paymentData.phoneNumber,
          transactionDate: parsedDate,
          status: 'completed',
          createdAt: new Date()
        });
      } catch (e) {
        console.warn('⚠️ Could not create M-Pesa transaction record:', e.message);
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

// ==================== RENT AUTOMATION ENDPOINTS ====================

// Manual trigger: Create rent cycles
app.post('/api/rent/create-cycles', async (req, res) => {
  try {
    console.log('🔧 Manual trigger: Creating rent cycles');
    const result = await createMonthlyRentCycles();
    res.json({
      success: true,
      message: `Created ${result} rent cycles`,
      count: result
    });
  } catch (error) {
    console.error('❌ Manual trigger failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Manual trigger: Check overdue rent
app.post('/api/rent/check-overdue', async (req, res) => {
  try {
    console.log('🔧 Manual trigger: Checking overdue rent');
    const result = await checkOverdueRent();
    res.json({
      success: true,
      message: `Updated ${result.updatedCount} overdue cycles`,
      ...result
    });
  } catch (error) {
    console.error('❌ Manual trigger failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all overdue rent cycles
app.get('/api/rent/overdue', async (req, res) => {
  try {
    const overdueSnapshot = await db.collection('rentCycles')
      .where('status', '==', 'overdue')
      .orderBy('daysOverdue', 'desc')
      .limit(50)
      .get();
    
    const overdueCycles = [];
    overdueSnapshot.forEach(doc => {
      overdueCycles.push({ id: doc.id, ...doc.data() });
    });
    
    res.json({
      success: true,
      count: overdueCycles.length,
      data: overdueCycles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get rent cycle by ID
app.get('/api/rent/cycle/:cycleId', async (req, res) => {
  try {
    const { cycleId } = req.params;
    const cycleDoc = await db.collection('rentCycles').doc(cycleId).get();
    
    if (!cycleDoc.exists) {
      return res.status(404).json({ success: false, error: 'Rent cycle not found' });
    }
    
    res.json({ success: true, data: cycleDoc.data() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send reminder endpoint
app.post('/api/rent/send-reminder', async (req, res) => {
  try {
    const { tenantId, tenantName, cycleId, tenantPhone } = req.body;
    
    console.log(`📧 Sending reminder to ${tenantName} (${tenantPhone})`);
    
    // Create reminder log
    await db.collection('reminderLogs').add({
      tenantId,
      tenantName,
      cycleId,
      tenantPhone,
      type: 'manual_reminder',
      sentVia: ['in_app'],
      message: `Manual reminder sent for overdue rent`,
      sentBy: 'agent',
      sentAt: new Date(),
      acknowledged: false,
      createdAt: new Date()
    });
    
    // Update rent cycle
    await db.collection('rentCycles').doc(cycleId).update({
      lastReminderSent: new Date(),
      remindersSent: FieldValue.increment(1)
    });
    
    res.json({
      success: true,
      message: `Reminder sent to ${tenantName}`
    });
    
  } catch (error) {
    console.error('Error sending reminder:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== NEW: MARK AS CASH PAID ENDPOINT ====================
app.post('/api/rent/mark-cash-paid', async (req, res) => {
  try {
    const { cycleId, tenantName, amount } = req.body;
    
    console.log(`💵 Marking as cash paid: ${tenantName}, cycle ${cycleId}`);
    
    // Get rent cycle
    const cycleRef = db.collection('rentCycles').doc(cycleId);
    const cycleDoc = await cycleRef.get();
    
    if (!cycleDoc.exists) {
      return res.status(404).json({ success: false, error: 'Rent cycle not found' });
    }
    
    const cycleData = cycleDoc.data();
    
    // Calculate new paid amount
    const newPaidAmount = (cycleData.paidAmount || 0) + (parseFloat(amount) || cycleData.amountDue);
    const newStatus = newPaidAmount >= cycleData.amountDue ? 'paid' : 'partial';
    
    // Update rent cycle
    await cycleRef.update({
      status: newStatus,
      paidAmount: newPaidAmount,
      paidDate: new Date(),
      paymentMethod: 'cash',
      'timestamps.updatedAt': new Date(),
      ...(cycleData.status === 'overdue' && { 
        overdueAmount: Math.max(0, cycleData.amountDue - newPaidAmount),
        daysOverdue: 0 
      })
    });
    
    // Create cash payment record
    const paymentRef = db.collection('payments').doc();
    await paymentRef.set({
      id: paymentRef.id,
      rentCycleId: cycleId,
      tenantId: cycleData.tenantId,
      tenantName: cycleData.tenantName,
      amount: parseFloat(amount) || cycleData.amountDue,
      paymentMethod: 'cash',
      month: cycleData.cycleMonth,
      year: new Date().getFullYear(),
      status: 'completed',
      cashReceivedBy: 'admin',
      paidAt: new Date(),
      createdAt: new Date()
    });
    
    // Update admin stats
    await updateAdminStats(amount || cycleData.amountDue, 'completed');
    
    res.json({
      success: true,
      message: `Marked as cash paid: ${tenantName}, KSh ${amount || cycleData.amountDue}`,
      data: {
        cycleId,
        newStatus,
        paidAmount: newPaidAmount,
        totalDue: cycleData.amountDue
      }
    });
    
  } catch (error) {
    console.error('Error marking as cash paid:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'M-Pesa Payment Server with Rent Automation',
    environment: MPESA_CONFIG.environment,
    timestamp: new Date().toISOString(),
    firebase: 'Connected',
    mpesa: 'Ready',
    rentAutomation: 'Active',
    autoPaymentUpdates: 'ENABLED', // NEW: Shows payment auto-updates are working
    schedules: [
      'Monthly rent cycles: 1st of month at 00:00',
      'Overdue checks: Daily at 09:00'
    ]
  });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ MPESA LIVE SERVER RUNNING ON PORT ${PORT}`);
  console.log(`📡 Environment: ${MPESA_CONFIG.environment}`);
  console.log(`🏪 Till Number: ${MPESA_CONFIG.shortCode}`);
  console.log(`🌐 Callback URL: ${MPESA_CONFIG.callbackUrl}`);
  console.log(`⏰ Rent Automation: ACTIVE`);
  console.log(`💰 Auto-Update Rent Cycles: ENABLED`);
  console.log(`💵 Cash Payment Endpoint: /api/rent/mark-cash-paid`);
  console.log('==========================================');
});