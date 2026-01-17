// src/pages/ApprovedTenants.jsx - UPDATED
import React, { useState, useEffect } from "react";
import { db } from "../pages/firebase/firebase";
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy,
  updateDoc,
  doc,
  Timestamp
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { 
  FaUser, 
  FaHome, 
  FaPhone, 
  FaEnvelope, 
  FaDollarSign, 
  FaCalendar,
  FaCheckCircle,
  FaTimes,
  FaSearch,
  FaFilter,
  FaMoneyBillWave,
  FaClock,
  FaArrowRight,
  FaClipboardCheck,
  FaExclamationTriangle
} from "react-icons/fa";
import "../styles/approvedTenants.css";

const ApprovedTenants = () => {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [processingId, setProcessingId] = useState(null);
  const [paymentDate, setPaymentDate] = useState("");
  const [error, setError] = useState(null);

  // Fetch approved tenants pending payment
  useEffect(() => {
    fetchApprovedTenants();
    // Set default payment date to today
    const today = new Date().toISOString().split('T')[0];
    setPaymentDate(today);
  }, []);

  const fetchApprovedTenants = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const q = query(
        collection(db, "tenants"),
        where("status", "==", "approved_pending_payment"),
        orderBy("createdAt", "desc")
      );
      
      const snapshot = await getDocs(q);
      const tenantList = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        tenantList.push({
          id: doc.id,
          ...data,
          leaseStart: data.leaseStart?.toDate(),
          leaseEnd: data.leaseEnd?.toDate(),
          createdAt: data.createdAt?.toDate(),
          approvedAt: data.approvedAt?.toDate() || data.createdAt?.toDate(),
          initialPaymentDate: data.initialPaymentDate?.toDate(),
        });
      });
      
      setTenants(tenantList);
      
    } catch (error) {
      console.error("Error fetching approved tenants:", error);
      setError(`Failed to load approved tenants: ${error.message}`);
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter tenants
  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = 
      tenant.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.phone?.includes(searchTerm) ||
      tenant.propertyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.unitNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  // Mark tenant as paid (move to active)
  const handleMarkAsPaid = async (tenantId, tenantName) => {
    if (!paymentDate) {
      alert("Please select a payment date");
      return;
    }

    if (!window.confirm(`Mark ${tenantName} as paid? This will move them to active tenant collection.`)) {
      return;
    }

    try {
      setProcessingId(tenantId);
      
      const tenantRef = doc(db, "tenants", tenantId);
      const paymentTimestamp = Timestamp.fromDate(new Date(paymentDate));
      
      await updateDoc(tenantRef, {
        status: "active",
        paymentStatus: "paid",
        initialPaymentDate: paymentTimestamp,
        moveInDate: paymentTimestamp,
        updatedAt: Timestamp.now(),
        balance: 0
      });

      alert(`${tenantName} marked as paid and moved to active tenants!`);
      
      // Refresh the list
      await fetchApprovedTenants();
      
    } catch (error) {
      console.error("Error marking tenant as paid:", error);
      alert(`Failed to mark tenant as paid: ${error.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // Send payment reminder (simulated)
  const handleSendReminder = (tenant) => {
    const message = `Dear ${tenant.fullName},\n\nYour move-in payment of KSh ${tenant.totalMoveInCost?.toLocaleString()} is due. Please complete payment to secure your unit at ${tenant.propertyName}, ${tenant.unitNumber}.\n\nPayment Instructions:\n1. M-Pesa Paybill: 123456\n2. Account: ${tenant.id}\n\nThank you!`;
    
    alert(`Payment reminder would be sent to ${tenant.phone}:\n\n${message}`);
    
    console.log("Payment reminder sent:", {
      tenant: tenant.fullName,
      phone: tenant.phone,
      amount: tenant.totalMoveInCost
    });
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return "N/A";
    if (date.toDate) {
      date = date.toDate();
    }
    if (date instanceof Date) {
      return date.toLocaleDateString('en-GB');
    }
    return "Invalid date";
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  // Calculate days since approval
  const getDaysSinceApproval = (approvedDate) => {
    if (!approvedDate) return 0;
    const approved = approvedDate instanceof Date ? approvedDate : approvedDate.toDate();
    const today = new Date();
    const diffTime = Math.abs(today - approved);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="approved-container">
        <div className="approved-loading">
          <div className="approved-spinner"></div>
          <p>Loading approved tenants...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="approved-container">
        <div className="approved-error">
          <FaExclamationTriangle className="approved-error-icon" />
          <h3>Error Loading Data</h3>
          <p>{error}</p>
          <button 
            className="approved-retry-btn"
            onClick={fetchApprovedTenants}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="approved-container">
      {/* Header */}
      <div className="approved-header">
        <div className="approved-header-left">
          <h1 className="approved-title">
            <div className="approved-title-icon">
              <FaClipboardCheck />
            </div>
            Approved Tenants
            <span className="approved-title-sub">Pending Payment</span>
          </h1>
          <p className="approved-subtitle">
            Manage tenants who have been approved but need to complete initial payment
          </p>
        </div>
        
        <div className="approved-header-right">
          <div className="approved-payment-date">
            <label htmlFor="paymentDate">Payment Date:</label>
            <input
              type="date"
              id="paymentDate"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="approved-date-input"
            />
          </div>
          
          <button 
            className="approved-action-btn primary"
            onClick={() => navigate("/tenants")}
          >
            <FaUser /> View Active Tenants
          </button>
          
          <button 
            className="approved-action-btn secondary"
            onClick={() => navigate("/applications")}
          >
            View Applications
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="approved-stats">
        <div className="approved-stat-card total">
          <div className="approved-stat-icon">
            <FaUser />
          </div>
          <div className="approved-stat-content">
            <h3>{tenants.length}</h3>
            <p>Pending Payment</p>
            <small>Awaiting initial payment</small>
          </div>
        </div>
        
        <div className="approved-stat-card amount">
          <div className="approved-stat-icon">
            <FaMoneyBillWave />
          </div>
          <div className="approved-stat-content">
            <h3>{formatCurrency(tenants.reduce((sum, t) => sum + (t.totalMoveInCost || 0), 0))}</h3>
            <p>Total Pending Amount</p>
            <small>Move-in fees pending</small>
          </div>
        </div>
        
        <div className="approved-stat-card average">
          <div className="approved-stat-icon">
            <FaClock />
          </div>
          <div className="approved-stat-content">
            <h3>
              {tenants.length > 0 
                ? Math.round(tenants.reduce((sum, t) => sum + getDaysSinceApproval(t.approvedAt), 0) / tenants.length)
                : 0
              } days
            </h3>
            <p>Avg. Waiting Time</p>
            <small>Since approval</small>
          </div>
        </div>
        
        <div className="approved-stat-card properties">
          <div className="approved-stat-icon">
            <FaHome />
          </div>
          <div className="approved-stat-content">
            <h3>{[...new Set(tenants.map(t => t.propertyId))].length}</h3>
            <p>Properties</p>
            <small>With approved tenants</small>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="approved-controls">
        <div className="approved-search-box">
          <FaSearch />
          <input
            type="text"
            placeholder="Search approved tenants by name, email, phone, property..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="approved-search-input"
          />
        </div>
      </div>

      {/* Tenants Grid */}
      <div className="approved-table-container">
        {filteredTenants.length === 0 ? (
          <div className="approved-no-tenants">
            <div className="approved-no-tenants-icon">
              <FaClipboardCheck />
            </div>
            <h3>No pending payments</h3>
            <p>
              {tenants.length === 0 
                ? "No approved tenants are waiting for payment. Check applications to approve new tenants."
                : "No tenants match your search criteria."
              }
            </p>
            {tenants.length === 0 && (
              <button 
                className="approved-action-btn primary"
                onClick={() => navigate("/applications")}
              >
                Check Pending Applications
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="approved-results-info">
              <span className="approved-results-count">
                Showing {filteredTenants.length} of {tenants.length} approved tenants
              </span>
              <span className="approved-total-amount">
                Total pending: {formatCurrency(filteredTenants
                  .reduce((sum, tenant) => sum + (tenant.totalMoveInCost || 0), 0))}
              </span>
            </div>
            
            <div className="approved-grid">
              {filteredTenants.map((tenant) => {
                const daysSince = getDaysSinceApproval(tenant.approvedAt);
                
                return (
                  <div key={tenant.id} className="approved-tenant-card">
                    <div className="approved-tenant-header">
                      <div className="approved-tenant-avatar">
                        <FaUser />
                        {daysSince > 7 && (
                          <div className="approved-tenant-avatar-badge" title="Urgent - Over 7 days">
                            <FaExclamationTriangle />
                          </div>
                        )}
                      </div>
                      
                      <div className="approved-tenant-basic-info">
                        <h3>{tenant.fullName}</h3>
                        <p><FaEnvelope /> {tenant.email}</p>
                        <p><FaPhone /> {tenant.phone}</p>
                      </div>
                      
                      <div className="approved-tenant-status">
                        <div className={`approved-status-badge ${daysSince > 7 ? 'urgent' : 'pending'}`}>
                          {daysSince > 7 ? 'Urgent • Overdue' : 'Pending Payment'}
                        </div>
                        <small className="approved-waiting-time">
                          <FaClock /> {daysSince} day{daysSince !== 1 ? 's' : ''} waiting
                        </small>
                      </div>
                    </div>

                    <div className="approved-tenant-details">
                      <div className="approved-detail-row">
                        <span className="approved-detail-label"><FaHome /> Property:</span>
                        <span className="approved-detail-value">
                          {tenant.propertyName || `Property ${tenant.propertyId}`}
                        </span>
                      </div>
                      
                      <div className="approved-detail-row">
                        <span className="approved-detail-label">Unit:</span>
                        <span className="approved-detail-value">
                          {tenant.unitNumber || `Unit ${tenant.unitId}`}
                        </span>
                      </div>
                      
                      <div className="approved-detail-row">
                        <span className="approved-detail-label"><FaDollarSign /> Total Due:</span>
                        <span className="approved-detail-value amount-due">
                          {formatCurrency(tenant.totalMoveInCost)}
                        </span>
                      </div>
                      
                      <div className="approved-detail-row">
                        <span className="approved-detail-label"><FaCalendar /> Approved:</span>
                        <span className="approved-detail-value">
                          {formatDate(tenant.approvedAt)}
                          {tenant.applicationId && (
                            <span className="approved-app-id"> • App: #{tenant.applicationId.substring(0, 8)}</span>
                          )}
                        </span>
                      </div>
                      
                      {/* Breakdown Section */}
                      <div className="approved-breakdown-section">
                        <div className="approved-breakdown-title">Payment Breakdown:</div>
                        <div className="approved-breakdown-grid">
                          <div className="approved-breakdown-item">
                            <span>Monthly Rent:</span>
                            <span>{formatCurrency(tenant.monthlyRent)}</span>
                          </div>
                          <div className="approved-breakdown-item">
                            <span>Security Deposit:</span>
                            <span>{formatCurrency(tenant.securityDeposit)}</span>
                          </div>
                          <div className="approved-breakdown-item">
                            <span>Application Fee:</span>
                            <span>{formatCurrency(tenant.applicationFee)}</span>
                          </div>
                          {tenant.petDeposit > 0 && (
                            <div className="approved-breakdown-item">
                              <span>Pet Deposit:</span>
                              <span>{formatCurrency(tenant.petDeposit)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="approved-tenant-actions">
                      <button 
                        className="btn-reminder"
                        onClick={() => handleSendReminder(tenant)}
                        title="Send payment reminder"
                      >
                        <FaEnvelope /> Remind
                      </button>
                      
                      <button 
                        className="btn-view"
                        onClick={() => navigate(`/tenants/${tenant.id}`)}
                        title="View tenant details"
                      >
                        <FaUser /> View
                      </button>
                      
                      <button 
                        className="btn-paid"
                        onClick={() => handleMarkAsPaid(tenant.id, tenant.fullName)}
                        disabled={processingId === tenant.id}
                      >
                        {processingId === tenant.id ? (
                          <>
                            <span className="approved-btn-spinner"></span>
                            Processing...
                          </>
                        ) : (
                          <>
                            <div className="paid-icon-wrapper">
                              <FaCheckCircle className="paid-icon" />
                            </div>
                            Mark as Paid
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Footer Info - Simplified */}
      <div className="approved-footer-info">
        <div className="approved-footer-content">
          <FaExclamationTriangle className="approved-footer-icon" />
          <p>
            <strong>Note:</strong> Tenants will move to active collection after being marked as paid.
            Confirm payment completion before using the "Mark as Paid" button.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ApprovedTenants;