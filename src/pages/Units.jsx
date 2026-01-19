// src/pages/Units.jsx - FIXED VERSION
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  collection, 
  getDocs, 
  doc,
  updateDoc
} from "firebase/firestore";
import { db } from "../pages/firebase/firebase";
import { 
  FaArrowLeft, 
  FaBed, 
  FaBath, 
  FaMoneyBillWave,
  FaUser,
  FaHome,
  FaDoorClosed,
  FaCheckCircle,
  FaTools,
  FaEdit,
  FaEye,
  FaMapMarkerAlt,
  FaUsers,
  FaSearch,
  FaCalendar,
  FaPhone,
  FaEnvelope,
  FaFileSignature,
  FaExclamationTriangle
} from "react-icons/fa";
import "../styles/AllUnits.css";

const Units = () => {
  const navigate = useNavigate();
  const [allUnits, setAllUnits] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Standardize status values
  const standardizeStatus = (status) => {
    if (!status) return "vacant";
    const statusLower = status.toLowerCase();
    
    // Map different status values to standard ones
    if (statusLower === "occupied" || statusLower === "rented" || statusLower === "active") {
      return "leased";
    }
    if (statusLower === "available" || statusLower === "free") {
      return "vacant";
    }
    if (statusLower === "repair" || statusLower === "under_repair") {
      return "maintenance";
    }
    
    return statusLower;
  };

  useEffect(() => {
    fetchAllUnits();
  }, []);

  const fetchAllUnits = async () => {
    try {
      setLoading(true);
      
      const propertiesSnapshot = await getDocs(collection(db, "properties"));
      const propertiesData = [];
      const unitsByProperty = {};
      
      propertiesSnapshot.forEach((doc) => {
        const propertyData = { 
          id: doc.id, 
          ...doc.data(),
          // Ensure property has correct unit counts
          unitDetails: {
            totalUnits: doc.data().units || doc.data().unitDetails?.totalUnits || 1,
            vacantCount: doc.data().unitDetails?.vacantCount || 0,
            leasedCount: doc.data().unitDetails?.leasedCount || 0,
            maintenanceCount: doc.data().unitDetails?.maintenanceCount || 0
          }
        };
        propertiesData.push(propertyData);
        unitsByProperty[doc.id] = {
          property: propertyData,
          units: []
        };
      });
      
      setProperties(propertiesData);
      
      // Fetch units from each property
      for (const property of propertiesData) {
        try {
          const unitsRef = collection(db, `properties/${property.id}/units`);
          const unitsSnapshot = await getDocs(unitsRef);
          
          unitsSnapshot.forEach((unitDoc) => {
            const unitData = unitDoc.data();
            
            // Standardize unit status
            const standardizedStatus = standardizeStatus(unitData.status);
            
            const enhancedUnitData = { 
              id: unitDoc.id, 
              ...unitData,
              originalStatus: unitData.status, // Keep original for reference
              status: standardizedStatus, // Use standardized status
              propertyId: property.id,
              propertyName: property.name,
              propertyAddress: property.address,
              propertyCity: property.city
            };
            
            unitsByProperty[property.id].units.push(enhancedUnitData);
          });
          
        } catch (error) {
          console.log(`No units found for property ${property.name}:`, error.message);
        }
      }
      
      // Update property counts based on actual unit data
      Object.keys(unitsByProperty).forEach(propertyId => {
        const propertyUnits = unitsByProperty[propertyId].units;
        const property = unitsByProperty[propertyId].property;
        
        // Calculate actual counts
        const vacantCount = propertyUnits.filter(u => u.status === "vacant").length;
        const leasedCount = propertyUnits.filter(u => u.status === "leased").length;
        const maintenanceCount = propertyUnits.filter(u => u.status === "maintenance").length;
        const totalUnits = propertyUnits.length;
        
        // Update property object with real counts
        unitsByProperty[propertyId].property.unitDetails = {
          totalUnits,
          vacantCount,
          leasedCount,
          maintenanceCount,
          occupancyRate: totalUnits > 0 ? Math.round((leasedCount / totalUnits) * 100) : 0
        };
      });
      
      // Convert to array
      const unitsArray = Object.values(unitsByProperty)
        .filter(item => item.units.length > 0)
        .sort((a, b) => a.property.name?.localeCompare(b.property.name));
      
      setAllUnits(unitsArray);
      
    } catch (error) {
      console.error("Error fetching units:", error);
      alert("Failed to load units");
    } finally {
      setLoading(false);
    }
  };

  // Update unit status and sync with property
  const handleUnitStatusUpdate = async (propertyId, unitId, newStatus) => {
    try {
      const unitRef = doc(db, `properties/${propertyId}/units`, unitId);
      const standardizedStatus = standardizeStatus(newStatus);
      
      const updates = {
        status: standardizedStatus,
        updatedAt: new Date(),
        isAvailable: standardizedStatus === "vacant"
      };
      
      // Clear tenant info if marking as vacant
      if (standardizedStatus === "vacant") {
        updates.tenantId = null;
        updates.tenantName = null;
        updates.tenantPhone = null;
        updates.tenantEmail = null;
        updates.leaseStartDate = null;
        updates.leaseEndDate = null;
      }
      
      await updateDoc(unitRef, updates);
      
      // Update local state
      setAllUnits(prev => prev.map(item => {
        if (item.property.id === propertyId) {
          const updatedUnits = item.units.map(unit => {
            if (unit.id === unitId) {
              return { ...unit, ...updates, status: standardizedStatus };
            }
            return unit;
          });
          
          // Recalculate property counts
          const vacantCount = updatedUnits.filter(u => u.status === "vacant").length;
          const leasedCount = updatedUnits.filter(u => u.status === "leased").length;
          const maintenanceCount = updatedUnits.filter(u => u.status === "maintenance").length;
          const totalUnits = updatedUnits.length;
          
          return { 
            ...item, 
            units: updatedUnits,
            property: {
              ...item.property,
              unitDetails: {
                totalUnits,
                vacantCount,
                leasedCount,
                maintenanceCount,
                occupancyRate: totalUnits > 0 ? Math.round((leasedCount / totalUnits) * 100) : 0
              }
            }
          };
        }
        return item;
      }));
      
      // Update main properties collection
      await updatePropertyCountsInFirestore(propertyId);
      
      alert(`Unit status updated to ${standardizedStatus}`);
    } catch (error) {
      console.error("Error updating unit status:", error);
      alert("Failed to update unit status");
    }
  };

  // Update property counts in Firestore
  const updatePropertyCountsInFirestore = async (propertyId) => {
    try {
      // Find property in current state
      const propertyGroup = allUnits.find(item => item.property.id === propertyId);
      if (!propertyGroup) return;
      
      const { unitDetails } = propertyGroup.property;
      const propertyRef = doc(db, "properties", propertyId);
      
      await updateDoc(propertyRef, {
        "unitDetails.totalUnits": unitDetails.totalUnits,
        "unitDetails.vacantCount": unitDetails.vacantCount,
        "unitDetails.leasedCount": unitDetails.leasedCount,
        "unitDetails.maintenanceCount": unitDetails.maintenanceCount,
        "unitDetails.occupancyRate": unitDetails.occupancyRate,
        updatedAt: new Date()
      });
      
    } catch (error) {
      console.error("Error updating property counts:", error);
    }
  };

  // Filter units with standardized status
  const filteredUnits = allUnits
    .map(item => {
      const filteredPropertyUnits = item.units.filter(unit => {
        const matchesSearch = 
          unit.unitNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          unit.unitName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.property.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.property.address?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = 
          filterStatus === "all" || 
          unit.status === filterStatus; // Now using standardized status
        
        return matchesSearch && matchesStatus;
      });
      
      return {
        ...item,
        units: filteredPropertyUnits
      };
    })
    .filter(item => item.units.length > 0);

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
    if (!dateInput) return "Not set";
    try {
      let date;
      if (dateInput.toDate) {
        date = dateInput.toDate();
      } else if (typeof dateInput === 'string') {
        date = new Date(dateInput);
      } else {
        date = dateInput;
      }
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return "Invalid date";
    }
  };

  // Get status class
  const getStatusClass = (status) => {
    const statusLower = status?.toLowerCase() || "vacant";
    switch(statusLower) {
      case "leased": return "all-units-status-leased";
      case "vacant": return "all-units-status-vacant";
      case "maintenance": return "all-units-status-maintenance";
      default: return "all-units-status-vacant";
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    const statusLower = status?.toLowerCase() || "vacant";
    switch(statusLower) {
      case "leased": return <FaCheckCircle />;
      case "vacant": return <FaDoorClosed />;
      case "maintenance": return <FaTools />;
      default: return <FaDoorClosed />;
    }
  };

  // View unit details
  const handleViewUnit = (propertyId, unitId) => {
    navigate(`/units/${unitId}/details`, { state: { propertyId } });
  };

  // Assign tenant to unit
  const handleAssignTenant = (propertyId, unitId) => {
    navigate(`/applications`, { 
      state: { 
        assignToUnit: { unitId, propertyId }
      } 
    });
  };

  if (loading) {
    return (
      <div className="all-units-container">
        <div className="all-units-loading-container">
          <div className="all-units-spinner"></div>
          <p>Loading all units...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="all-units-container">
      {/* Header */}
      <div className="all-units-header">
        <button className="all-units-back-btn" onClick={() => navigate("/properties")}>
          <FaArrowLeft /> Back to Properties
        </button>
        <div className="all-units-header-content">
          <h1>All Units</h1>
          <p className="all-units-subtitle">Units from all properties, grouped by property</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="all-units-filters-section">
        <div className="all-units-search-box">
          <FaSearch className="all-units-search-icon" />
          <input
            type="text"
            placeholder="Search units by name, number, or property..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="all-units-search-input"
          />
          {searchTerm && (
            <button 
              className="all-units-search-clear"
              onClick={() => setSearchTerm("")}
              type="button"
            >
              ×
            </button>
          )}
        </div>
        
        <div className="all-units-filter-buttons">
          <button 
            className={`all-units-filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            All Units
          </button>
          <button 
            className={`all-units-filter-btn ${filterStatus === 'vacant' ? 'active' : ''}`}
            onClick={() => setFilterStatus('vacant')}
          >
            Vacant
          </button>
          <button 
            className={`all-units-filter-btn ${filterStatus === 'leased' ? 'active' : ''}`}
            onClick={() => setFilterStatus('leased')}
          >
            Leased
          </button>
          <button 
            className={`all-units-filter-btn ${filterStatus === 'maintenance' ? 'active' : ''}`}
            onClick={() => setFilterStatus('maintenance')}
          >
            Maintenance
          </button>
        </div>
      </div>

      {/* Status Legend */}
      <div className="all-units-status-legend">
        <div className="all-units-legend-item">
          <div className="all-units-status-badge all-units-status-vacant">
            <FaDoorClosed /> Vacant
          </div>
          <span>Available for rent</span>
        </div>
        <div className="all-units-legend-item">
          <div className="all-units-status-badge all-units-status-leased">
            <FaCheckCircle /> Leased
          </div>
          <span>Currently occupied</span>
        </div>
        <div className="all-units-legend-item">
          <div className="all-units-status-badge all-units-status-maintenance">
            <FaTools /> Maintenance
          </div>
          <span>Under repair/maintenance</span>
        </div>
      </div>

      {/* Units List */}
      <div className="all-units-property-groups">
        {filteredUnits.length === 0 ? (
          <div className="all-units-empty-state">
            <FaHome className="all-units-empty-icon" />
            <h3>No units found</h3>
            <p>
              {searchTerm || filterStatus !== 'all' 
                ? 'Try changing your search or filter' 
                : 'No units found in any property. Add units to properties first.'}
            </p>
          </div>
        ) : (
          filteredUnits.map((item) => {
            const { vacantCount, leasedCount, maintenanceCount, totalUnits, occupancyRate } = item.property.unitDetails;
            
            return (
              <div key={item.property.id} className="all-units-property-group">
                {/* Property Header with Statistics */}
                <div className="all-units-property-header">
                  <div className="all-units-property-info">
                    <h2>
                      <FaHome /> {item.property.name}
                      <span className="all-units-property-stats">
                        <span className="all-units-stat-item">
                          <FaUsers /> {totalUnits} units
                        </span>
                        <span className="all-units-stat-item">
                          <FaDoorClosed /> {vacantCount} vacant
                        </span>
                        <span className="all-units-stat-item">
                          <FaCheckCircle /> {leasedCount} leased
                        </span>
                        {maintenanceCount > 0 && (
                          <span className="all-units-stat-item">
                            <FaTools /> {maintenanceCount} maintenance
                          </span>
                        )}
                        <span className="all-units-stat-item occupancy">
                          {occupancyRate}% occupancy
                        </span>
                      </span>
                    </h2>
                    <div className="all-units-property-details">
                      <span className="all-units-property-location">
                        <FaMapMarkerAlt /> {item.property.address}, {item.property.city}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Units Grid */}
                <div className="all-units-grid">
                  {item.units.map(unit => {
                    const isLeased = unit.status === "leased";
                    
                    return (
                      <div key={unit.id} className={`all-units-unit-card ${isLeased ? 'leased' : ''}`}>
                        <div className="all-units-unit-header">
                          <div>
                            <h3>{unit.unitName || `Unit ${unit.unitNumber || unit.id.substring(0, 8)}`}</h3>
                            <p className="all-units-unit-rent">
                              <FaMoneyBillWave /> {formatCurrency(unit.rentAmount || unit.monthlyRent)}/month
                            </p>
                          </div>
                          <div className={`all-units-status-badge ${getStatusClass(unit.status)}`}>
                            {getStatusIcon(unit.status)}
                            <span>{unit.status?.toUpperCase()}</span>
                          </div>
                        </div>

                        <div className="all-units-unit-details">
                          <div className="all-units-unit-specs">
                            {unit.bedrooms > 0 && (
                              <div className="all-units-unit-spec">
                                <FaBed />
                                <span>{unit.bedrooms} Bed{unit.bedrooms !== 1 ? 's' : ''}</span>
                              </div>
                            )}
                            {unit.bathrooms > 0 && (
                              <div className="all-units-unit-spec">
                                <FaBath />
                                <span>{unit.bathrooms} Bath{unit.bathrooms !== 1 ? 's' : ''}</span>
                              </div>
                            )}
                            {unit.size && (
                              <div className="all-units-unit-spec">
                                <span>Size: {unit.size} sq ft</span>
                              </div>
                            )}
                          </div>

                          {/* TENANT DETAILS - SHOW IF LEASED */}
                          {isLeased && unit.tenantName && (
                            <div className="all-units-tenant-details">
                              <h4><FaUser /> Tenant Details</h4>
                              <div className="all-units-tenant-info">
                                <div className="all-units-tenant-field">
                                  <strong>Name:</strong> {unit.tenantName}
                                </div>
                                {unit.tenantPhone && (
                                  <div className="all-units-tenant-field">
                                    <strong>Phone:</strong> {unit.tenantPhone}
                                  </div>
                                )}
                                {unit.tenantEmail && (
                                  <div className="all-units-tenant-field">
                                    <strong>Email:</strong> {unit.tenantEmail}
                                  </div>
                                )}
                                {unit.leaseStartDate && (
                                  <div className="all-units-tenant-field">
                                    <strong>Lease Start:</strong> {formatDate(unit.leaseStartDate)}
                                  </div>
                                )}
                                {unit.leaseEndDate && (
                                  <div className="all-units-tenant-field">
                                    <strong>Lease End:</strong> {formatDate(unit.leaseEndDate)}
                                  </div>
                                )}
                                {unit.originalStatus && unit.originalStatus !== unit.status && (
                                  <div className="all-units-tenant-field">
                                    <FaExclamationTriangle /> 
                                    <small>Original status: {unit.originalStatus}</small>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Fees Preview */}
                          <div className="all-units-fees-preview">
                            <div className="all-units-fee-preview">
                              <span><FaFileSignature /> Deposit:</span>
                              <span>{formatCurrency(unit.securityDeposit || unit.depositAmount)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="all-units-unit-actions">
                          <div className="all-units-status-control">
                            <select
                              value={unit.status || "vacant"}
                              onChange={(e) => handleUnitStatusUpdate(item.property.id, unit.id, e.target.value)}
                              className={`all-units-status-select ${getStatusClass(unit.status)}`}
                            >
                              <option value="vacant">Vacant</option>
                              <option value="leased">Leased</option>
                              <option value="maintenance">Maintenance</option>
                            </select>
                          </div>
                          
                          <div className="all-units-action-buttons">
                            <button 
                              className="all-units-action-btn all-units-view-btn"
                              onClick={() => handleViewUnit(item.property.id, unit.id)}
                              title="View Details"
                            >
                              <FaEye />
                            </button>
                            
                            {!isLeased && (
                              <button 
                                className="all-units-action-btn all-units-assign-btn"
                                onClick={() => handleAssignTenant(item.property.id, unit.id)}
                                title="Assign Tenant"
                              >
                                <FaUser />
                              </button>
                            )}
                            
                            <button 
                              className="all-units-action-btn all-units-edit-btn"
                              onClick={() => navigate(`/units/${unit.id}/edit`, { state: { propertyId: item.property.id } })}
                              title="Edit Unit"
                            >
                              <FaEdit />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Summary Stats */}
      {filteredUnits.length > 0 && (
        <div className="all-units-total-summary">
          <div className="all-units-summary-stat">
            <span className="stat-label">Properties:</span>
            <span className="stat-value">{filteredUnits.length}</span>
          </div>
          <div className="all-units-summary-stat">
            <span className="stat-label">Total Units:</span>
            <span className="stat-value">
              {filteredUnits.reduce((total, item) => total + item.units.length, 0)}
            </span>
          </div>
          <div className="all-units-summary-stat">
            <span className="stat-label">Vacant Units:</span>
            <span className="stat-value">
              {filteredUnits.reduce((total, item) => 
                total + item.units.filter(u => u.status === "vacant").length, 0)}
            </span>
          </div>
          <div className="all-units-summary-stat">
            <span className="stat-label">Leased Units:</span>
            <span className="stat-value leased-count">
              {filteredUnits.reduce((total, item) => 
                total + item.units.filter(u => u.status === "leased").length, 0)}
            </span>
          </div>
          <div className="all-units-summary-stat">
            <span className="stat-label">Maintenance:</span>
            <span className="stat-value">
              {filteredUnits.reduce((total, item) => 
                total + item.units.filter(u => u.status === "maintenance").length, 0)}
            </span>
          </div>
        </div>
      )}

      {/* Data Health Check */}
      <div className="all-units-data-health">
        <h3><FaExclamationTriangle /> Data Status Check</h3>
        <p>
          Status standardization active. All unit statuses are mapped to: 
          <span className="all-units-status-tag vacant">vacant</span>, 
          <span className="all-units-status-tag leased">leased</span>, 
          <span className="all-units-status-tag maintenance">maintenance</span>
        </p>
        <button 
          className="all-units-refresh-btn"
          onClick={fetchAllUnits}
        >
          Refresh Data
        </button>
      </div>
    </div>
  );
};

export default Units;