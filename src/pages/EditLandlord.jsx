// src/pages/EditLandlord.jsx - UPDATED WITH UNIQUE CLASSES
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { db, auth } from "../pages/firebase/firebase";
import "../styles/EditLandlord.css";
import { 
  FaArrowLeft, 
  FaSave, 
  FaTimes, 
  FaEnvelope, 
  FaPhone, 
  FaUser,
  FaBuilding,
  FaMapMarkerAlt,
  FaLock,
  FaEye,
  FaEyeSlash
} from "react-icons/fa";

const EditLandlord = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    address: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [landlord, setLandlord] = useState(null);

  useEffect(() => {
    fetchLandlord();
  }, [id]);

  const fetchLandlord = async () => {
    try {
      setLoading(true);
      setError("");
      
      let landlordDoc = await getDoc(doc(db, "landlords", id));
      let landlordData = null;
      
      if (!landlordDoc.exists()) {
        landlordDoc = await getDoc(doc(db, "users", id));
        if (!landlordDoc.exists()) {
          throw new Error("Landlord not found");
        }
        landlordData = landlordDoc.data();
      } else {
        landlordData = landlordDoc.data();
      }
      
      setLandlord({
        id: landlordDoc.id,
        ...landlordData
      });
      
      setForm({
        firstName: landlordData.firstName || "",
        lastName: landlordData.lastName || "",
        email: landlordData.email || "",
        phone: landlordData.phone || "",
        company: landlordData.company || "",
        address: landlordData.address || "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
      
    } catch (error) {
      console.error("Error fetching landlord:", error);
      setError("Failed to load landlord details. " + error.message);
      setTimeout(() => navigate("/landlords"), 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
    setSuccess("");
  };

  const validateForm = () => {
    if (!form.firstName.trim()) {
      setError("First name is required");
      return false;
    }
    if (!form.lastName.trim()) {
      setError("Last name is required");
      return false;
    }
    if (!form.email.includes("@")) {
      setError("Valid email is required");
      return false;
    }
    if (!form.phone.trim()) {
      setError("Phone number is required");
      return false;
    }
    
    if (showPasswordFields) {
      if (!form.currentPassword) {
        setError("Current password is required to change password");
        return false;
      }
      if (form.newPassword && form.newPassword.length < 6) {
        setError("New password must be at least 6 characters");
        return false;
      }
      if (form.newPassword !== form.confirmPassword) {
        setError("New passwords do not match");
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setSaving(true);
    setError("");
    setSuccess("");
    
    try {
      const fullName = `${form.firstName} ${form.lastName}`.trim();
      const updatedData = {
        firstName: form.firstName,
        lastName: form.lastName,
        name: fullName,
        email: form.email,
        phone: form.phone,
        company: form.company || "",
        address: form.address || "",
        updatedAt: new Date()
      };
      
      await updateDoc(doc(db, "landlords", id), updatedData);
      
      if (showPasswordFields && form.newPassword) {
        try {
          const currentUser = auth.currentUser;
          if (!currentUser) {
            throw new Error("Admin not authenticated");
          }
          
          const credential = EmailAuthProvider.credential(
            currentUser.email,
            form.currentPassword
          );
          
          await reauthenticateWithCredential(currentUser, credential);
          
        } catch (authError) {
          console.error("Password update error:", authError);
          setError("Failed to update password. Current password may be incorrect.");
          setSaving(false);
          return;
        }
      }
      
      setSuccess(`
        ✅ LANDLORD UPDATED SUCCESSFULLY!
        
        Updated Details:
        • Name: ${fullName}
        • Email: ${form.email}
        • Phone: ${form.phone}
        • Company: ${form.company || "Not provided"}
        • Address: ${form.address || "Not provided"}
        ${form.newPassword ? "• Password: Updated ✓" : ""}
        
        Redirecting back to landlord details...
      `);
      
      setForm(prev => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      }));
      setShowPasswordFields(false);
      
      setTimeout(() => {
        navigate(`/landlords/${id}`);
      }, 3000);
      
    } catch (error) {
      console.error("Error updating landlord:", error);
      
      let errorMessage = "Failed to update landlord. Please try again.";
      
      if (error.code === 'permission-denied') {
        errorMessage = `
          🔒 PERMISSION DENIED!
          
          Firestore rules are blocking the update.
          Make sure you have write permissions for the 'landlords' collection.
          
          Error details: ${error.message}
        `;
      } else if (error.code === 'not-found') {
        errorMessage = "Landlord document not found. It may have been deleted.";
      }
      
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/landlords/${id}`);
  };

  if (loading) {
    return (
      <div className="edit-landlord-container">
        <div className="edit-landlord-loading">
          <div className="edit-landlord-loading-spinner"></div>
          <p>Loading landlord details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-landlord-container">
      <div className="edit-landlord-header">
        <button onClick={handleCancel} className="edit-landlord-back-btn">
          <FaArrowLeft /> Cancel Editing
        </button>
        <h1 className="edit-landlord-title">Edit Landlord</h1>
        <div className="edit-landlord-id-display">
          ID: <code>{id}</code>
        </div>
      </div>
      
      <div className="edit-landlord-card">
        {success && (
          <div className="edit-landlord-success-message">
            <div className="edit-landlord-success-icon">✅</div>
            <div className="edit-landlord-success-content">
              {success.split('\n').map((line, index) => (
                <div key={index}>{line}</div>
              ))}
            </div>
          </div>
        )}
        
        {error && (
          <div className="edit-landlord-error-message">
            <div className="edit-landlord-error-icon">⚠️</div>
            <div className="edit-landlord-error-content">
              {error.split('\n').map((line, index) => (
                <div key={index}>{line}</div>
              ))}
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="edit-landlord-form">
          <div className="edit-landlord-form-section">
            <h2 className="edit-landlord-section-title">
              <FaUser /> Personal Information
            </h2>
            
            <div className="edit-landlord-form-row">
              <div className="edit-landlord-form-group">
                <label htmlFor="firstName" className="edit-landlord-label edit-landlord-required">FIRST NAME</label>
                <div className="edit-landlord-input-container">
                  <FaUser className="edit-landlord-input-icon" />
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={form.firstName}
                    onChange={handleChange}
                    placeholder="John"
                    required
                    disabled={saving}
                    className="edit-landlord-input"
                  />
                </div>
              </div>
              
              <div className="edit-landlord-form-group">
                <label htmlFor="lastName" className="edit-landlord-label edit-landlord-required">LAST NAME</label>
                <div className="edit-landlord-input-container">
                  <FaUser className="edit-landlord-input-icon" />
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={form.lastName}
                    onChange={handleChange}
                    placeholder="Doe"
                    required
                    disabled={saving}
                    className="edit-landlord-input"
                  />
                </div>
              </div>
            </div>
            
            <div className="edit-landlord-form-row">
              <div className="edit-landlord-form-group">
                <label htmlFor="email" className="edit-landlord-label edit-landlord-required">EMAIL ADDRESS</label>
                <div className="edit-landlord-input-container">
                  <FaEnvelope className="edit-landlord-input-icon" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="landlord@example.com"
                    required
                    disabled={saving}
                    className="edit-landlord-input"
                  />
                </div>
                <p className="edit-landlord-helper-text">Used for login and notifications</p>
              </div>
              
              <div className="edit-landlord-form-group">
                <label htmlFor="phone" className="edit-landlord-label edit-landlord-required">PHONE NUMBER</label>
                <div className="edit-landlord-input-container">
                  <FaPhone className="edit-landlord-input-icon" />
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+254 712 345 678"
                    required
                    disabled={saving}
                    className="edit-landlord-input"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="edit-landlord-form-section">
            <h2 className="edit-landlord-section-title">
              <FaBuilding /> Company & Address
            </h2>
            
            <div className="edit-landlord-form-group">
              <label htmlFor="company" className="edit-landlord-label">COMPANY NAME (OPTIONAL)</label>
              <div className="edit-landlord-input-container">
                <FaBuilding className="edit-landlord-input-icon" />
                <input
                  id="company"
                  name="company"
                  type="text"
                  value={form.company}
                  onChange={handleChange}
                  placeholder="Company or business name"
                  disabled={saving}
                  className="edit-landlord-input"
                />
              </div>
            </div>
            
            <div className="edit-landlord-form-group">
              <label htmlFor="address" className="edit-landlord-label">PHYSICAL ADDRESS (OPTIONAL)</label>
              <div className="edit-landlord-input-container">
                <FaMapMarkerAlt className="edit-landlord-input-icon" />
                <input
                  id="address"
                  name="address"
                  type="text"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Full physical address"
                  disabled={saving}
                  className="edit-landlord-input"
                />
              </div>
            </div>
          </div>
          
          <div className="edit-landlord-form-section">
            <div className="edit-landlord-section-header">
              <h2 className="edit-landlord-section-title">
                <FaLock /> Change Password
              </h2>
              <button
                type="button"
                className="edit-landlord-toggle-password-btn"
                onClick={() => setShowPasswordFields(!showPasswordFields)}
              >
                {showPasswordFields ? "Hide Password Fields" : "Change Password"}
              </button>
            </div>
            
            {showPasswordFields && (
              <div className="edit-landlord-password-section">
                <div className="edit-landlord-form-group">
                  <label htmlFor="currentPassword" className="edit-landlord-label edit-landlord-required">CURRENT PASSWORD</label>
                  <div className="edit-landlord-password-input-wrapper">
                    <div className="edit-landlord-input-container">
                      <FaLock className="edit-landlord-input-icon" />
                      <input
                        id="currentPassword"
                        name="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        value={form.currentPassword}
                        onChange={handleChange}
                        placeholder="Enter current password"
                        required
                        disabled={saving}
                        className="edit-landlord-input"
                      />
                    </div>
                    <button
                      type="button"
                      className="edit-landlord-password-toggle"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  <p className="edit-landlord-helper-text">Admin's current password for verification</p>
                </div>
                
                <div className="edit-landlord-form-group">
                  <label htmlFor="newPassword" className="edit-landlord-label">NEW PASSWORD (OPTIONAL)</label>
                  <div className="edit-landlord-password-input-wrapper">
                    <div className="edit-landlord-input-container">
                      <FaLock className="edit-landlord-input-icon" />
                      <input
                        id="newPassword"
                        name="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={form.newPassword}
                        onChange={handleChange}
                        placeholder="Leave empty to keep current password"
                        disabled={saving}
                        className="edit-landlord-input"
                      />
                    </div>
                    <button
                      type="button"
                      className="edit-landlord-password-toggle"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  <p className="edit-landlord-helper-text">Minimum 6 characters</p>
                </div>
                
                <div className="edit-landlord-form-group">
                  <label htmlFor="confirmPassword" className="edit-landlord-label">
                    {form.newPassword ? "CONFIRM NEW PASSWORD" : "CONFIRM PASSWORD (OPTIONAL)"}
                  </label>
                  <div className="edit-landlord-password-input-wrapper">
                    <div className="edit-landlord-input-container">
                      <FaLock className="edit-landlord-input-icon" />
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={form.confirmPassword}
                        onChange={handleChange}
                        placeholder="Confirm the new password"
                        disabled={saving}
                        className="edit-landlord-input"
                      />
                    </div>
                    <button
                      type="button"
                      className="edit-landlord-password-toggle"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  {form.newPassword && (
                    <p className="edit-landlord-helper-text">Must match new password</p>
                  )}
                </div>
                
                <div className="edit-landlord-password-note">
                  <p><strong>Note:</strong> Password changes require admin authentication and may require special permissions in your Firebase setup.</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="edit-landlord-form-actions">
            <button 
              type="button" 
              className="edit-landlord-cancel-btn"
              onClick={handleCancel}
              disabled={saving}
            >
              <FaTimes /> Cancel
            </button>
            <button 
              type="submit" 
              className="edit-landlord-save-btn"
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="edit-landlord-spinner-small"></div>
                  Saving Changes...
                </>
              ) : (
                <>
                  <FaSave /> Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditLandlord;