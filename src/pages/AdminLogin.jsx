import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../pages/firebase/firebase";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaBuilding, FaLock, FaEnvelope, FaSignInAlt, FaEye, FaEyeSlash } from "react-icons/fa";
import "../styles/AdminLogin.css";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);

      const userDoc = await getDoc(doc(db, "users", cred.user.uid));

      if (!userDoc.exists()) {
        throw new Error("No user record found");
      }

      if (userDoc.data().role !== "admin") {
        await auth.signOut();
        throw new Error("Access denied. Admins only.");
      }

      // CRITICAL: Verify/Create admin in admins collection
      const adminDoc = await getDoc(doc(db, "admins", cred.user.uid));
      
      // If admin doesn't exist in admins collection, create it
      if (!adminDoc.exists()) {
        // Create admin entry in admins collection
        await setDoc(doc(db, "admins", cred.user.uid), {
          userId: cred.user.uid,
          email: userDoc.data().email || email,
          adminLevel: "super",
          permissions: ["all"],
          createdAt: new Date(),
          lastLogin: new Date(),
          displayName: userDoc.data().displayName || "Administrator",
          role: "admin" // Keep role field for consistency
        });
      } else {
        // Update last login
        await updateDoc(doc(db, "admins", cred.user.uid), {
          lastLogin: new Date()
        });
      }

      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!email) {
      setError("Please enter your email address");
      return;
    }
    
    setLoading(true);
    
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleResetMode = () => {
    setResetMode(!resetMode);
    setResetSent(false);
    setError("");
    setPassword("");
  };

  return (
    <div className="login-container">
      {/* Left Side - Branding */}
      <div className="login-left">
        <div className="brand-section">
          <div className="brand-logo">
            <FaBuilding size={48} />
          </div>
          <h1 className="brand-title">CHAK Estates</h1>
          <p className="brand-tagline">Administrative Control Panel</p>
        </div>

        <div className="features">
          <div className="feature">
            <div className="feature-icon">🔐</div>
            <div className="feature-text">Secure Admin Access</div>
          </div>
          <div className="feature">
            <div className="feature-icon">📊</div>
            <div className="feature-text">Real-time Analytics</div>
          </div>
          <div className="feature">
            <div className="feature-icon">🏢</div>
            <div className="feature-text">Full System Control</div>
          </div>
        </div>

        <div className="security-notice">
          <FaLock size={14} />
          <span>Restricted Access • Authorized Personnel Only</span>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="login-right">
        <div className="login-card">
          <div className="login-header">
            <h2>{resetMode ? (resetSent ? "Check Your Email" : "Reset Password") : "Admin Login"}</h2>
            <p>
              {resetMode 
                ? (resetSent 
                  ? "Password reset link has been sent to your email" 
                  : "Enter your email to reset password")
                : "Access the property management system"}
            </p>
          </div>

          {resetSent ? (
            <div className="reset-success">
              <div className="success-icon">✅</div>
              <h3>Check Your Email</h3>
              <p>We've sent a password reset link to <strong>{email}</strong></p>
              <p className="reset-instructions">
                Please check your inbox and follow the instructions to reset your password.
              </p>
              <button 
                className="back-to-login-btn"
                onClick={toggleResetMode}
              >
                Back to Login
              </button>
            </div>
          ) : (
            <form onSubmit={resetMode ? handleResetPassword : handleLogin} className="login-form">
              {error && <div className="error-alert">{error}</div>}

              <div className="form-group">
                <label className="form-label">
                  <FaEnvelope className="input-icon" />
                  Admin Email
                </label>
                <input
                  type="email"
                  placeholder="agent@jesma.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                  required
                  disabled={loading}
                />
              </div>

              {!resetMode && (
                <div className="form-group">
                  <label className="form-label">
                    <FaLock className="input-icon" />
                    Password
                  </label>
                  <div className="password-input-wrapper">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="form-input password-input"
                      required
                      disabled={loading}
                    />
                    <button 
                      type="button"
                      className="toggle-password-btn"
                      onClick={togglePasswordVisibility}
                      disabled={loading}
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>
              )}

              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    {resetMode ? "Sending Reset Link..." : "Authenticating..."}
                  </>
                ) : (
                  <>
                    <FaSignInAlt />
                    {resetMode ? "Send Reset Link" : "Login"}
                  </>
                )}
              </button>
            </form>
          )}

          <div className="login-footer">
            <div className="forgot-password">
              {resetMode && !resetSent ? (
                <button 
                  className="forgot-link"
                  onClick={toggleResetMode}
                  disabled={loading}
                >
                  ← Back to Login
                </button>
              ) : !resetMode ? (
                <button 
                  className="forgot-link"
                  onClick={toggleResetMode}
                  disabled={loading}
                >
                  Forgot Password?
                </button>
              ) : null}
            </div>
            
            <div className="security-info">
              <div className="security-item">
                <FaLock size={12} />
                <span>Firebase Secure Authentication</span>
              </div>
              <div className="security-item">
                <FaBuilding size={12} />
                <span>Role-Based Access Control</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}