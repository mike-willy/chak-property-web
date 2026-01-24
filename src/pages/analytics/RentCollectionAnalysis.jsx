// src/pages/analytics/RentCollectionAnalysis.jsx - FIXED VERSION
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsService } from '../../services/analyticsService';
import MetricCard from '../../components/analytics/MetricCard';
import { 
  FaDollarSign, 
  FaClock, 
  FaCheckCircle, 
  FaExclamationTriangle,
  FaChartLine,
  FaCalendar,
  FaDownload,
  FaLightbulb,
  FaUserTimes,
  FaSpinner
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import "../../styles/analytics.css";

const RentCollectionAnalysis = ({ timeframe }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [detailedView, setDetailedView] = useState(false);
  const [selectedTenants, setSelectedTenants] = useState([]);

  useEffect(() => {
    loadRentCollectionData();
  }, [timeframe]);

  const loadRentCollectionData = async () => {
    try {
      setLoading(true);
      const analyticsData = await analyticsService.getRentCollectionAnalytics(timeframe);
      setData(analyticsData);
      toast.success('Rent collection data loaded');
    } catch (error) {
      console.error('Error loading rent collection data:', error);
      toast.error('Failed to load rent collection data');
    } finally {
      setLoading(false);
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

  const handleExport = async () => {
    try {
      setExporting(true);
      toast.info('Generating rent collection report...');
      await analyticsService.exportAnalyticsToCSV('rent-collection', data);
      toast.success('Report exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export report');
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
      loadRentCollectionData();
    } catch (error) {
      console.error('Failed to send reminder:', error);
      toast.error('Failed to send reminder');
    }
  };

  const handleSendBulkReminders = async () => {
    try {
      setSendingReminders(true);
      toast.info('Sending bulk reminders...');
      const overdueTenants = data?.details?.overduePayments?.map(p => p.tenantId) || [];
      
      if (overdueTenants.length === 0) {
        toast.warning('No tenants to remind');
        return;
      }

      const result = await analyticsService.sendBulkReminders(overdueTenants);
      toast.success(`Sent ${result.successful} reminders successfully`);
      
      // Refresh data
      loadRentCollectionData();
    } catch (error) {
      console.error('Failed to send bulk reminders:', error);
      toast.error('Failed to send bulk reminders');
    } finally {
      setSendingReminders(false);
    }
  };

  const handleViewTenantDetails = (tenantId) => {
    navigate(`/tenants/${tenantId}`);
  };

  const handleViewDetailedAnalysis = () => {
    // Navigate to detailed analysis page or open modal
    toast.info('Opening detailed analysis...');
    // Implement detailed analysis view
  };

  const handleViewRiskReport = () => {
    navigate('/analytics#tenant-behavior');
  };

  if (loading) {
    return (
      <div className="section-loading">
        <div className="spinner"></div>
        <p>Loading rent collection data...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="no-data">
        <p>No rent collection data available</p>
        <button className="action-btn" onClick={loadRentCollectionData}>
          Retry
        </button>
      </div>
    );
  }

  const { summary, details } = data;

  return (
    <div className="rent-collection-analysis">
      {/* Section Header */}
      <div className="section-header">
        <h2>
          <FaDollarSign /> Rent Collection Analytics
        </h2>
        <p className="section-subtitle">
          Performance for {data.timeframe} • Updated just now
        </p>
        <div className="section-actions">
          <button 
            className="view-toggle"
            onClick={() => setDetailedView(!detailedView)}
            disabled={exporting || sendingReminders}
          >
            {detailedView ? 'Show Summary' : 'Show Details'}
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
          title="Collection Rate"
          value={formatPercent(summary.collectionRate)}
          icon={<FaChartLine />}
          trend={summary.collectionRate > 0.85 ? 'up' : 'down'}
          subtitle={`Target: 85%`}
          color={summary.collectionRate > 0.85 ? 'success' : 'warning'}
        />
        
        <MetricCard
          title="Collected Rent"
          value={formatCurrency(summary.collectedRent)}
          icon={<FaDollarSign />}
          trend="up"
          subtitle={`of ${formatCurrency(summary.expectedRent)} expected`}
          color="primary"
        />
        
        <MetricCard
          title="Outstanding"
          value={formatCurrency(summary.outstandingAmount)}
          icon={<FaClock />}
          trend={summary.outstandingAmount > 0 ? 'down' : 'neutral'}
          subtitle={`${summary.latePaymentsCount} pending payments`}
          color="danger"
        />
        
        <MetricCard
          title="Completed Payments"
          value={summary.completedPaymentsCount}
          icon={<FaCheckCircle />}
          trend="up"
          subtitle="Successfully processed"
          color="success"
        />
      </div>

      {/* Detailed View */}
      {detailedView ? (
        <div className="detailed-view">
          <div className="detailed-section">
            <h3><FaExclamationTriangle /> Overdue Payments</h3>
            {details.overduePayments.length > 0 ? (
              <div className="overdue-list">
                <table className="overdue-table">
                  <thead>
                    <tr>
                      <th>Tenant</th>
                      <th>Amount</th>
                      <th>Month</th>
                      <th>Days Overdue</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.overduePayments.slice(0, 10).map((payment, index) => (
                      <tr key={index}>
                        <td>{payment.tenantName || payment.tenantId}</td>
                        <td>{formatCurrency(payment.amount)}</td>
                        <td>{payment.month || 'N/A'}</td>
                        <td>
                          <span className="days-badge">
                            {/* FIXED: Use actual calculation instead of random */}
                            {payment.daysOverdue || 'Unknown'} days
                          </span>
                        </td>
                        <td>
                          <button 
                            className="action-btn small" 
                            onClick={() => handleSendReminder(payment.tenantId, payment.tenantName)}
                            disabled={sendingReminders}
                          >
                            Send Reminder
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="bulk-action">
                  <button 
                    className="action-btn warning" 
                    onClick={handleSendBulkReminders}
                    disabled={sendingReminders || details.overduePayments.length === 0}
                  >
                    {sendingReminders ? (
                      <>
                        <FaSpinner className="spinner" /> Sending...
                      </>
                    ) : (
                      <>
                        <FaExclamationTriangle /> Send Bulk Reminders ({details.overduePayments.length} tenants)
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="no-overdue">
                <FaCheckCircle />
                <p>No overdue payments! All rent collected on time.</p>
              </div>
            )}
          </div>

          <div className="detailed-section">
            <h3><FaCalendar /> Recent Payments</h3>
            <div className="recent-payments">
              {details.payments.slice(0, 5).map((payment, index) => (
                <div key={index} className="payment-item">
                  <div className="payment-info">
                    <div className="payment-tenant">
                      <strong>{payment.tenantName || payment.tenantId}</strong>
                      <span className={`payment-status ${payment.status}`}>
                        {payment.status}
                      </span>
                    </div>
                    <div className="payment-details">
                      <span>{payment.month || 'N/A'}</span>
                      <span>{formatCurrency(payment.amount)}</span>
                      {payment.mpesaCode && (
                        <span className="mpesa-code">{payment.mpesaCode}</span>
                      )}
                    </div>
                  </div>
                  <div className="payment-date">
                    {payment.createdAt ? new Date(payment.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Summary View */
        <div className="summary-view">
          <div className="summary-cards">
            <div className="summary-card performance">
              <h4>Performance Summary</h4>
              <div className="performance-metrics">
                <div className="performance-item">
                  <span className="label">Expected Rent:</span>
                  <span className="value">{formatCurrency(summary.expectedRent)}</span>
                </div>
                <div className="performance-item">
                  <span className="label">Collected Rent:</span>
                  <span className="value success">{formatCurrency(summary.collectedRent)}</span>
                </div>
                <div className="performance-item">
                  <span className="label">Outstanding:</span>
                  <span className="value warning">{formatCurrency(summary.outstandingAmount)}</span>
                </div>
                <div className="performance-item">
                  <span className="label">Collection Rate:</span>
                  <span className={`value ${summary.collectionRate > 0.85 ? 'success' : 'warning'}`}>
                    {formatPercent(summary.collectionRate)}
                  </span>
                </div>
              </div>
            </div>

            <div className="summary-card timeline">
              <h4>Collection Timeline</h4>
              <div className="timeline-chart">
                {/* Simple bar chart for monthly collection */}
                <div className="chart-bars">
                  {data.details.collectionTrend?.map((trend, index) => (
                    <div key={index} className="chart-bar-container">
                      <div className="chart-bar-label">{trend.month}</div>
                      <div className="chart-bar">
                        <div 
                          className="chart-bar-fill" 
                          style={{ height: `${trend.collectionRate * 100}%` }}
                        ></div>
                      </div>
                      <div className="chart-bar-value">{formatPercent(trend.collectionRate)}</div>
                    </div>
                  )) || (
                    <p className="no-chart-data">No trend data available</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="quick-insights">
            <h4><FaLightbulb /> Quick Insights</h4>
            <div className="insights-list">
              {summary.collectionRate < 0.85 && (
                <div className="insight-item warning">
                  <FaExclamationTriangle />
                  <div>
                    <strong>Collection rate below target (85%)</strong>
                    <p>Review overdue payments and send reminders</p>
                  </div>
                </div>
              )}
              
              {summary.latePaymentsCount > 0 && (
                <div className="insight-item info">
                  <FaClock />
                  <div>
                    <strong>{summary.latePaymentsCount} pending payments</strong>
                    <p>Total outstanding: {formatCurrency(summary.outstandingAmount)}</p>
                  </div>
                </div>
              )}
              
              {summary.collectionRate > 0.9 && (
                <div className="insight-item success">
                  <FaCheckCircle />
                  <div>
                    <strong>Excellent collection rate!</strong>
                    <p>Keep up the good work with tenant communication</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Recommendations */}
      <div className="action-recommendations">
        <h3>Recommended Actions</h3>
        <div className="recommendations-grid">
          {summary.latePaymentsCount > 0 && (
            <div className="recommendation">
              <FaExclamationTriangle className="recommendation-icon warning" />
              <div className="recommendation-content">
                <h4>Send Payment Reminders</h4>
                <p>Contact tenants with overdue payments</p>
                <button 
                  className="action-btn" 
                  onClick={handleSendBulkReminders}
                  disabled={sendingReminders}
                >
                  {sendingReminders ? 'Sending...' : 'Send Bulk Reminders'}
                </button>
              </div>
            </div>
          )}
          
          <div className="recommendation">
            <FaChartLine className="recommendation-icon primary" />
            <div className="recommendation-content">
              <h4>Review Collection Strategy</h4>
              <p>Analyze payment patterns for optimization</p>
              <button 
                className="action-btn" 
                onClick={handleViewDetailedAnalysis}
              >
                View Detailed Analysis
              </button>
            </div>
          </div>
          
          <div className="recommendation">
            <FaUserTimes className="recommendation-icon danger" />
            <div className="recommendation-content">
              <h4>Monitor High-Risk Tenants</h4>
              <p>Identify tenants with frequent late payments</p>
              <button 
                className="action-btn" 
                onClick={handleViewRiskReport}
              >
                View Risk Report
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RentCollectionAnalysis;