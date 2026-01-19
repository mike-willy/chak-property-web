// src/pages/AllActivities.jsx
import React, { useState, useEffect } from "react";
import { 
  collection, 
  getDocs, 
  query, 
  orderBy,
  deleteDoc,
  doc
} from "firebase/firestore";
import { db } from "./firebase/firebase";
import { 
  FaArrowLeft,
  FaEnvelope,
  FaTools,
  FaCheckCircle,
  FaMoneyCheckAlt,
  FaUser,
  FaHome,
  FaTrash,
  FaSearch,
  FaCalendar,
  FaExclamationTriangle
} from "react-icons/fa";
import "../styles/AllActivities.css";

const AllActivities = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Fetch all activities
  const fetchActivities = async () => {
    try {
      setLoading(true);
      const allActivities = [];

      const collections = [
        "messages",
        "maintenance", 
        "payments",
        "tenants",
        "properties"
      ];

      for (const colName of collections) {
        try {
          const colRef = collection(db, colName);
          const colQuery = query(colRef, orderBy("createdAt", "desc"));
          const snapshot = await getDocs(colQuery);
          
          snapshot.forEach((doc) => {
            const data = doc.data();
            allActivities.push({
              id: doc.id,
              collection: colName,
              type: colName,
              data: data,
              time: data.createdAt || data.updatedAt || data.paymentDate
            });
          });
        } catch (error) {
          console.log(`Skipping ${colName}:`, error.message);
        }
      }

      // Sort by time
      const sorted = allActivities
        .filter(a => a.time)
        .sort((a, b) => {
          const timeA = a.time.toDate ? a.time.toDate() : new Date(a.time);
          const timeB = b.time.toDate ? b.time.toDate() : new Date(b.time);
          return timeB - timeA;
        });

      setActivities(sorted);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  // Delete activity
  const handleDelete = async (id, collection) => {
    if (!window.confirm("Are you sure you want to delete this activity?")) return;
    
    try {
      await deleteDoc(doc(db, collection, id));
      fetchActivities();
      alert("Activity deleted");
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  // Filter activities
  const filtered = activities.filter(activity => {
    const searchLower = search.toLowerCase();
    const data = activity.data;
    
    if (activity.type === "messages") {
      return (data.sender || "").toLowerCase().includes(searchLower) ||
             (data.message || "").toLowerCase().includes(searchLower);
    }
    
    if (activity.type === "maintenance") {
      return (data.category || "").toLowerCase().includes(searchLower) ||
             (data.propertyName || "").toLowerCase().includes(searchLower);
    }
    
    if (activity.type === "payments") {
      return (data.tenantName || "").toLowerCase().includes(searchLower);
    }
    
    if (activity.type === "tenants") {
      return (data.fullName || "").toLowerCase().includes(searchLower) ||
             (data.propertyName || "").toLowerCase().includes(searchLower);
    }
    
    if (activity.type === "properties") {
      return (data.name || "").toLowerCase().includes(searchLower);
    }
    
    return true;
  });

  // Format activity text
  const getActivityText = (activity) => {
    const data = activity.data;
    
    switch(activity.type) {
      case "messages":
        return `${data.sender || "User"}: ${data.message?.substring(0, 50) || ""}...`;
      case "maintenance":
        return `${data.category || "Issue"} at ${data.propertyName || "Property"}`;
      case "payments":
        return `KSh ${data.amount?.toLocaleString() || "0"} from ${data.tenantName || "Tenant"}`;
      case "tenants":
        return `${data.fullName} moved into ${data.propertyName}`;
      case "properties":
        return `${data.name} was updated`;
      default:
        return "Activity";
    }
  };

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return "Invalid date";
    }
  };

  if (loading) {
    return (
      <div className="all-activities-loading">
        <div className="spinner"></div>
        <p>Loading activities...</p>
      </div>
    );
  }

  return (
    <div className="all-activities">
      {/* Header */}
      <div className="activities-header">
        <button className="back-btn" onClick={() => window.history.back()}>
          <FaArrowLeft /> Back
        </button>
        <div>
          <h1>All Activities</h1>
          <p className="subtitle">{activities.length} total activities</p>
        </div>
      </div>

      {/* Search */}
      <div className="search-box">
        <FaSearch />
        <input
          type="text"
          placeholder="Search activities..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Activities List */}
      <div className="activities-container">
        {filtered.length === 0 ? (
          <div className="empty-activities">
            <FaExclamationTriangle />
            <p>No activities found</p>
          </div>
        ) : (
          <div className="activities-list">
            {filtered.map((activity) => (
              <div key={`${activity.collection}_${activity.id}`} className="activity-card">
                <div className="activity-header">
                  <div className="activity-type">
                    {activity.type === "messages" && <FaEnvelope />}
                    {activity.type === "maintenance" && <FaTools />}
                    {activity.type === "payments" && <FaMoneyCheckAlt />}
                    {activity.type === "tenants" && <FaUser />}
                    {activity.type === "properties" && <FaHome />}
                    <span>{activity.type}</span>
                  </div>
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(activity.id, activity.collection)}
                  >
                    <FaTrash />
                  </button>
                </div>
                
                <div className="activity-body">
                  <p>{getActivityText(activity)}</p>
                </div>
                
                <div className="activity-footer">
                  <FaCalendar />
                  <span>{formatDate(activity.time)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AllActivities;