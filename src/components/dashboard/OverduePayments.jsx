import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../pages/firebase/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  updateDoc, 
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import '../../styles/overduePayments.css';

const OverduePayments = () => {
  const [overduePayments, setOverduePayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoUpdateCount, setAutoUpdateCount] = useState(0);
  const [lastChecked, setLastChecked] = useState(null);
  const [propertiesMap, setPropertiesMap] = useState({});
  const [tenantsMap, setTenantsMap] = useState({});
  const [tenantNameCache, setTenantNameCache] = useState({});
  
  // Configuration
  const GRACE_PERIOD = 5; 
  const CHECK_INTERVAL = 30000; 

  // Fetch tenant name from tenants collection - SAME AS PAYMENT PAGE
  const fetchTenantName = async (tenantId) => {
    if (!tenantId || tenantNameCache[tenantId]) return tenantNameCache[tenantId];
    
    try {
      const tenantRef = doc(db, 'tenants', tenantId);
      const tenantSnap = await getDoc(tenantRef);
      
      let tenantName = 'Unknown Tenant';
      
      if (tenantSnap.exists()) {
        const data = tenantSnap.data();
        tenantName = data.fullName || data.name || 'Unknown Tenant';
      } else {
        // Try alternative lookup
        const tenantsRef = collection(db, 'tenants');
        const q = query(tenantsRef, where('tenantId', '==', tenantId));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const tenantData = querySnapshot.docs[0].data();
          tenantName = tenantData.fullName || tenantData.name || 'Unknown Tenant';
        }
      }
      
      setTenantNameCache(prev => ({
        ...prev,
        [tenantId]: tenantName
      }));
      
      return tenantName;
    } catch (error) {
      console.error(`Error fetching tenant ${tenantId}:`, error);
      return 'Unknown Tenant';
    }
  };

  // Load tenants and properties
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load properties
        const propertiesSnapshot = await getDocs(collection(db, 'properties'));
        const propertiesData = {};
        propertiesSnapshot.forEach((doc) => {
          propertiesData[doc.id] = {
            name: doc.data().name || 'Unnamed Property',
            code: doc.data().code || doc.data().propertyCode || 'N/A'
          };
        });
        setPropertiesMap(propertiesData);

        // Load initial tenants map
        const tenantsSnapshot = await getDocs(collection(db, 'tenants'));
        const tenantsData = {};
        
        tenantsSnapshot.forEach((doc) => {
          const tenantData = doc.data();
          tenantsData[doc.id] = {
            id: doc.id,
            name: tenantData.fullName || tenantData.name || 'Unknown Tenant',
            fullName: tenantData.fullName || tenantData.name || 'Unknown Tenant',
            phone: tenantData.phone || '',
            email: tenantData.email || '',
            propertyId: tenantData.propertyId
          };
        });
        
        setTenantsMap(tenantsData);
        setLoading(false);

      } catch (error) {
        console.error('Error loading data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Calculate if payment is overdue
  const calculatePaymentStatus = useCallback((payment) => {
    const today = new Date();
    let dueDate;
    
    if (payment.dueDate && payment.dueDate.toDate) {
      dueDate = payment.dueDate.toDate();
    } else if (payment.dueDate) {
      dueDate = new Date(payment.dueDate);
    } else {
      dueDate = new Date();
    }
    
    const daysOverdue = Math.max(0, Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)));
    
    if (payment.paymentStatus === 'paid') return { status: 'paid', daysOverdue: 0 };
    if (daysOverdue <= 0) return { status: 'pending', daysOverdue: 0 };
    if (daysOverdue <= GRACE_PERIOD) return { status: 'due', daysOverdue };
    return { status: 'overdue', daysOverdue };
  }, [GRACE_PERIOD]);

  // Auto-update payment statuses in Firestore
  const updateOverdueStatuses = useCallback(async (payments) => {
    try {
      const batch = writeBatch(db);
      let updates = 0;
      
      payments.forEach(payment => {
        const { status, daysOverdue } = calculatePaymentStatus(payment);
        
        if (payment.status !== status || payment.daysOverdue !== daysOverdue) {
          const paymentRef = doc(db, 'rentCycles', payment.id);
          
          const updateData = {
            status: status,
            daysOverdue: daysOverdue,
            updatedAt: serverTimestamp(),
            lastAutoCheck: serverTimestamp()
          };
          
          if (status === 'overdue' && payment.status !== 'overdue') {
            updateData.overdueAmount = payment.amountDue - (payment.paidAmount || 0);
            updateData.overdueSince = serverTimestamp();
          }
          
          batch.update(paymentRef, updateData);
          updates++;
        }
      });
      
      if (updates > 0) {
        await batch.commit();
        console.log(`🤖 AUTO-UPDATED ${updates} payment statuses`);
        setAutoUpdateCount(prev => prev + updates);
        setLastChecked(new Date());
      }
      
      return updates;
    } catch (error) {
      console.error('Auto-update error:', error);
      return 0;
    }
  }, [calculatePaymentStatus]);

  // Main automation effect
  useEffect(() => {
    console.log('🚀 Starting automated arrears tracking...');
    
    let unsubscribe = null;
    let checkInterval = null;
    
    const startAutomation = async () => {
      try {
        const q = query(
          collection(db, 'rentCycles'),
          where('paymentStatus', '!=', 'paid'),
          orderBy('dueDate', 'asc')
        );
        
        unsubscribe = onSnapshot(q, async (snapshot) => {
          console.log('📊 Firestore snapshot received, size:', snapshot.size);
          
          const allPayments = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            allPayments.push({ id: doc.id, ...data });
          });
          
          console.log(`📊 Tracking ${allPayments.length} unpaid payments`);
          
          const updates = await updateOverdueStatuses(allPayments);
          const grouped = await groupPaymentsByTenant(allPayments);
          
          setOverduePayments(grouped);
          setLoading(false);
          
        }, (error) => {
          console.error('Firestore listener error:', error);
          setLoading(false);
        });
        
        checkInterval = setInterval(() => {
          setLastChecked(new Date());
        }, CHECK_INTERVAL);
        
      } catch (error) {
        console.error('Automation setup error:', error);
        setLoading(false);
      }
    };
    
    startAutomation();
    
    return () => {
      if (unsubscribe) unsubscribe();
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [updateOverdueStatuses]);

  // Group payments by tenant - FIXED TO FETCH NAMES LIKE PAYMENT PAGE
  const groupPaymentsByTenant = async (payments) => {
    console.log('🔍 Starting groupPaymentsByTenant');
    
    const tenantMap = new Map();
    
    for (const payment of payments) {
      const tenantId = payment.tenantId || '';
      
      if (!tenantId) {
        console.log('⚠️ Payment has no tenantId:', payment.id);
        continue;
      }
      
      // Get tenant name from cache or fetch it
      let tenantName = tenantNameCache[tenantId];
      
      if (!tenantName) {
        tenantName = await fetchTenantName(tenantId);
      }
      
      // Get property info
      const propertyId = payment.propertyId || '';
      const propertyInfo = propertiesMap[propertyId] || {
        name: payment.propertyName || 'Unknown Property',
        code: payment.propertyCode || 'N/A'
      };
      
      if (!tenantMap.has(tenantId)) {
        tenantMap.set(tenantId, {
          tenantId,
          tenantName: tenantName,
          tenantPhone: payment.tenantPhone || '',
          tenantEmail: payment.tenantEmail || '',
          propertyId: propertyId,
          propertyName: propertyInfo.name,
          propertyCode: propertyInfo.code,
          cycles: [],
          totalAmount: 0,
          monthsOverdue: 0,
          maxDaysOverdue: 0,
          oldestDueDate: null,
          riskLevel: 'low'
        });
      }
      
      const tenant = tenantMap.get(tenantId);
      tenant.cycles.push(payment);
      tenant.totalAmount += payment.amountDue || 0;
      tenant.monthsOverdue++;
      
      const daysOverdue = payment.daysOverdue || 0;
      tenant.maxDaysOverdue = Math.max(tenant.maxDaysOverdue, daysOverdue);
      
      const dueDate = payment.dueDate?.toDate ? payment.dueDate.toDate() : new Date();
      if (!tenant.oldestDueDate || dueDate < tenant.oldestDueDate) {
        tenant.oldestDueDate = dueDate;
      }
    }
    
    // Calculate risk level
    const result = Array.from(tenantMap.values()).map(tenant => {
      if (tenant.maxDaysOverdue >= 30) tenant.riskLevel = 'critical';
      else if (tenant.maxDaysOverdue >= 15) tenant.riskLevel = 'high';
      else if (tenant.maxDaysOverdue > GRACE_PERIOD) tenant.riskLevel = 'medium';
      else tenant.riskLevel = 'low';
      return tenant;
    });
    
    return result.sort((a, b) => b.maxDaysOverdue - a.maxDaysOverdue);
  };

  // Send reminder to tenant
  const sendReminder = async (tenant) => {
    try {
      const updatePromises = tenant.cycles.map(cycle => 
        updateDoc(doc(db, 'rentCycles', cycle.id), {
          lastReminderSent: serverTimestamp(),
          remindersSent: (cycle.remindersSent || 0) + 1
        })
      );
      
      await Promise.all(updatePromises);
      alert(`Reminder sent to ${tenant.tenantName} for ${tenant.monthsOverdue} overdue month(s)`);
    } catch (error) {
      console.error('Error sending reminder:', error);
      alert('Failed to send reminder');
    }
  };

  // Mark as paid
  const markAsPaid = async (tenant) => {
    if (window.confirm(`Mark ${tenant.monthsOverdue} months as PAID for ${tenant.tenantName}?\nTotal: KSh ${tenant.totalAmount.toLocaleString()}`)) {
      try {
        const updatePromises = tenant.cycles.map(cycle =>
          updateDoc(doc(db, 'rentCycles', cycle.id), {
            paymentStatus: 'paid',
            paidAmount: cycle.amountDue,
            paidDate: serverTimestamp(),
            status: 'paid',
            updatedAt: serverTimestamp()
          })
        );
        
        await Promise.all(updatePromises);
        alert(`✅ ${tenant.monthsOverdue} months marked as paid for ${tenant.tenantName}`);
      } catch (error) {
        console.error('Error marking as paid:', error);
        alert('Failed to update payment status');
      }
    }
  };

  // Render
  return (
    <div className="overdue-payments-card">
      {/* Automation Status Header */}
      <div className="overdue-header">
        <div>
          <h3>Automated Rent Arrears Tracking</h3>
          <div className="overdue-stats">
            <span className="total-amount">
              KSh {overduePayments.reduce((sum, t) => sum + t.totalAmount, 0).toLocaleString()}
            </span>
            <div className="stats-details">
              <span className="stat-item">{overduePayments.length} tenants</span>
              <span className="stat-divider">•</span>
              <span className="stat-item">{overduePayments.reduce((sum, t) => sum + t.monthsOverdue, 0)} months</span>
              <span className="stat-divider">•</span>
              <span className="stat-item">{autoUpdateCount} auto-updates</span>
            </div>
          </div>
        </div>
        <div className="auto-status">
          <span className="status-indicator active"></span>
          <span>Auto-tracking active</span>
        </div>
      </div>
      
      {/* Last checked time */}
      {lastChecked && (
        <div className="last-checked">
          System check: {lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
      
      {/* Loading State */}
      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading tenants and tracking payments...</p>
        </div>
      ) : overduePayments.length === 0 ? (
        <div className="no-overdue">
          <div className="success-icon">✅</div>
          <p>All rent payments are up-to-date!</p>
          <p className="subtext">System will automatically detect any overdue payments</p>
        </div>
      ) : (
        <>
          {/* Payments Table */}
          <div className="table-container">
            <table className="overdue-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Property</th>
                  <th>Amount</th>
                  <th>Months</th>
                  <th>Days Late</th>
                  <th>Risk</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {overduePayments.map(tenant => (
                  <tr key={tenant.tenantId} className={`overdue-row risk-${tenant.riskLevel}`}>
                    <td>
                      <span className="tenant-name">{tenant.tenantName}</span>
                      {tenant.tenantPhone && (
                        <span className="tenant-contact">{tenant.tenantPhone}</span>
                      )}
                    </td>
                    <td>
                      <span className="property-name">{tenant.propertyName}</span>
                      <span className="property-code">{tenant.propertyCode}</span>
                    </td>
                    <td className="amount">
                      <span className="amount-main">KSh {tenant.totalAmount.toLocaleString()}</span>
                      <span className="per-month">
                        ~KSh {Math.round(tenant.totalAmount / tenant.monthsOverdue).toLocaleString()}/month
                      </span>
                    </td>
                    <td>
                      <span className="months-badge">{tenant.monthsOverdue}</span>
                    </td>
                    <td>
                      <span className={`days-badge ${tenant.riskLevel}`}>
                        {tenant.maxDaysOverdue} days
                      </span>
                    </td>
                    <td>
                      <span className={`risk-badge ${tenant.riskLevel}`}>
                        {tenant.riskLevel.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ minWidth: '150px' }}>
                      <div className="action-buttons">
                        <button 
                          className="reminder-btn"
                          onClick={() => sendReminder(tenant)}
                        >
                          Remind
                        </button>
                        <button 
                          className="pay-btn"
                          onClick={() => markAsPaid(tenant)}
                        >
                          Mark Paid
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="automation-footer">
            <span className="auto-status-indicator">
              <span className="pulse-dot"></span>
              LIVE • Auto-checks every {CHECK_INTERVAL/1000} seconds • Grace period: {GRACE_PERIOD} days
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default OverduePayments;