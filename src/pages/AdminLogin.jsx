import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Grid,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Container,
  CssBaseline,
  createTheme,
  ThemeProvider,
  Avatar
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  LockOutlined,
  AdminPanelSettings
} from '@mui/icons-material';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../pages/firebase/firebase";

// Create a custom theme for the admin login
const theme = createTheme({
  palette: {
    primary: {
      main: '#1a237e', // Deep Blue
    },
    secondary: {
      main: '#c62828', // Red for errors/alerts
    },
    background: {
      default: '#f4f6f8',
    },
  },
  typography: {
    fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
      color: '#1a237e',
    },
    h6: {
      fontWeight: 600,
    }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          padding: '12px 24px',
          borderRadius: '8px',
          fontWeight: 600,
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: '16px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          marginBottom: '20px',
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
          }
        }
      }
    }
  },
});

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Security: Rate Limiting
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer;
    if (lockoutTime) {
      setCountdown(Math.ceil((lockoutTime - Date.now()) / 1000));
      timer = setInterval(() => {
        const remaining = Math.ceil((lockoutTime - Date.now()) / 1000);
        if (remaining <= 0) {
          setLockoutTime(null);
          setFailedAttempts(0);
          setError("");
          setCountdown(0);
          clearInterval(timer);
        } else {
          setCountdown(remaining);
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutTime]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (lockoutTime) return;

    setError("");
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);

      const userDoc = await getDoc(doc(db, "users", cred.user.uid));

      if (!userDoc.exists()) {
        throw new Error("Invalid email or password");
      }

      const userData = userDoc.data();

      // Strict Role Check
      if (userData.role !== "admin") {
        await auth.signOut();
        throw new Error("Access denied. Administrator privileges required.");
      }

      // CRITICAL: Verify/Create admin in admins collection
      const adminDoc = await getDoc(doc(db, "admins", cred.user.uid));

      if (!adminDoc.exists()) {
        // Create admin entry if missing (Safety net for first-time setup or migration)
        await setDoc(doc(db, "admins", cred.user.uid), {
          userId: cred.user.uid,
          email: userData.email || email,
          adminLevel: "super", // Default to super for first admin, consider changing logic if multiple levels
          permissions: ["all"],
          createdAt: new Date(),
          lastLogin: new Date(),
          displayName: userData.displayName || "Administrator",
          role: "admin"
        });
      } else {
        // Update last login
        await updateDoc(doc(db, "admins", cred.user.uid), {
          lastLogin: new Date()
        });
      }

      navigate("/"); // Redirect to Dashboard
    } catch (err) {
      console.error("Login Error:", err);
      // Security: Sanitize error messages
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("Invalid email or password");
      } else {
        setError(err.message);
      }

      // Rate Limiting Logic
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= 3) {
        const lockoutDuration = 30 * 1000; // 30 seconds
        setLockoutTime(Date.now() + lockoutDuration);
        setError(`Too many failed attempts. Please try again in 30 seconds.`);
      }
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

  const toggleResetMode = () => {
    setResetMode(!resetMode);
    setResetSent(false);
    setError("");
    setPassword("");
  };

  return (
    <ThemeProvider theme={theme}>
      <Grid
        container
        component="main"
        sx={{
          height: '100vh',
          overflow: 'auto',
          backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)', // Darker, unified background
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2
        }}
      >
        <CssBaseline />

        <Container maxWidth="lg" sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' }, // Stack on mobile, row on desktop
              gap: { xs: 3, md: 4 }, // Gap between cards
              alignItems: 'stretch',
              width: '100%',
              maxWidth: '1000px'
            }}
          >
            {/* Card 1: Branding / Hero */}
            <Paper
              elevation={24}
              sx={{
                flex: 1,
                borderRadius: '24px',
                overflow: 'hidden',
                position: 'relative',
                backgroundImage: 'linear-gradient(135deg, #1e3a8a 0%, #0d1b42 100%)',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                p: { xs: 4, md: 6 },
                minHeight: { xs: '300px', md: '600px' },
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: 'url("https://source.unsplash.com/random?office,architecture")',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.15,
                zIndex: 0,
                mixBlendMode: 'overlay'
              }} />

              <Box sx={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                <Box
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.1)',
                    p: 2,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    mb: 4,
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
                  }}
                >
                  <AdminPanelSettings sx={{ fontSize: 60, color: 'white' }} />
                </Box>

                <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 800, letterSpacing: 1, textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
                  Jesma Investments
                </Typography>
                <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 300, mb: 6, letterSpacing: 0.5 }}>
                  Administrative Control Center
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                  <Box sx={{
                    bgcolor: 'rgba(255,255,255,0.1)',
                    py: 1.5,
                    px: 3,
                    borderRadius: '50px',
                    backdropFilter: 'blur(5px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5
                  }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#4ade80', boxShadow: '0 0 10px #4ade80' }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, letterSpacing: 0.5 }}>Secure Admin Access</Typography>
                  </Box>
                  <Box sx={{
                    bgcolor: 'rgba(255,255,255,0.1)',
                    py: 1.5,
                    px: 3,
                    borderRadius: '50px',
                    backdropFilter: 'blur(5px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5
                  }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#60a5fa', boxShadow: '0 0 10px #60a5fa' }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, letterSpacing: 0.5 }}>Real-time Analytics</Typography>
                  </Box>
                </Box>
              </Box>

              <Typography variant="caption" sx={{ position: 'absolute', bottom: 30, opacity: 0.6, zIndex: 1, letterSpacing: 1 }}>
                © {new Date().getFullYear()} CHAK Property System
              </Typography>
            </Paper>

            {/* Card 2: Login Form */}
            <Paper
              elevation={24}
              sx={{
                flex: 1,
                borderRadius: '24px',
                bgcolor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                p: { xs: 4, md: 6 },
                position: 'relative',
                boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.5)'
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: '100%',
                  maxWidth: '400px'
                }}
              >
                <Avatar sx={{ m: 1, bgcolor: 'primary.main', width: 64, height: 64, boxShadow: '0 4px 14px rgba(26, 35, 126, 0.4)' }}>
                  <LockOutlined sx={{ fontSize: 32 }} />
                </Avatar>

                <Typography component="h1" variant="h4" sx={{ mb: 1, fontWeight: 700, color: '#1e293b' }}>
                  {resetMode ? "Reset Password" : "Admin Login"}
                </Typography>

                <Typography variant="body1" color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
                  {resetMode ? "Enter your email to receive reset instructions" : "Welcome back. Please sign in to your account."}
                </Typography>

                {error && (
                  <Alert severity="error" sx={{ width: '100%', mb: 3, borderRadius: '12px', boxShadow: '0 2px 8px rgba(211, 47, 47, 0.1)' }}>
                    {error}
                  </Alert>
                )}

                {lockoutTime && (
                  <Alert severity="warning" sx={{ width: '100%', mb: 3, borderRadius: '12px' }}>
                    System locked due to too many failed attempts. Try again in {countdown}s.
                  </Alert>
                )}

                {resetSent && (
                  <Alert severity="success" sx={{ width: '100%', mb: 3, borderRadius: '12px' }}>
                    Password reset link sent to <strong>{email}</strong>. Check your inbox.
                  </Alert>
                )}

                {!resetSent && (
                  <Box component="form" noValidate onSubmit={resetMode ? handleResetPassword : handleLogin} sx={{ mt: 1, width: '100%' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#475569', mb: 0.5, ml: 0.5 }}>
                      Email Address <span style={{ color: '#ef4444' }}>*</span>
                    </Typography>
                    <TextField
                      required
                      fullWidth
                      id="email"
                      placeholder="agent@chakestates.com"
                      name="email"
                      autoComplete="email"
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading || !!lockoutTime}
                      sx={{
                        mb: 3,
                        '& .MuiOutlinedInput-root': {
                          bgcolor: '#f8fafc',
                          transition: 'all 0.2s',
                          '&:hover': { bgcolor: '#f1f5f9' },
                          '&.Mui-focused': { bgcolor: '#fff', boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.1)' }
                        }
                      }}
                      InputProps={{
                        startAdornment: <InputAdornment position="start" sx={{ color: '#94a3b8' }}>@</InputAdornment>,
                      }}
                    />

                    {!resetMode && (
                      <>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#475569', mb: 0.5, ml: 0.5 }}>
                          Password <span style={{ color: '#ef4444' }}>*</span>
                        </Typography>
                        <TextField
                          required
                          fullWidth
                          name="password"
                          placeholder="••••••••••••"
                          type={showPassword ? 'text' : 'password'}
                          id="password"
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={loading || !!lockoutTime}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              bgcolor: '#f8fafc',
                              transition: 'all 0.2s',
                              '&:hover': { bgcolor: '#f1f5f9' },
                              '&.Mui-focused': { bgcolor: '#fff', boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.1)' }
                            }
                          }}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  aria-label="toggle password visibility"
                                  onClick={() => setShowPassword(!showPassword)}
                                  edge="end"
                                  sx={{ color: '#94a3b8' }}
                                >
                                  {showPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                        />
                      </>
                    )}

                    <Button
                      type="submit"
                      fullWidth
                      variant="contained"
                      disabled={loading || !!lockoutTime}
                      sx={{
                        mt: 4,
                        mb: 3,
                        py: 1.8,
                        fontSize: '1rem',
                        background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
                        textTransform: 'none',
                        letterSpacing: 0.5,
                        boxShadow: '0 10px 20px -5px rgba(30, 58, 138, 0.4)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #1e40af 0%, #172554 100%)',
                          boxShadow: '0 15px 30px -5px rgba(30, 58, 138, 0.5)',
                          transform: 'translateY(-2px)'
                        },
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {loading ? <CircularProgress size={24} color="inherit" /> : (resetMode ? "Send Reset Link" : "Sign In")}
                    </Button>

                    <Grid container justifyContent="center">
                      <Grid item>
                        <Button
                          onClick={toggleResetMode}
                          variant="text"
                          size="small"
                          disabled={loading || !!lockoutTime}
                          sx={{ color: '#64748b', fontWeight: 500 }}
                        >
                          {resetMode ? "← Back to Login" : "Forgot password?"}
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                )}
              </Box>
            </Paper>
          </Box>
        </Container>
      </Grid>
    </ThemeProvider>
  );
}