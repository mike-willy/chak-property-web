// components/maintenance/MaintenanceRequestDetails.jsx
import React, { useState, useEffect } from 'react';
import {
  X, Home, User, Calendar, MessageSquare, CheckCircle,
  AlertCircle, Lock, Edit2, Save, Phone, Mail,
  Trash2, RotateCcw, Pause, Ban, History, Clock, Tag,
  EyeOff, Archive
} from 'lucide-react';
import { maintenanceService } from '../../pages/firebase/maintenanceService';
import '../../styles/maintenance-details.css';

const MaintenanceRequestDetails = ({ request, onClose, onStatusUpdate, onDeleteRequest, userRole }) => {
  const [adminNotes, setAdminNotes] = useState(request.adminNotes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [showEditNotes, setShowEditNotes] = useState(false);
  const [tempNotes, setTempNotes] = useState(request.adminNotes || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState(userRole || 'admin');

  useEffect(() => {
    if (!userRole) {
      const fetchUserRole = async () => {
        try {
          const role = await maintenanceService.admin.getUserRole?.() || 'admin';
          setCurrentUserRole(role);
        } catch (error) {
          console.error('Error fetching user role:', error);
          setCurrentUserRole('admin');
        }
      };
      fetchUserRole();
    }
  }, [userRole]);

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
    setIsDeleting(true);
    try {
      let deleteResult;
      if (currentUserRole === 'admin') {
        deleteResult = await maintenanceService.admin.deleteRequest(request.id);
      } else if (currentUserRole === 'landlord') {
        deleteResult = await maintenanceService.landlord.deletePropertyRequest(request.id);
      } else if (currentUserRole === 'tenant') {
        deleteResult = await maintenanceService.tenant.deleteMyRequest(request.id);
      } else {
        throw new Error('Invalid user role');
      }

      if (deleteResult) {
        if (onDeleteRequest) {
          await onDeleteRequest(request.id);
        }
        onClose();
      }

    } catch (error) {
      console.error('Error deleting/hiding request:', error);
      alert('Failed to delete/hide request: ' + error.message);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const getAvailableStatusOptions = () => {
    const options = [];

    if (currentUserRole === 'admin' || currentUserRole === 'landlord') {
      options.push({ value: 'on-hold', label: 'Put On Hold', icon: Pause, class: 'mnt-detail-action-hold' });
      options.push({ value: 'cancelled', label: 'Cancel Request', icon: Ban, class: 'mnt-detail-action-cancel' });
    }

    switch (request.status) {
      case 'pending':
        if (currentUserRole === 'admin' || currentUserRole === 'landlord') {
          options.unshift({ value: 'in-progress', label: 'Start Work', icon: Clock, class: 'mnt-detail-action-start' });
        }
        break;
      case 'in-progress':
        if (currentUserRole === 'admin' || currentUserRole === 'landlord') {
          options.unshift(
            { value: 'pending', label: 'Back to Pending', icon: RotateCcw, class: 'mnt-detail-action-reopen' },
            { value: 'completed', label: 'Mark Completed', icon: CheckCircle, class: 'mnt-detail-action-complete' }
          );
        }
        break;
      case 'on-hold':
        if (currentUserRole === 'admin' || currentUserRole === 'landlord') {
          options.unshift(
            { value: 'pending', label: 'Back to Pending', icon: RotateCcw, class: 'mnt-detail-action-reopen' },
            { value: 'in-progress', label: 'Resume Work', icon: Clock, class: 'mnt-detail-action-start' }
          );
        }
        break;
      case 'completed':
        if (currentUserRole === 'admin' || currentUserRole === 'landlord') {
          options.unshift(
            { value: 'pending', label: 'Reopen Request', icon: RotateCcw, class: 'mnt-detail-action-reopen' },
            { value: 'in-progress', label: 'Back to In Progress', icon: Clock, class: 'mnt-detail-action-start' }
          );
        }
        break;
      case 'cancelled':
        if (currentUserRole === 'admin' || currentUserRole === 'landlord') {
          options.unshift(
            { value: 'pending', label: 'Reopen Request', icon: RotateCcw, class: 'mnt-detail-action-reopen' }
          );
        }
        break;
    }

    return options;
  };

  const getDeleteActionText = () => {
    switch (currentUserRole) {
      case 'admin':
        return {
          title: 'Archive Maintenance Request',
          actionText: 'Archive',
          actionVerb: 'archiving',
          description: 'This will remove the request from your admin view only.'
        };
      case 'landlord':
        return {
          title: 'Hide Maintenance Request',
          actionText: 'Hide',
          actionVerb: 'hiding',
          description: 'This will hide the request from your landlord view only.'
        };
      case 'tenant':
        return {
          title: 'Hide Maintenance Request',
          actionText: 'Hide',
          actionVerb: 'hiding',
          description: 'This will hide the request from your tenant view only.'
        };
      default:
        return {
          title: 'Delete Maintenance Request',
          actionText: 'Delete',
          actionVerb: 'deleting',
          description: 'This will remove the request from your view.'
        };
    }
  };

  const isRequestHidden = () => {
    switch (currentUserRole) {
      case 'admin':
        return request.adminDeleted === true;
      case 'landlord':
        return request.landlordHidden === true;
      case 'tenant':
        return request.tenantHidden === true;
      default:
        return false;
    }
  };

  const TenantInfoBox = ({ label, value, icon: Icon, subValue }) => (
    <div className="mnt-detail-info-box">
      <div className="mnt-detail-info-box-header">
        <Icon className="mnt-detail-info-box-icon" />
        <span className="mnt-detail-info-box-label">{label}</span>
        <Lock className="mnt-detail-readonly-icon" title="Tenant submitted - Read only" />
      </div>
      <div className="mnt-detail-info-box-value">{value || '—'}</div>
      {subValue && <div className="mnt-detail-info-box-subvalue">{subValue}</div>}
    </div>
  );

  const statusOptions = getAvailableStatusOptions();
  const deleteAction = getDeleteActionText();
  const isHidden = isRequestHidden();

  return (
    <div className="mnt-detail-overlay">
      <div className="mnt-detail-container">
        <div className="mnt-detail-header">
          <div className="mnt-detail-header-top">
            <div>
              <h2 className="mnt-detail-title">Maintenance Request Details</h2>
              <p className="mnt-detail-id">ID: {request.id}</p>
              {isHidden && (
                <div className="mnt-detail-hidden-badge">
                  <EyeOff size={12} />
                  <span>Hidden from your view</span>
                </div>
              )}
            </div>
            <div className="mnt-detail-header-actions">
              {(currentUserRole === 'admin' || currentUserRole === 'landlord' || currentUserRole === 'tenant') && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="mnt-detail-delete-btn"
                  title={`${deleteAction.actionText} Request`}
                  disabled={isHidden}
                >
                  {currentUserRole === 'admin' ? (
                    <Archive size={16} />
                  ) : (
                    <EyeOff size={16} />
                  )}
                </button>
              )}
              <button
                onClick={onClose}
                className="mnt-detail-close-btn"
                aria-label="Close"
              >
                <X size={20} />
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
            {currentUserRole && (
              <span className="mnt-detail-role-badge">
                Viewing as: {currentUserRole}
              </span>
            )}
          </div>
          <h3 className="mnt-detail-category">{request.title || request.category}</h3>

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
          <div className="mnt-detail-section">
            <h4 className="mnt-detail-section-title">
              <User size={16} />
              Tenant Information (Read Only)
            </h4>
            <div className="mnt-detail-readonly-notice">
              <Lock size={14} />
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
                subValue={request.unitName || (request.unitNumber ? `Unit ${request.unitNumber}` : '—')}
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

          <div className="mnt-detail-section">
            <h4 className="mnt-detail-section-title">
              <MessageSquare size={16} />
              Request Details (Read Only)
            </h4>
            <div className="mnt-detail-description-box readonly">
              <div className="mnt-detail-category-display">
                <Tag size={14} />
                <strong>Category:</strong> {request.title || request.category || 'Uncategorized'}
              </div>

              <div className="mnt-detail-description-header">
                <strong>Description:</strong>
              </div>
              <p className="mnt-detail-description-text">
                {request.description || 'No description provided'}
              </p>
            </div>
          </div>

          <div className="mnt-detail-section">
            <h4 className="mnt-detail-section-title">
              <Calendar size={16} />
              Timeline
            </h4>
            <div className="mnt-detail-info-grid">
              <div className="mnt-detail-info-item">
                <Calendar className="mnt-detail-info-icon" size={20} />
                <div className="mnt-detail-info-content">
                  <h4>Submitted</h4>
                  <p className="mnt-detail-info-text">{formatDate(request.createdAt)}</p>
                </div>
              </div>

              <div className="mnt-detail-info-item">
                <Calendar className="mnt-detail-info-icon" size={20} />
                <div className="mnt-detail-info-content">
                  <h4>Last Updated</h4>
                  <p className="mnt-detail-info-text">{formatDate(request.updatedAt)}</p>
                </div>
              </div>

              {request.completedAt && (
                <div className="mnt-detail-info-item">
                  <CheckCircle
                    className="mnt-detail-info-icon"
                    size={20}
                    style={{ color: '#10b981' }}
                  />
                  <div className="mnt-detail-info-content">
                    <h4>Completed On</h4>
                    <p className="mnt-detail-info-text">{formatDate(request.completedAt)}</p>
                  </div>
                </div>
              )}

              <div className="mnt-detail-info-item">
                <History className="mnt-detail-info-icon" size={20} style={{ color: '#8b5cf6' }} />
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

          {currentUserRole === 'admin' && (
            <div className="mnt-detail-section">
              <div className="mnt-detail-section-header">
                <h4 className="mnt-detail-section-title">
                  <AlertCircle size={16} />
                  Admin Notes (Private)
                </h4>
                {!showEditNotes && (
                  <button
                    onClick={handleStartEditNotes}
                    className="mnt-detail-edit-notes-btn"
                  >
                    <Edit2 size={14} />
                    {adminNotes ? 'Edit Notes' : 'Add Notes'}
                  </button>
                )}
              </div>

              {showEditNotes ? (
                <div className="mnt-detail-notes-edit-container">
                  <textarea
                    value={tempNotes}
                    onChange={(e) => setTempNotes(e.target.value)}
                    placeholder="Add private notes about this maintenance request (only visible to admin)..."
                    className="mnt-detail-notes-textarea"
                    autoFocus
                  />
                  <div className="mnt-detail-notes-actions">
                    <button
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                      className="mnt-detail-save-notes-btn"
                    >
                      <Save size={14} />
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
                    <p className="mnt-detail-notes-placeholder">
                      No admin notes yet. Click "Add Notes" to add private notes (tenant cannot see these).
                    </p>
                  )}
                </div>
              )}

              <p className="mnt-detail-notes-help">
                <Lock size={14} />
                These notes are visible to admin only. Tenant cannot see these notes.
              </p>
            </div>
          )}

          {(currentUserRole === 'admin' || currentUserRole === 'landlord') && statusOptions.length > 0 && (
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
                    {option.icon && <option.icon size={14} />}
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="mnt-detail-status-help">
                <AlertCircle size={14} />
                Status changes are visible to the tenant in real-time
              </div>
            </div>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="mnt-detail-delete-modal">
          <div className="mnt-detail-delete-content">
            <h3 className="mnt-detail-delete-title">
              {currentUserRole === 'admin' ? (
                <Archive size={24} style={{ color: '#f97316' }} />
              ) : (
                <EyeOff size={24} style={{ color: '#6b7280' }} />
              )}
              {deleteAction.title}
            </h3>
            <p className="mnt-detail-delete-text">
              {deleteAction.description}
            </p>
            <div className="mnt-detail-delete-warning">
              <AlertCircle size={16} />
              <div>
                <p><strong>What this does:</strong></p>
                {currentUserRole === 'admin' && (
                  <>
                    <p>✓ Removed from <strong>Admin</strong> view only</p>
                    <p>✗ Still visible to <strong>Tenant</strong></p>
                    <p>✗ Still visible to <strong>Landlord</strong></p>
                    <p className="mnt-detail-delete-note">
                      Note: This archives the request (soft delete). It can be restored in the Archived section.
                    </p>
                  </>
                )}
                {currentUserRole === 'landlord' && (
                  <>
                    <p>✓ Hidden from <strong>your Landlord</strong> view only</p>
                    <p>✗ Still visible to <strong>Admin</strong></p>
                    <p>✗ Still visible to <strong>Tenant</strong></p>
                    <p className="mnt-detail-delete-note">
                      Note: You can restore hidden requests from your settings.
                    </p>
                  </>
                )}
                {currentUserRole === 'tenant' && (
                  <>
                    <p>✓ Hidden from <strong>your Tenant</strong> view only</p>
                    <p>✗ Still visible to <strong>Admin</strong></p>
                    <p>✗ Still visible to <strong>Landlord</strong></p>
                    <p className="mnt-detail-delete-note">
                      Note: You can restore hidden requests from your settings.
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="mnt-detail-delete-actions">
              <button
                onClick={handleDeleteRequest}
                disabled={isDeleting || isHidden}
                className={`mnt-detail-delete-confirm-btn ${currentUserRole === 'admin' ? 'mnt-detail-archive-btn' : 'mnt-detail-hide-btn'}`}
              >
                {isDeleting ? `${deleteAction.actionVerb}...` : `Yes, ${deleteAction.actionText}`}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="mnt-detail-delete-cancel-btn"
              >
                Cancel
              </button>
            </div>
            {isHidden && (
              <div className="mnt-detail-already-hidden">
                <AlertCircle size={14} />
                <span>This request is already hidden from your view.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintenanceRequestDetails;