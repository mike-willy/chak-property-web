// src/pages/Units.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  updateDoc,
  query,
  orderBy
} from "firebase/firestore";
import { db } from "../pages/firebase/firebase";
import { 
  FaArrowLeft, 
  FaBed, 
  FaBath, 
  FaMoneyBillWave,
  FaUser,
  FaCalendarAlt,
  FaPhone,
  FaEnvelope,
  FaDoorClosed,
  FaCheckCircle,
  FaTools,
  FaEdit,
  FaHome,
  FaPlus,
  FaRulerCombined,
  FaWifi,
  FaCar,
  FaTv,
  FaSnowflake,
  FaEye
} from "react-icons/fa";

const Units = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [units, setUnits] = useState([]);
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingUnit, setUpdatingUnit] = useState(null);

  useEffect(() => {
    fetchPropertyAndUnits();
  }, [id]);

  const fetchPropertyAndUnits = async () => {
    try {
      setLoading(true);
      
      // Get property details
      const propertyDoc = await getDoc(doc(db, "properties", id));
      if (propertyDoc.exists()) {
        setProperty({ id: propertyDoc.id, ...propertyDoc.data() });
      }
      
      // Get units from subcollection with ordering
      const unitsRef = collection(db, `properties/${id}/units`);
      const q = query(unitsRef, orderBy("unitOrder", "asc"));
      const unitsSnapshot = await getDocs(q);
      
      const unitsData = [];
      
      unitsSnapshot.forEach((doc) => {
        unitsData.push({ id: doc.id, ...doc.data() });
      });
      
      setUnits(unitsData);
      
    } catch (error) {
      console.error("Error fetching units:", error);
      alert("Failed to load units");
    } finally {
      setLoading(false);
    }
  };

  // Update unit status
  const handleUnitStatusUpdate = async (unitId, newStatus) => {
    try {
      setUpdatingUnit(unitId);
      
      const unitRef = doc(db, `properties/${id}/units`, unitId);
      await updateDoc(unitRef, {
        status: newStatus,
        updatedAt: new Date(),
        isAvailable: newStatus === "vacant"
      });
      
      // Update the property's unit counts
      await updatePropertyUnitCounts(newStatus);
      
      // Update local state
      setUnits(prev => prev.map(unit => 
        unit.id === unitId ? { ...unit, status: newStatus, isAvailable: newStatus === "vacant" } : unit
      ));
      
      alert(`Unit status updated to ${newStatus}`);
    } catch (error) {
      console.error("Error updating unit status:", error);
      alert("Failed to update unit status");
    } finally {
      setUpdatingUnit(null);
    }
  };

  // Update property's unit counts
  const updatePropertyUnitCounts = async (newStatus) => {
    try {
      // Recalculate counts from all units
      const vacantCount = units.filter(u => u.status === "vacant").length;
      const leasedCount = units.filter(u => u.status === "leased").length;
      const maintenanceCount = units.filter(u => u.status === "maintenance").length;
      const totalUnits = units.length;
      const occupancyRate = totalUnits > 0 ? Math.round((leasedCount / totalUnits) * 100) : 0;
      
      const propertyRef = doc(db, "properties", id);
      await updateDoc(propertyRef, {
        "unitDetails.vacantCount": vacantCount,
        "unitDetails.leasedCount": leasedCount,
        "unitDetails.maintenanceCount": maintenanceCount,
        "unitDetails.occupancyRate": occupancyRate,
        updatedAt: new Date()
      });
      
    } catch (error) {
      console.error("Error updating property counts:", error);
    }
  };

  // Assign tenant to unit
  const handleAssignTenant = (unitId) => {
    navigate(`/units/${unitId}/assign-tenant`);
  };

  // Add new unit
  const handleAddUnit = () => {
    navigate(`/properties/${id}/add-unit`);
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
    return new Date(date.toDate ? date.toDate() : date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusClass = (status) => {
    switch(status?.toLowerCase()) {
      case "leased": return "unit-status-leased";
      case "vacant": return "unit-status-vacant";
      case "maintenance": return "unit-status-maintenance";
      default: return "unit-status-vacant";
    }
  };

  const getStatusIcon = (status) => {
    switch(status?.toLowerCase()) {
      case "leased": return <FaCheckCircle />;
      case "vacant": return <FaDoorClosed />;
      case "maintenance": return <FaTools />;
      default: return <FaDoorClosed />;
    }
  };

  if (loading) {
    return (
      <div className="units-container">
        <div className="units-loading">
          <div className="spinner"></div>
          <p>Loading units...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="units-container">
      {/* Header */}
      <div className="units-header">
        <button className="units-back-btn" onClick={() => navigate("/properties")}>
          <FaArrowLeft /> Back to Properties
        </button>
        <div className="units-header-content">
          <h1>{property?.name || "Property"} - Units</h1>
          <p className="units-subtitle">
            {property?.address}, {property?.city}
            {property?.landlordName && ` • Landlord: ${property.landlordName}`}
          </p>
        </div>
        <button className="units-add-btn" onClick={handleAddUnit}>
          <FaPlus /> Add Unit
        </button>
      </div>

      {/* Summary Stats */}
      <div className="units-summary">
        <div className="units-stat-card">
          <div className="stat-number">{units.length}</div>
          <div className="stat-label">Total Units</div>
        </div>
        <div className="units-stat-card">
          <div className="stat-number">{units.filter(u => u.status === "vacant").length}</div>
          <div className="stat-label">Vacant</div>
        </div>
        <div className="units-stat-card">
          <div className="stat-number">{units.filter(u => u.status === "leased").length}</div>
          <div className="stat-label">Leased</div>
        </div>
        <div className="units-stat-card">
          <div className="stat-number">{units.filter(u => u.status === "maintenance").length}</div>
          <div className="stat-label">Maintenance</div>
        </div>
      </div>

      {/* Units Grid */}
      <div className="units-grid">
        {units.length === 0 ? (
          <div className="units-empty">
            <FaHome className="units-empty-icon" />
            <h3>No units found</h3>
            <p>This property doesn't have any units yet.</p>
            <button className="units-add-btn" onClick={handleAddUnit}>
              <FaPlus /> Add First Unit
            </button>
          </div>
        ) : (
          units.map(unit => (
            <div key={unit.id} className="unit-card">
              {/* Unit Header */}
              <div className="unit-header">
                <div>
                  <h3>{unit.unitName || `Unit ${unit.unitNumber}`}</h3>
                  <p className="unit-id">ID: {unit.unitId}</p>
                </div>
                <div className={`unit-status ${getStatusClass(unit.status)}`}>
                  {getStatusIcon(unit.status)}
                  <span>{unit.status?.toUpperCase() || "VACANT"}</span>
                </div>
              </div>

              {/* Unit Details */}
              <div className="unit-details">
                <div className="unit-specs">
                  <div className="unit-spec">
                    <FaMoneyBillWave />
                    <span>{formatCurrency(unit.rentAmount)}/month</span>
                  </div>
                  
                  {unit.bedrooms > 0 && (
                    <div className="unit-spec">
                      <FaBed />
                      <span>{unit.bedrooms} Bed{unit.bedrooms !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                  
                  {unit.bathrooms > 0 && (
                    <div className="unit-spec">
                      <FaBath />
                      <span>{unit.bathrooms} Bath{unit.bathrooms !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                  
                  {unit.size && (
                    <div className="unit-spec">
                      <FaRulerCombined />
                      <span>{unit.size} sq ft</span>
                    </div>
                  )}
                </div>

                {/* Tenant Info if leased */}
                {unit.status === "leased" && unit.tenantName && (
                  <div className="unit-tenant-info">
                    <h4>Current Tenant</h4>
                    <div className="tenant-details">
                      <div className="tenant-row">
                        <FaUser />
                        <span>{unit.tenantName}</span>
                      </div>
                      {unit.tenantPhone && (
                        <div className="tenant-row">
                          <FaPhone />
                          <span>{unit.tenantPhone}</span>
                        </div>
                      )}
                      {unit.tenantEmail && (
                        <div className="tenant-row">
                          <FaEnvelope />
                          <span>{unit.tenantEmail}</span>
                        </div>
                      )}
                      {unit.leaseStartDate && (
                        <div className="tenant-row">
                          <FaCalendarAlt />
                          <span>Lease: {formatDate(unit.leaseStartDate)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Fees Info */}
                <div className="unit-fees-info">
                  <div className="fee-item">
                    <span className="fee-label">Security Deposit:</span>
                    <span className="fee-amount">{formatCurrency(unit.securityDeposit)}</span>
                  </div>
                  {unit.applicationFee > 0 && (
                    <div className="fee-item">
                      <span className="fee-label">Application Fee:</span>
                      <span className="fee-amount">{formatCurrency(unit.applicationFee)}</span>
                    </div>
                  )}
                </div>

                {/* Amenities Preview */}
                {unit.amenities && unit.amenities.length > 0 && (
                  <div className="unit-amenities">
                    <h4>Amenities:</h4>
                    <div className="amenities-tags">
                      {unit.amenities.slice(0, 3).map((amenity, index) => (
                        <span key={index} className="amenity-tag">{amenity}</span>
                      ))}
                      {unit.amenities.length > 3 && (
                        <span className="amenity-tag">+{unit.amenities.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Unit Actions */}
              <div className="unit-actions">
                <div className="unit-status-control">
                  <span className="status-label">Update Status:</span>
                  <select
                    value={unit.status || "vacant"}
                    onChange={(e) => handleUnitStatusUpdate(unit.id, e.target.value)}
                    disabled={updatingUnit === unit.id}
                    className={`unit-status-select ${getStatusClass(unit.status)}`}
                  >
                    <option value="vacant">Vacant</option>
                    <option value="leased">Leased</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                
                <div className="unit-action-buttons">
                  <button 
                    className="unit-action-btn view-btn"
                    onClick={() => navigate(`/units/${unit.id}`)}
                  >
                    <FaEye /> View
                  </button>
                  
                  {unit.status === "vacant" && (
                    <button 
                      className="unit-action-btn assign-btn"
                      onClick={() => handleAssignTenant(unit.id)}
                    >
                      <FaUser /> Assign Tenant
                    </button>
                  )}
                  
                  <button 
                    className="unit-action-btn edit-btn"
                    onClick={() => navigate(`/units/${unit.id}/edit`)}
                  >
                    <FaEdit /> Edit
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Units;