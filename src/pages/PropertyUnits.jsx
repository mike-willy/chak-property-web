// src/pages/PropertyUnits.jsx - LOCKED LEASED STATUS VERSION
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, getDocs, updateDoc, deleteDoc } from "firebase/firestore";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { db } from "../pages/firebase/firebase";
import "../styles/PropertyUnits.css";
import {
  FaArrowLeft,
  FaHome,
  FaUser,
  FaPhone,
  FaCalendar,
  FaEdit,
  FaTrash,
  FaPlus,
  FaFilter,
  FaDoorClosed,
  FaCheckCircle,
  FaTools,
  FaDollarSign,
  FaExpand,
  FaUserPlus,
  FaChartLine,
  FaBuilding,
  FaExclamationTriangle,
  FaWrench,
  FaLock,
  FaUserMinus
} from "react-icons/fa";

const PropertyUnits = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState([]);
  const [filter, setFilter] = useState("all");
  const [editingUnit, setEditingUnit] = useState(null);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [showDeleteTenantModal, setShowDeleteTenantModal] = useState(false);
  const [unitToDeleteTenant, setUnitToDeleteTenant] = useState(null);
  const [selectedUnitIndex, setSelectedUnitIndex] = useState(null);

  // Tenant assignment form - UPDATED TO MATCH AddTenant.jsx
  const [tenantForm, setTenantForm] = useState({
    // Personal Information (SAME AS AddTenant.jsx)
    fullName: "",
    email: "",
    phone: "",
    idNumber: "",
    occupation: "",
    employer: "",

    // Financial Information (SAME AS AddTenant.jsx)
    monthlyRent: "",
    securityDeposit: "",
    applicationFee: "",
    petDeposit: "",
    totalMoveInCost: 0,

    // Lease Information (SAME AS AddTenant.jsx)
    leaseStart: "",
    leaseEnd: "",
    leaseTerm: 12,
    noticePeriod: 30,

    // Emergency Contact (SAME AS AddTenant.jsx)
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",

    // Additional Information (SAME AS AddTenant.jsx)
    tenantNotes: "",
  });

  // Calculate total move-in cost
  const calculateTotalMoveInCost = () => {
    // STRICT PET FEE LOGIC: For manual assignment, we rely on the input field
    // If the user enters a pet deposit, we assume they have a pet
    const total = (parseFloat(tenantForm.monthlyRent) || 0) +
      (parseFloat(tenantForm.securityDeposit) || 0) +
      (parseFloat(tenantForm.applicationFee) || 0) +
      (parseFloat(tenantForm.petDeposit) || 0);

    setTenantForm(prev => ({
      ...prev,
      totalMoveInCost: total
    }));
  };

  // Calculate total whenever financial fields change
  useEffect(() => {
    calculateTotalMoveInCost();
  }, [tenantForm.monthlyRent, tenantForm.securityDeposit, tenantForm.applicationFee, tenantForm.petDeposit]);

  // Get unit statuses - DUAL STATUS VERSION
  const getUnitStatuses = (unitData) => {
    // Default values
    let occupancyStatus = "vacant";
    let maintenanceStatus = "normal";
    let displayStatus = "vacant";

    // If unit has new dual-status fields, use them
    if (unitData.occupancyStatus && unitData.maintenanceStatus) {
      occupancyStatus = unitData.occupancyStatus;
      maintenanceStatus = unitData.maintenanceStatus;

      // Calculate display status for backward compatibility
      if (maintenanceStatus === "under_maintenance") {
        displayStatus = "maintenance";
      } else {
        displayStatus = occupancyStatus;
      }
    }
    // Legacy: single status field (for backward compatibility during transition)
    else if (unitData.status) {
      const statusLower = unitData.status.toLowerCase();

      // Map legacy status to new dual status
      if (statusLower === "maintenance" || statusLower === "repair" || statusLower === "under_repair") {
        if (unitData.tenantName || unitData.tenantId) {
          occupancyStatus = "leased";
          maintenanceStatus = "under_maintenance";
        } else {
          occupancyStatus = "vacant";
          maintenanceStatus = "under_maintenance";
        }
        displayStatus = "maintenance";
      }
      else if (statusLower === "leased" || statusLower === "occupied" || statusLower === "rented") {
        occupancyStatus = "leased";
        maintenanceStatus = "normal";
        displayStatus = "leased";
      }
      else {
        occupancyStatus = "vacant";
        maintenanceStatus = "normal";
        displayStatus = "vacant";
      }
    }

    return { occupancyStatus, maintenanceStatus, displayStatus };
  };

  // Calculate unit counts - DUAL STATUS VERSION
  const calculateUnitCounts = (unitsData) => {
    let vacantCount = 0;
    let leasedCount = 0;
    let maintenanceCount = 0;

    unitsData.forEach(unit => {
      const { occupancyStatus, maintenanceStatus } = getUnitStatuses(unit);

      // Count occupancy
      if (occupancyStatus === 'leased') {
        leasedCount++;
      } else {
        vacantCount++;
      }

      // Count maintenance
      if (maintenanceStatus === 'under_maintenance') {
        maintenanceCount++;
      }
    });

    return { vacantCount, leasedCount, maintenanceCount };
  };

  // Fetch property and units
  useEffect(() => {
    fetchPropertyAndUnits();
  }, [id]);

  const fetchPropertyAndUnits = async () => {
    try {
      setLoading(true);
      console.log(`Fetching property ${id}...`);

      const propertyRef = doc(db, "properties", id);
      const propertySnap = await getDoc(propertyRef);

      if (propertySnap.exists()) {
        const propertyData = propertySnap.data();

        // Fetch units from subcollection
        const unitsRef = collection(db, `properties/${id}/units`);
        const unitsSnapshot = await getDocs(unitsRef);
        const unitsData = [];

        unitsSnapshot.forEach((unitDoc) => {
          const unit = {
            id: unitDoc.id,
            ...unitDoc.data()
          };
          unitsData.push(unit);
        });

        // If no units in subcollection, create default units
        if (unitsData.length === 0) {
          const defaultUnits = generateDefaultUnits(propertyData);
          for (const unit of defaultUnits) {
            await addDoc(unitsRef, {
              ...unit,
              propertyId: id,
              occupancyStatus: "vacant", // NEW FIELD
              maintenanceStatus: "normal" // NEW FIELD
            });
          }
          setUnits(defaultUnits.map(u => ({
            ...u,
            occupancyStatus: "vacant",
            maintenanceStatus: "normal"
          })));
        } else {
          setUnits(unitsData);
        }

        // Calculate actual counts from units
        const { vacantCount, leasedCount, maintenanceCount } = calculateUnitCounts(unitsData);
        const totalUnits = unitsData.length || propertyData.units || 1;
        const occupancyRate = totalUnits > 0 ? Math.round((leasedCount / totalUnits) * 100) : 0;

        // Calculate monthly revenue from leased units
        const monthlyRevenue = unitsData
          .filter(u => {
            const { occupancyStatus } = getUnitStatuses(u);
            return occupancyStatus === 'leased';
          })
          .reduce((total, u) => total + (u.rentAmount || 0), 0);

        setProperty({
          id: propertySnap.id,
          ...propertyData,
          unitDetails: {
            totalUnits,
            vacantCount,
            leasedCount,
            maintenanceCount,
            occupancyRate,
            units: unitsData
          },
          monthlyRevenue: monthlyRevenue,
          totalTenants: leasedCount
        });
      } else {
        console.error(`Property ${id} not found in Firestore`);
        alert("Property not found");
        navigate("/properties");
      }
    } catch (error) {
      console.error("Error fetching property:", error);
      alert("Failed to load property details");
    } finally {
      setLoading(false);
    }
  };

  // Generate default units if none exist
  const generateDefaultUnits = (propertyData) => {
    const units = [];
    const propertyPrefix = propertyData.name
      ? propertyData.name.replace(/\s+/g, '').substring(0, 3).toUpperCase()
      : 'APT';

    const totalUnits = propertyData.units || 1;

    for (let i = 1; i <= totalUnits; i++) {
      const unitNumber = i.toString().padStart(3, '0');
      units.push({
        unitId: `${propertyPrefix}-${unitNumber}`,
        unitNumber: unitNumber,
        unitName: `${propertyData.name || 'Property'} - Unit ${unitNumber}`,
        // LEGACY FIELD (for backward compatibility)
        status: "vacant",
        // NEW FIELDS
        occupancyStatus: "vacant",
        maintenanceStatus: "normal",
        rentAmount: propertyData.rentAmount || 0,
        size: propertyData.size || "",
        amenities: propertyData.amenities || [],
        tenantId: null,
        tenantName: "",
        tenantPhone: "",
        tenantEmail: "",
        leaseStart: null,
        leaseEnd: null,
        rentPaidUntil: null,
        deposit: 0,
        notes: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    return units;
  };

  // Update unit status - LOCKED LEASED STATUS VERSION
  const handleStatusUpdate = async (unitIndex, newStatusType, newValue) => {
    try {
      const unit = units[unitIndex];
      const { occupancyStatus } = getUnitStatuses(unit);

      // PREVENT changing occupancy from leased to vacant
      if (newStatusType === "occupancy" && occupancyStatus === "leased" && newValue === "vacant") {
        alert("Cannot change occupancy from 'Leased' to 'Vacant'. You must delete the tenant first.");
        return;
      }

      console.log(`Updating unit ${unit.unitNumber} - ${newStatusType}: ${newValue}`);

      // Determine updates based on what's being changed
      const updates = {
        updatedAt: new Date().toISOString()
      };

      if (newStatusType === "occupancy") {
        updates.occupancyStatus = newValue;

        // Clear tenant info if changing from leased to vacant (this shouldn't happen due to check above, but keep as safety)
        if (unit.occupancyStatus === "leased" && newValue === "vacant") {
          updates.tenantId = null;
          updates.tenantName = "";
          updates.tenantPhone = "";
          updates.tenantEmail = "";
          updates.leaseStart = null;
          updates.leaseEnd = null;
        }

        // Keep legacy status for backward compatibility
        if (unit.maintenanceStatus === "under_maintenance") {
          updates.status = "maintenance";
        } else {
          updates.status = newValue;
        }
      }
      else if (newStatusType === "maintenance") {
        updates.maintenanceStatus = newValue;

        // Keep legacy status for backward compatibility
        if (newValue === "under_maintenance") {
          updates.status = "maintenance";
        } else {
          updates.status = occupancyStatus;
        }
      }

      // Update unit document in subcollection
      const unitRef = doc(db, `properties/${id}/units`, unit.id);
      await updateDoc(unitRef, updates);

      // Update local state
      const updatedUnits = [...units];
      updatedUnits[unitIndex] = {
        ...unit,
        ...updates,
        ...(newStatusType === "occupancy" && { occupancyStatus: newValue }),
        ...(newStatusType === "maintenance" && { maintenanceStatus: newValue })
      };

      // Recalculate counts
      const { vacantCount, leasedCount, maintenanceCount } = calculateUnitCounts(updatedUnits);
      const totalUnits = updatedUnits.length;
      const occupancyRate = totalUnits > 0 ? Math.round((leasedCount / totalUnits) * 100) : 0;

      // Calculate monthly revenue from leased units
      const monthlyRevenue = updatedUnits
        .filter(u => {
          const { occupancyStatus } = getUnitStatuses(u);
          return occupancyStatus === 'leased';
        })
        .reduce((total, u) => total + (u.rentAmount || 0), 0);

      // Update property document with new counts
      const propertyRef = doc(db, "properties", id);
      await updateDoc(propertyRef, {
        "unitDetails.vacantCount": vacantCount,
        "unitDetails.leasedCount": leasedCount,
        "unitDetails.maintenanceCount": maintenanceCount,
        "unitDetails.occupancyRate": occupancyRate,
        "unitDetails.totalUnits": totalUnits,
        monthlyRevenue: monthlyRevenue,
        totalTenants: leasedCount,
        updatedAt: new Date()
      });

      // Update local state
      setUnits(updatedUnits);
      setProperty(prev => ({
        ...prev,
        unitDetails: {
          ...prev.unitDetails,
          vacantCount,
          leasedCount,
          maintenanceCount,
          occupancyRate,
          totalUnits
        },
        monthlyRevenue,
        totalTenants: leasedCount
      }));

      alert(`Unit ${unit.unitNumber} updated successfully`);
    } catch (error) {
      console.error("Error updating unit status:", error);
      alert("Failed to update unit status");
    }
  };

  // Handle delete tenant - NEW FUNCTION
  const handleDeleteTenant = async () => {
    if (!unitToDeleteTenant) return;

    try {
      const { unitIndex, unit } = unitToDeleteTenant;

      // Update unit document in subcollection
      const unitRef = doc(db, `properties/${id}/units`, unit.id);
      await updateDoc(unitRef, {
        occupancyStatus: "vacant",
        maintenanceStatus: unit.maintenanceStatus || "normal",
        status: unit.maintenanceStatus === "under_maintenance" ? "maintenance" : "vacant",
        tenantId: null,
        tenantName: "",
        tenantPhone: "",
        tenantEmail: "",
        leaseStart: null,
        leaseEnd: null,
        updatedAt: new Date().toISOString()
      });

      // Also delete tenant from tenants collection if exists
      if (unit.tenantId) {
        try {
          const tenantRef = doc(db, "tenants", unit.tenantId);
          await deleteDoc(tenantRef);
          console.log("Tenant deleted from tenants collection");
        } catch (tenantError) {
          console.error("Error deleting tenant record:", tenantError);
          // Continue even if tenant deletion fails
        }
      }

      // Update local state
      const updatedUnits = [...units];
      updatedUnits[unitIndex] = {
        ...unit,
        occupancyStatus: "vacant",
        tenantId: null,
        tenantName: "",
        tenantPhone: "",
        tenantEmail: "",
        leaseStart: null,
        leaseEnd: null,
        updatedAt: new Date().toISOString()
      };

      // Recalculate counts
      const { vacantCount, leasedCount, maintenanceCount } = calculateUnitCounts(updatedUnits);
      const totalUnits = updatedUnits.length;
      const occupancyRate = totalUnits > 0 ? Math.round((leasedCount / totalUnits) * 100) : 0;

      // Calculate monthly revenue
      const monthlyRevenue = updatedUnits
        .filter(u => {
          const { occupancyStatus } = getUnitStatuses(u);
          return occupancyStatus === 'leased';
        })
        .reduce((total, u) => total + (u.rentAmount || 0), 0);

      // Update property document with new counts
      const propertyRef = doc(db, "properties", id);
      await updateDoc(propertyRef, {
        "unitDetails.vacantCount": vacantCount,
        "unitDetails.leasedCount": leasedCount,
        "unitDetails.maintenanceCount": maintenanceCount,
        "unitDetails.occupancyRate": occupancyRate,
        "unitDetails.totalUnits": totalUnits,
        monthlyRevenue: monthlyRevenue,
        totalTenants: leasedCount,
        updatedAt: new Date()
      });

      // Update local state
      setUnits(updatedUnits);
      setProperty(prev => ({
        ...prev,
        unitDetails: {
          ...prev.unitDetails,
          vacantCount,
          leasedCount,
          maintenanceCount,
          occupancyRate,
          totalUnits
        },
        monthlyRevenue,
        totalTenants: leasedCount
      }));

      // Close modal and reset
      setShowDeleteTenantModal(false);
      setUnitToDeleteTenant(null);

      alert(`Tenant deleted and unit ${unit.unitNumber} is now vacant`);

    } catch (error) {
      console.error("Error deleting tenant:", error);
      alert("Failed to delete tenant");
    }
  };

  // Helper function to calculate lease end date
  const calculateLeaseEndDate = (startDate, months) => {
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + parseInt(months));
    return date;
  };

  // Handle assign tenant - DUAL STATUS VERSION
  const handleAssignTenant = (unitIndex) => {
    const unit = units[unitIndex];
    const { occupancyStatus } = getUnitStatuses(unit);

    // Check if unit is vacant
    if (occupancyStatus !== "vacant") {
      alert("Cannot assign tenant to a non-vacant unit");
      return;
    }

    setSelectedUnitIndex(unitIndex);

    // Pre-fill form with unit rent amount
    setTenantForm({
      fullName: "",
      email: "",
      phone: "",
      idNumber: "",
      occupation: "",
      employer: "",
      monthlyRent: unit.rentAmount || property?.rentAmount || "",
      securityDeposit: property?.securityDeposit || 0,
      applicationFee: property?.applicationFee || 0,
      petDeposit: 0, // Default to 0 for manual assignment (User must enter manually if pet exists)
      totalMoveInCost: 0,
      leaseStart: new Date().toISOString().split('T')[0],
      leaseEnd: calculateLeaseEndDate(new Date(), 12).toISOString().split('T')[0],
      leaseTerm: 12,
      noticePeriod: 30,
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelation: "",
      tenantNotes: ""
    });

    setShowAssignForm(true);
  };

  // Handle tenant form submit - UPDATED TO MATCH AddTenant.jsx
  const handleTenantSubmit = async (e) => {
    e.preventDefault();

    if (!tenantForm.fullName || !tenantForm.email || !tenantForm.phone) {
      alert("Please fill in tenant name, email and phone number");
      return;
    }

    try {
      const unit = units[selectedUnitIndex];
      let tenantDocId = null;

      // CREATE TENANT DOCUMENT WITH EXACT SAME STRUCTURE AS AddTenant.jsx
      const tenantData = {
        // Personal Information (EXACT MATCH with AddTenant.jsx)
        fullName: tenantForm.fullName.trim(),
        email: tenantForm.email.toLowerCase().trim(),
        phone: tenantForm.phone.trim(),
        idNumber: tenantForm.idNumber.trim(),
        occupation: tenantForm.occupation.trim(),
        employer: tenantForm.employer.trim(),

        // Property & Unit Information (EXACT MATCH)
        propertyId: id,
        unitId: unit.unitId || unit.id,
        propertyName: property?.name || "",
        unitNumber: unit.unitNumber,
        monthlyRent: parseFloat(tenantForm.monthlyRent) || 0,
        propertyAddress: property?.address || "",
        propertyCity: property?.city || "",
        unitType: unit?.unitType || "",
        unitBedrooms: unit?.bedrooms || unit?.unitBedrooms || 1,
        unitBathrooms: unit?.bathrooms || unit?.unitBathrooms || 1,
        unitSize: unit?.size || unit?.unitSize || "",

        // Financial Information (EXACT MATCH)
        securityDeposit: parseFloat(tenantForm.securityDeposit) || 0,
        applicationFee: parseFloat(tenantForm.applicationFee) || 0,
        petDeposit: parseFloat(tenantForm.petDeposit) || 0,
        totalMoveInCost: parseFloat(tenantForm.totalMoveInCost) || 0,
        balance: parseFloat(tenantForm.monthlyRent) || 0,
        paymentStatus: "initial_fees_pending",

        // Lease Information (EXACT MATCH)
        leaseStart: Timestamp.fromDate(new Date(tenantForm.leaseStart || new Date())),
        leaseEnd: Timestamp.fromDate(new Date(tenantForm.leaseEnd || calculateLeaseEndDate(new Date(), tenantForm.leaseTerm))),
        leaseTerm: parseInt(tenantForm.leaseTerm) || 12,
        noticePeriod: parseInt(tenantForm.noticePeriod) || 30,

        // Emergency Contact (EXACT MATCH)
        emergencyContactName: tenantForm.emergencyContactName.trim(),
        emergencyContactPhone: tenantForm.emergencyContactPhone.trim(),
        emergencyContactRelation: tenantForm.emergencyContactRelation.trim(),

        // Additional Information (EXACT MATCH)
        tenantNotes: tenantForm.tenantNotes.trim(),
        applicationNotes: "Manually assigned from Property Units page",

        // Application Info (EXACT MATCH structure)
        applicationId: `manual_${Date.now()}`,
        applicationSource: "manual_assignment",

        // Status & Metadata (EXACT MATCH)
        status: "approved_pending_payment",
        hasPet: false,
        petInfo: {},
        petDetails: null,

        // Property Fees (EXACT MATCH)
        propertyFees: {
          latePaymentFee: property?.latePaymentFee || 0,
          gracePeriod: property?.gracePeriod || 5,
          feeDetails: property?.feeDetails || {}
        },

        // Original Application (EXACT MATCH structure)
        originalApplication: {
          submittedAt: Timestamp.now(),
          totalFees: parseFloat(tenantForm.totalMoveInCost) || 0,
          otherFees: ""
        },

        // Competing Applications (Set to 0 for manual assignment)
        competingApplicationsRejected: 0,

        // Timestamps (EXACT MATCH)
        createdAt: Timestamp.now(),
        approvedAt: Timestamp.now(),
        createdBy: "admin",

        // Additional fields for better querying
        searchKeywords: [
          tenantForm.fullName.toLowerCase(),
          tenantForm.email.toLowerCase(),
          tenantForm.phone,
          tenantForm.idNumber,
          property?.name?.toLowerCase() || "",
          unit.unitNumber.toLowerCase(),
          "active",
          "tenant"
        ]
      };

      // 1️⃣ Create tenant document in tenants collection
      const tenantsRef = collection(db, "tenants");
      const tenantDocRef = await addDoc(tenantsRef, tenantData);
      tenantDocId = tenantDocRef.id;

      // 2️⃣ Update unit document in subcollection
      const unitRef = doc(db, `properties/${id}/units`, unit.id);
      const unitUpdates = {
        occupancyStatus: "leased",
        maintenanceStatus: unit.maintenanceStatus || "normal",
        status: "leased",
        tenantId: tenantDocId,
        tenantName: tenantForm.fullName,
        tenantPhone: tenantForm.phone,
        tenantEmail: tenantForm.email,
        leaseStart: tenantForm.leaseStart,
        leaseEnd: tenantForm.leaseEnd,
        rentAmount: parseFloat(tenantForm.monthlyRent) || 0,
        deposit: parseFloat(tenantForm.securityDeposit) || 0,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(unitRef, unitUpdates);

      // 3️⃣ Recalculate counts
      const updatedUnits = [...units];
      updatedUnits[selectedUnitIndex] = {
        ...unit,
        ...unitUpdates
      };

      const { vacantCount, leasedCount, maintenanceCount } = calculateUnitCounts(updatedUnits);
      const totalUnits = updatedUnits.length;
      const occupancyRate = totalUnits > 0 ? Math.round((leasedCount / totalUnits) * 100) : 0;

      // Calculate monthly revenue
      const monthlyRevenue = updatedUnits
        .filter(u => {
          const { occupancyStatus } = getUnitStatuses(u);
          return occupancyStatus === 'leased';
        })
        .reduce((total, u) => total + (u.rentAmount || 0), 0);

      // 4️⃣ Update property document with new counts
      const propertyRef = doc(db, "properties", id);
      await updateDoc(propertyRef, {
        "unitDetails.vacantCount": vacantCount,
        "unitDetails.leasedCount": leasedCount,
        "unitDetails.maintenanceCount": maintenanceCount,
        "unitDetails.occupancyRate": occupancyRate,
        "unitDetails.totalUnits": totalUnits,
        monthlyRevenue: monthlyRevenue,
        totalTenants: leasedCount,
        updatedAt: new Date()
      });

      // 5️⃣ Update local state
      setUnits(updatedUnits);
      setProperty(prev => ({
        ...prev,
        unitDetails: {
          ...prev.unitDetails,
          vacantCount,
          leasedCount,
          maintenanceCount,
          occupancyRate,
          totalUnits
        },
        monthlyRevenue,
        totalTenants: leasedCount
      }));

      // 6️⃣ Reset form
      setShowAssignForm(false);
      setTenantForm({
        fullName: "",
        email: "",
        phone: "",
        idNumber: "",
        occupation: "",
        employer: "",
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
        tenantNotes: ""
      });

      alert(`✅ Tenant ${tenantForm.fullName} assigned to Unit ${unit.unitNumber}`);

    } catch (error) {
      console.error("Error assigning tenant:", error);
      alert("Failed to assign tenant");
    }
  };

  // Handle edit unit
  const handleEditUnit = (unitIndex) => {
    setEditingUnit(unitIndex);
    alert("Edit feature coming soon! For now, use the status dropdown.");
  };

  // Handle request to delete tenant
  const handleRequestDeleteTenant = (unitIndex) => {
    const unit = units[unitIndex];
    const { occupancyStatus } = getUnitStatuses(unit);

    if (occupancyStatus !== "leased") {
      alert("Unit is not leased. No tenant to delete.");
      return;
    }

    setUnitToDeleteTenant({ unitIndex, unit });
    setShowDeleteTenantModal(true);
  };

  // Filter units - DUAL STATUS VERSION
  const filteredUnits = units.filter(unit => {
    const { displayStatus } = getUnitStatuses(unit);
    if (filter === "all") return true;
    return displayStatus === filter;
  });

  // Get status icon - DUAL STATUS VERSION
  const getStatusIcon = (unitData) => {
    const { occupancyStatus, maintenanceStatus } = getUnitStatuses(unitData);

    if (maintenanceStatus === "under_maintenance") {
      return <FaTools />;
    } else if (occupancyStatus === "leased") {
      return <FaCheckCircle />;
    } else {
      return <FaDoorClosed />;
    }
  };

  // Get status class - DUAL STATUS VERSION
  const getStatusClass = (unitData) => {
    const { displayStatus } = getUnitStatuses(unitData);
    switch (displayStatus) {
      case "vacant": return "vacant";
      case "leased": return "leased";
      case "maintenance": return "maintenance";
      default: return "";
    }
  };

  // Get display status text - DUAL STATUS VERSION
  const getDisplayStatusText = (unitData) => {
    const { occupancyStatus, maintenanceStatus } = getUnitStatuses(unitData);

    if (maintenanceStatus === "under_maintenance") {
      if (occupancyStatus === "leased") {
        return "LEASED & UNDER MAINTENANCE";
      } else {
        return "VACANT & UNDER MAINTENANCE";
      }
    } else {
      return occupancyStatus.toUpperCase();
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return "Not set";
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading units...</p>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="error-container">
        <h2>Property not found</h2>
        <button onClick={() => navigate("/properties")}>
          Back to Properties
        </button>
      </div>
    );
  }

  return (
    <div className="property-units-container">
      {/* Header */}
      <div className="units-header">
        <button className="back-button" onClick={() => navigate("/properties")}>
          <FaArrowLeft /> Back to Properties
        </button>
        <div className="header-content">
          <h1>{property.name} - Units Management</h1>
          <p className="property-address">
            <FaBuilding /> {property.address}, {property.city}
          </p>
          {property.unitDetails && (
            <div className="header-debug-info">
              <small>
                <FaExclamationTriangle /> DUAL STATUS SYSTEM: {property.unitDetails.vacantCount} vacant,
                {property.unitDetails.leasedCount} leased,
                {property.unitDetails.maintenanceCount} maintenance
              </small>
            </div>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="units-summary">
        <div className="summary-card total">
          <h3>{property.unitDetails?.totalUnits || property.units || 1}</h3>
          <p>Total Units</p>
        </div>
        <div className="summary-card vacant">
          <h3>{property.unitDetails?.vacantCount || 0}</h3>
          <p>Vacant Units</p>
        </div>
        <div className="summary-card leased">
          <h3>{property.unitDetails?.leasedCount || 0}</h3>
          <p>Leased Units</p>
        </div>
        <div className="summary-card maintenance">
          <h3>{property.unitDetails?.maintenanceCount || 0}</h3>
          <p>Under Maintenance</p>
        </div>
        <div className="summary-card revenue">
          <h3>{formatCurrency(property.monthlyRevenue || 0)}</h3>
          <p>Monthly Revenue</p>
        </div>
        <div className="summary-card occupancy">
          <h3>{property.unitDetails?.occupancyRate?.toFixed(1) || 0}%</h3>
          <p>Occupancy Rate</p>
        </div>
      </div>

      {/* Status Legend - DUAL STATUS VERSION */}
      <div className="status-standardization-notice">
        <FaExclamationTriangle className="notice-icon" />
        <div className="notice-content">
          <strong>DUAL STATUS SYSTEM:</strong>
          <span className="status-mappings">
            <span className="status-tag vacant">VACANT (Normal)</span>
          </span>
          <span className="status-mappings">
            <span className="status-tag leased">LEASED (Locked)</span>
          </span>
          <span className="status-mappings">
            <span className="status-tag maintenance">VACANT (Under Maintenance)</span>
          </span>
          <span className="status-mappings">
            <span className="status-tag maintenance">LEASED (Under Maintenance)</span>
          </span>
        </div>
        <button
          className="refresh-btn"
          onClick={fetchPropertyAndUnits}
          title="Refresh data"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Filter Controls */}
      <div className="filter-controls">
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            <FaFilter /> All Units ({units.length})
          </button>
          <button
            className={`filter-btn ${filter === 'vacant' ? 'active' : ''}`}
            onClick={() => setFilter('vacant')}
          >
            <FaDoorClosed /> Vacant ({property.unitDetails?.vacantCount || 0})
          </button>
          <button
            className={`filter-btn ${filter === 'leased' ? 'active' : ''}`}
            onClick={() => setFilter('leased')}
          >
            <FaCheckCircle /> Leased ({property.unitDetails?.leasedCount || 0})
          </button>
          <button
            className={`filter-btn ${filter === 'maintenance' ? 'active' : ''}`}
            onClick={() => setFilter('maintenance')}
          >
            <FaTools /> Maintenance ({property.unitDetails?.maintenanceCount || 0})
          </button>
        </div>

        {/* Mobile App Notice - DUAL STATUS VERSION */}
        <div className="mobile-app-notice">
          <span className="notice-icon">📱</span>
          <span className="notice-text">
            <strong>{property.unitDetails?.vacantCount || 0} units</strong> are visible to mobile app users (ALL vacant units, including those under maintenance)
          </span>
        </div>
      </div>

      {/* Tenant Assignment Modal - UPDATED TO MATCH AddTenant.jsx */}
      {showAssignForm && (
        <div className="modal-overlay">
          <div className="modal-content assign-tenant-modal">
            <div className="modal-header">
              <h3>Assign Tenant to Unit {units[selectedUnitIndex]?.unitNumber}</h3>
              <button className="close-modal" onClick={() => setShowAssignForm(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleTenantSubmit} className="tenant-form">

              {/* Personal Information */}
              <div className="form-section">
                <h4>Personal Information</h4>
                <div className="form-group">
                  <label className="required">Full Name *</label>
                  <input
                    type="text"
                    value={tenantForm.fullName}
                    onChange={(e) => setTenantForm({ ...tenantForm, fullName: e.target.value })}
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="required">Email *</label>
                    <input
                      type="email"
                      value={tenantForm.email}
                      onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })}
                      placeholder="john@example.com"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="required">Phone *</label>
                    <input
                      type="tel"
                      value={tenantForm.phone}
                      onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })}
                      placeholder="0712345678"
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>ID/Passport Number</label>
                    <input
                      type="text"
                      value={tenantForm.idNumber}
                      onChange={(e) => setTenantForm({ ...tenantForm, idNumber: e.target.value })}
                      placeholder="12345678"
                    />
                  </div>
                  <div className="form-group">
                    <label>Occupation</label>
                    <input
                      type="text"
                      value={tenantForm.occupation}
                      onChange={(e) => setTenantForm({ ...tenantForm, occupation: e.target.value })}
                      placeholder="Software Developer"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Employer</label>
                  <input
                    type="text"
                    value={tenantForm.employer}
                    onChange={(e) => setTenantForm({ ...tenantForm, employer: e.target.value })}
                    placeholder="Company name"
                  />
                </div>
              </div>

              {/* Financial Details */}
              <div className="form-section">
                <h4>Financial Details</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="required">Monthly Rent (KES) *</label>
                    <input
                      type="number"
                      value={tenantForm.monthlyRent}
                      onChange={(e) => setTenantForm({ ...tenantForm, monthlyRent: e.target.value })}
                      placeholder="15000"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Security Deposit (KES)</label>
                    <input
                      type="number"
                      value={tenantForm.securityDeposit}
                      onChange={(e) => setTenantForm({ ...tenantForm, securityDeposit: e.target.value })}
                      placeholder="15000"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Application Fee (KES)</label>
                    <input
                      type="number"
                      value={tenantForm.applicationFee}
                      onChange={(e) => setTenantForm({ ...tenantForm, applicationFee: e.target.value })}
                      placeholder="1000"
                    />
                  </div>
                  <div className="form-group">
                    <label>Pet Deposit (KES)</label>
                    <input
                      type="number"
                      value={tenantForm.petDeposit}
                      onChange={(e) => setTenantForm({ ...tenantForm, petDeposit: e.target.value })}
                      placeholder="5000"
                    />
                  </div>
                </div>

                <div className="total-cost-display">
                  <label>Total Move-in Cost:</label>
                  <div className="total-cost-amount">
                    {formatCurrency(tenantForm.totalMoveInCost)}
                  </div>
                </div>
              </div>

              {/* Lease Information */}
              <div className="form-section">
                <h4>Lease Information</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="required">Lease Start Date *</label>
                    <input
                      type="date"
                      value={tenantForm.leaseStart}
                      onChange={(e) => setTenantForm({ ...tenantForm, leaseStart: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Lease End Date</label>
                    <input
                      type="date"
                      value={tenantForm.leaseEnd}
                      onChange={(e) => setTenantForm({ ...tenantForm, leaseEnd: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Lease Term (Months)</label>
                    <select
                      value={tenantForm.leaseTerm}
                      onChange={(e) => setTenantForm({ ...tenantForm, leaseTerm: e.target.value })}
                    >
                      <option value="6">6 Months</option>
                      <option value="12">12 Months</option>
                      <option value="18">18 Months</option>
                      <option value="24">24 Months</option>
                      <option value="36">36 Months</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Notice Period (Days)</label>
                    <input
                      type="number"
                      value={tenantForm.noticePeriod}
                      onChange={(e) => setTenantForm({ ...tenantForm, noticePeriod: e.target.value })}
                      placeholder="30"
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="form-section">
                <h4>Emergency Contact</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Contact Name</label>
                    <input
                      type="text"
                      value={tenantForm.emergencyContactName}
                      onChange={(e) => setTenantForm({ ...tenantForm, emergencyContactName: e.target.value })}
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div className="form-group">
                    <label>Contact Phone</label>
                    <input
                      type="tel"
                      value={tenantForm.emergencyContactPhone}
                      onChange={(e) => setTenantForm({ ...tenantForm, emergencyContactPhone: e.target.value })}
                      placeholder="0712987654"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Relationship</label>
                  <input
                    type="text"
                    value={tenantForm.emergencyContactRelation}
                    onChange={(e) => setTenantForm({ ...tenantForm, emergencyContactRelation: e.target.value })}
                    placeholder="Spouse, Parent, etc."
                  />
                </div>
              </div>

              {/* Additional Information */}
              <div className="form-section">
                <h4>Additional Information</h4>
                <div className="form-group">
                  <label>Tenant Notes</label>
                  <textarea
                    value={tenantForm.tenantNotes}
                    onChange={(e) => setTenantForm({ ...tenantForm, tenantNotes: e.target.value })}
                    placeholder="Any additional information about the tenant..."
                    rows="3"
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowAssignForm(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  <FaUserPlus /> Create Tenant Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Tenant Modal */}
      {showDeleteTenantModal && unitToDeleteTenant && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Delete Tenant from Unit {unitToDeleteTenant.unit.unitNumber}</h3>
              <button className="close-modal" onClick={() => {
                setShowDeleteTenantModal(false);
                setUnitToDeleteTenant(null);
              }}>
                ×
              </button>
            </div>
            <div className="delete-tenant-modal-content">
              <div className="warning-message">
                <FaExclamationTriangle className="warning-icon" />
                <h4>⚠️ Warning: This action cannot be undone</h4>
                <p>
                  Deleting the tenant will:
                </p>
                <ul>
                  <li>Remove tenant <strong>{unitToDeleteTenant.unit.tenantName}</strong> from this unit</li>
                  <li>Change unit occupancy status to <strong>VACANT</strong></li>
                  <li>Delete tenant record from the system</li>
                  <li>Update property vacancy counts</li>
                </ul>
                <p className="final-warning">
                  <strong>Note:</strong> This is the ONLY way to change a leased unit back to vacant.
                </p>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => {
                    setShowDeleteTenantModal(false);
                    setUnitToDeleteTenant(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="delete-btn"
                  onClick={handleDeleteTenant}
                >
                  <FaUserMinus /> Delete Tenant & Vacate Unit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Units Grid - LOCKED LEASED STATUS VERSION */}
      <div className="units-grid">
        {filteredUnits.length === 0 ? (
          <div className="no-units">
            <FaHome className="empty-icon" />
            <h3>No units found</h3>
            <p>Try changing your filter</p>
          </div>
        ) : (
          filteredUnits.map((unit, index) => {
            const { occupancyStatus, maintenanceStatus, displayStatus } = getUnitStatuses(unit);
            const isUnderMaintenance = maintenanceStatus === "under_maintenance";
            const isLeased = occupancyStatus === "leased";
            const isOccupancyLocked = isLeased; // Locked when leased

            return (
              <div key={index} className={`unit-card ${getStatusClass(unit)}`}>
                <div className="unit-header">
                  <div className="unit-title-section">
                    <h3 className="unit-title">{unit.unitName}</h3>
                    <span className="unit-id">{unit.unitId}</span>
                  </div>
                  <div className="unit-status-container">
                    <span className={`unit-status-badge ${getStatusClass(unit)}`}>
                      {getStatusIcon(unit)}
                      <span>{getDisplayStatusText(unit)}</span>
                    </span>
                    {isUnderMaintenance && (
                      <div className="maintenance-indicator" title="Under Maintenance">
                        <FaWrench /> Maintenance
                      </div>
                    )}
                    {isOccupancyLocked && (
                      <div className="locked-indicator" title="Occupancy Locked - Delete tenant to change">
                        <FaLock /> Occupancy Locked
                      </div>
                    )}
                  </div>
                </div>

                <div className="unit-details">
                  <div className="detail-row">
                    <span className="detail-label">Unit Number:</span>
                    <span className="detail-value">{unit.unitNumber}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Occupancy:</span>
                    <span className="detail-value">{occupancyStatus.toUpperCase()}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Maintenance:</span>
                    <span className="detail-value">{maintenanceStatus === "under_maintenance" ? "Under Maintenance" : "Normal"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Rent Amount:</span>
                    <span className="detail-value rent">
                      <FaDollarSign /> {formatCurrency(unit.rentAmount)}/month
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Size:</span>
                    <span className="detail-value">{unit.size || "N/A"}</span>
                  </div>
                  {unit.amenities && unit.amenities.length > 0 && (
                    <div className="detail-row">
                      <span className="detail-label">Amenities:</span>
                      <span className="detail-value amenities">
                        {unit.amenities.slice(0, 2).join(', ')}
                        {unit.amenities.length > 2 ? '...' : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Tenant Info (if leased) */}
                {isLeased && (unit.tenantName || unit.tenantId || unit.leaseStart) && (
                  <div className="tenant-info">
                    <h4><FaUser /> Tenant Details</h4>
                    {unit.tenantName && (
                      <div className="detail-row">
                        <span className="detail-label">Name:</span>
                        <span className="detail-value tenant-name">{unit.tenantName}</span>
                      </div>
                    )}
                    {unit.tenantPhone && (
                      <div className="detail-row">
                        <span className="detail-label">Phone:</span>
                        <span className="detail-value">
                          <FaPhone /> {unit.tenantPhone}
                        </span>
                      </div>
                    )}
                    {unit.tenantEmail && (
                      <div className="detail-row">
                        <span className="detail-label">Email:</span>
                        <span className="detail-value">{unit.tenantEmail}</span>
                      </div>
                    )}
                    {unit.leaseStart && (
                      <div className="detail-row">
                        <span className="detail-label">Lease Period:</span>
                        <span className="detail-value">
                          <FaCalendar /> {formatDate(unit.leaseStart)} to {formatDate(unit.leaseEnd)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Unit Notes */}
                {unit.notes && (
                  <div className="unit-notes">
                    <span className="notes-label">Notes:</span>
                    <p className="notes-content">{unit.notes}</p>
                  </div>
                )}

                {/* Action Buttons - LOCKED LEASED STATUS VERSION */}
                <div className="unit-actions">
                  <div className="status-control">
                    <span className="action-label">Change Status:</span>
                    <div className="dual-status-controls">
                      <select
                        value={occupancyStatus}
                        onChange={(e) => handleStatusUpdate(index, "occupancy", e.target.value)}
                        className={`status-select ${isOccupancyLocked ? 'locked' : ''}`}
                        disabled={isOccupancyLocked}
                        title={isOccupancyLocked ? "Occupancy locked while tenant exists. Delete tenant to change." : ""}
                      >
                        <option value="vacant">Vacant</option>
                        <option value="leased">Leased</option>
                      </select>
                      <select
                        value={maintenanceStatus}
                        onChange={(e) => handleStatusUpdate(index, "maintenance", e.target.value)}
                        className="status-select"
                      >
                        <option value="normal">Normal</option>
                        <option value="under_maintenance">Under Maintenance</option>
                      </select>
                    </div>
                    {isOccupancyLocked && (
                      <div className="locked-message">
                        <small>
                          <FaLock /> Occupancy locked. <button
                            type="button"
                            className="delete-tenant-link"
                            onClick={() => handleRequestDeleteTenant(index)}
                          >
                            Delete tenant
                          </button> to change to vacant.
                        </small>
                      </div>
                    )}
                  </div>

                  <div className="action-buttons">
                    {!isLeased && (
                      <button
                        className="action-btn assign-btn"
                        onClick={() => handleAssignTenant(index)}
                      >
                        <FaUserPlus /> Assign Tenant
                      </button>
                    )}

                    {isLeased && (
                      <button
                        className="action-btn delete-tenant-btn"
                        onClick={() => handleRequestDeleteTenant(index)}
                      >
                        <FaUserMinus /> Delete Tenant
                      </button>
                    )}

                    <button
                      className="action-btn edit-btn"
                      onClick={() => handleEditUnit(index)}
                    >
                      <FaEdit /> Edit
                    </button>

                    <button
                      className="action-btn view-btn"
                      onClick={() => alert(`View unit ${unit.unitNumber} details`)}
                    >
                      <FaExpand /> Details
                    </button>
                  </div>
                </div>

                {/* Last Updated */}
                <div className="unit-footer">
                  <span className="updated-text">
                    Updated: {formatDate(unit.updatedAt)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="action-buttons-grid">
          <button className="quick-action-btn" onClick={() => navigate(`/property/${id}/edit`)}>
            <FaEdit /> Edit Property Details
          </button>
          <button className="quick-action-btn" onClick={() => window.print()}>
            <FaChartLine /> Print Unit Report
          </button>
          <button className="quick-action-btn" onClick={() => alert("Export feature coming soon")}>
            📊 Export to Excel
          </button>
        </div>
      </div>
    </div>
  );
};

export default PropertyUnits;