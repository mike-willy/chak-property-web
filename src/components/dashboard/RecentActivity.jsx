// src/components/RecentActivity.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit,
  onSnapshot
} from "firebase/firestore";
import { db } from "../../pages/firebase/firebase";
import { 
  FaEnvelope,
  FaTools,
  FaCheckCircle,
  FaMoneyCheckAlt,
  FaUser,
  FaHome,
  FaSync,
  FaArrowRight
} from "react-icons/fa";
import "../../styles/RecentActivity.css";

const RecentActivity = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Function to format time
  const timeAgo = (timestamp) => {
    if (!timestamp) return "Just now";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const seconds = Math.floor((new Date() - date) / 1000);
      if (seconds < 60) return "Just now";
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return "Recently";
    }
  };

  // Fetch recent activities
  const fetchActivities = async () => {
    try {
      setLoading(true);
      const allActivities = [];

      // Fetch from all collections
      const collections = [
        { name: "messages", limit: 2 },
        { name: "maintenance", limit: 2 },
        { name: "payments", limit: 2 },
        { name: "tenants", limit: 2 },
        { name: "properties", limit: 2 }
      ];

      for (const col of collections) {
        try {
          const colRef = collection(db, col.name);
          const colQuery = query(colRef, orderBy("createdAt", "desc"), limit(col.limit));
          const snapshot = await getDocs(colQuery);
          
          snapshot.forEach((doc) => {
            const data = doc.data();
            let activity = null;

            switch(col.name) {
              case "messages":
                activity = {
                  id: doc.id,
                  type: "message",
                  icon: <FaEnvelope size={16} />,
                  title: "Message",
                  details: `${data.sender || "User"}: ${(data.message || "").substring(0, 30)}...`,
                  time: data.createdAt,
                  color: "#3b82f6"
                };
                break;
              case "maintenance":
                activity = {
                  id: doc.id,
                  type: "maintenance",
                  icon: data.status === "completed" ? <FaCheckCircle size={16} /> : <FaTools size={16} />,
                  title: data.status === "completed" ? "Completed" : "Maintenance",
                  details: `${data.category || "Issue"} at ${data.propertyName || "Property"}`,
                  time: data.createdAt,
                  color: data.status === "completed" ? "#10b981" : "#f59e0b"
                };
                break;
              case "payments":
                activity = {
                  id: doc.id,
                  type: "payment",
                  icon: <FaMoneyCheckAlt size={16} />,
                  title: "Payment",
                  details: `KSh ${data.amount?.toLocaleString() || "0"} from ${data.tenantName || "Tenant"}`,
                  time: data.paymentDate || data.createdAt,
                  color: "#10b981"
                };
                break;
              case "tenants":
                activity = {
                  id: doc.id,
                  type: "tenant",
                  icon: <FaUser size={16} />,
                  title: "New Tenant",
                  details: `${data.fullName} moved into ${data.propertyName}`,
                  time: data.createdAt,
                  color: "#8b5cf6"
                };
                break;
              case "properties":
                activity = {
                  id: doc.id,
                  type: "property",
                  icon: <FaHome size={16} />,
                  title: "Property Updated",
                  details: `${data.name} was modified`,
                  time: data.updatedAt || data.createdAt,
                  color: "#3b82f6"
                };
                break;
            }

            if (activity) allActivities.push(activity);
          });
        } catch (error) {
          console.log(`Skipping ${col.name}:`, error.message);
        }
      }

      // Sort and limit to 4
      const sorted = allActivities
        .filter(a => a.time)
        .sort((a, b) => {
          const timeA = a.time.toDate ? a.time.toDate() : new Date(a.time);
          const timeB = b.time.toDate ? b.time.toDate() : new Date(b.time);
          return timeB - timeA;
        })
        .slice(0, 4);

      setActivities(sorted);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(fetchActivities, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="recent-activity">
        <div className="activity-header">
          <h3>Recent Activity</h3>
          <button className="view-all-btn" onClick={() => navigate("/activities")}>
            View All <FaArrowRight size={10} />
          </button>
        </div>
        <div className="activity-list">
          {[1, 2, 3, 4].map((_, i) => (
            <div key={i} className="activity-item loading">
              <div className="activity-icon"></div>
              <div className="activity-content">
                <div className="activity-title"></div>
                <div className="activity-time"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="recent-activity">
      <div className="activity-header">
        <h3>Recent Activity</h3>
        <div className="header-actions">
          <button className="refresh-btn" onClick={fetchActivities} title="Refresh">
            <FaSync size={12} />
          </button>
          <button className="view-all-btn" onClick={() => navigate("/activities")}>
            View All <FaArrowRight size={10} />
          </button>
        </div>
      </div>

      <div className="activity-list">
        {activities.length === 0 ? (
          <div className="empty-state">
            <p>No recent activity</p>
            <small>Activities will appear here</small>
          </div>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="activity-item">
              <div className="activity-icon" style={{ backgroundColor: `${activity.color}15` }}>
                <span style={{ color: activity.color }}>{activity.icon}</span>
              </div>
              <div className="activity-content">
                <div className="activity-title">
                  <strong>{activity.title}</strong>
                  {activity.details && <span> - {activity.details}</span>}
                </div>
                <div className="activity-time">{timeAgo(activity.time)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RecentActivity;