// components/TopNavbar.jsx - COMPLETE UPDATED VERSION
import React, { useState, useEffect, useRef } from "react";
import { FaBell, FaSearch, FaSignOutAlt, FaEye, FaChevronRight, FaBars, FaTimes, FaUser, FaBuilding, FaFileAlt, FaTools, FaMoneyBill, FaHome, FaUserTie } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { auth } from "../pages/firebase/firebase";
import { signOut } from "firebase/auth";
import { listenForNotifications, markAllAsRead } from "../services/notificationService";
import { useSidebar } from "./DashboardLayout";
import { globalSearch } from "../services/searchService";
import "../styles/topNavbar.css";

const TopNavbar = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  
  const { toggleSidebar } = useSidebar();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsubscribe = listenForNotifications(user.uid, (notifs) => {
      setNotifications(notifs);
      const unread = notifs.filter(n => !n.read).length;
      setUnreadCount(unread);
    });

    return () => unsubscribe();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close notification dropdown
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      
      // Close search results
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle search input with debouncing
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.trim().length > 1) {
        performSearch(searchTerm);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // REAL SEARCH FUNCTION
  const performSearch = async (term) => {
    if (!term.trim() || term.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    
    try {
      // Use the real globalSearch function
      const results = await globalSearch(term, 3);
      setSearchResults(results);
      setShowSearchResults(true);
    } catch (error) {
      console.error("Search error:", error);
      // Fallback to simple mock results if search service fails
      const mockResults = generateMockResults(term);
      setSearchResults(mockResults);
      setShowSearchResults(true);
    } finally {
      setIsSearching(false);
    }
  };

  // Fallback mock results (only used if search service fails)
  const generateMockResults = (term) => {
    const lowerTerm = term.toLowerCase();
    const results = [];
    
    const mockData = [
      { id: 1, type: 'property', title: 'Rosewood Apartments', subtitle: 'Property • Nairobi • 4 Units', route: '/properties' },
      { id: 2, type: 'tenant', title: 'John Doe', subtitle: 'Tenant • john@email.com • Unit 3A', route: '/tenants' },
      { id: 3, type: 'landlord', title: 'Jane Smith', subtitle: 'Landlord • 5 Properties', route: '/landlords' },
      { id: 4, type: 'application', title: 'Pending Applications', subtitle: '3 applications awaiting review', route: '/applications' },
      { id: 5, type: 'maintenance', title: 'Plumbing Issue', subtitle: 'Maintenance request • High priority', route: '/maintenance' },
      { id: 6, type: 'unit', title: 'Unit 3A', subtitle: 'Unit • 2 Bedroom • Occupied', route: '/units' },
      { id: 7, type: 'payment', title: 'Overdue Rent', subtitle: 'Payment • 2 tenants overdue', route: '/finance' }
    ];

    return mockData
      .filter(item => 
        item.title.toLowerCase().includes(lowerTerm) || 
        item.subtitle.toLowerCase().includes(lowerTerm) ||
        item.type.toLowerCase().includes(lowerTerm)
      )
      .slice(0, 5);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
      setSearchTerm("");
      setShowSearchResults(false);
    }
  };

  const handleResultClick = (result) => {
    navigate(result.route);
    setSearchTerm("");
    setShowSearchResults(false);
  };

  const clearSearch = () => {
    setSearchTerm("");
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const getResultIcon = (type) => {
    switch (type) {
      case 'property': return <FaBuilding className="result-icon-svg" />;
      case 'tenant': return <FaUser className="result-icon-svg" />;
      case 'landlord': return <FaUserTie className="result-icon-svg" />;
      case 'unit': return <FaHome className="result-icon-svg" />;
      case 'application': return <FaFileAlt className="result-icon-svg" />;
      case 'maintenance': return <FaTools className="result-icon-svg" />;
      case 'payment': return <FaMoneyBill className="result-icon-svg" />;
      default: return <FaSearch className="result-icon-svg" />;
    }
  };

  const getResultTypeLabel = (type) => {
    switch (type) {
      case 'property': return 'Property';
      case 'tenant': return 'Tenant';
      case 'landlord': return 'Landlord';
      case 'unit': return 'Unit';
      case 'application': return 'Application';
      case 'maintenance': return 'Maintenance';
      case 'payment': return 'Payment';
      default: return 'Result';
    }
  };

  const getResultTypeColor = (type) => {
    switch (type) {
      case 'property': return '#FF9800';
      case 'tenant': return '#4CAF50';
      case 'landlord': return '#2196F3';
      case 'unit': return '#9C27B0';
      case 'application': return '#00BCD4';
      case 'maintenance': return '#F44336';
      case 'payment': return '#673AB7';
      default: return '#757575';
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    const user = auth.currentUser;
    if (!user) return;
    
    await markAllAsRead(user.uid);
    const updatedNotifications = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updatedNotifications);
    setUnreadCount(0);
  };

  const handleViewAllNotifications = () => {
    navigate('/notifications');
    setShowDropdown(false);
  };

  const handleNotificationClick = (notification) => {
    if (notification.type === "tenant_application") {
      navigate('/admin/applications');
    } else {
      navigate('/notifications');
    }
    setShowDropdown(false);
  };

  const formatTime = (date) => {
    if (!date) return "";
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(date).toLocaleDateString();
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "tenant_application":
        return <span className="notification-icon app">📋</span>;
      case "maintenance_request":
        return <span className="notification-icon maintenance">🔧</span>;
      case "rent_payment":
        return <span className="notification-icon payment">💰</span>;
      case "lease_expiry":
        return <span className="notification-icon lease">📄</span>;
      default:
        return <span className="notification-icon default">🔔</span>;
    }
  };

  return (
    <div className="top-navbar">
      {/* LEFT: HAMBURGER + BRAND */}
      <div className="navbar-left">
        <div className="navbar-hamburger" onClick={toggleSidebar}>
          <FaBars className="hamburger-icon" />
        </div>
        
        <div className="navbar-brand">
          <h2>Jesma Investments</h2>
        </div>
      </div>

      {/* CENTER: SEARCH */}
      <div className="navbar-search-container" ref={searchRef}>
        <form onSubmit={handleSearchSubmit} className="navbar-search-box">
          <FaSearch className="search-icon" />
          <input 
            type="text" 
            placeholder="Search properties, tenants, landlords, applications..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => {
              if (searchTerm.trim().length > 1) {
                setShowSearchResults(true);
              }
            }}
          />
          {searchTerm && (
            <button 
              type="button" 
              className="clear-search-btn"
              onClick={clearSearch}
            >
              <FaTimes />
            </button>
          )}
        </form>
        
        {/* SEARCH RESULTS DROPDOWN */}
        {showSearchResults && searchTerm.trim().length > 0 && (
          <div className="search-results-dropdown">
            <div className="search-results-header">
              <h4>Search Results</h4>
              <span className="results-count">
                {isSearching ? "Searching..." : `${searchResults.length} results`}
              </span>
            </div>
            
            <div className="search-results-list">
              {isSearching ? (
                <div className="search-loading">
                  <div className="search-spinner"></div>
                  <p>Searching for "{searchTerm}"...</p>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((result) => (
                  <div 
                    key={`${result.type}-${result.id}`}
                    className="search-result-item"
                    onClick={() => handleResultClick(result)}
                  >
                    <div 
                      className="result-icon"
                      style={{ backgroundColor: getResultTypeColor(result.type) }}
                    >
                      {getResultIcon(result.type)}
                    </div>
                    <div className="result-content">
                      <div className="result-title-row">
                        <h5 className="result-title">{result.title}</h5>
                        <span 
                          className="result-type-badge-small"
                          style={{ 
                            backgroundColor: getResultTypeColor(result.type) + '20',
                            color: getResultTypeColor(result.type)
                          }}
                        >
                          {getResultTypeLabel(result.type)}
                        </span>
                      </div>
                      <p className="result-subtitle">{result.subtitle}</p>
                    </div>
                    <FaChevronRight className="result-chevron" />
                  </div>
                ))
              ) : (
                <div className="no-results">
                  <div className="no-results-icon">🔍</div>
                  <p>No results found for "{searchTerm}"</p>
                  <small>Try different keywords</small>
                </div>
              )}
            </div>
            
            {searchResults.length > 0 && (
              <div className="search-results-footer">
                <button 
                  className="view-all-results-btn"
                  onClick={() => {
                    navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
                    setShowSearchResults(false);
                  }}
                >
                  View all results for "{searchTerm}"
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT: ACTIONS */}
      <div className="navbar-actions">
        {/* NOTIFICATION BELL */}
        <div className="notification-container" ref={dropdownRef}>
          <div 
            className="notification-bell-wrapper"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <FaBell className="notification-bell" />
            {unreadCount > 0 && (
              <span className="notification-badge">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>

          {/* CLEAN NOTIFICATION DROPDOWN */}
          {showDropdown && (
            <div className="notifications-dropdown">
              <div className="notifications-header">
                <div className="header-top">
                  <h3>Notifications</h3>
                  {unreadCount > 0 && (
                    <button 
                      className="mark-all-read-btn"
                      onClick={handleMarkAllAsRead}
                    >
                      Mark all as read
                    </button>
                  )}
                </div>
                <div className="unread-count">
                  {unreadCount} unread • {notifications.length} total
                </div>
              </div>
              
              <div className="notifications-list">
                {notifications.length === 0 ? (
                  <div className="empty-notifications">
                    <div className="empty-icon">🔔</div>
                    <p>No notifications yet</p>
                    <small>All caught up!</small>
                  </div>
                ) : (
                  notifications.slice(0, 5).map((notification) => (
                    <div 
                      key={notification.id}
                      className={`notification-item ${notification.read ? "" : "unread"}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="notification-icon-container">
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      <div className="notification-content">
                        <div className="notification-title-row">
                          <h4 className="notification-title">{notification.title}</h4>
                          <span className="notification-time">
                            {formatTime(notification.createdAt)}
                          </span>
                        </div>
                        <p className="notification-message">{notification.message}</p>
                      </div>
                      
                      <FaChevronRight className="chevron-icon" />
                    </div>
                  ))
                )}
              </div>
              
              <div className="notifications-footer">
                <button 
                  className="view-all-notifications-btn"
                  onClick={handleViewAllNotifications}
                >
                  <FaEye /> View All Notifications
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="admin-profile">
          <span>Admin</span>
        </div>

        <button onClick={handleLogout} className="logout-btn">
          <FaSignOutAlt />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default TopNavbar;