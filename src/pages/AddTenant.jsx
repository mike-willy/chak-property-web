// src/pages/AddTenant.jsx - FIXED VERSION
import React, { useState, useEffect, useCallback } from "react";
import { db } from "../pages/firebase/firebase";
import { 
  collection, 
  addDoc, 
  updateDoc,
  doc,
  Timestamp,
  getDoc,
  collection as firestoreCollection,
  getDocs,
  query,
  where
} from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";
import { 
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
  FaExclamationTriangle
} from "react-icons/fa";
import "../styles/addTenant.css";

const AddTenant = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get application ID from URL or state
  const [applicationId, setApplicationId] = useState(() => {
    if (location.state?.applicationId) {
      return location.state.applicationId;
    }
    if (location.state?.prefillData?.applicationId) {
      return location.state.prefillData.applicationId;
    }
    // Check URL params
    const params = new URLSearchParams(location.search);
    return params.get('applicationId') || null;
  });

  const [loading, setLoading] = useState(false);
  const [propertyDetails, setPropertyDetails] = useState(null);
  const [unitDetails, setUnitDetails] = useState(null);
  const [applicationData, setApplicationData] = useState(null);
  const [error, setError] = useState(null);
  const [unitRef, setUnitRef] = useState(null); // Store unit document reference

  // Tenant data state
  const [tenantData, setTenantData] = useState({
    // Tenant Information
    fullName: "",
    email: "",
    phone: "",
    idNumber: "",
    occupation: "",
    employer: "",
    
    // Property & Unit
    propertyId: "",
    propertyName: "",
    unitId: "",
    unitNumber: "",
    monthlyRent: "",
    
    // Financial Details
    securityDeposit: "",
    applicationFee: "",
    petDeposit: "",
    totalMoveInCost: 0,
    
    // Lease Period
    leaseStart: "",
    leaseEnd: "",
    leaseTerm: 12,
    noticePeriod: 30,
    
    // Emergency Contact
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
    
    // Additional Information
    tenantNotes: "",
    
    // Application metadata
    applicationId: "",
    appliedDate: "",
    status: ""
  });

  // Find unit document - check both collections
  const findUnitDocument = useCallback(async (unitId, propertyId) => {
    if (!unitId) return null;
    
    try {
      // Try 1: Check in separate units collection
      try {
        const unitDocRef = doc(db, "units", unitId);
        const unitDoc = await getDoc(unitDocRef);
        
        if (unitDoc.exists()) {
          console.log("Unit found in separate units collection");
          return {
            ref: unitDocRef,
            data: unitDoc.data(),
            collectionType: "units"
          };
        }
      } catch (error) {
        console.log("Unit not found in separate collection:", error.message);
      }
      
      // Try 2: Check in property subcollection (properties/{propertyId}/units/{unitId})
      if (propertyId) {
        try {
          const unitDocRef = doc(db, "properties", propertyId, "units", unitId);
          const unitDoc = await getDoc(unitDocRef);
          
          if (unitDoc.exists()) {
            console.log("Unit found in property subcollection");
            return {
              ref: unitDocRef,
              data: unitDoc.data(),
              collectionType: "property_subcollection"
            };
          }
        } catch (error) {
          console.log("Unit not found in property subcollection:", error.message);
        }
      }
      
      // Try 3: Search for unit by unitNumber in separate units collection
      if (propertyId && tenantData.unitNumber) {
        try {
          const unitsQuery = query(
            firestoreCollection(db, "units"),
            where("propertyId", "==", propertyId),
            where("unitNumber", "==", tenantData.unitNumber)
          );
          
          const querySnapshot = await getDocs(unitsQuery);
          if (!querySnapshot.empty) {
            const unitDoc = querySnapshot.docs[0];
            console.log("Unit found by unitNumber in units collection");
            return {
              ref: doc(db, "units", unitDoc.id),
              data: unitDoc.data(),
              collectionType: "units_by_unitNumber"
            };
          }
        } catch (error) {
          console.log("Error searching unit by unitNumber:", error.message);
        }
      }
      
      console.log("Unit document not found in any collection");
      return null;
      
    } catch (error) {
      console.error("Error finding unit document:", error);
      return null;
    }
  }, [tenantData.unitNumber]);

  // Fetch application data from Firestore
  const fetchApplicationData = useCallback(async (appId) => {
    if (!appId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Fetch the application document
      const applicationRef = doc(db, "tenantApplications", appId);
      const applicationDoc = await getDoc(applicationRef);
      
      if (!applicationDoc.exists()) {
        setError("Application not found");
        setLoading(false);
        return;
      }
      
      const appData = applicationDoc.data();
      setApplicationData(appData);
      
      // Extract and structure the data - IMPORTANT: Handle Firestore Timestamps
      const tenantInfo = {
        // Tenant Information
        fullName: appData.fullName || appData.name || "",
        email: appData.email || "",
        phone: appData.phone || appData.phoneNumber || "",
        idNumber: appData.idNumber || appData.nationalId || "",
        occupation: appData.occupation || appData.jobTitle || "",
        employer: appData.employer || appData.company || "",
        
        // Property & Unit
        propertyId: appData.propertyId || appData.selectedPropertyId || "",
        propertyName: appData.propertyName || appData.selectedPropertyName || "",
        unitId: appData.unitId || appData.selectedUnitId || "",
        unitNumber: appData.unitNumber || appData.selectedUnitNumber || "",
        monthlyRent: appData.monthlyRent || appData.rentAmount || "",
        
        // Lease Period (from mobile app) - Store as Timestamp objects
        leaseStart: appData.leaseStart, // This is a Firestore Timestamp from Flutter
        leaseEnd: appData.leaseEnd, // This is a Firestore Timestamp from Flutter
        leaseTerm: appData.leaseTerm || appData.preferredLeaseTerm || 12,
        noticePeriod: appData.noticePeriod || 30,
        
        // Emergency Contact
        emergencyContactName: appData.emergencyContactName || appData.emergencyName || "",
        emergencyContactPhone: appData.emergencyContactPhone || appData.emergencyPhone || "",
        emergencyContactRelation: appData.emergencyContactRelation || appData.emergencyRelationship || "",
        
        // Additional Information
        tenantNotes: appData.description || appData.notes || appData.additionalInfo || 
                   appData.message || appData.comments || "",
        
        // Application metadata
        applicationId: appId,
        appliedDate: appData.createdAt || appData.appliedDate || "",
        status: appData.status || ""
      };

      setTenantData(tenantInfo);

      // Fetch property details if propertyId exists
      if (tenantInfo.propertyId) {
        await loadPropertyDetails(tenantInfo.propertyId);
      }

      // Find unit document
      if (tenantInfo.unitId && tenantInfo.propertyId) {
        const unitDocInfo = await findUnitDocument(tenantInfo.unitId, tenantInfo.propertyId);
        if (unitDocInfo) {
          setUnitRef(unitDocInfo.ref);
          setUnitDetails(unitDocInfo.data);
          
          // Update tenant data with unit information
          setTenantData(prev => ({
            ...prev,
            unitNumber: unitDocInfo.data.unitNumber || unitDocInfo.data.unitName || prev.unitNumber || "",
            monthlyRent: unitDocInfo.data.rentAmount || unitDocInfo.data.monthlyRent || prev.monthlyRent || "",
            propertyName: unitDocInfo.data.propertyName || prev.propertyName || ""
          }));
        } else {
          console.warn("Unit document not found, but proceeding with application data");
          // Still update with application data
          setTenantData(prev => ({
            ...prev,
            unitNumber: appData.unitNumber || prev.unitNumber || "",
            monthlyRent: appData.monthlyRent || prev.monthlyRent || "",
            propertyName: appData.propertyName || prev.propertyName || ""
          }));
        }
      }

      // Recalculate total
      calculateTotalMoveInCost(tenantInfo);

    } catch (error) {
      console.error("Error fetching application data:", error);
      setError("Failed to load application data");
    } finally {
      setLoading(false);
    }
  }, [findUnitDocument]);

  // Load property details
  const loadPropertyDetails = useCallback(async (propertyId) => {
    try {
      const propertyRef = doc(db, "properties", propertyId);
      const propertyDoc = await getDoc(propertyRef);
      
      if (propertyDoc.exists()) {
        const propertyData = propertyDoc.data();
        setPropertyDetails(propertyData);
        
        // Update tenant data with property's fee information
        setTenantData(prev => ({
          ...prev,
          securityDeposit: propertyData.securityDeposit || prev.securityDeposit || "",
          applicationFee: propertyData.applicationFee || prev.applicationFee || "",
          petDeposit: propertyData.petDeposit || prev.petDeposit || "",
          leaseTerm: propertyData.leaseTerm || prev.leaseTerm || 12,
          noticePeriod: propertyData.noticePeriod || prev.noticePeriod || 30
        }));
      }
    } catch (error) {
      console.error("Error loading property details:", error);
    }
  }, []);

  // Calculate total move-in cost
  const calculateTotalMoveInCost = (data) => {
    const monthlyRent = parseFloat(data?.monthlyRent || tenantData.monthlyRent) || 0;
    const securityDeposit = parseFloat(data?.securityDeposit || tenantData.securityDeposit) || 0;
    const applicationFee = parseFloat(data?.applicationFee || tenantData.applicationFee) || 0;
    const petDeposit = parseFloat(data?.petDeposit || tenantData.petDeposit) || 0;
    
    const total = monthlyRent + securityDeposit + applicationFee + petDeposit;
    
    setTenantData(prev => ({
      ...prev,
      totalMoveInCost: total
    }));
  };

  useEffect(() => {
    // If we have an application ID, fetch data
    if (applicationId) {
      fetchApplicationData(applicationId);
    } 
    // Fallback to location state or localStorage
    else if (location.state?.prefillData) {
      setApplicationData(location.state.prefillData);
      const prefill = location.state.prefillData;
      setTenantData(prev => ({
        ...prev,
        ...prefill,
        applicationId: prefill.applicationId || ""
      }));
      
      if (prefill.propertyId) {
        loadPropertyDetails(prefill.propertyId);
      }
      if (prefill.unitId && prefill.propertyId) {
        findUnitDocument(prefill.unitId, prefill.propertyId).then(unitDocInfo => {
          if (unitDocInfo) {
            setUnitRef(unitDocInfo.ref);
            setUnitDetails(unitDocInfo.data);
          }
        });
      }
    } else {
      const stored = localStorage.getItem('prefillTenantData');
      if (stored) {
        const prefill = JSON.parse(stored);
        setApplicationData(prefill);
        setTenantData(prev => ({
          ...prev,
          ...prefill,
          applicationId: prefill.applicationId || ""
        }));
        localStorage.removeItem('prefillTenantData');
        
        if (prefill.propertyId) {
          loadPropertyDetails(prefill.propertyId);
        }
        if (prefill.unitId && prefill.propertyId) {
          findUnitDocument(prefill.unitId, prefill.propertyId).then(unitDocInfo => {
            if (unitDocInfo) {
              setUnitRef(unitDocInfo.ref);
              setUnitDetails(unitDocInfo.data);
            }
          });
        }
      }
    }
  }, [applicationId, location.state, fetchApplicationData, loadPropertyDetails, findUnitDocument]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  // Format date from Firestore Timestamp or string
  const formatDate = (dateInput) => {
    if (!dateInput) return "Not specified";
    
    try {
      let date;
      
      // Handle Firestore Timestamp (from Flutter)
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
      console.error("Date formatting error:", error);
      return "Date error";
    }
  };

  // Format timestamp (for applied date)
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "Not specified";
    
    try {
      if (timestamp.toDate) {
        const date = timestamp.toDate();
        return date.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      return formatDate(timestamp);
    } catch (error) {
      return "Date error";
    }
  };

  // Handle approve tenant - FIXED VERSION
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

      // Check if unit exists and is available
      if (unitRef) {
        const unitDoc = await getDoc(unitRef);
        if (unitDoc.exists()) {
          const unitData = unitDoc.data();
          if (unitData.status === "occupied") {
            alert("This unit is already occupied. Please select another unit.");
            setLoading(false);
            return;
          }
        }
      }

      // FIXED: Handle lease dates from Flutter (Firestore Timestamps)
      let leaseStartDate = Timestamp.now();
      let leaseEndDate = null;
      
      // If leaseStart is a Firestore Timestamp (from Flutter)
      if (tenantData.leaseStart && tenantData.leaseStart.toDate) {
        leaseStartDate = tenantData.leaseStart;
      } 
      // If leaseStart is a string
      else if (tenantData.leaseStart && typeof tenantData.leaseStart === 'string') {
        const date = new Date(tenantData.leaseStart);
        if (!isNaN(date.getTime())) {
          leaseStartDate = Timestamp.fromDate(date);
        }
      }
      
      // If leaseEnd is a Firestore Timestamp (from Flutter)
      if (tenantData.leaseEnd && tenantData.leaseEnd.toDate) {
        leaseEndDate = tenantData.leaseEnd;
      } 
      // If leaseEnd is a string
      else if (tenantData.leaseEnd && typeof tenantData.leaseEnd === 'string') {
        const date = new Date(tenantData.leaseEnd);
        if (!isNaN(date.getTime())) {
          leaseEndDate = Timestamp.fromDate(date);
        }
      }
      
      // If no leaseEnd but we have leaseTerm, calculate it
      if (!leaseEndDate && tenantData.leaseTerm) {
        const startDate = leaseStartDate.toDate();
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + parseInt(tenantData.leaseTerm));
        leaseEndDate = Timestamp.fromDate(endDate);
      }

      // Prepare tenant record
      const tenantRecord = {
        // Tenant Information
        fullName: tenantData.fullName,
        email: tenantData.email,
        phone: tenantData.phone,
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
        
        // Lease Information (from mobile app)
        leaseStart: leaseStartDate,
        leaseEnd: leaseEndDate,
        leaseTerm: parseInt(tenantData.leaseTerm) || 12,
        noticePeriod: parseInt(tenantData.noticePeriod) || 30,
        
        // Emergency Contact
        emergencyContactName: tenantData.emergencyContactName,
        emergencyContactPhone: tenantData.emergencyContactPhone,
        emergencyContactRelation: tenantData.emergencyContactRelation,
        
        // Additional Information from mobile app
        tenantNotes: tenantData.tenantNotes,
        applicationNotes: applicationData?.description || applicationData?.notes || "",
        
        // Pet Information from mobile app
        hasPet: applicationData?.hasPet || false,
        petInfo: applicationData?.petInfo || {},
        petDetails: applicationData?.petDetails || null,
        
        // Status & Timestamps
        status: "active",
        balance: parseFloat(tenantData.monthlyRent) || 0,
        paymentStatus: "pending",
        createdAt: Timestamp.now(),
        approvedAt: Timestamp.now(),
        createdBy: "admin",
        applicationId: tenantData.applicationId,
        
        // Application Source
        applicationSource: "mobile_app",
        
        // Property Fee References
        propertyFees: {
          latePaymentFee: propertyDetails?.latePaymentFee || 0,
          gracePeriod: propertyDetails?.gracePeriod || 5,
          feeDetails: propertyDetails?.feeDetails || {}
        },
        
        // Additional data from Flutter app
        propertyAddress: applicationData?.propertyAddress || "",
        propertyCity: applicationData?.propertyCity || "",
        unitType: applicationData?.unitType || "",
        unitBedrooms: applicationData?.bedrooms || applicationData?.unitBedrooms || 1,
        unitBathrooms: applicationData?.bathrooms || applicationData?.unitBathrooms || 1,
        unitSize: applicationData?.unitSize || "",
        
        // Original application data for reference
        originalApplication: {
          submittedAt: applicationData?.submittedAt || Timestamp.now(),
          totalFees: applicationData?.totalFees || tenantData.totalMoveInCost,
          otherFees: applicationData?.otherFees || ""
        }
      };

      // Save tenant to Firestore
      const tenantRef = await addDoc(collection(db, "tenants"), tenantRecord);

      // Update unit status if unit document exists
      if (unitRef) {
        try {
          await updateDoc(unitRef, {
            status: "occupied",
            tenantId: tenantRef.id,
            tenantName: tenantData.fullName,
            occupiedAt: Timestamp.now(),
            rentAmount: parseFloat(tenantData.monthlyRent) || 0,
            lastRentIncrease: Timestamp.now()
          });
          console.log("Unit status updated successfully");
        } catch (updateError) {
          console.warn("Could not update unit status:", updateError.message);
          // Continue even if unit update fails
        }
      } else {
        console.warn("No unit reference found, skipping unit status update");
      }

      // Update application status
      if (tenantData.applicationId) {
        await updateDoc(doc(db, "tenantApplications", tenantData.applicationId), {
          status: "approved",
          processedAt: Timestamp.now(),
          tenantId: tenantRef.id,
          approvedBy: "admin",
          approvedDate: Timestamp.now()
        });
      }

      alert("✅ Tenant application approved successfully!");
      navigate("/tenants");
      
    } catch (error) {
      console.error("Error approving tenant:", error);
      alert("Failed to approve tenant application. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="tenant-form-container">
        <div className="tenant-form-content">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading application data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="tenant-form-container">
        <div className="tenant-form-content">
          <div className="error-state">
            <FaExclamationTriangle className="error-icon" />
            <h2>Error Loading Application</h2>
            <p>{error}</p>
            <button 
              className="tenant-form-view-tenants-btn" 
              onClick={() => navigate("/applications")}
            >
              Back to Applications
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If no application data
  if (!applicationData && !tenantData.applicationId) {
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
            <FaEye /> Viewing application #{tenantData.applicationId || "N/A"}
          </div>
          {tenantData.appliedDate && (
            <div className="tenant-form-applied-date">
              Applied on: {formatTimestamp(tenantData.appliedDate)}
            </div>
          )}
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
          
          {/* Section 1: Tenant Information */}
          <div className="tenant-form-section">
            <h2 className="tenant-form-section-title"><FaUser /> Tenant Information</h2>
            <div className="tenant-form-grid">
              {[
                { label: "Full Name", value: tenantData.fullName, required: true },
                { label: "Email Address", value: tenantData.email, required: true },
                { label: "Phone Number", value: tenantData.phone, required: true },
                { label: "ID/Passport Number", value: tenantData.idNumber || "Not provided" },
                { label: "Occupation", value: tenantData.occupation || "Not provided" },
                { label: "Employer", value: tenantData.employer || "Not provided" },
              ].map((field, index) => (
                <div className="tenant-form-group" key={index}>
                  <label className="tenant-form-label">
                    {field.label} {field.required && <span className="required">*</span>}
                  </label>
                  <div className="tenant-form-input tenant-form-readonly">
                    <FaLock /> {field.value || "Not provided"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Property & Unit Selected */}
          <div className="tenant-form-section">
            <h2 className="tenant-form-section-title"><FaHome /> Property & Unit Selected</h2>
            
            <div className="tenant-form-grid">
              <div className="tenant-form-group">
                <label className="tenant-form-label">Selected Property</label>
                <div className="tenant-form-input tenant-form-readonly">
                  <FaLock /> {tenantData.propertyName || "Not selected"}
                </div>
                {tenantData.propertyId && (
                  <small className="tenant-form-helper-text">
                    Property ID: {tenantData.propertyId}
                  </small>
                )}
              </div>
              
              <div className="tenant-form-group">
                <label className="tenant-form-label">Selected Unit</label>
                <div className="tenant-form-input tenant-form-readonly">
                  <FaLock /> {tenantData.unitNumber || "Not selected"}
                  {tenantData.monthlyRent && ` • ${formatCurrency(tenantData.monthlyRent)}/month`}
                </div>
                {tenantData.unitId && (
                  <small className="tenant-form-helper-text">
                    Unit ID: {tenantData.unitId}
                    {!unitRef && " (Unit document not found in database)"}
                  </small>
                )}
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
                  <div className="tenant-form-fee-item">
                    <span className="tenant-form-fee-label">Notice Period:</span>
                    <span className="tenant-form-fee-value">{propertyDetails.noticePeriod || 30} days</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Financial Details */}
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

          {/* Section 4: Lease Period */}
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
              </div>

              <div className="tenant-form-group">
                <label className="tenant-form-label">Notice Period (Days)</label>
                <div className="tenant-form-input tenant-form-readonly">
                  {tenantData.noticePeriod} days
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Emergency Contact */}
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

          {/* Section 6: Additional Information */}
          <div className="tenant-form-section">
            <h2 className="tenant-form-section-title"><FaStickyNote /> Additional Information</h2>
            <div className="tenant-form-grid">
              <div className="tenant-form-group tenant-form-group-full-width">
                <label className="tenant-form-label">Tenant Description / Notes</label>
                <div className="tenant-form-textarea tenant-form-readonly" style={{ minHeight: '100px', padding: '1rem' }}>
                  {tenantData.tenantNotes || "No additional information provided by tenant"}
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="tenant-form-actions">
            <button type="button" className="tenant-form-btn-cancel" onClick={() => navigate("/applications")}>
              <FaTimes /> Back to Applications
            </button>
            <button 
              type="button" 
              className="tenant-form-btn-submit" 
              onClick={handleApproveTenant} 
              disabled={loading}
              title={!unitRef ? "Warning: Unit document not found in database. Tenant will be created but unit status won't be updated." : ""}
            >
              {loading ? (
                <>
                  <span className="tenant-form-spinner-small"></span>
                  Processing...
                </>
              ) : (
                <>
                  <FaCheckCircle /> 
                  {!unitRef ? " Approve (Unit Not Found)" : " Approve Tenant"}
                </>
              )}
            </button>
          </div>
          
          {!unitRef && tenantData.unitId && (
            <div className="tenant-form-warning">
              <FaExclamationTriangle /> 
              <strong>Warning:</strong> Unit document ({tenantData.unitId}) not found in database. 
              The tenant will be created but the unit status will not be updated to "occupied".
              Please manually update the unit status after approval.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddTenant;