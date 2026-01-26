// src/pages/analytics/AnalyticsDashboard.jsx - UPDATED WITH PDF DROPDOWN
import React, { useState, useEffect, useRef } from 'react';
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
  FaExclamationTriangle,
  FaFileExcel,
  FaFilePdf,
  FaChevronDown
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import '../../styles/analytics.css';

const AnalyticsDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('rent-collection');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState('monthly');
  const [refreshKey, setRefreshKey] = useState(0);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef(null);
  const [overviewMetrics, setOverviewMetrics] = useState({
    collectionRate: 0,
    vacancyRate: 0,
    totalTenants: 0,
    totalRevenue: 0,
    pendingPayments: 0,
    vacantUnits: 0
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setExportDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Get active tab from URL hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && ['rent-collection', 'vacancy-rates', 'tenant-behavior', 'insights'].includes(hash)) {
        setActiveTab(hash);
        window.scrollTo(0, 0);
      } else {
        setActiveTab('rent-collection');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Also check when location changes
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
    navigate(`#${tab}`, { replace: true });
    window.scrollTo(0, 0);
  };

  const handleTimeframeChange = async (newTimeframe) => {
    setTimeframe(newTimeframe);
    toast.info(`Timeframe changed to ${newTimeframe}`);
  };

  // UPDATED: Export function with format parameter
  const handleExportReport = async (format = 'csv', reportType = 'full') => {
    try {
      setExportDropdownOpen(false);
      toast.info(`Generating ${format.toUpperCase()} report...`);
      
      // Map reportType to match service expectations
      let serviceReportType = 'full';
      if (reportType === 'current') {
        // Export current tab
        const tabMap = {
          'rent-collection': 'rent',
          'vacancy-rates': 'vacancy',
          'tenant-behavior': 'tenants',
          'insights': 'insights'
        };
        serviceReportType = tabMap[activeTab] || 'full';
      }
      
      await analyticsService.generateComprehensiveReport(serviceReportType, timeframe, format);
      toast.success(`${format.toUpperCase()} report downloaded successfully!`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(`Failed to generate ${format} report: ${error.message}`);
    }
  };

  // Export individual section
  const handleExportSection = async (sectionType, format = 'pdf') => {
    try {
      setExportDropdownOpen(false);
      toast.info(`Exporting ${sectionType} as ${format.toUpperCase()}...`);
      
      await analyticsService.generatePDFReport(sectionType, timeframe);
      toast.success(`${sectionType} exported as ${format.toUpperCase()}!`);
    } catch (error) {
      console.error('Section export failed:', error);
      toast.error(`Failed to export ${sectionType}: ${error.message}`);
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

          {/* UPDATED: Export Dropdown */}
          <div className="export-dropdown-container" ref={exportDropdownRef}>
            <button 
              className="export-btn"
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
            >
              <FaDownload /> Export <FaChevronDown className="dropdown-arrow" />
            </button>
            
            {exportDropdownOpen && (
              <div className="export-dropdown-menu">
                <div className="dropdown-section">
                  <div className="dropdown-section-title">Full Report</div>
                  <button 
                    className="export-option"
                    onClick={() => handleExportReport('csv', 'full')}
                  >
                    <FaFileExcel className="excel-icon" /> Excel (Full Report)
                  </button>
                  <button 
                    className="export-option"
                    onClick={() => handleExportReport('pdf', 'full')}
                  >
                    <FaFilePdf className="pdf-icon" /> PDF (Full Report)
                  </button>
                </div>

                <div className="dropdown-separator"></div>

                <div className="dropdown-section">
                  <div className="dropdown-section-title">Current Tab</div>
                  <button 
                    className="export-option"
                    onClick={() => handleExportReport('csv', 'current')}
                  >
                    <FaFileExcel /> Export Current Tab (Excel)
                  </button>
                  <button 
                    className="export-option"
                    onClick={() => handleExportReport('pdf', 'current')}
                  >
                    <FaFilePdf /> Export Current Tab (PDF)
                  </button>
                </div>

                <div className="dropdown-separator"></div>

                <div className="dropdown-section">
                  <div className="dropdown-section-title">Individual Reports (PDF)</div>
                  <button 
                    className="export-option"
                    onClick={() => handleExportSection('rent-collection')}
                  >
                    <FaDollarSign /> Rent Collection
                  </button>
                  <button 
                    className="export-option"
                    onClick={() => handleExportSection('vacancy-rate')}
                  >
                    <FaHome /> Vacancy Rate
                  </button>
                  <button 
                    className="export-option"
                    onClick={() => handleExportSection('tenant-behavior')}
                  >
                    <FaUsers /> Tenant Behavior
                  </button>
                  <button 
                    className="export-option"
                    onClick={() => handleExportSection('analytics-insights')}
                  >
                    <FaLightbulb /> Insights
                  </button>
                </div>
              </div>
            )}
          </div>
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