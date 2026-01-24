// src/pages/analytics/TenantBehaviorAnalysis.jsx - FIXED VERSION
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsService } from '../../services/analyticsService';
import MetricCard from '../../components/analytics/MetricCard';
import { 
  FaUsers, 
  FaChartLine, 
  FaCheckCircle, 
  FaExclamationTriangle,
  FaClock,
  FaDollarSign,
  FaUserCheck,
  FaUserTimes,
  FaCalendar,
  FaDownload,
  FaFilter,
  FaSearch,
  FaSpinner,
  FaEye,
  FaFlag
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import '../../styles/analytics.css';

const TenantBehaviorAnalysis = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [flaggingTenant, setFlaggingTenant] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [sortBy, setSortBy] = useState('riskScore');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    loadTenantData();
  }, []);

  const loadTenantData = async () => {
    try {
      setLoading(true);
      const analyticsData = await analyticsService.getTenantBehaviorAnalytics();
      setData(analyticsData);
      toast.success('Tenant behavior data loaded');
    } catch (error) {
      console.error('Error loading tenant behavior data:', error);
      toast.error('Failed to load tenant data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const getRiskCategory = (score) => {
    if (score <= 30) return { label: 'Low Risk', color: 'success' };
    if (score <= 70) return { label: 'Medium Risk', color: 'warning' };
    return { label: 'High Risk', color: 'danger' };
  };

  const getPaymentConsistency = (patterns) => {
    if (!patterns || patterns.onTimeRate === undefined) return 'Unknown';
    if (patterns.onTimeRate >= 0.9) return 'Excellent';
    if (patterns.onTimeRate >= 0.8) return 'Good';
    if (patterns.onTimeRate >= 0.7) return 'Fair';
    return 'Poor';
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadTenantData();
    } catch (error) {
      // Error handled in loadTenantData
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      toast.info('Generating tenant behavior report...');
      await analyticsService.exportAnalyticsToCSV('tenant-behavior', data);
      toast.success('Tenant report exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export tenant report');
    } finally {
      setExporting(false);
    }
  };

  const handleSendReminder = async (tenantId, tenantName) => {
    try {
      toast.info(`Sending reminder to ${tenantName}...`);
      await analyticsService.sendPaymentReminder(tenantId);
      toast.success(`Reminder sent to ${tenantName}`);
      // Refresh data
      loadTenantData();
    } catch (error) {
      console.error('Failed to send reminder:', error);
      toast.error('Failed to send reminder');
    }
  };

  const handleSendBulkReminders = async () => {
    try {
      setSendingReminders(true);
      toast.info('Sending bulk reminders...');
      
      // Get tenants with outstanding balance
      const tenantsWithBalance = filteredTenants.filter(t => t.balance > 0);
      const tenantIds = tenantsWithBalance.map(t => t.tenantId);
      
      if (tenantIds.length === 0) {
        toast.warning('No tenants with outstanding balance');
        return;
      }

      const result = await analyticsService.sendBulkReminders(tenantIds);
      toast.success(`Sent ${result.successful} reminders successfully`);
      
      // Refresh data
      loadTenantData();
    } catch (error) {
      console.error('Failed to send bulk reminders:', error);
      toast.error('Failed to send bulk reminders');
    } finally {
      setSendingReminders(false);
    }
  };

  const handleFlagTenant = async (tenantId, tenantName, reason) => {
    try {
      setFlaggingTenant(tenantId);
      toast.info(`Flagging ${tenantName} for review...`);
      await analyticsService.flagTenantForReview(tenantId, reason, 'high');
      toast.success(`${tenantName} flagged for review`);
      // Refresh data
      loadTenantData();
    } catch (error) {
      console.error('Failed to flag tenant:', error);
      toast.error('Failed to flag tenant');
    } finally {
      setFlaggingTenant(null);
    }
  };

  const handleViewTenantDetails = (tenantId) => {
    navigate(`/tenants/${tenantId}`);
  };

  const handleViewTenantFiles = () => {
    navigate('/tenants?filter=flagged');
  };

  const handleImplementAutoReminders = () => {
    toast.info('Configuring auto-reminders...');
    navigate('/settings/notifications');
  };

  // Filter and sort tenants
  const filteredTenants = data?.details?.tenants
    ?.filter(tenant => {
      if (!tenant) return false;
      
      // Search filter
      const matchesSearch = 
        !searchTerm ||
        (tenant.tenantName && tenant.tenantName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (tenant.propertyName && tenant.propertyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (tenant.unitNumber && tenant.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Risk filter
      const matchesRisk = 
        riskFilter === 'all' ||
        (riskFilter === 'low' && tenant.riskScore <= 30) ||
        (riskFilter === 'medium' && tenant.riskScore > 30 && tenant.riskScore <= 70) ||
        (riskFilter === 'high' && tenant.riskScore > 70);
      
      return matchesSearch && matchesRisk;
    })
    ?.sort((a, b) => {
      if (!a || !b) return 0;
      
      if (sortBy === 'riskScore') return (b.riskScore || 0) - (a.riskScore || 0);
      if (sortBy === 'balance') return (b.balance || 0) - (a.balance || 0);
      if (sortBy === 'monthlyRent') return (b.monthlyRent || 0) - (a.monthlyRent || 0);
      if (sortBy === 'overduePayments') return (b.overduePayments?.length || 0) - (a.overduePayments?.length || 0);
      return (a.tenantName || '').localeCompare(b.tenantName || '');
    }) || [];

  // Pagination
  const totalPages = Math.ceil(filteredTenants.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTenants = filteredTenants.slice(startIndex, startIndex + itemsPerPage);

  if (loading) {
    return (
      <div className="section-loading">
        <div className="spinner"></div>
        <p>Loading tenant behavior analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="no-data">
        <p>No tenant behavior data available</p>
        <button className="action-btn" onClick={loadTenantData}>
          Retry
        </button>
      </div>
    );
  }

  const { summary, details } = data;

  return (
    <div className="tenant-behavior-analysis">
      {/* Section Header */}
      <div className="section-header">
        <h2>
          <FaUsers /> Tenant Behavior Analytics
        </h2>
        <p className="section-subtitle">
          Payment patterns, risk assessment, and tenant performance
        </p>
        <div className="section-actions">
          <button 
            className="refresh-btn" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <>
                <FaSpinner className="spinner" /> Refreshing...
              </>
            ) : (
              <>
                <FaCalendar /> Refresh
              </>
            )}
          </button>
          <button 
            className="export-btn" 
            onClick={handleExport}
            disabled={exporting || !data}
          >
            {exporting ? (
              <>
                <FaSpinner className="spinner" /> Exporting...
              </>
            ) : (
              <>
                <FaDownload /> Export Report
              </>
            )}
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <MetricCard
          title="Total Tenants"
          value={summary.totalTenants}
          icon={<FaUsers />}
          trend="neutral"
          subtitle={`Active tenants`}
          color="primary"
        />
        
        <MetricCard
          title="Average Risk Score"
          value={Math.round(summary.averageRiskScore)}
          icon={<FaChartLine />}
          trend={summary.averageRiskScore < 50 ? 'down' : 'up'}
          subtitle={`/100 (lower is better)`}
          color={summary.averageRiskScore < 50 ? 'success' : 'warning'}
        />
        
        <MetricCard
          title="On-Time Payers"
          value={summary.onTimePayers}
          icon={<FaUserCheck />}
          trend="up"
          subtitle={`${Math.round((summary.onTimePayers / summary.totalTenants) * 100)}% of tenants`}
          color="success"
        />
        
        <MetricCard
          title="Outstanding Balance"
          value={formatCurrency(summary.totalOutstandingBalance)}
          icon={<FaExclamationTriangle />}
          trend={summary.totalOutstandingBalance > 0 ? 'down' : 'neutral'}
          subtitle="Total overdue amount"
          color="danger"
        />
        
        <MetricCard
          title="Frequent Late Payers"
          value={summary.frequentLatePayers}
          icon={<FaUserTimes />}
          trend={summary.frequentLatePayers > 0 ? 'down' : 'neutral'}
          subtitle="Require attention"
          color="warning"
        />
        
        <MetricCard
          title="Monthly Rent Revenue"
          value={formatCurrency(summary.totalMonthlyRent)}
          icon={<FaDollarSign />}
          trend="up"
          subtitle="Expected monthly income"
          color="info"
        />
      </div>

      {/* Risk Distribution */}
      <div className="risk-distribution">
        <h3><FaChartLine /> Risk Distribution</h3>
        <div className="distribution-chart">
          <div className="distribution-bars">
            {Object.entries(details.riskDistribution || {}).map(([category, data]) => (
              <div key={category} className="distribution-bar-container">
                <div className="distribution-label">
                  {category === 'low' ? 'Low Risk' : category === 'medium' ? 'Medium Risk' : 'High Risk'}
                </div>
                <div className="distribution-bar">
                  <div 
                    className={`distribution-fill ${category}`}
                    style={{ 
                      width: `${(data.count / summary.totalTenants) * 100}%`,
                      backgroundColor: 
                        category === 'low' ? '#4CAF50' : 
                        category === 'medium' ? '#FF9800' : '#F44336'
                    }}
                  ></div>
                </div>
                <div className="distribution-value">
                  {data.count} tenants ({Math.round((data.count / summary.totalTenants) * 100)}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="search-filters">
        <div className="search-box">
          <FaSearch />
          <input
            type="text"
            placeholder="Search tenants by name, property, or unit..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset to first page on search
            }}
            disabled={exporting || refreshing}
          />
        </div>
        
        <div className="filter-controls">
          <select 
            value={riskFilter}
            onChange={(e) => {
              setRiskFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="filter-select"
            disabled={exporting || refreshing}
          >
            <option value="all">All Risk Levels</option>
            <option value="low">Low Risk Only</option>
            <option value="medium">Medium Risk</option>
            <option value="high">High Risk</option>
          </select>
          
          <select 
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setCurrentPage(1);
            }}
            className="sort-select"
            disabled={exporting || refreshing}
          >
            <option value="riskScore">Sort by Risk Score</option>
            <option value="balance">Sort by Balance</option>
            <option value="monthlyRent">Sort by Rent Amount</option>
            <option value="overduePayments">Sort by Overdue Payments</option>
            <option value="name">Sort by Name</option>
          </select>
        </div>
      </div>

      {/* Tenants List */}
      <div className="tenants-list">
        <div className="tenants-header">
          <h3>Tenant Performance Analysis</h3>
          <div className="tenants-stats">
            Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredTenants.length)} of {filteredTenants.length} tenants
          </div>
        </div>
        <div className="tenants-table-container">
          <table className="tenants-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Property/Unit</th>
                <th>Monthly Rent</th>
                <th>Risk Score</th>
                <th>Payment Consistency</th>
                <th>Overdue Payments</th>
                <th>Outstanding Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTenants.map((tenant, index) => {
                const riskCategory = getRiskCategory(tenant.riskScore);
                const consistency = getPaymentConsistency(tenant.paymentPatterns);
                
                return (
                  <tr key={index} className={`tenant-row risk-${riskCategory.color}`}>
                    <td>
                      <div className="tenant-info">
                        <strong>{tenant.tenantName || 'Unknown'}</strong>
                        <small>{tenant.status || 'N/A'}</small>
                      </div>
                    </td>
                    <td>
                      <div className="property-info">
                        <div>{tenant.propertyName || 'N/A'}</div>
                        <small>Unit {tenant.unitNumber || tenant.unitId || 'N/A'}</small>
                      </div>
                    </td>
                    <td className="rent-amount">
                      {formatCurrency(tenant.monthlyRent)}
                    </td>
                    <td>
                      <div className="risk-score">
                        <div className={`risk-badge ${riskCategory.color}`}>
                          {tenant.riskScore || 0} • {riskCategory.label}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className={`consistency-badge ${consistency.toLowerCase()}`}>
                        {consistency}
                      </div>
                      <small>Avg {tenant.paymentPatterns?.avgDaysLate || 0} days late</small>
                    </td>
                    <td>
                      <div className="overdue-count">
                        {(tenant.overduePayments?.length || 0) > 0 ? (
                          <span className="overdue-badge">
                            {tenant.overduePayments.length} pending
                          </span>
                        ) : (
                          <span className="no-overdue">None</span>
                        )}
                      </div>
                    </td>
                    <td className="balance-amount">
                      {tenant.balance > 0 ? (
                        <span className="balance-warning">
                          {formatCurrency(tenant.balance)}
                        </span>
                      ) : (
                        <span className="balance-clear">Paid up</span>
                      )}
                    </td>
                    <td>
                      <div className="tenant-actions">
                        <button 
                          className="action-btn small" 
                          title="View Details"
                          onClick={() => handleViewTenantDetails(tenant.tenantId)}
                        >
                          <FaEye /> View
                        </button>
                        {tenant.balance > 0 && (
                          <button 
                            className="action-btn small warning" 
                            title="Send Reminder"
                            onClick={() => handleSendReminder(tenant.tenantId, tenant.tenantName)}
                            disabled={sendingReminders}
                          >
                            Remind
                          </button>
                        )}
                        {tenant.riskScore > 70 && (
                          <button 
                            className="action-btn small danger" 
                            title="Flag for Review"
                            onClick={() => handleFlagTenant(tenant.tenantId, tenant.tenantName, 'High risk score')}
                            disabled={flaggingTenant === tenant.tenantId}
                          >
                            {flaggingTenant === tenant.tenantId ? (
                              <FaSpinner className="spinner" />
                            ) : (
                              <FaFlag />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {filteredTenants.length === 0 && (
            <div className="no-tenants-found">
              <FaUsers />
              <p>No tenants match your search criteria</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button 
                className="pagination-btn" 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {currentPage} of {totalPages}
              </span>
              <button 
                className="pagination-btn" 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Top Risk Insights */}
      <div className="risk-insights">
        <h3><FaExclamationTriangle /> High-Risk Tenant Insights</h3>
        <div className="insights-grid">
          {details.tenants
            ?.filter(t => t.riskScore > 70)
            .slice(0, 3)
            .map((tenant, index) => (
              <div key={index} className="risk-insight-card">
                <div className="insight-header">
                  <div className="tenant-risk">
                    <div className="risk-score-high">{tenant.riskScore}</div>
                    <span className="risk-label">High Risk</span>
                  </div>
                  <div className="tenant-name">{tenant.tenantName || 'Unknown'}</div>
                </div>
                
                <div className="insight-details">
                  <div className="detail-item">
                    <span className="label">Property:</span>
                    <span className="value">{tenant.propertyName || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Overdue Payments:</span>
                    <span className="value warning">{tenant.overduePayments?.length || 0}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Outstanding:</span>
                    <span className="value danger">{formatCurrency(tenant.balance || 0)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Payment Pattern:</span>
                    <span className="value">
                      {getPaymentConsistency(tenant.paymentPatterns)}
                    </span>
                  </div>
                </div>
                
                <div className="insight-recommendation">
                  <FaExclamationTriangle />
                  <span>Consider lease review or additional deposit</span>
                </div>
              </div>
            ))}
          
          {(!details.tenants || details.tenants.filter(t => t.riskScore > 70).length === 0) && (
            <div className="no-high-risk">
              <FaCheckCircle />
              <p>No high-risk tenants detected. Excellent!</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Patterns */}
      <div className="payment-patterns">
        <h3><FaChartLine /> Payment Pattern Analysis</h3>
        <div className="patterns-summary">
          <div className="pattern-card">
            <div className="pattern-icon success">
              <FaUserCheck />
            </div>
            <div className="pattern-content">
              <h4>Always On Time</h4>
              <div className="pattern-count">{details.paymentPatterns?.alwaysOnTime || 0} tenants</div>
              <p>Pay consistently before due date</p>
            </div>
          </div>
          
          <div className="pattern-card">
            <div className="pattern-icon warning">
              <FaClock />
            </div>
            <div className="pattern-content">
              <h4>Occasionally Late</h4>
              <div className="pattern-count">{details.paymentPatterns?.occasionallyLate || 0} tenants</div>
              <p>Average {details.paymentPatterns?.avgDaysLate || 0} days late</p>
            </div>
          </div>
          
          <div className="pattern-card">
            <div className="pattern-icon danger">
              <FaUserTimes />
            </div>
            <div className="pattern-content">
              <h4>Frequently Late</h4>
              <div className="pattern-count">{details.paymentPatterns?.frequentlyLate || 0} tenants</div>
              <p>Require frequent follow-ups</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Recommendations */}
      <div className="action-recommendations">
        <h3>Recommended Actions</h3>
        <div className="recommendations-grid">
          {summary.totalOutstandingBalance > 0 && (
            <div className="recommendation">
              <FaExclamationTriangle className="recommendation-icon danger" />
              <div className="recommendation-content">
                <h4>Collect Outstanding Balances</h4>
                <p>{formatCurrency(summary.totalOutstandingBalance)} in overdue payments</p>
                <button 
                  className="action-btn" 
                  onClick={handleSendBulkReminders}
                  disabled={sendingReminders}
                >
                  {sendingReminders ? 'Sending...' : 'Send Payment Reminders'}
                </button>
              </div>
            </div>
          )}
          
          {details.tenants?.filter(t => t.riskScore > 70).length > 0 && (
            <div className="recommendation">
              <FaExclamationTriangle className="recommendation-icon warning" />
              <div className="recommendation-content">
                <h4>Review High-Risk Tenants</h4>
                <p>{details.tenants.filter(t => t.riskScore > 70).length} tenants flagged as high risk</p>
                <button 
                  className="action-btn" 
                  onClick={handleViewTenantFiles}
                >
                  Review Tenant Files
                </button>
              </div>
            </div>
          )}
          
          <div className="recommendation">
            <FaChartLine className="recommendation-icon primary" />
            <div className="recommendation-content">
              <h4>Improve Payment Consistency</h4>
              <p>{summary.frequentLatePayers} tenants frequently pay late</p>
              <button 
                className="action-btn" 
                onClick={handleImplementAutoReminders}
              >
                Implement Auto-Reminders
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantBehaviorAnalysis;