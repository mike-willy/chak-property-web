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
  getDoc
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { FaUser, FaHome, FaPhone, FaEnvelope, FaCheck, FaTimes, FaEye, FaCalendar, FaStickyNote } from "react-icons/fa";
import "../styles/applications.css";

const Applications = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState(null);

  // Fetch pending applications with property and unit names
  useEffect(() => {
    fetchApplications();
  }, []);

  // Helper function to get data with fallback field names
  const getFieldValue = (data, fieldNames) => {
    for (const field of fieldNames) {
      if (data[field] !== undefined && data[field] !== null && data[field] !== "") {
        return data[field];
      }
    }
    return "";
  };

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "tenantApplications"),
        where("status", "==", "pending")
      );
      
      const snapshot = await getDocs(q);
      const apps = [];
      
      // Process each application
      for (const docSnap of snapshot.docs) {
        const appData = docSnap.data();
        
        // Get field values with multiple possible field names
        const app = {
          id: docSnap.id,
          ...appData,
          appliedDate: appData.appliedDate?.toDate(),
          
          // Tenant information with fallback field names
          fullName: getFieldValue(appData, ['fullName', 'name', 'tenantName', 'applicantName']),
          email: getFieldValue(appData, ['email', 'emailAddress']),
          phone: getFieldValue(appData, ['phone', 'phoneNumber', 'mobileNumber', 'contactNumber']),
          idNumber: getFieldValue(appData, ['idNumber', 'nationalId', 'passportNumber', 'identificationNumber']),
          occupation: getFieldValue(appData, ['occupation', 'jobTitle', 'profession', 'employment']),
          employer: getFieldValue(appData, ['employer', 'company', 'workplace', 'organization']),
          
          // Property & Unit IDs
          propertyId: appData.propertyId || appData.selectedPropertyId || appData.propertyID || "",
          unitId: appData.unitId || appData.selectedUnitId || appData.unitID || "",
          
          // Financial
          monthlyRent: appData.monthlyRent || appData.rentAmount || appData.rent || 0,
          securityDeposit: appData.securityDeposit || appData.deposit || 0,
          
          // Lease Period
          leaseStart: getFieldValue(appData, ['leaseStart', 'preferredMoveInDate', 'moveInDate', 'startDate']),
          leaseEnd: getFieldValue(appData, ['leaseEnd', 'preferredLeaseEnd', 'endDate', 'leaseEndDate']),
          leaseTerm: appData.leaseTerm || appData.preferredLeaseTerm || appData.term || 12,
          
          // Emergency Contact
          emergencyContactName: getFieldValue(appData, ['emergencyContactName', 'emergencyName', 'emergencyContact', 'emergencyPerson']),
          emergencyContactPhone: getFieldValue(appData, ['emergencyContactPhone', 'emergencyPhone', 'emergencyContactNumber', 'emergencyMobile']),
          emergencyContactRelation: getFieldValue(appData, ['emergencyContactRelation', 'emergencyRelationship', 'emergencyRelation']),
          
          // Additional Information
          tenantNotes: getFieldValue(appData, [
            'description', 'notes', 'additionalInfo', 'message', 
            'comments', 'applicationNotes', 'tenantNotes', 'remarks'
          ])
        };

        // Fetch property name if propertyId exists
        if (app.propertyId) {
          try {
            const propertyRef = doc(db, "properties", app.propertyId);
            const propertyDoc = await getDoc(propertyRef);
            if (propertyDoc.exists()) {
              const propertyData = propertyDoc.data();
              app.propertyName = propertyData.name || propertyData.propertyName || "Property";
              app.propertyAddress = propertyData.address || "";
            } else {
              app.propertyName = "Property Not Found";
            }
          } catch (error) {
            console.error(`Error fetching property ${app.propertyId}:`, error);
            app.propertyName = "Property";
          }
        } else {
          app.propertyName = "No Property Selected";
        }

        // Fetch unit details if unitId exists
        if (app.unitId) {
          try {
            const unitRef = doc(db, "units", app.unitId);
            const unitDoc = await getDoc(unitRef);
            if (unitDoc.exists()) {
              const unitData = unitDoc.data();
              app.unitNumber = unitData.unitNumber || unitData.unitName || `Unit ${app.unitId}`;
              app.unitMonthlyRent = unitData.rentAmount || unitData.monthlyRent || unitData.rent || app.monthlyRent;
              app.unitType = unitData.unitType || unitData.type || "";
              app.unitBedrooms = unitData.bedrooms || "";
              app.unitBathrooms = unitData.bathrooms || "";
            } else {
              // Try alternative: Check if unit data is embedded in application
              if (appData.unitNumber || appData.selectedUnitNumber) {
                app.unitNumber = appData.unitNumber || appData.selectedUnitNumber || `Unit`;
                app.unitMonthlyRent = app.monthlyRent;
              } else {
                app.unitNumber = "Unit Information";
                app.unitMonthlyRent = app.monthlyRent;
              }
            }
          } catch (error) {
            console.error(`Error fetching unit ${app.unitId}:`, error);
            // Fallback to data in application
            app.unitNumber = appData.unitNumber || appData.selectedUnitNumber || `Unit`;
            app.unitMonthlyRent = app.monthlyRent;
          }
        } else {
          app.unitNumber = "No Unit Selected";
          app.unitMonthlyRent = app.monthlyRent;
        }

        apps.push(app);
      }
      
      setApplications(apps);
    } catch (error) {
      console.error("Error fetching applications:", error);
    } finally {
      setLoading(false);
    }
  };

  // Approve an application and redirect to AddTenant with prefill data
  const approveApplication = async (application) => {
    try {
      // Prepare comprehensive prefill data for AddTenant
      const prefillData = {
        // Tenant Information
        fullName: application.fullName,
        email: application.email,
        phone: application.phone,
        idNumber: application.idNumber,
        occupation: application.occupation,
        employer: application.employer,
        
        // Property & Unit Information
        propertyId: application.propertyId,
        propertyName: application.propertyName,
        unitId: application.unitId,
        unitNumber: application.unitNumber,
        monthlyRent: application.unitMonthlyRent || application.monthlyRent,
        
        // Financial Details (will be fetched from property in AddTenant)
        securityDeposit: application.securityDeposit || "",
        applicationFee: "",
        petDeposit: "",
        
        // Lease Period
        leaseStart: application.leaseStart,
        leaseEnd: application.leaseEnd,
        leaseTerm: application.leaseTerm,
        noticePeriod: 30,
        
        // Emergency Contact
        emergencyContactName: application.emergencyContactName,
        emergencyContactPhone: application.emergencyContactPhone,
        emergencyContactRelation: application.emergencyContactRelation,
        
        // Additional Information - Include ALL notes fields
        tenantNotes: application.tenantNotes,
        applicationNotes: application.description || application.notes || application.additionalInfo || "",
        description: application.description,
        notes: application.notes,
        
        // Application metadata
        applicationId: application.id,
        appliedDate: application.appliedDate
      };

      // Save to localStorage (as backup) and navigate
      localStorage.setItem('prefillTenantData', JSON.stringify(prefillData));
      
      // Navigate to AddTenant page with prefill data
      navigate('/tenants/add', { state: { prefillData, applicationId: application.id } });
      
    } catch (error) {
      console.error("Error approving application:", error);
      alert("Failed to approve application");
    }
  };

  // Reject an application
  const rejectApplication = async (application) => {
    if (!window.confirm(`Reject ${application.fullName}'s application?`)) return;
    
    try {
      await updateDoc(doc(db, "tenantApplications", application.id), {
        status: "rejected",
        reviewedBy: "admin",
        reviewedAt: Timestamp.now(),
        rejectionReason: "Application rejected by admin"
      });

      setApplications(prev => prev.filter(app => app.id !== application.id));
      alert("Application rejected");
      
    } catch (error) {
      console.error("Error rejecting application:", error);
      alert("Failed to reject application");
    }
  };

  // View application details
  const viewApplicationDetails = (application) => {
    setSelectedApp(application);
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return "Not specified";
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Format date
  const formatDate = (dateInput) => {
    if (!dateInput) return "Not specified";
    
    try {
      let date;
      
      // Handle Firestore Timestamp
      if (dateInput.toDate) {
        date = dateInput.toDate();
      } 
      // Handle string date
      else if (typeof dateInput === 'string') {
        date = new Date(dateInput);
      } 
      // Handle Date object
      else if (dateInput instanceof Date) {
        date = dateInput;
      }
      
      if (date && !isNaN(date.getTime())) {
        return date.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
      return "Invalid date";
    } catch (error) {
      return "Date error";
    }
  };

  if (loading) {
    return (
      <div className="app-container">
        <div className="app-loading">
          <div className="spinner"></div>
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
        <div className="app-stats">
          <span className="app-stat-badge">{applications.length} Pending Applications</span>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="app-no-applications">
          <FaUser className="app-no-apps-icon" />
          <h3>No pending applications</h3>
          <p>When tenants register via mobile app, they'll appear here.</p>
        </div>
      ) : (
        <div className="app-grid">
          {applications.map((app) => (
            <div key={app.id} className="app-card">
              <div className="app-card-header">
                <div className="app-avatar">
                  <FaUser />
                </div>
                <div className="app-info">
                  <h3>{app.fullName || "Unnamed Applicant"}</h3>
                  <p>
                    <FaEnvelope /> {app.email || "No email"}
                  </p>
                  <p>
                    <FaPhone /> {app.phone || "No phone"}
                  </p>
                </div>
              </div>

              <div className="app-details">
                <div className="app-detail-row">
                  <span className="app-label"><FaHome /> Property:</span>
                  <span className="app-value">
                    {app.propertyName}
                  </span>
                </div>
                
                <div className="app-detail-row">
                  <span className="app-label">Unit:</span>
                  <span className="app-value">
                    {app.unitNumber}
                    {app.unitMonthlyRent > 0 && (
                      <span className="app-rent-amount">
                        • {formatCurrency(app.unitMonthlyRent)}/month
                      </span>
                    )}
                  </span>
                </div>
                
                {app.leaseStart && (
                  <div className="app-detail-row">
                    <span className="app-label"><FaCalendar /> Move-in:</span>
                    <span className="app-value">
                      {formatDate(app.leaseStart)}
                    </span>
                  </div>
                )}
                
                <div className="app-detail-row">
                  <span className="app-label">Applied:</span>
                  <span className="app-value">
                    {app.appliedDate?.toLocaleDateString() || "N/A"}
                  </span>
                </div>
                
                <div className="app-detail-row">
                  <span className="app-label">Status:</span>
                  <span className="app-status-badge pending">Pending Review</span>
                </div>
              </div>

              <div className="app-actions">
                <button 
                  className="app-btn-view"
                  onClick={() => viewApplicationDetails(app)}
                >
                  <FaEye /> View Details
                </button>
                
                <button 
                  className="app-btn-approve"
                  onClick={() => approveApplication(app)}
                >
                  <FaCheck /> Approve
                </button>
                
                <button 
                  className="app-btn-reject"
                  onClick={() => rejectApplication(app)}
                >
                  <FaTimes /> Reject
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
                <div className="app-detail-grid">
                  <div className="app-detail-item">
                    <strong>Full Name:</strong> {selectedApp.fullName || "Not provided"}
                  </div>
                  <div className="app-detail-item">
                    <strong>Email:</strong> {selectedApp.email || "Not provided"}
                  </div>
                  <div className="app-detail-item">
                    <strong>Phone:</strong> {selectedApp.phone || "Not provided"}
                  </div>
                  {selectedApp.idNumber && (
                    <div className="app-detail-item">
                      <strong>ID Number:</strong> {selectedApp.idNumber}
                    </div>
                  )}
                  {selectedApp.occupation && (
                    <div className="app-detail-item">
                      <strong>Occupation:</strong> {selectedApp.occupation}
                    </div>
                  )}
                  {selectedApp.employer && (
                    <div className="app-detail-item">
                      <strong>Employer:</strong> {selectedApp.employer}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="app-detail-section">
                <h3>Emergency Contact</h3>
                <div className="app-detail-grid">
                  {selectedApp.emergencyContactName ? (
                    <>
                      <div className="app-detail-item">
                        <strong>Name:</strong> {selectedApp.emergencyContactName}
                      </div>
                      <div className="app-detail-item">
                        <strong>Phone:</strong> {selectedApp.emergencyContactPhone || "Not provided"}
                      </div>
                      {selectedApp.emergencyContactRelation && (
                        <div className="app-detail-item">
                          <strong>Relationship:</strong> {selectedApp.emergencyContactRelation}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="app-detail-item">
                      <em>No emergency contact provided</em>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="app-detail-section">
                <h3>Property Information</h3>
                <div className="app-detail-grid">
                  <div className="app-detail-item">
                    <strong>Property:</strong> {selectedApp.propertyName}
                  </div>
                  <div className="app-detail-item">
                    <strong>Unit:</strong> {selectedApp.unitNumber}
                  </div>
                  {selectedApp.unitMonthlyRent > 0 && (
                    <div className="app-detail-item">
                      <strong>Monthly Rent:</strong> {formatCurrency(selectedApp.unitMonthlyRent)}
                    </div>
                  )}
                  {selectedApp.unitType && (
                    <div className="app-detail-item">
                      <strong>Unit Type:</strong> {selectedApp.unitType}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="app-detail-section">
                <h3>Lease Information</h3>
                <div className="app-detail-grid">
                  {selectedApp.leaseStart && (
                    <div className="app-detail-item">
                      <strong>Preferred Move-in Date:</strong> {formatDate(selectedApp.leaseStart)}
                    </div>
                  )}
                  {selectedApp.leaseEnd && (
                    <div className="app-detail-item">
                      <strong>Preferred Lease End:</strong> {formatDate(selectedApp.leaseEnd)}
                    </div>
                  )}
                  {selectedApp.leaseTerm && (
                    <div className="app-detail-item">
                      <strong>Lease Term:</strong> {selectedApp.leaseTerm} months
                    </div>
                  )}
                </div>
              </div>
              
              <div className="app-detail-section">
                <h3><FaStickyNote /> Additional Information</h3>
                <div className="app-notes-container">
                  {selectedApp.tenantNotes ? (
                    <div className="app-notes-content">
                      {selectedApp.tenantNotes}
                    </div>
                  ) : (
                    <div className="app-no-notes">
                      <em>No additional information provided by the tenant.</em>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="app-detail-section">
                <h3>Application Status</h3>
                <div className="app-detail-grid">
                  <div className="app-detail-item">
                    <strong>Applied:</strong> {selectedApp.appliedDate?.toLocaleDateString() || "N/A"}
                  </div>
                  <div className="app-detail-item">
                    <strong>Status:</strong> 
                    <span className="app-status-badge pending">Pending</span>
                  </div>
                  <div className="app-detail-item">
                    <strong>Application ID:</strong> {selectedApp.id}
                  </div>
                </div>
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
                className="app-btn-primary"
                onClick={() => {
                  // Prepare comprehensive prefill data for AddTenant
                  const prefillData = {
                    // Tenant Information
                    fullName: selectedApp.fullName,
                    email: selectedApp.email,
                    phone: selectedApp.phone,
                    idNumber: selectedApp.idNumber,
                    occupation: selectedApp.occupation,
                    employer: selectedApp.employer,
                    
                    // Property & Unit Information
                    propertyId: selectedApp.propertyId,
                    propertyName: selectedApp.propertyName,
                    unitId: selectedApp.unitId,
                    unitNumber: selectedApp.unitNumber,
                    monthlyRent: selectedApp.unitMonthlyRent || selectedApp.monthlyRent,
                    
                    // Financial Details (will be fetched from property in AddTenant)
                    securityDeposit: selectedApp.securityDeposit || "",
                    applicationFee: "",
                    petDeposit: "",
                    
                    // Lease Period
                    leaseStart: selectedApp.leaseStart,
                    leaseEnd: selectedApp.leaseEnd,
                    leaseTerm: selectedApp.leaseTerm,
                    noticePeriod: 30,
                    
                    // Emergency Contact
                    emergencyContactName: selectedApp.emergencyContactName,
                    emergencyContactPhone: selectedApp.emergencyContactPhone,
                    emergencyContactRelation: selectedApp.emergencyContactRelation,
                    
                    // Additional Information - Include ALL notes fields
                    tenantNotes: selectedApp.tenantNotes,
                    applicationNotes: selectedApp.description || selectedApp.notes || selectedApp.additionalInfo || "",
                    description: selectedApp.description,
                    notes: selectedApp.notes,
                    
                    // Application metadata
                    applicationId: selectedApp.id,
                    appliedDate: selectedApp.appliedDate
                  };
                  
                  // Save to localStorage and navigate
                  localStorage.setItem('prefillTenantData', JSON.stringify(prefillData));
                  navigate('/tenants/add', { 
                    state: { 
                      prefillData,
                      applicationId: selectedApp.id 
                    } 
                  });
                  setSelectedApp(null);
                }}
              >
                Approve & Add Tenant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Applications;