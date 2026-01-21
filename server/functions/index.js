// ==================== VERSION 5 IMPORTS ====================
const { onRequest } = require("firebase-functions/v2/https");
const { onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const admin = require('firebase-admin');
const moment = require('moment');

// Initialize Firebase
admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ====================
// SIMPLE TEST FUNCTION
// ====================
exports.helloWorld = onRequest((request, response) => {
  logger.info("Hello World function called");
  response.send("Hello from CHAK Estates Cloud Functions v5!");
});

// ====================
// MANUAL: Create Test Rent Cycle
// ====================
exports.createTestRentCycle = onCall(async (request) => {
  try {
    // Create a test rent cycle
    const testCycle = {
      id: 'test_' + Date.now(),
      tenantId: 'test_tenant',
      tenantName: 'Test Tenant',
      propertyId: 'test_property',
      propertyCode: 'PLOT 47',
      cycleMonth: '2024-01',
      amountDue: 6500,
      dueDate: new Date('2024-01-01'),
      gracePeriodEnds: new Date('2024-01-04'),
      status: 'overdue',
      daysOverdue: 5,
      overdueAmount: 6500,
      riskLevel: 'medium',
      timestamps: {
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }
    };
    
    await db.collection('rentCycles').doc(testCycle.id).set(testCycle);
    
    logger.info('Test rent cycle created', { cycleId: testCycle.id });
    
    return {
      success: true,
      message: 'Test rent cycle created',
      cycleId: testCycle.id
    };
  } catch (error) {
    logger.error('Error creating test cycle:', error);
    throw new Error(error.message);
  }
});

// ====================
// DAILY: Check Overdue Rent
// ====================
exports.dailyOverdueCheck = onSchedule("every 5 minutes", async () => {
  logger.info('Checking for overdue rent...');
  
  try {
    const now = new Date();
    
    // Find pending rent cycles past due date
    const rentCyclesRef = db.collection('rentCycles');
    const snapshot = await rentCyclesRef
      .where('status', '==', 'pending')
      .where('dueDate', '<', now)
      .get();
    
    logger.info(`Found ${snapshot.size} overdue cycles`);
    
    // Mark them as overdue
    const batch = db.batch();
    snapshot.forEach(doc => {
      const data = doc.data();
      const dueDate = data.dueDate.toDate();
      const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
      
      batch.update(doc.ref, {
        status: 'overdue',
        daysOverdue: daysOverdue,
        updatedAt: FieldValue.serverTimestamp()
      });
    });
    
    await batch.commit();
    logger.info(`Marked ${snapshot.size} cycles as overdue`);
    
    return null;
  } catch (error) {
    logger.error('Error in daily check:', error);
    return null;
  }
});

// ====================
// CREATE MONTHLY RENT CYCLES (v5 version)
// ====================
exports.createMonthlyRentCycles = onSchedule("0 0 1 * *", async () => {
  logger.info('Creating monthly rent cycles...');
  
  try {
    const now = new Date();
    const currentMonth = moment(now).format('YYYY-MM');
    const nextMonth = moment(now).add(1, 'month').format('YYYY-MM');
    
    // Find all active tenants
    const tenantsSnapshot = await db.collection('tenants')
      .where('status', '==', 'active')
      .get();
    
    logger.info(`Found ${tenantsSnapshot.size} active tenants`);
    
    const batch = db.batch();
    let createdCount = 0;
    
    // Create rent cycle for each tenant
    for (const tenantDoc of tenantsSnapshot.docs) {
      const tenant = tenantDoc.data();
      
      // Skip if no property assigned
      if (!tenant.propertyId) continue;
      
      // Create rent cycle ID
      const rentCycleId = `${tenantDoc.id}_${nextMonth}`;
      const rentCycleRef = db.collection('rentCycles').doc(rentCycleId);
      
      // Calculate dates
      const dueDate = new Date(moment(nextMonth + '-01').toDate());
      const gracePeriodEnds = new Date(dueDate.getTime() + (3 * 24 * 60 * 60 * 1000)); // +3 days
      
      // Rent cycle data
      const rentCycleData = {
        id: rentCycleId,
        tenantId: tenantDoc.id,
        tenantName: tenant.fullName || 'Unknown',
        tenantPhone: tenant.phone || '',
        tenantEmail: tenant.email || '',
        
        propertyId: tenant.propertyId,
        propertyCode: `PROP-${tenant.propertyId.substring(0, 8)}`,
        propertyAddress: 'Address not set',
        
        cycleMonth: nextMonth,
        amountDue: tenant.monthlyRent || 0,
        dueDate: dueDate,
        gracePeriodEnds: gracePeriodEnds,
        
        status: 'pending',
        paidAmount: 0,
        paidDate: null,
        paymentMethod: null,
        transactionCode: null,
        
        daysOverdue: 0,
        overdueAmount: 0,
        lastReminderSent: null,
        remindersSent: 0,
        
        riskLevel: 'low',
        notes: `Monthly rent for ${nextMonth}`,
        
        timestamps: {
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        }
      };
      
      batch.set(rentCycleRef, rentCycleData);
      createdCount++;
      
      // Commit every 500 operations
      if (createdCount % 500 === 0) {
        await batch.commit();
        logger.info(`Committed ${createdCount} cycles...`);
      }
    }
    
    // Commit remaining operations
    if (createdCount % 500 !== 0) {
      await batch.commit();
    }
    
    logger.info(`Successfully created ${createdCount} rent cycles for ${nextMonth}`);
    
    return {
      success: true,
      createdCount: createdCount,
      month: nextMonth
    };
  } catch (error) {
    logger.error('Error creating monthly rent cycles:', error);
    throw error;
  }
});

// ====================
// CHECK OVERDUE WITH ALERTS (v5 version)
// ====================
exports.checkOverdueWithAlerts = onSchedule("0 9 * * *", async () => {
  logger.info('Running overdue rent check with alerts...');
  
  try {
    const now = new Date();
    
    // Find overdue cycles
    const overdueQuery = db.collection('rentCycles')
      .where('status', 'in', ['pending', 'partial'])
      .where('gracePeriodEnds', '<', now);
    
    const overdueSnapshot = await overdueQuery.get();
    
    logger.info(`Found ${overdueSnapshot.size} potentially overdue cycles`);
    
    let updatedCount = 0;
    
    for (const cycleDoc of overdueSnapshot.docs) {
      const rentCycle = cycleDoc.data();
      const graceEnd = rentCycle.gracePeriodEnds.toDate();
      
      // Calculate days overdue
      const daysOverdue = Math.max(0, Math.floor((now - graceEnd) / (1000 * 60 * 60 * 24)));
      
      if (daysOverdue > 0) {
        // Update rent cycle
        await cycleDoc.ref.update({
          status: 'overdue',
          daysOverdue: daysOverdue,
          overdueAmount: rentCycle.amountDue - (rentCycle.paidAmount || 0),
          'timestamps.updatedAt': FieldValue.serverTimestamp()
        });
        
        updatedCount++;
        
        // Create alert
        await db.collection('alerts').add({
          type: 'rent_overdue',
          priority: daysOverdue >= 30 ? 'high' : daysOverdue >= 15 ? 'medium' : 'low',
          targetUserId: 'admin',
          title: `Rent Overdue: ${daysOverdue} days`,
          message: `Tenant ${rentCycle.tenantName} has overdue rent for ${rentCycle.propertyCode}`,
          data: {
            tenantId: rentCycle.tenantId,
            propertyId: rentCycle.propertyId,
            amountDue: rentCycle.amountDue,
            daysOverdue: daysOverdue
          },
          status: 'unread',
          createdAt: FieldValue.serverTimestamp()
        });
        
        logger.info(`Created alert for ${rentCycle.tenantName}, ${daysOverdue} days overdue`);
      }
    }
    
    logger.info(`Updated ${updatedCount} cycles to overdue status`);
    
    return {
      success: true,
      updatedCount: updatedCount
    };
  } catch (error) {
    logger.error('Error checking overdue rent:', error);
    throw error;
  }
});

// ====================
// MANUAL TRIGGER FOR TESTING
// ====================
exports.manualTrigger = onRequest(async (request, response) => {
  try {
    // Run the overdue check manually
    const result = await exports.checkOverdueWithAlerts();
    
    response.json({
      success: true,
      message: 'Manual trigger executed',
      result: result
    });
  } catch (error) {
    logger.error('Manual trigger failed:', error);
    response.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = exports;