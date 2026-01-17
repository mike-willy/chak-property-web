import React, { useState, useEffect } from 'react';
import {
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Typography,
  Box, Button, TextField, InputAdornment,
  IconButton, Select, MenuItem, FormControl,
  InputLabel, Grid, Card, CardContent
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon
} from '@mui/icons-material';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../pages/firebase/firebase';
import '../styles/paymentPage.css';

const PaymentPage = () => {
  const [payments, setPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');

  // Fetch all payments
  useEffect(() => {
    fetchPayments();
  }, []);

  // Filter payments when search/filters change
  useEffect(() => {
    filterPayments();
  }, [searchTerm, statusFilter, monthFilter, payments]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const paymentsRef = collection(db, 'payments');
      const q = query(paymentsRef, orderBy('createdAt', 'desc'));
      
      const snapshot = await getDocs(q);
      const paymentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore timestamps to Date objects
        createdAt: doc.data().createdAt?.toDate(),
        completedAt: doc.data().completedAt?.toDate()
      }));
      
      setPayments(paymentsData);
      setFilteredPayments(paymentsData);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterPayments = () => {
    let filtered = [...payments];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(payment =>
        payment.tenantId?.toLowerCase().includes(term) ||
        payment.mpesaCode?.toLowerCase().includes(term) ||
        payment.phoneNumber?.toLowerCase().includes(term) ||
        payment.month?.toLowerCase().includes(term)
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

  // Calculate statistics
  const calculateStats = () => {
    const totalAmount = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const completedAmount = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, payment) => sum + (payment.amount || 0), 0);
    
    const completedCount = payments.filter(p => p.status === 'completed').length;
    const pendingCount = payments.filter(p => p.status === 'pending').length;

    return { totalAmount, completedAmount, completedCount, pendingCount };
  };

  const stats = calculateStats();

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'pending': return 'warning';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const formatCurrency = (amount) => {
    return `KSh ${amount?.toLocaleString() || 0}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleExport = () => {
    // Simple CSV export
    const headers = ['Tenant ID', 'Month', 'Amount', 'Status', 'M-Pesa Code', 'Date'];
    const csvData = filteredPayments.map(p => [
      p.tenantId,
      p.month,
      p.amount,
      p.status,
      p.mpesaCode || 'N/A',
      formatDate(p.createdAt)
    ].join(','));
    
    const csv = [headers.join(','), ...csvData].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Get unique months for filter
  const uniqueMonths = [...new Set(payments.map(p => p.month).filter(Boolean))].sort();

  return (
    <div className="payment-page">
      {/* Header */}
      <Box className="page-header">
        <Typography variant="h4" fontWeight="bold" className="page-title">
          <PaymentIcon className="header-icon" />
          Payment Management
        </Typography>
        <Box className="header-actions">
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            className="export-btn"
          >
            Export
          </Button>
          <Button
            variant="contained"
            startIcon={<ReceiptIcon />}
            className="refresh-btn"
            onClick={fetchPayments}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} className="stats-grid">
        <Grid item xs={12} sm={6} md={3}>
          <Card className="stat-card total-revenue">
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Collected
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {formatCurrency(stats.completedAmount)}
              </Typography>
              <Typography variant="caption" className="stat-change">
                All time revenue
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card className="stat-card pending-payments">
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Pending Payments
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {stats.pendingCount}
              </Typography>
              <Typography variant="caption" className="stat-change">
                Awaiting completion
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card className="stat-card completed-payments">
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Completed Payments
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {stats.completedCount}
              </Typography>
              <Typography variant="caption" className="stat-change">
                Successful transactions
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card className="stat-card total-payments">
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Payments
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {payments.length}
              </Typography>
              <Typography variant="caption" className="stat-change">
                All transactions
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper className="filters-section">
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search payments..."
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
                {uniqueMonths.map((month, index) => (
                  <MenuItem key={index} value={month}>{month}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FilterIcon />}
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setMonthFilter('all');
              }}
            >
              Clear Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Payments Table */}
      <Paper className="payments-table-section">
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow className="table-header">
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
                  <TableCell colSpan={8} align="center" className="loading-cell">
                    <div className="loading-spinner"></div>
                    <Typography>Loading payments...</Typography>
                  </TableCell>
                </TableRow>
              ) : filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" className="empty-cell">
                    <Typography color="text.secondary">
                      No payments found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => (
                  <TableRow key={payment.id} hover className="payment-row">
                    <TableCell>
                      <Typography fontWeight="500">
                        {payment.tenantId}
                      </Typography>
                    </TableCell>
                    <TableCell>{payment.month}</TableCell>
                    <TableCell>
                      <Typography fontWeight="bold" color="primary.main">
                        {formatCurrency(payment.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={payment.status}
                        color={getStatusColor(payment.status)}
                        size="small"
                        className="status-chip"
                      />
                    </TableCell>
                    <TableCell>
                      {payment.mpesaCode ? (
                        <Chip
                          label={payment.mpesaCode}
                          size="small"
                          variant="outlined"
                          className="mpesa-chip"
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
                      {payment.phoneNumber?.replace('254', '0') || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" title="View Details">
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
    </div>
  );
};

export default PaymentPage;