// components/maintenance/MaintenanceRequestDetails.jsx
import React, { useState } from 'react';
import { 
  X, Home, User, Calendar, MessageSquare, CheckCircle, 
  AlertCircle, Lock, Edit2, Save, Phone, Mail,
  Trash2, RotateCcw, Pause, Ban, History, Clock
} from 'lucide-react';
import { maintenanceService } from '../../pages/firebase/maintenanceService';
import '../../styles/maintenance-details.css'; 

const MaintenanceRequestDetails = ({ request, onClose, onStatusUpdate, onDeleteRequest }) => {
  const [adminNotes, setAdminNotes] = useState(request.adminNotes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [showEditNotes, setShowEditNotes] = useState(false);
  const [tempNotes, setTempNotes] = useState(request.adminNotes || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const getStatusClass = (status) => {
    switch (status) {
      case 'pending': return 'mnt-detail-status-badge mnt-detail-status-pending';
      case 'in-progress': return 'mnt-detail-status-badge mnt-detail-status-progress';
      case 'completed': return 'mnt-detail-status-badge mnt-detail-status-completed';
      case 'on-hold': return 'mnt-detail-status-badge mnt-detail-status-onhold';
      case 'cancelled': return 'mnt-detail-status-badge mnt-detail-status-cancelled';
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
    if (!tempNotes.trim() || tempNotes === request.adminNotes) {
      setShowEditNotes(false);
      return;
    }
    
    setIsSavingNotes(true);
    try {
      await maintenanceService.admin.updateRequest(request.id, { 
        adminNotes: tempNotes,
        updatedAt: new Date() 
      });
      
      setAdminNotes(tempNotes);
      setShowEditNotes(false);
      
      console.log('Notes saved successfully');
      
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Failed to save notes: ' + error.message);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleStartEditNotes = () => {
    setTempNotes(adminNotes);
    setShowEditNotes(true);
  };

  const handleCancelEditNotes = () => {
    setTempNotes(adminNotes);
    setShowEditNotes(false);
  };

  const handleStatusUpdateWithConfirmation = async (newStatus) => {
    let message = '';
    let confirmMessage = '';
    
    const statusMessages = {
      'pending': {
        confirm: 'Put this request back to pending?',
        success: 'Request put back to pending'
      },
      'in-progress': {
        confirm: 'Start working on this request?',
        success: 'Request marked as In Progress'
      },
      'on-hold': {
        confirm: 'Put this request on hold?',
        success: 'Request put on hold'
      },
      'completed': {
        confirm: 'Mark this request as completed?',
        success: 'Request marked as Completed'
      },
      'cancelled': {
        confirm: 'Cancel this request? This action cannot be undone.',
        success: 'Request cancelled'
      }
    };
    
    const statusInfo = statusMessages[newStatus] || { confirm: 'Update status?', success: 'Status updated' };
    
    if (window.confirm(statusInfo.confirm)) {
      try {
        await onStatusUpdate(request.id, newStatus);
        alert(statusInfo.success);
        onClose();
      } catch (error) {
        console.error('Error updating status:', error);
        alert('Failed to update status: ' + error.message);
      }
    }
  };

  const handleDeleteRequest = async () => {
    if (!window.confirm('Are you sure you want to delete this maintenance request? This action cannot be undone.')) {
      setShowDeleteConfirm(false);
      return;
    }

    setIsDeleting(true);
    try {
      await onDeleteRequest(request.id);
      alert('Maintenance request deleted successfully!');
      onClose();
    } catch (error) {
      console.error('Error deleting request:', error);
      alert('Failed to delete request: ' + error.message);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Get available status options based on current status
  const getAvailableStatusOptions = () => {
    const options = [];
    
    // Always available options
    options.push({ value: 'on-hold', label: 'Put On Hold', icon: Pause, class: 'mnt-detail-action-hold' });
    options.push({ value: 'cancelled', label: 'Cancel Request', icon: Ban, class: 'mnt-detail-action-cancel' });
    
    // Status-specific options
    switch (request.status) {
      case 'pending':
        options.unshift({ value: 'in-progress', label: 'Start Work', icon: Clock, class: 'mnt-detail-action-start' });
        break;
      case 'in-progress':
        options.unshift(
          { value: 'pending', label: 'Back to Pending', icon: RotateCcw, class: 'mnt-detail-action-reopen' },
          { value: 'completed', label: 'Mark Completed', icon: CheckCircle, class: 'mnt-detail-action-complete' }
        );
        break;
      case 'on-hold':
        options.unshift(
          { value: 'pending', label: 'Back to Pending', icon: RotateCcw, class: 'mnt-detail-action-reopen' },
          { value: 'in-progress', label: 'Resume Work', icon: Clock, class: 'mnt-detail-action-start' }
        );
        break;
      case 'completed':
        options.unshift(
          { value: 'pending', label: 'Reopen Request', icon: RotateCcw, class: 'mnt-detail-action-reopen' },
          { value: 'in-progress', label: 'Back to In Progress', icon: Clock, class: 'mnt-detail-action-start' }
        );
        break;
      case 'cancelled':
        options.unshift(
          { value: 'pending', label: 'Reopen Request', icon: RotateCcw, class: 'mnt-detail-action-reopen' }
        );
        break;
    }
    
    return options;
  };

  // Tenant Info Box - Read Only
  const TenantInfoBox = ({ label, value, icon: Icon, subValue }) => (
    <div className="mnt-detail-info-box">
      <div className="mnt-detail-info-box-header">
        <Icon className="mnt-detail-info-box-icon" style={{ width: '16px', height: '16px' }} />
        <span className="mnt-detail-info-box-label">{label}</span>
        <Lock className="mnt-detail-readonly-icon" style={{ width: '12px', height: '12px' }} 
              title="Tenant submitted - Read only" />
      </div>
      <div className="mnt-detail-info-box-value">{value || '—'}</div>
      {subValue && <div className="mnt-detail-info-box-subvalue">{subValue}</div>}
    </div>
  );

  const statusOptions = getAvailableStatusOptions();

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
            <div className="mnt-detail-header-actions">
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                className="mnt-detail-delete-btn"
                title="Delete Request"
                disabled={request.status !== 'completed' && request.status !== 'cancelled'}
              >
                <Trash2 style={{ width: '16px', height: '16px' }} />
              </button>
              <button 
                onClick={onClose} 
                className="mnt-detail-close-btn"
                aria-label="Close"
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>
          </div>
          
          <div className="mnt-detail-badges">
            <span className={getStatusClass(request.status)}>
              {request.status.replace('-', ' ').toUpperCase()}
            </span>
            <span className={getPriorityClass(request.priority)}>
              {request.priority ? request.priority.toUpperCase() : 'MEDIUM'}
            </span>
          </div>
          <h3 className="mnt-detail-category">{request.category}</h3>
          
          {/* Status Timeline */}
          <div className="mnt-detail-status-timeline">
            <div className={`mnt-detail-timeline-step ${['pending', 'in-progress', 'on-hold', 'completed'].includes(request.status) ? 'active' : ''}`}>
              <div className="mnt-detail-timeline-dot">1</div>
              <span>Submitted</span>
            </div>
            <div className={`mnt-detail-timeline-step ${['in-progress', 'on-hold', 'completed'].includes(request.status) ? 'active' : ''}`}>
              <div className="mnt-detail-timeline-dot">2</div>
              <span>In Progress</span>
            </div>
            <div className={`mnt-detail-timeline-step ${request.status === 'completed' ? 'active' : ''}`}>
              <div className="mnt-detail-timeline-dot">3</div>
              <span>Completed</span>
            </div>
          </div>
        </div>

        <div className="mnt-detail-content">
          {/* Basic Info Grid - READ ONLY */}
          <div className="mnt-detail-section">
            <h4 className="mnt-detail-section-title">
              <User style={{ width: '16px', height: '16px' }} />
              Tenant Information (Read Only)
            </h4>
            <div className="mnt-detail-readonly-notice">
              <Lock style={{ width: '14px', height: '14px' }} />
              This information was submitted by the tenant and cannot be modified
            </div>
            <div className="mnt-detail-info-grid-readonly">
              <TenantInfoBox 
                label="Tenant Name" 
                value={request.tenantName || 'Unknown Tenant'} 
                icon={User}
              />
              
              <TenantInfoBox 
                label="Property" 
                value={request.propertyName || 'Unknown Property'} 
                icon={Home}
                subValue={request.unitNumber ? `Unit ${request.unitNumber}` : '—'}
              />
              
              {request.tenantPhone && (
                <TenantInfoBox 
                  label="Phone" 
                  value={request.tenantPhone} 
                  icon={Phone}
                />
              )}
              
              {request.tenantEmail && (
                <TenantInfoBox 
                  label="Email" 
                  value={request.tenantEmail} 
                  icon={Mail}
                />
              )}
            </div>
          </div>

          {/* Request Details - READ ONLY */}
          <div className="mnt-detail-section">
            <h4 className="mnt-detail-section-title">
              <MessageSquare style={{ width: '16px', height: '16px' }} />
              Request Details (Read Only)
            </h4>
            <div className="mnt-detail-description-box readonly">
              <p className="mnt-detail-description-text">
                {request.description || 'No description provided'}
              </p>
            </div>
          </div>

          {/* Date Information */}
          <div className="mnt-detail-section">
            <h4 className="mnt-detail-section-title">
              <Calendar style={{ width: '16px', height: '16px' }} />
              Timeline
            </h4>
            <div className="mnt-detail-info-grid">
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
              
              {/* Status History Button */}
              <div className="mnt-detail-info-item">
                <History className="mnt-detail-info-icon" style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
                <div className="mnt-detail-info-content">
                  <h4>Status History</h4>
                  <button 
                    className="mnt-detail-history-btn"
                    onClick={() => alert('Status history feature coming soon!')}
                  >
                    View History
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Images - READ ONLY */}
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

          {/* Admin Notes - EDITABLE */}
          <div className="mnt-detail-section">
            <div className="mnt-detail-section-header">
              <h4 className="mnt-detail-section-title">
                <AlertCircle style={{ width: '16px', height: '16px' }} />
                Admin Notes
              </h4>
              {!showEditNotes && adminNotes ? (
                <button 
                  onClick={handleStartEditNotes}
                  className="mnt-detail-edit-notes-btn"
                >
                  <Edit2 style={{ width: '14px', height: '14px' }} />
                  Edit Notes
                </button>
              ) : null}
            </div>
            
            {showEditNotes ? (
              <div className="mnt-detail-notes-edit-container">
                <textarea
                  value={tempNotes}
                  onChange={(e) => setTempNotes(e.target.value)}
                  placeholder="Add notes about this maintenance request..."
                  className="mnt-detail-notes-textarea"
                  autoFocus
                />
                <div className="mnt-detail-notes-actions">
                  <button
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes || !tempNotes.trim() || tempNotes === adminNotes}
                    className="mnt-detail-save-notes-btn"
                  >
                    <Save style={{ width: '14px', height: '14px' }} />
                    {isSavingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                  <button
                    onClick={handleCancelEditNotes}
                    className="mnt-detail-cancel-notes-btn"
                    disabled={isSavingNotes}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mnt-detail-notes-display">
                {adminNotes ? (
                  <p className="mnt-detail-notes-text">{adminNotes}</p>
                ) : (
                  <p className="mnt-detail-notes-placeholder">No admin notes yet.</p>
                )}
              </div>
            )}
            
            <p className="mnt-detail-notes-help">
              These notes are visible to admin only. Tenant cannot see these notes.
            </p>
          </div>

          {/* Status Actions - ENHANCED */}
          <div className="mnt-detail-status-actions">
            <h4 className="mnt-detail-actions-title">
              Update Status
              <span className="mnt-detail-current-status">Current: {request.status.replace('-', ' ')}</span>
            </h4>
            
            <div className="mnt-detail-actions-grid">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleStatusUpdateWithConfirmation(option.value)}
                  className={`mnt-detail-action-btn ${option.class}`}
                >
                  {option.icon && <option.icon style={{ width: '14px', height: '14px' }} />}
                  {option.label}
                </button>
              ))}
            </div>
            
            <div className="mnt-detail-status-help">
              <AlertCircle style={{ width: '14px', height: '14px' }} />
              Status changes are visible to the tenant in real-time
            </div>
          </div>

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div className="mnt-detail-delete-modal">
              <div className="mnt-detail-delete-content">
                <h3 className="mnt-detail-delete-title">
                  <Trash2 style={{ width: '24px', height: '24px', color: '#dc2626' }} />
                  Delete Maintenance Request
                </h3>
                <p className="mnt-detail-delete-text">
                  Are you sure you want to delete this maintenance request?<br />
                  <strong>This action cannot be undone.</strong>
                </p>
                <div className="mnt-detail-delete-warning">
                  <AlertCircle style={{ width: '16px', height: '16px' }} />
                  Deleting will remove this request permanently from the system.
                </div>
                <div className="mnt-detail-delete-actions">
                  <button
                    onClick={handleDeleteRequest}
                    disabled={isDeleting}
                    className="mnt-detail-delete-confirm-btn"
                  >
                    {isDeleting ? 'Deleting...' : 'Yes, Delete Permanently'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                    className="mnt-detail-delete-cancel-btn"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MaintenanceRequestDetails;