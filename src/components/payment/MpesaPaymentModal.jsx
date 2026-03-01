import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Alert, Typography
} from '@mui/material';
import { collection, getDocs, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../pages/firebase/firebase';

const MpesaPaymentModal = ({ open, onClose, tenant }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tenantName, setTenantName] = useState(tenant?.name || '');
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [formData, setFormData] = useState({
    phoneNumber: tenant?.phone || '',
    amount: tenant?.monthlyRent || '',
    month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
    paymentType: 'rent',
    propertyId: tenant?.propertyId || '',
    unit: tenant?.unit || ''
  });

  // Reset state when a new tenant is passed in
  useEffect(() => {
    if (tenant) {
      setTenantName(tenant.name || '');
      setFormData(prev => ({
        ...prev,
        phoneNumber: tenant.phone || '',
        amount: tenant.monthlyRent || '',
        propertyId: tenant.propertyId || '',
        unit: tenant.unit || ''
      }));
      setSuccess('');
      setError('');
    } else if (open) {
      setTenantName('');
      setFormData(prev => ({
        ...prev,
        phoneNumber: '',
        amount: '',
        propertyId: '',
        unit: ''
      }));
      setSuccess('');
      setError('');
    }
  }, [tenant, open]);

  // Fetch available months for payment
  const [months, setMonths] = useState([formData.month]);

  // Fetch properties for walk-ins
  useEffect(() => {
    if (!tenant && open) {
      const fetchProperties = async () => {
        try {
          const snap = await getDocs(collection(db, 'properties'));
          const propsData = snap.docs.map(doc => ({ id: doc.id, name: doc.data().name || doc.id }));
          setProperties(propsData);
        } catch (err) {
          console.error("Error fetching properties:", err);
        }
      };
      fetchProperties();
    }
  }, [tenant, open]);

  // Fetch units when property changes
  useEffect(() => {
    if (!tenant && formData.propertyId) {
      const fetchUnits = async () => {
        try {
          const snap = await getDocs(collection(db, `properties/${formData.propertyId}/units`));
          const unitsData = snap.docs.map(doc => ({
            id: doc.id,
            unitName: doc.data().unitName || doc.data().unitNumber || doc.id
          }));
          setUnits(unitsData);
        } catch (err) {
          console.error("Error fetching units:", err);
        }
      };
      fetchUnits();
    } else {
      setUnits([]);
    }
  }, [tenant, formData.propertyId]);

  // Fetch tenant name from DB if it's missing or says "Unknown Tenant"
  useEffect(() => {
    const fetchTenantDetails = async () => {
      if (!tenant?.id) return;

      // If we don't have a good name, fetch it
      if (!tenantName || tenantName === 'Unknown Tenant' || tenantName === 'Loading...') {
        try {
          const tenantRef = doc(db, 'tenants', tenant.id);
          const tenantSnap = await getDoc(tenantRef);

          if (tenantSnap.exists()) {
            const data = tenantSnap.data();
            const realName = data.fullName || data.name;
            if (realName) {
              setTenantName(realName);
            }
          }
        } catch (err) {
          console.error('Error fetching tenant name:', err);
        }
      }
    };

    if (open) {
      fetchTenantDetails();
    }
  }, [open, tenant, tenantName]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'propertyId' ? { unit: '' } : {}) // Reset unit when property changes
    }));
  };

  const initiatePayment = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // Validation
      if (!formData.phoneNumber || !formData.amount || !formData.month || (!tenant && !tenantName.trim())) {
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
          tenantId: tenant?.id || 'walk-in',
          tenantName: tenantName || 'Walk-in',
          propertyName: properties.find(p => p.id === formData.propertyId)?.name || ''
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

          // Create admin notification
          try {
            await addDoc(collection(db, 'notifications'), {
              type: 'rent_payment',
              title: 'Payment Received',
              message: `Payment of ${formData.amount} for ${tenantName || 'Walk-in'} (${tenant?.unit || 'N/A'}) has been recorded.`,
              recipientId: 'admin',
              recipientType: 'admin',
              read: false,
              priority: 'high',
              metadata: {
                tenantId: tenant?.id || 'walk-in',
                amount: formData.amount,
                unit: tenant?.unit || 'N/A'
              },
              createdAt: serverTimestamp()
            });
          } catch (notifErr) {
            console.error('Failed to create notification', notifErr);
          }

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
          {tenantName || 'Walk-in'} - {tenant?.unit || 'No Unit'}
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

        {!tenant && (
          <>
            <TextField
              fullWidth
              margin="normal"
              label="Name / Reference"
              name="tenantName"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="e.g. John Doe - Walk In"
              required
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Property (Optional)</InputLabel>
              <Select
                name="propertyId"
                value={formData.propertyId}
                onChange={handleChange}
                label="Property (Optional)"
              >
                <MenuItem value=""><em>None</em></MenuItem>
                {properties.map(p => (
                  <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {formData.propertyId && (
              <FormControl fullWidth margin="normal">
                <InputLabel>Unit (Optional)</InputLabel>
                <Select
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  label="Unit (Optional)"
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {units.map(u => (
                    <MenuItem key={u.id} value={u.unitName}>{u.unitName}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </>
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