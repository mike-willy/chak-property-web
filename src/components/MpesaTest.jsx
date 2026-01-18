import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  TextField, 
  Typography, 
  Alert, 
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Paper
} from '@mui/material';
import { 
  CheckCircle, 
  Error, 
  Send, 
  Refresh, 
  Phone, 
  AttachMoney,
  Person,
  Home,
  CalendarMonth
} from '@mui/icons-material';

const MpesaTest = () => {
  const [backendStatus, setBackendStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);
  const [formData, setFormData] = useState({
    phoneNumber: '254712345678',
    amount: '1',
    tenantId: 'test-tenant-001',
    propertyId: 'test-property-001',
    unit: 'A1',
    month: 'January 2024',
    paymentType: 'rent'
  });

  // Check backend status on component mount
  useEffect(() => {
    checkBackendHealth();
  }, []);

  const checkBackendHealth = async () => {
    try {
      const response = await fetch('/health');
      const data = await response.json();
      setBackendStatus({ success: true, data });
    } catch (error) {
      setBackendStatus({ 
        success: false, 
        error: 'Cannot connect to backend server' 
      });
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleTestPayment = async () => {
    setLoading(true);
    setPaymentResult(null);
    
    try {
      const response = await fetch('/api/mpesa/pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setPaymentResult({ 
          success: true, 
          data,
          message: '✅ Payment initiated! Check your phone to complete.' 
        });
      } else {
        setPaymentResult({ 
          success: false, 
          error: data.error || 'Payment failed',
          details: data.details 
        });
      }
    } catch (error) {
      setPaymentResult({ 
        success: false, 
        error: 'Network error',
        details: error.message 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickTest = () => {
    setFormData({
      phoneNumber: '254712345678',
      amount: '1',
      tenantId: 'test-tenant-' + Date.now(),
      propertyId: 'test-property-001',
      unit: 'A1',
      month: 'January 2024',
      paymentType: 'rent'
    });
  };

  return (
    <Box sx={{ maxWidth: 800, margin: '0 auto', p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
        🚀 M-Pesa Integration Test
      </Typography>
      
      {/* Backend Status Card */}
      <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Backend Server Status
            </Typography>
            <Button 
              startIcon={<Refresh />}
              onClick={checkBackendHealth}
              variant="outlined"
              size="small"
            >
              Refresh
            </Button>
          </Box>
          
          {backendStatus ? (
            <Alert 
              severity={backendStatus.success ? "success" : "error"}
              icon={backendStatus.success ? <CheckCircle /> : <Error />}
            >
              {backendStatus.success ? (
                <>
                  <Typography variant="body1" fontWeight="bold">
                    ✅ Backend Connected Successfully
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Server: http://localhost:5000
                  </Typography>
                  {backendStatus.data && (
                    <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                      Message: {backendStatus.data.message} | 
                      Time: {new Date(backendStatus.data.timestamp).toLocaleTimeString()}
                    </Typography>
                  )}
                </>
              ) : (
                <Typography variant="body1">
                  ❌ Cannot connect to backend server. Make sure it's running on port 5000.
                </Typography>
              )}
            </Alert>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={24} />
              <Typography>Checking backend connection...</Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Payment Form */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📱 Test M-Pesa Payment
          </Typography>
          
          <Box component="form" sx={{ mt: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
              <TextField
                label="Phone Number"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                placeholder="254712345678"
                required
                fullWidth
                InputProps={{
                  startAdornment: <Phone sx={{ mr: 1, color: 'action.active' }} />,
                }}
                helperText="Format: 2547XXXXXXXX"
              />
              
              <TextField
                label="Amount (KSH)"
                name="amount"
                type="number"
                value={formData.amount}
                onChange={handleInputChange}
                placeholder="1000"
                required
                fullWidth
                InputProps={{
                  startAdornment: <AttachMoney sx={{ mr: 1, color: 'action.active' }} />,
                }}
                helperText="Use 1 KSH for testing"
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
              <TextField
                label="Tenant ID"
                name="tenantId"
                value={formData.tenantId}
                onChange={handleInputChange}
                placeholder="tenant-001"
                required
                fullWidth
                InputProps={{
                  startAdornment: <Person sx={{ mr: 1, color: 'action.active' }} />,
                }}
              />
              
              <TextField
                label="Property ID"
                name="propertyId"
                value={formData.propertyId}
                onChange={handleInputChange}
                placeholder="property-001"
                required
                fullWidth
                InputProps={{
                  startAdornment: <Home sx={{ mr: 1, color: 'action.active' }} />,
                }}
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2, mb: 3 }}>
              <TextField
                label="Unit"
                name="unit"
                value={formData.unit}
                onChange={handleInputChange}
                placeholder="A1"
                required
                fullWidth
              />
              
              <FormControl fullWidth>
                <InputLabel>Month</InputLabel>
                <Select
                  name="month"
                  value={formData.month}
                  onChange={handleInputChange}
                  label="Month"
                >
                  <MenuItem value="January 2024">January 2024</MenuItem>
                  <MenuItem value="February 2024">February 2024</MenuItem>
                  <MenuItem value="March 2024">March 2024</MenuItem>
                  <MenuItem value="April 2024">April 2024</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl fullWidth>
                <InputLabel>Payment Type</InputLabel>
                <Select
                  name="paymentType"
                  value={formData.paymentType}
                  onChange={handleInputChange}
                  label="Payment Type"
                >
                  <MenuItem value="rent">Rent</MenuItem>
                  <MenuItem value="deposit">Deposit</MenuItem>
                  <MenuItem value="maintenance">Maintenance</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Divider sx={{ my: 3 }} />

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleTestPayment}
                disabled={loading || !backendStatus?.success}
                startIcon={loading ? <CircularProgress size={20} /> : <Send />}
                size="large"
              >
                {loading ? 'Processing...' : 'Initiate M-Pesa Payment'}
              </Button>
              
              <Button
                variant="outlined"
                onClick={handleQuickTest}
                disabled={loading}
              >
                Fill Test Data
              </Button>
              
              <Button
                variant="text"
                onClick={() => {
                  setFormData({
                    phoneNumber: '',
                    amount: '',
                    tenantId: '',
                    propertyId: '',
                    unit: '',
                    month: 'January 2024',
                    paymentType: 'rent'
                  });
                  setPaymentResult(null);
                }}
              >
                Clear Form
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Payment Result */}
      {paymentResult && (
        <Card sx={{ 
          border: paymentResult.success ? '2px solid #4caf50' : '2px solid #f44336',
          bgcolor: paymentResult.success ? 'rgba(76, 175, 80, 0.05)' : 'rgba(244, 67, 54, 0.05)'
        }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ 
              color: paymentResult.success ? 'success.main' : 'error.main',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}>
              {paymentResult.success ? '✅ Success!' : '❌ Error'}
              {paymentResult.message || paymentResult.error}
            </Typography>
            
            {paymentResult.data && (
              <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Payment Response:
                </Typography>
                <Box component="pre" sx={{ 
                  overflow: 'auto', 
                  fontSize: '0.75rem',
                  p: 1,
                  bgcolor: 'grey.50',
                  borderRadius: 1
                }}>
                  {JSON.stringify(paymentResult.data, null, 2)}
                </Box>
                
                {paymentResult.data.checkoutId && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                    <Typography variant="body2" fontWeight="bold">
                      📋 Next Steps:
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      1. Check your phone for STK Push prompt
                    </Typography>
                    <Typography variant="body2">
                      2. Enter your M-Pesa PIN to complete payment
                    </Typography>
                    <Typography variant="body2">
                      3. Payment will be confirmed automatically
                    </Typography>
                    <Typography variant="caption" display="block" sx={{ mt: 1, fontStyle: 'italic' }}>
                      Checkout ID: {paymentResult.data.checkoutId}
                    </Typography>
                  </Box>
                )}
              </Paper>
            )}
            
            {paymentResult.details && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Details: {JSON.stringify(paymentResult.details)}
                </Typography>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📝 Testing Instructions
          </Typography>
          <Typography variant="body2" paragraph>
            1. <strong>Ensure backend is running</strong> (shown as connected above)
          </Typography>
          <Typography variant="body2" paragraph>
            2. <strong>Use test phone number</strong>: 254712345678 (Safaricom test number)
          </Typography>
          <Typography variant="body2" paragraph>
            3. <strong>Use amount 1 KSH</strong> for testing to avoid real charges
          </Typography>
          <Typography variant="body2" paragraph>
            4. <strong>Click "Initiate M-Pesa Payment"</strong> and check your test phone
          </Typography>
          <Typography variant="body2" paragraph>
            5. <strong>Complete payment</strong> on your phone when STK Push appears
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Note: This uses M-Pesa Sandbox. For production, you'll need real credentials from Safaricom.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default MpesaTest;