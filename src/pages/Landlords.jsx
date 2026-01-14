// src/pages/Landlords.jsx - UPDATED WITH UNIQUE CLASSES
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  collection, 
  getDocs, 
  query,
  where,
  orderBy 
} from "firebase/firestore";
import { db } from "../pages/firebase/firebase";
import "../styles/landlord.css";

const Landlords = () => {
  const [landlords, setLandlords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  // Fetch landlords from Firestore
  useEffect(() => {
    fetchLandlords();
  }, []);

  const fetchLandlords = async () => {
    try {
      console.log("📡 Fetching landlords from 'landlords' collection...");
      
      // CHANGED: Fetch from 'landlords' collection instead of 'users'
      const landlordsQuery = query(
        collection(db, "landlords"),  // ← CHANGED THIS LINE
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(landlordsQuery);
      const landlordsData = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Get the name - check both 'name' field and combine firstName/lastName
        const fullName = data.name || 
                        `${data.firstName || ""} ${data.lastName || ""}`.trim() || 
                        "No Name";
        
        landlordsData.push({
          id: doc.id,
          name: fullName,
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          email: data.email || "No Email",
          phone: data.phone || "Not provided",
          propertiesCount: data.properties?.length || data.totalProperties || 0,
          totalProperties: data.totalProperties || 0,
          activeProperties: data.activeProperties || 0,
          status: data.status || "active",
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
          isVerified: data.isVerified || false,
          company: data.company || "",
          address: data.address || ""
        });
      });
      
      console.log(`✅ Loaded ${landlordsData.length} landlords from 'landlords' collection`);
      setLandlords(landlordsData);
    } catch (error) {
      console.error("❌ Error fetching landlords:", error);
      
      // Try fallback to users collection if landlords collection doesn't exist
      console.log("🔄 Trying fallback to 'users' collection...");
      try {
        const usersQuery = query(
          collection(db, "users"),
          where("role", "==", "landlord"),
          orderBy("createdAt", "desc")
        );
        
        const usersSnapshot = await getDocs(usersQuery);
        const fallbackLandlords = [];
        
        usersSnapshot.forEach((doc) => {
          const data = doc.data();
          const fullName = data.name || 
                          `${data.firstName || ""} ${data.lastName || ""}`.trim() || 
                          "No Name";
          
          fallbackLandlords.push({
            id: doc.id,
            name: fullName,
            email: data.email || "No Email",
            phone: data.phone || "Not provided",
            propertiesCount: data.properties?.length || 0,
            status: data.status || "active",
            createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
            isVerified: data.isVerified || false
          });
        });
        
        setLandlords(fallbackLandlords);
        console.log(`✅ Loaded ${fallbackLandlords.length} landlords from 'users' collection (fallback)`);
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError);
        alert("Failed to load landlords. Please check your Firestore setup.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Filter landlords based on search term
  const filteredLandlords = landlords.filter(landlord =>
    landlord.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    landlord.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    landlord.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (landlord.company && landlord.company.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Format date to readable string
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Handle view landlord details
  const handleViewLandlord = (landlordId) => {
    navigate(`/landlords/${landlordId}`);
  };

  // Handle edit landlord
  const handleEditLandlord = (landlordId) => {
    navigate(`/landlords/edit/${landlordId}`);
  };

  // Refresh landlords list
  const handleRefresh = () => {
    setLoading(true);
    fetchLandlords();
  };

  return (
    <div className="landlords-container">
      {/* Header Section */}
      <div className="landlords-header">
        <div>
          <h1>Landlords</h1>
          <p className="landlords-page-subtitle">Manage property owners registered in the system</p>
        </div>
        <div className="landlords-header-actions">
          <button className="landlords-refresh-btn" onClick={handleRefresh} disabled={loading}>
            {loading ? "🔄 Loading..." : "↻ Refresh"}
          </button>
          <Link to="/landlords/add" className="landlords-add-btn">
            + Add New Landlord
          </Link>
        </div>
      </div>

      {/* Search and Stats Bar */}
      <div className="landlords-toolbar">
        <div className="landlords-search-box">
          <input
            type="text"
            placeholder="Search by name, email, phone, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="landlords-search-input"
          />
          <span className="landlords-search-icon">🔍</span>
        </div>
        <div className="landlords-stats-container">
          <div className="landlords-stat-box">
            <span className="landlords-stat-number">{landlords.length}</span>
            <span className="landlords-stat-label">Total Landlords</span>
          </div>
          <div className="landlords-stat-box">
            <span className="landlords-stat-number">
              {landlords.filter(l => l.status === "active").length}
            </span>
            <span className="landlords-stat-label">Active</span>
          </div>
          <div className="landlords-stat-box">
            <span className="landlords-stat-number">
              {landlords.reduce((sum, landlord) => sum + landlord.propertiesCount, 0)}
            </span>
            <span className="landlords-stat-label">Total Properties</span>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="landlords-loading-container">
          <div className="landlords-loading-spinner"></div>
          <p>Loading landlords...</p>
        </div>
      ) : (
        /* Landlords Table */
        <div className="landlords-table-container">
          {filteredLandlords.length === 0 ? (
            <div className="landlords-empty-state">
              <div className="landlords-empty-icon">👤</div>
              <h3>No Landlords Found</h3>
              <p>{searchTerm ? 
                "No landlords match your search. Try different keywords." : 
                "No landlords have been registered yet."}
              </p>
              {!searchTerm && (
                <Link to="/landlords/add" className="landlords-empty-action-btn">
                  Add Your First Landlord
                </Link>
              )}
            </div>
          ) : (
            <>
              <table className="landlords-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Contact Information</th>
                    <th>Properties</th>
                    <th>Status</th>
                    <th>Registered Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLandlords.map((landlord) => (
                    <tr key={landlord.id}>
                      <td>
                        <div className="landlords-name-cell">
                          <span className="landlords-name">{landlord.name}</span>
                          {landlord.isVerified && (
                            <span className="landlords-verified-badge">✓ Verified</span>
                          )}
                          {landlord.company && (
                            <div className="landlords-company-name">{landlord.company}</div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="landlords-contact-info">
                          <div className="landlords-contact-email">{landlord.email}</div>
                          <div className="landlords-contact-phone">{landlord.phone}</div>
                        </div>
                      </td>
                      <td>
                        <div className="landlords-properties-count">
                          <span className="landlords-count-number">{landlord.propertiesCount}</span>
                          <span className="landlords-count-label">properties</span>
                        </div>
                      </td>
                      <td>
                        <span className={`landlords-status-badge landlords-status-${landlord.status}`}>
                          {landlord.status.charAt(0).toUpperCase() + landlord.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        <span className="landlords-registered-date">
                          {formatDate(landlord.createdAt)}
                        </span>
                      </td>
                      <td>
                        <div className="landlords-action-buttons">
                          <button 
                            className="landlords-table-view-btn"
                            onClick={() => handleViewLandlord(landlord.id)}
                            title="View Details"
                          >
                            👁️ View
                          </button>
                          <button 
                            className="landlords-table-edit-btn"
                            onClick={() => handleEditLandlord(landlord.id)}
                            title="Edit Landlord"
                          >
                            ✏️ Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Table Footer */}
              <div className="landlords-table-footer">
                <div className="landlords-results-count">
                  Showing {filteredLandlords.length} of {landlords.length} landlords
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Landlords;