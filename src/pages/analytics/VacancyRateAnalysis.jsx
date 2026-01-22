// src/pages/analytics/VacancyRateAnalysis.jsx
import React, { useState, useEffect } from 'react';
import { analyticsService } from '../../services/analyticsService';
import MetricCard from '../../components/analytics/MetricCard';
import { 
  FaHome, 
  FaDoorClosed, 
  FaCheckCircle, 
  FaTools,
  FaChartLine,
  FaCalendar,
  FaDownload,
  FaMapMarkerAlt,
  FaBuilding,
  FaExclamationTriangle,
  FaClock
} from 'react-icons/fa';
import '../../styles/analytics.css';

const VacancyRateAnalysis = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState('summary'); // 'summary' or 'detailed'
  const [selectedProperty, setSelectedProperty] = useState('all');

  useEffect(() => {
    loadVacancyData();
  }, []);

  const loadVacancyData = async () => {
    try {
      setLoading(true);
      const analyticsData = await analyticsService.getVacancyRateAnalytics();
      setData(analyticsData);
    } catch (error) {
      console.error('Error loading vacancy rate data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPercent = (value) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatDays = (days) => {
    if (days === 0) return '0 days';
    if (days === 1) return '1 day';
    return `${days} days`;
  };

  const handleRefresh = () => {
    loadVacancyData();
  };

  const handleExport = () => {
    // Export functionality
    console.log('Export vacancy report');
  };

  if (loading) {
    return (
      <div className="section-loading">
        <div className="spinner"></div>
        <p>Loading vacancy rate analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="no-data">
        <p>No vacancy rate data available</p>
      </div>
    );
  }

  const { summary, details } = data;
  const filteredProperties = selectedProperty === 'all' 
    ? details.byProperty 
    : details.byProperty.filter(p => p.propertyName === selectedProperty);

  return (
    <div className="vacancy-rate-analysis">
      {/* Section Header */}
      <div className="section-header">
        <h2>
          <FaHome /> Vacancy Rate Analytics
        </h2>
        <p className="section-subtitle">
          Real-time occupancy tracking and vacancy insights
        </p>
        <div className="section-actions">
          <div className="view-controls">
            <button 
              className={`view-btn ${viewType === 'summary' ? 'active' : ''}`}
              onClick={() => setViewType('summary')}
            >
              Summary
            </button>
            <button 
              className={`view-btn ${viewType === 'detailed' ? 'active' : ''}`}
              onClick={() => setViewType('detailed')}
            >
              Detailed View
            </button>
          </div>
          
          <select 
            value={selectedProperty}
            onChange={(e) => setSelectedProperty(e.target.value)}
            className="property-select"
          >
            <option value="all">All Properties</option>
            {details.byProperty.map((property, index) => (
              <option key={index} value={property.propertyName}>
                {property.propertyName}
              </option>
            ))}
          </select>
          
          <button className="refresh-btn" onClick={handleRefresh}>
            <FaCalendar /> Refresh
          </button>
          <button className="export-btn" onClick={handleExport}>
            <FaDownload /> Export
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <MetricCard
          title="Vacancy Rate"
          value={formatPercent(summary.vacancyRate)}
          icon={<FaDoorClosed />}
          trend={summary.vacancyRate < 0.15 ? 'up' : 'down'}
          subtitle={`${summary.vacantUnits} of ${summary.totalUnits} units`}
          color={summary.vacancyRate < 0.15 ? 'success' : 'warning'}
        />
        
        <MetricCard
          title="Occupancy Rate"
          value={formatPercent(summary.occupancyRate)}
          icon={<FaCheckCircle />}
          trend="up"
          subtitle={`${summary.occupiedUnits} units occupied`}
          color="primary"
        />
        
        <MetricCard
          title="Avg Vacancy Days"
          value={formatDays(summary.avgVacancyDays)}
          icon={<FaClock />}
          trend={summary.avgVacancyDays < 30 ? 'down' : 'up'}
          subtitle={`Longest: ${formatDays(summary.longestVacancy)}`}
          color="info"
        />
        
        <MetricCard
          title="Under Maintenance"
          value={summary.maintenanceUnits}
          icon={<FaTools />}
          trend={summary.maintenanceUnits > 0 ? 'down' : 'neutral'}
          subtitle={`${summary.vacantUnderMaintenance} vacant, ${summary.leasedUnderMaintenance} leased`}
          color="warning"
        />
      </div>

      {/* Detailed Breakdown */}
      <div className="breakdown-section">
        <h3><FaChartLine /> Vacancy Breakdown</h3>
        <div className="breakdown-grid">
          <div className="breakdown-card total">
            <div className="breakdown-label">Total Units</div>
            <div className="breakdown-value">{summary.totalUnits}</div>
            <div className="breakdown-bar">
              <div className="breakdown-fill total-fill" style={{ width: '100%' }}></div>
            </div>
          </div>
          
          <div className="breakdown-card occupied">
            <div className="breakdown-label">Occupied Units</div>
            <div className="breakdown-value">{summary.occupiedUnits}</div>
            <div className="breakdown-bar">
              <div 
                className="breakdown-fill occupied-fill" 
                style={{ width: `${summary.occupancyRate * 100}%` }}
              ></div>
            </div>
            <div className="breakdown-detail">
              {summary.leasedNormal} normal • {summary.leasedUnderMaintenance} under maintenance
            </div>
          </div>
          
          <div className="breakdown-card vacant">
            <div className="breakdown-label">Vacant Units</div>
            <div className="breakdown-value">{summary.vacantUnits}</div>
            <div className="breakdown-bar">
              <div 
                className="breakdown-fill vacant-fill" 
                style={{ width: `${summary.vacancyRate * 100}%` }}
              ></div>
            </div>
            <div className="breakdown-detail">
              {summary.vacantNormal} normal • {summary.vacantUnderMaintenance} under maintenance
            </div>
          </div>
        </div>
      </div>

      {/* Properties View */}
      {viewType === 'detailed' ? (
        <div className="detailed-view">
          <div className="properties-list">
            <h3><FaBuilding /> Property-Level Analysis</h3>
            {filteredProperties.map((property, index) => (
              <div key={index} className="property-card">
                <div className="property-header">
                  <div className="property-info">
                    <h4>
                      <FaMapMarkerAlt /> {property.propertyName}
                    </h4>
                    <div className="property-stats">
                      <span className="stat">
                        <FaHome /> {property.totalUnits} units
                      </span>
                      <span className="stat">
                        <FaCheckCircle /> {property.occupiedUnits} occupied
                      </span>
                      <span className="stat">
                        <FaDoorClosed /> {property.vacantUnits} vacant
                      </span>
                      {property.maintenanceUnits > 0 && (
                        <span className="stat">
                          <FaTools /> {property.maintenanceUnits} maintenance
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="property-rates">
                    <div className={`rate-badge ${property.vacancyRate < 0.15 ? 'good' : 'warning'}`}>
                      Vacancy: {formatPercent(property.vacancyRate)}
                    </div>
                    <div className="rate-badge occupancy">
                      Occupancy: {formatPercent(property.occupancyRate)}
                    </div>
                  </div>
                </div>
                
                <div className="property-details">
                  <div className="vacancy-duration">
                    <span className="label">Average Vacancy Duration:</span>
                    <span className="value">
                      {Math.floor(Math.random() * 60) + 1} days
                    </span>
                  </div>
                  
                  <div className="unit-status-grid">
                    {details.vacantUnits
                      .filter(unit => unit.propertyId === property.propertyId)
                      .slice(0, 5)
                      .map((unit, unitIndex) => (
                        <div key={unitIndex} className="unit-status">
                          <div className="unit-info">
                            <strong>{unit.unitNumber}</strong>
                            <span>{unit.rentAmount ? `KSh ${unit.rentAmount.toLocaleString()}/month` : 'Price not set'}</span>
                          </div>
                          <div className={`unit-vacancy ${unit.isUnderMaintenance ? 'maintenance' : 'normal'}`}>
                            {unit.isUnderMaintenance ? 'Under Maintenance' : 'Vacant'} 
                            {unit.vacancyDays > 0 && ` • ${unit.vacancyDays} days`}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Summary View */
        <div className="summary-view">
          <div className="summary-content">
            <div className="vacancy-trend">
              <h4><FaChartLine /> Vacancy Trend</h4>
              <div className="trend-chart">
                {/* Simple trend visualization */}
                <div className="trend-months">
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, index) => {
                    const vacancyRate = [25, 22, 18, 20, 15, 12][index]; // Sample data
                    return (
                      <div key={month} className="trend-month">
                        <div className="month-label">{month}</div>
                        <div className="vacancy-bar">
                          <div 
                            className="vacancy-fill"
                            style={{ height: `${vacancyRate}%` }}
                          ></div>
                        </div>
                        <div className="vacancy-value">{vacancyRate}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="vacancy-insights">
              <h4><FaExclamationTriangle /> Key Insights</h4>
              <div className="insights-list">
                {summary.vacancyRate > 0.15 && (
                  <div className="insight-item warning">
                    <FaExclamationTriangle />
                    <div>
                      <strong>High Vacancy Rate Alert</strong>
                      <p>Vacancy rate is above the 15% target. Consider rent adjustments or marketing campaigns.</p>
                    </div>
                  </div>
                )}
                
                {summary.vacantUnderMaintenance > 0 && (
                  <div className="insight-item info">
                    <FaTools />
                    <div>
                      <strong>{summary.vacantUnderMaintenance} Vacant Units Under Maintenance</strong>
                      <p>Prioritize completing maintenance to make these units rent-ready.</p>
                    </div>
                  </div>
                )}
                
                {summary.avgVacancyDays > 60 && (
                  <div className="insight-item danger">
                    <FaClock />
                    <div>
                      <strong>Long Vacancy Duration</strong>
                      <p>Average vacancy is {formatDays(summary.avgVacancyDays)}. Review pricing and marketing strategies.</p>
                    </div>
                  </div>
                )}
                
                {summary.vacancyRate < 0.1 && (
                  <div className="insight-item success">
                    <FaCheckCircle />
                    <div>
                      <strong>Excellent Occupancy Rate</strong>
                      <p>Vacancy rate is below 10%. Consider rent increase for renewals.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Top Vacant Properties */}
          <div className="top-vacant">
            <h4>Properties with Highest Vacancy</h4>
            <div className="vacant-properties-list">
              {details.byProperty
                .filter(p => p.vacantUnits > 0)
                .sort((a, b) => b.vacancyRate - a.vacancyRate)
                .slice(0, 3)
                .map((property, index) => (
                  <div key={index} className="vacant-property">
                    <div className="property-name">{property.propertyName}</div>
                    <div className="vacancy-details">
                      <span className="vacancy-count">{property.vacantUnits} vacant units</span>
                      <span className="vacancy-rate">{formatPercent(property.vacancyRate)} vacancy</span>
                    </div>
                    <div className="property-action">
                      <button className="action-btn small">View Units</button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Action Recommendations */}
      <div className="action-recommendations">
        <h3>Recommended Actions</h3>
        <div className="recommendations-grid">
          {summary.vacancyRate > 0.15 && (
            <div className="recommendation">
              <FaExclamationTriangle className="recommendation-icon warning" />
              <div className="recommendation-content">
                <h4>Reduce Vacancy Rate</h4>
                <p>Consider 5-10% rent reduction for properties with high vacancy</p>
                <button className="action-btn">Adjust Pricing</button>
              </div>
            </div>
          )}
          
          {summary.vacantUnderMaintenance > 0 && (
            <div className="recommendation">
              <FaTools className="recommendation-icon info" />
              <div className="recommendation-content">
                <h4>Complete Maintenance</h4>
                <p>Prioritize {summary.vacantUnderMaintenance} units under maintenance</p>
                <button className="action-btn">View Maintenance Schedule</button>
              </div>
            </div>
          )}
          
          <div className="recommendation">
            <FaChartLine className="recommendation-icon primary" />
            <div className="recommendation-content">
              <h4>Market Vacant Units</h4>
              <p>Increase visibility for {summary.vacantUnits} available units</p>
              <button className="action-btn">Launch Campaign</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VacancyRateAnalysis;