import React, { useState, createContext, useContext, useEffect } from "react";
import Sidebar from "./Sidebar";
import TopNavbar from "./TopNavbar";
import { useLocation } from "react-router-dom";

// Create context for sidebar state
const SidebarContext = createContext();

export const useSidebar = () => useContext(SidebarContext);

const DashboardLayout = ({ children }) => {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-collapse sidebar on non-dashboard pages
  useEffect(() => {
    if (location.pathname === "/dashboard") {
      setIsSidebarExpanded(true);
    } else {
      setIsSidebarExpanded(false);
    }
  }, [location.pathname]);

  const toggleSidebar = () => {
    setIsSidebarExpanded(!isSidebarExpanded);
  };

  // Calculate margin based on device and sidebar state
  let sidebarWidth;
  if (isMobile) {
    // On mobile: NO margin when collapsed, NO margin when expanded (overlay)
     sidebarWidth = isSidebarExpanded ? 0 : 60;
  } else {
    // On desktop: margin based on sidebar state
    sidebarWidth = isSidebarExpanded ? 250 : 70;
  }

  return (
    <SidebarContext.Provider value={{ isSidebarExpanded, toggleSidebar }}>
      <div className={`dashboard-wrapper ${isSidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <Sidebar />
          <div style={{ 
            flex: 1, 
            marginLeft: `${sidebarWidth}px`,
            position: "relative",
            transition: "margin-left 0.3s ease",
            overflowX: "hidden"
          }}>
            <TopNavbar />
            <div className="dashboard-container">
              {children}
            </div>
          </div>
        </div>
      </div>
    </SidebarContext.Provider>
  );
};

export default DashboardLayout;