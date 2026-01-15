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
  FaCalendar
} from "react-icons/fa";
import "../styles/applications.css";

const Applications = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Fetch pending applications
  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "tenantApplications"),
        where("status", "==", "pending")
      );

      const snapshot = await getDocs(q);
      const apps = [];

      snapshot.forEach((doc) => {
        apps.push({
          id: doc.id,
          ...doc.data(),
          // Convert Firestore timestamp
          appliedDate: doc.data().appliedDate?.toDate()
        });
      });

      setApplications(apps);
    } catch (error) {
      console.error("Error fetching applications:", error);
    } finally {
      setLoading(false);
    }
  };

  // Navigate to AddTenant with prefill data
  const viewApplicationDetails = (application) => {
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

    // Save to localStorage (as backup) and navigate
    localStorage.setItem('prefillTenantData', JSON.stringify(prefillData));
    navigate('/tenants/add', { state: { prefillData } });
  };

  // Delete an application
  const deleteApplication = async (application) => {
    if (!window.confirm(`Delete ${application.fullName}'s application? This action cannot be undone.`)) return;

    try {
      setDeletingId(application.id);
      
      // Option 1: Soft delete (update status)
      await updateDoc(doc(db, "tenantApplications", application.id), {
        status: "deleted",
        deletedAt: Timestamp.now(),
        deletedBy: "admin"
      });
      
      // Option 2: Hard delete (remove from database)
      // await deleteDoc(doc(db, "tenantApplications", application.id));
      
      setApplications(prev => prev.filter(app => app.id !== application.id));
      alert("Application deleted successfully");
      
    } catch (error) {
      console.error("Error deleting application:", error);
      alert("Failed to delete application");
    } finally {
      setDeletingId(null);
    }
  };

  // Quick approve from modal
  const quickApproveApplication = (application) => {
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
    setSelectedApp(null);
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

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>Tenant Applications</h1>
        <p>Review and approve tenant registration requests</p>
        <div className="app-summary">
          <span className="app-count">{applications.length} Pending Application{applications.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="app-no-applications">
          <FaUser className="app-no-apps-icon" />
          <h3>No pending applications</h3>
          <p>When tenants register via mobile app, they'll appear here.</p>
        </div>
      ) : (
        <div className="app-horizontal-list">
          {applications.map((app) => (
            <div key={app.id} className="app-horizontal-card">
              <div className="app-horizontal-main">
                <div className="app-horizontal-avatar">
                  <FaUser />
                </div>
                
                <div className="app-horizontal-info">
                  <div className="app-horizontal-name-section">
                    <h3>{app.fullName}</h3>
                    <span className="app-horizontal-status pending">Pending Review</span>
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
                      <FaCalendar /> Applied: {app.appliedDate?.toLocaleDateString('en-GB') || "N/A"}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="app-horizontal-actions">
                <button
                  className="app-btn-view"
                  onClick={() => viewApplicationDetails(app)}
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
                <p><strong>Applied:</strong> {selectedApp.appliedDate?.toLocaleDateString('en-GB')}</p>
                <p><strong>Status:</strong>
                  <span className="app-status-badge pending">Pending</span>
                </p>
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
                onClick={() => deleteApplication(selectedApp)}
                style={{ marginRight: '10px' }}
              >
                <FaTrash /> Delete
              </button>
              <button
                className="app-btn-primary"
                onClick={() => quickApproveApplication(selectedApp)}
              >
                Review & Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Applications;