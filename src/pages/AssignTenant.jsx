// src/pages/AssignTenant.jsx - MOBILE-APP COMPATIBLE
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  doc, 
  getDoc, 
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
  increment 
} from "firebase/firestore";
import { db } from "../pages/firebase/firebase";
import "../styles/Properties.css";
import { 
  FaArrowLeft, 
  FaUser, 
  FaPhone, 
  FaEnvelope, 
  FaIdCard,
  FaHome,
  FaMoneyBillWave,
  FaCalendarAlt,
  FaCheckCircle,
  FaFileSignature,
  FaShieldAlt,
  FaMobileAlt
} from "react-icons/fa";

const AssignTenant = () => {
  const { unitId, propertyId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [unit, setUnit] = useState(null);
  const [property, setProperty] = useState(null);
  
  // Tenant form state
  const [tenantForm, setTenantForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    nationalId: "",
    emergencyContact: "",
    occupation: "",
    employer: "",
    monthlyIncome: "",
    moveInDate: "",
    leaseDuration: 12,
    notes: "",
    // Mobile app user ID (if tenant already registered on app)
    mobileUserId: ""
  });

  useEffect(() => {
    fetchUnitAndProperty();
  }, [unitId, propertyId]);

  const fetchUnitAndProperty = async () => {
    try {
      setLoading(true);
      
      // Get unit details
      const unitDoc = await getDoc(doc(db, `properties/${propertyId}/units`, unitId));
      if (unitDoc.exists()) {
        const unitData = unitDoc.data();
        setUnit({ id: unitDoc.id, ...unitData });
        
        // Get property details
        const propertyDoc = await getDoc(doc(db, "properties", propertyId));
        if (propertyDoc.exists()) {
          setProperty({ id: propertyDoc.id, ...propertyDoc.data() });
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      alert("Failed to load unit information");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setTenantForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!tenantForm.fullName.trim()) {
      alert("Please enter tenant's full name");
      return false;
    }
    if (!tenantForm.phone.trim()) {
      alert("Please enter tenant's phone number");
      return false;
    }
    if (!tenantForm.email.trim()) {
      alert("Please enter tenant's email");
      return false;
    }
    if (!tenantForm.nationalId.trim()) {
      alert("Please enter tenant's National ID");
      return false;
    }
    if (!tenantForm.moveInDate) {
      alert("Please select move-in date");
      return false;
    }
    return true;
  };

  const calculateLeaseEndDate = (startDate, months) => {
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + months);
    return date;
  };

  // Function to generate mobile app notification data
  const generateMobileNotification = (tenantName, unitName, propertyName) => {
    return {
      type: "unit_assigned",
      title: "Unit Assigned Successfully",
      message: `${tenantName} has been assigned to ${unitName} at ${propertyName}`,
      data: {
        tenantName,
        unitName,
        propertyName,
        timestamp: new Date().toISOString()
      },
      read: false,
      createdAt: serverTimestamp()
    };
  };

  const handleAssignTenant = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    if (unit?.status === "leased") {
      alert("This unit is already leased to another tenant!");
      return;
    }
    
    if (unit?.status === "maintenance") {
      alert("This unit is under maintenance and cannot be assigned!");
      return;
    }
    
    setSubmitting(true);
    
    try {
      const moveInDate = new Date(tenantForm.moveInDate);
      const leaseEndDate = calculateLeaseEndDate(moveInDate, tenantForm.leaseDuration);
      const today = new Date();
      
      // 1️⃣ Create tenant document in tenants collection
      const tenantData = {
        // Basic info
        fullName: tenantForm.fullName.trim(),
        email: tenantForm.email.toLowerCase().trim(),
        phone: tenantForm.phone.trim(),
        nationalId: tenantForm.nationalId.trim(),
        emergencyContact: tenantForm.emergencyContact.trim(),
        occupation: tenantForm.occupation.trim(),
        employer: tenantForm.employer.trim(),
        monthlyIncome: parseFloat(tenantForm.monthlyIncome) || 0,
        
        // Current unit info
        currentUnitId: unitId,
        currentPropertyId: propertyId,
        currentUnitName: unit?.unitName,
        currentPropertyName: property?.name,
        currentPropertyAddress: property?.address,
        currentRentAmount: unit?.rentAmount,
        
        // Lease info
        leaseStartDate: moveInDate,
        leaseEndDate: leaseEndDate,
        leaseDuration: tenantForm.leaseDuration,
        leaseStatus: "active",
        
        // Status
        status: "active",
        isActive: true,
        tenantSince: today,
        
        // Payment info
        rentAmount: unit?.rentAmount,
        securityDepositPaid: property?.securityDeposit || 0,
        applicationFeePaid: property?.applicationFee || 0,
        rentPaidUntil: null,
        lastPaymentDate: null,
        totalPaid: 0,
        balance: unit?.rentAmount || 0,
        nextPaymentDue: moveInDate,
        
        // Mobile app integration
        mobileUserId: tenantForm.mobileUserId || null,
        hasMobileAppAccount: !!tenantForm.mobileUserId,
        appNotificationToken: null, // Will be set when tenant logs into mobile app
        
        // Additional info
        notes: tenantForm.notes,
        assignedBy: "admin", // Change to current user
        assignedAt: today,
        
        // For search and mobile app queries
        searchKeywords: [
          tenantForm.fullName.toLowerCase(),
          tenantForm.email.toLowerCase(),
          tenantForm.phone,
          tenantForm.nationalId,
          property?.name.toLowerCase(),
          unit?.unitName.toLowerCase(),
          "active",
          "tenant"
        ],
        
        // Timestamps
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const tenantRef = await addDoc(collection(db, "tenants"), tenantData);
      const tenantDocId = tenantRef.id;
      
      // 2️⃣ Update unit document with tenant info
      const unitUpdateData = {
        status: "leased",
        isAvailable: false,
        tenantId: tenantDocId,
        tenantName: tenantForm.fullName,
        tenantEmail: tenantForm.email,
        tenantPhone: tenantForm.phone,
        tenantNationalId: tenantForm.nationalId,
        emergencyContact: tenantForm.emergencyContact,
        leaseStartDate: moveInDate,
        leaseEndDate: leaseEndDate,
        leaseDuration: tenantForm.leaseDuration,
        rentPaidUntil: null,
        lastPaymentDate: null,
        updatedAt: serverTimestamp(),
        assignedAt: serverTimestamp(),
        assignedBy: "admin",
        
        // For mobile app queries
        isOccupied: true,
        occupancyStatus: "leased",
        tenantSince: today,
        
        // Mobile app notification field
        lastStatusChange: {
          from: "vacant",
          to: "leased",
          changedAt: serverTimestamp(),
          changedBy: "admin",
          reason: "tenant_assignment"
        }
      };
      
      await updateDoc(doc(db, `properties/${propertyId}/units`, unitId), unitUpdateData);
      
      // 3️⃣ Update property's unit counts using increment
      const propertyRef = doc(db, "properties", propertyId);
      await updateDoc(propertyRef, {
        "unitDetails.vacantCount": increment(-1),
        "unitDetails.leasedCount": increment(1),
        "unitDetails.occupancyRate": Math.round((((property?.unitDetails?.leasedCount || 0) + 1) / property?.units) * 100),
        "totalTenants": increment(1),
        "monthlyRevenue": increment(unit?.rentAmount || 0),
        updatedAt: serverTimestamp()
      });
      
      // 4️⃣ Create lease document
      const leaseData = {
        tenantId: tenantDocId,
        tenantName: tenantForm.fullName,
        unitId: unitId,
        unitName: unit?.unitName,
        propertyId: propertyId,
        propertyName: property?.name,
        rentAmount: unit?.rentAmount,
        securityDeposit: property?.securityDeposit || 0,
        applicationFee: property?.applicationFee || 0,
        leaseStartDate: moveInDate,
        leaseEndDate: leaseEndDate,
        leaseDuration: tenantForm.leaseDuration,
        status: "active",
        signed: false, // Will be true when digital signature is added
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await addDoc(collection(db, "leases"), leaseData);
      
      // 5️⃣ Create notification for mobile app (if tenant has mobile account)
      if (tenantForm.mobileUserId) {
        const notificationData = generateMobileNotification(
          tenantForm.fullName,
          unit?.unitName,
          property?.name
        );
        
        // Add to user's notifications subcollection
        await addDoc(collection(db, `users/${tenantForm.mobileUserId}/notifications`), notificationData);
        
        // Also add to general notifications
        await addDoc(collection(db, "notifications"), {
          ...notificationData,
          userId: tenantForm.mobileUserId
        });
      }
      
      // 6️⃣ Create activity log
      await addDoc(collection(db, "activities"), {
        type: "tenant_assigned",
        description: `Tenant ${tenantForm.fullName} assigned to ${unit?.unitName}`,
        propertyId: propertyId,
        unitId: unitId,
        tenantId: tenantDocId,
        performedBy: "admin",
        performedAt: serverTimestamp(),
        details: {
          rentAmount: unit?.rentAmount,
          leaseDuration: tenantForm.leaseDuration,
          moveInDate: moveInDate
        }
      });
      
      // SUCCESS
      alert(`✅ Tenant ${tenantForm.fullName} assigned successfully to ${unit?.unitName}!\n\nMobile app will now show this unit as "Leased".`);
      
      // Navigate back to units page
      navigate(`/property/${propertyId}/units`);
      
    } catch (error) {
      console.error("Error assigning tenant:", error);
      alert("Error assigning tenant: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="assign-tenant-container">
        <div className="assign-tenant-loading">
          <div className="spinner"></div>
          <p>Loading unit information...</p>
        </div>
      </div>
    );
  }

  if (!unit || !property) {
    return (
      <div className="assign-tenant-container">
        <div className="assign-tenant-error">
          <h3>Unit not found</h3>
          <p>The unit you're trying to assign a tenant to doesn't exist.</p>
          <button onClick={() => navigate(-1)} className="back-btn">
            <FaArrowLeft /> Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="assign-tenant-container">
      {/* Header */}
      <div className="assign-tenant-header">
        <button className="back-btn" onClick={() => navigate(`/property/${propertyId}/units`)}>
          <FaArrowLeft /> Back to Units
        </button>
        <h1>Assign Tenant to Unit</h1>
        <div className="mobile-app-notice">
          <FaMobileAlt />
          <span>This assignment will reflect on mobile app</span>
        </div>
      </div>

      {/* Unit Info Card */}
      <div className="unit-info-card">
        <div className="unit-info-header">
          <h2>{unit.unitName || `Unit ${unit.unitNumber}`}</h2>
          <span className={`unit-status-badge ${unit.status}`}>
            {unit.status?.toUpperCase()}
          </span>
        </div>
        
        <div className="unit-info-details">
          <div className="info-row">
            <span className="info-label">Property:</span>
            <span className="info-value">{property.name}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Address:</span>
            <span className="info-value">{property.address}, {property.city}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Monthly Rent:</span>
            <span className="info-value price">{formatCurrency(unit.rentAmount)}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Security Deposit:</span>
            <span className="info-value">{formatCurrency(property.securityDeposit)}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Application Fee:</span>
            <span className="info-value">{formatCurrency(property.applicationFee)}</span>
          </div>
        </div>
      </div>

      {/* Tenant Assignment Form */}
      <div className="assign-tenant-form-container">
        <h2>Tenant Information</h2>
        <p className="form-subtitle">Fill in tenant details. This information will sync with mobile app.</p>
        
        <form onSubmit={handleAssignTenant} className="assign-tenant-form">
          
          {/* Personal Information */}
          <div className="form-section">
            <h3><FaUser /> Personal Information</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label className="required">Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  value={tenantForm.fullName}
                  onChange={handleInputChange}
                  placeholder="John Doe"
                  required
                  disabled={submitting}
                />
              </div>
              
              <div className="form-group">
                <label className="required">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={tenantForm.email}
                  onChange={handleInputChange}
                  placeholder="john@example.com"
                  required
                  disabled={submitting}
                />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label className="required">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={tenantForm.phone}
                  onChange={handleInputChange}
                  placeholder="0712 345 678"
                  required
                  disabled={submitting}
                />
              </div>
              
              <div className="form-group">
                <label className="required">National ID</label>
                <input
                  type="text"
                  name="nationalId"
                  value={tenantForm.nationalId}
                  onChange={handleInputChange}
                  placeholder="12345678"
                  required
                  disabled={submitting}
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>Emergency Contact</label>
              <input
                type="text"
                name="emergencyContact"
                value={tenantForm.emergencyContact}
                onChange={handleInputChange}
                placeholder="Emergency contact person & phone"
                disabled={submitting}
              />
            </div>
          </div>
          
          {/* Employment Information */}
          <div className="form-section">
            <h3><FaFileSignature /> Employment Information</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Occupation</label>
                <input
                  type="text"
                  name="occupation"
                  value={tenantForm.occupation}
                  onChange={handleInputChange}
                  placeholder="e.g., Software Developer"
                  disabled={submitting}
                />
              </div>
              
              <div className="form-group">
                <label>Employer</label>
                <input
                  type="text"
                  name="employer"
                  value={tenantForm.employer}
                  onChange={handleInputChange}
                  placeholder="Company name"
                  disabled={submitting}
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>Monthly Income (KSh)</label>
              <input
                type="number"
                name="monthlyIncome"
                value={tenantForm.monthlyIncome}
                onChange={handleInputChange}
                placeholder="e.g., 100000"
                disabled={submitting}
              />
              <small className="form-hint">For reference only</small>
            </div>
          </div>
          
          {/* Lease Information */}
          <div className="form-section">
            <h3><FaCalendarAlt /> Lease Information</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label className="required">Move-in Date</label>
                <input
                  type="date"
                  name="moveInDate"
                  value={tenantForm.moveInDate}
                  onChange={handleInputChange}
                  required
                  disabled={submitting}
                />
              </div>
              
              <div className="form-group">
                <label>Lease Duration (Months)</label>
                <select
                  name="leaseDuration"
                  value={tenantForm.leaseDuration}
                  onChange={handleInputChange}
                  disabled={submitting}
                >
                  <option value="6">6 Months</option>
                  <option value="12">12 Months</option>
                  <option value="24">24 Months</option>
                  <option value="36">36 Months</option>
                </select>
              </div>
            </div>
            
            <div className="form-group">
              <label>Mobile App User ID (Optional)</label>
              <input
                type="text"
                name="mobileUserId"
                value={tenantForm.mobileUserId}
                onChange={handleInputChange}
                placeholder="If tenant already has mobile app account"
                disabled={submitting}
              />
              <small className="form-hint">Leave blank if tenant doesn't have app account yet</small>
            </div>
            
            <div className="form-group">
              <label>Additional Notes</label>
              <textarea
                name="notes"
                value={tenantForm.notes}
                onChange={handleInputChange}
                placeholder="Any additional information about the tenant..."
                rows="3"
                disabled={submitting}
              />
            </div>
          </div>
          
          {/* Summary */}
          <div className="form-section summary-section">
            <h3><FaCheckCircle /> Assignment Summary</h3>
            
            <div className="summary-grid">
              <div className="summary-item">
                <span className="summary-label">Unit:</span>
                <span className="summary-value">{unit.unitName}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Monthly Rent:</span>
                <span className="summary-value price">{formatCurrency(unit.rentAmount)}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Security Deposit:</span>
                <span className="summary-value">{formatCurrency(property.securityDeposit)}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Total Due Now:</span>
                <span className="summary-value total-due">
                  {formatCurrency((unit.rentAmount || 0) + (property.securityDeposit || 0) + (property.applicationFee || 0))}
                </span>
              </div>
            </div>
            
            <div className="mobile-app-warning">
              <FaMobileAlt />
              <div>
                <strong>Mobile App Notice:</strong>
                <p>Once assigned, this unit will appear as "Leased" on the mobile app. The tenant will receive notification if they have the app.</p>
              </div>
            </div>
          </div>
          
          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={() => navigate(`/property/${propertyId}/units`)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-btn"
              disabled={submitting || unit.status === "leased" || unit.status === "maintenance"}
            >
              {submitting ? (
                <>
                  <div className="spinner-small"></div>
                  Assigning Tenant...
                </>
              ) : (
                <>
                  <FaCheckCircle /> Assign Tenant & Sync with Mobile App
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignTenant;