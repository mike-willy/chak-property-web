import React, { useState, useEffect } from 'react';
import { db } from '../../pages/firebase/firebase'; // Adjust path as needed
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc } from 'firebase/firestore';
import '../../styles/overduePayments.css';

const OverduePayments = () => {
  const [overduePayments, setOverduePayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOverdue: 0,
    totalCases: 0
  });

  useEffect(() => {
    // Real-time listener for overdue rent cycles
    const q = query(
      collection(db, 'rentCycles'),
      where('status', '==', 'overdue'),
      orderBy('daysOverdue', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const payments = [];
      let totalAmount = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        payments.push({ 
          id: doc.id, 
          tenant: data.tenantName || 'Unknown Tenant',
          property: data.propertyCode || data.propertyId,
          dueDate: data.dueDate?.toDate ? data.dueDate.toDate().toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          }) : 'Unknown',
          amount: `KSh ${data.amountDue?.toLocaleString() || 0}`,
          amountValue: data.amountDue || 0,
          status: 'Overdue',
          daysOverdue: data.daysOverdue || 0,
          riskLevel: data.riskLevel || 'medium',
          tenantId: data.tenantId,
          tenantPhone: data.tenantPhone
        });
        
        totalAmount += data.amountDue || 0;
      });

      setOverduePayments(payments);
      setStats({
        totalOverdue: totalAmount,
        totalCases: payments.length
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const sendReminder = async (tenantId, tenantName, cycleId, tenantPhone) => {
    try {
      // Update rent cycle with reminder timestamp
      const cycleRef = doc(db, 'rentCycles', cycleId);
      await updateDoc(cycleRef, {
        lastReminderSent: new Date(),
        remindersSent: (overduePayments.find(p => p.id === cycleId)?.remindersSent || 0) + 1
      });

      // Call your backend to send SMS/Email reminder
      const response = await fetch('/api/rent/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tenantId, 
          tenantName, 
          cycleId,
          tenantPhone 
        })
      });
      
      if (response.ok) {
        alert(`Reminder sent to ${tenantName}`);
      } else {
        alert('Reminder queued for sending');
      }
    } catch (error) {
      console.error('Error sending reminder:', error);
      alert('Failed to send reminder');
    }
  };

  const markAsPaid = async (cycleId, tenantName) => {
    if (window.confirm(`Mark ${tenantName}'s payment as paid?`)) {
      try {
        const cycleRef = doc(db, 'rentCycles', cycleId);
        await updateDoc(cycleRef, {
          status: 'paid',
          paidDate: new Date(),
          paidAmount: overduePayments.find(p => p.id === cycleId)?.amountValue,
          'timestamps.updatedAt': new Date()
        });
        
        alert(`Payment marked as paid for ${tenantName}`);
      } catch (error) {
        console.error('Error marking as paid:', error);
        alert('Failed to update payment status');
      }
    }
  };

  const getRiskBadge = (riskLevel) => {
    const riskConfig = {
      critical: { label: 'Critical', class: 'risk-critical' },
      high: { label: 'High', class: 'risk-high' },
      medium: { label: 'Medium', class: 'risk-medium' },
      low: { label: 'Low', class: 'risk-low' }
    };
    
    const config = riskConfig[riskLevel] || { label: 'Medium', class: 'risk-medium' };
    
    return <span className={`risk-badge ${config.class}`}>{config.label}</span>;
  };

  if (loading) {
    return (
      <div className="overdue-card">
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
    <div className="overdue-card">
      <div className="overdue-header">
        <div>
          <h3>Overdue Payments</h3>
          <div className="overdue-stats">
            <span className="total-amount">KSh {stats.totalOverdue.toLocaleString()}</span>
            <span className="total-cases">{stats.totalCases} cases</span>
          </div>
        </div>
        <span className="view-all">View All</span>
      </div>

      {overduePayments.length === 0 ? (
        <div className="no-overdue">
          <div className="no-overdue-icon">🎉</div>
          <p>No overdue payments!</p>
          <p className="subtext">All rent is up-to-date</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="overdue-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Property</th>
                <th>Due Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Risk</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {overduePayments.map((item, index) => (
                <tr key={item.id || index} className={`overdue-row risk-${item.riskLevel}`}>
                  <td>
                    <div className="tenant-info">
                      <div className="tenant-name">{item.tenant}</div>
                      <div className="tenant-days">Overdue: {item.daysOverdue} days</div>
                    </div>
                  </td>
                  <td>{item.property}</td>
                  <td>{item.dueDate}</td>
                  <td className="amount">{item.amount}</td>
                  <td>
                    <span className="status overdue">{item.status}</span>
                  </td>
                  <td>
                    {getRiskBadge(item.riskLevel)}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="reminder-btn"
                        onClick={() => sendReminder(item.tenantId, item.tenant, item.id, item.tenantPhone)}
                      >
                        Remind
                      </button>
                      <button 
                        className="mark-paid-btn"
                        onClick={() => markAsPaid(item.id, item.tenant)}
                      >
                        Paid
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Automation Status */}
      <div className="automation-status">
        <div className="status-item">
          <span className="status-indicator active"></span>
          <span>Automated tracking active</span>
        </div>
        <div className="status-item">
          <span className="status-indicator active"></span>
          <span>Daily checks at 9:00 AM</span>
        </div>
      </div>
    </div>
  );
};

export default OverduePayments;