// src/pages/analytics/AnalyticsInsights.jsx
import React, { useState, useEffect } from 'react';
import { analyticsService } from '../../services/analyticsService';
import { 
  FaLightbulb, 
  FaExclamationTriangle, 
  FaCheckCircle, 
  FaClock,
  FaChartLine,
  FaDownload,
  FaCalendar,
  FaFilter,
  FaEye,
  FaEyeSlash,
  FaThumbsUp,
  FaThumbsDown
} from 'react-icons/fa';
import '../../styles/analytics.css';

const AnalyticsInsights = () => {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [acknowledgedInsights, setAcknowledgedInsights] = useState([]);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    try {
      setLoading(true);
      const insightsData = await analyticsService.generateAnalyticsInsights();
      setInsights(insightsData);
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = (insightId) => {
    setAcknowledgedInsights(prev => [...prev, insightId]);
  };

  const handleDismiss = (insightId) => {
    setInsights(prev => prev.filter(insight => insight.id !== insightId));
  };

  const handleRefresh = () => {
    loadInsights();
  };

  const getPriorityIcon = (priority) => {
    switch(priority) {
      case 'high': return <FaExclamationTriangle className="priority-icon high" />;
      case 'medium': return <FaClock className="priority-icon medium" />;
      case 'low': return <FaCheckCircle className="priority-icon low" />;
      default: return <FaLightbulb className="priority-icon" />;
    }
  };

  const getTypeIcon = (type) => {
    switch(type) {
      case 'warning': return <FaExclamationTriangle className="type-icon warning" />;
      case 'alert': return <FaExclamationTriangle className="type-icon alert" />;
      case 'positive': return <FaCheckCircle className="type-icon positive" />;
      case 'maintenance': return <FaClock className="type-icon maintenance" />;
      default: return <FaLightbulb className="type-icon" />;
    }
  };

  const filteredInsights = insights.filter(insight => {
    if (filter === 'all') return true;
    if (filter === 'unacknowledged') return !acknowledgedInsights.includes(insight.id);
    return insight.priority === filter || insight.type === filter;
  });

  if (loading) {
    return (
      <div className="section-loading">
        <div className="spinner"></div>
        <p>Generating insights and recommendations...</p>
      </div>
    );
  }

  return (
    <div className="analytics-insights">
      {/* Header */}
      <div className="section-header">
        <h2>
          <FaLightbulb /> Insights & Recommendations
        </h2>
        <p className="section-subtitle">
          Rule-based intelligence for better decision making
        </p>
        <div className="section-actions">
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Insights</option>
            <option value="unacknowledged">Unacknowledged Only</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
            <option value="warning">Warnings</option>
            <option value="positive">Positive</option>
          </select>
          
          <button className="refresh-btn" onClick={handleRefresh}>
            <FaCalendar /> Regenerate
          </button>
          <button className="export-btn">
            <FaDownload /> Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="insights-stats">
        <div className="stat-card total">
          <div className="stat-value">{insights.length}</div>
          <div className="stat-label">Total Insights</div>
        </div>
        
        <div className="stat-card high">
          <div className="stat-value">
            {insights.filter(i => i.priority === 'high').length}
          </div>
          <div className="stat-label">High Priority</div>
        </div>
        
        <div className="stat-card medium">
          <div className="stat-value">
            {insights.filter(i => i.priority === 'medium').length}
          </div>
          <div className="stat-label">Medium Priority</div>
        </div>
        
        <div className="stat-card acknowledged">
          <div className="stat-value">{acknowledgedInsights.length}</div>
          <div className="stat-label">Acknowledged</div>
        </div>
      </div>

      {/* Insights Grid */}
      <div className="insights-grid">
        {filteredInsights.length === 0 ? (
          <div className="no-insights">
            <FaCheckCircle />
            <h3>All Clear!</h3>
            <p>No issues detected. All systems are performing optimally.</p>
          </div>
        ) : (
          filteredInsights.map((insight, index) => {
            const isAcknowledged = acknowledgedInsights.includes(insight.id);
            
            return (
              <div 
                key={insight.id || index} 
                className={`insight-card priority-${insight.priority} ${isAcknowledged ? 'acknowledged' : ''}`}
              >
                <div className="insight-header">
                  <div className="insight-type">
                    {getTypeIcon(insight.type)}
                    <span className="type-label">{insight.type}</span>
                  </div>
                  <div className="insight-priority">
                    {getPriorityIcon(insight.priority)}
                    <span className="priority-label">{insight.priority} priority</span>
                  </div>
                </div>
                
                <div className="insight-content">
                  <h3>{insight.title}</h3>
                  <p className="insight-description">{insight.description}</p>
                  
                  <div className="insight-recommendation">
                    <FaChartLine className="recommendation-icon" />
                    <div>
                      <strong>Recommendation:</strong>
                      <p>{insight.recommendation || insight.action}</p>
                    </div>
                  </div>
                  
                  {insight.data && Object.keys(insight.data).length > 0 && (
                    <div className="insight-data">
                      <strong>Supporting Data:</strong>
                      <div className="data-grid">
                        {Object.entries(insight.data).map(([key, value], idx) => {
                          let displayValue = value;
                          if (typeof value === 'number') {
                            if (key.includes('Rate') || key.includes('rate')) {
                              displayValue = `${(value * 100).toFixed(1)}%`;
                            } else if (key.includes('Amount') || key.includes('amount')) {
                              displayValue = `KSh ${value.toLocaleString()}`;
                            }
                          }
                          
                          return (
                            <div key={idx} className="data-item">
                              <span className="data-key">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                              <span className="data-value">{displayValue}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {insight.tenants && insight.tenants.length > 0 && (
                    <div className="affected-tenants">
                      <strong>Affected Tenants:</strong>
                      <div className="tenants-list">
                        {insight.tenants.slice(0, 3).map((tenant, idx) => (
                          <span key={idx} className="tenant-tag">{tenant}</span>
                        ))}
                        {insight.tenants.length > 3 && (
                          <span className="more-tag">+{insight.tenants.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="insight-actions">
                  <div className="action-buttons">
                    {!isAcknowledged ? (
                      <button 
                        className="action-btn acknowledge"
                        onClick={() => handleAcknowledge(insight.id)}
                      >
                        <FaThumbsUp /> Acknowledge
                      </button>
                    ) : (
                      <span className="acknowledged-badge">
                        <FaCheckCircle /> Acknowledged
                      </span>
                    )}
                    
                    <button 
                      className="action-btn dismiss"
                      onClick={() => handleDismiss(insight.id)}
                    >
                      <FaThumbsDown /> Dismiss
                    </button>
                    
                    <button className="action-btn view">
                      <FaEye /> View Details
                    </button>
                  </div>
                  
                  <div className="insight-timestamp">
                    Generated just now
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Rule-Based Intelligence */}
      <div className="rules-section">
        <h3><FaChartLine /> Rule-Based Intelligence System</h3>
        <div className="rules-info">
          <p>
            Insights are generated automatically based on predefined rules and thresholds. 
            The system monitors your data in real-time and alerts you when attention is needed.
          </p>
          
          <div className="rules-grid">
            <div className="rule-card">
              <div className="rule-icon warning">
                <FaExclamationTriangle />
              </div>
              <h4>Collection Rate Alert</h4>
              <p>Triggers when rent collection rate drops below 85%</p>
              <div className="rule-threshold">
                <strong>Threshold:</strong> 85%
              </div>
            </div>
            
            <div className="rule-card">
              <div className="rule-icon danger">
                <FaExclamationTriangle />
              </div>
              <h4>High Vacancy Alert</h4>
              <p>Triggers when vacancy rate exceeds 15%</p>
              <div className="rule-threshold">
                <strong>Threshold:</strong> 15%
              </div>
            </div>
            
            <div className="rule-card">
              <div className="rule-icon warning">
                <FaExclamationTriangle />
              </div>
              <h4>Tenant Risk Alert</h4>
              <p>Triggers when tenant risk score exceeds 70</p>
              <div className="rule-threshold">
                <strong>Threshold:</strong> 70/100
              </div>
            </div>
            
            <div className="rule-card">
              <div className="rule-icon info">
                <FaClock />
              </div>
              <h4>Maintenance Alert</h4>
              <p>Triggers when units are under maintenance</p>
              <div className="rule-threshold">
                <strong>Action:</strong> Review status
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Plan */}
      <div className="action-plan">
        <h3><FaChartLine /> Recommended Action Plan</h3>
        <div className="plan-steps">
          {filteredInsights
            .filter(i => i.priority === 'high' && !acknowledgedInsights.includes(i.id))
            .slice(0, 3)
            .map((insight, index) => (
              <div key={index} className="plan-step">
                <div className="step-number">{index + 1}</div>
                <div className="step-content">
                  <h4>{insight.title}</h4>
                  <p>{insight.recommendation || insight.action}</p>
                  <div className="step-actions">
                    <button className="action-btn primary">Take Action</button>
                    <button className="action-btn">Schedule for Later</button>
                  </div>
                </div>
              </div>
            ))}
          
          {filteredInsights.filter(i => i.priority === 'high' && !acknowledgedInsights.includes(i.id)).length === 0 && (
            <div className="no-critical-actions">
              <FaCheckCircle />
              <p>No critical actions required at this time.</p>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="insights-summary">
        <h3>Summary</h3>
        <div className="summary-content">
          <div className="summary-item">
            <strong>System Status:</strong>
            <span className={`status-badge ${insights.length === 0 ? 'success' : 'warning'}`}>
              {insights.length === 0 ? 'Optimal' : 'Attention Needed'}
            </span>
          </div>
          
          <div className="summary-item">
            <strong>Critical Issues:</strong>
            <span>{insights.filter(i => i.priority === 'high').length}</span>
          </div>
          
          <div className="summary-item">
            <strong>Recommendations:</strong>
            <span>{insights.length}</span>
          </div>
          
          <div className="summary-item">
            <strong>Last Updated:</strong>
            <span>Just now</span>
          </div>
        </div>
        
        <div className="summary-actions">
          <button className="action-btn primary" onClick={handleRefresh}>
            <FaCalendar /> Update Insights
          </button>
          <button className="action-btn">
            <FaDownload /> Download Report
          </button>
          <button className="action-btn">
            <FaEye /> View Analytics Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsInsights;