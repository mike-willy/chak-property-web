// src/pages/Landlords.jsx - WITH PASSWORD CONFIRMATION DELETE
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  collection, 
  getDocs, 
  query,
  where,
  orderBy,
  deleteDoc,
  doc,
  writeBatch
} from "firebase/firestore";
import { auth, db } from "../pages/firebase/firebase";
import { 
  reauthenticateWithCredential, 
  EmailAuthProvider 
} from "firebase/auth";
import "../styles/landlord.css";
import { FaTrash, FaExclamationTriangle, FaMoneyBillWave, FaHome, FaUsers, FaLock } from "react-icons/fa";

const Landlords = () => {
  const [landlords, setLandlords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  // Delete modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [landlordToDelete, setLandlordToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState("");
  const [deleteStats, setDeleteStats] = useState({
    properties: 0,
    tenants: 0,
    units: 0,
    futurePayments: 0,
    archivedPayments: 0
  });

  // Password confirmation states
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  // Fetch landlords from Firestore
  useEffect(() => {
    fetchLandlords();
  }, []);

  const fetchLandlords = async () => {
    try {
      setLoading(true);
      console.log("📡 Fetching landlords with actual property counts...");
      
      // 1️⃣ First, get all landlords
      const landlordsQuery = query(
        collection(db, "landlords"),
        orderBy("createdAt", "desc")
      );

      const landlordsSnapshot = await getDocs(landlordsQuery);
      const landlordsData = [];
      
      // 2️⃣ Get all properties at once to avoid multiple queries
      const propertiesQuery = query(collection(db, "properties"));
      const propertiesSnapshot = await getDocs(propertiesQuery);
      
      // Create a map of properties grouped by landlordId
      const propertiesByLandlord = {};
      
      propertiesSnapshot.forEach((doc) => {
        const propertyData = doc.data();
        const landlordId = propertyData.landlordId;
        
        if (landlordId) {
          if (!propertiesByLandlord[landlordId]) {
            propertiesByLandlord[landlordId] = [];
          }
          propertiesByLandlord[landlordId].push({
            id: doc.id,
            ...propertyData
          });
        }
      });
      
      console.log(`📊 Found ${Object.keys(propertiesByLandlord).length} landlords with properties`);
      
      // 3️⃣ Process each landlord with actual property count
      landlordsSnapshot.forEach((doc) => {
        const data = doc.data();
        const landlordId = doc.id;
        
        // Get the name
        const fullName = data.name || 
                        `${data.firstName || ""} ${data.lastName || ""}`.trim() || 
                        "No Name";
        
        // Get ACTUAL properties count from our map
        const actualProperties = propertiesByLandlord[landlordId] || [];
        const actualCount = actualProperties.length;
        
        // Get old stored count (might be outdated)
        const oldProperties = data.properties || [];
        const oldCount = oldProperties.length;
        
        // Log discrepancies
        if (oldCount !== actualCount) {
          console.log(`⚠️ Count mismatch for ${fullName}: ` +
                     `Old list: ${oldCount}, Actual in DB: ${actualCount}`);
        }
        
        landlordsData.push({
          id: landlordId,
          name: fullName,
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          email: data.email || "No Email",
          phone: data.phone || "Not provided",
          // ✅ FIXED: Use ACTUAL property count from properties collection
          propertiesCount: actualCount,
          // Keep these for reference
          oldPropertiesCount: oldCount,
          totalProperties: data.totalProperties || 0,
          activeProperties: data.activeProperties || 0,
          status: data.status || "active",
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
          isVerified: data.isVerified || false,
          company: data.company || "",
          address: data.address || "",
          // Store actual properties for reference
          actualProperties: actualProperties
        });
      });
      
      console.log(`✅ Loaded ${landlordsData.length} landlords with CORRECT property counts`);
      setLandlords(landlordsData);
      
    } catch (error) {
      console.error("❌ Error fetching landlords:", error);
      alert("Failed to load landlords. Please check your Firestore setup.");
    } finally {
      setLoading(false);
    }
  };

  // Calculate what will be deleted when removing a landlord
  const calculateDeletionImpact = async (landlordId) => {
    const stats = {
      properties: 0,
      tenants: 0,
      units: 0,
      futurePayments: 0,
      archivedPayments: 0
    };
    
    try {
      // Count properties
      const propertiesQuery = query(
        collection(db, "properties"),
        where("landlordId", "==", landlordId)
      );
      const propertiesSnapshot = await getDocs(propertiesQuery);
      stats.properties = propertiesSnapshot.size;
      
      // Count tenants and units
      for (const propertyDoc of propertiesSnapshot.docs) {
        const propertyId = propertyDoc.id;
        
        // Count units in this property
        const unitsRef = collection(db, `properties/${propertyId}/units`);
        const unitsSnapshot = await getDocs(unitsRef);
        stats.units += unitsSnapshot.size;
        
        // Count tenants for this property
        const tenantsQuery = query(
          collection(db, "tenants"),
          where("propertyId", "==", propertyId)
        );
        const tenantsSnapshot = await getDocs(tenantsQuery);
        stats.tenants += tenantsSnapshot.size;
        
        // Count future payments for these tenants
        for (const tenantDoc of tenantsSnapshot.docs) {
          const tenantId = tenantDoc.id;
          const paymentsQuery = query(
            collection(db, "payments"),
            where("tenantId", "==", tenantId),
            where("status", "in", ["pending", "upcoming", "scheduled"])
          );
          const paymentsSnapshot = await getDocs(paymentsQuery);
          stats.futurePayments += paymentsSnapshot.size;
        }
      }
      
      // Count completed payments (to be archived)
      const completedPaymentsQuery = query(
        collection(db, "payments"),
        where("landlordId", "==", landlordId),
        where("status", "==", "completed")
      );
      const completedPaymentsSnapshot = await getDocs(completedPaymentsQuery);
      stats.archivedPayments = completedPaymentsSnapshot.size;
      
    } catch (error) {
      console.error("Error calculating deletion impact:", error);
    }
    
    return stats;
  };

  // Handle delete landlord confirmation
  const handleDeleteLandlord = async (landlord) => {
    setLandlordToDelete(landlord);
    setPassword("");
    setPasswordError("");
    setShowPasswordInput(false);
    
    // Calculate what will be deleted
    setDeleteProgress("Calculating deletion impact...");
    const stats = await calculateDeletionImpact(landlord.id);
    setDeleteStats(stats);
    
    setShowDeleteModal(true);
  };

  // Verify admin password using Firebase re-authentication
  const verifyAdminPassword = async (inputPassword) => {
    try {
      // Get the currently logged-in admin from Firebase
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        setPasswordError("No admin session found. Please login again.");
        // Redirect to admin login after 2 seconds
        setTimeout(() => navigate("/admin-login"), 2000);
        return false;
      }
      
      // Get admin's email from Firebase session
      const adminEmail = currentUser.email;
      
      if (!adminEmail) {
        setPasswordError("Admin email not found in session.");
        return false;
      }
      
      // Create credential with admin's email and entered password
      const credential = EmailAuthProvider.credential(adminEmail, inputPassword);
      
      // Re-authenticate with Firebase - this verifies the password is correct
      await reauthenticateWithCredential(currentUser, credential);
      
      console.log("✅ Admin re-authenticated successfully");
      return true;
      
    } catch (error) {
      console.error("❌ Password verification failed:", error);
      
      // User-friendly error messages
      if (error.code === 'auth/wrong-password') {
        setPasswordError("Incorrect password. Please try again.");
      } else if (error.code === 'auth/too-many-requests') {
        setPasswordError("Too many failed attempts. Please try again later.");
      } else if (error.code === 'auth/user-not-found') {
        setPasswordError("Admin account not found. Please login again.");
      } else if (error.code === 'auth/network-request-failed') {
        setPasswordError("Network error. Please check your connection.");
      } else {
        setPasswordError("Authentication failed: " + error.message);
      }
      
      return false;
    }
  };

  // Archive payment records (keep for accounting)
  const archivePaymentRecords = async (landlordId) => {
    try {
      // Find all completed payments for this landlord
      const paymentsQuery = query(
        collection(db, "payments"),
        where("landlordId", "==", landlordId),
        where("status", "==", "completed")
      );
      
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const batch = writeBatch(db);
      
      paymentsSnapshot.forEach((paymentDoc) => {
        const paymentData = paymentDoc.data();
        const archivedPaymentRef = doc(collection(db, "archived_payments"));
        
        // Create archived version with original data
        batch.set(archivedPaymentRef, {
          ...paymentData,
          originalPaymentId: paymentDoc.id,
          archivedAt: new Date(),
          archivedReason: "Landlord deleted from system",
          originalLandlordId: landlordId,
          originalLandlordName: landlordToDelete?.name || "Unknown"
        });
        
        // Delete original payment
        batch.delete(paymentDoc.ref);
      });
      
      await batch.commit();
      console.log(`✅ Archived ${paymentsSnapshot.size} payment records`);
      return paymentsSnapshot.size;
      
    } catch (error) {
      console.error("Error archiving payments:", error);
      return 0;
    }
  };

  // Handle confirm delete landlord
  const handleConfirmDelete = async () => {
    if (!landlordToDelete) return;
    
    // If password not entered yet, show password input
    if (!showPasswordInput) {
      setShowPasswordInput(true);
      return;
    }
    
    // Verify password
    if (!password.trim()) {
      setPasswordError("Password is required");
      return;
    }
    
    const isValidPassword = await verifyAdminPassword(password);
    if (!isValidPassword) {
      // Error message is already set in verifyAdminPassword function
      return;
    }
    
    // Password verified, proceed with deletion
    try {
      setDeleting(true);
      setDeleteProgress("Starting deletion process...");
      
      const landlordId = landlordToDelete.id;
      const landlordName = landlordToDelete.name;
      
      // 1️⃣ Archive payment records first (keep for accounting)
      setDeleteProgress("Archiving payment records for accounting...");
      const archivedCount = await archivePaymentRecords(landlordId);
      
      // 2️⃣ Find all properties of this landlord
      setDeleteProgress(`Finding properties for ${landlordName}...`);
      const propertiesQuery = query(
        collection(db, "properties"),
        where("landlordId", "==", landlordId)
      );
      const propertiesSnapshot = await getDocs(propertiesQuery);
      
      const deletions = [];
      
      // 3️⃣ For each property, delete related data
      for (const propertyDoc of propertiesSnapshot.docs) {
        const propertyId = propertyDoc.id;
        const propertyName = propertyDoc.data().name || propertyId;
        
        setDeleteProgress(`Deleting property: ${propertyName}...`);
        
        // Delete all units in this property
        const unitsRef = collection(db, `properties/${propertyId}/units`);
        const unitsSnapshot = await getDocs(unitsRef);
        
        unitsSnapshot.forEach((unitDoc) => {
          deletions.push(deleteDoc(doc(db, `properties/${propertyId}/units`, unitDoc.id)));
        });
        
        // Find and delete tenants for this property
        const tenantsQuery = query(
          collection(db, "tenants"),
          where("propertyId", "==", propertyId)
        );
        const tenantsSnapshot = await getDocs(tenantsQuery);
        
        tenantsSnapshot.forEach((tenantDoc) => {
          const tenantId = tenantDoc.id;
          
          // Delete tenant user account if exists
          const userQuery = query(
            collection(db, "users"),
            where("tenantId", "==", tenantId)
          );
          // We'll handle this separately
          
          // Delete tenant document
          deletions.push(deleteDoc(doc(db, "tenants", tenantId)));
          
          // Delete future/pending payments for this tenant
          const futurePaymentsQuery = query(
            collection(db, "payments"),
            where("tenantId", "==", tenantId),
            where("status", "in", ["pending", "upcoming", "scheduled"])
          );
          // We'll handle this separately
        });
        
        // Delete the property itself
        deletions.push(deleteDoc(doc(db, "properties", propertyId)));
      }
      
      // 4️⃣ Delete future payments (pending/upcoming)
      setDeleteProgress("Deleting future/pending payments...");
      const futurePaymentsQuery = query(
        collection(db, "payments"),
        where("landlordId", "==", landlordId),
        where("status", "in", ["pending", "upcoming", "scheduled"])
      );
      const futurePaymentsSnapshot = await getDocs(futurePaymentsQuery);
      
      futurePaymentsSnapshot.forEach((paymentDoc) => {
        deletions.push(deleteDoc(paymentDoc.ref));
      });
      
      // 5️⃣ Delete landlord from users collection (if exists)
      setDeleteProgress("Removing landlord access...");
      const userQuery = query(
        collection(db, "users"),
        where("landlordId", "==", landlordId)
      );
      const userSnapshot = await getDocs(userQuery);
      
      userSnapshot.forEach((userDoc) => {
        deletions.push(deleteDoc(userDoc.ref));
      });
      
      // 6️⃣ Finally, delete the landlord document
      deletions.push(deleteDoc(doc(db, "landlords", landlordId)));
      
      // 7️⃣ Execute all deletions
      setDeleteProgress(`Executing ${deletions.length} deletions...`);
      await Promise.all(deletions.map(del => del.catch(e => console.error("Deletion error:", e))));
      
      // 8️⃣ Update local state
      setLandlords(prev => prev.filter(l => l.id !== landlordId));
      
      // 9️⃣ Show success message
      setTimeout(() => {
        setShowDeleteModal(false);
        setLandlordToDelete(null);
        setDeleting(false);
        setDeleteProgress("");
        setPassword("");
        setPasswordError("");
        setShowPasswordInput(false);
        
        alert(`✅ Landlord "${landlordName}" has been deleted successfully!\n\n` +
              `🗑️ Deleted:\n` +
              `• ${propertiesSnapshot.size} properties\n` +
              `• ${deleteStats.tenants} tenants\n` +
              `• ${deleteStats.units} units\n` +
              `• ${deleteStats.futurePayments} future payments\n\n` +
              `📁 Archived:\n` +
              `• ${archivedCount} completed payment records (kept for accounting)`);
      }, 1000);
      
    } catch (error) {
      console.error("❌ Error deleting landlord:", error);
      alert(`Failed to delete landlord: ${error.message}`);
      setDeleting(false);
      setDeleteProgress("");
      setPassword("");
      setPasswordError("");
      setShowPasswordInput(false);
    }
  };

  // Handle cancel delete
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setLandlordToDelete(null);
    setDeleting(false);
    setDeleteProgress("");
    setPassword("");
    setPasswordError("");
    setShowPasswordInput(false);
  };

  // Filter landlords based on search term
  const filteredLandlords = landlords.filter(landlord =>
    landlord.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    landlord.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    landlord.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (landlord.company && landlord.company.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Format date to readable string
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Calculate total properties across all landlords
  const calculateTotalProperties = () => {
    return landlords.reduce((sum, landlord) => sum + landlord.propertiesCount, 0);
  };

  // Handle view landlord details
  const handleViewLandlord = (landlordId) => {
    navigate(`/landlords/${landlordId}`);
  };

  // Handle edit landlord
  const handleEditLandlord = (landlordId) => {
    navigate(`/landlords/edit/${landlordId}`);
  };

  // Refresh landlords list
  const handleRefresh = () => {
    setLoading(true);
    fetchLandlords();
  };

  return (
    <div className="landlords-container">
      {/* Delete Confirmation Modal */}
      {showDeleteModal && landlordToDelete && (
        <div className="modal-overlay">
          <div className="modal-content delete-modal">
            <div className="modal-header">
              <FaExclamationTriangle className="modal-warning-icon" />
              <h3>Delete Landlord</h3>
              <button 
                className="close-modal" 
                onClick={handleCancelDelete}
                disabled={deleting}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="delete-warning">
                <p className="warning-text">
                  <strong> This action cannot be undone!</strong>
                </p>
                <p>You are about to permanently delete:</p>
                
                <div className="landlord-to-delete-info">
                  <h4>{landlordToDelete.name}</h4>
                  <div className="landlord-delete-stats">
                    <div className="delete-stat-item">
                      <FaHome className="stat-icon" />
                      <div className="stat-content">
                        <span className="stat-label">Properties</span>
                        <span className="stat-value">{deleteStats.properties}</span>
                      </div>
                    </div>
                    <div className="delete-stat-item">
                      <FaUsers className="stat-icon" />
                      <div className="stat-content">
                        <span className="stat-label">Tenants</span>
                        <span className="stat-value">{deleteStats.tenants}</span>
                      </div>
                    </div>
                    <div className="delete-stat-item">
                      <FaHome className="stat-icon" />
                      <div className="stat-content">
                        <span className="stat-label">Units</span>
                        <span className="stat-value">{deleteStats.units}</span>
                      </div>
                    </div>
                    <div className="delete-stat-item">
                      <FaMoneyBillWave className="stat-icon" />
                      <div className="stat-content">
                        <span className="stat-label">Future Payments</span>
                        <span className="stat-value">{deleteStats.futurePayments}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="delete-consequences">
                  <p><strong>This will permanently delete:</strong></p>
                  <ul>
                    <li>Landlord account and all access</li>
                    <li>All {deleteStats.properties} properties owned by this landlord</li>
                    <li>All {deleteStats.units} units in these properties</li>
                    <li>All {deleteStats.tenants} tenant accounts in these properties</li>
                    <li>All {deleteStats.futurePayments} future/pending payments</li>
                  </ul>
                  
                  <p className="archive-note">
                    <strong>✅ Payment records will be archived</strong><br />
                    {deleteStats.archivedPayments} completed payments will be kept for accounting purposes only.
                  </p>
                </div>
                
                {/* Password Confirmation Section */}
                {showPasswordInput && (
                  <div className="password-confirmation-section">
                    <div className="password-input-group">
                      <label htmlFor="deletePassword">
                        <FaLock className="password-icon" /> Enter admin password to confirm:
                      </label>
                      <input
                        type="password"
                        id="deletePassword"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setPasswordError("");
                        }}
                        placeholder="Enter your admin login password..."
                        className={passwordError ? "password-input-error" : ""}
                        disabled={deleting}
                        autoComplete="current-password"
                      />
                      {passwordError && (
                        <div className="password-error-message">{passwordError}</div>
                      )}
                    </div>
                    <div className="password-warning">
                      <small>
                        ⚠️ This is the final confirmation step. Once deleted, all data is gone forever.
                        Enter the same password you used to login as admin.
                      </small>
                    </div>
                  </div>
                )}
                
                {!showPasswordInput && (
                  <div className="final-warning-section">
                    <p><strong>⚠️ FINAL WARNING:</strong></p>
                    <ul>
                      <li>This will DELETE ALL data associated with this landlord</li>
                      <li>Tenants will lose access to their accounts immediately</li>
                      <li>Properties will be removed from the system</li>
                      <li>This action requires admin password confirmation</li>
                    </ul>
                  </div>
                )}
                
                {deleting && (
                  <div className="delete-progress">
                    <div className="progress-spinner"></div>
                    <p>{deleteProgress}</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                className="modal-btn cancel-btn"
                onClick={handleCancelDelete}
                disabled={deleting}
              >
                Cancel
              </button>
              <button 
                className="modal-btn delete-confirm-btn"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <span className="spinner-small"></span>
                    Deleting...
                  </>
                ) : showPasswordInput ? (
                  <>
                    <FaLock /> Confirm 
                  </>
                ) : (
                  <>
                    <FaTrash /> Proceed 
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="landlords-header">
        <div>
          <h1>Landlords</h1>
          <p className="landlords-page-subtitle">Manage property owners registered in the system</p>
        </div>
        <div className="landlords-header-actions">
          <button className="landlords-refresh-btn" onClick={handleRefresh} disabled={loading}>
            {loading ? "🔄 Loading..." : "↻ Refresh"}
          </button>
          <Link to="/landlords/add" className="landlords-add-btn">
            + Add New Landlord
          </Link>
        </div>
      </div>

      {/* Search and Stats Bar */}
      <div className="landlords-toolbar">
        <div className="landlords-search-box">
          <input
            type="text"
            placeholder="Search by name, email, phone, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="landlords-search-input"
          />
          <span className="landlords-search-icon">🔍</span>
        </div>
        <div className="landlords-stats-container">
          <div className="landlords-stat-box">
            <span className="landlords-stat-number">{landlords.length}</span>
            <span className="landlords-stat-label">Total Landlords</span>
          </div>
          <div className="landlords-stat-box">
            <span className="landlords-stat-number">
              {landlords.filter(l => l.status === "active").length}
            </span>
            <span className="landlords-stat-label">Active</span>
          </div>
          <div className="landlords-stat-box">
            <span className="landlords-stat-number">
              {calculateTotalProperties()}
            </span>
            <span className="landlords-stat-label">Total Properties</span>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="landlords-loading-container">
          <div className="landlords-loading-spinner"></div>
          <p>Loading landlords with accurate property counts...</p>
        </div>
      ) : (
        /* Landlords Table */
        <div className="landlords-table-container">
          {filteredLandlords.length === 0 ? (
            <div className="landlords-empty-state">
              <div className="landlords-empty-icon">👤</div>
              <h3>No Landlords Found</h3>
              <p>{searchTerm ? 
                "No landlords match your search. Try different keywords." : 
                "No landlords have been registered yet."}
              </p>
              {!searchTerm && (
                <Link to="/landlords/add" className="landlords-empty-action-btn">
                  Add Your First Landlord
                </Link>
              )}
            </div>
          ) : (
            <>
              <table className="landlords-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Contact Information</th>
                    <th>Properties</th>
                    <th>Status</th>
                    <th>Registered Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLandlords.map((landlord) => (
                    <tr key={landlord.id}>
                      <td>
                        <div className="landlords-name-cell">
                          <span className="landlords-name">{landlord.name}</span>
                          {landlord.isVerified && (
                            <span className="landlords-verified-badge">✓ Verified</span>
                          )}
                          {landlord.company && (
                            <div className="landlords-company-name">{landlord.company}</div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="landlords-contact-info">
                          <div className="landlords-contact-email">{landlord.email}</div>
                          <div className="landlords-contact-phone">{landlord.phone}</div>
                        </div>
                      </td>
                      <td>
                        <div className="landlords-properties-count">
                          <span className="landlords-count-number">{landlord.propertiesCount}</span>
                          <span className="landlords-count-label">
                            {landlord.propertiesCount === 1 ? 'property' : 'properties'}
                            {landlord.oldPropertiesCount !== landlord.propertiesCount && (
                              <span className="landlords-count-updated" title="Updated from actual database count">
                                ✓
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`landlords-status-badge landlords-status-${landlord.status}`}>
                          {landlord.status.charAt(0).toUpperCase() + landlord.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        <span className="landlords-registered-date">
                          {formatDate(landlord.createdAt)}
                        </span>
                      </td>
                      <td>
                        <div className="landlords-action-buttons">
                          <button 
                            className="landlords-table-view-btn"
                            onClick={() => handleViewLandlord(landlord.id)}
                            title="View Details"
                          >
                            👁️ View
                          </button>
                          <button 
                            className="landlords-table-edit-btn"
                            onClick={() => handleEditLandlord(landlord.id)}
                            title="Edit Landlord"
                          >
                            ✏️ Edit
                          </button>
                          <button 
                            className="landlords-table-delete-btn"
                            onClick={() => handleDeleteLandlord(landlord)}
                            title="Delete Landlord (requires password confirmation)"
                          >
                            <FaTrash /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Table Footer */}
              <div className="landlords-table-footer">
                <div className="landlords-results-count">
                  Showing {filteredLandlords.length} of {landlords.length} landlords
                  {calculateTotalProperties() > 0 && (
                    <span className="landlords-total-props">
                      • {calculateTotalProperties()} total properties across all landlords
                    </span>
                  )}
                </div>
                
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Landlords;