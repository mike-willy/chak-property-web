import React from "react";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import StatsGrid from "../components/dashboard/StatsGrid";
import FinancialChart from "../components/dashboard/FinancialChart";
import PropertyStatusChart from "../components/dashboard/PropertyStatusChart";
import QuickActions from "../components/dashboard/QuickActions";
import OverduePayments from "../components/dashboard/OverduePayments";
import RecentActivity from "../components/dashboard/RecentActivity";
import "../styles/dashboard.css";

const Dashboard = () => {
  return (
    <div className="dashboard-container">
      <DashboardHeader />
      <StatsGrid />

      {/* Main Grid Content */}
      <div className="dashboard-grid-content">
        
        {/* ROW 1: Financial Chart + Utility Cards */}
        <div className="dashboard-row">
          <div className="row-main">
            <FinancialChart />
          </div>
          <div className="row-side">
            <QuickActions />
            <PropertyStatusChart />
          </div>
        </div>

        {/* ROW 2: Overdue Payments + Recent Activity */}
        <div className="dashboard-row">
          <div className="row-main">
            <OverduePayments />
          </div>
          <div className="row-side">
            <RecentActivity />
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;