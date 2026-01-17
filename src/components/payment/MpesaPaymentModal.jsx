import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Alert, Typography
} from '@mui/material';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../pages/firebase';

const MpesaPaymentModal = ({ open, onClose, tenant }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    phoneNumber: tenant?.phone || '',
    amount: tenant?.monthlyRent || '',
    month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
    paymentType: 'rent',
    propertyId: tenant?.propertyId || '',
    unit: tenant?.unit || ''
  });

  // Fetch available months for payment
  const [months, setMonths] = useState([formData.month]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const initiatePayment = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // Validation
      if (!formData.phoneNumber || !formData.amount || !formData.month) {
        setError('Please fill all required fields');
        setLoading(false);
        return;
      }

      // Call backend API
      const response = await fetch('http://localhost:5000/api/mpesa/pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          tenantId: tenant.id
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Payment initiated! Check your phone to complete.');
        // Start polling for payment status
        pollPaymentStatus(data.checkoutId);
      } else {
        setError(data.error || 'Payment initiation failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Payment error:', err);
    } finally {
      setLoading(false);
    }
  };

  const pollPaymentStatus = async (checkoutId) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/mpesa/status/${checkoutId}`);
        const payment = await response.json();
        
        if (payment.status === 'completed') {
          clearInterval(pollInterval);
          setSuccess('Payment completed successfully!');
          // Refresh page or update UI after 3 seconds
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000); // Poll every 3 seconds

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 300000);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h6" fontWeight="bold">
          M-Pesa Payment
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {tenant?.name} - {tenant?.unit}
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <FormControl fullWidth margin="normal">
          <InputLabel>Payment Type</InputLabel>
          <Select
            name="paymentType"
            value={formData.paymentType}
            onChange={handleChange}
            label="Payment Type"
          >
            <MenuItem value="rent">Monthly Rent</MenuItem>
            <MenuItem value="deposit">Security Deposit</MenuItem>
            <MenuItem value="other">Other Payment</MenuItem>
          </Select>
        </FormControl>

        <TextField
          fullWidth
          margin="normal"
          label="Phone Number"
          name="phoneNumber"
          value={formData.phoneNumber}
          onChange={handleChange}
          placeholder="0712345678"
          required
        />

        <TextField
          fullWidth
          margin="normal"
          label="Amount (KSh)"
          name="amount"
          type="number"
          value={formData.amount}
          onChange={handleChange}
          required
        />

        <FormControl fullWidth margin="normal">
          <InputLabel>Month</InputLabel>
          <Select
            name="month"
            value={formData.month}
            onChange={handleChange}
            label="Month"
          >
            {months.map((month, index) => (
              <MenuItem key={index} value={month}>
                {month}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Instructions:
          <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li>Enter your M-Pesa registered phone number</li>
            <li>Click "Pay Now" to receive STK Push</li>
            <li>Enter your M-Pesa PIN on your phone</li>
            <li>Wait for confirmation</li>
          </ol>
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={initiatePayment}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'Processing...' : 'Pay Now'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MpesaPaymentModal;