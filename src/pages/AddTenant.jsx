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
  where,
  increment
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
  FaExclamationTriangle,
  FaThumbsDown,
  FaArrowRight,
  FaInfoCircle
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
  const [unitRef, setUnitRef] = useState(null);
  
  // Rejection state
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  // Initial state for tenant data
  const initialTenantData = {
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
  };

  // Tenant data state
  const [tenantData, setTenantData] = useState(initialTenantData);

  // Calculate total move-in cost
  const calculateTotalMoveInCost = useCallback(() => {
    const monthlyRent = parseFloat(tenantData.monthlyRent) || 0;
    const securityDeposit = parseFloat(tenantData.securityDeposit) || 0;
    const applicationFee = parseFloat(tenantData.applicationFee) || 0;
    const petDeposit = parseFloat(tenantData.petDeposit) || 0;

    const total = monthlyRent + securityDeposit + applicationFee + petDeposit;

    setTenantData(prev => ({
      ...prev,
      totalMoveInCost: total
    }));
  }, [tenantData.monthlyRent, tenantData.securityDeposit, tenantData.applicationFee, tenantData.petDeposit]);

  // Calculate total whenever financial fields change
  useEffect(() => {
    calculateTotalMoveInCost();
  }, [calculateTotalMoveInCost]);

  // Reset form function
  const resetForm = useCallback(() => {
    setTenantData(initialTenantData);
    setPropertyDetails(null);
    setUnitDetails(null);
    setApplicationData(null);
    setUnitRef(null);
    setRejectionReason("");
    setIsRejecting(false);
    setError(null);
    setApplicationId(null);
    setLoading(false);
    
    localStorage.removeItem('prefillTenantData');
    localStorage.removeItem('currentApplication');
    
    setTimeout(() => {
      navigate("/approved-tenants", { replace: true });
    }, 100);
  }, [initialTenantData, navigate]);

  // Handle cancel
  const handleCancel = () => {
    if (window.confirm("Are you sure you want to cancel? Any unsaved changes will be lost.")) {
      navigate("/applications", { replace: true });
    }
  };

  // FIND UNIT DOCUMENT - FIXED VERSION
  const findUnitDocument = useCallback(async (unitId, propertyId) => {
    if (!unitId || !propertyId) return null;
    
    try {
      // FIRST: Check in property subcollection (properties/{propertyId}/units)
      try {
        const unitDocRef = doc(db, "properties", propertyId, "units", unitId);
        const unitDoc = await getDoc(unitDocRef);
        
        if (unitDoc.exists()) {
          return {
            ref: unitDocRef,
            data: unitDoc.data(),
            collectionType: "property_subcollection"
          };
        }
      } catch (error) {
        console.log("Unit not found in subcollection:", error.message);
      }
      
      // SECOND: Search for unit by unitNumber in property subcollection
      if (tenantData.unitNumber) {
        try {
          const unitsRef = collection(db, `properties/${propertyId}/units`);
          const unitsQuery = query(unitsRef, where("unitNumber", "==", tenantData.unitNumber));
          const querySnapshot = await getDocs(unitsQuery);
          
          if (!querySnapshot.empty) {
            const unitDoc = querySnapshot.docs[0];
            return {
              ref: doc(db, "properties", propertyId, "units", unitDoc.id),
              data: unitDoc.data(),
              collectionType: "property_subcollection_by_unitNumber"
            };
          }
        } catch (error) {
          console.log("Error searching unit by unitNumber:", error.message);
        }
      }
      
      // THIRD: Check separate units collection (legacy fallback)
      try {
        const unitDocRef = doc(db, "units", unitId);
        const unitDoc = await getDoc(unitDocRef);
        
        if (unitDoc.exists()) {
          return {
            ref: unitDocRef,
            data: unitDoc.data(),
            collectionType: "units_legacy"
          };
        }
      } catch (error) {
        console.log("Unit not found in separate collection:", error.message);
      }
      
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
      
      const applicationRef = doc(db, "tenantApplications", appId);
      const applicationDoc = await getDoc(applicationRef);
      
      if (!applicationDoc.exists()) {
        setError("Application not found");
        setLoading(false);
        return;
      }
      
      const appData = applicationDoc.data();
      setApplicationData(appData);
      
      localStorage.setItem('currentApplication', appId);
      
      const tenantInfo = {
        fullName: appData.fullName || appData.name || "",
        email: appData.email || "",
        phone: appData.phone || appData.phoneNumber || "",
        idNumber: appData.idNumber || appData.nationalId || "",
        occupation: appData.occupation || appData.jobTitle || "",
        employer: appData.employer || appData.company || "",
        propertyId: appData.propertyId || appData.selectedPropertyId || "",
        propertyName: appData.propertyName || appData.selectedPropertyName || "",
        unitId: appData.unitId || appData.selectedUnitId || "",
        unitNumber: appData.unitNumber || appData.selectedUnitNumber || "",
        monthlyRent: appData.monthlyRent || appData.rentAmount || "",
        leaseStart: appData.leaseStart,
        leaseEnd: appData.leaseEnd,
        leaseTerm: appData.leaseTerm || appData.preferredLeaseTerm || 12,
        noticePeriod: appData.noticePeriod || 30,
        emergencyContactName: appData.emergencyContactName || appData.emergencyName || "",
        emergencyContactPhone: appData.emergencyContactPhone || appData.emergencyPhone || "",
        emergencyContactRelation: appData.emergencyContactRelation || appData.emergencyRelationship || "",
        tenantNotes: appData.description || appData.notes || appData.additionalInfo || 
                   appData.message || appData.comments || "",
        applicationId: appId,
        appliedDate: appData.createdAt || appData.appliedDate || "",
        status: appData.status || ""
      };

      setTenantData(prev => ({
        ...prev,
        ...tenantInfo
      }));

      if (tenantInfo.propertyId) {
        await loadPropertyDetails(tenantInfo.propertyId);
      }

      if (tenantInfo.unitId && tenantInfo.propertyId) {
        const unitDocInfo = await findUnitDocument(tenantInfo.unitId, tenantInfo.propertyId);
        if (unitDocInfo) {
          setUnitRef(unitDocInfo.ref);
          setUnitDetails(unitDocInfo.data);
          
          setTenantData(prev => ({
            ...prev,
            unitNumber: unitDocInfo.data.unitNumber || unitDocInfo.data.unitName || prev.unitNumber || "",
            monthlyRent: unitDocInfo.data.rentAmount || unitDocInfo.data.monthlyRent || prev.monthlyRent || "",
            propertyName: unitDocInfo.data.propertyName || prev.propertyName || ""
          }));
        } else {
          setTenantData(prev => ({
            ...prev,
            unitNumber: appData.unitNumber || prev.unitNumber || "",
            monthlyRent: appData.monthlyRent || prev.monthlyRent || "",
            propertyName: appData.propertyName || prev.propertyName || ""
          }));
        }
      }

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
        
        setTenantData(prev => ({
          ...prev,
          securityDeposit: propertyData.securityDeposit || prev.securityDeposit || "",
          applicationFee: propertyData.applicationFee || prev.applicationFee || "",
          leaseTerm: propertyData.leaseTerm || prev.leaseTerm || 12,
          noticePeriod: propertyData.noticePeriod || prev.noticePeriod || 30
        }));
      }
    } catch (error) {
      console.error("Error loading property details:", error);
    }
  }, []);

  // Update property unit counts
  const updatePropertyUnitCounts = async (propertyId) => {
    try {
      // Fetch all units for this property to recalculate counts
      const unitsRef = collection(db, `properties/${propertyId}/units`);
      const unitsSnapshot = await getDocs(unitsRef);
      
      let vacantCount = 0;
      let leasedCount = 0;
      let maintenanceCount = 0;
      
      unitsSnapshot.forEach((doc) => {
        const unit = doc.data();
        const status = unit.status?.toLowerCase() || "vacant";
        
        if (status === "vacant") vacantCount++;
        else if (status === "leased") leasedCount++;
        else if (status === "maintenance") maintenanceCount++;
      });
      
      const totalUnits = unitsSnapshot.size;
      const occupancyRate = totalUnits > 0 ? Math.round((leasedCount / totalUnits) * 100) : 0;
      
      const propertyRef = doc(db, "properties", propertyId);
      await updateDoc(propertyRef, {
        "unitDetails.vacantCount": vacantCount,
        "unitDetails.leasedCount": leasedCount,
        "unitDetails.maintenanceCount": maintenanceCount,
        "unitDetails.occupancyRate": occupancyRate,
        "unitDetails.totalUnits": totalUnits,
        updatedAt: new Date()
      });
      
      console.log("Updated property counts:", { vacantCount, leasedCount, maintenanceCount, occupancyRate });
      
    } catch (error) {
      console.error("Error updating property counts:", error);
    }
  };

  useEffect(() => {
    const savedAppId = localStorage.getItem('currentApplication');
    const appIdToUse = applicationId || savedAppId;
    
    if (appIdToUse) {
      fetchApplicationData(appIdToUse);
    } else if (location.state?.prefillData) {
      const prefill = location.state.prefillData;
      setApplicationData(prefill);
      
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
            
            setTenantData(prev => ({
              ...prev,
              unitNumber: unitDocInfo.data.unitNumber || unitDocInfo.data.unitName || prev.unitNumber || "",
              monthlyRent: unitDocInfo.data.rentAmount || unitDocInfo.data.monthlyRent || prev.monthlyRent || "",
              propertyName: unitDocInfo.data.propertyName || prev.propertyName || ""
            }));
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
              
              setTenantData(prev => ({
                ...prev,
                unitNumber: unitDocInfo.data.unitNumber || unitDocInfo.data.unitName || prev.unitNumber || "",
                monthlyRent: unitDocInfo.data.rentAmount || unitDocInfo.data.monthlyRent || prev.monthlyRent || "",
                propertyName: unitDocInfo.data.propertyName || prev.propertyName || ""
              }));
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

  // Format date
  const formatDate = (dateInput) => {
    if (!dateInput) return "Not specified";
    
    try {
      let date;
      
      if (dateInput.toDate) {
        date = dateInput.toDate();
      } else if (typeof dateInput === 'string') {
        date = new Date(dateInput);
      } else if (dateInput instanceof Date) {
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

  // Format timestamp
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

  // Reject handler
  const handleRejectClick = () => {
    const reason = window.prompt("Please provide a reason for rejecting this application:", "");
    
    if (reason === null) {
      return;
    }
    
    if (!reason.trim()) {
      alert("Please provide a rejection reason");
      return;
    }

    if (window.confirm("Are you sure you want to reject this application?")) {
      handleRejectApplication(reason.trim());
    }
  };

  // Handle reject application
  const handleRejectApplication = async (reason) => {
    try {
      setIsRejecting(true);
      
      if (tenantData.applicationId) {
        await updateDoc(doc(db, "tenantApplications", tenantData.applicationId), {
          status: "rejected",
          rejectedAt: Timestamp.now(),
          rejectedBy: "admin",
          rejectionReason: reason,
          reviewedAt: Timestamp.now()
        });
      }

      alert("Application rejected successfully!");
      navigate("/applications", { replace: true });
      
    } catch (error) {
      console.error("Error rejecting application:", error);
      alert("Failed to reject application. Please try again.");
    } finally {
      setIsRejecting(false);
    }
  };

  // Handle approve tenant - FIXED VERSION
  const handleApproveTenant = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!tenantData.fullName || !tenantData.email || !tenantData.propertyId || !tenantData.unitId) {
        alert("Missing required tenant information");
        setLoading(false);
        return;
      }

      // Check if unit is already leased
      if (unitRef) {
        const unitDoc = await getDoc(unitRef);
        if (unitDoc.exists()) {
          const unitData = unitDoc.data();
          if (unitData.status === "leased") {
            alert("This unit is already leased to another tenant. Please select another unit.");
            setLoading(false);
            return;
          }
        }
      }

      let leaseStartDate = Timestamp.now();
      let leaseEndDate = null;
      
      if (tenantData.leaseStart && tenantData.leaseStart.toDate) {
        leaseStartDate = tenantData.leaseStart;
      } else if (tenantData.leaseStart && typeof tenantData.leaseStart === 'string') {
        const date = new Date(tenantData.leaseStart);
        if (!isNaN(date.getTime())) {
          leaseStartDate = Timestamp.fromDate(date);
        }
      }
      
      if (tenantData.leaseEnd && tenantData.leaseEnd.toDate) {
        leaseEndDate = tenantData.leaseEnd;
      } else if (tenantData.leaseEnd && typeof tenantData.leaseEnd === 'string') {
        const date = new Date(tenantData.leaseEnd);
        if (!isNaN(date.getTime())) {
          leaseEndDate = Timestamp.fromDate(date);
        }
      }
      
      if (!leaseEndDate && tenantData.leaseTerm) {
        const startDate = leaseStartDate.toDate();
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + parseInt(tenantData.leaseTerm));
        leaseEndDate = Timestamp.fromDate(endDate);
      }

      const tenantRecord = {
        fullName: tenantData.fullName,
        email: tenantData.email,
        phone: tenantData.phone,
        idNumber: tenantData.idNumber,
        occupation: tenantData.occupation,
        employer: tenantData.employer,
        propertyId: tenantData.propertyId,
        unitId: tenantData.unitId,
        propertyName: tenantData.propertyName || propertyDetails?.name || "",
        unitNumber: tenantData.unitNumber || "",
        monthlyRent: parseFloat(tenantData.monthlyRent) || 0,
        securityDeposit: parseFloat(tenantData.securityDeposit) || 0,
        applicationFee: parseFloat(tenantData.applicationFee) || 0,
        petDeposit: parseFloat(tenantData.petDeposit) || 0,
        totalMoveInCost: tenantData.totalMoveInCost || 0,
        leaseStart: leaseStartDate,
        leaseEnd: leaseEndDate,
        leaseTerm: parseInt(tenantData.leaseTerm) || 12,
        noticePeriod: parseInt(tenantData.noticePeriod) || 30,
        emergencyContactName: tenantData.emergencyContactName,
        emergencyContactPhone: tenantData.emergencyContactPhone,
        emergencyContactRelation: tenantData.emergencyContactRelation,
        tenantNotes: tenantData.tenantNotes,
        applicationNotes: applicationData?.description || applicationData?.notes || "",
        hasPet: applicationData?.hasPet || false,
        petInfo: applicationData?.petInfo || {},
        petDetails: applicationData?.petDetails || null,
        status: "approved_pending_payment",
        balance: parseFloat(tenantData.monthlyRent) || 0,
        paymentStatus: "initial_fees_pending",
        createdAt: Timestamp.now(),
        approvedAt: Timestamp.now(),
        createdBy: "admin",
        applicationId: tenantData.applicationId,
        applicationSource: "mobile_app",
        propertyFees: {
          latePaymentFee: propertyDetails?.latePaymentFee || 0,
          gracePeriod: propertyDetails?.gracePeriod || 5,
          feeDetails: propertyDetails?.feeDetails || {}
        },
        propertyAddress: applicationData?.propertyAddress || "",
        propertyCity: applicationData?.propertyCity || "",
        unitType: applicationData?.unitType || "",
        unitBedrooms: applicationData?.bedrooms || applicationData?.unitBedrooms || 1,
        unitBathrooms: applicationData?.bathrooms || applicationData?.unitBathrooms || 1,
        unitSize: applicationData?.unitSize || "",
        originalApplication: {
          submittedAt: applicationData?.submittedAt || Timestamp.now(),
          totalFees: tenantData.totalMoveInCost,
          otherFees: applicationData?.otherFees || ""
        }
      };

      const tenantRef = await addDoc(collection(db, "tenants"), tenantRecord);

      // UPDATE UNIT STATUS - FIXED
      if (unitRef) {
        try {
          await updateDoc(unitRef, {
            status: "leased", // CHANGED FROM "occupied" TO "leased"
            tenantId: tenantRef.id,
            tenantName: tenantData.fullName,
            tenantEmail: tenantData.email,
            tenantPhone: tenantData.phone,
            leaseStart: leaseStartDate,
            leaseEnd: leaseEndDate,
            occupiedAt: Timestamp.now(),
            rentAmount: parseFloat(tenantData.monthlyRent) || 0,
            lastRentIncrease: Timestamp.now(),
            updatedAt: Timestamp.now()
          });
          
          // Update property unit counts
          await updatePropertyUnitCounts(tenantData.propertyId);
          
        } catch (updateError) {
          console.error("Error updating unit status:", updateError);
          alert("Tenant created but unit status update failed. Please update manually.");
        }
      } else {
        console.warn("Unit reference not found, unit status not updated");
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

      alert("✅ Tenant application approved! Tenant now appears in 'Approved Tenants' page.");
      resetForm();
      
    } catch (error) {
      console.error("Error approving tenant:", error);
      alert("Failed to approve tenant application. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading && !applicationData) {
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
            onClick={handleCancel}
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

          {/* FORM ACTIONS */}
          <div className="tenant-form-actions">
            <div className="tenant-form-buttons-row">
              <button 
                type="button" 
                className="tenant-form-btn-cancel" 
                onClick={handleCancel}
                disabled={loading || isRejecting}
              >
                <FaTimes /> Cancel
              </button>
              
              <div className="tenant-form-button-group">
                <button 
                  type="button" 
                  className="tenant-form-btn-danger"
                  onClick={handleRejectClick}
                  disabled={loading || isRejecting}
                >
                  {isRejecting ? (
                    <>
                      <span className="tenant-form-spinner-small"></span>
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <FaThumbsDown /> Reject
                    </>
                  )}
                </button>
                
                <button 
                  type="button" 
                  className="tenant-form-btn-submit" 
                  onClick={handleApproveTenant} 
                  disabled={loading || isRejecting}
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
                      {!unitRef ? " Approve (Unit Not Found)" : " Approve & Send to Payment"}
                    </>
                  )}
                </button>
              </div>
            </div>
            
            <div className="tenant-form-info-row">
              <div className="tenant-form-info-box">
                <FaInfoCircle />
                <div className="tenant-form-info-box-content">
                  <p>
                    <strong>After approval:</strong> Tenant will appear in "Approved Tenants" page. 
                    They need to pay initial fees first.
                  </p>
                  <button 
                    className="tenant-form-view-approved-link"
                    onClick={() => navigate("/approved-tenants")}
                  >
                    View Approved Tenants <FaArrowRight />
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {!unitRef && tenantData.unitId && (
            <div className="tenant-form-warning">
              <FaExclamationTriangle /> 
              <strong>Warning:</strong> Unit document ({tenantData.unitId}) not found in database. 
              The tenant will be created but the unit status will not be updated to "leased".
              Please manually update the unit status after approval.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddTenant;