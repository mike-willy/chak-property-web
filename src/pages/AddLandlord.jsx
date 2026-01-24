// src/pages/AddLandlord.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../pages/firebase/firebase";
import "../styles/AddLandlord.css";

const AddLandlord = () => {
  const navigate = useNavigate();
  
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    address: "",
    company: ""
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
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
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    const adminPassword = prompt("Enter your ADMIN password to continue:");
    if (!adminPassword) {
      setError("Admin password required");
      return;
    }
    
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const adminUser = auth.currentUser;
      if (!adminUser) {
        throw new Error("Admin login required");
      }
      
      const adminEmail = adminUser.email;
      const adminUid = adminUser.uid;
      
      const fullName = `${form.firstName} ${form.lastName}`.trim();
      
      // 1. Create landlord auth account
      const cred = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );

      const landlordUid = cred.user.uid;
      
      // 2. Re-authenticate as admin (stay on admin account)
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      
      // 3. Create landlord document
      const landlordData = {
        uid: landlordUid,
        firstName: form.firstName,
        lastName: form.lastName,
        name: fullName,
        email: form.email,
        phone: form.phone,
        address: form.address || "",
        company: form.company || "",
        role: "landlord",
        createdAt: serverTimestamp(),
        createdBy: adminUid,
        createdByEmail: adminEmail,
        properties: [],
        totalProperties: 0,
        activeProperties: 0,
        status: "active",
        lastLogin: null,
        updatedAt: serverTimestamp(),
        passwordChangeable: true // Landlord can change password later
      };
      
      await setDoc(doc(db, "landlords", landlordUid), landlordData);
      
      // Clear form
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        password: "",
        address: "",
        company: ""
      });
      
      setSuccess(`
        ✅ Landlord Registered Successfully!
        
        Name: ${fullName}
        Email: ${form.email}
        Phone: ${form.phone}
        ID: ${landlordUid}
        
        Landlord can:
        1. Login with the password you set
        2. Change password later in mobile app
        3. Access assigned properties
        
        Redirecting to landlords list...
      `);
      
      setTimeout(() => {
        navigate("/landlords");
      }, 4000);
      
    } catch (error) {
      let errorMessage = "Registration failed";
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "Email already registered";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Invalid email";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "Password too weak (min 6 chars)";
      } else if (error.code === 'permission-denied') {
        errorMessage = "Permission denied. Check security rules.";
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = "Incorrect admin password";
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate("/landlords");
  };

  return (
    <div className="add-landlord-container">
      <div className="add-landlord-header">
        <h1>Register New Landlord</h1>
        <button className="back-button" onClick={handleCancel}>
          ← Back to Landlords
        </button>
      </div>
      
      <div className="add-landlord-card">
        {success && (
          <div className="success-message">
            <span className="success-icon">✅</span>
            <div className="success-content">
              {success.split('\n').map((line, index) => (
                <div key={index}>{line}</div>
              ))}
            </div>
          </div>
        )}
        
        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            <div className="error-content">
              {error}
            </div>
          </div>
        )}
        
        {!success && (
          <>
            <h2>Landlord Details</h2>
            <p>Fill in landlord information</p>
            
            <form onSubmit={handleSubmit} className="add-landlord-form">
              <div className="form-row">
                <div className="form-group half">
                  <label>First Name *</label>
                  <input
                    name="firstName"
                    type="text"
                    value={form.firstName}
                    onChange={handleChange}
                    placeholder="John"
                    required
                    disabled={loading}
                  />
                </div>
                
                <div className="form-group half">
                  <label>Last Name *</label>
                  <input
                    name="lastName"
                    type="text"
                    value={form.lastName}
                    onChange={handleChange}
                    placeholder="Doe"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group half">
                  <label>Email *</label>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="landlord@example.com"
                    required
                    disabled={loading}
                  />
                </div>
                
                <div className="form-group half">
                  <label>Phone *</label>
                  <input
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+254 712 345 678"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group half">
                  <label>Company</label>
                  <input
                    name="company"
                    type="text"
                    value={form.company}
                    onChange={handleChange}
                    placeholder="Company name"
                    disabled={loading}
                  />
                </div>
                
                <div className="form-group half">
                  <label>Password *</label>
                  <input
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Min. 6 characters"
                    required
                    disabled={loading}
                  />
                  <small>Landlord can change this later</small>
                </div>
              </div>
              
              <div className="form-group">
                <label>Address</label>
                <input
                  name="address"
                  type="text"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Physical address"
                  disabled={loading}
                />
              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-button" 
                  onClick={handleCancel}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="submit-button"
                  disabled={loading}
                >
                  {loading ? 'Registering...' : 'Register Landlord'}
                </button>
              </div>
            </form>
            
            <div className="info-section">
              <h3>Notes:</h3>
              <ul>
                <li>Admin sets initial password</li>
                <li>Landlord can change password in mobile app</li>
                <li>Data stored in 'landlords' collection</li>
                <li>Admin password required for confirmation</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AddLandlord;