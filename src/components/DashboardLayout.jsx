import React, { useState, createContext, useContext, useEffect } from "react";
import Sidebar from "./Sidebar";
import TopNavbar from "./TopNavbar";
import { useLocation } from "react-router-dom";
import "../styles/DashboardLayout.css";

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
      if (mobile) setIsSidebarExpanded(false);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setIsSidebarExpanded(false);
    }
  }, [location.pathname, isMobile]);

  const toggleSidebar = () => {
    setIsSidebarExpanded(!isSidebarExpanded);
  };

  const getMarginLeft = () => {
    if (isMobile) return "0px";
    return isSidebarExpanded ? "250px" : "70px";
  };

  const getWidthClass = () => {
    if (isMobile) return "mobile";
    return isSidebarExpanded ? "sidebar-expanded" : "sidebar-collapsed";
  };

  return (
    <SidebarContext.Provider value={{ isSidebarExpanded, toggleSidebar }}>
      <div className="dashboard-layout">
        <TopNavbar />
        
        <div className="layout-container">
          <Sidebar />
          
          <main 
            className={`main-content ${getWidthClass()}`}
            style={{ 
              marginLeft: getMarginLeft(),
              marginTop: "70px"
            }}
          >
            <div className="content-wrapper">
              {children}
            </div>
          </main>
          
          {isMobile && isSidebarExpanded && (
            <div 
              className="sidebar-overlay"
              onClick={() => setIsSidebarExpanded(false)}
            />
          )}
        </div>
      </div>
    </SidebarContext.Provider>
  );
};

export default DashboardLayout;