// src/pages/analytics/AnalyticsDashboard.jsx - FIXED VERSION
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { analyticsService } from '../../services/analyticsService';
import RentCollectionAnalysis from './RentCollectionAnalysis';
import VacancyRateAnalysis from './VacancyRateAnalysis';
import TenantBehaviorAnalysis from './TenantBehaviorAnalysis';
import AnalyticsInsights from './AnalyticsInsights';
import MetricCard from '../../components/analytics/MetricCard';
import { 
  FaChartLine, 
  FaHome, 
  FaUsers, 
  FaLightbulb, 
  FaSync, 
  FaFilter,
  FaCalendar,
  FaDollarSign,
  FaDoorClosed,
  FaDownload,
  FaUserCheck,
  FaExclamationTriangle
} from 'react-icons/fa';
import { toast } from 'react-toastify'; // Add toast notifications
import '../../styles/analytics.css';

const AnalyticsDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('rent-collection');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState('monthly');
  const [refreshKey, setRefreshKey] = useState(0);
  const [overviewMetrics, setOverviewMetrics] = useState({
    collectionRate: 0,
    vacancyRate: 0,
    totalTenants: 0,
    totalRevenue: 0,
    pendingPayments: 0,
    vacantUnits: 0
  });

  // Get active tab from URL hash - FIXED VERSION
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && ['rent-collection', 'vacancy-rates', 'tenant-behavior', 'insights'].includes(hash)) {
        setActiveTab(hash);
        // Scroll to top when hash changes
        window.scrollTo(0, 0);
      } else {
        // Default to rent-collection if no valid hash
        setActiveTab('rent-collection');
      }
    };

    // Initial check
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Also check when location changes (for React Router navigation)
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash && ['rent-collection', 'vacancy-rates', 'tenant-behavior', 'insights'].includes(hash)) {
      setActiveTab(hash);
      window.scrollTo(0, 0);
    }
  }, [location]);

  // Load overview metrics
  useEffect(() => {
    loadOverviewMetrics();
  }, [refreshKey, timeframe]);

  const loadOverviewMetrics = async () => {
    try {
      setLoading(true);
      
      // Load all analytics data in parallel for overview
      const [rentData, vacancyData, tenantData] = await Promise.all([
        analyticsService.getRentCollectionAnalytics(timeframe),
        analyticsService.getVacancyRateAnalytics(),
        analyticsService.getTenantBehaviorAnalytics()
      ]);

      setOverviewMetrics({
        collectionRate: rentData.summary.collectionRate,
        vacancyRate: vacancyData.summary.vacancyRate,
        totalTenants: tenantData.summary.totalTenants,
        totalRevenue: rentData.summary.collectedRent,
        pendingPayments: rentData.summary.latePaymentsCount,
        vacantUnits: vacancyData.summary.vacantUnits
      });
      
    } catch (error) {
      console.error('Error loading overview metrics:', error);
      toast.error('Failed to load dashboard metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setRefreshKey(prev => prev + 1);
      toast.info('Refreshing analytics data...');
    } catch (error) {
      toast.error('Failed to refresh data');
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // FIXED: Use React Router navigation instead of window.location
    navigate(`#${tab}`, { replace: true });
    // Force scroll to top
    window.scrollTo(0, 0);
  };

  const handleTimeframeChange = async (newTimeframe) => {
    setTimeframe(newTimeframe);
    toast.info(`Timeframe changed to ${newTimeframe}`);
  };

  const handleExportFullReport = async () => {
    try {
      toast.info('Generating comprehensive report...');
      await analyticsService.generateComprehensiveReport('full', timeframe);
      toast.success('Report downloaded successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to generate report');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatPercent = (value) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  if (loading && refreshKey === 0) {
    return (
      <div className="analytics-loading">
        <div className="spinner"></div>
        <p>Loading analytics dashboard...</p>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      {/* Header */}
      <div className="analytics-header">
        <div className="analytics-header-left">
          <h1>
            <FaChartLine className="header-icon" />
            Analytics & Reports
          </h1>
          <p className="subtitle">Data-driven insights for better property management decisions</p>
        </div>
        
        <div className="analytics-header-right">
          <div className="timeframe-selector">
            <FaCalendar />
            <select 
              value={timeframe} 
              onChange={(e) => handleTimeframeChange(e.target.value)}
              className="timeframe-select"
              disabled={refreshing}
            >
              <option value="daily">Today</option>
              <option value="weekly">This Week</option>
              <option value="monthly">This Month</option>
              <option value="quarterly">This Quarter</option>
              <option value="yearly">This Year</option>
            </select>
          </div>
          
          <button 
            className="refresh-btn" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <>
                <div className="spinner-small"></div> Refreshing...
              </>
            ) : (
              <>
                <FaSync /> Refresh Data
              </>
            )}
          </button>

          <button 
            className="export-btn" 
            onClick={handleExportFullReport}
            title="Download comprehensive report"
          >
            <FaDownload /> Full Report
          </button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="overview-metrics">
        <MetricCard
          title="Rent Collection Rate"
          value={formatPercent(overviewMetrics.collectionRate)}
          icon={<FaDollarSign />}
          trend={overviewMetrics.collectionRate > 0.85 ? 'up' : 'down'}
          subtitle={`${timeframe} performance`}
          color="primary"
        />
        
        <MetricCard
          title="Vacancy Rate"
          value={formatPercent(overviewMetrics.vacancyRate)}
          icon={<FaDoorClosed />}
          trend={overviewMetrics.vacancyRate < 0.15 ? 'up' : 'down'}
          subtitle={`${overviewMetrics.vacantUnits} vacant units`}
          color="warning"
        />
        
        <MetricCard
          title="Active Tenants"
          value={overviewMetrics.totalTenants}
          icon={<FaUsers />}
          trend="neutral"
          subtitle="Currently paying rent"
          color="success"
        />
        
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(overviewMetrics.totalRevenue)}
          icon={<FaChartLine />}
          trend="up"
          subtitle={`${timeframe} collected`}
          color="info"
        />
        
        <MetricCard
          title="Pending Payments"
          value={overviewMetrics.pendingPayments}
          icon={<FaExclamationTriangle />}
          trend={overviewMetrics.pendingPayments > 0 ? 'down' : 'neutral'}
          subtitle="Awaiting collection"
          color="danger"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="analytics-tabs">
        <button 
          className={`tab-btn ${activeTab === 'rent-collection' ? 'active' : ''}`}
          onClick={() => handleTabChange('rent-collection')}
        >
          <FaDollarSign /> Rent Collection
        </button>
        
        <button 
          className={`tab-btn ${activeTab === 'vacancy-rates' ? 'active' : ''}`}
          onClick={() => handleTabChange('vacancy-rates')}
        >
          <FaHome /> Vacancy Rates
        </button>
        
        <button 
          className={`tab-btn ${activeTab === 'tenant-behavior' ? 'active' : ''}`}
          onClick={() => handleTabChange('tenant-behavior')}
        >
          <FaUsers /> Tenant Behavior
        </button>
        
        <button 
          className={`tab-btn ${activeTab === 'insights' ? 'active' : ''}`}
          onClick={() => handleTabChange('insights')}
        >
          <FaLightbulb /> Insights & Recommendations
        </button>
      </div>

      {/* Tab Content */}
      <div className="analytics-content">
        {activeTab === 'rent-collection' && (
          <RentCollectionAnalysis timeframe={timeframe} />
        )}
        
        {activeTab === 'vacancy-rates' && (
          <VacancyRateAnalysis />
        )}
        
        {activeTab === 'tenant-behavior' && (
          <TenantBehaviorAnalysis />
        )}
        
        {activeTab === 'insights' && (
          <AnalyticsInsights />
        )}
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h3><FaFilter /> Quick Actions</h3>
        <div className="action-buttons">
          <button className="action-btn" onClick={() => navigate('/finance')}>
            <FaDollarSign /> View All Payments
          </button>
          <button className="action-btn" onClick={() => navigate('/units')}>
            <FaHome /> Manage Units
          </button>
          <button className="action-btn" onClick={() => navigate('/tenants')}>
            <FaUsers /> View Tenants
          </button>
          <button 
            className="action-btn" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <>
                <div className="spinner-small"></div> Updating...
              </>
            ) : (
              <>
                <FaSync /> Update Analytics
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;