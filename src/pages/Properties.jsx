// src/pages/Properties.jsx - COMPLETE FIXED VACANT/MAINTENANCE LOGIC
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
  query,
  where
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
  FaUser,
  FaMoneyBillWave,
  FaFileSignature,
  FaPaw,
  FaClock,
  FaTint,
  FaBolt,
  FaWifi,
  FaWrench,
  FaTrash,
  FaExclamationTriangle,
  FaInfoCircle
} from "react-icons/fa";

const Properties = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [sortedProperties, setSortedProperties] = useState([]);
  const [landlordGroups, setLandlordGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState("");

  // Helper function to get unit counts - FIXED LOGIC
  const getUnitCounts = (property) => {
    const unitDetails = property.unitDetails || {};

    const totalUnits = property.units || unitDetails.totalUnits || 1;
    const leasedCount = unitDetails.leasedCount || 0;
    const maintenanceCount = unitDetails.maintenanceCount || 0;
    const vacantUnderMaintenance = unitDetails.vacantUnderMaintenance || 0;
    const leasedUnderMaintenance = unitDetails.leasedUnderMaintenance || 0;

    // ⭐ CORE LOGIC: Vacant = Total - Leased (ALWAYS!)
    const vacantCount = Math.max(0, totalUnits - leasedCount);

    return {
      totalUnits,
      vacantCount,  // Always = Total - Leased
      leasedCount,  // Includes leased units under maintenance
      maintenanceCount,  // Total maintenance (leased + vacant)
      vacantUnderMaintenance,  // Vacant units that need maintenance
      leasedUnderMaintenance   // Leased units that need maintenance
    };
  };

  // Helper function to check if property has multiple units
  const isMultiUnitProperty = (property) => {
    const { totalUnits } = getUnitCounts(property);
    return totalUnits > 1;
  };

  // Calculate occupancy rate
  const calculateOccupancyRate = (property) => {
    const { totalUnits, leasedCount } = getUnitCounts(property);
    if (!totalUnits || totalUnits === 0) return 0;
    return Math.round((leasedCount / totalUnits) * 100);
  };

  // Get proper bedroom display text
  const getBedroomDisplayText = (property) => {
    const bedrooms = property.bedrooms || 0;

    if (property.propertyType === "single" || property.propertyType === "bedsitter") {
      return "Studio";
    }

    if (property.propertyType === "commercial" && bedrooms === 0) {
      return "Commercial";
    }

    return `${bedrooms} Bed${bedrooms !== 1 ? 's' : ''}`;
  };

  // Get proper bathroom display text
  const getBathroomDisplayText = (property) => {
    const bathrooms = property.bathrooms || 0;

    if (property.propertyType === "commercial") {
      return bathrooms > 0 ? `${bathrooms} Bath${bathrooms !== 1 ? 's' : ''}` : "Shared";
    }

    if (property.propertyType === "single" || property.propertyType === "bedsitter") {
      return "1 Bath";
    }

    return `${bathrooms} Bath${bathrooms !== 1 ? 's' : ''}`;
  };

  // Get status badge class
  const getStatusClass = (status) => {
    const statusLower = (status || 'available').toLowerCase();
    switch (statusLower) {
      case "leased": return "properties-status-leased";
      case "vacant": return "properties-status-vacant";
      case "maintenance": return "properties-status-maintenance";
      default: return "properties-status-available";
    }
  };

  // Get status text
  const getStatusText = (status) => {
    const statusLower = (status || 'available').toLowerCase();
    switch (statusLower) {
      case "leased": return "Leased";
      case "vacant": return "Vacant";
      case "maintenance": return "Maintenance";
      case "available": return "Available";
      default: return "Available";
    }
  };

  // Function to sort properties by landlord and date
  const sortPropertiesByLandlordAndDate = (propertiesList) => {
    const groupedByLandlord = {};

    propertiesList.forEach(property => {
      const landlordName = property.landlordName || "Unknown";
      if (!groupedByLandlord[landlordName]) {
        groupedByLandlord[landlordName] = [];
      }
      groupedByLandlord[landlordName].push(property);
    });

    Object.keys(groupedByLandlord).forEach(landlord => {
      groupedByLandlord[landlord].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    });

    const landlordsWithDates = Object.keys(groupedByLandlord).map(landlord => {
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

    landlordsWithDates.sort((a, b) => b.newestDate - a.newestDate);

    landlordsWithDates.sort((a, b) => {
      if (b.newestDate === a.newestDate) {
        return a.name.localeCompare(b.name);
      }
      return 0;
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

      const flatSorted = sorted.flatMap(group => group.properties);
      setSortedProperties(flatSorted);
    } else {
      setLandlordGroups([]);
      setSortedProperties([]);
    }
  }, [properties]);

  // FIXED: Calculate unit counts with maintenance as sub-status
  const calculateUnitCountsFromSubcollection = (unitsSnapshot) => {
    let totalUnits = unitsSnapshot.size;
    let leasedCount = 0;
    let maintenanceCount = 0;
    let leasedUnderMaintenance = 0;
    let vacantUnderMaintenance = 0;

    unitsSnapshot.forEach((unitDoc) => {
      const unitData = unitDoc.data();
      const status = (unitData.status || 'vacant').toLowerCase();

      // Check if unit is under maintenance
      const isUnderMaintenance = status === 'maintenance' || status === 'repair';
      const isLeased = status === 'leased' || status === 'occupied' || status === 'rented';

      if (isUnderMaintenance) {
        maintenanceCount++;  // TOTAL maintenance count (leased + vacant)

        // Determine if it's a LEASED or VACANT unit under maintenance
        if (isLeased || unitData.tenantId || unitData.leaseStatus === 'active') {
          leasedUnderMaintenance++;
          leasedCount++;  // Count as leased
        } else {
          vacantUnderMaintenance++;
          // Vacant under maintenance - doesn't affect leased count
        }
      } else if (isLeased) {
        leasedCount++;  // Regular leased unit (not under maintenance)
      }
      // Vacant units (not under maintenance) - don't need to count here
    });

    // Vacant count = Total - Leased (ALWAYS!)
    const vacantCount = totalUnits - leasedCount;

    return {
      totalUnits,
      vacantCount,  // Total - Leased (ALWAYS!)
      leasedCount,  // Includes leased units under maintenance
      maintenanceCount,  // TOTAL maintenance (leased + vacant)
      leasedUnderMaintenance,  // How many leased units are under maintenance
      vacantUnderMaintenance   // How many vacant units are under maintenance
    };
  };

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, "properties"));
      const propertiesData = [];

      for (const docItem of querySnapshot.docs) {
        const data = docItem.data();
        const propertyId = docItem.id;

        try {
          // Fetch actual unit counts from subcollection
          const unitsRef = collection(db, `properties/${propertyId}/units`);
          const unitsSnapshot = await getDocs(unitsRef);

          // Calculate counts with FIXED logic
          const {
            totalUnits,
            vacantCount,
            leasedCount,
            maintenanceCount,
            leasedUnderMaintenance,
            vacantUnderMaintenance
          } = calculateUnitCountsFromSubcollection(unitsSnapshot);

          // Debug logging
          console.log(`Property: ${data.name || propertyId}`);
          console.log(`  Total Units: ${totalUnits}`);
          console.log(`  Leased: ${leasedCount} (${leasedUnderMaintenance} under maintenance)`);
          console.log(`  Vacant: ${vacantCount} (${vacantUnderMaintenance} under maintenance)`);
          console.log(`  TOTAL Under Maintenance: ${maintenanceCount}`);

          // Create normalized unit details
          const unitDetails = data.unitDetails || {};

          const normalizedUnitDetails = {
            totalUnits: totalUnits,
            vacantCount: vacantCount,  // Total - Leased
            leasedCount: leasedCount,  // Includes leased under maintenance
            maintenanceCount: maintenanceCount,  // TOTAL maintenance
            leasedUnderMaintenance: leasedUnderMaintenance,
            vacantUnderMaintenance: vacantUnderMaintenance,
            occupancyRate: totalUnits > 0 ? Math.round((leasedCount / totalUnits) * 100) : 0,
            units: unitDetails.units || []
          };

          // Determine overall property status
          let overallStatus = data.status || 'available';

          if (leasedCount === totalUnits) {
            overallStatus = 'leased';
          } else if (leasedCount === 0) {
            overallStatus = 'vacant';
          } else if (maintenanceCount > 0) {
            overallStatus = 'maintenance';
          }

          const property = {
            id: propertyId,
            ...data,
            units: totalUnits,
            unitDetails: normalizedUnitDetails,
            applicationFee: data.applicationFee || 0,
            securityDeposit: data.securityDeposit || 0,
            petDeposit: data.petDeposit || 0,
            otherFees: data.otherFees || "",
            leaseTerm: data.leaseTerm || 12,
            noticePeriod: data.noticePeriod || 30,
            latePaymentFee: data.latePaymentFee || 0,
            gracePeriod: data.gracePeriod || 5,
            feeDetails: data.feeDetails || {
              includesWater: false,
              includesElectricity: false,
              includesInternet: false,
              includesMaintenance: false
            },
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            status: overallStatus.toLowerCase()
          };

          propertiesData.push(property);

        } catch (error) {
          console.error(`Error fetching units for property ${propertyId}:`, error);

          // Fallback to stored data
          const totalUnits = data.units || data.unitDetails?.totalUnits || 1;
          const unitDetails = data.unitDetails || {};

          const leasedCount = unitDetails.leasedCount || 0;
          const maintenanceCount = unitDetails.maintenanceCount || 0;

          // Apply new logic
          const vacantCount = Math.max(0, totalUnits - leasedCount);

          const normalizedUnitDetails = {
            totalUnits: totalUnits,
            vacantCount: vacantCount,
            leasedCount: leasedCount,
            maintenanceCount: maintenanceCount,
            leasedUnderMaintenance: unitDetails.leasedUnderMaintenance || 0,
            vacantUnderMaintenance: unitDetails.vacantUnderMaintenance || 0,
            occupancyRate: totalUnits > 0 ? Math.round((leasedCount / totalUnits) * 100) : 0,
            units: unitDetails.units || []
          };

          const property = {
            id: propertyId,
            ...data,
            units: totalUnits,
            unitDetails: normalizedUnitDetails,
            applicationFee: data.applicationFee || 0,
            securityDeposit: data.securityDeposit || 0,
            petDeposit: data.petDeposit || 0,
            otherFees: data.otherFees || "",
            leaseTerm: data.leaseTerm || 12,
            noticePeriod: data.noticePeriod || 30,
            latePaymentFee: data.latePaymentFee || 0,
            gracePeriod: data.gracePeriod || 5,
            feeDetails: data.feeDetails || {
              includesWater: false,
              includesElectricity: false,
              includesInternet: false,
              includesMaintenance: false
            },
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            status: (data.status || 'available').toLowerCase()
          };

          propertiesData.push(property);
        }
      }

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
  }).filter(group => group.properties.length > 0);

  // Handle status update for entire property
  const handleStatusUpdate = async (propertyId, newStatus) => {
    try {
      const propertyRef = doc(db, "properties", propertyId);
      await updateDoc(propertyRef, {
        status: newStatus.toLowerCase(),
        updatedAt: new Date()
      });

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

  // Handle delete property confirmation
  const handleDeleteProperty = (property) => {
    setPropertyToDelete(property);
    setShowDeleteModal(true);
  };

  // Handle confirm delete property
  const handleConfirmDelete = async () => {
    if (!propertyToDelete) return;

    try {
      setDeleting(true);
      setDeleteProgress("Starting deletion process...");

      const propertyId = propertyToDelete.id;
      const propertyName = propertyToDelete.name || "Unnamed Property";

      setDeleteProgress(`Finding all related data for ${propertyName}...`);

      const [tenantsSnapshot, usersSnapshot, unitsSnapshot] = await Promise.all([
        getDocs(collection(db, "tenants")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, `properties/${propertyId}/units`))
      ]);

      const deletions = [];
      let tenantsDeleted = 0;
      let usersDeleted = 0;
      let unitsDeleted = 0;

      tenantsSnapshot.forEach((tenantDoc) => {
        const tenantData = tenantDoc.data();
        if (tenantData.propertyId === propertyId) {
          deletions.push(deleteDoc(doc(db, "tenants", tenantDoc.id)));
          tenantsDeleted++;
        }
      });

      usersSnapshot.forEach((userDoc) => {
        const userData = userDoc.data();
        if (userData.propertyId === propertyId) {
          deletions.push(deleteDoc(doc(db, "users", userDoc.id)));
          usersDeleted++;
        }
      });

      const unitIds = [];
      unitsSnapshot.forEach((unitDoc) => {
        unitIds.push(unitDoc.id);
      });

      tenantsSnapshot.forEach((tenantDoc) => {
        const tenantData = tenantDoc.data();
        if (tenantData.unitId && unitIds.includes(tenantData.unitId) && !deletions.some(d => d.id === tenantDoc.id)) {
          deletions.push(deleteDoc(doc(db, "tenants", tenantDoc.id)));
          tenantsDeleted++;
        }
      });

      usersSnapshot.forEach((userDoc) => {
        const userData = userDoc.data();
        if (userData.unitId && unitIds.includes(userData.unitId) && !deletions.some(d => d.id === userDoc.id)) {
          deletions.push(deleteDoc(doc(db, "users", userDoc.id)));
          usersDeleted++;
        }
      });

      unitsSnapshot.forEach((unitDoc) => {
        deletions.push(deleteDoc(doc(db, `properties/${propertyId}/units`, unitDoc.id)));
        unitsDeleted++;
      });

      deletions.push(deleteDoc(doc(db, "properties", propertyId)));

      if (deletions.length > 0) {
        setDeleteProgress(`Deleting ${deletions.length} items (${tenantsDeleted} tenants, ${usersDeleted} users, ${unitsDeleted} units)...`);
        await Promise.all(deletions);
        console.log(`Deleted ${deletions.length} items: ${tenantsDeleted} tenants, ${usersDeleted} users, ${unitsDeleted} units, 1 property`);
      }

      setProperties(prev => prev.filter(prop => prop.id !== propertyId));
      setSortedProperties(prev => prev.filter(prop => prop.id !== propertyId));

      setShowDeleteModal(false);
      setPropertyToDelete(null);
      setDeleting(false);
      setDeleteProgress("");

      alert(`✅ Property "${propertyName}" and all associated data have been deleted successfully.\n\nDeleted: ${tenantsDeleted} tenants, ${usersDeleted} users, ${unitsDeleted} units`);

    } catch (error) {
      console.error("Error deleting property:", error);
      alert(`Failed to delete property: ${error.message}`);
      setDeleting(false);
      setDeleteProgress("");
    }
  };

  // Handle cancel delete
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setPropertyToDelete(null);
    setDeleteProgress("");
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
      {/* Delete Confirmation Modal */}
      {showDeleteModal && propertyToDelete && (
        <div className="modal-overlay">
          <div className="modal-content delete-modal">
            <div className="modal-header">
              <FaExclamationTriangle className="modal-warning-icon" />
              <h3>Delete Property</h3>
              <button
                className="close-modal"
                onClick={handleCancelDelete}
                disabled={deleting}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="delete-warning">
                <p>
                  <strong>Warning:</strong> This action cannot be undone!
                </p>
                <p>You are about to delete:</p>

                <div className="property-to-delete-info">
                  <h4>{propertyToDelete.name || "Unnamed Property"}</h4>
                  <div className="delete-stats">
                    <div className="delete-stat">
                      <span className="stat-label">Units:</span>
                      <span className="stat-value">
                        {propertyToDelete.unitDetails?.totalUnits || propertyToDelete.units || 0}
                      </span>
                    </div>
                    <div className="delete-stat">
                      <span className="stat-label">Tenants:</span>
                      <span className="stat-value leased-count">
                        {propertyToDelete.unitDetails?.leasedCount || 0}
                      </span>
                    </div>
                    <div className="delete-stat">
                      <span className="stat-label">Monthly Revenue:</span>
                      <span className="stat-value">
                        {formatCurrency(propertyToDelete.monthlyRevenue || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="delete-consequences">
                  <p><strong>This will permanently delete:</strong></p>
                  <ul>
                    <li>The property record</li>
                    <li>All units in this property</li>
                    <li>All tenant records associated with this property</li>
                    <li>All user records associated with this property</li>
                    <li>All payment history for these tenants</li>
                    <li>Any application records for this property</li>
                  </ul>
                </div>

                {deleting && (
                  <div className="delete-progress">
                    <div className="progress-spinner"></div>
                    <p>{deleteProgress}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="modal-btn cancel-btn"
                onClick={handleCancelDelete}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="modal-btn delete-confirm-btn"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <span className="spinner-small"></span>
                    Deleting...
                  </>
                ) : (
                  <>
                    <FaTrash /> Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
                    const {
                      totalUnits,
                      vacantCount,
                      leasedCount,
                      maintenanceCount,
                      vacantUnderMaintenance,
                      leasedUnderMaintenance
                    } = getUnitCounts(property);
                    const occupancyRate = calculateOccupancyRate(property);

                    return (
                      <div key={property.id} className="properties-card">
                        {/* Property Image */}
                        <div className="properties-image">
                          {property.images && property.images.length > 0 ? (
                            <>
                              <div
                                className="properties-image-bg"
                                style={{ backgroundImage: `url(${property.images[0]})` }}
                              ></div>
                              <img src={property.images[0]} alt={property.name} />
                            </>
                          ) : (
                            <div className="properties-no-image">
                              <FaHome />
                              <p>No Image</p>
                            </div>
                          )}
                          <div className={`properties-status-badge ${getStatusClass(property.status)}`}>
                            {getStatusText(property.status)}
                          </div>

                          {/* Occupancy Badge */}
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

                          {/* Bedroom/Bathroom Display */}
                          <div className="properties-specs">
                            <div className="properties-spec">
                              <FaBed />
                              <span>{getBedroomDisplayText(property)}</span>
                            </div>
                            <div className="properties-spec">
                              <FaBath />
                              <span>{getBathroomDisplayText(property)}</span>
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

                          {/* Fee Information */}
                          <div className="properties-card-info properties-fees-info">
                            <div className="properties-info-row">
                              <span className="properties-label">
                                <FaMoneyBillWave className="properties-fee-icon" /> Security Deposit
                              </span>
                              <span className="properties-value properties-fee-amount">
                                {formatCurrency(property.securityDeposit) || "Not set"}
                              </span>
                            </div>
                            <div className="properties-info-row">
                              <span className="properties-label">
                                <FaFileSignature className="properties-fee-icon" /> Application Fee
                              </span>
                              <span className="properties-value properties-fee-amount">
                                {formatCurrency(property.applicationFee) || "Not set"}
                              </span>
                            </div>
                            {property.petDeposit > 0 && (
                              <div className="properties-info-row">
                                <span className="properties-label">
                                  <FaPaw className="properties-fee-icon" /> Pet Deposit
                                </span>
                                <span className="properties-value properties-fee-amount">
                                  {formatCurrency(property.petDeposit)}
                                </span>
                              </div>
                            )}
                            {property.leaseTerm && (
                              <div className="properties-info-row">
                                <span className="properties-label">
                                  <FaClock className="properties-fee-icon" /> Lease Term
                                </span>
                                <span className="properties-value">
                                  {property.leaseTerm} months
                                </span>
                              </div>
                            )}
                          </div>

                          {/* What's Included Section */}
                          {property.feeDetails && (
                            <div className="properties-card-info properties-included-info">
                              <div className="properties-label properties-included-label">What's Included:</div>
                              <div className="properties-included-items">
                                {property.feeDetails.includesWater && (
                                  <span className="properties-included-item">
                                    <FaTint className="properties-included-icon" /> Water
                                  </span>
                                )}
                                {property.feeDetails.includesElectricity && (
                                  <span className="properties-included-item">
                                    <FaBolt className="properties-included-icon" /> Electricity
                                  </span>
                                )}
                                {property.feeDetails.includesInternet && (
                                  <span className="properties-included-item">
                                    <FaWifi className="properties-included-icon" /> Internet
                                  </span>
                                )}
                                {property.feeDetails.includesMaintenance && (
                                  <span className="properties-included-item">
                                    <FaWrench className="properties-included-icon" /> Maintenance
                                  </span>
                                )}
                                {!property.feeDetails.includesWater &&
                                  !property.feeDetails.includesElectricity &&
                                  !property.feeDetails.includesInternet &&
                                  !property.feeDetails.includesMaintenance && (
                                    <span className="properties-included-item properties-included-none">
                                      No utilities included
                                    </span>
                                  )}
                              </div>
                            </div>
                          )}

                          {/* Late Payment Info */}
                          {property.latePaymentFee > 0 && (
                            <div className="properties-card-info properties-late-payment-info">
                              <div className="properties-info-row">
                                <span className="properties-label">
                                  <FaClock className="properties-fee-icon" /> Late Payment Fee
                                </span>
                                <span className="properties-value properties-fee-warning">
                                  {formatCurrency(property.latePaymentFee)} per day
                                  {property.gracePeriod > 0 && (
                                    <span className="properties-grace-period">
                                      (After {property.gracePeriod} days grace)
                                    </span>
                                  )}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Unit Statistics - FIXED DISPLAY */}
                          {isMultiUnitProperty(property) ? (
                            <div className="properties-unit-stats">
                              <div className="properties-unit-stats-header">
                                <span className="properties-unit-stats-title">Unit Status:</span>
                                <div className="properties-unit-stats-container">
                                  {/* Vacant Units - ALWAYS show */}
                                  <div className="properties-unit-stat-item vacant">
                                    <FaDoorClosed className="properties-unit-stat-icon" />
                                    <span className="properties-unit-stat-count">{vacantCount}</span>
                                    <span className="properties-unit-stat-label">Vacant</span>
                                    {vacantUnderMaintenance > 0 && (
                                      <div className="properties-unit-stat-note">
                                        ({vacantUnderMaintenance} under maintenance)
                                      </div>
                                    )}
                                  </div>

                                  {/* Leased Units - Show if any */}
                                  {leasedCount > 0 && (
                                    <div className="properties-unit-stat-item leased">
                                      <FaCheckCircle className="properties-unit-stat-icon" />
                                      <span className="properties-unit-stat-count">{leasedCount}</span>
                                      <span className="properties-unit-stat-label">Leased</span>
                                      {leasedUnderMaintenance > 0 && (
                                        <div className="properties-unit-stat-note">
                                          ({leasedUnderMaintenance} under maintenance)
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Total Maintenance Counter */}
                                  {maintenanceCount > 0 && (
                                    <div className="properties-unit-stat-item maintenance-total">
                                      <FaTools className="properties-unit-stat-icon" />
                                      <span className="properties-unit-stat-count">{maintenanceCount}</span>
                                      <span className="properties-unit-stat-label">Total Under Maintenance</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Summary Box */}
                              <div className="properties-unit-summary">
                                <FaInfoCircle className="properties-summary-icon" />
                                <div className="properties-summary-content">
                                  <strong>Summary:</strong>
                                  <div className="properties-summary-details">
                                    • {leasedCount} leased ({leasedUnderMaintenance} in maintenance)<br />
                                    • {vacantCount} vacant ({vacantUnderMaintenance} in maintenance)<br />
                                    • <strong>Total under maintenance: {maintenanceCount}</strong>
                                  </div>
                                </div>
                              </div>

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
                            // Single-unit properties
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
                              <button
                                className="properties-action-btn properties-delete-btn"
                                onClick={() => handleDeleteProperty(property)}
                                title="Delete Property"
                              >
                                <FaTrash />
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