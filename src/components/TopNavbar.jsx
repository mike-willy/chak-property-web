import React, { useState, useEffect, useRef } from "react";
import { FaBell, FaSearch, FaSignOutAlt, FaChevronRight, FaBars, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { auth } from "../pages/firebase/firebase";
import { signOut } from "firebase/auth";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit 
} from "firebase/firestore";
import { db } from "../pages/firebase/firebase";
import { listenForNotifications, markAllAsRead } from "../services/notificationService";
import { useSidebar } from "./DashboardLayout";
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
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
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
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // CORRECTED AND OPTIMIZED SEARCH FUNCTION
  const performSearch = async (term) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      const searchTermLower = term.toLowerCase().trim();
      const allResults = [];

      // 1. SEARCH PROPERTIES
      try {
        const propertiesRef = collection(db, "properties");
        const propertiesQuery = query(
          propertiesRef,
          where("adminId", "==", user.uid),
          limit(8)
        );
        const propertiesSnapshot = await getDocs(propertiesQuery);
        
        propertiesSnapshot.forEach(doc => {
          const data = doc.data();
          const propertyText = `
            ${data.name || ''} 
            ${data.address || ''} 
            ${data.city || ''}
            ${data.propertyType || ''} 
            ${data.landlordName || ''}
          `.toLowerCase();
          
          if (propertyText.includes(searchTermLower)) {
            allResults.push({
              id: doc.id,
              type: 'property',
              title: data.name || 'Property',
              subtitle: data.address || 'Property',
              description: `${data.city || ''} • ${data.propertyType || ''}`,
              route: `/properties/edit/${doc.id}`,
              icon: '🏠',
              category: 'Properties',
              relevance: calculateRelevance(propertyText, searchTermLower)
            });
          }
        });
      } catch (error) {
        console.log("Properties search error:", error);
      }

      // 2. SEARCH TENANTS
      try {
        const tenantsRef = collection(db, "tenants");
        const tenantsQuery = query(
          tenantsRef,
          where("adminId", "==", user.uid),
          limit(8)
        );
        const tenantsSnapshot = await getDocs(tenantsQuery);
        
        tenantsSnapshot.forEach(doc => {
          const data = doc.data();
          const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
          const tenantText = `
            ${fullName} 
            ${data.email || ''} 
            ${data.phone || ''} 
            ${data.unitNumber || ''}
            ${data.propertyName || ''}
          `.toLowerCase();
          
          if (tenantText.includes(searchTermLower)) {
            allResults.push({
              id: doc.id,
              type: 'tenant',
              title: fullName || 'Tenant',
              subtitle: data.email || data.phone || 'Tenant',
              description: `Unit: ${data.unitNumber || 'Not assigned'} • ${data.propertyName || ''}`,
              route: `/tenants`,
              icon: '👤',
              category: 'Tenants',
              relevance: calculateRelevance(tenantText, searchTermLower)
            });
          }
        });
      } catch (error) {
        console.log("Tenants search error:", error);
      }

      // 3. SEARCH UNITS (from subcollection)
      try {
        // Get properties first
        const propertiesRef = collection(db, "properties");
        const propertiesQuery = query(
          propertiesRef,
          where("adminId", "==", user.uid),
          limit(3) // Limit to 3 properties to search units
        );
        const propertiesSnapshot = await getDocs(propertiesQuery);
        
        // Search units in each property's subcollection
        for (const propertyDoc of propertiesSnapshot.docs) {
          try {
            const unitsRef = collection(db, `properties/${propertyDoc.id}/units`);
            const unitsQuery = query(unitsRef, limit(5));
            const unitsSnapshot = await getDocs(unitsQuery);
            
            unitsSnapshot.forEach(unitDoc => {
              const unitData = unitDoc.data();
              const unitText = `
                ${unitData.unitNumber || ''}
                ${unitData.unitName || ''}
                ${unitData.status || ''}
              `.toLowerCase();
              
              if (unitText.includes(searchTermLower)) {
                allResults.push({
                  id: unitDoc.id,
                  type: 'unit',
                  title: unitData.unitNumber || `Unit`,
                  subtitle: `Unit • ${propertyDoc.data().name || 'Property'}`,
                  description: `${unitData.status || ''} • ${formatCurrency(unitData.rentAmount || 0)}/month`,
                  route: `/property/${propertyDoc.id}/units`,
                  icon: '🚪',
                  category: 'Units',
                  relevance: calculateRelevance(unitText, searchTermLower)
                });
              }
            });
          } catch (unitError) {
            console.log(`Error searching units in property ${propertyDoc.id}:`, unitError);
          }
        }
      } catch (error) {
        console.log("Units search error:", error);
      }

      // 4. SEARCH LANDLORDS (CORRECT COLLECTION)
      try {
        const landlordsRef = collection(db, "landlords");
        const landlordsQuery = query(
          landlordsRef,
          where("adminId", "==", user.uid),
          limit(8)
        );
        const landlordsSnapshot = await getDocs(landlordsQuery);
        
        landlordsSnapshot.forEach(doc => {
          const data = doc.data();
          const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.name || '';
          const landlordText = `
            ${fullName} 
            ${data.email || ''} 
            ${data.phone || ''} 
            ${data.company || ''}
          `.toLowerCase();
          
          if (landlordText.includes(searchTermLower)) {
            allResults.push({
              id: doc.id,
              type: 'landlord',
              title: fullName || 'Landlord',
              subtitle: data.email || data.phone || 'Landlord',
              description: data.company || '',
              route: `/landlords/${doc.id}`,
              icon: '👔',
              category: 'Landlords',
              relevance: calculateRelevance(landlordText, searchTermLower)
            });
          }
        });
      } catch (error) {
        console.log("Landlords search error:", error);
      }

      // 5. SEARCH APPLICATIONS (FIXED: tenantApplications collection)
      try {
        const applicationsRef = collection(db, "tenantApplications");
        const applicationsQuery = query(
          applicationsRef,
          where("adminId", "==", user.uid),
          limit(8)
        );
        const applicationsSnapshot = await getDocs(applicationsQuery);
        
        applicationsSnapshot.forEach(doc => {
          const data = doc.data();
          const applicantName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
          const applicationText = `
            ${applicantName} 
            ${data.email || ''} 
            ${data.phone || ''} 
            ${data.propertyName || ''} 
            ${data.status || ''}
          `.toLowerCase();
          
          if (applicationText.includes(searchTermLower)) {
            allResults.push({
              id: doc.id,
              type: 'application',
              title: applicantName || 'Application',
              subtitle: `${data.status || 'Application'} • ${data.propertyName || 'Property'}`,
              description: data.email || data.phone || '',
              route: `/applications`,
              icon: '📋',
              category: 'Applications',
              relevance: calculateRelevance(applicationText, searchTermLower)
            });
          }
        });
      } catch (error) {
        console.log("Applications search error:", error);
      }

      // 6. SEARCH MAINTENANCE
      try {
        const maintenanceRef = collection(db, "maintenance");
        const maintenanceQuery = query(
          maintenanceRef,
          where("adminId", "==", user.uid),
          limit(8)
        );
        const maintenanceSnapshot = await getDocs(maintenanceQuery);
        
        maintenanceSnapshot.forEach(doc => {
          const data = doc.data();
          const maintenanceText = `
            ${data.title || ''} 
            ${data.description || ''} 
            ${data.category || ''} 
            ${data.status || ''} 
            ${data.priority || ''}
            ${data.propertyName || ''}
            ${data.unitNumber || ''}
          `.toLowerCase();
          
          if (maintenanceText.includes(searchTermLower)) {
            allResults.push({
              id: doc.id,
              type: 'maintenance',
              title: data.title || 'Maintenance Request',
              subtitle: `${data.status || 'Request'} • ${data.propertyName || ''}`,
              description: `${data.description?.substring(0, 60) || data.category || ''} • ${data.priority || 'Normal'} priority`,
              route: `/maintenance`,
              icon: '🔧',
              category: 'Maintenance',
              relevance: calculateRelevance(maintenanceText, searchTermLower)
            });
          }
        });
      } catch (error) {
        console.log("Maintenance search error:", error);
      }

      // 7. SEARCH PAYMENTS
      try {
        const paymentsRef = collection(db, "payments");
        const paymentsQuery = query(
          paymentsRef,
          where("adminId", "==", user.uid),
          limit(8)
        );
        const paymentsSnapshot = await getDocs(paymentsQuery);
        
        paymentsSnapshot.forEach(doc => {
          const data = doc.data();
          const paymentText = `
            ${data.tenantName || ''} 
            ${data.amount || ''} 
            ${data.status || ''} 
            ${data.paymentMethod || ''} 
            ${data.description || ''}
            ${data.propertyName || ''}
          `.toLowerCase();
          
          if (paymentText.includes(searchTermLower)) {
            allResults.push({
              id: doc.id,
              type: 'payment',
              title: `${data.tenantName || 'Payment'} • ${formatCurrency(data.amount || 0)}`,
              subtitle: `${data.status || 'Payment'} • ${data.propertyName || ''}`,
              description: data.paymentMethod || data.description || '',
              route: `/finance`,
              icon: '💰',
              category: 'Payments',
              relevance: calculateRelevance(paymentText, searchTermLower)
            });
          }
        });
      } catch (error) {
        console.log("Payments search error:", error);
      }

      // 8. SEARCH LEASES (NEW COLLECTION)
      try {
        const leasesRef = collection(db, "leases");
        const leasesQuery = query(
          leasesRef,
          where("adminId", "==", user.uid),
          limit(8)
        );
        const leasesSnapshot = await getDocs(leasesQuery);
        
        leasesSnapshot.forEach(doc => {
          const data = doc.data();
          const leaseText = `
            ${data.tenantName || ''}
            ${data.propertyName || ''}
            ${data.unitNumber || ''}
            ${data.status || ''}
          `.toLowerCase();
          
          if (leaseText.includes(searchTermLower)) {
            allResults.push({
              id: doc.id,
              type: 'lease',
              title: `Lease: ${data.tenantName || ''}`,
              subtitle: `${data.propertyName || ''} • Unit ${data.unitNumber || ''}`,
              description: `Status: ${data.status || ''}`,
              route: `/finance`, // Using finance page for now
              icon: '📄',
              category: 'Leases',
              relevance: calculateRelevance(leaseText, searchTermLower)
            });
          }
        });
      } catch (error) {
        console.log("Leases search error:", error);
      }

      // 9. SEARCH BY STATUS
      try {
        const propertiesRef = collection(db, "properties");
        const propertiesQuery = query(
          propertiesRef,
          where("adminId", "==", user.uid),
          limit(5)
        );
        const propertiesSnapshot = await getDocs(propertiesQuery);
        
        propertiesSnapshot.forEach(doc => {
          const data = doc.data();
          const status = (data.status || '').toLowerCase();
          
          if (status.includes(searchTermLower)) {
            const alreadyExists = allResults.some(result => 
              result.type === 'property' && result.id === doc.id
            );
            
            if (!alreadyExists) {
              allResults.push({
                id: doc.id,
                type: 'property',
                title: data.name || data.propertyName || data.address || 'Property',
                subtitle: `Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                description: data.address || 'Property',
                route: `/properties/edit/${doc.id}`,
                icon: '🏠',
                category: 'Properties',
                relevance: 1
              });
            }
          }
        });
      } catch (error) {
        console.log("Status search error:", error);
      }

      // Sort results by relevance and limit
      const sortedResults = allResults
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 15); // Increased to 15 total results
      
      setSearchResults(sortedResults);
      setShowSearchResults(sortedResults.length > 0);

    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
      setShowSearchResults(true);
    } finally {
      setIsSearching(false);
    }
  };

  // Helper function to calculate relevance
  const calculateRelevance = (text, searchTerm) => {
    let score = 0;
    
    // Exact match gives highest score
    if (text.includes(searchTerm)) {
      score += 3;
    }
    
    // Check for word matches
    const searchWords = searchTerm.split(' ').filter(word => word.length > 1);
    searchWords.forEach(word => {
      if (text.includes(word)) {
        score += 1;
      }
    });
    
    // Boost score for name matches
    if (text.includes(searchTerm + ' ')) {
      score += 2;
    }
    
    return score;
  };

  // Helper function to format currency
  const formatCurrency = (amount) => {
    if (!amount) return "KSh 0";
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
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
      navigate('/applications');
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
          <h2>CHAK Estates</h2>
        </div>
      </div>

      {/* CENTER: SEARCH */}
      <div className="navbar-search-container" ref={searchRef}>
        <form onSubmit={handleSearchSubmit} className="navbar-search-box">
          <FaSearch className="search-icon" />
          <input 
            type="text" 
            placeholder="Search properties, tenants, units, landlords, payments, maintenance..." 
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
                {isSearching ? "Searching..." : `${searchResults.length} results found`}
              </span>
            </div>
            
            <div className="search-results-list">
              {isSearching ? (
                <div className="search-loading">
                  <div className="search-spinner"></div>
                  <p>Searching for "{searchTerm}"...</p>
                </div>
              ) : searchResults.length > 0 ? (
                <>
                  {/* Group results by category */}
                  {Object.entries(
                    searchResults.reduce((groups, result) => {
                      const category = result.category;
                      if (!groups[category]) groups[category] = [];
                      groups[category].push(result);
                      return groups;
                    }, {})
                  ).map(([category, categoryResults]) => (
                    <div key={category} className="search-category-group">
                      <div className="search-category-header">
                        <span className="category-name">{category}</span>
                        <span className="category-count">{categoryResults.length}</span>
                      </div>
                      {categoryResults.map((result) => (
                        <div 
                          key={`${result.type}-${result.id}`}
                          className="search-result-item"
                          onClick={() => handleResultClick(result)}
                        >
                          <div className="result-icon">
                            {result.icon}
                          </div>
                          <div className="result-content">
                            <h5 className="result-title">{result.title}</h5>
                            <p className="result-subtitle">{result.subtitle}</p>
                            {result.description && (
                              <p className="result-description">{result.description}</p>
                            )}
                          </div>
                          <FaChevronRight className="result-chevron" />
                        </div>
                      ))}
                    </div>
                  ))}
                </>
              ) : (
                <div className="no-results">
                  <p>No results found for "{searchTerm}"</p>
                  <small>Try searching with different keywords</small>
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
                  View All Notifications
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