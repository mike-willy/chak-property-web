import React, { useState, useEffect } from "react";
import { db } from "../pages/firebase/firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  Timestamp,
  deleteDoc
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { 
  FaUser, 
  FaHome, 
  FaPhone, 
  FaEnvelope, 
  FaEye, 
  FaTrash,
  FaCalendar,
  FaCheckCircle,
  FaThumbsDown
} from "react-icons/fa";
import "../styles/applications.css";

const Applications = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Fetch ALL applications (pending, approved, rejected)
  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      // Remove the where clause to get ALL applications
      const q = query(collection(db, "tenantApplications"));
      // Keep only if you want to filter out deleted ones:
      // const q = query(collection(db, "tenantApplications"), where("status", "!=", "deleted"));

      const snapshot = await getDocs(q);
      const apps = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        apps.push({
          id: doc.id,
          ...data,
          // Convert Firestore timestamp
          appliedDate: data.appliedDate?.toDate(),
          // Handle other timestamps
          processedAt: data.processedAt?.toDate(),
          rejectedAt: data.rejectedAt?.toDate(),
          reviewedAt: data.reviewedAt?.toDate()
        });
      });

      // Sort by date (newest first)
      apps.sort((a, b) => (b.appliedDate || 0) - (a.appliedDate || 0));
      setApplications(apps);
    } catch (error) {
      console.error("Error fetching applications:", error);
    } finally {
      setLoading(false);
    }
  };

  // Navigate to AddTenant with prefill data (only for pending)
  const viewApplicationDetails = (application) => {
    if (application.status !== "pending") {
      setSelectedApp(application);
      return;
    }
    
    const prefillData = {
      fullName: application.fullName,
      email: application.email,
      phone: application.phone,
      idNumber: application.idNumber || "",
      propertyId: application.propertyId,
      unitId: application.unitId,
      monthlyRent: application.monthlyRent || "",
      securityDeposit: application.securityDeposit || application.monthlyRent || "",
      emergencyContactName: application.emergencyContactName || "",
      emergencyContactPhone: application.emergencyContactPhone || "",
      applicationId: application.id,
      appliedDate: application.appliedDate,
      userId: application.tenantId
    };

    localStorage.setItem('prefillTenantData', JSON.stringify(prefillData));
    navigate('/tenants/add', { state: { prefillData } });
  };

  // Delete an application permanently
  const deleteApplication = async (application) => {
    if (!window.confirm(`Permanently delete ${application.fullName}'s application? This action cannot be undone.`)) return;

    try {
      setDeletingId(application.id);
      
      // Hard delete (remove from database)
      await deleteDoc(doc(db, "tenantApplications", application.id));
      
      setApplications(prev => prev.filter(app => app.id !== application.id));
      alert("Application permanently deleted");
      
    } catch (error) {
      console.error("Error deleting application:", error);
      alert("Failed to delete application");
    } finally {
      setDeletingId(null);
    }
  };

  // Get status badge class
  const getStatusClass = (status) => {
    switch(status) {
      case "approved": return "approved";
      case "rejected": return "rejected";
      case "pending": return "pending";
      default: return "pending";
    }
  };

  // Get status text
  const getStatusText = (status) => {
    switch(status) {
      case "approved": return "Approved";
      case "rejected": return "Rejected";
      case "pending": return "Pending Review";
      default: return "Pending";
    }
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return "N/A";
    return date.toLocaleDateString('en-GB');
  };

  // Get processed date text
  const getProcessedDate = (app) => {
    if (app.status === "approved" && app.processedAt) {
      return `Approved: ${formatDate(app.processedAt)}`;
    }
    if (app.status === "rejected" && app.rejectedAt) {
      return `Rejected: ${formatDate(app.rejectedAt)}`;
    }
    return `Applied: ${formatDate(app.appliedDate)}`;
  };

  if (loading) {
    return (
      <div className="app-container">
        <div className="app-loading">
          <div className="loading-spinner"></div>
          <p>Loading applications...</p>
        </div>
      </div>
    );
  }

  // Count by status
  const pendingCount = applications.filter(app => app.status === "pending").length;
  const approvedCount = applications.filter(app => app.status === "approved").length;
  const rejectedCount = applications.filter(app => app.status === "rejected").length;

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>Tenant Applications</h1>
        <p>Review and approve tenant registration requests</p>
        <div className="app-summary-stats">
          <div className="app-stat-card pending">
            <span className="app-stat-count">{pendingCount}</span>
            <span className="app-stat-label">Pending</span>
          </div>
          <div className="app-stat-card approved">
            <span className="app-stat-count">{approvedCount}</span>
            <span className="app-stat-label">Approved</span>
          </div>
          <div className="app-stat-card rejected">
            <span className="app-stat-count">{rejectedCount}</span>
            <span className="app-stat-label">Rejected</span>
          </div>
          <div className="app-stat-card total">
            <span className="app-stat-count">{applications.length}</span>
            <span className="app-stat-label">Total</span>
          </div>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="app-no-applications">
          <FaUser className="app-no-apps-icon" />
          <h3>No applications found</h3>
          <p>When tenants register via mobile app, they'll appear here.</p>
        </div>
      ) : (
        <div className="app-horizontal-list">
          {applications.map((app) => (
            <div key={app.id} className={`app-horizontal-card ${app.status}`}>
              <div className="app-horizontal-main">
                <div className="app-horizontal-avatar">
                  <FaUser />
                  {app.status !== "pending" && (
                    <div className={`app-status-indicator ${app.status}`}>
                      {app.status === "approved" ? <FaCheckCircle /> : <FaThumbsDown />}
                    </div>
                  )}
                </div>
                
                <div className="app-horizontal-info">
                  <div className="app-horizontal-name-section">
                    <h3>{app.fullName}</h3>
                    <span className={`app-horizontal-status ${getStatusClass(app.status)}`}>
                      {getStatusText(app.status)}
                    </span>
                  </div>
                  
                  <div className="app-horizontal-contact">
                    <p><FaEnvelope /> {app.email}</p>
                    <p><FaPhone /> {app.phone}</p>
                  </div>
                  
                  <div className="app-horizontal-property">
                    <FaHome /> {app.propertyName || `Property ${app.propertyId}`}, {app.unitName || `Unit ${app.unitId}`}
                    {app.monthlyRent && <span className="app-rent"> • KSh {parseInt(app.monthlyRent).toLocaleString()}/month</span>}
                  </div>
                  
                  <div className="app-horizontal-meta">
                    <span className="app-date">
                      <FaCalendar /> {getProcessedDate(app)}
                    </span>
                    {app.rejectionReason && app.status === "rejected" && (
                      <span className="app-rejection-reason">
                        Reason: {app.rejectionReason}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="app-horizontal-actions">
                {app.status === "pending" ? (
                  <>
                    <button
                      className="app-btn-view"
                      onClick={() => viewApplicationDetails(app)}
                    >
                      <FaEye /> Review
                    </button>
                    
                    <button
                      className="app-btn-delete"
                      onClick={() => deleteApplication(app)}
                      disabled={deletingId === app.id}
                      title="Delete application"
                    >
                      {deletingId === app.id ? (
                        <span className="app-deleting">Deleting...</span>
                      ) : (
                        <FaTrash />
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="app-btn-view-details"
                      onClick={() => setSelectedApp(app)}
                    >
                      <FaEye /> View Details
                    </button>
                    
                    <button
                      className="app-btn-delete"
                      onClick={() => deleteApplication(app)}
                      disabled={deletingId === app.id}
                      title="Delete application"
                    >
                      {deletingId === app.id ? (
                        <span className="app-deleting">Deleting...</span>
                      ) : (
                        <FaTrash />
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Details Modal */}
      {selectedApp && (
        <div className="app-modal-overlay" onClick={() => setSelectedApp(null)}>
          <div className="app-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="app-modal-header">
              <h2>Application Details</h2>
              <button className="app-close-btn" onClick={() => setSelectedApp(null)}>
                ×
              </button>
            </div>

            <div className="app-modal-body">
              <div className="app-detail-section">
                <h3>Personal Information</h3>
                <p><strong>Full Name:</strong> {selectedApp.fullName}</p>
                <p><strong>Email:</strong> {selectedApp.email}</p>
                <p><strong>Phone:</strong> {selectedApp.phone}</p>
                {selectedApp.idNumber && (
                  <p><strong>ID Number:</strong> {selectedApp.idNumber}</p>
                )}
                {selectedApp.emergencyContactName && (
                  <p><strong>Emergency Contact:</strong> {selectedApp.emergencyContactName}</p>
                )}
                {selectedApp.emergencyContactPhone && (
                  <p><strong>Emergency Phone:</strong> {selectedApp.emergencyContactPhone}</p>
                )}
              </div>

              <div className="app-detail-section">
                <h3>Property Information</h3>
                <p><strong>Property ID:</strong> {selectedApp.propertyId}</p>
                <p><strong>Unit ID:</strong> {selectedApp.unitId}</p>
                {selectedApp.monthlyRent && (
                  <p><strong>Monthly Rent:</strong> KSh {parseInt(selectedApp.monthlyRent).toLocaleString()}</p>
                )}
                {selectedApp.securityDeposit && (
                  <p><strong>Security Deposit:</strong> KSh {parseInt(selectedApp.securityDeposit).toLocaleString()}</p>
                )}
              </div>

              <div className="app-detail-section">
                <h3>Application Status</h3>
                <p><strong>Applied:</strong> {formatDate(selectedApp.appliedDate)}</p>
                <p><strong>Status:</strong>
                  <span className={`app-status-badge ${getStatusClass(selectedApp.status)}`}>
                    {getStatusText(selectedApp.status)}
                  </span>
                </p>
                {selectedApp.processedAt && (
                  <p><strong>Processed:</strong> {formatDate(selectedApp.processedAt)}</p>
                )}
                {selectedApp.rejectedAt && (
                  <p><strong>Rejected:</strong> {formatDate(selectedApp.rejectedAt)}</p>
                )}
                {selectedApp.rejectionReason && (
                  <p><strong>Rejection Reason:</strong> {selectedApp.rejectionReason}</p>
                )}
              </div>
            </div>

            <div className="app-modal-footer">
              <button
                className="app-btn-secondary"
                onClick={() => setSelectedApp(null)}
              >
                Close
              </button>
              <button
                className="app-btn-delete"
                onClick={() => {
                  deleteApplication(selectedApp);
                  setSelectedApp(null);
                }}
                style={{ marginRight: '10px' }}
              >
                <FaTrash /> Delete
              </button>
              {selectedApp.status === "pending" && (
                <button
                  className="app-btn-primary"
                  onClick={() => {
                    const prefillData = {
                      fullName: selectedApp.fullName,
                      email: selectedApp.email,
                      phone: selectedApp.phone,
                      idNumber: selectedApp.idNumber || "",
                      propertyId: selectedApp.propertyId,
                      unitId: selectedApp.unitId,
                      monthlyRent: selectedApp.monthlyRent || "",
                      securityDeposit: selectedApp.securityDeposit || selectedApp.monthlyRent || "",
                      emergencyContactName: selectedApp.emergencyContactName || "",
                      emergencyContactPhone: selectedApp.emergencyContactPhone || "",
                      applicationId: selectedApp.id,
                      appliedDate: selectedApp.appliedDate,
                      userId: selectedApp.tenantId
                    };
                    localStorage.setItem('prefillTenantData', JSON.stringify(prefillData));
                    navigate('/tenants/add', { state: { prefillData } });
                    setSelectedApp(null);
                  }}
                >
                  Review & Approve
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Applications;