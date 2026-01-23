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
  FaBath,
  FaChevronDown,
  FaChevronUp,
  FaCheck,
  FaTimes
} from "react-icons/fa";
import "../styles/applications.css";

const Applications = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

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
          adminDeleted: data.adminDeleted || false
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

  // Navigate to AddTenant with prefill data (YOUR ORIGINAL FUNCTION)
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

  // SOFT DELETE: Remove from admin view only (YOUR ORIGINAL FUNCTION)
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

  // Get competing applicants count
  const getCompetingCount = (application) => {
    const competingApps = getCompetingApplications(application);
    return competingApps.length;
  };

  // Toggle expanded row
  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Filter applications
  const filteredApplications = useMemo(() => {
    if (statusFilter === "all") return applications;
    return applications.filter(app => app.status === statusFilter);
  }, [applications, statusFilter]);

  // Count by status
  const pendingCount = applications.filter(app => app.status === "pending").length;
  const approvedCount = applications.filter(app => app.status === "approved").length;
  const rejectedCount = applications.filter(app => app.status === "rejected").length;
  const totalCount = applications.length;

  if (loading) {
    return (
      <div className="applications-container">
        <div className="applications-loading">
          <div className="applications-spinner"></div>
          <p>Loading applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="applications-container">
      <div className="applications-header">
        <div className="applications-title">
          <h1>Tenant Applications</h1>
          <p>Review and approve tenant registration requests</p>
        </div>
        
        {/* Status Tabs */}
        <div className="applications-status-tabs">
          <button 
            className={`applications-tab ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            All <span className="applications-tab-count">{totalCount}</span>
          </button>
          <button 
            className={`applications-tab ${statusFilter === "pending" ? "active" : ""}`}
            onClick={() => setStatusFilter("pending")}
          >
            Pending <span className="applications-tab-count">{pendingCount}</span>
          </button>
          <button 
            className={`applications-tab ${statusFilter === "approved" ? "active" : ""}`}
            onClick={() => setStatusFilter("approved")}
          >
            Approved <span className="applications-tab-count">{approvedCount}</span>
          </button>
          <button 
            className={`applications-tab ${statusFilter === "rejected" ? "active" : ""}`}
            onClick={() => setStatusFilter("rejected")}
          >
            Rejected <span className="applications-tab-count">{rejectedCount}</span>
          </button>
        </div>
      </div>

      {/* Duplicate Applications Warning Banner */}
      {Object.keys(duplicateApplications).some(key => 
        duplicateApplications[key].filter(app => app.status === "pending").length > 1
      ) && (
        <div className="applications-warning">
          <FaExclamationTriangle />
          <span>
            <strong>Note:</strong> Multiple tenants have applied for the same units. 
            Approving one will automatically reject others for the same unit.
          </span>
        </div>
      )}

      {applications.length === 0 ? (
        <div className="applications-empty">
          <FaUser className="applications-empty-icon" />
          <h3>No applications found</h3>
          <p>When tenants register via mobile app, they'll appear here.</p>
        </div>
      ) : (
        <div className="applications-table-container">
          <table className="applications-table">
            <thead>
              <tr>
                <th className="applications-th-status">Status</th>
                <th className="applications-th-applicant">Applicant</th>
                <th className="applications-th-property">Property & Unit</th>
                <th className="applications-th-contact">Contact</th>
                <th className="applications-th-date">Applied</th>
                <th className="applications-th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.map((app) => {
                const competingCount = getCompetingCount(app);
                const hasCompeting = competingCount > 0 && app.status === "pending";
                const isExpanded = expandedId === app.id;
                
                return (
                  <React.Fragment key={app.id}>
                    <tr className={`applications-table-row ${app.status} ${hasCompeting ? 'has-competing' : ''}`}>
                      <td className="applications-td-status">
                        <span className={`applications-status ${getStatusClass(app.status)}`}>
                          {app.status === "pending" && <FaExclamationTriangle />}
                          {app.status === "approved" && <FaCheckCircle />}
                          {app.status === "rejected" && <FaThumbsDown />}
                          <span className="applications-status-text">{getStatusText(app.status)}</span>
                          {hasCompeting && (
                            <span className="applications-competing-badge">
                              <FaUsers /> {competingCount}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="applications-td-applicant">
                        <div className="applications-applicant">
                          <div className="applications-avatar">
                            <FaUser />
                          </div>
                          <div className="applications-applicant-info">
                            <div className="applications-name">{app.fullName}</div>
                            {app.idNumber && (
                              <div className="applications-id">ID: {app.idNumber}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="applications-td-property">
                        <div className="applications-property">
                          <div className="applications-property-name">
                            <FaBuilding /> {app.propertyName || `Property ${app.propertyId}`}
                          </div>
                          <div className="applications-unit-info">
                            <FaDoorOpen /> {app.unitNumber || `Unit ${app.unitId}`}
                            {app.monthlyRent && (
                              <span className="applications-rent">
                                • KSh {parseInt(app.monthlyRent).toLocaleString()}/month
                              </span>
                            )}
                          </div>
                          <div className="applications-unit-details">
                            {app.bedrooms && <span><FaBed /> {app.bedrooms} bed</span>}
                            {app.bathrooms && <span><FaBath /> {app.bathrooms} bath</span>}
                            {app.unitType && <span><FaHome /> {app.unitType}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="applications-td-contact">
                        <div className="applications-contact">
                          <div className="applications-email">
                            <FaEnvelope /> {app.email}
                          </div>
                          <div className="applications-phone">
                            <FaPhone /> {app.phone}
                          </div>
                        </div>
                      </td>
                      <td className="applications-td-date">
                        <div className="applications-date">
                          <FaCalendar /> {formatDate(app.appliedDate)}
                        </div>
                      </td>
                      <td className="applications-td-actions">
                        <div className="applications-actions">
                          {app.status === "pending" ? (
                            <>
                              <button
                                className="applications-btn-review"
                                onClick={() => viewApplicationDetails(app)}
                                title={hasCompeting ? "Review & Compare" : "Review Application"}
                              >
                                <FaEye /> {hasCompeting ? "Review & Compare" : "Review"}
                              </button>
                              <button
                                className="applications-btn-delete"
                                onClick={() => deleteApplication(app)}
                                disabled={deletingId === app.id}
                                title="Remove from dashboard"
                              >
                                {deletingId === app.id ? (
                                  <span className="applications-deleting">Removing...</span>
                                ) : (
                                  <FaTrash />
                                )}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="applications-btn-view"
                                onClick={() => setSelectedApp(app)}
                                title="View details"
                              >
                                <FaEye /> View
                              </button>
                              <button
                                className="applications-btn-delete"
                                onClick={() => deleteApplication(app)}
                                disabled={deletingId === app.id}
                                title="Remove from dashboard"
                              >
                                {deletingId === app.id ? (
                                  <span className="applications-deleting">Removing...</span>
                                ) : (
                                  <FaTrash />
                                )}
                              </button>
                            </>
                          )}
                          {/* EXPAND BUTTON MOVED HERE - CLOSE TO OTHER BUTTONS */}
                          <button
                            className="applications-btn-expand"
                            onClick={() => toggleExpand(app.id)}
                            title={isExpanded ? "Collapse details" : "Expand details"}
                          >
                            {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expanded Row Details */}
                    {isExpanded && (
                      <tr className="applications-expanded-row">
                        <td colSpan="6">
                          <div className="applications-expanded-content">
                            <div className="applications-details-section">
                              <h4>Application Details</h4>
                              <div className="applications-details-grid">
                                <div><strong>Full Name:</strong> {app.fullName}</div>
                                <div><strong>Email:</strong> {app.email}</div>
                                <div><strong>Phone:</strong> {app.phone}</div>
                                {app.idNumber && <div><strong>ID Number:</strong> {app.idNumber}</div>}
                                {app.occupation && <div><strong>Occupation:</strong> {app.occupation}</div>}
                                {app.employer && <div><strong>Employer:</strong> {app.employer}</div>}
                                {app.emergencyContactName && <div><strong>Emergency Contact:</strong> {app.emergencyContactName}</div>}
                                {app.emergencyContactPhone && <div><strong>Emergency Phone:</strong> {app.emergencyContactPhone}</div>}
                              </div>
                            </div>
                            
                            <div className="applications-action-buttons">
                              {app.status === "pending" ? (
                                <>
                                  <button
                                    className="applications-btn-approve-main"
                                    onClick={() => viewApplicationDetails(app)}
                                  >
                                    <FaCheck /> Review & Approve
                                  </button>
                                  <button
                                    className="applications-btn-delete-main"
                                    onClick={() => deleteApplication(app)}
                                    disabled={deletingId === app.id}
                                  >
                                    <FaTrash /> Remove from Dashboard
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="applications-btn-view-main"
                                    onClick={() => setSelectedApp(app)}
                                  >
                                    <FaEye /> View Full Details
                                  </button>
                                  <button
                                    className="applications-btn-delete-main"
                                    onClick={() => deleteApplication(app)}
                                    disabled={deletingId === app.id}
                                  >
                                    <FaTrash /> Remove from Dashboard
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* View Details Modal (KEEP YOUR ORIGINAL MODAL) */}
      {selectedApp && (
        <div className="applications-modal-overlay" onClick={() => setSelectedApp(null)}>
          <div className="applications-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="applications-modal-header">
              <h2>Application Details</h2>
              <button className="applications-close-btn" onClick={() => setSelectedApp(null)}>
                ×
              </button>
            </div>

            <div className="applications-modal-body">
              <div className="applications-detail-section">
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

              <div className="applications-detail-section">
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

              <div className="applications-detail-section">
                <h3>Application Status</h3>
                <p><strong>Applied:</strong> {formatDate(selectedApp.appliedDate)}</p>
                <p><strong>Status:</strong>
                  <span className={`applications-status-badge ${getStatusClass(selectedApp.status)}`}>
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

            <div className="applications-modal-footer">
              <button
                className="applications-btn-secondary"
                onClick={() => setSelectedApp(null)}
              >
                Close
              </button>
              <button
                className="applications-btn-delete-modal"
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
                  className="applications-btn-primary"
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