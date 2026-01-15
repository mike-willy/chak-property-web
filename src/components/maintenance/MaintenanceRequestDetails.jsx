// components/maintenance/MaintenanceRequestDetails.jsx
import React, { useState } from 'react';
import { X, Home, User, Calendar, MessageSquare, CheckCircle, AlertCircle } from 'lucide-react';
import '../../styles/maintenance-details.css'; 

const MaintenanceRequestDetails = ({ request, onClose, onStatusUpdate }) => {
  const [adminNotes, setAdminNotes] = useState(request.adminNotes || '');
  const [isSaving, setIsSaving] = useState(false);

  const getStatusClass = (status) => {
    switch (status) {
      case 'pending': return 'mnt-detail-status-badge mnt-detail-status-pending';
      case 'in-progress': return 'mnt-detail-status-badge mnt-detail-status-progress';
      case 'completed': return 'mnt-detail-status-badge mnt-detail-status-completed';
      default: return 'mnt-detail-status-badge';
    }
  };

  const getPriorityClass = (priority) => {
    const prio = priority || 'medium';
    switch (prio) {
      case 'emergency': return 'mnt-detail-priority-badge mnt-detail-priority-emergency';
      case 'high': return 'mnt-detail-priority-badge mnt-detail-priority-high';
      case 'medium': return 'mnt-detail-priority-badge mnt-detail-priority-medium';
      case 'low': return 'mnt-detail-priority-badge mnt-detail-priority-low';
      default: return 'mnt-detail-priority-badge mnt-detail-priority-medium';
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '—';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handleSaveNotes = async () => {
    if (!adminNotes.trim()) return;
    
    setIsSaving(true);
    try {
      console.log('Saving notes:', adminNotes);
      // In real app: await maintenanceService.admin.updateRequest(request.id, { adminNotes });
      alert('Notes saved successfully!');
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mnt-detail-overlay">
      <div className="mnt-detail-container">
        {/* Header */}
        <div className="mnt-detail-header">
          <div className="mnt-detail-header-top">
            <div>
              <h2 className="mnt-detail-title">Maintenance Request Details</h2>
              <p className="mnt-detail-id">ID: {request.id}</p>
            </div>
            <button 
              onClick={onClose} 
              className="mnt-detail-close-btn"
              aria-label="Close"
            >
              <X style={{ width: '20px', height: '20px' }} />
            </button>
          </div>
          
          <div className="mnt-detail-badges">
            <span className={getStatusClass(request.status)}>
              {request.status.toUpperCase()}
            </span>
            <span className={getPriorityClass(request.priority)}>
              {request.priority ? request.priority.toUpperCase() : 'MEDIUM'}
            </span>
          </div>
          <h3 className="mnt-detail-category">{request.category}</h3>
        </div>

        <div className="mnt-detail-content">
          {/* Basic Info Grid */}
          <div className="mnt-detail-info-grid">
            <div>
              <div className="mnt-detail-info-item">
                <User className="mnt-detail-info-icon" style={{ width: '20px', height: '20px' }} />
                <div className="mnt-detail-info-content">
                  <h4>Tenant</h4>
                  <p className="mnt-detail-info-text">{request.tenantName || 'Unknown Tenant'}</p>
                  {request.tenantPhone && (
                    <div className="mnt-detail-info-subtext">{request.tenantPhone}</div>
                  )}
                </div>
              </div>
              
              <div className="mnt-detail-info-item">
                <Home className="mnt-detail-info-icon" style={{ width: '20px', height: '20px' }} />
                <div className="mnt-detail-info-content">
                  <h4>Property & Unit</h4>
                  <p className="mnt-detail-info-text">{request.propertyName || 'Unknown Property'}</p>
                  <div className="mnt-detail-info-subtext">
                    Unit {request.unitNumber || '—'}
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <div className="mnt-detail-info-item">
                <Calendar className="mnt-detail-info-icon" style={{ width: '20px', height: '20px' }} />
                <div className="mnt-detail-info-content">
                  <h4>Submitted</h4>
                  <p className="mnt-detail-info-text">{formatDate(request.createdAt)}</p>
                </div>
              </div>
              
              <div className="mnt-detail-info-item">
                <Calendar className="mnt-detail-info-icon" style={{ width: '20px', height: '20px' }} />
                <div className="mnt-detail-info-content">
                  <h4>Last Updated</h4>
                  <p className="mnt-detail-info-text">{formatDate(request.updatedAt)}</p>
                </div>
              </div>
              
              {request.completedAt && (
                <div className="mnt-detail-info-item">
                  <CheckCircle 
                    className="mnt-detail-info-icon" 
                    style={{ width: '20px', height: '20px', color: '#10b981' }} 
                  />
                  <div className="mnt-detail-info-content">
                    <h4>Completed On</h4>
                    <p className="mnt-detail-info-text">{formatDate(request.completedAt)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="mnt-detail-section">
            <h4 className="mnt-detail-section-title">
              <MessageSquare style={{ width: '16px', height: '16px' }} />
              Description
            </h4>
            <div className="mnt-detail-description-box">
              <p className="mnt-detail-description-text">
                {request.description || 'No description provided'}
              </p>
            </div>
          </div>

          {/* Images */}
          {request.images && request.images.length > 0 && (
            <div className="mnt-detail-section">
              <h4 className="mnt-detail-section-title">
                Attached Images ({request.images.length})
              </h4>
              <div className="mnt-detail-images-grid">
                {request.images.map((img, index) => (
                  <div key={index} className="mnt-detail-image-item">
                    <img
                      src={img}
                      alt={`Maintenance issue ${index + 1}`}
                      className="mnt-detail-image"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin Notes */}
          <div className="mnt-detail-section">
            <h4 className="mnt-detail-section-title">
              <AlertCircle style={{ width: '16px', height: '16px' }} />
              Admin Notes
            </h4>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add notes about this maintenance request..."
              className="mnt-detail-notes-textarea"
            />
            <button
              onClick={handleSaveNotes}
              disabled={isSaving || !adminNotes.trim()}
              className="mnt-detail-save-notes-btn"
            >
              {isSaving ? 'Saving...' : 'Save Notes'}
            </button>
          </div>

          {/* Status Actions */}
          <div className="mnt-detail-status-actions">
            <h4 className="mnt-detail-actions-title">Update Status</h4>
            <div className="mnt-detail-actions-buttons">
              {request.status === 'pending' && (
                <button
                  onClick={() => {
                    if (window.confirm('Start working on this request?')) {
                      onStatusUpdate(request.id, 'in-progress');
                      onClose();
                    }
                  }}
                  className="mnt-detail-action-start"
                >
                  Start Work
                </button>
              )}
              
              {request.status === 'in-progress' && (
                <button
                  onClick={() => {
                    if (window.confirm('Mark this request as completed?')) {
                      onStatusUpdate(request.id, 'completed');
                      onClose();
                    }
                  }}
                  className="mnt-detail-action-complete"
                >
                  Mark as Completed
                </button>
              )}
              
              <button
                onClick={onClose}
                className="mnt-detail-action-close"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceRequestDetails;