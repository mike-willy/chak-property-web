// src/pages/AddTenant.jsx - ENHANCED VERSION WITH PET FEE HANDLING
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
  writeBatch
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
  FaInfoCircle,
  FaExclamationCircle,
  FaTrash,
  FaPaw
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
    const params = new URLSearchParams(location.search);
    return params.get('applicationId') || null;
  });

  const [loading, setLoading] = useState(false);
  const [propertyDetails, setPropertyDetails] = useState(null);
  const [unitDetails, setUnitDetails] = useState(null);
  const [applicationData, setApplicationData] = useState(null);
  const [error, setError] = useState(null);
  const [unitRef, setUnitRef] = useState(null);

  // Enhanced states
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [competingApplications, setCompetingApplications] = useState([]);
  const [showCompetingWarning, setShowCompetingWarning] = useState(false);
  const [petFee, setPetFee] = useState(0);
  const [hasPet, setHasPet] = useState(false);
  const [petDetails, setPetDetails] = useState(null);

  // Initial state for tenant data
  const initialTenantData = {
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
    status: ""
  };

  // Tenant data state
  const [tenantData, setTenantData] = useState(initialTenantData);

  // Calculate total move-in cost
  // Helper to resolve financials with priority: Property Pricing > Unit Data > Application Data
  const resolveFinancials = useCallback((appData, propertyData, unitData) => {
    let resolvedRent = appData?.monthlyRent || appData?.rentAmount || appData?.price || "";
    let resolvedSecurityDeposit = appData?.securityDeposit || appData?.deposit || "";
    let resolvedPetDeposit = appData?.petDeposit || appData?.petFee || "";

    if (propertyData) {
      // Check property pricing based on unit type or bedroom count
      const unitType = unitData?.propertyType || unitData?.unitType || appData?.unitType || propertyData.propertyType;
      const unitBedrooms = unitData?.bedrooms || unitData?.unitBedrooms || appData?.unitBedrooms || 0;

      let propertyPrice = propertyData.rentAmount;
      if (propertyData.pricing) {
        if (unitType === 'single') propertyPrice = propertyData.pricing.single;
        else if (unitType === 'bedsitter') propertyPrice = propertyData.pricing.bedsitter;
        else if (unitType === 'one-bedroom' || unitBedrooms === 1) propertyPrice = propertyData.pricing.oneBedroom;
        else if (unitType === 'two-bedroom' || unitBedrooms === 2) propertyPrice = propertyData.pricing.twoBedroom;
        else if (unitType === 'three-bedroom' || unitBedrooms === 3) propertyPrice = propertyData.pricing.threeBedroom;
      }

      resolvedRent = propertyPrice || unitData?.rentAmount || unitData?.monthlyRent || resolvedRent;
      resolvedSecurityDeposit = propertyData.securityDeposit || propertyData.deposit || unitData?.securityDeposit || unitData?.deposit || resolvedSecurityDeposit;
      resolvedPetDeposit = propertyData.petDeposit || propertyData.petFee || propertyData.petSecurityDeposit || unitData?.petDeposit || unitData?.petFee || resolvedPetDeposit;
    }

    return {
      monthlyRent: resolvedRent,
      securityDeposit: resolvedSecurityDeposit,
      petDeposit: resolvedPetDeposit
    };
  }, []);

  const calculateTotalMoveInCost = useCallback(() => {
    const monthlyRent = parseFloat(tenantData.monthlyRent) || 0;
    const securityDeposit = parseFloat(tenantData.securityDeposit) || 0;
    const applicationFee = parseFloat(tenantData.applicationFee) || 0;
    const currentPetDeposit = parseFloat(tenantData.petDeposit) || 0;

    // The pet deposit should be 0 if hasPet is false
    const effectivePetDeposit = hasPet ? currentPetDeposit : 0;

    const total = monthlyRent + securityDeposit + applicationFee + effectivePetDeposit;

    setTenantData(prev => {
      // Avoid unnecessary updates if total hasn't changed
      if (prev.totalMoveInCost === total && prev.petDeposit === effectivePetDeposit) {
        return prev;
      }
      return {
        ...prev,
        totalMoveInCost: total,
        petDeposit: effectivePetDeposit
      };
    });
  }, [tenantData.monthlyRent, tenantData.securityDeposit, tenantData.applicationFee, tenantData.petDeposit, hasPet]);

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
    setShowRejectionForm(false);
    setError(null);
    setApplicationId(null);
    setLoading(false);
    setCompetingApplications([]);
    setShowCompetingWarning(false);
    setPetFee(0);
    setHasPet(false);
    setPetDetails(null);

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

  // FIND UNIT DOCUMENT
  const findUnitDocument = useCallback(async (unitId, propertyId) => {
    if (!unitId || !propertyId) return null;

    try {
      // Check in property subcollection
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

      // Search for unit by unitNumber
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

      // Check separate units collection
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

  // Fetch pet fee from property settings
  const fetchPetFee = useCallback(async (propertyId) => {
    if (!propertyId) return 0;

    try {
      const propertyRef = doc(db, "properties", propertyId);
      const propertyDoc = await getDoc(propertyRef);

      if (propertyDoc.exists()) {
        const propertyData = propertyDoc.data();

        // Check for pet fee in property data
        const petFeeFromProperty = propertyData.petDeposit ||
          propertyData.petFee ||
          propertyData.petSecurityDeposit ||
          (propertyData.propertyFees && propertyData.propertyFees.petDeposit) ||
          0;

        return parseFloat(petFeeFromProperty) || 0;
      }
    } catch (error) {
      console.error("Error fetching pet fee:", error);
    }

    return 0;
  }, []);

  // Check if applicant has pet and get pet details - STRICT VERSION
  const checkPetInformation = useCallback((appData) => {
    if (!appData) return { hasPet: false, petDetails: null };

    // 1. Check explicit boolean or string flags
    const hasPetFlag = appData.hasPet === true ||
      appData.hasPet === 'true' ||
      appData.hasPet === 'Yes' ||
      appData.hasPets === true ||
      appData.hasPets === 'true' ||
      appData.hasPets === 'Yes';

    // 2. Check for non-empty pet information objects
    // Function to check if an object has at least one non-empty value
    const hasContent = (obj) => {
      if (!obj || typeof obj !== 'object') return false;
      return Object.values(obj).some(val => val && val !== "" && val !== "None" && val !== "none");
    };

    const hasValidPetInfo = hasContent(appData.petInfo);
    const hasValidPetDetails = hasContent(appData.petDetails);

    // The tenant has a pet only if they explicitly said so OR provided actual details
    const isActuallyHasPet = hasPetFlag || hasValidPetInfo || hasValidPetDetails;

    let petDetailsInfo = null;
    if (hasValidPetDetails) {
      petDetailsInfo = appData.petDetails;
    } else if (hasValidPetInfo) {
      petDetailsInfo = appData.petInfo;
    }

    return {
      hasPet: isActuallyHasPet,
      petDetails: petDetailsInfo
    };
  }, []);

  // Fetch competing applications for the same unit
  const fetchCompetingApplications = useCallback(async (propertyId, unitId, excludeAppId) => {
    if (!propertyId || !unitId) return [];

    try {
      const appsRef = collection(db, "tenantApplications");
      const appsQuery = query(
        appsRef,
        where("propertyId", "==", propertyId),
        where("unitId", "==", unitId),
        where("status", "==", "pending")
      );

      const querySnapshot = await getDocs(appsQuery);
      const competingApps = [];

      querySnapshot.forEach((docSnap) => {
        const appData = docSnap.data();
        if (docSnap.id !== excludeAppId) {
          competingApps.push({
            id: docSnap.id,
            ...appData,
            appliedDate: appData.appliedDate?.toDate?.() || null
          });
        }
      });

      return competingApps;
    } catch (error) {
      console.error("Error fetching competing applications:", error);
      return [];
    }
  }, []);

  // Auto-reject competing applications
  const autoRejectCompetingApplications = async (approvedApplicationId, reason = "Another applicant was approved for this unit") => {
    try {
      const competingApps = await fetchCompetingApplications(
        tenantData.propertyId,
        tenantData.unitId,
        approvedApplicationId
      );

      if (competingApps.length === 0) return 0;

      const batch = writeBatch(db);
      const now = Timestamp.now();

      competingApps.forEach(app => {
        const appRef = doc(db, "tenantApplications", app.id);
        batch.update(appRef, {
          status: "rejected",
          rejectedAt: now,
          rejectedBy: "system_auto_reject",
          rejectionReason: reason,
          reviewedAt: now,
          autoRejectedDueTo: approvedApplicationId
        });
      });

      await batch.commit();
      console.log(`Auto-rejected ${competingApps.length} competing applications`);
      return competingApps.length;
    } catch (error) {
      console.error("Error auto-rejecting competing applications:", error);
      return 0;
    }
  };

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

      // Check for pet information
      const petInfo = checkPetInformation(appData);
      setHasPet(petInfo.hasPet);
      setPetDetails(petInfo.petDetails);

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
        monthlyRent: appData.monthlyRent || appData.rentAmount || appData.price || "",
        securityDeposit: appData.securityDeposit || appData.deposit || "",
        applicationFee: appData.applicationFee || "",
        petDeposit: appData.petDeposit || appData.petFee || "",
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

      // Load property details and pet fee
      let propertyData = null;
      if (tenantInfo.propertyId) {
        propertyData = await loadPropertyDetails(tenantInfo.propertyId);

        // Fetch pet fee
        const propertyPetFee = await fetchPetFee(tenantInfo.propertyId);
        setPetFee(propertyPetFee);

        // If applicant has pet, update pet deposit with property's pet fee
        if (petInfo.hasPet && propertyPetFee > 0) {
          setTenantData(prev => ({
            ...prev,
            petDeposit: propertyPetFee
          }));
        }
      }

      // Load competing applications
      if (tenantInfo.propertyId && tenantInfo.unitId) {
        const competingApps = await fetchCompetingApplications(
          tenantInfo.propertyId,
          tenantInfo.unitId,
          appId
        );
        setCompetingApplications(competingApps);
        setShowCompetingWarning(competingApps.length > 0);
      }

      if (tenantInfo.unitId && tenantInfo.propertyId) {
        const unitDocInfo = await findUnitDocument(tenantInfo.unitId, tenantInfo.propertyId);

        // RESOLVE CORRECT FINANCIALS
        const resolved = resolveFinancials(appData, propertyData, unitDocInfo?.data);

        if (unitDocInfo) {
          setUnitRef(unitDocInfo.ref);
          setUnitDetails(unitDocInfo.data);

          setTenantData(prev => ({
            ...prev,
            unitNumber: unitDocInfo.data.unitNumber || unitDocInfo.data.unitName || prev.unitNumber || "",
            monthlyRent: resolved.monthlyRent || "",
            securityDeposit: resolved.securityDeposit || "",
            petDeposit: petInfo.hasPet ? (resolved.petDeposit || prev.petDeposit || 0) : 0,
            propertyName: unitDocInfo.data.propertyName || prev.propertyName || ""
          }));
        } else {
          setTenantData(prev => ({
            ...prev,
            unitNumber: prev.unitNumber || appData.unitNumber || "",
            monthlyRent: resolved.monthlyRent || "",
            securityDeposit: resolved.securityDeposit || "",
            petDeposit: petInfo.hasPet ? (resolved.petDeposit || prev.petDeposit || 0) : 0,
            propertyName: prev.propertyName || appData.propertyName || ""
          }));
        }
      }

    } catch (error) {
      console.error("Error fetching application data:", error);
      setError("Failed to load application data");
    } finally {
      setLoading(false);
    }
  }, [findUnitDocument, fetchCompetingApplications, checkPetInformation, fetchPetFee, resolveFinancials]);

  // Load property details
  const loadPropertyDetails = useCallback(async (propertyId) => {
    try {
      const propertyRef = doc(db, "properties", propertyId);
      const propertyDoc = await getDoc(propertyRef);

      if (propertyDoc.exists()) {
        const propertyData = {
          id: propertyDoc.id,
          ...propertyDoc.data()
        };
        setPropertyDetails(propertyData);

        setTenantData(prev => ({
          ...prev,
          monthlyRent: propertyData.rentAmount || propertyData.price || prev.monthlyRent || "",
          securityDeposit: propertyData.securityDeposit || propertyData.deposit || prev.securityDeposit || "",
          applicationFee: propertyData.applicationFee || prev.applicationFee || "",
          leaseTerm: propertyData.leaseTerm || prev.leaseTerm || 12,
          noticePeriod: propertyData.noticePeriod || prev.noticePeriod || 30,
          // Set pet deposit if property has pet fee setting and it's not already set
          petDeposit: propertyData.petDeposit || propertyData.petFee || propertyData.petSecurityDeposit || prev.petDeposit || 0
        }));

        return propertyData;
      }
    } catch (error) {
      console.error("Error loading property details:", error);
    }
  }, []);

  // Update property unit counts
  const updatePropertyUnitCounts = async (propertyId) => {
    try {
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
        updatedAt: Timestamp.now()
      });

      return { vacantCount, leasedCount, maintenanceCount, occupancyRate, totalUnits };

    } catch (error) {
      console.error("Error updating property counts:", error);
      throw error;
    }
  };

  useEffect(() => {
    const savedAppId = localStorage.getItem('currentApplication');
    const appIdToUse = applicationId || savedAppId;

    if (appIdToUse) {
      fetchApplicationData(appIdToUse);
    } else if (location.state?.prefillData || localStorage.getItem('prefillTenantData')) {
      const loadInitialData = async () => {
        const prefill = location.state?.prefillData || JSON.parse(localStorage.getItem('prefillTenantData'));
        if (!prefill) return;

        setApplicationData(prefill);
        if (localStorage.getItem('prefillTenantData')) localStorage.removeItem('prefillTenantData');

        // Check for pet information
        const petInfo = checkPetInformation(prefill);
        setHasPet(petInfo.hasPet);
        setPetDetails(petInfo.petDetails);

        setTenantData(prev => ({
          ...prev,
          ...prefill,
          applicationId: prefill.applicationId || ""
        }));

        let propertyData = null;
        let unitData = null;

        if (prefill.propertyId) {
          propertyData = await loadPropertyDetails(prefill.propertyId);
          // Fetch pet fee
          const propertyPetFee = await fetchPetFee(prefill.propertyId);
          setPetFee(propertyPetFee);
        }

        if (prefill.unitId && prefill.propertyId) {
          const unitDocInfo = await findUnitDocument(prefill.unitId, prefill.propertyId);
          if (unitDocInfo) {
            setUnitRef(unitDocInfo.ref);
            unitData = unitDocInfo.data;
            setUnitDetails(unitData);
          }
        }

        // Resolve Correct Financials
        const resolved = resolveFinancials(prefill, propertyData, unitData);

        setTenantData(prev => ({
          ...prev,
          monthlyRent: resolved.monthlyRent || prev.monthlyRent || "",
          securityDeposit: resolved.securityDeposit || prev.securityDeposit || "",
          petDeposit: petInfo.hasPet ? (resolved.petDeposit || prev.petDeposit || 0) : 0,
          unitNumber: unitData?.unitNumber || unitData?.unitName || prev.unitNumber || "",
          propertyName: unitData?.propertyName || prev.propertyName || ""
        }));
      };

      loadInitialData();
    }
  }, [applicationId, location.state, fetchApplicationData, loadPropertyDetails, findUnitDocument, checkPetInformation, fetchPetFee, resolveFinancials]);

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

  // Reject handler - Custom form version
  const handleRejectClick = () => {
    setShowRejectionForm(true);
  };

  // Cancel rejection
  const handleCancelRejection = () => {
    setShowRejectionForm(false);
    setRejectionReason("");
  };

  // Confirm rejection
  const handleConfirmRejection = async () => {
    if (!rejectionReason.trim()) {
      alert("Please provide a rejection reason");
      return;
    }

    if (window.confirm(`Are you sure you want to reject ${tenantData.fullName}'s application?`)) {
      await handleRejectApplication(rejectionReason.trim());
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
      setShowRejectionForm(false);
    }
  };

  // Handle approve tenant - ENHANCED VERSION WITH PET FEE
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

      // Show warning for competing applications
      if (competingApplications.length > 0) {
        const confirmMessage = `WARNING: There are ${competingApplications.length} other pending applications for this unit.\n\n` +
          `Approving ${tenantData.fullName} will automatically reject all other applicants for this unit.\n\n` +
          `Do you want to continue?`;

        if (!window.confirm(confirmMessage)) {
          setLoading(false);
          return;
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
        totalMoveInCost: parseFloat(tenantData.totalMoveInCost) || 0,
        leaseStart: leaseStartDate,
        leaseEnd: leaseEndDate,
        leaseTerm: parseInt(tenantData.leaseTerm) || 12,
        noticePeriod: parseInt(tenantData.noticePeriod) || 30,
        emergencyContactName: tenantData.emergencyContactName,
        emergencyContactPhone: tenantData.emergencyContactPhone,
        emergencyContactRelation: tenantData.emergencyContactRelation,
        tenantNotes: tenantData.tenantNotes,
        applicationNotes: applicationData?.description || applicationData?.notes || "",
        hasPet: hasPet,
        petInfo: petDetails || {},
        petDetails: petDetails,
        petFee: parseFloat(tenantData.petDeposit) || 0,
        petFeeApplied: hasPet && (parseFloat(tenantData.petDeposit) > 0),
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
          petDeposit: petFee, // Include pet deposit in property fees
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
          otherFees: applicationData?.otherFees || "",
          petIncluded: hasPet,
          petFee: hasPet ? petFee : 0
        },
        competingApplicationsRejected: competingApplications.length
      };

      const tenantRef = await addDoc(collection(db, "tenants"), tenantRecord);

      // AUTO-REJECT COMPETING APPLICATIONS
      let autoRejectedCount = 0;
      if (competingApplications.length > 0) {
        autoRejectedCount = await autoRejectCompetingApplications(
          tenantData.applicationId,
          `Another applicant (${tenantData.fullName}) was approved for this unit`
        );
      }

      // UPDATE UNIT STATUS
      if (unitRef) {
        try {
          await updateDoc(unitRef, {
            status: "leased",
            tenantId: tenantRef.id,
            tenantName: tenantData.fullName,
            tenantEmail: tenantData.email,
            tenantPhone: tenantData.phone,
            leaseStart: leaseStartDate,
            leaseEnd: leaseEndDate,
            occupiedAt: Timestamp.now(),
            rentAmount: parseFloat(tenantData.monthlyRent) || 0,
            lastRentIncrease: Timestamp.now(),
            updatedAt: Timestamp.now(),
            hasPet: hasPet,
            petDeposit: hasPet ? petFee : 0
          });

          // Update property unit counts
          const propertyCounts = await updatePropertyUnitCounts(tenantData.propertyId);
          console.log("Updated property counts:", propertyCounts);

        } catch (updateError) {
          console.error("Error updating unit status:", updateError);
          alert("Tenant created but unit status update failed. Please update manually.");
        }
      } else {
        console.warn("Unit reference not found, unit status not updated");
      }

      // Update current application status
      if (tenantData.applicationId) {
        await updateDoc(doc(db, "tenantApplications", tenantData.applicationId), {
          status: "approved",
          processedAt: Timestamp.now(),
          tenantId: tenantRef.id,
          approvedBy: "admin",
          approvedDate: Timestamp.now(),
          competingApplicationsRejected: autoRejectedCount,
          petFeeApplied: hasPet ? petFee : 0,
          totalApprovedAmount: tenantData.totalMoveInCost
        });
      }

      // Show success message with details
      const successMessage = `✅ Tenant application approved!\n\n` +
        `• ${tenantData.fullName} added to approved tenants\n` +
        (hasPet ? `• Pet deposit of ${formatCurrency(petFee)} applied\n` : '') +
        (autoRejectedCount > 0
          ? `• Auto-rejected ${autoRejectedCount} other applicant(s) for this unit\n`
          : '') +
        (unitRef
          ? `• Unit status updated to "leased"\n`
          : `• WARNING: Unit status NOT updated (unit document not found)\n`) +
        `\nTenant now appears in 'Approved Tenants' page.`;

      alert(successMessage);
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
        {/* Competing Applications Warning */}
        {showCompetingWarning && competingApplications.length > 0 && (
          <div className="tenant-form-competing-warning">
            <FaExclamationTriangle className="warning-icon" />
            <div className="warning-content">
              <h3>Multiple Applications for This Unit</h3>
              <p>
                There are <strong>{competingApplications.length}</strong> other pending application(s) for this unit.
                Approving this applicant will automatically reject all other applicants for this unit.
              </p>
              <div className="competing-applicants-list">
                {competingApplications.slice(0, 3).map((app, index) => (
                  <div key={app.id} className="competing-applicant-item">
                    <span className="applicant-name">{app.fullName}</span>
                    <span className="applicant-email">{app.email}</span>
                    <span className="applicant-date">Applied: {formatDate(app.appliedDate)}</span>
                  </div>
                ))}
                {competingApplications.length > 3 && (
                  <div className="more-applicants">
                    + {competingApplications.length - 3} more applicant(s)
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pet Information Banner */}
        {hasPet && (
          <div className="tenant-form-pet-info-banner">
            <FaPaw className="pet-icon" />
            <div className="pet-info-content">
              <h3>Pet Information</h3>
              <p>
                This applicant has indicated they have a pet.
                {petFee > 0 ? (
                  <span> A pet deposit of <strong>{formatCurrency(petFee)}</strong> will be added to their move-in costs.</span>
                ) : (
                  <span> No pet deposit is required for this property.</span>
                )}
              </p>
              {petDetails && (
                <div className="pet-details-section">
                  <h4>Pet Details:</h4>
                  {petDetails.petType && <p><strong>Type:</strong> {petDetails.petType}</p>}
                  {petDetails.petBreed && <p><strong>Breed:</strong> {petDetails.petBreed}</p>}
                  {petDetails.petName && <p><strong>Name:</strong> {petDetails.petName}</p>}
                  {petDetails.petAge && <p><strong>Age:</strong> {petDetails.petAge}</p>}
                  {petDetails.petWeight && <p><strong>Weight:</strong> {petDetails.petWeight} kg</p>}
                  {petDetails.vaccinationStatus && <p><strong>Vaccinated:</strong> {petDetails.vaccinationStatus}</p>}
                  {petDetails.notes && <p><strong>Notes:</strong> {petDetails.notes}</p>}
                </div>
              )}
            </div>
          </div>
        )}

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


            {/* Property Fee Information - ENHANCED WITH PET FEE */}
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
                      {petFee > 0 ? formatCurrency(petFee) : "Not allowed"}
                      {!hasPet && petFee > 0 && <small className="fee-conditional"> (if pet)</small>}
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
                  {propertyDetails.allowsPets !== undefined && (
                    <div className="tenant-form-fee-item">
                      <span className="tenant-form-fee-label">Pets Allowed:</span>
                      <span className={`tenant-form-fee-value ${propertyDetails.allowsPets ? 'allowed' : 'not-allowed'}`}>
                        {propertyDetails.allowsPets ? "Yes" : "No"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Financial Details - ENHANCED WITH PET FEE */}
          <div className="tenant-form-section">
            <h2 className="tenant-form-section-title"><FaMoneyBillWave /> Financial Details</h2>

            <div className="tenant-form-grid">
              {[
                { label: "Monthly Rent", value: formatCurrency(tenantData.monthlyRent), show: true },
                { label: "Security Deposit", value: formatCurrency(tenantData.securityDeposit), show: true },
                { label: "Application Fee", value: formatCurrency(tenantData.applicationFee), show: true },
                {
                  label: "Pet Deposit",
                  value: petFee > 0 ? formatCurrency(petFee) : "No pet fee",
                  show: hasPet
                },
              ].filter(field => field.show).map((field, index) => (
                <div className="tenant-form-group" key={index}>
                  <label className="tenant-form-label">{field.label}</label>
                  <div className="tenant-form-input tenant-form-readonly">
                    {field.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Total Move-in Cost - ENHANCED */}
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
                {hasPet && (parseFloat(tenantData.petDeposit) > 0) && (
                  <div className="tenant-form-cost-item pet-fee-item">
                    <span><FaPaw /> Pet Deposit:</span>
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
                {hasPet && (parseFloat(tenantData.petDeposit) > 0) && " (includes pet deposit)"}
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
            {/* Rejection Form Modal */}
            {showRejectionForm && (
              <div className="tenant-form-rejection-modal-overlay">
                <div className="tenant-form-rejection-modal">
                  <h3><FaThumbsDown /> Reject Application</h3>
                  <div className="rejection-form-group">
                    <label className="rejection-form-label">
                      Please provide a reason for rejecting this application:
                      <span className="required">*</span>
                    </label>
                    <textarea
                      className="rejection-reason-textarea"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Enter rejection reason (e.g., insufficient documentation, credit check failed, etc.)"
                      rows={4}
                      autoFocus
                    />
                    <small className="rejection-form-helper">
                      This reason will be visible to the tenant
                    </small>
                  </div>
                  <div className="rejection-form-buttons">
                    <button
                      className="rejection-btn-cancel"
                      onClick={handleCancelRejection}
                      disabled={isRejecting}
                    >
                      Cancel
                    </button>
                    <button
                      className="rejection-btn-confirm"
                      onClick={handleConfirmRejection}
                      disabled={isRejecting || !rejectionReason.trim()}
                    >
                      {isRejecting ? (
                        <>
                          <span className="tenant-form-spinner-small"></span>
                          Rejecting...
                        </>
                      ) : (
                        "Confirm Rejection"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                  <FaThumbsDown /> Reject Application
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
                      {competingApplications.length > 0
                        ? ` Approve & Auto-Reject ${competingApplications.length} Other${competingApplications.length > 1 ? 's' : ''}`
                        : !unitRef ? " Approve (Unit Not Found)" : " Approve & Send to Payment"}
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
                    {hasPet && (parseFloat(tenantData.petDeposit) > 0) && ` Pet deposit of ${formatCurrency(tenantData.petDeposit)} has been included in total move-in costs.`}
                    {competingApplications.length > 0 &&
                      ` Approving will automatically reject ${competingApplications.length} other pending application(s) for this unit.`}
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