// src/pages/LandlordDetails.jsx - UPDATED WITH UNIQUE CLASSES
import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  updateDoc 
} from "firebase/firestore";
import { db } from "../pages/firebase/firebase";
import "../styles/LandlordDetails.css";
import { 
  FaArrowLeft, 
  FaEdit, 
  FaEnvelope, 
  FaPhone, 
  FaHome, 
  FaMapMarkerAlt,
  FaBuilding,
  FaUserCheck,
  FaCalendar,
  FaEye,
  FaTrash,
  FaToggleOn,
  FaToggleOff,
  FaWhatsapp,
  FaIdCard,
  FaRegBuilding
} from "react-icons/fa";

const LandlordDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [landlord, setLandlord] = useState(null);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [activeTab, setActiveTab] = useState("properties"); // "properties" or "details"

  useEffect(() => {
    fetchLandlordAndProperties();
  }, [id]);

  const fetchLandlordAndProperties = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch landlord details
      const landlordDoc = await getDoc(doc(db, "landlords", id));
      
      if (!landlordDoc.exists()) {
        console.log("Landlord not found, trying fallback to users collection...");
        const userDoc = await getDoc(doc(db, "users", id));
        if (!userDoc.exists()) {
          throw new Error("Landlord not found");
        }
        const userData = userDoc.data();
        setLandlord({
          id: userDoc.id,
          ...userData,
          name: userData.name || `${userData.firstName || ""} ${userData.lastName || ""}`.trim(),
          createdAt: userData.createdAt?.toDate() || new Date()
        });
      } else {
        const landlordData = landlordDoc.data();
        setLandlord({
          id: landlordDoc.id,
          ...landlordData,
          name: landlordData.name || `${landlordData.firstName || ""} ${landlordData.lastName || ""}`.trim(),
          createdAt: landlordData.createdAt?.toDate() || new Date(),
          lastLogin: landlordData.lastLogin?.toDate() || null,
          updatedAt: landlordData.updatedAt?.toDate() || null
        });
      }
      
      // 2. Fetch properties for this landlord
      const propertiesQuery = query(
        collection(db, "properties"),
        where("landlordId", "==", id)
      );
      
      const propertiesSnapshot = await getDocs(propertiesQuery);
      const propertiesData = [];
      
      propertiesSnapshot.forEach((doc) => {
        const data = doc.data();
        propertiesData.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          // Calculate occupancy rate for property card
          occupancyRate: data.unitDetails?.leasedCount && data.unitDetails?.totalUnits 
            ? Math.round((data.unitDetails.leasedCount / data.unitDetails.totalUnits) * 100)
            : 0
        });
      });
      
      setProperties(propertiesData);
      
    } catch (error) {
      console.error("Error fetching landlord details:", error);
      alert("Failed to load landlord details");
      navigate("/landlords");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async () => {
    if (!landlord) return;
    
    try {
      setUpdatingStatus(true);
      const newStatus = landlord.status === "active" ? "inactive" : "active";
      
      await updateDoc(doc(db, "landlords", id), {
        status: newStatus,
        updatedAt: new Date()
      });
      
      setLandlord(prev => ({ ...prev, status: newStatus }));
      alert(`Landlord status updated to ${newStatus}`);
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleEdit = () => {
    navigate(`/landlords/edit/${id}`);
  };

  const handleViewProperty = (propertyId) => {
    navigate(`/property/${propertyId}/units`);
  };

  const formatDate = (date) => {
    if (!date) return "Not available";
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (date) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateTotalRevenue = () => {
    return properties.reduce((total, property) => {
      const leasedUnits = property.unitDetails?.leasedCount || 0;
      const rentAmount = property.rentAmount || 0;
      return total + (leasedUnits * rentAmount);
    }, 0);
  };

  if (loading) {
    return (
      <div className="landlord-details-container">
        <div className="landlord-details-loading-container">
          <div className="landlord-details-loading-spinner"></div>
          <p>Loading landlord details...</p>
        </div>
      </div>
    );
  }

  if (!landlord) {
    return (
      <div className="landlord-details-container">
        <div className="landlord-details-empty-state">
          <h3>Landlord Not Found</h3>
          <p>The landlord you're looking for doesn't exist.</p>
          <button onClick={() => navigate("/landlords")} className="landlord-details-back-btn">
            <FaArrowLeft /> Back to Landlords
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="landlord-details-container">
      {/* Header with back button */}
      <div className="landlord-details-header">
        <button onClick={() => navigate("/landlords")} className="landlord-details-back-btn">
          <FaArrowLeft /> Back to Landlords
        </button>
        
        <div className="landlord-details-header-actions">
          <button 
            className={`landlord-details-status-toggle ${landlord.status}`}
            onClick={handleStatusToggle}
            disabled={updatingStatus}
          >
            {updatingStatus ? (
              "Updating..."
            ) : (
              <>
                {landlord.status === "active" ? <FaToggleOn /> : <FaToggleOff />}
                {landlord.status === "active" ? "Active" : "Inactive"}
              </>
            )}
          </button>
          <button className="landlord-details-edit-btn" onClick={handleEdit}>
            <FaEdit /> Edit Landlord
          </button>
        </div>
      </div>

      {/* Landlord Info Card */}
      <div className="landlord-info-card">
        <div className="landlord-avatar">
          <div className="avatar-circle">
            {landlord.name.charAt(0).toUpperCase()}
          </div>
          <div className="landlord-verification-badge">
            {landlord.isVerified ? (
              <span className="verified">✓ Verified</span>
            ) : (
              <span className="not-verified">Not Verified</span>
            )}
          </div>
        </div>
        
        <div className="landlord-basic-info">
          <h1>{landlord.name}</h1>
          
          <div className="landlord-meta">
            <span className={`landlord-status-badge ${landlord.status}`}>
              {landlord.status.charAt(0).toUpperCase() + landlord.status.slice(1)}
            </span>
            <span className="joined-date">
              <FaCalendar /> Joined {formatDate(landlord.createdAt)}
            </span>
          </div>
          
          <div className="contact-info">
            <div className="contact-item">
              <FaEnvelope />
              <a href={`mailto:${landlord.email}`}>{landlord.email}</a>
            </div>
            <div className="contact-item">
              <FaPhone />
              <div className="phone-container">
                <span>{landlord.phone || "Not provided"}</span>
                {landlord.phone && (
                  <a 
                    href={`https://wa.me/${landlord.phone.replace(/\D/g, '')}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="whatsapp-link"
                  >
                    <FaWhatsapp /> WhatsApp
                  </a>
                )}
              </div>
            </div>
            {landlord.address && (
              <div className="contact-item">
                <FaMapMarkerAlt />
                <span>{landlord.address}</span>
              </div>
            )}
            {landlord.company && (
              <div className="contact-item">
                <FaRegBuilding />
                <span>{landlord.company}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="landlord-stats">
          <div className="landlord-stat-card">
            <div className="landlord-stat-icon total-properties">
              <FaHome />
            </div>
            <div className="landlord-stat-content">
              <span className="landlord-stat-number">{landlord.totalProperties || properties.length}</span>
              <span className="landlord-stat-label">Properties</span>
            </div>
          </div>
          
          <div className="landlord-stat-card">
            <div className="landlord-stat-icon total-units">
              <FaBuilding />
            </div>
            <div className="landlord-stat-content">
              <span className="landlord-stat-number">
                {properties.reduce((sum, prop) => sum + (prop.units || prop.unitDetails?.totalUnits || 1), 0)}
              </span>
              <span className="landlord-stat-label">Total Units</span>
            </div>
          </div>
          
          <div className="landlord-stat-card">
            <div className="landlord-stat-icon revenue">
              <FaIdCard />
            </div>
            <div className="landlord-stat-content">
              <span className="landlord-stat-number">
                KSh {calculateTotalRevenue().toLocaleString()}
              </span>
              <span className="landlord-stat-label">Monthly Revenue</span>
            </div>
          </div>
          
          <div className="landlord-stat-card">
            <div className="landlord-stat-icon occupancy">
              <FaUserCheck />
            </div>
            <div className="landlord-stat-content">
              <span className="landlord-stat-number">
                {landlord.activeProperties || 0}
              </span>
              <span className="landlord-stat-label">Active Properties</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="landlord-tabs">
        <button 
          className={`landlord-tab-button ${activeTab === "properties" ? "active" : ""}`}
          onClick={() => setActiveTab("properties")}
        >
          <FaHome /> Properties ({properties.length})
        </button>
        <button 
          className={`landlord-tab-button ${activeTab === "details" ? "active" : ""}`}
          onClick={() => setActiveTab("details")}
        >
          <FaUserCheck /> Details
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === "properties" ? (
          <div className="properties-section">
            <div className="section-header">
              <h2>Managed Properties</h2>
              <Link to="/properties/add" className="add-property-link">
                + Add New Property
              </Link>
            </div>
            
            {properties.length === 0 ? (
              <div className="empty-properties">
                <FaHome className="empty-icon" />
                <h3>No Properties Assigned</h3>
                <p>This landlord doesn't have any properties yet.</p>
                <Link to="/properties/add" className="add-property-btn">
                  + Add First Property
                </Link>
              </div>
            ) : (
              <div className="properties-grid">
                {properties.map((property) => (
                  <div key={property.id} className="property-card">
                    <div className="property-image">
                      {property.images && property.images.length > 0 ? (
                        <img src={property.images[0]} alt={property.name} />
                      ) : (
                        <div className="no-image">
                          <FaHome />
                        </div>
                      )}
                      <div className={`property-status ${property.status || "available"}`}>
                        {property.status || "Available"}
                      </div>
                    </div>
                    
                    <div className="property-info">
                      <h3>{property.name}</h3>
                      
                      <div className="property-meta">
                        <div className="meta-item">
                          <FaMapMarkerAlt />
                          <span>{property.address}, {property.city}</span>
                        </div>
                        <div className="meta-item">
                          <FaBuilding />
                          <span>{property.units || property.unitDetails?.totalUnits || 1} Units</span>
                        </div>
                      </div>
                      
                      <div className="property-stats">
                        <div className="stat">
                          <span className="label">Rent:</span>
                          <span className="value">KSh {property.rentAmount?.toLocaleString() || "0"}</span>
                        </div>
                        <div className="stat">
                          <span className="label">Occupancy:</span>
                          <span className={`value ${property.occupancyRate >= 80 ? "high" : property.occupancyRate >= 50 ? "medium" : "low"}`}>
                            {property.occupancyRate}%
                          </span>
                        </div>
                      </div>
                      
                      <div className="property-actions">
                        <button 
                          className="ld-view-btn"
                          onClick={() => handleViewProperty(property.id)}
                        >
                          <FaEye /> View Units
                        </button>
                        <Link 
                          to={`/properties/edit/${property.id}`}
                          className="ld-edit-btn"
                        >
                          <FaEdit /> Edit
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="details-section">
            <div className="details-grid">
              <div className="detail-card">
                <h3>Account Information</h3>
                <div className="detail-list">
                  <div className="detail-item">
                    <span className="label">Landlord ID:</span>
                    <span className="value code">{landlord.id}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Account Status:</span>
                    <span className={`value landlord-status-badge ${landlord.status}`}>
                      {landlord.status}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Account Created:</span>
                    <span className="value">{formatDateTime(landlord.createdAt)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Last Updated:</span>
                    <span className="value">{landlord.updatedAt ? formatDateTime(landlord.updatedAt) : "Never"}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Last Login:</span>
                    <span className="value">{formatDateTime(landlord.lastLogin)}</span>
                  </div>
                </div>
              </div>
              
              <div className="detail-card">
                <h3>Contact Information</h3>
                <div className="detail-list">
                  <div className="detail-item">
                    <span className="label">Full Name:</span>
                    <span className="value">{landlord.name}</span>
                  </div>
                  {landlord.firstName && (
                    <div className="detail-item">
                      <span className="label">First Name:</span>
                      <span className="value">{landlord.firstName}</span>
                    </div>
                  )}
                  {landlord.lastName && (
                    <div className="detail-item">
                      <span className="label">Last Name:</span>
                      <span className="value">{landlord.lastName}</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="label">Email Address:</span>
                    <span className="value">{landlord.email}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Phone Number:</span>
                    <span className="value">{landlord.phone || "Not provided"}</span>
                  </div>
                  {landlord.company && (
                    <div className="detail-item">
                      <span className="label">Company:</span>
                      <span className="value">{landlord.company}</span>
                    </div>
                  )}
                  {landlord.address && (
                    <div className="detail-item">
                      <span className="label">Address:</span>
                      <span className="value">{landlord.address}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="detail-card">
                <h3>Properties Summary</h3>
                <div className="detail-list">
                  <div className="detail-item">
                    <span className="label">Total Properties:</span>
                    <span className="value">{landlord.totalProperties || properties.length}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Active Properties:</span>
                    <span className="value">{landlord.activeProperties || properties.filter(p => p.status === "active").length}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Total Units:</span>
                    <span className="value">
                      {properties.reduce((sum, prop) => sum + (prop.units || prop.unitDetails?.totalUnits || 1), 0)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Monthly Revenue:</span>
                    <span className="value highlight">
                      KSh {calculateTotalRevenue().toLocaleString()}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Created by Admin:</span>
                    <span className="value">
                      {landlord.createdBy ? "Yes" : "No"}
                      {landlord.createdBy && ` (Admin ID: ${landlord.createdBy})`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="actions-section">
              <h3>Quick Actions</h3>
              <div className="landlord-details-action-buttons">
                <button className="landlord-details-action-btn primary" onClick={handleEdit}>
                  <FaEdit /> Edit Landlord Details
                </button>
                <button 
                  className="landlord-details-action-btn secondary"
                  onClick={handleStatusToggle}
                  disabled={updatingStatus}
                >
                  {landlord.status === "active" ? <FaToggleOff /> : <FaToggleOn />}
                  {landlord.status === "active" ? "Deactivate Account" : "Activate Account"}
                </button>
                <Link to="/properties/add" className="landlord-details-action-btn success">
                  <FaHome /> Add New Property
                </Link>
                <button className="landlord-details-action-btn danger" onClick={() => navigate("/landlords")}>
                  <FaArrowLeft /> Back to List
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LandlordDetails;