// src/pages/Properties.jsx - UPDATED WITH FLEXIBLE GRID BY LANDLORD
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc 
} from "firebase/firestore";
import { db } from "../pages/firebase/firebase";
import "../styles/Properties.css";
import { 
  FaHome, 
  FaBed, 
  FaBath, 
  FaRulerCombined, 
  FaEdit, 
  FaEye,
  FaPlus,
  FaSearch,
  FaMapMarkerAlt,
  FaDoorClosed,
  FaCheckCircle,
  FaTools,
  FaUsers,
  FaUser
} from "react-icons/fa";

const Properties = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [sortedProperties, setSortedProperties] = useState([]);
  const [landlordGroups, setLandlordGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Helper function to get unit counts consistently
  const getUnitCounts = (property) => {
    const unitDetails = property.unitDetails || {};
    const totalUnits = property.units || unitDetails.totalUnits || 1;
    
    return {
      totalUnits: totalUnits,
      vacantCount: unitDetails.vacantCount || totalUnits,
      leasedCount: unitDetails.leasedCount || 0,
      maintenanceCount: unitDetails.maintenanceCount || 0
    };
  };

  // Helper function to check if property has multiple units
  const isMultiUnitProperty = (property) => {
    const { totalUnits } = getUnitCounts(property);
    return totalUnits > 1;
  };

  // Calculate occupancy rate consistently
  const calculateOccupancyRate = (property) => {
    const { totalUnits, leasedCount } = getUnitCounts(property);
    if (!totalUnits || totalUnits === 0) return 0;
    return Math.round((leasedCount / totalUnits) * 100);
  };

  // Get status badge class
  const getStatusClass = (status) => {
    const statusLower = (status || 'available').toLowerCase();
    switch(statusLower) {
      case "leased": return "properties-status-leased";
      case "vacant": return "properties-status-vacant";
      case "maintenance": return "properties-status-maintenance";
      default: return "properties-status-available";
    }
  };

  // Get status text
  const getStatusText = (status) => {
    const statusLower = (status || 'available').toLowerCase();
    switch(statusLower) {
      case "leased": return "Leased";
      case "vacant": return "Vacant";
      case "maintenance": return "Maintenance";
      case "available": return "Available";
      default: return "Available";
    }
  };

  // Function to sort properties by landlord and date
  const sortPropertiesByLandlordAndDate = (propertiesList) => {
    // First, group properties by landlord name
    const groupedByLandlord = {};
    
    propertiesList.forEach(property => {
      const landlordName = property.landlordName || "Unknown";
      if (!groupedByLandlord[landlordName]) {
        groupedByLandlord[landlordName] = [];
      }
      groupedByLandlord[landlordName].push(property);
    });
    
    // Sort properties within each landlord group by createdAt (newest first)
    Object.keys(groupedByLandlord).forEach(landlord => {
      groupedByLandlord[landlord].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA; // Newest first
      });
    });
    
    // Get an array of landlords with their newest property date
    const landlordsWithDates = Object.keys(groupedByLandlord).map(landlord => {
      // Find the newest property date for this landlord
      const newestProperty = groupedByLandlord[landlord].reduce((newest, current) => {
        const currentDate = current.createdAt ? new Date(current.createdAt).getTime() : 0;
        const newestDate = newest.createdAt ? new Date(newest.createdAt).getTime() : 0;
        return currentDate > newestDate ? current : newest;
      }, groupedByLandlord[landlord][0]);
      
      return {
        name: landlord,
        newestDate: newestProperty.createdAt ? new Date(newestProperty.createdAt).getTime() : 0,
        properties: groupedByLandlord[landlord]
      };
    });
    
    // Sort landlords by newest property date (new landlords first)
    landlordsWithDates.sort((a, b) => b.newestDate - a.newestDate);
    
    // If newest dates are equal, sort alphabetically by landlord name
    landlordsWithDates.sort((a, b) => {
      if (b.newestDate === a.newestDate) {
        return a.name.localeCompare(b.name);
      }
      return 0; // Already sorted by date
    });
    
    return landlordsWithDates;
  };

  // Get grid class based on number of properties
  const getGridClass = (propertyCount) => {
    if (propertyCount === 1) return "landlord-group-1";
    if (propertyCount === 2) return "landlord-group-2";
    if (propertyCount === 3) return "landlord-group-3";
    return "landlord-group-4plus";
  };

  // Fetch properties from Firestore
  useEffect(() => {
    fetchProperties();
  }, []);

  // Update sorted properties when properties change
  useEffect(() => {
    if (properties.length > 0) {
      const sorted = sortPropertiesByLandlordAndDate(properties);
      setLandlordGroups(sorted);
      
      // Also keep a flat array for filtering/searching
      const flatSorted = sorted.flatMap(group => group.properties);
      setSortedProperties(flatSorted);
    } else {
      setLandlordGroups([]);
      setSortedProperties([]);
    }
  }, [properties]);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, "properties"));
      const propertiesData = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Normalize unit details
        const totalUnits = data.units || data.unitDetails?.totalUnits || 1;
        const unitDetails = data.unitDetails || {};
        
        // Ensure all properties have consistent unitDetails structure
        const normalizedUnitDetails = {
          totalUnits: totalUnits,
          vacantCount: unitDetails.vacantCount || (totalUnits - (unitDetails.leasedCount || 0) - (unitDetails.maintenanceCount || 0)),
          leasedCount: unitDetails.leasedCount || 0,
          maintenanceCount: unitDetails.maintenanceCount || 0,
          occupancyRate: unitDetails.occupancyRate || 0,
          units: unitDetails.units || []
        };
        
        const property = {
          id: doc.id,
          ...data,
          // Always store units count at root level for consistency
          units: totalUnits,
          // Always have unitDetails with consistent structure
          unitDetails: normalizedUnitDetails,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          // Ensure status has a default value and is lowercase
          status: (data.status || 'available').toLowerCase()
        };
        
        propertiesData.push(property);
      });

      setProperties(propertiesData);
      
    } catch (error) {
      console.error("Error fetching properties:", error);
      alert("Failed to load properties");
    } finally {
      setLoading(false);
    }
  };

  // Filter landlord groups based on search and status
  const filteredLandlordGroups = landlordGroups.map(group => {
    const filteredProperties = group.properties.filter(property => {
      const matchesSearch = 
        property.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.landlordName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = 
        filterStatus === "all" || 
        property.status === filterStatus;
      
      return matchesSearch && matchesStatus;
    });
    
    return {
      ...group,
      properties: filteredProperties
    };
  }).filter(group => group.properties.length > 0); // Remove empty groups

  // Handle status update for entire property
  const handleStatusUpdate = async (propertyId, newStatus) => {
    try {
      const propertyRef = doc(db, "properties", propertyId);
      await updateDoc(propertyRef, {
        status: newStatus.toLowerCase(),
        updatedAt: new Date()
      });
      
      // Update local state
      setProperties(prev => prev.map(prop => 
        prop.id === propertyId ? { ...prop, status: newStatus.toLowerCase() } : prop
      ));
      
      alert(`Property status updated to ${newStatus}`);
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status");
    }
  };

  // Handle view property units
  const handleViewProperty = (propertyId) => {
    navigate(`/property/${propertyId}/units`);
  };

  // Handle edit property
  const handleEditProperty = (propertyId) => {
    navigate(`/properties/edit/${propertyId}`);
  };

  // Handle add new property
  const handleAddProperty = () => {
    navigate("/properties/add");
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchTerm("");
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
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get landlord header color based on landlord name
  const getLandlordColor = (landlordName) => {
    if (!landlordName || landlordName === "Unknown") return "#6b7280";
    
    // Generate a consistent color based on landlord name
    const colors = [
      "#4361ee", "#3a0ca3", "#7209b7", "#f72585", 
      "#4cc9f0", "#4895ef", "#560bad", "#b5179e",
      "#ff0054", "#ff5400", "#ffbd00", "#8338ec",
      "#3a86ff", "#fb5607", "#ff006e", "#ffbe0b"
    ];
    
    let hash = 0;
    for (let i = 0; i < landlordName.length; i++) {
      hash = landlordName.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  // Check if any properties match the current filters
  const hasFilteredProperties = filteredLandlordGroups.some(group => group.properties.length > 0);

  return (
    <div className="properties-container">
      {/* Header */}
      <div className="properties-header">
        <div>
          <h1>Properties</h1>
          <p className="properties-subtitle">Properties grouped by landlord, sorted by newest first</p>
        </div>
        <button className="properties-add-btn" onClick={handleAddProperty}>
          <FaPlus /> Add New Property
        </button>
      </div>

      {/* Filters and Search */}
      <div className="properties-filters-section">
        <div className="properties-search-box">
          <FaSearch className="properties-search-icon" />
          <input
            type="text"
            placeholder="Search properties by name, address, city, or landlord..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="properties-search-input"
          />
          {searchTerm && (
            <button 
              className="properties-search-clear"
              onClick={handleClearSearch}
              type="button"
            >
              ×
            </button>
          )}
        </div>
        
        <div className="properties-filter-buttons">
          <button 
            className={`properties-filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            All Properties
          </button>
          <button 
            className={`properties-filter-btn ${filterStatus === 'leased' ? 'active' : ''}`}
            onClick={() => setFilterStatus('leased')}
          >
            Leased
          </button>
          <button 
            className={`properties-filter-btn ${filterStatus === 'vacant' ? 'active' : ''}`}
            onClick={() => setFilterStatus('vacant')}
          >
            Vacant
          </button>
          <button 
            className={`properties-filter-btn ${filterStatus === 'maintenance' ? 'active' : ''}`}
            onClick={() => setFilterStatus('maintenance')}
          >
            Maintenance
          </button>
        </div>
      </div>

      {/* Properties List */}
      <div className="properties-list">
        {loading ? (
          <div className="properties-loading-container">
            <div className="properties-spinner"></div>
            <p>Loading properties...</p>
          </div>
        ) : !hasFilteredProperties ? (
          <div className="properties-empty-state">
            <FaHome className="properties-empty-icon" />
            <h3>No properties found</h3>
            <p>{searchTerm || filterStatus !== 'all' ? 'Try changing your search or filter' : 'Add your first property to get started'}</p>
            {!searchTerm && filterStatus === 'all' && (
              <button className="properties-add-btn" onClick={handleAddProperty}>
                <FaPlus /> Add New Property
              </button>
            )}
          </div>
        ) : (
          <div className="properties-grid">
            {filteredLandlordGroups.map((landlordGroup, groupIndex) => (
              <React.Fragment key={`landlord-${landlordGroup.name}-${groupIndex}`}>
                {/* Landlord Header */}
                <div className="properties-landlord-header" style={{
                  backgroundColor: getLandlordColor(landlordGroup.name) + '10',
                  borderLeft: `4px solid ${getLandlordColor(landlordGroup.name)}`
                }}>
                  <div className="properties-landlord-header-content">
                    <FaUser style={{ color: getLandlordColor(landlordGroup.name) }} />
                    <h3>{landlordGroup.name || "Unknown Landlord"}</h3>
                    <span className="properties-landlord-count">
                      {landlordGroup.properties.length} 
                      {landlordGroup.properties.length === 1 ? ' property' : ' properties'}
                    </span>
                  </div>
                </div>
                
                {/* Properties Grid for this Landlord */}
                <div className={`landlord-group ${getGridClass(landlordGroup.properties.length)}`}>
                  {landlordGroup.properties.map((property) => {
                    const { totalUnits, vacantCount, leasedCount, maintenanceCount } = getUnitCounts(property);
                    const occupancyRate = calculateOccupancyRate(property);
                    
                    return (
                      <div key={property.id} className="properties-card">
                        {/* Property Image */}
                        <div className="properties-image">
                          {property.images && property.images.length > 0 ? (
                            <img src={property.images[0]} alt={property.name} />
                          ) : (
                            <div className="properties-no-image">
                              <FaHome />
                              <p>No Image</p>
                            </div>
                          )}
                          <div className={`properties-status-badge ${getStatusClass(property.status)}`}>
                            {getStatusText(property.status)}
                          </div>
                          
                          {/* Occupancy Badge - Show only for multi-unit properties */}
                          {isMultiUnitProperty(property) && (
                            <div className="properties-occupancy-badge">
                              {occupancyRate}% Occupied
                            </div>
                          )}
                        </div>

                        {/* Property Details */}
                        <div className="properties-details">
                          <div className="properties-card-header">
                            <h3>{property.name || "Unnamed Property"}</h3>
                            <div className="properties-price">
                              {formatCurrency(property.rentAmount)}/month
                            </div>
                          </div>
                          
                          <div className="properties-location">
                            <FaMapMarkerAlt />
                            <span>{property.address || "No address"}, {property.city || "Unknown city"}</span>
                          </div>
                          
                          <div className="properties-specs">
                            <div className="properties-spec">
                              <FaBed />
                              <span>{property.bedrooms || 1} Bed</span>
                            </div>
                            <div className="properties-spec">
                              <FaBath />
                              <span>{property.bathrooms || 1} Bath</span>
                            </div>
                            <div className="properties-spec">
                              <FaHome />
                              <span>
                                {totalUnits} Unit{totalUnits !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {property.size && (
                              <div className="properties-spec">
                                <FaRulerCombined />
                                <span>{property.size} sq ft</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Unit Statistics - Unified Approach */}
                          {isMultiUnitProperty(property) ? (
                            // Multi-unit properties: Show detailed statistics
                            <div className="properties-unit-stats">
                              <div className="properties-unit-stats-header">
                                <span className="properties-unit-stats-title">Unit Status:</span>
                                <div className="properties-unit-stats-container">
                                  {/* Vacant Units - Always show */}
                                  <div className="properties-unit-stat-item vacant">
                                    <FaDoorClosed className="properties-unit-stat-icon" />
                                    <span className="properties-unit-stat-count">{vacantCount}</span>
                                    <span className="properties-unit-stat-label">Vacant</span>
                                  </div>
                                  
                                  {/* Leased Units - Show if any */}
                                  {leasedCount > 0 && (
                                    <div className="properties-unit-stat-item leased">
                                      <FaCheckCircle className="properties-unit-stat-icon" />
                                      <span className="properties-unit-stat-count">{leasedCount}</span>
                                      <span className="properties-unit-stat-label">Leased</span>
                                    </div>
                                  )}
                                  
                                  {/* Maintenance Units - Show if any */}
                                  {maintenanceCount > 0 && (
                                    <div className="properties-unit-stat-item maintenance">
                                      <FaTools className="properties-unit-stat-icon" />
                                      <span className="properties-unit-stat-count">{maintenanceCount}</span>
                                      <span className="properties-unit-stat-label">Maintenance</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Vacancy Alert - Show if there are vacant units */}
                              {vacantCount > 0 && (
                                <div className="properties-vacancy-alert">
                                  <div className="properties-vacancy-alert-content">
                                    <FaDoorClosed className="properties-vacancy-icon" />
                                    <div className="properties-vacancy-text">
                                      <strong>{vacantCount} units available</strong> for rent
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {/* Occupancy Summary */}
                              <div className="properties-occupancy-summary">
                                <div className="properties-occupancy-bar">
                                  <div 
                                    className="properties-occupancy-fill"
                                    style={{ width: `${occupancyRate}%` }}
                                  ></div>
                                </div>
                                <div className="properties-occupancy-info">
                                  <span className="properties-occupancy-text">
                                    {occupancyRate}% Occupancy Rate
                                  </span>
                                  <span className="properties-tenants-count">
                                    <FaUsers /> {leasedCount} {leasedCount === 1 ? 'Tenant' : 'Tenants'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            // Single-unit properties: Show simplified status
                            <div className="properties-single-unit-status">
                              <div className="properties-single-unit-badge">
                                <span className="properties-single-unit-label">Single Unit Property</span>
                                <span className={`properties-single-unit-status-badge ${property.status}`}>
                                  {getStatusText(property.status)}
                                </span>
                              </div>
                              {property.status?.toLowerCase() === 'vacant' && (
                                <div className="properties-single-unit-vacant">
                                  <FaDoorClosed /> Available for immediate occupancy
                                </div>
                              )}
                            </div>
                          )}
                          
                          <div className="properties-card-info">
                            <div className="properties-info-row">
                              <span className="properties-label">Type:</span>
                              <span className="properties-value">
                                {property.propertyType || property.type || "Apartment"}
                              </span>
                            </div>
                            <div className="properties-info-row">
                              <span className="properties-label">Landlord:</span>
                              <span className="properties-value" style={{ color: getLandlordColor(property.landlordName), fontWeight: '600' }}>
                                {property.landlordName || "Unknown"}
                              </span>
                            </div>
                            <div className="properties-info-row">
                              <span className="properties-label">Added:</span>
                              <span className="properties-value">
                                {formatDate(property.createdAt)}
                              </span>
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="properties-card-actions">
                            <div className="properties-status-container">
                              <span className="properties-status-label">Property Status:</span>
                              <select
                                value={property.status || "available"}
                                onChange={(e) => handleStatusUpdate(property.id, e.target.value)}
                                className={`properties-status-select ${getStatusClass(property.status)}`}
                              >
                                <option value="available">Available</option>
                                <option value="leased">Leased</option>
                                <option value="vacant">Vacant</option>
                                <option value="maintenance">Maintenance</option>
                              </select>
                            </div>
                            
                            <div className="properties-action-buttons">
                              <button 
                                className="properties-action-btn properties-view-btn"
                                onClick={() => handleViewProperty(property.id)}
                              >
                                <FaEye /> View Units
                              </button>
                              <button 
                                className="properties-action-btn properties-edit-btn"
                                onClick={() => handleEditProperty(property.id)}
                              >
                                <FaEdit /> Edit
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Properties;