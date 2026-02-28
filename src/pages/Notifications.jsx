import React, { useState, useEffect } from "react";
import { FaBell, FaCheck, FaTrash, FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { auth } from "../pages/firebase/firebase";
import {
    listenForNotifications,
    markAsRead,
    markAllAsRead,
    deleteExpiredNotifications
} from "../services/notificationService";
import NotificationIcon from "../components/NotificationIcon";
import "../styles/DashboardLayout.css"; // Reuse dashboard layout styles
import "../styles/topNavbar.css"; // Reuse notification styles

const Notifications = () => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Listen for all admin notifications
        const unsubscribe = listenForNotifications("admin", (notifs) => {
            setNotifications(notifs);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleMarkAsRead = async (id, e) => {
        e.stopPropagation(); // Prevent row click
        await markAsRead(id);
    };

    const handleMarkAllAsRead = async () => {
        await markAllAsRead("admin");
    };

    const handleCleanUp = async () => {
        const result = await deleteExpiredNotifications();
        if (result.success) {
            alert(`Cleaned up ${result.deleted} expired notifications.`);
        } else {
            alert("Failed to clean up notifications.");
        }
    };

    const handleNotificationClick = (notification) => {
        if (!notification.read) {
            markAsRead(notification.id);
        }

        // Navigate based on type
        if (notification.type === "tenant_application") {
            navigate('/admin/applications');
        } else if (notification.type === "maintenance_request") {
            navigate('/maintenance');
        } else if (notification.type === "rent_payment") {
            navigate('/finance');
        }
    };

    const formatTime = (date) => {
        if (!date) return "Unknown date";
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }).format(new Date(date));
    };

    if (loading) {
        return (
            <div className="admin-page-container">
                <div className="page-header">
                    <h1>Notifications</h1>
                </div>
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading notifications...</p>
                </div>
            </div>
        );
    }

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="admin-page-container">
            <div className="page-header">
                <button className="back-btn" onClick={() => navigate(-1)} style={{ marginRight: '15px' }}>
                    <FaArrowLeft /> Back
                </button>
                <h1>All Notifications</h1>

                <div className="page-actions">
                    {unreadCount > 0 && (
                        <button className="action-btn primary" onClick={handleMarkAllAsRead}>
                            <FaCheck /> Mark All Read
                        </button>
                    )}
                    <button className="action-btn danger" onClick={handleCleanUp}>
                        <FaTrash /> Clean Up Expired
                    </button>
                </div>
            </div>

            <div className="admin-card">
                <div className="card-header">
                    <h3>Notification History</h3>
                    <span className="badge" style={{ backgroundColor: '#e2e8f0', color: '#475569', padding: '4px 8px', borderRadius: '12px', fontSize: '12px' }}>
                        {notifications.length} Total
                    </span>
                </div>

                <div className="card-body" style={{ padding: '0' }}>
                    {notifications.length === 0 ? (
                        <div className="empty-state" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                            <FaBell size={40} style={{ color: '#cbd5e1', marginBottom: '15px' }} />
                            <h3>No Notifications</h3>
                            <p>You don't have any notifications right now.</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '50px' }}>Type</th>
                                        <th>Message</th>
                                        <th>Date</th>
                                        <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {notifications.map(notification => (
                                        <tr
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            style={{
                                                cursor: 'pointer',
                                                backgroundColor: notification.read ? 'transparent' : '#f0f9ff',
                                                fontWeight: notification.read ? 'normal' : '500'
                                            }}
                                        >
                                            <td>
                                                <div style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '8px',
                                                    backgroundColor: '#f1f5f9',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <NotificationIcon type={notification.type} size={20} />
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontSize: '14px', color: '#0f172a' }}>{notification.title}</span>
                                                    <span style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{notification.message}</span>
                                                </div>
                                            </td>
                                            <td style={{ color: '#64748b', fontSize: '13px' }}>
                                                {formatTime(notification.createdAt)}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {!notification.read && (
                                                    <button
                                                        className="icon-btn success"
                                                        title="Mark as read"
                                                        onClick={(e) => handleMarkAsRead(notification.id, e)}
                                                        style={{ padding: '6px', borderRadius: '4px', border: 'none', backgroundColor: '#dcfce7', color: '#16a34a', cursor: 'pointer' }}
                                                    >
                                                        <FaCheck size={14} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Notifications;
