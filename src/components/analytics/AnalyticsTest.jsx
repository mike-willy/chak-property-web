// src/components/analytics/AnalyticsTest.jsx
import React, { useState, useEffect } from 'react';
import { analyticsService } from '../../services/analyticsService';
import "../../styles/AnalyticsTest.css"; // Optional styling

const AnalyticsTest = () => {
  const [loading, setLoading] = useState({
    rent: false,
    vacancy: false,
    tenant: false,
    insights: false
  });
  
  const [results, setResults] = useState({
    rent: null,
    vacancy: null,
    tenant: null,
    insights: []
  });
  
  const [error, setError] = useState(null);

  // Test Rent Collection Analytics
  const testRentCollection = async () => {
    setLoading(prev => ({ ...prev, rent: true }));
    setError(null);
    
    try {
      const data = await analyticsService.getRentCollectionAnalytics('monthly');
      setResults(prev => ({ ...prev, rent: data }));
      console.log('Rent Collection Data:', data);
    } catch (err) {
      setError(`Rent Collection Error: ${err.message}`);
      console.error('Rent Collection Error:', err);
    } finally {
      setLoading(prev => ({ ...prev, rent: false }));
    }
  };

  // Test Vacancy Rate Analytics
  const testVacancyRates = async () => {
    setLoading(prev => ({ ...prev, vacancy: true }));
    setError(null);
    
    try {
      const data = await analyticsService.getVacancyRateAnalytics();
      setResults(prev => ({ ...prev, vacancy: data }));
      console.log('Vacancy Rate Data:', data);
    } catch (err) {
      setError(`Vacancy Rate Error: ${err.message}`);
      console.error('Vacancy Rate Error:', err);
    } finally {
      setLoading(prev => ({ ...prev, vacancy: false }));
    }
  };

  // Test Tenant Behavior Analytics
  const testTenantBehavior = async () => {
    setLoading(prev => ({ ...prev, tenant: true }));
    setError(null);
    
    try {
      const data = await analyticsService.getTenantBehaviorAnalytics();
      setResults(prev => ({ ...prev, tenant: data }));
      console.log('Tenant Behavior Data:', data);
    } catch (err) {
      setError(`Tenant Behavior Error: ${err.message}`);
      console.error('Tenant Behavior Error:', err);
    } finally {
      setLoading(prev => ({ ...prev, tenant: false }));
    }
  };

  // Test Insights Generation
  const testInsights = async () => {
    setLoading(prev => ({ ...prev, insights: true }));
    setError(null);
    
    try {
      const data = await analyticsService.generateAnalyticsInsights();
      setResults(prev => ({ ...prev, insights: data }));
      console.log('Generated Insights:', data);
    } catch (err) {
      setError(`Insights Error: ${err.message}`);
      console.error('Insights Error:', err);
    } finally {
      setLoading(prev => ({ ...prev, insights: false }));
    }
  };

  // Test All Services at Once
  const testAll = async () => {
    setError(null);
    await Promise.all([
      testRentCollection(),
      testVacancyRates(),
      testTenantBehavior(),
      testInsights()
    ]);
  };

  // Clear all results
  const clearResults = () => {
    setResults({
      rent: null,
      vacancy: null,
      tenant: null,
      insights: []
    });
    setError(null);
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount || 0);
  };

  // Format percentage
  const formatPercent = (value) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <div className="analytics-test-container">
      <h2>Analytics Service Test</h2>
      <p className="test-description">
        This component tests the analytics service layer. Click buttons to fetch and display data.
      </p>
      
      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      <div className="test-controls">
        <div className="button-group">
          <button 
            onClick={testRentCollection} 
            disabled={loading.rent}
            className="test-button rent-button"
          >
            {loading.rent ? 'Loading...' : 'Test Rent Collection'}
          </button>
          
          <button 
            onClick={testVacancyRates} 
            disabled={loading.vacancy}
            className="test-button vacancy-button"
          >
            {loading.vacancy ? 'Loading...' : 'Test Vacancy Rates'}
          </button>
          
          <button 
            onClick={testTenantBehavior} 
            disabled={loading.tenant}
            className="test-button tenant-button"
          >
            {loading.tenant ? 'Loading...' : 'Test Tenant Behavior'}
          </button>
          
          <button 
            onClick={testInsights} 
            disabled={loading.insights}
            className="test-button insights-button"
          >
            {loading.insights ? 'Loading...' : 'Test Insights'}
          </button>
          
          <button 
            onClick={testAll} 
            disabled={loading.rent || loading.vacancy || loading.tenant || loading.insights}
            className="test-button all-button"
          >
            Test All Services
          </button>
          
          <button 
            onClick={clearResults} 
            className="test-button clear-button"
          >
            Clear Results
          </button>
        </div>
      </div>
      
      <div className="results-section">
        {/* Rent Collection Results */}
        <div className="result-card">
          <h3>Rent Collection Analytics</h3>
          {results.rent ? (
            <div className="result-content">
              <div className="metric-grid">
                <div className="metric">
                  <label>Collection Rate</label>
                  <div className="value highlight">
                    {formatPercent(results.rent.summary.collectionRate)}
                  </div>
                </div>
                <div className="metric">
                  <label>Expected Rent</label>
                  <div className="value">
                    {formatCurrency(results.rent.summary.expectedRent)}
                  </div>
                </div>
                <div className="metric">
                  <label>Collected Rent</label>
                  <div className="value">
                    {formatCurrency(results.rent.summary.collectedRent)}
                  </div>
                </div>
                <div className="metric">
                  <label>Outstanding</label>
                  <div className="value warning">
                    {formatCurrency(results.rent.summary.outstandingAmount)}
                  </div>
                </div>
                <div className="metric">
                  <label>Late Payments</label>
                  <div className="value">
                    {results.rent.summary.latePaymentsCount}
                  </div>
                </div>
                <div className="metric">
                  <label>Timeframe</label>
                  <div className="value">
                    {results.rent.timeframe}
                  </div>
                </div>
              </div>
              <div className="raw-data">
                <details>
                  <summary>Raw Data</summary>
                  <pre>{JSON.stringify(results.rent, null, 2)}</pre>
                </details>
              </div>
            </div>
          ) : (
            <div className="no-data">No data yet. Click "Test Rent Collection" above.</div>
          )}
        </div>
        
        {/* Vacancy Rate Results */}
        <div className="result-card">
          <h3>Vacancy Rate Analytics</h3>
          {results.vacancy ? (
            <div className="result-content">
              <div className="metric-grid">
                <div className="metric">
                  <label>Vacancy Rate</label>
                  <div className="value highlight">
                    {formatPercent(results.vacancy.summary.vacancyRate)}
                  </div>
                </div>
                <div className="metric">
                  <label>Total Units</label>
                  <div className="value">
                    {results.vacancy.summary.totalUnits}
                  </div>
                </div>
                <div className="metric">
                  <label>Occupied Units</label>
                  <div className="value">
                    {results.vacancy.summary.occupiedUnits}
                  </div>
                </div>
                <div className="metric">
                  <label>Vacant Units</label>
                  <div className="value warning">
                    {results.vacancy.summary.vacantUnits}
                  </div>
                </div>
                <div className="metric">
                  <label>Avg Vacancy Days</label>
                  <div className="value">
                    {results.vacancy.summary.avgVacancyDays.toFixed(1)} days
                  </div>
                </div>
                <div className="metric">
                  <label>Longest Vacancy</label>
                  <div className="value">
                    {results.vacancy.summary.longestVacancy} days
                  </div>
                </div>
              </div>
              <div className="raw-data">
                <details>
                  <summary>Raw Data</summary>
                  <pre>{JSON.stringify(results.vacancy, null, 2)}</pre>
                </details>
              </div>
            </div>
          ) : (
            <div className="no-data">No data yet. Click "Test Vacancy Rates" above.</div>
          )}
        </div>
        
        {/* Tenant Behavior Results */}
        <div className="result-card">
          <h3>Tenant Behavior Analytics</h3>
          {results.tenant ? (
            <div className="result-content">
              <div className="metric-grid">
                <div className="metric">
                  <label>Total Tenants</label>
                  <div className="value">
                    {results.tenant.summary.totalTenants}
                  </div>
                </div>
                <div className="metric">
                  <label>Avg Risk Score</label>
                  <div className="value highlight">
                    {results.tenant.summary.averageRiskScore.toFixed(1)}/100
                  </div>
                </div>
                <div className="metric">
                  <label>On-time Payers</label>
                  <div className="value">
                    {results.tenant.summary.onTimePayments}
                  </div>
                </div>
                <div className="metric">
                  <label>Frequent Late Payers</label>
                  <div className="value warning">
                    {results.tenant.summary.frequentLatePayers}
                  </div>
                </div>
                <div className="metric">
                  <label>Low Risk</label>
                  <div className="value">
                    {results.tenant.details.riskDistribution?.low?.count || 0}
                  </div>
                </div>
                <div className="metric">
                  <label>High Risk</label>
                  <div className="value warning">
                    {results.tenant.details.riskDistribution?.high?.count || 0}
                  </div>
                </div>
              </div>
              <div className="tenant-list">
                <h4>Top 5 Tenants by Risk Score:</h4>
                <ul>
                  {results.tenant.details.tenants
                    .sort((a, b) => b.riskScore - a.riskScore)
                    .slice(0, 5)
                    .map((tenant, index) => (
                      <li key={index} className={`risk-${tenant.riskScore > 70 ? 'high' : tenant.riskScore > 30 ? 'medium' : 'low'}`}>
                        {tenant.tenantName}: <strong>{tenant.riskScore}</strong> 
                        <span className="payment-info">
                          ({tenant.payments.length} payments, {tenant.overduePayments.length} overdue)
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
              <div className="raw-data">
                <details>
                  <summary>Raw Data</summary>
                  <pre>{JSON.stringify(results.tenant, null, 2)}</pre>
                </details>
              </div>
            </div>
          ) : (
            <div className="no-data">No data yet. Click "Test Tenant Behavior" above.</div>
          )}
        </div>
        
        {/* Insights Results */}
        <div className="result-card">
          <h3>Generated Insights</h3>
          {results.insights.length > 0 ? (
            <div className="result-content">
              <div className="insights-list">
                {results.insights.map((insight, index) => (
                  <div key={index} className={`insight-item priority-${insight.priority}`}>
                    <div className="insight-header">
                      <span className={`insight-type ${insight.type}`}>{insight.type}</span>
                      <span className={`insight-priority ${insight.priority}`}>{insight.priority}</span>
                    </div>
                    <h4>{insight.title}</h4>
                    <p>{insight.description}</p>
                    <div className="insight-action">
                      <strong>Action:</strong> {insight.action || insight.recommendation}
                    </div>
                    {insight.tenants && insight.tenants.length > 0 && (
                      <div className="insight-tenants">
                        <strong>Affected Tenants:</strong> {insight.tenants.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="raw-data">
                <details>
                  <summary>Raw Insights Data</summary>
                  <pre>{JSON.stringify(results.insights, null, 2)}</pre>
                </details>
              </div>
            </div>
          ) : (
            <div className="no-data">No insights yet. Click "Test Insights" above.</div>
          )}
        </div>
      </div>
      
      <div className="instructions">
        <h4>Next Steps:</h4>
        <ol>
          <li>Click each button to test individual services</li>
          <li>Check console for detailed logs</li>
          <li>Verify data matches your expectations</li>
          <li>If errors occur, check Firestore field names match your structure</li>
          <li>Once tests pass, we can build the actual dashboard components</li>
        </ol>
      </div>
    </div>
  );
};

export default AnalyticsTest;