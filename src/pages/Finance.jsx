import React, { useState, useEffect } from 'react';
import {
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Typography,
  Box, Button, TextField, InputAdornment,
  IconButton, Select, MenuItem, FormControl,
  InputLabel, Grid, Card, CardContent,
  CircularProgress, Alert, Snackbar
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  Timestamp,
  where,
  getDocs 
} from 'firebase/firestore';
import { db } from '../pages/firebase/firebase';
import '../styles/paymentPage.css';

const PaymentPage = () => {
  // State
  const [payments, setPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [stats, setStats] = useState({
    totalCollected: 0,
    pendingPayments: 0,
    completedPayments: 0,
    totalPayments: 0
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // Real-time listener for payments
  useEffect(() => {
    const paymentsRef = collection(db, 'payments');
    const q = query(paymentsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const paymentsData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
            completedAt: data.completedAt?.toDate ? data.completedAt.toDate() : (data.completedAt ? new Date(data.completedAt) : null),
            transactionDate: data.transactionDate?.toDate ? data.transactionDate.toDate() : (data.transactionDate ? new Date(data.transactionDate) : null)
          };
        });
        
        setPayments(paymentsData);
        filterPayments(paymentsData);
        updateStatistics(paymentsData);
        setLoading(false);
        
        // Show notification for new payments
        if (paymentsData.length > payments.length) {
          const newPayments = paymentsData.length - payments.length;
          if (newPayments > 0) {
            setSnackbar({
              open: true,
              message: `🔄 ${newPayments} new payment(s) updated`,
              severity: 'info'
            });
          }
        }
      } catch (error) {
        console.error('Error processing snapshot:', error);
        setLoading(false);
      }
    }, (error) => {
      console.error('Firebase listener error:', error);
      setSnackbar({
        open: true,
        message: 'Connection error. Showing cached data.',
        severity: 'warning'
      });
      setLoading(false);
    });

    // Cleanup
    return () => unsubscribe();
  }, []);

  // Real-time listener for admin stats
  useEffect(() => {
    const statsRef = collection(db, 'adminStats');
    const statsQuery = query(statsRef, where('id', '==', 'dashboard'));
    
    const unsubscribeStats = onSnapshot(statsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const statsData = snapshot.docs[0].data();
        setStats({
          totalCollected: statsData.totalCollected || 0,
          pendingPayments: statsData.pendingPayments || 0,
          completedPayments: statsData.completedPayments || 0,
          totalPayments: statsData.totalTransactions || 0
        });
      }
    });
    
    return () => unsubscribeStats();
  }, []);

  // Filter payments
  useEffect(() => {
    filterPayments();
  }, [searchTerm, statusFilter, monthFilter]);

  const filterPayments = (data = payments) => {
    let filtered = [...data];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(payment =>
        (payment.tenantId && payment.tenantId.toLowerCase().includes(term)) ||
        (payment.tenantName && payment.tenantName.toLowerCase().includes(term)) ||
        (payment.mpesaCode && payment.mpesaCode.toLowerCase().includes(term)) ||
        (payment.phoneNumber && payment.phoneNumber.toLowerCase().includes(term)) ||
        (payment.month && payment.month.toLowerCase().includes(term))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(payment => payment.status === statusFilter);
    }

    // Month filter
    if (monthFilter !== 'all') {
      filtered = filtered.filter(payment => payment.month === monthFilter);
    }

    setFilteredPayments(filtered);
  };

  const updateStatistics = (paymentsData) => {
    const completedAmount = paymentsData
      .filter(p => p.status === 'completed')
      .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    
    const pendingCount = paymentsData.filter(p => p.status === 'pending').length;
    const completedCount = paymentsData.filter(p => p.status === 'completed').length;
    const totalCount = paymentsData.length;

    // Update local stats if adminStats not available
    setStats(prev => ({
      ...prev,
      totalCollected: completedAmount,
      pendingPayments: pendingCount,
      completedPayments: completedCount,
      totalPayments: totalCount
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'pending': return 'warning';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const formatCurrency = (amount) => {
    const numAmount = Number(amount) || 0;
    return `KSh ${numAmount.toLocaleString('en-KE')}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    if (date instanceof Timestamp) {
      date = date.toDate();
    } else if (typeof date === 'string') {
      date = new Date(date);
    }
    
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleExport = () => {
    const headers = ['Tenant ID', 'Tenant Name', 'Month', 'Amount', 'Status', 'M-Pesa Code', 'Date', 'Phone'];
    const csvData = filteredPayments.map(p => [
      p.tenantId || 'N/A',
      p.tenantName || 'N/A',
      p.month || 'N/A',
      p.amount || 0,
      p.status || 'N/A',
      p.mpesaCode || 'N/A',
      formatDate(p.completedAt || p.createdAt),
      p.phoneNumber?.replace('254', '0') || 'N/A'
    ].join(','));
    
    const csv = [headers.join(','), ...csvData].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    setSnackbar({
      open: true,
      message: `Exported ${filteredPayments.length} payments`,
      severity: 'success'
    });
  };

  const getUniqueMonths = () => {
    const months = payments
      .map(p => p.month)
      .filter(Boolean)
      .sort((a, b) => {
        const monthsOrder = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        return monthsOrder.indexOf(a) - monthsOrder.indexOf(b);
      });
    return [...new Set(months)];
  };

  const viewPaymentDetails = (payment) => {
    setSnackbar({
      open: true,
      message: `Viewing payment ${payment.mpesaCode || payment.id}`,
      severity: 'info'
    });
    // You can implement a modal here
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <div className="payment-page">
      {/* Header */}
      <Box className="page-header">
        <Box>
          <Typography variant="h4" fontWeight="bold" className="page-title">
            <PaymentIcon className="header-icon" sx={{ mr: 1 }} />
            CHAK Estates Payments
            <Chip 
              label="LIVE" 
              color="success" 
              size="small" 
              sx={{ ml: 2, fontSize: '0.7rem' }}
            />
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Real-time payment monitoring dashboard
          </Typography>
        </Box>
        <Box className="header-actions">
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={filteredPayments.length === 0}
            sx={{ mr: 1 }}
          >
            Export CSV
          </Button>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={() => window.location.reload()}
          >
            Reload
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#e8f5e9', height: '100%' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Total Collected
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                {formatCurrency(stats.totalCollected)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                All time revenue
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#fff3e0', height: '100%' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Pending Payments
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="warning.main">
                {stats.pendingPayments}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Awaiting completion
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#e3f2fd', height: '100%' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Completed Payments
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="info.main">
                {stats.completedPayments}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Successful transactions
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#f5f5f5', height: '100%' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Total Payments
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {stats.totalPayments}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                All transactions
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={5}>
            <TextField
              fullWidth
              placeholder="Search properties, tenants, applications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Month</InputLabel>
              <Select
                value={monthFilter}
                label="Month"
                onChange={(e) => setMonthFilter(e.target.value)}
              >
                <MenuItem value="all">All Months</MenuItem>
                {getUniqueMonths().map((month, index) => (
                  <MenuItem key={index} value={month}>{month}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={1}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setMonthFilter('all');
              }}
            >
              CLEAR
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Payments Table */}
      <Paper sx={{ p: 0, overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell><strong>Tenant ID</strong></TableCell>
                <TableCell><strong>Month</strong></TableCell>
                <TableCell><strong>Amount</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>M-Pesa Code</strong></TableCell>
                <TableCell><strong>Date</strong></TableCell>
                <TableCell><strong>Phone</strong></TableCell>
                <TableCell><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                    <CircularProgress />
                    <Typography sx={{ mt: 2 }}>Loading live payments...</Typography>
                  </TableCell>
                </TableRow>
              ) : filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                    <Typography color="text.secondary">
                      No payments found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => (
                  <TableRow 
                    key={payment.id} 
                    hover
                    sx={{ 
                      '&:hover': { bgcolor: '#fafafa' },
                      borderBottom: '1px solid #e0e0e0'
                    }}
                  >
                    <TableCell>
                      <Typography fontWeight="500" fontSize="0.9rem">
                        {payment.tenantId || 'N/A'}
                      </Typography>
                      {payment.tenantName && (
                        <Typography variant="caption" color="text.secondary">
                          {payment.tenantName}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{payment.month || 'N/A'}</TableCell>
                    <TableCell>
                      <Typography fontWeight="bold" color="primary.main">
                        {formatCurrency(payment.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={payment.status || 'unknown'}
                        color={getStatusColor(payment.status)}
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                    </TableCell>
                    <TableCell>
                      {payment.mpesaCode ? (
                        <Chip
                          label={payment.mpesaCode}
                          size="small"
                          variant="outlined"
                          sx={{ fontFamily: 'monospace' }}
                        />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Pending
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {formatDate(payment.completedAt || payment.createdAt)}
                    </TableCell>
                    <TableCell>
                      {payment.phoneNumber ? 
                        payment.phoneNumber.replace('254', '0') : 'N/A'
                      }
                    </TableCell>
                    <TableCell>
                      <IconButton 
                        size="small" 
                        title="View Details"
                        onClick={() => viewPaymentDetails(payment)}
                        sx={{ mr: 1 }}
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                      {payment.mpesaCode && (
                        <IconButton size="small" title="Download Receipt">
                          <ReceiptIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Live Update Indicator */}
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          ⚡ Live updates enabled • Last updated: {new Date().toLocaleTimeString()}
        </Typography>
      </Box>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default PaymentPage;