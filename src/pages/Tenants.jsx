import React, { useState, useEffect } from "react";
import { db } from "../pages/firebase/firebase";
import { 
  collection, 
  getDocs, 
  query, 
  orderBy,
  deleteDoc,
  doc,
  where
} from "firebase/firestore";
import { 
  FaUser, 
  FaHome, 
  FaPhone, 
  FaEnvelope, 
  FaDollarSign, 
  FaCalendar,
  FaEdit,
  FaTrash,
  FaSearch,
  FaFilter,
  FaCheckCircle,
  FaClock,
  FaArrowRight
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import "../styles/tenants.css";

const Tenants = () => {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "tenants"),
        where("status", "==", "active"),
        orderBy("createdAt", "desc")
      );
      
      const snapshot = await getDocs(q);
      const tenantList = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        tenantList.push({
          id: doc.id,
          ...data,
          leaseStart: data.leaseStart?.toDate(),
          leaseEnd: data.leaseEnd?.toDate(),
          createdAt: data.createdAt?.toDate(),
          moveInDate: data.moveInDate?.toDate(),
          initialPaymentDate: data.initialPaymentDate?.toDate(),
        });
      });
      
      setTenants(tenantList);
    } catch (error) {
      console.error("Error fetching tenants:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTenant = async (tenantId, tenantName) => {
    if (!window.confirm(`Delete tenant ${tenantName}? This will free up their unit.`)) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, "tenants", tenantId));
      
      const tenant = tenants.find(t => t.id === tenantId);
      if (tenant?.unitId) {
        // You might want to update the unit status here
        // await updateDoc(doc(db, "units", tenant.unitId), { status: "vacant" });
      }
      
      alert("Tenant deleted successfully");
      fetchTenants();
    } catch (error) {
      console.error("Error deleting tenant:", error);
      alert("Failed to delete tenant");
    }
  };

  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = 
      tenant.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.phone?.includes(searchTerm) ||
      tenant.propertyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.unitNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      filterStatus === "all" || 
      tenant.status?.toLowerCase() === filterStatus.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  const formatDate = (date) => {
    if (!date) return "N/A";
    if (date.toDate) {
      date = date.toDate();
    }
    if (date instanceof Date) {
      return date.toLocaleDateString('en-GB');
    }
    return "Invalid date";
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case "active":
        return <span className="status-badge active">Active • Paying</span>;
      case "pending":
        return <span className="status-badge pending">Pending</span>;
      case "inactive":
        return <span className="status-badge inactive">Inactive</span>;
      case "approved_pending_payment":
        return <span className="status-badge pending-payment">Pending Payment</span>;
      default:
        return <span className="status-badge unknown">{status || "Unknown"}</span>;
    }
  };

  const calculateMonthlyRevenue = () => {
    return tenants.reduce((sum, tenant) => sum + (tenant.monthlyRent || 0), 0);
  };

  const calculateAverageRent = () => {
    if (tenants.length === 0) return 0;
    return calculateMonthlyRevenue() / tenants.length;
  };

  if (loading) {
    return (
      <div className="tenants-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading active tenants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tenant-container">
      {/* Header */}
      <div className="tenant-header">
        <div className="tenant-header-left">
          <h1>Active Tenants Collection</h1>
          <p>Manage tenants who are paying monthly rent</p>
        </div>
        
        <div className="tenant-header-right">
          <button 
            className="tenant-approved-btn"
            onClick={() => navigate("/approved-tenants")}
          >
            <FaCheckCircle /> View Approved (Pending Payment)
          </button>
          
          <button 
            className="tenant-applications-btn"
            onClick={() => navigate("/applications")}
          >
            View Applications
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="tenant-stats">
        <div className="tenant-stat-card total-tenants">
          <div className="tenant-stat-icon">
            <FaUser />
          </div>
          <div className="tenant-stat-content">
            <h3>{tenants.length}</h3>
            <p>Active Tenants</p>
            <small>Paying monthly rent</small>
          </div>
        </div>
        
        <div className="tenant-stat-card monthly-revenue">
          <div className="tenant-stat-icon">
            <FaDollarSign />
          </div>
          <div className="tenant-stat-content">
            <h3>KSh {calculateMonthlyRevenue().toLocaleString()}</h3>
            <p>Monthly Revenue</p>
            <small>From active tenants</small>
          </div>
        </div>
        
        <div className="tenant-stat-card average-rent">
          <div className="tenant-stat-icon">
            <FaHome />
          </div>
          <div className="tenant-stat-content">
            <h3>KSh {calculateAverageRent().toLocaleString()}</h3>
            <p>Average Rent</p>
            <small>Per tenant per month</small>
          </div>
        </div>
        
        <div className="tenant-stat-card properties">
          <div className="tenant-stat-icon">
            <FaCalendar />
          </div>
          <div className="tenant-stat-content">
            <h3>{[...new Set(tenants.map(t => t.propertyId))].length}</h3>
            <p>Properties</p>
            <small>With active tenants</small>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="tenant-controls">
        <div className="tenant-search-box">
          <FaSearch />
          <input
            type="text"
            placeholder="Search active tenants by name, email, phone, property..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="tenant-filter-box">
          <FaFilter />
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="active">Active Tenants</option>
            <option value="all">All Status</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="tenant-table-container">
        {filteredTenants.length === 0 ? (
          <div className="tenant-no-tenants">
            <FaUser className="tenant-no-tenants-icon" />
            <h3>No active tenants found</h3>
            <p>
              {searchTerm 
                ? "Try a different search term" 
                : "No tenants are currently paying monthly rent. Check approved tenants or applications."
              }
            </p>
            <div className="tenant-no-tenants-actions">
              <button 
                className="tenant-approved-action-btn"
                onClick={() => navigate("/approved-tenants")}
              >
                <FaCheckCircle /> Check Approved Tenants
              </button>
              <button 
                className="tenant-applications-action-btn"
                onClick={() => navigate("/applications")}
              >
                View Applications
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="tenant-results-info">
              <span className="tenant-results-count">
                Showing {filteredTenants.length} of {tenants.length} active tenants
              </span>
              <span className="tenant-total-revenue">
                Total monthly revenue: KSh {filteredTenants
                  .reduce((sum, tenant) => sum + (tenant.monthlyRent || 0), 0)
                  .toLocaleString()}
              </span>
            </div>
            
            <div className="tenant-grid">
              {filteredTenants.map((tenant) => (
                <div key={tenant.id} className="tenant-card">
                  <div className="tenant-card-header">
                    <div className="tenant-avatar">
                      <FaUser />
                      {tenant.moveInDate && (
                        <div className="tenant-avatar-badge" title={`Moved in: ${formatDate(tenant.moveInDate)}`}>
                          <FaCalendar />
                        </div>
                      )}
                    </div>
                    <div className="tenant-basic-info">
                      <h3>{tenant.fullName}</h3>
                      <p><FaEnvelope /> {tenant.email}</p>
                      <p><FaPhone /> {tenant.phone}</p>
                    </div>
                    <div className="tenant-status">
                      {getStatusBadge(tenant.status)}
                      {tenant.initialPaymentDate && (
                        <small className="tenant-payment-date">
                          Paid: {formatDate(tenant.initialPaymentDate)}
                        </small>
                      )}
                    </div>
                  </div>

                  <div className="tenant-card-details">
                    <div className="detail-row">
                      <span className="detail-label"><FaHome /> Property:</span>
                      <span className="detail-value">
                        {tenant.propertyName || `Property ${tenant.propertyId}`}
                      </span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Unit:</span>
                      <span className="detail-value">
                        {tenant.unitNumber || `Unit ${tenant.unitId}`}
                      </span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label"><FaDollarSign /> Rent:</span>
                      <span className="detail-value rent-amount">
                        KSh {(tenant.monthlyRent || 0).toLocaleString()}/month
                      </span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label"><FaCalendar /> Lease:</span>
                      <span className="detail-value">
                        {formatDate(tenant.leaseStart)} to {formatDate(tenant.leaseEnd)}
                        {tenant.leaseTerm && <span className="lease-term"> ({tenant.leaseTerm} months)</span>}
                      </span>
                    </div>
                    
                    {tenant.balance !== undefined && tenant.balance > 0 && (
                      <div className="detail-row balance-row">
                        <span className="detail-label">Balance:</span>
                        <span className="detail-value balance-negative">
                          KSh {tenant.balance.toLocaleString()}
                        </span>
                      </div>
                    )}
                    
                    {tenant.balance === 0 && (
                      <div className="detail-row balance-row">
                        <span className="detail-label">Balance:</span>
                        <span className="detail-value balance-positive">
                          Paid up
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="tenant-card-actions">
                    <button 
                      className="btn-view"
                      onClick={() => navigate(`/tenants/${tenant.id}`)}
                      title="View tenant details"
                    >
                      <FaUser /> View
                    </button>
                    
                    <button 
                      className="btn-edit"
                      onClick={() => navigate(`/tenants/edit/${tenant.id}`)}
                      title="Edit tenant information"
                    >
                      <FaEdit /> Edit
                    </button>
                    
                    <button 
                      className="btn-collect"
                      onClick={() => navigate(`/payments/collect/${tenant.id}`)}
                      title="Collect payment"
                    >
                      <FaDollarSign /> Collect
                    </button>
                    
                    <button 
                      className="btn-delete"
                      onClick={() => handleDeleteTenant(tenant.id, tenant.fullName)}
                      title="Delete tenant"
                    >
                      <FaTrash /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Tenants;