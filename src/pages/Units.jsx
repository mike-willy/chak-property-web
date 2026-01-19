// src/pages/Units.jsx - LOCKED LEASED STATUS VERSION (FIXED)
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  collection, 
  getDocs, 
  doc,
  updateDoc,
  deleteDoc
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
  FaExclamationTriangle,
  FaWrench,
  FaLock,
  FaUserMinus
} from "react-icons/fa";
import "../styles/AllUnits.css";

const Units = () => {
  const navigate = useNavigate();
  const [allUnits, setAllUnits] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showDeleteTenantModal, setShowDeleteTenantModal] = useState(false);
  const [unitToDeleteTenant, setUnitToDeleteTenant] = useState(null);

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
            
            // Get dual statuses
            const { occupancyStatus, maintenanceStatus, displayStatus } = getUnitStatuses(unitData);
            
            const enhancedUnitData = { 
              id: unitDoc.id, 
              ...unitData,
              occupancyStatus, // NEW FIELD
              maintenanceStatus, // NEW FIELD
              displayStatus, // Calculated display status
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
      
      // Update property counts based on actual unit data - DUAL STATUS VERSION
      Object.keys(unitsByProperty).forEach(propertyId => {
        const propertyUnits = unitsByProperty[propertyId].units;
        const property = unitsByProperty[propertyId].property;
        
        // Calculate actual counts using dual status
        let vacantCount = 0;
        let leasedCount = 0;
        let maintenanceCount = 0;
        
        propertyUnits.forEach(unit => {
          const { occupancyStatus, maintenanceStatus } = getUnitStatuses(unit);
          
          // Count occupancy
          if (occupancyStatus === "leased") {
            leasedCount++;
          } else {
            vacantCount++;
          }
          
          // Count maintenance
          if (maintenanceStatus === "under_maintenance") {
            maintenanceCount++;
          }
        });
        
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

  // Update unit status - LOCKED LEASED STATUS VERSION
  const handleUnitStatusUpdate = async (propertyId, unitId, statusType, newValue) => {
    try {
      // Find unit data
      const propertyGroup = allUnits.find(item => item.property.id === propertyId);
      if (!propertyGroup) return;
      
      const unit = propertyGroup.units.find(u => u.id === unitId);
      if (!unit) return;
      
      const { occupancyStatus } = getUnitStatuses(unit);
      
      // PREVENT changing occupancy from leased to vacant
      if (statusType === "occupancy" && occupancyStatus === "leased" && newValue === "vacant") {
        alert("Cannot change occupancy from 'Leased' to 'Vacant'. You must delete the tenant first.");
        return;
      }
      
      const unitRef = doc(db, `properties/${propertyId}/units`, unitId);
      
      // Determine updates based on what's being changed
      const updates = {
        updatedAt: new Date()
      };
      
      if (statusType === "occupancy") {
        updates.occupancyStatus = newValue;
        
        // Clear tenant info if changing from leased to vacant (shouldn't happen due to check above)
        if (occupancyStatus === "leased" && newValue === "vacant") {
          updates.tenantId = null;
          updates.tenantName = null;
          updates.tenantPhone = null;
          updates.tenantEmail = null;
          updates.leaseStartDate = null;
          updates.leaseEndDate = null;
        }
        
        // Keep legacy status for backward compatibility
        if (unit.maintenanceStatus === "under_maintenance") {
          updates.status = "maintenance";
        } else {
          updates.status = newValue;
        }
      } 
      else if (statusType === "maintenance") {
        updates.maintenanceStatus = newValue;
        
        // Keep legacy status for backward compatibility
        if (newValue === "under_maintenance") {
          updates.status = "maintenance";
        } else {
          updates.status = occupancyStatus;
        }
      }
      
      await updateDoc(unitRef, updates);
      
      // Update local state
      setAllUnits(prev => prev.map(item => {
        if (item.property.id === propertyId) {
          const updatedUnits = item.units.map(unit => {
            if (unit.id === unitId) {
              const updatedUnit = { 
                ...unit, 
                ...updates,
                ...(statusType === "occupancy" && { occupancyStatus: newValue }),
                ...(statusType === "maintenance" && { maintenanceStatus: newValue })
              };
              
              // Recalculate display status
              const { displayStatus } = getUnitStatuses(updatedUnit);
              return { ...updatedUnit, displayStatus };
            }
            return unit;
          });
          
          // Recalculate property counts using dual status
          let vacantCount = 0;
          let leasedCount = 0;
          let maintenanceCount = 0;
          
          updatedUnits.forEach(unit => {
            const { occupancyStatus, maintenanceStatus } = getUnitStatuses(unit);
            
            if (occupancyStatus === "leased") {
              leasedCount++;
            } else {
              vacantCount++;
            }
            
            if (maintenanceStatus === "under_maintenance") {
              maintenanceCount++;
            }
          });
          
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
      
      alert(`Unit status updated successfully`);
    } catch (error) {
      console.error("Error updating unit status:", error);
      alert("Failed to update unit status");
    }
  };

  // Handle delete tenant - NEW FUNCTION (FIXED SEMICOLON ERROR)
  const handleDeleteTenant = async () => {
    if (!unitToDeleteTenant) return;
    
    try {
      const { propertyId, unitId } = unitToDeleteTenant;
      
      // Find the unit
      const propertyGroup = allUnits.find(item => item.property.id === propertyId);
      if (!propertyGroup) return;
      
      const unit = propertyGroup.units.find(u => u.id === unitId);
      if (!unit) return;
      
      // Update unit document
      const unitRef = doc(db, `properties/${propertyId}/units`, unitId);
      await updateDoc(unitRef, {
        occupancyStatus: "vacant",
        maintenanceStatus: unit.maintenanceStatus || "normal",
        status: unit.maintenanceStatus === "under_maintenance" ? "maintenance" : "vacant",
        tenantId: null,
        tenantName: null,
        tenantPhone: null,
        tenantEmail: null,
        leaseStartDate: null,
        leaseEndDate: null,
        updatedAt: new Date()
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
      
      // Update local state (FIXED: Added missing semicolon after .map())
      setAllUnits(prev => prev.map(item => {
        if (item.property.id === propertyId) {
          const updatedUnits = item.units.map(u => {
            if (u.id === unitId) {
              return { 
                ...u, 
                occupancyStatus: "vacant",
                tenantId: null,
                tenantName: null,
                tenantPhone: null,
                tenantEmail: null,
                leaseStartDate: null,
                leaseEndDate: null,
                updatedAt: new Date().toISOString()
              };
            }
            return u;
          });
          
          // Recalculate property counts
          let vacantCount = 0;
          let leasedCount = 0;
          let maintenanceCount = 0;
          
          updatedUnits.forEach(u => {
            const { occupancyStatus, maintenanceStatus } = getUnitStatuses(u);
            
            if (occupancyStatus === "leased") {
              leasedCount++;
            } else {
              vacantCount++;
            }
            
            if (maintenanceStatus === "under_maintenance") {
              maintenanceCount++;
            }
          });
          
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
      
      // Close modal and reset
      setShowDeleteTenantModal(false);
      setUnitToDeleteTenant(null);
      
      alert(`Tenant deleted and unit is now vacant`);
      
    } catch (error) {
      console.error("Error deleting tenant:", error);
      alert("Failed to delete tenant");
    }
  };

  // Handle request to delete tenant
  const handleRequestDeleteTenant = (propertyId, unitId) => {
    // Find the unit
    const propertyGroup = allUnits.find(item => item.property.id === propertyId);
    if (!propertyGroup) return;
    
    const unit = propertyGroup.units.find(u => u.id === unitId);
    if (!unit) return;
    
    const { occupancyStatus } = getUnitStatuses(unit);
    
    if (occupancyStatus !== "leased") {
      alert("Unit is not leased. No tenant to delete.");
      return;
    }
    
    setUnitToDeleteTenant({ propertyId, unitId, unit });
    setShowDeleteTenantModal(true);
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

  // Filter units - DUAL STATUS VERSION
  const filteredUnits = allUnits
    .map(item => {
      const filteredPropertyUnits = item.units.filter(unit => {
        const { displayStatus } = getUnitStatuses(unit);
        
        const matchesSearch = 
          unit.unitNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          unit.unitName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.property.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.property.address?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = 
          filterStatus === "all" || 
          displayStatus === filterStatus;
        
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

  // Get status class - DUAL STATUS VERSION
  const getStatusClass = (unitData) => {
    const { displayStatus } = getUnitStatuses(unitData);
    switch(displayStatus) {
      case "leased": return "all-units-status-leased";
      case "vacant": return "all-units-status-vacant";
      case "maintenance": return "all-units-status-maintenance";
      default: return "all-units-status-vacant";
    }
  };

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

      {/* Status Legend - UPDATED FOR LOCKED STATUS */}
      <div className="all-units-status-legend">
        <div className="all-units-legend-item">
          <div className="all-units-status-badge all-units-status-vacant">
            <FaDoorClosed /> Vacant
          </div>
          <span>Available for rent (Normal)</span>
        </div>
        <div className="all-units-legend-item">
          <div className="all-units-status-badge all-units-status-leased">
            <FaLock /> Leased
          </div>
          <span>Currently occupied (Locked)</span>
        </div>
        <div className="all-units-legend-item">
          <div className="all-units-status-badge all-units-status-maintenance">
            <FaTools /> Maintenance
          </div>
          <span>Under repair/maintenance (Vacant or Leased)</span>
        </div>
      </div>

      {/* Delete Tenant Modal */}
      {showDeleteTenantModal && unitToDeleteTenant && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Delete Tenant</h3>
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
                <h4>⚠️ Delete Tenant & Vacate Unit</h4>
                <p>
                  You are about to delete tenant <strong>{unitToDeleteTenant.unit.tenantName}</strong> from this unit.
                </p>
                <p>
                  <strong>This will:</strong>
                </p>
                <ul>
                  <li>Remove tenant from the unit</li>
                  <li>Change unit status to VACANT</li>
                  <li>Delete tenant record from system</li>
                  <li>Update vacancy counts</li>
                </ul>
                <p className="final-warning">
                  <strong>Note:</strong> This is required to change occupancy from 'Leased' to 'Vacant'.
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
                  <FaUserMinus /> Delete Tenant
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                    const { occupancyStatus, maintenanceStatus, displayStatus } = getUnitStatuses(unit);
                    const isLeased = occupancyStatus === "leased";
                    const isUnderMaintenance = maintenanceStatus === "under_maintenance";
                    const isOccupancyLocked = isLeased;
                    
                    return (
                      <div key={unit.id} className={`all-units-unit-card ${isLeased ? 'leased' : ''}`}>
                        <div className="all-units-unit-header">
                          <div>
                            <h3>{unit.unitName || `Unit ${unit.unitNumber || unit.id.substring(0, 8)}`}</h3>
                            <p className="all-units-unit-rent">
                              <FaMoneyBillWave /> {formatCurrency(unit.rentAmount || unit.monthlyRent)}/month
                            </p>
                          </div>
                          <div className={`all-units-status-badge ${getStatusClass(unit)}`}>
                            {getStatusIcon(unit)}
                            <span>{getDisplayStatusText(unit)}</span>
                            {isOccupancyLocked && <FaLock style={{ marginLeft: '4px', fontSize: '0.6rem' }} />}
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

                          {/* Status Details - LOCKED STATUS VERSION */}
                          <div className="all-units-status-details">
                            <div className="all-units-status-row">
                              <strong>Occupancy:</strong> 
                              <span>
                                {occupancyStatus.toUpperCase()}
                                {isOccupancyLocked && <FaLock style={{ marginLeft: '6px', fontSize: '0.7rem' }} title="Occupancy locked" />}
                              </span>
                            </div>
                            <div className="all-units-status-row">
                              <strong>Maintenance:</strong> 
                              <span>{isUnderMaintenance ? "Under Maintenance" : "Normal"}</span>
                            </div>
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
                            <div className="all-units-dual-status-controls">
                              <select
                                value={occupancyStatus || "vacant"}
                                onChange={(e) => handleUnitStatusUpdate(item.property.id, unit.id, "occupancy", e.target.value)}
                                className={`all-units-status-select ${getStatusClass(unit)} ${isOccupancyLocked ? 'locked' : ''}`}
                                disabled={isOccupancyLocked}
                                title={isOccupancyLocked ? "Occupancy locked while tenant exists. Delete tenant to change." : ""}
                              >
                                <option value="vacant">Vacant</option>
                                <option value="leased">Leased</option>
                              </select>
                              <select
                                value={maintenanceStatus || "normal"}
                                onChange={(e) => handleUnitStatusUpdate(item.property.id, unit.id, "maintenance", e.target.value)}
                                className={`all-units-status-select ${isUnderMaintenance ? 'all-units-status-maintenance' : ''}`}
                              >
                                <option value="normal">Normal</option>
                                <option value="under_maintenance">Under Maintenance</option>
                              </select>
                            </div>
                            {isOccupancyLocked && (
                              <div className="all-units-locked-message">
                                <small>
                                  <FaLock /> Occupancy locked. <button 
                                    type="button" 
                                    className="all-units-delete-tenant-link"
                                    onClick={() => handleRequestDeleteTenant(item.property.id, unit.id)}
                                  >
                                    Delete tenant
                                  </button> to change to vacant.
                                </small>
                              </div>
                            )}
                          </div>
                          
                          <div className="all-units-action-buttons">
                            <button 
                              className="all-units-action-btn all-units-view-btn"
                              onClick={() => handleViewUnit(item.property.id, unit.id)}
                              title="View Details"
                            >
                              <FaEye />
                            </button>
                            
                            {!isLeased ? (
                              <button 
                                className="all-units-action-btn all-units-assign-btn"
                                onClick={() => handleAssignTenant(item.property.id, unit.id)}
                                title="Assign Tenant"
                              >
                                <FaUser />
                              </button>
                            ) : (
                              <button 
                                className="all-units-action-btn all-units-delete-tenant-btn"
                                onClick={() => handleRequestDeleteTenant(item.property.id, unit.id)}
                                title="Delete Tenant"
                              >
                                <FaUserMinus />
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

      {/* Summary Stats - DUAL STATUS VERSION */}
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
                total + item.units.filter(u => {
                  const { occupancyStatus } = getUnitStatuses(u);
                  return occupancyStatus === "vacant";
                }).length, 0)}
            </span>
          </div>
          <div className="all-units-summary-stat">
            <span className="stat-label">Leased Units:</span>
            <span className="stat-value leased-count">
              {filteredUnits.reduce((total, item) => 
                total + item.units.filter(u => {
                  const { occupancyStatus } = getUnitStatuses(u);
                  return occupancyStatus === "leased";
                }).length, 0)}
            </span>
          </div>
          <div className="all-units-summary-stat">
            <span className="stat-label">Under Maintenance:</span>
            <span className="stat-value">
              {filteredUnits.reduce((total, item) => 
                total + item.units.filter(u => {
                  const { maintenanceStatus } = getUnitStatuses(u);
                  return maintenanceStatus === "under_maintenance";
                }).length, 0)}
            </span>
          </div>
        </div>
      )}

      {/* Data Health Check - LOCKED STATUS VERSION */}
      <div className="all-units-data-health">

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