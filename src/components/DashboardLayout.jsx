import React, { useState, createContext, useContext, useEffect } from "react";
import Sidebar from "./Sidebar";
import TopNavbar from "./TopNavbar";
import { useLocation } from "react-router-dom";

const SidebarContext = createContext();
export const useSidebar = () => useContext(SidebarContext);

const DashboardLayout = ({ children }) => {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      // Auto-collapse on mobile initially
      if (mobile) setIsSidebarExpanded(false);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Collapse sidebar when navigating on mobile
  useEffect(() => {
    if (isMobile) {
      setIsSidebarExpanded(false);
    }
  }, [location.pathname, isMobile]);

  const toggleSidebar = () => {
    setIsSidebarExpanded(!isSidebarExpanded);
  };

  // Logic: Desktop needs margin to avoid being hidden behind fixed Sidebar.
  // Mobile Sidebar is an overlay, so content stays at 0 margin.
  const getMarginLeft = () => {
    if (isMobile) return "0px";
    return isSidebarExpanded ? "250px" : "70px";
  };

  return (
    <SidebarContext.Provider value={{ isSidebarExpanded, toggleSidebar }}>
      <div className={`dashboard-wrapper ${isSidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
        <Sidebar />
        
        <main style={{ 
          flex: 1, 
          marginLeft: getMarginLeft(),
          transition: "margin-left 0.3s ease",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column"
        }}>
          <TopNavbar />
          
          {/* REMOVED extra <div className="dashboard-container"> here 
              because Dashboard.jsx already has it. This prevents double padding.
          */}
          {children}
          
          {/* Mobile Overlay: Closes sidebar when clicking outside on mobile */}
          {isMobile && isSidebarExpanded && (
            <div 
              onClick={() => setIsSidebarExpanded(false)}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.5)",
                zIndex: 99 // Just below the Sidebar
              }}
            />
          )}
        </main>
      </div>
    </SidebarContext.Provider>
  );
};

export default DashboardLayout;