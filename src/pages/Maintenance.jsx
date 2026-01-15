// pages/Maintenance.jsx
import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Eye,
  RefreshCw
} from 'lucide-react';
import MaintenanceCategories from '../components/maintenance/MaintenanceCategories';
import MaintenanceRequestDetails from '../components/maintenance/MaintenanceRequestDetails';
import { maintenanceService } from '../pages/firebase/maintenanceService';
import '../styles/maintenance.css'; // Changed to unique CSS file

const Maintenance = () => {
  const [activeTab, setActiveTab] = useState('requests');
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [stats, setStats] = useState({ pending: 0, inProgress: 0, completed: 0, total: 0 });
  const [filter, setFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRequests();
    loadStats();
    
    const unsubscribe = maintenanceService.admin.subscribe((updatedRequests) => {
      setRequests(updatedRequests);
      calculateStats(updatedRequests);
    });
    
    return () => unsubscribe();
  }, []);

  const loadRequests = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await maintenanceService.admin.getAllRequests();
      setRequests(data);
      calculateStats(data);
    } catch (err) {
      setError(err.message || 'Failed to load requests');
      console.error('Error loading requests:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await maintenanceService.admin.getStats();
      setStats(statsData);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const calculateStats = (requests) => {
    const pending = requests.filter(r => r.status === 'pending').length;
    const inProgress = requests.filter(r => r.status === 'in-progress').length;
    const completed = requests.filter(r => r.status === 'completed').length;
    setStats({ pending, inProgress, completed, total: requests.length });
  };

  const handleStatusUpdate = async (requestId, newStatus) => {
    try {
      await maintenanceService.admin.updateRequest(requestId, { status: newStatus });
    } catch (err) {
      alert('Failed to update status: ' + err.message);
      console.error('Error updating status:', err);
    }
  };

  const filteredRequests = requests.filter(request => {
    if (filter === 'pending') return request.status === 'pending';
    if (filter === 'in-progress') return request.status === 'in-progress';
    if (filter === 'completed') return request.status === 'completed';
    return true;
  });

  const getStatusClass = (status) => {
    switch (status) {
      case 'pending': return 'mnt-status-badge mnt-status-pending';
      case 'in-progress': return 'mnt-status-badge mnt-status-progress';
      case 'completed': return 'mnt-status-badge mnt-status-completed';
      default: return 'mnt-status-badge';
    }
  };

  const getFilterButtonClass = (filterType) => {
    let baseClass = 'mnt-filter-button';
    if (filter === filterType) {
      baseClass += ' active';
      if (filterType === 'all') baseClass += ' mnt-filter-button-active-all';
      else if (filterType === 'pending') baseClass += ' mnt-filter-button-active-pending';
      else if (filterType === 'in-progress') baseClass += ' mnt-filter-button-active-progress';
      else if (filterType === 'completed') baseClass += ' mnt-filter-button-active-completed';
    }
    return baseClass;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '—';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  return (
    <div className="mnt-container">
      {/* Header */}
      <div className="mnt-header">
        <div>
          <h1 className="mnt-title">Maintenance</h1>
          <p className="mnt-subtitle">Manage maintenance requests from tenants</p>
        </div>
        
        {/* Tabs */}
        <div className="mnt-tabs">
          <button
            onClick={() => setActiveTab('requests')}
            className={`mnt-tab-button ${activeTab === 'requests' ? 'active' : ''}`}
          >
            <Wrench style={{ width: '16px', height: '16px' }} />
            Requests {stats.total > 0 && <span style={{ fontSize: '12px' }}>({stats.total})</span>}
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`mnt-tab-button ${activeTab === 'categories' ? 'active' : ''}`}
          >
            Categories
          </button>
        </div>
      </div>

      {activeTab === 'requests' ? (
        <>
          {/* Stats Cards */}
          <div className="mnt-stats-grid">
            <div className="mnt-stat-card">
              <div className="mnt-stat-content">
                <div className="mnt-stat-text">
                  <h3>Pending</h3>
                  <p className="mnt-stat-number">{stats.pending}</p>
                  <p className="mnt-stat-desc">Awaiting action</p>
                </div>
                <div className="mnt-stat-icon mnt-stat-icon-pending">
                  <Clock style={{ width: '24px', height: '24px' }} />
                </div>
              </div>
            </div>

            <div className="mnt-stat-card">
              <div className="mnt-stat-content">
                <div className="mnt-stat-text">
                  <h3>In Progress</h3>
                  <p className="mnt-stat-number">{stats.inProgress}</p>
                  <p className="mnt-stat-desc">Being fixed</p>
                </div>
                <div className="mnt-stat-icon mnt-stat-icon-progress">
                  <Wrench style={{ width: '24px', height: '24px' }} />
                </div>
              </div>
            </div>

            <div className="mnt-stat-card">
              <div className="mnt-stat-content">
                <div className="mnt-stat-text">
                  <h3>Completed</h3>
                  <p className="mnt-stat-number">{stats.completed}</p>
                  <p className="mnt-stat-desc">Resolved</p>
                </div>
                <div className="mnt-stat-icon mnt-stat-icon-completed">
                  <CheckCircle style={{ width: '24px', height: '24px' }} />
                </div>
              </div>
            </div>

            <div className="mnt-stat-card">
              <div className="mnt-stat-content">
                <div className="mnt-stat-text">
                  <h3>Total</h3>
                  <p className="mnt-stat-number">{stats.total}</p>
                  <p className="mnt-stat-desc">All requests</p>
                </div>
                <div className="mnt-stat-icon mnt-stat-icon-total">
                  <AlertCircle style={{ width: '24px', height: '24px' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mnt-error">
              <span>{error}</span>
              <button onClick={loadRequests} className="mnt-refresh-btn">
                <RefreshCw style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          )}

          {/* Filters */}
          <div className="mnt-filters-container">
            <div className="mnt-filters-content">
              <div className="mnt-filter-buttons">
                <button
                  onClick={() => setFilter('all')}
                  className={getFilterButtonClass('all')}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('pending')}
                  className={getFilterButtonClass('pending')}
                >
                  <Clock style={{ width: '12px', height: '12px' }} />
                  Pending ({stats.pending})
                </button>
                <button
                  onClick={() => setFilter('in-progress')}
                  className={getFilterButtonClass('in-progress')}
                >
                  <Wrench style={{ width: '12px', height: '12px' }} />
                  In Progress ({stats.inProgress})
                </button>
                <button
                  onClick={() => setFilter('completed')}
                  className={getFilterButtonClass('completed')}
                >
                  <CheckCircle style={{ width: '12px', height: '12px' }} />
                  Completed ({stats.completed})
                </button>
              </div>
              
              <div>
                <button
                  onClick={loadRequests}
                  className="mnt-filter-button"
                  title="Refresh"
                >
                  <RefreshCw style={{ width: '12px', height: '12px' }} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Requests List */}
          <div className="mnt-requests-table">
            {isLoading ? (
              <div className="mnt-loading-state">
                <RefreshCw className="mnt-spinner" style={{ width: '32px', height: '32px' }} />
                <p>Loading maintenance requests...</p>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="mnt-empty-state">
                <AlertCircle className="mnt-empty-icon" style={{ width: '48px', height: '48px' }} />
                <p className="mnt-empty-title">No maintenance requests found</p>
                <p className="mnt-empty-text">
                  {filter === 'all' 
                    ? 'When tenants submit requests, they will appear here' 
                    : `No ${filter} maintenance requests`}
                </p>
              </div>
            ) : (
              <div className="mnt-table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Request Details</th>
                      <th>Property/Unit</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((request) => (
                      <tr key={request.id}>
                        <td>
                          <div className="mnt-request-details">
                            <div className="mnt-request-icon">
                              {request.status === 'pending' && <Clock style={{ width: '16px', height: '16px', color: '#92400e' }} />}
                              {request.status === 'in-progress' && <Wrench style={{ width: '16px', height: '16px', color: '#1e40af' }} />}
                              {request.status === 'completed' && <CheckCircle style={{ width: '16px', height: '16px', color: '#065f46' }} />}
                            </div>
                            <div className="mnt-request-info">
                              <h4>{request.category}</h4>
                              <div className="mnt-request-tenant">{request.tenantName || 'Unknown Tenant'}</div>
                              {request.description && (
                                <div className="mnt-request-desc">{request.description}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="mnt-property-info">
                            <h4>{request.propertyName || 'Unknown Property'}</h4>
                            <div className="mnt-unit-number">Unit {request.unitNumber || '—'}</div>
                          </div>
                        </td>
                        <td>
                          <span className={getStatusClass(request.status)}>
                            {request.status}
                          </span>
                        </td>
                        <td className="mnt-date-col">
                          {formatDate(request.createdAt)}
                        </td>
                        <td>
                          <div className="mnt-action-buttons">
                            <button
                              onClick={() => setSelectedRequest(request)}
                              className="mnt-action-button mnt-action-view"
                            >
                              <Eye style={{ width: '16px', height: '16px' }} />
                              View
                            </button>
                            
                            {request.status === 'pending' && (
                              <button
                                onClick={() => handleStatusUpdate(request.id, 'in-progress')}
                                className="mnt-action-button mnt-action-start"
                              >
                                Start Work
                              </button>
                            )}
                            
                            {request.status === 'in-progress' && (
                              <button
                                onClick={() => handleStatusUpdate(request.id, 'completed')}
                                className="mnt-action-button mnt-action-complete"
                              >
                                Complete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <MaintenanceCategories />
      )}

      {/* Request Details Modal */}
      {selectedRequest && (
        <MaintenanceRequestDetails
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onStatusUpdate={handleStatusUpdate}
        />
      )}
    </div>
  );
};

export default Maintenance;