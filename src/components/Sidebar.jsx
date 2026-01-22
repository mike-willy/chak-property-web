import React, { useEffect, useState, useRef } from "react";
import {
  FaTachometerAlt,
  FaHome,
  FaUsers,
  FaUserTie,
  FaTools,
  FaMoneyBillWave,
  FaCog,
  FaLifeRing,
  FaCamera,
  FaClipboardList,
  FaEnvelope,
  FaBuilding,
  FaChartBar,
  FaChartLine,
  FaChartPie,
  FaChevronDown,
  FaChevronRight,
  FaFileInvoiceDollar,
  FaPercentage,
  FaUserClock,
} from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db, storage } from "../pages/firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs, query, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useSidebar } from "./DashboardLayout";
import "../styles/sidebar.css";

const Sidebar = () => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pendingApplicationsCount, setPendingApplicationsCount] = useState(0);
  const [pendingMaintenanceCount, setPendingMaintenanceCount] = useState(0);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const fileInputRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { isSidebarExpanded, toggleSidebar } = useSidebar();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchUserData(currentUser.uid);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchPendingCounts();
      const interval = setInterval(fetchPendingCounts, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Auto-expand analytics if on analytics page
  useEffect(() => {
    if (location.pathname === '/analytics' || location.pathname.startsWith('/analytics')) {
      setAnalyticsOpen(true);
    } else {
      setAnalyticsOpen(false);
    }
  }, [location.pathname]);

  const fetchUserData = async (userId) => {
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  const fetchPendingCounts = async () => {
    try {
      const applicationsQuery = query(
        collection(db, "tenantApplications"),
        where("status", "==", "pending")
      );
      const applicationsSnapshot = await getDocs(applicationsQuery);
      setPendingApplicationsCount(applicationsSnapshot.size);

      const maintenanceQuery = query(
        collection(db, "maintenance"),
        where("status", "==", "pending")
      );
      const maintenanceSnapshot = await getDocs(maintenanceQuery);
      setPendingMaintenanceCount(maintenanceSnapshot.size);
    } catch (error) {
      console.error("Error fetching pending counts:", error);
    }
  };

  const handleImageClick = () => {
    fileInputRef.current.click();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("File size should be less than 5MB");
      return;
    }

    setUploading(true);

    try {
      const storageRef = ref(storage, `profile-pictures/${user.uid}`);
      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);

      await setDoc(
        doc(db, "users", user.uid),
        {
          ...userData,
          photoURL,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      setUserData((prev) => ({ ...prev, photoURL }));
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      alert("Failed to upload profile picture");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const getUserName = () => {
    if (userData?.displayName) return userData.displayName;
    if (!user || !user.email) return "Admin";
    const namePart = user.email.split("@")[0];
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
  };

  const getUserInitial = () => {
    return getUserName().charAt(0).toUpperCase();
  };

  const toggleAnalytics = () => {
    setAnalyticsOpen(!analyticsOpen);
  };

  // Main menu items
  const menuItems = [
    { icon: <FaTachometerAlt />, label: "Dashboard", path: "/dashboard" },
    { icon: <FaHome />, label: "Properties", path: "/properties" },
    { icon: <FaBuilding />, label: "Units", path: "/units" },
    { icon: <FaUsers />, label: "Tenants", path: "/tenants" },
    { 
      icon: <FaClipboardList />, 
      label: "Applications", 
      path: "/applications",
      badge: pendingApplicationsCount,
    },
    { icon: <FaUserTie />, label: "Landlords", path: "/landlords" },
    { icon: <FaEnvelope />, label: "Messages", path: "/messages" },
    { 
      icon: <FaTools />, 
      label: "Maintenance", 
      path: "/maintenance",
      badge: pendingMaintenanceCount,
    },
    { icon: <FaMoneyBillWave />, label: "Finance", path: "/finance" },
  ];

  // Analytics sub-items - UPDATED TO MATCH OUR HASH ROUTING
  const analyticsSubItems = [
    { 
      icon: <FaChartLine />, 
      label: "Rent Collection", 
      path: "/analytics#rent-collection",
      description: "Track rent payment trends and collection rates"
    },
    { 
      icon: <FaPercentage />, 
      label: "Vacancy Rates", 
      path: "/analytics#vacancy-rates",
      description: "Monitor occupancy and vacancy trends"
    },
    { 
      icon: <FaUserClock />, 
      label: "Tenant Behavior", 
      path: "/analytics#tenant-behavior",
      description: "Analyze tenant payment patterns and behavior"
    },
    { 
      icon: <FaChartPie />, 
      label: "Insights & Recommendations", 
      path: "/analytics#insights",
      description: "AI-powered recommendations and alerts"
    },
  ];

  const systemItems = [
    { icon: <FaCog />, label: "Settings", path: "/settings" },
    { icon: <FaLifeRing />, label: "Support", path: "/support" },
  ];

  const isActive = (path) => {
    // Check if current path matches exactly or starts with path
    if (path.includes('#')) {
      // For hash-based analytics paths
      const [basePath, hash] = path.split('#');
      return location.pathname === basePath && location.hash === `#${hash}`;
    }
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const isAnalyticsActive = () => {
    return location.pathname === '/analytics' || 
           analyticsSubItems.some(item => isActive(item.path));
  };

  const handleAnalyticsClick = (path) => {
    navigate(path);
    // If sidebar is collapsed, close the analytics dropdown after navigation
    if (!isSidebarExpanded) {
      setAnalyticsOpen(false);
    }
  };

  const handleAnalyticsParentClick = () => {
    if (isSidebarExpanded) {
      toggleAnalytics();
    } else {
      // If sidebar is collapsed, navigate to main analytics page
      navigate('/analytics');
    }
  };

  return (
    <div className={`sidebar ${isSidebarExpanded ? "" : "collapsed"}`}>
      {/* PROFILE */}
      <div className="sidebar-profile">
        {loading ? (
          <div className="profile-loading">...</div>
        ) : (
          <>
            <div className="profile-avatar-container">
              <div
                className="profile-avatar"
                onClick={handleImageClick}
              >
                {userData?.photoURL ? (
                  <img
                    src={userData.photoURL}
                    alt="Profile"
                    className="profile-image"
                  />
                ) : (
                  <div className="avatar-initial">
                    {getUserInitial()}
                  </div>
                )}

                {isSidebarExpanded && (
                  <div className="upload-overlay">
                    <FaCamera />
                  </div>
                )}

                {uploading && (
                  <div className="uploading-overlay">
                    <div className="uploading-spinner"></div>
                  </div>
                )}
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                style={{ display: "none" }}
              />
            </div>

            {isSidebarExpanded && (
              <div className="profile-info">
                <h3 className="profile-name">{getUserName()}</h3>
                <p className="profile-email">
                  {user?.email || "admin@chakestates.com"}
                </p>
                <span className="profile-role">Agent</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* MENU */}
      <div className="sidebar-scrollable">
        {isSidebarExpanded && <p className="sidebar-title">MENU</p>}
        <ul className="sidebar-menu">
          {menuItems.map((item, index) => (
            <li
              key={index}
              className={`sidebar-item ${isActive(item.path) ? "active" : ""}`}
              onClick={() => navigate(item.path)}
              title={!isSidebarExpanded ? item.label : ""}
            >
              <div className="sidebar-item-content">
                {item.icon} 
                {isSidebarExpanded && <span>{item.label}</span>}
                {item.badge > 0 && (
                  <span className={`sidebar-badge ${!isSidebarExpanded ? "collapsed-badge" : ""}`}>
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
            </li>
          ))}

          {/* ANALYTICS SECTION WITH DROPDOWN */}
          <li 
            className={`sidebar-item analytics-parent ${isAnalyticsActive() ? 'active-parent' : ''}`}
            onClick={handleAnalyticsParentClick}
          >
            <div className="sidebar-item-content">
              <FaChartBar /> 
              {isSidebarExpanded && (
                <>
                  <span>Analytics & Reports</span>
                  <span className="chevron-icon">
                    {analyticsOpen ? <FaChevronDown /> : <FaChevronRight />}
                  </span>
                </>
              )}
              {!isSidebarExpanded && (
                <div className="tooltip">Analytics & Reports</div>
              )}
            </div>
          </li>

          {/* ANALYTICS SUB-ITEMS - Only show when expanded */}
          {isSidebarExpanded && analyticsOpen && (
            <ul className="sidebar-submenu">
              {analyticsSubItems.map((item, index) => (
                <li
                  key={index}
                  className={`sidebar-subitem ${isActive(item.path) ? "active" : ""}`}
                  onClick={() => handleAnalyticsClick(item.path)}
                  title={item.description}
                >
                  <div className="sidebar-subitem-content">
                    {item.icon}
                    <div className="subitem-text">
                      <span className="subitem-label">{item.label}</span>
                      <span className="subitem-description">{item.description}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* If sidebar is collapsed, show direct analytics icons */}
          {!isSidebarExpanded && isAnalyticsActive() && (
            <div className="collapsed-analytics-icons">
              {analyticsSubItems.map((item, index) => (
                <li
                  key={index}
                  className={`sidebar-subitem ${isActive(item.path) ? "active" : ""}`}
                  onClick={() => handleAnalyticsClick(item.path)}
                  title={`${item.label}: ${item.description}`}
                >
                  <div className="sidebar-subitem-content">
                    {item.icon}
                  </div>
                </li>
              ))}
            </div>
          )}
        </ul>

        {/* SYSTEM */}
        <div className="sidebar-system">
          {isSidebarExpanded && <p className="sidebar-title">SYSTEM</p>}
          <ul className="sidebar-bottom">
            {systemItems.map((item, index) => (
              <li
                key={index}
                className={`sidebar-item ${isActive(item.path) ? "active" : ""}`}
                onClick={() => navigate(item.path)}
                title={!isSidebarExpanded ? item.label : ""}
              >
                <div className="sidebar-item-content">
                  {item.icon} 
                  {isSidebarExpanded && <span>{item.label}</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;