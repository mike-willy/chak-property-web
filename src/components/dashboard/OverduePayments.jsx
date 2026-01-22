import React, { useState, useEffect } from 'react';
import { db } from '../../pages/firebase/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  updateDoc, 
  doc,
  getDocs
} from 'firebase/firestore';
import '../../styles/overduePayments.css';

const OverduePayments = () => {
  const [overduePayments, setOverduePayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [propertiesMap, setPropertiesMap] = useState({});
  const [stats, setStats] = useState({
    totalOverdue: 0,
    totalCases: 0,
    totalTenants: 0,
    totalMonths: 0
  });
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    console.log('🔄 OverduePayments component mounting...');
    
    let unsubscribe = null;

    const setupListener = async () => {
      try {
        // Fetch properties for name mapping
        console.log('📋 Fetching properties...');
        const propertiesRef = collection(db, 'properties');
        const propertiesSnapshot = await getDocs(propertiesRef);
        const propertiesData = {};
        
        propertiesSnapshot.forEach((doc) => {
          const data = doc.data();
          propertiesData[doc.id] = {
            name: data.name || 'Unnamed Property',
            code: data.code || data.propertyCode || doc.id
          };
        });
        
        setPropertiesMap(propertiesData);
        console.log(`✅ Loaded ${Object.keys(propertiesData).length} properties`);

        // Create query for overdue payments
        const q = query(
          collection(db, 'rentCycles'),
          where('status', '==', 'overdue'),
          orderBy('dueDate', 'asc')
        );

        console.log('🔍 Setting up Firestore listener...');
        
        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            console.log('📊 Firestore snapshot received:', snapshot.size, 'overdue documents');
            
            // Group payments by tenant
            const tenantMap = new Map();
            let totalMonths = 0;

            snapshot.forEach((doc) => {
              const data = doc.data();
              const tenantId = data.tenantId || data.tenantName || 'unknown';
              
              if (!tenantMap.has(tenantId)) {
                // Initialize tenant entry
                tenantMap.set(tenantId, {
                  id: tenantId,
                  tenantName: data.tenantName || 'Unknown Tenant',
                  propertyId: data.propertyId,
                  propertyCode: data.propertyCode || 'Unknown',
                  cycles: [],
                  totalAmount: 0,
                  monthsOverdue: 0,
                  oldestDueDate: null,
                  maxDaysOverdue: 0,
                  tenantPhone: data.tenantPhone || '',
                  tenantEmail: data.tenantEmail || '',
                  riskLevel: 'medium'
                });
              }
              
              const tenant = tenantMap.get(tenantId);
              
              // Add this rent cycle
              const cycleData = {
                cycleId: doc.id,
                dueDate: data.dueDate,
                dueDateFormatted: data.dueDate?.toDate 
                  ? data.dueDate.toDate().toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })
                  : 'Unknown',
                amountDue: data.amountDue || 0,
                daysOverdue: data.daysOverdue || 0,
                originalData: data
              };
              
              tenant.cycles.push(cycleData);
              
              // Update totals
              tenant.totalAmount += cycleData.amountDue;
              tenant.monthsOverdue++;
              totalMonths++;
              
              // Track oldest due date
              const dueDate = data.dueDate?.toDate ? data.dueDate.toDate() : new Date();
              if (!tenant.oldestDueDate || dueDate < tenant.oldestDueDate) {
                tenant.oldestDueDate = dueDate;
              }
              
              // Track maximum days overdue
              if (cycleData.daysOverdue > tenant.maxDaysOverdue) {
                tenant.maxDaysOverdue = cycleData.daysOverdue;
              }
            });

            // Calculate risk levels and format for display
            const payments = Array.from(tenantMap.values()).map(tenant => {
              // Calculate risk based on months overdue
              let riskLevel = 'medium';
              if (tenant.monthsOverdue >= 3) riskLevel = 'critical';
              else if (tenant.monthsOverdue === 2) riskLevel = 'high';
              
              // Get property display name
              const propertyInfo = propertiesData[tenant.propertyId] || {
                name: 'Unknown Property',
                code: tenant.propertyCode
              };
              
              // Sort cycles by due date (oldest first)
              tenant.cycles.sort((a, b) => {
                const dateA = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(0);
                const dateB = b.dueDate?.toDate ? b.dueDate.toDate() : new Date(0);
                return dateA - dateB;
              });

              return {
                id: tenant.id,
                tenant: tenant.tenantName,
                propertyId: tenant.propertyId,
                propertyName: propertyInfo.name,
                propertyCode: propertyInfo.code,
                dueDate: tenant.oldestDueDate 
                  ? tenant.oldestDueDate.toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })
                  : 'Unknown',
                amount: `KSh ${tenant.totalAmount.toLocaleString()}`,
                amountValue: tenant.totalAmount,
                monthsOverdue: tenant.monthsOverdue,
                daysOverdue: tenant.maxDaysOverdue,
                status: 'Overdue',
                riskLevel: riskLevel,
                tenantId: tenant.id,
                tenantPhone: tenant.tenantPhone,
                tenantEmail: tenant.tenantEmail,
                cycles: tenant.cycles
              };
            });

            // Sort by total amount (highest first)
            payments.sort((a, b) => b.amountValue - a.amountValue);

            // Calculate statistics
            const totalAmount = payments.reduce((sum, p) => sum + p.amountValue, 0);
            
            console.log(`✅ Processed ${payments.length} tenants with ${totalMonths} overdue months`);
            
            setOverduePayments(payments);
            setStats({
              totalOverdue: totalAmount,
              totalCases: payments.length,
              totalTenants: payments.length,
              totalMonths: totalMonths
            });
            setLoading(false);
            setError(null);
          },
          (error) => {
            console.error('❌ Firestore listener error:', error);
            setError(`Database error: ${error.message}`);
            setLoading(false);
          }
        );

      } catch (err) {
        console.error('❌ Error setting up Firestore listener:', err);
        setError(`Setup failed: ${err.message}. Check Firebase configuration.`);
        setLoading(false);
      }
    };

    setupListener();

    return () => {
      console.log('🧹 Cleaning up Firestore listener...');
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const sendReminder = async (tenantId, tenantName, cycles, tenantPhone, tenantEmail) => {
    try {
      console.log(`📧 Sending reminder to ${tenantName} for ${cycles.length} overdue months...`);
      
      // Update all cycles with reminder timestamp
      const updatePromises = cycles.map(cycle => 
        updateDoc(doc(db, 'rentCycles', cycle.cycleId), {
          lastReminderSent: new Date(),
          remindersSent: (cycle.originalData?.remindersSent || 0) + 1
        })
      );
      
      await Promise.all(updatePromises);

      // Call backend to send SMS/Email reminder
      const response = await fetch('http://localhost:5000/api/rent/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tenantId, 
          tenantName, 
          totalAmount: cycles.reduce((sum, c) => sum + c.amountDue, 0),
          monthsOverdue: cycles.length,
          tenantPhone,
          tenantEmail
        })
      });
      
      if (response.ok) {
        alert(`Reminder sent to ${tenantName} for ${cycles.length} overdue month(s)`);
      } else {
        alert('Reminder queued for sending');
      }
    } catch (error) {
      console.error('Error sending reminder:', error);
      alert('Failed to send reminder. Check console for details.');
    }
  };

  const markAsCashPaid = async (tenantId, tenantName, cycles) => {
    const totalAmount = cycles.reduce((sum, c) => sum + c.amountDue, 0);
    
    if (window.confirm(`Mark ALL ${cycles.length} months as CASH PAID for ${tenantName}?\nTotal: KSh ${totalAmount.toLocaleString()}`)) {
      try {
        // Use the new cash payment endpoint
        const response = await fetch('http://localhost:5000/api/rent/mark-cash-paid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            cycleId: cycles[0].cycleId, // Using first cycle ID
            tenantName,
            amount: totalAmount
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          alert(result.message || `✅ ${cycles.length} months marked as cash paid for ${tenantName}`);
        } else {
          alert('Failed to mark as cash paid. Check console for details.');
        }
      } catch (error) {
        console.error('Error marking as cash paid:', error);
        alert('Failed to update payment status. Check console for details.');
      }
    }
  };

  const getRiskBadge = (riskLevel) => {
    const riskConfig = {
      critical: { label: 'Critical', class: 'risk-critical', icon: '🔥' },
      high: { label: 'High', class: 'risk-high', icon: '⚠️' },
      medium: { label: 'Medium', class: 'risk-medium', icon: '🔶' },
      low: { label: 'Low', class: 'risk-low', icon: 'ℹ️' }
    };
    
    const config = riskConfig[riskLevel] || riskConfig.medium;
    
    return (
      <span className={`risk-badge ${config.class}`}>
        <span className="risk-icon">{config.icon}</span>
        {config.label}
      </span>
    );
  };

  // Get displayed payments (limited or all)
  const displayedPayments = showAll ? overduePayments : overduePayments.slice(0, 5);

  // Show error state
  if (error) {
    return (
      <div className="overdue-card">
        <div className="overdue-header">
          <h3>Overdue Payments</h3>
          <span className="view-all">View All</span>
        </div>
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <p>Error Loading Data</p>
          <p className="error-details">{error}</p>
          <button 
            className="retry-btn"
            onClick={() => window.location.reload()}
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="overdue-payments-card">
        <div className="overdue-header">
          <h3>Overdue Payments</h3>
          <span className="view-all">View All</span>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading overdue payments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overdue-payments-card">
      <div className="overdue-header">
        <div>
          <h3>Overdue Payments</h3>
          <div className="overdue-stats">
            <span className="total-amount">KSh {stats.totalOverdue.toLocaleString()}</span>
            <div className="stats-details">
              <span className="stat-item">{stats.totalTenants} tenants</span>
              <span className="stat-divider">•</span>
              <span className="stat-item">{stats.totalMonths} months</span>
              <span className="stat-divider">•</span>
              <span className="stat-item">{stats.totalCases} cases</span>
            </div>
          </div>
        </div>
        <span 
          className="view-all" 
          onClick={() => setShowAll(!showAll)}
          style={{ cursor: 'pointer' }}
        >
          {showAll ? 'Show Less' : 'View All'}
        </span>
      </div>

      {overduePayments.length === 0 ? (
        <div className="no-overdue">
          <div className="no-overdue-icon">🎉</div>
          <p>No overdue payments!</p>
          <p className="subtext">All rent is up-to-date</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="overdue-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Property</th>
                  <th>First Due</th>
                  <th>Amount</th>
                  <th>Mos</th>
                  <th>Risk</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {displayedPayments.map((item) => (
                  <tr key={item.id} className={`overdue-row risk-${item.riskLevel}`}>
                    <td data-label="Tenant">
                      <div className="tenant-info">
                        <div className="tenant-name">{item.tenant}</div>
                        <div className="tenant-days">{item.daysOverdue} days overdue</div>
                      </div>
                    </td>
                    <td data-label="Property" className="property-cell">
                      <div className="property-display">
                        <div className="property-name">{item.propertyName}</div>
                        {/* TRUNCATED PROPERTY CODE */}
                        <div className="property-code" title={item.propertyCode}>
                          {item.propertyCode.length > 8 
                            ? `${item.propertyCode.substring(0, 8)}...` 
                            : item.propertyCode}
                        </div>
                      </div>
                    </td>
                    <td data-label="First Due">{item.dueDate}</td>
                    <td data-label="Amount" className="amount total-amount">
                      <div className="amount-main">{item.amount}</div>
                      <div className="amount-breakdown">
                        ({item.monthsOverdue} × KSh {Math.round(item.amountValue / item.monthsOverdue).toLocaleString()})
                      </div>
                    </td>
                    <td data-label="Mos" className="months-cell">
                      <span className="months-badge">{item.monthsOverdue}</span>
                    </td>
                    <td data-label="Risk">
                      {getRiskBadge(item.riskLevel)}
                    </td>
                    <td data-label="Actions">
                      <div className="action-buttons">
                        <button 
                          className="reminder-btn"
                          onClick={() => sendReminder(item.tenantId, item.tenant, item.cycles, item.tenantPhone, item.tenantEmail)}
                        >
                          Remind
                        </button>
                        <button 
                          className="cash-btn"
                          onClick={() => markAsCashPaid(item.tenantId, item.tenant, item.cycles)}
                        >
                          Cash Paid
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ... (Footer section remains the same) */}
          <div className="summary-footer">
            <div className="automation-status">
              <span className="status-indicator active"></span>
              <span>M-Pesa auto-pay • Cash manual • {displayedPayments.length} shown</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OverduePayments;