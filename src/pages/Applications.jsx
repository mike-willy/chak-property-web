import React, { useState, useEffect, useMemo } from "react";
import { db } from "../pages/firebase/firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  Timestamp
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
  FaThumbsDown,
  FaUsers,
  FaExclamationTriangle,
  FaBuilding,
  FaDoorOpen,
  FaBed,
  FaBath
} from "react-icons/fa";
import "../styles/applications.css";

const Applications = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Fetch ALL applications
  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "tenantApplications"));
      const snapshot = await getDocs(q);
      const apps = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        apps.push({
          id: doc.id,
          ...data,
          appliedDate: data.appliedDate?.toDate(),
          processedAt: data.processedAt?.toDate(),
          rejectedAt: data.rejectedAt?.toDate(),
          reviewedAt: data.reviewedAt?.toDate(),
          adminDeleted: data.adminDeleted || false // Add this field
        });
      });

      // Filter out admin deleted applications locally
      const filteredApps = apps.filter(app => !app.adminDeleted);
      
      // Sort by date (newest first)
      filteredApps.sort((a, b) => (b.appliedDate || 0) - (a.appliedDate || 0));
      setApplications(filteredApps);
    } catch (error) {
      console.error("Error fetching applications:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate duplicate applications for each unit
  const duplicateApplications = useMemo(() => {
    const unitMap = {};
    
    applications.forEach(app => {
      if (app.unitId) {
        const key = `${app.propertyId}-${app.unitId}`;
        if (!unitMap[key]) {
          unitMap[key] = [];
        }
        unitMap[key].push(app);
      }
    });
    
    return unitMap;
  }, [applications]);

  // Check if application has competing applicants
  const getCompetingApplications = (application) => {
    if (!application.unitId) return [];
    const key = `${application.propertyId}-${application.unitId}`;
    const apps = duplicateApplications[key] || [];
    return apps.filter(app => 
      app.status === "pending" && 
      app.id !== application.id
    );
  };

  // Navigate to AddTenant with prefill data
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
      propertyName: application.propertyName || "",
      unitNumber: application.unitNumber || "",
      unitType: application.unitType || "",
      bedrooms: application.bedrooms || "",
      bathrooms: application.bathrooms || "",
      monthlyRent: application.monthlyRent || "",
      securityDeposit: application.securityDeposit || application.monthlyRent || "",
      emergencyContactName: application.emergencyContactName || "",
      emergencyContactPhone: application.emergencyContactPhone || "",
      applicationId: application.id,
      appliedDate: application.appliedDate,
      tenantId: application.tenantId,
      unitDetails: {
        unitType: application.unitType,
        bedrooms: application.bedrooms,
        bathrooms: application.bathrooms,
        size: application.unitSize
      }
    };

    localStorage.setItem('prefillTenantData', JSON.stringify(prefillData));
    navigate('/tenants/add', { state: { prefillData } });
  };

  // SOFT DELETE: Remove from admin view only
  const deleteApplication = async (application) => {
    if (!window.confirm(`Remove ${application.fullName}'s application from your dashboard?\n\nThis will only hide it from admin view. Tenant can still see their application.`)) return;

    try {
      setDeletingId(application.id);
      
      // Mark as admin deleted (soft delete)
      await updateDoc(doc(db, "tenantApplications", application.id), {
        adminDeleted: true,
        adminDeletedAt: Timestamp.now(),
        adminDeletedBy: "admin"
      });
      
      // Remove from local state
      setApplications(prev => prev.filter(app => app.id !== application.id));
      
      alert("Application removed from admin dashboard.");
      
    } catch (error) {
      console.error("Error removing application:", error);
      alert("Failed to remove application. Please try again.");
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

  // Get unit details display
  const getUnitDetails = (app) => {
    let details = [];
    
    if (app.unitType) details.push(app.unitType);
    if (app.bedrooms) details.push(`${app.bedrooms} bed`);
    if (app.bathrooms) details.push(`${app.bathrooms} bath`);
    if (app.unitSize) details.push(`${app.unitSize} sqft`);
    
    return details.length > 0 ? details.join(" • ") : "No unit details";
  };

  // Get competing applicants count
  const getCompetingCount = (application) => {
    const competingApps = getCompetingApplications(application);
    return competingApps.length;
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

      {/* Duplicate Applications Warning Banner */}
      {Object.keys(duplicateApplications).some(key => 
        duplicateApplications[key].filter(app => app.status === "pending").length > 1
      ) && (
        <div className="app-duplicate-warning">
          <FaExclamationTriangle />
          <span>
            <strong>Note:</strong> Multiple tenants have applied for the same units. 
            Approving one will automatically reject others for the same unit.
          </span>
        </div>
      )}

      {applications.length === 0 ? (
        <div className="app-no-applications">
          <FaUser className="app-no-apps-icon" />
          <h3>No applications found</h3>
          <p>When tenants register via mobile app, they'll appear here.</p>
        </div>
      ) : (
        <div className="app-horizontal-list">
          {applications.map((app) => {
            const competingCount = getCompetingCount(app);
            const hasCompeting = competingCount > 0 && app.status === "pending";
            
            return (
              <div 
                key={app.id} 
                className={`app-horizontal-card ${app.status} ${hasCompeting ? 'has-competing' : ''}`}
              >
                <div className="app-horizontal-main">
                  <div className="app-horizontal-avatar">
                    <FaUser />
                    {app.status !== "pending" && (
                      <div className={`app-status-indicator ${app.status}`}>
                        {app.status === "approved" ? <FaCheckCircle /> : <FaThumbsDown />}
                      </div>
                    )}
                    {hasCompeting && app.status === "pending" && (
                      <div className="app-competing-indicator">
                        <FaUsers />
                        <span className="app-competing-count">{competingCount}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="app-horizontal-info">
                    <div className="app-horizontal-name-section">
                      <h3>{app.fullName}</h3>
                      <span className={`app-horizontal-status ${getStatusClass(app.status)}`}>
                        {getStatusText(app.status)}
                      </span>
                      {hasCompeting && (
                        <span className="app-competing-badge">
                          <FaExclamationTriangle /> {competingCount} other applicant{competingCount > 1 ? 's' : ''} for this unit
                        </span>
                      )}
                    </div>
                    
                    <div className="app-horizontal-contact">
                      <p><FaEnvelope /> {app.email}</p>
                      <p><FaPhone /> {app.phone}</p>
                    </div>
                    
                    {/* Enhanced Unit Information */}
                    <div className="app-horizontal-property-section">
                      <div className="app-unit-header">
                        <FaBuilding className="app-unit-icon" />
                        <span className="app-property-name">{app.propertyName || `Property ${app.propertyId}`}</span>
                        <FaDoorOpen className="app-unit-icon" />
                        <span className="app-unit-name">{app.unitNumber || app.unitName || `Unit ${app.unitId}`}</span>
                        {app.monthlyRent && (
                          <span className="app-rent">KSh {parseInt(app.monthlyRent).toLocaleString()}/month</span>
                        )}
                      </div>
                      
                      <div className="app-unit-details">
                        {getUnitDetails(app)}
                      </div>
                      
                      <div className="app-unit-meta">
                        {app.unitType && (
                          <span className="app-unit-type">
                            <FaHome /> {app.unitType}
                          </span>
                        )}
                        {app.bedrooms && (
                          <span className="app-unit-bedrooms">
                            <FaBed /> {app.bedrooms} bed{app.bedrooms > 1 ? 's' : ''}
                          </span>
                        )}
                        {app.bathrooms && (
                          <span className="app-unit-bathrooms">
                            <FaBath /> {app.bathrooms} bath{app.bathrooms > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
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
                        <FaEye /> {hasCompeting ? "Review & Compare" : "Review"}
                      </button>
                      
                      <button
                        className="app-btn-delete"
                        onClick={() => deleteApplication(app)}
                        disabled={deletingId === app.id}
                        title="Remove from dashboard"
                      >
                        {deletingId === app.id ? (
                          <span className="app-deleting">Removing...</span>
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
                        title="Remove from dashboard"
                      >
                        {deletingId === app.id ? (
                          <span className="app-deleting">Removing...</span>
                        ) : (
                          <FaTrash />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
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
                {selectedApp.occupation && (
                  <p><strong>Occupation:</strong> {selectedApp.occupation}</p>
                )}
                {selectedApp.employer && (
                  <p><strong>Employer:</strong> {selectedApp.employer}</p>
                )}
                {selectedApp.emergencyContactName && (
                  <p><strong>Emergency Contact:</strong> {selectedApp.emergencyContactName}</p>
                )}
                {selectedApp.emergencyContactPhone && (
                  <p><strong>Emergency Phone:</strong> {selectedApp.emergencyContactPhone}</p>
                )}
              </div>

              <div className="app-detail-section">
                <h3>Unit & Property Information</h3>
                <p><strong>Property:</strong> {selectedApp.propertyName || selectedApp.propertyId}</p>
                <p><strong>Unit:</strong> {selectedApp.unitNumber || selectedApp.unitName || selectedApp.unitId}</p>
                {selectedApp.unitType && (
                  <p><strong>Unit Type:</strong> {selectedApp.unitType}</p>
                )}
                {selectedApp.bedrooms && (
                  <p><strong>Bedrooms:</strong> {selectedApp.bedrooms}</p>
                )}
                {selectedApp.bathrooms && (
                  <p><strong>Bathrooms:</strong> {selectedApp.bathrooms}</p>
                )}
                {selectedApp.unitSize && (
                  <p><strong>Unit Size:</strong> {selectedApp.unitSize} sqft</p>
                )}
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
                  if (window.confirm(`Remove ${selectedApp.fullName}'s application from your dashboard?\n\nThis only hides it from admin view.`)) {
                    deleteApplication(selectedApp);
                    setSelectedApp(null);
                  }
                }}
                style={{ marginRight: '10px' }}
              >
                <FaTrash /> Remove from Dashboard
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
                      propertyName: selectedApp.propertyName || "",
                      unitNumber: selectedApp.unitNumber || "",
                      unitType: selectedApp.unitType || "",
                      bedrooms: selectedApp.bedrooms || "",
                      bathrooms: selectedApp.bathrooms || "",
                      monthlyRent: selectedApp.monthlyRent || "",
                      securityDeposit: selectedApp.securityDeposit || selectedApp.monthlyRent || "",
                      emergencyContactName: selectedApp.emergencyContactName || "",
                      emergencyContactPhone: selectedApp.emergencyContactPhone || "",
                      applicationId: selectedApp.id,
                      appliedDate: selectedApp.appliedDate,
                      tenantId: selectedApp.tenantId
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