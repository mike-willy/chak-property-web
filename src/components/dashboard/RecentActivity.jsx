import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  collection, getDocs, query, orderBy, limit
} from "firebase/firestore";
import { db } from "../../pages/firebase/firebase";
import { 
  FaEnvelope, FaTools, FaCheckCircle, FaMoneyCheckAlt, 
  FaUser, FaHome, FaSync, FaArrowRight
} from "react-icons/fa";
import "../../styles/RecentActivity.css";

const RecentActivity = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const timeAgo = (timestamp) => {
    if (!timestamp) return "Just now";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const seconds = Math.floor((new Date() - date) / 1000);
      if (seconds < 60) return "Just now";
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return "Recently"; }
  };

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const allActivities = [];
      const collections = [
        { name: "messages", limit: 3 },
        { name: "maintenance", limit: 3 },
        { name: "payments", limit: 3 },
        { name: "tenants", limit: 3 },
        { name: "properties", limit: 3 }
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
                  id: doc.id, type: "message", icon: <FaEnvelope size={16} />,
                  title: "Message", details: `${data.sender || "User"}: ${(data.message || "").substring(0, 30)}...`,
                  time: data.createdAt, color: "#3b82f6"
                };
                break;
              case "maintenance":
                activity = {
                  id: doc.id, type: "maintenance", 
                  icon: data.status === "completed" ? <FaCheckCircle size={16} /> : <FaTools size={16} />,
                  title: data.status === "completed" ? "Completed" : "Maintenance",
                  details: `${data.category || "Issue"} at ${data.propertyName || "Property"}`,
                  time: data.createdAt, color: data.status === "completed" ? "#10b981" : "#f59e0b"
                };
                break;
              case "payments":
                activity = {
                  id: doc.id, type: "payment", icon: <FaMoneyCheckAlt size={16} />,
                  title: "Payment", details: `KSh ${data.amount?.toLocaleString() || "0"} from ${data.tenantName || "Tenant"}`,
                  time: data.paymentDate || data.createdAt, color: "#10b981"
                };
                break;
              case "tenants":
                activity = {
                  id: doc.id, type: "tenant", icon: <FaUser size={16} />,
                  title: "New Tenant", details: `${data.fullName} moved into ${data.propertyName}`,
                  time: data.createdAt, color: "#8b5cf6"
                };
                break;
              case "properties":
                activity = {
                  id: doc.id, type: "property", icon: <FaHome size={16} />,
                  title: "Property Updated", details: `${data.name} was modified`,
                  time: data.updatedAt || data.createdAt, color: "#3b82f6"
                };
                break;
            }
            if (activity) allActivities.push(activity);
          });
        } catch (error) { console.log(`Skipping ${col.name}`); }
      }

      setActivities(allActivities.filter(a => a.time).sort((a, b) => {
        const timeA = a.time.toDate ? a.time.toDate() : new Date(a.time);
        const timeB = b.time.toDate ? b.time.toDate() : new Date(b.time);
        return timeB - timeA;
      }).slice(0, 10));
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchActivities(); }, []);

  return (
    <div className="recent-activity-card">
      <div className="activity-header" style={{ flexShrink: 0 }}>
        <h3>Recent Activity</h3>
        <div className="header-actions">
          <button className="refresh-btn" onClick={fetchActivities} title="Refresh"><FaSync size={12} /></button>
          <button className="view-all-btn" onClick={() => navigate("/activities")}>View All <FaArrowRight size={10} /></button>
        </div>
      </div>

      <div className="scrollable-content">
        <div className="activity-list">
          {activities.length === 0 ? (
            <div className="empty-state"><p>No recent activity</p></div>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="activity-item">
                <div className="activity-icon" style={{ backgroundColor: `${activity.color}15` }}>
                  <span style={{ color: activity.color }}>{activity.icon}</span>
                </div>
                <div className="activity-content">
                  <div className="activity-title">
                    <strong>{activity.title}</strong> - {activity.details}
                  </div>
                  <div className="activity-time">{timeAgo(activity.time)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="summary-footer" style={{ flexShrink: 0, marginTop: 'auto', paddingTop: '15px' }}>
         <small style={{ color: '#9ca3af' }}>Last updated: {new Date().toLocaleTimeString()}</small>
      </div>
    </div>
  );
};

export default RecentActivity;