// src/pages/AddTenant.jsx - MODIFIED VERSION
import React, { useState, useEffect, useCallback } from "react";
import { db } from "../pages/firebase/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
  getDoc
} from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FaUserPlus,
  FaHome,
  FaCalendar,
  FaUsers,
  FaTimes,
  FaStickyNote,
  FaPhone,
  FaUser,
  FaMoneyBillWave,
  FaClipboardCheck,
  FaLock,
  FaEye,
  FaCheckCircle,
  FaThumbsDown,
  FaTrash
} from "react-icons/fa";
import "../styles/addTenant.css";

const AddTenant = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Get prefill data from tenant application
  const [prefillData, setPrefillData] = useState(() => {
    if (location.state?.prefillData) {
      return location.state.prefillData;
    }
    const stored = localStorage.getItem('prefillTenantData');
    if (stored) {
      localStorage.removeItem('prefillTenantData');
      return JSON.parse(stored);
    }
    return null;
  });

  const [loading, setLoading] = useState(false);
  const [propertyDetails, setPropertyDetails] = useState(null);
  
  // NEW: Rejection reason state
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Tenant data from application
  const [tenantData, setTenantData] = useState({
    // Tenant Information
    fullName: prefillData?.fullName || "",
    email: prefillData?.email || "",
    phone: prefillData?.phone || "",
    idNumber: prefillData?.idNumber || "",
    occupation: prefillData?.occupation || "",
    employer: prefillData?.employer || "",

    // Property & Unit
    propertyId: prefillData?.propertyId || "",
    propertyName: prefillData?.propertyName || "",
    unitId: prefillData?.unitId || "",
    unitNumber: prefillData?.unitNumber || "",
    monthlyRent: prefillData?.monthlyRent || "",

    // Financial Details
    securityDeposit: prefillData?.securityDeposit || "",
    applicationFee: prefillData?.applicationFee || "",
    petDeposit: prefillData?.petDeposit || "",
    totalMoveInCost: 0,

    // Lease Period
    leaseStart: prefillData?.leaseStart || "",
    leaseEnd: prefillData?.leaseEnd || "",
    leaseTerm: prefillData?.leaseTerm || 12,
    noticePeriod: prefillData?.noticePeriod || 30,

    // Emergency Contact
    emergencyContactName: prefillData?.emergencyContactName || "",
    emergencyContactPhone: prefillData?.emergencyContactPhone || "",
    emergencyContactRelation: prefillData?.emergencyContactRelation || "",

    // Additional Information
    tenantNotes: prefillData?.tenantNotes || prefillData?.applicationNotes || prefillData?.description || prefillData?.notes || "",

    // Application metadata
    applicationId: prefillData?.applicationId || "",
    appliedDate: prefillData?.appliedDate || "",
    userId: prefillData?.userId || "", // Link to original user account
  });

  // NEW: Handle reject application
  const handleRejectApplication = async () => {
    if (!rejectionReason.trim()) {
      alert("Please provide a rejection reason");
      return;
    }

    if (!window.confirm("Are you sure you want to reject this application?")) return;

    try {
      setLoading(true);
      
      // Update application status to rejected
      if (tenantData.applicationId) {
        await updateDoc(doc(db, "tenantApplications", tenantData.applicationId), {
          status: "rejected",
          rejectedAt: Timestamp.now(),
          rejectedBy: "admin",
          rejectionReason: rejectionReason,
          reviewedAt: Timestamp.now()
        });
      }

      alert("Application rejected successfully!");
      
      // Reset form and navigate back to applications
      resetForm();
      navigate("/applications");
      
    } catch (error) {
      console.error("Error rejecting application:", error);
      alert("Failed to reject application. Please try again.");
    } finally {
      setLoading(false);
      setShowRejectForm(false);
    }
  };

  // NEW: Reset form to blank state
  const resetForm = () => {
    setTenantData({
      fullName: "",
      email: "",
      phone: "",
      idNumber: "",
      occupation: "",
      employer: "",
      propertyId: "",
      propertyName: "",
      unitId: "",
      unitNumber: "",
      monthlyRent: "",
      securityDeposit: "",
      applicationFee: "",
      petDeposit: "",
      totalMoveInCost: 0,
      leaseStart: "",
      leaseEnd: "",
      leaseTerm: 12,
      noticePeriod: 30,
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelation: "",
      tenantNotes: "",
      applicationId: "",
      appliedDate: "",
      userId: ""
    });
    setRejectionReason("");
    setPrefillData(null);
  };

  // NEW: Handle cancel/back without rejecting
  const handleCancel = () => {
    resetForm();
    navigate("/applications");
  };

  // Load property details (same as before)
  const loadPropertyDetails = useCallback(async (propertyId) => {
    try {
      const propertyRef = doc(db, "properties", propertyId);
      const propertyDoc = await getDoc(propertyRef);

      if (propertyDoc.exists()) {
        const propertyData = propertyDoc.data();
        setPropertyDetails(propertyData);

        setTenantData(prev => ({
          ...prev,
          securityDeposit: propertyData.securityDeposit || prev.securityDeposit || "",
          applicationFee: propertyData.applicationFee || prev.applicationFee || "",
          petDeposit: propertyData.petDeposit || prev.petDeposit || "",
          leaseTerm: propertyData.leaseTerm || prev.leaseTerm || 12,
          noticePeriod: propertyData.noticePeriod || prev.noticePeriod || 30
        }));

        calculateTotalMoveInCost();
      }
    } catch (error) {
      console.error("Error loading property details:", error);
    }
  }, []);

  // Calculate total move-in cost (same as before)
  const calculateTotalMoveInCost = () => {
    const monthlyRent = parseFloat(tenantData.monthlyRent) || 0;
    const securityDeposit = parseFloat(tenantData.securityDeposit) || 0;
    const applicationFee = parseFloat(tenantData.applicationFee) || 0;
    const petDeposit = parseFloat(tenantData.petDeposit) || 0;

    const total = monthlyRent + securityDeposit + applicationFee + petDeposit;

    setTenantData(prev => ({
      ...prev,
      totalMoveInCost: total
    }));
  };

  useEffect(() => {
    if (prefillData?.propertyId) {
      loadPropertyDetails(prefillData.propertyId);
    }

    if (prefillData?.monthlyRent) {
      calculateTotalMoveInCost();
    }
  }, [prefillData, loadPropertyDetails]);

  // Format currency (same as before)
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  // Format date (same as before)
  const formatDate = (dateString) => {
    if (!dateString) return "Not specified";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  // Handle approve tenant (same as before)
  const handleApproveTenant = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validation
      if (!tenantData.fullName || !tenantData.email || !tenantData.propertyId || !tenantData.unitId) {
        alert("Missing required tenant information");
        setLoading(false);
        return;
      }

      // Prepare tenant record
      const tenantRecord = {
        // Tenant Information
        fullName: tenantData.fullName,
        email: tenantData.email,
        phone: tenantData.phone,
        userId: tenantData.userId,
        idNumber: tenantData.idNumber,
        occupation: tenantData.occupation,
        employer: tenantData.employer,

        // Property & Unit
        propertyId: tenantData.propertyId,
        unitId: tenantData.unitId,
        propertyName: tenantData.propertyName || propertyDetails?.name || "",
        unitNumber: tenantData.unitNumber || "",

        // Financial Details
        monthlyRent: parseFloat(tenantData.monthlyRent) || 0,
        securityDeposit: parseFloat(tenantData.securityDeposit) || 0,
        applicationFee: parseFloat(tenantData.applicationFee) || 0,
        petDeposit: parseFloat(tenantData.petDeposit) || 0,
        totalMoveInCost: tenantData.totalMoveInCost || 0,

        // Lease Information
        leaseStart: tenantData.leaseStart ? Timestamp.fromDate(new Date(tenantData.leaseStart)) : Timestamp.now(),
        leaseEnd: tenantData.leaseEnd ? Timestamp.fromDate(new Date(tenantData.leaseEnd)) : null,
        leaseTerm: parseInt(tenantData.leaseTerm) || 12,
        noticePeriod: parseInt(tenantData.noticePeriod) || 30,

        // Emergency Contact
        emergencyContactName: tenantData.emergencyContactName,
        emergencyContactPhone: tenantData.emergencyContactPhone,
        emergencyContactRelation: tenantData.emergencyContactRelation,

        // Additional Information
        tenantNotes: tenantData.tenantNotes,

        // Status & Timestamps
        status: "active",
        balance: parseFloat(tenantData.monthlyRent) || 0,
        paymentStatus: "pending",
        createdAt: Timestamp.now(),
        approvedAt: Timestamp.now(),
        createdBy: "admin",
        applicationId: tenantData.applicationId,

        // Property Fee References
        propertyFees: {
          latePaymentFee: propertyDetails?.latePaymentFee || 0,
          gracePeriod: propertyDetails?.gracePeriod || 5,
          feeDetails: propertyDetails?.feeDetails || {}
        }
      };

      // Save tenant to Firestore
      const tenantRef = await addDoc(collection(db, "tenants"), tenantRecord);

      // Update unit status
      if (tenantData.unitId && tenantData.propertyId) {
        await updateDoc(doc(db, "properties", tenantData.propertyId, "units", tenantData.unitId), {
          status: "occupied",
          tenantId: tenantRef.id,
          tenantName: tenantData.fullName,
          occupiedAt: Timestamp.now(),
          rentAmount: parseFloat(tenantData.monthlyRent) || 0
        });
      }

      // Update application status
      if (tenantData.applicationId) {
        await updateDoc(doc(db, "tenantApplications", tenantData.applicationId), {
          status: "approved",
          processedAt: Timestamp.now(),
          linkedTenantId: tenantRef.id,
          approvedBy: "admin"
        });
      }

      alert("✅ Tenant application approved successfully!");
      
      // Reset form and navigate to tenants page
      resetForm();
      navigate("/tenants");

    } catch (error) {
      console.error("Error approving tenant:", error);
      alert("Failed to approve tenant application. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // If no prefill data
  if (!prefillData) {
    return (
      <div className="tenant-form-container">
        <div className="tenant-form-content">
          <h2>No Tenant Application Data Found</h2>
          <p>Please select a tenant application to review.</p>
          <button
            className="tenant-form-view-tenants-btn"
            onClick={() => navigate("/applications")}
          >
            View Applications
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tenant-form-container">
      {/* Header */}
      <div className="tenant-form-header">
        <div className="tenant-form-header-left">
          <h1 className="tenant-form-title"><FaClipboardCheck /> Review Tenant Application</h1>
          <div className="tenant-form-prefill-notice">
            <FaEye /> Viewing application submitted by tenant
          </div>
        </div>

        <div className="tenant-form-header-actions">
          <button
            className="tenant-form-view-tenants-btn"
            onClick={() => navigate("/applications")}
          >
            <FaUsers /> View Applications
          </button>
        </div>
      </div>

      <div className="tenant-form-content">
        <div className="tenant-form-sections">

          {/* Rejection Reason Form - NEW */}
          {showRejectForm && (
            <div className="tenant-form-section tenant-form-reject-section">
              <h2 className="tenant-form-section-title"><FaThumbsDown /> Reject Application</h2>
              <div className="tenant-form-group tenant-form-group-full-width">
                <label className="tenant-form-label">Rejection Reason *</label>
                <textarea
                  className="tenant-form-textarea"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide a reason for rejecting this application..."
                  rows="4"
                />
                <p className="tenant-form-helper-text">
                  This reason will be visible to the tenant
                </p>
              </div>
              
              <div className="tenant-form-button-group" style={{ marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="tenant-form-btn-cancel"
                  onClick={() => setShowRejectForm(false)}
                >
                  <FaTimes /> Cancel
                </button>
                <button
                  type="button"
                  className="tenant-form-btn-danger"
                  onClick={handleRejectApplication}
                  disabled={loading || !rejectionReason.trim()}
                >
                  {loading ? (
                    <>
                      <span className="tenant-form-spinner-small"></span>
                      Processing...
                    </>
                  ) : (
                    <>
                      <FaThumbsDown /> Confirm Reject
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Section 1: Tenant Information - READ ONLY */}
          <div className="tenant-form-section">
            <h2 className="tenant-form-section-title"><FaUser /> Tenant Information</h2>
            <div className="tenant-form-grid">
              {[
                { label: "Full Name", value: tenantData.fullName },
                { label: "Email Address", value: tenantData.email },
                { label: "Phone Number", value: tenantData.phone },
                { label: "ID/Passport Number", value: tenantData.idNumber || "Not provided" },
                { label: "Occupation", value: tenantData.occupation || "Not provided" },
                { label: "Employer", value: tenantData.employer || "Not provided" },
              ].map((field, index) => (
                <div className="tenant-form-group" key={index}>
                  <label className="tenant-form-label">{field.label}</label>
                  <div className="tenant-form-input tenant-form-readonly">
                    <FaLock /> {field.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Property & Unit - READ ONLY */}
          <div className="tenant-form-section">
            <h2 className="tenant-form-section-title"><FaHome /> Property & Unit Selected</h2>

            <div className="tenant-form-grid">
              <div className="tenant-form-group">
                <label className="tenant-form-label">Selected Property</label>
                <div className="tenant-form-input tenant-form-readonly">
                  <FaLock /> {tenantData.propertyName || "Not selected"}
                </div>
                <p className="tenant-form-helper-text">
                  Selected by tenant in mobile application
                </p>
              </div>

              <div className="tenant-form-group">
                <label className="tenant-form-label">Selected Unit</label>
                <div className="tenant-form-input tenant-form-readonly">
                  <FaLock /> {tenantData.unitNumber || "Not selected"}
                  {tenantData.monthlyRent && ` • ${formatCurrency(tenantData.monthlyRent)}/month`}
                </div>
                <p className="tenant-form-helper-text">
                  Selected by tenant in mobile application
                </p>
              </div>
            </div>

            {/* Property Fee Information */}
            {propertyDetails && (
              <div className="tenant-form-property-fees-info">
                <h3 className="tenant-form-property-fees-title">Property Fee Information</h3>
                <div className="tenant-form-fees-grid">
                  <div className="tenant-form-fee-item">
                    <span className="tenant-form-fee-label">Security Deposit:</span>
                    <span className="tenant-form-fee-value">{formatCurrency(propertyDetails.securityDeposit)}</span>
                  </div>
                  <div className="tenant-form-fee-item">
                    <span className="tenant-form-fee-label">Application Fee:</span>
                    <span className="tenant-form-fee-value">{formatCurrency(propertyDetails.applicationFee)}</span>
                  </div>
                  <div className="tenant-form-fee-item">
                    <span className="tenant-form-fee-label">Pet Deposit:</span>
                    <span className="tenant-form-fee-value">
                      {propertyDetails.petDeposit ? formatCurrency(propertyDetails.petDeposit) : "Not allowed"}
                    </span>
                  </div>
                  <div className="tenant-form-fee-item">
                    <span className="tenant-form-fee-label">Standard Lease Term:</span>
                    <span className="tenant-form-fee-value">{propertyDetails.leaseTerm || 12} months</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Financial Details - READ ONLY */}
          <div className="tenant-form-section">
            <h2 className="tenant-form-section-title"><FaMoneyBillWave /> Financial Details</h2>

            <div className="tenant-form-grid">
              {[
                { label: "Monthly Rent", value: formatCurrency(tenantData.monthlyRent) },
                { label: "Security Deposit", value: formatCurrency(tenantData.securityDeposit) },
                { label: "Application Fee", value: formatCurrency(tenantData.applicationFee) },
                { label: "Pet Deposit", value: tenantData.petDeposit ? formatCurrency(tenantData.petDeposit) : "None" },
              ].map((field, index) => (
                <div className="tenant-form-group" key={index}>
                  <label className="tenant-form-label">{field.label}</label>
                  <div className="tenant-form-input tenant-form-readonly">
                    {field.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Total Move-in Cost */}
            <div className="tenant-form-total-cost-summary">
              <h3 className="tenant-form-total-cost-title">Total Move-in Cost</h3>
              <div className="tenant-form-cost-breakdown">
                <div className="tenant-form-cost-item">
                  <span>First Month's Rent:</span>
                  <span>{formatCurrency(tenantData.monthlyRent)}</span>
                </div>
                <div className="tenant-form-cost-item">
                  <span>Security Deposit:</span>
                  <span>{formatCurrency(tenantData.securityDeposit)}</span>
                </div>
                <div className="tenant-form-cost-item">
                  <span>Application Fee:</span>
                  <span>{formatCurrency(tenantData.applicationFee)}</span>
                </div>
                {tenantData.petDeposit > 0 && (
                  <div className="tenant-form-cost-item">
                    <span>Pet Deposit:</span>
                    <span>{formatCurrency(tenantData.petDeposit)}</span>
                  </div>
                )}
                <div className="tenant-form-cost-total">
                  <span>TOTAL TO PAY:</span>
                  <span className="tenant-form-total-amount">{formatCurrency(tenantData.totalMoveInCost)}</span>
                </div>
              </div>
              <p className="tenant-form-helper-text">
                <strong>Note:</strong> Tenant must pay this total amount before moving in
              </p>
            </div>
          </div>

          {/* Section 4: Lease Period - READ ONLY */}
          <div className="tenant-form-section">
            <h2 className="tenant-form-section-title"><FaCalendar /> Lease Period</h2>

            <div className="tenant-form-grid">
              <div className="tenant-form-group">
                <label className="tenant-form-label">Lease Start Date</label>
                <div className="tenant-form-input tenant-form-readonly">
                  {formatDate(tenantData.leaseStart) || "Not specified"}
                </div>
              </div>

              <div className="tenant-form-group">
                <label className="tenant-form-label">Lease End Date</label>
                <div className="tenant-form-input tenant-form-readonly">
                  {formatDate(tenantData.leaseEnd) || "Not specified"}
                </div>
              </div>

              <div className="tenant-form-group">
                <label className="tenant-form-label">Lease Term (Months)</label>
                <div className="tenant-form-input tenant-form-readonly">
                  {tenantData.leaseTerm} months
                </div>
                <p className="tenant-form-helper-text">
                  Property default: {propertyDetails?.leaseTerm || 12} months
                </p>
              </div>

              <div className="tenant-form-group">
                <label className="tenant-form-label">Notice Period (Days)</label>
                <div className="tenant-form-input tenant-form-readonly">
                  {tenantData.noticePeriod} days
                </div>
                <p className="tenant-form-helper-text">
                  Property default: {propertyDetails?.noticePeriod || 30} days
                </p>
              </div>
            </div>
          </div>

          {/* Section 5: Emergency Contact - READ ONLY */}
          <div className="tenant-form-section">
            <h2 className="tenant-form-section-title"><FaPhone /> Emergency Contact</h2>
            <div className="tenant-form-grid">
              <div className="tenant-form-group">
                <label className="tenant-form-label">Contact Name</label>
                <div className="tenant-form-input tenant-form-readonly">
                  {tenantData.emergencyContactName || "Not provided"}
                </div>
              </div>

              <div className="tenant-form-group">
                <label className="tenant-form-label">Contact Phone</label>
                <div className="tenant-form-input tenant-form-readonly">
                  {tenantData.emergencyContactPhone || "Not provided"}
                </div>
              </div>

              <div className="tenant-form-group">
                <label className="tenant-form-label">Relationship</label>
                <div className="tenant-form-input tenant-form-readonly">
                  {tenantData.emergencyContactRelation || "Not provided"}
                </div>
              </div>
            </div>
          </div>

          {/* Section 6: Additional Information - READ ONLY */}
          <div className="tenant-form-section">
            <h2 className="tenant-form-section-title"><FaStickyNote /> Additional Information</h2>
            <div className="tenant-form-grid">
              <div className="tenant-form-group tenant-form-group-full-width">
                <label className="tenant-form-label">Tenant Description / Notes</label>
                <div className="tenant-form-textarea tenant-form-readonly" style={{ minHeight: '100px', padding: '1rem' }}>
                  {tenantData.tenantNotes || "No additional information provided by tenant"}
                </div>
                <p className="tenant-form-helper-text">
                  Information provided by tenant during application
                </p>
              </div>
            </div>
          </div>

          {/* Form Actions - NEW Layout */}
          <div className="tenant-form-actions">
            <div className="tenant-form-button-group">
              <button 
                type="button" 
                className="tenant-form-btn-cancel" 
                onClick={handleCancel}
              >
                <FaTimes /> Cancel
              </button>
              
              <button 
                type="button" 
                className="tenant-form-btn-danger"
                onClick={() => setShowRejectForm(true)}
                disabled={loading}
              >
                <FaThumbsDown /> Reject
              </button>
            </div>
            
            <button 
              type="button" 
              className="tenant-form-btn-submit" 
              onClick={handleApproveTenant} 
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="tenant-form-spinner-small"></span>
                  Processing...
                </>
              ) : (
                <>
                  <FaCheckCircle /> Approve Tenant
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddTenant;