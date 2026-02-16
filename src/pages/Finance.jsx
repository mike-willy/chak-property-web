import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Typography,
  Box, Button, TextField, InputAdornment,
  IconButton, Select, MenuItem, FormControl,
  InputLabel, Grid, Card, CardContent,
  CircularProgress, Alert, Snackbar,
  Modal, Avatar, List, ListItem, 
  ListItemText, ListItemIcon, Divider
} from '@mui/material';
import {
  Search as SearchIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  Refresh as RefreshIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Home as HomeIcon,
  CalendarToday as CalendarIcon,
  AccountCircle as AccountIcon
} from '@mui/icons-material';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  Timestamp,
  where,
  getDocs,
  doc,
  getDoc,
  limit
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
  
  // Tenant Modal State
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [tenantDetails, setTenantDetails] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingTenant, setLoadingTenant] = useState(false);
  
  // Cache for tenant names to avoid repeated lookups
  const [tenantNameCache, setTenantNameCache] = useState({});
  
  // Refs to prevent infinite loops
  const initialLoadDone = useRef(false);
  const paymentsRef = useRef(payments);
  const filterTimeoutRef = useRef(null);

  // Update ref when payments change
  useEffect(() => {
    paymentsRef.current = payments;
  }, [payments]);

  // OPTIMIZATION 1: Batch fetch tenant names
  const batchFetchTenantNames = useCallback(async (tenantIds) => {
    if (tenantIds.length === 0) return;
    
    const newCache = { ...tenantNameCache };
    const uniqueIds = [...new Set(tenantIds)].filter(id => !tenantNameCache[id]);
    
    if (uniqueIds.length === 0) return;
    
    try {
      // Fetch in batches of 10
      const batchSize = 10;
      for (let i = 0; i < uniqueIds.length; i += batchSize) {
        const batch = uniqueIds.slice(i, i + batchSize);
        
        // Create a query to get multiple tenants at once
        const tenantsRef = collection(db, 'tenants');
        const q = query(tenantsRef, where('__name__', 'in', batch));
        const querySnapshot = await getDocs(q);
        
        querySnapshot.forEach(doc => {
          const tenantData = doc.data();
          newCache[doc.id] = tenantData.fullName || tenantData.name || 'Unknown Tenant';
        });
        
        // For IDs not found, mark as unknown
        batch.forEach(id => {
          if (!newCache[id]) {
            newCache[id] = 'Unknown Tenant';
          }
        });
      }
      
      setTenantNameCache(newCache);
      
      // Update payments with new names
      setPayments(prev => prev.map(payment => {
        if (payment.tenantId && newCache[payment.tenantId] && !payment.tenantName) {
          return {
            ...payment,
            tenantName: newCache[payment.tenantId]
          };
        }
        return payment;
      }));
      
    } catch (error) {
      console.error('Error batch fetching tenants:', error);
    }
  }, [tenantNameCache]);

  // OPTIMIZATION 2: Process tenant fetches with debounce
  useEffect(() => {
    const tenantIds = payments
      .filter(p => p.tenantId && !p.tenantName && !tenantNameCache[p.tenantId])
      .map(p => p.tenantId);
    
    if (tenantIds.length === 0) return;
    
    const timer = setTimeout(() => {
      batchFetchTenantNames(tenantIds);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [payments, tenantNameCache, batchFetchTenantNames]);

  // OPTIMIZATION 3: Initial load with real-time listener
  useEffect(() => {
    if (initialLoadDone.current) return;
    
    let unsubscribe;
    
    const setupListener = async () => {
      try {
        const paymentsRef = collection(db, 'payments');
        const q = query(paymentsRef, orderBy('createdAt', 'desc'));
        
        unsubscribe = onSnapshot(q, (snapshot) => {
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
          setLoading(false);
          initialLoadDone.current = true;
          
        }, (error) => {
          console.error('Firebase listener error:', error);
          setSnackbar({
            open: true,
            message: 'Connection error. Please refresh.',
            severity: 'warning'
          });
          setLoading(false);
          initialLoadDone.current = true;
        });
      } catch (error) {
        console.error('Error setting up listener:', error);
        setLoading(false);
        initialLoadDone.current = true;
      }
    };
    
    setupListener();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // OPTIMIZATION 4: Separate effect for admin stats
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

  // OPTIMIZATION 5: Update statistics when payments change
  useEffect(() => {
    if (payments.length === 0) return;
    
    const completedAmount = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    
    const pendingCount = payments.filter(p => p.status === 'pending').length;
    const completedCount = payments.filter(p => p.status === 'completed').length;
    const totalCount = payments.length;

    setStats(prev => ({
      ...prev,
      totalCollected: completedAmount,
      pendingPayments: pendingCount,
      completedPayments: completedCount,
      totalPayments: totalCount
    }));
  }, [payments]);

  // OPTIMIZATION 6: Debounced filter function
  const applyFilters = useCallback(() => {
    if (!paymentsRef.current.length) return;
    
    let filtered = [...paymentsRef.current];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(payment => {
        const tenantName = payment.tenantName || tenantNameCache[payment.tenantId] || '';
        return (
          tenantName.toLowerCase().includes(term) ||
          (payment.mpesaCode && payment.mpesaCode.toLowerCase().includes(term)) ||
          (payment.phoneNumber && payment.phoneNumber.toLowerCase().includes(term)) ||
          (payment.month && payment.month.toLowerCase().includes(term))
        );
      });
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(payment => payment.status === statusFilter);
    }

    if (monthFilter !== 'all') {
      filtered = filtered.filter(payment => payment.month === monthFilter);
    }

    setFilteredPayments(filtered);
  }, [searchTerm, statusFilter, monthFilter, tenantNameCache]);

  // OPTIMIZATION 7: Debounced filter effect
  useEffect(() => {
    if (filterTimeoutRef.current) {
      clearTimeout(filterTimeoutRef.current);
    }
    
    filterTimeoutRef.current = setTimeout(() => {
      applyFilters();
    }, 300);
    
    return () => {
      if (filterTimeoutRef.current) {
        clearTimeout(filterTimeoutRef.current);
      }
    };
  }, [searchTerm, statusFilter, monthFilter, payments, applyFilters]);

  // OPTIMIZATION 8: Fetch tenant details
  const fetchTenantDetails = useCallback(async (tenantId) => {
    if (!tenantId) return null;
    
    try {
      setLoadingTenant(true);
      
      const tenantRef = doc(db, 'tenants', tenantId);
      const tenantSnap = await getDoc(tenantRef);
      
      if (tenantSnap.exists()) {
        const data = tenantSnap.data();
        return { 
          id: tenantSnap.id, 
          ...data,
          name: data.fullName || data.name || 'Unknown Tenant',
          phone: data.phone || data.phoneNumber || 'Not provided',
          email: data.email || 'Not provided',
          unit: data.unitNumber || data.unitId || 'Not specified',
          propertyName: data.propertyName || 'Not specified',
          monthlyRent: data.monthlyRent || data.rent || 0
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching tenant details:', error);
      return null;
    } finally {
      setLoadingTenant(false);
    }
  }, []);

  // OPTIMIZATION 9: View tenant handler
  const handleViewTenantDetails = useCallback(async (payment) => {
    setSelectedTenant(payment);
    
    const tenantName = payment.tenantName || tenantNameCache[payment.tenantId] || 'Loading...';
    
    setTenantDetails({
      name: tenantName,
      phone: payment.phoneNumber || 'Not provided',
      unit: payment.unitNumber || payment.propertyId || 'Not specified',
      id: payment.tenantId || 'N/A'
    });
    
    setModalOpen(true);
    
    if (payment.tenantId) {
      const fullDetails = await fetchTenantDetails(payment.tenantId);
      if (fullDetails) {
        setTenantDetails(prev => ({
          ...prev,
          ...fullDetails
        }));
      }
    }
  }, [tenantNameCache, fetchTenantDetails]);

  // OPTIMIZATION 10: Helper functions with useCallback
  const getTenantDisplayName = useCallback((payment) => {
    if (payment.tenantName) return payment.tenantName;
    if (payment.tenantId && tenantNameCache[payment.tenantId]) {
      return tenantNameCache[payment.tenantId];
    }
    if (payment.tenantId) {
      return 'Loading...';
    }
    return 'No Tenant';
  }, [tenantNameCache]);

  const isTenantNameLoading = useCallback((payment) => {
    return payment.tenantId && !payment.tenantName && !tenantNameCache[payment.tenantId];
  }, [tenantNameCache]);

  const getTenantInitial = useCallback((payment) => {
    const name = payment.tenantName || tenantNameCache[payment.tenantId];
    return name && name !== 'Loading...' ? name.charAt(0).toUpperCase() : '?';
  }, [tenantNameCache]);

  const getStatusColor = useCallback((status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'pending': return 'warning';
      case 'failed': return 'error';
      default: return 'default';
    }
  }, []);

  const formatCurrency = useCallback((amount) => {
    const numAmount = Number(amount) || 0;
    return `KSh ${numAmount.toLocaleString('en-KE')}`;
  }, []);

  const formatDate = useCallback((date) => {
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
  }, []);

  const getDisplayMonth = useCallback((payment) => {
    if (payment.month) return payment.month;
    
    const paymentDate = payment.createdAt;
    if (!paymentDate) return 'Not specified';
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    let dateObj = paymentDate;
    if (dateObj instanceof Timestamp) {
      dateObj = dateObj.toDate();
    } else if (typeof dateObj === 'string') {
      dateObj = new Date(dateObj);
    }
    
    if (isNaN(dateObj.getTime())) return 'Invalid date';
    
    return `${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
  }, []);

  const handleExport = useCallback(() => {
    const headers = ['Tenant ID', 'Tenant Name', 'Month', 'Amount', 'Status', 'M-Pesa Code', 'Date', 'Phone'];
    const csvData = filteredPayments.map(p => {
      const tenantName = p.tenantName || tenantNameCache[p.tenantId] || 'Unknown Tenant';
      return [
        p.tenantId || 'N/A',
        tenantName,
        getDisplayMonth(p),
        p.amount || 0,
        p.status || 'N/A',
        p.mpesaCode || 'N/A',
        formatDate(p.completedAt || p.createdAt),
        p.phoneNumber?.replace('254', '0') || 'N/A'
      ].join(',');
    });
    
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
  }, [filteredPayments, tenantNameCache, getDisplayMonth, formatDate]);

  const getUniqueMonths = useMemo(() => {
    const months = payments
      .map(p => getDisplayMonth(p))
      .filter(Boolean)
      .sort((a, b) => {
        const monthsOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthA = a.split(' ')[0];
        const monthB = b.split(' ')[0];
        return monthsOrder.indexOf(monthA) - monthsOrder.indexOf(monthB);
      });
    return [...new Set(months)];
  }, [payments, getDisplayMonth]);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setSelectedTenant(null);
    setTenantDetails(null);
  }, []);

  const handleCloseSnackbar = useCallback(() => {
    setSnackbar({ ...snackbar, open: false });
  }, [snackbar]);

  return (
    <div className="payment-page">
      {/* Header */}
      <Box className="page-header">
        <Box>
          <Typography variant="h4" fontWeight="bold" className="page-title">
            <PaymentIcon className="header-icon" sx={{ mr: 1 }} />
            Jesma Payments
            {!loading && (
              <Chip 
                label="LIVE" 
                color="success" 
                size="small" 
                sx={{ ml: 2, fontSize: '0.7rem' }}
              />
            )}
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
              placeholder="Search tenants by name, phone, M-Pesa code..."
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
                {getUniqueMonths.map((month, index) => (
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
                <TableCell><strong>Tenant</strong></TableCell>
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
                    <Typography sx={{ mt: 2 }}>Loading payments...</Typography>
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
                filteredPayments.map((payment) => {
                  const tenantName = getTenantDisplayName(payment);
                  const isLoading = isTenantNameLoading(payment);
                  const tenantInitial = !isLoading ? getTenantInitial(payment) : '?';
                  
                  return (
                    <TableRow 
                      key={payment.id} 
                      hover
                      sx={{ 
                        '&:hover': { bgcolor: '#fafafa' },
                        borderBottom: '1px solid #e0e0e0'
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar 
                            sx={{ 
                              width: 36, 
                              height: 36, 
                              bgcolor: isLoading ? '#bdbdbd' : '#1976d2',
                              fontSize: '0.9rem'
                            }}
                          >
                            {isLoading ? <CircularProgress size={20} color="inherit" /> : tenantInitial}
                          </Avatar>
                          
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography 
                                fontWeight="bold" 
                                fontSize="0.95rem"
                                color={isLoading ? 'text.secondary' : 'text.primary'}
                              >
                                {tenantName}
                              </Typography>
                              {isLoading && (
                                <Chip 
                                  label="Loading..." 
                                  size="small" 
                                  sx={{ 
                                    height: 20, 
                                    fontSize: '0.7rem',
                                    bgcolor: '#f5f5f5'
                                  }}
                                />
                              )}
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                ID: {payment.tenantId ? payment.tenantId.substring(0, 8) + '...' : 'N/A'}
                              </Typography>
                              {payment.unitNumber && (
                                <>
                                  <Typography variant="caption" color="text.secondary">•</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {payment.unitNumber}
                                  </Typography>
                                </>
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </TableCell>
                      
                      <TableCell>{getDisplayMonth(payment)}</TableCell>
                      
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
                          title="View Tenant Details"
                          onClick={() => handleViewTenantDetails(payment)}
                          sx={{ mr: 1 }}
                          disabled={isLoading}
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
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Tenant Details Modal */}
      <Modal open={modalOpen} onClose={handleCloseModal}>
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 400,
          bgcolor: 'background.paper',
          borderRadius: 2,
          boxShadow: 24,
          p: 0,
          maxHeight: '80vh',
          overflow: 'auto'
        }}>
          <Box sx={{ p: 3, bgcolor: '#1976d2', color: 'white', borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ width: 60, height: 60, bgcolor: 'white', color: '#1976d2' }}>
                {tenantDetails?.name ? tenantDetails.name.charAt(0).toUpperCase() : 'T'}
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight="bold">
                  {tenantDetails?.name || 'Tenant Details'}
                </Typography>
                <Typography variant="body2">
                  {tenantDetails?.propertyName || tenantDetails?.unit || 'Not specified'}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ p: 3 }}>
            {loadingTenant ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <List dense>
                  <ListItem>
                    <ListItemIcon><AccountIcon /></ListItemIcon>
                    <ListItemText primary="Tenant ID" secondary={tenantDetails?.id || 'N/A'} />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><PhoneIcon /></ListItemIcon>
                    <ListItemText primary="Phone Number" secondary={tenantDetails?.phone?.replace('254', '0') || 'Not provided'} />
                  </ListItem>
                  {tenantDetails?.email && tenantDetails.email !== 'Not provided' && (
                    <ListItem>
                      <ListItemIcon><EmailIcon /></ListItemIcon>
                      <ListItemText primary="Email" secondary={tenantDetails.email} />
                    </ListItem>
                  )}
                  <ListItem>
                    <ListItemIcon><HomeIcon /></ListItemIcon>
                    <ListItemText primary="Unit/Property" secondary={
                      tenantDetails?.unit && tenantDetails?.propertyName ? 
                      `${tenantDetails.unit} • ${tenantDetails.propertyName}` :
                      (tenantDetails?.unit || tenantDetails?.propertyName || 'Not specified')
                    } />
                  </ListItem>
                  {tenantDetails?.rentAmount && (
                    <ListItem>
                      <ListItemIcon><PaymentIcon /></ListItemIcon>
                      <ListItemText primary="Monthly Rent" secondary={formatCurrency(tenantDetails.rentAmount)} />
                    </ListItem>
                  )}
                </List>

                <Divider sx={{ my: 2 }} />
                
                {selectedTenant && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                      Current Payment Details
                    </Typography>
                    <Box sx={{ pl: 2 }}>
                      <Typography variant="body2"><strong>Amount:</strong> {formatCurrency(selectedTenant.amount)}</Typography>
                      <Typography variant="body2"><strong>Month:</strong> {getDisplayMonth(selectedTenant)}</Typography>
                      <Typography variant="body2"><strong>Status:</strong> 
                        <Chip label={selectedTenant.status} color={getStatusColor(selectedTenant.status)} size="small" sx={{ ml: 1, height: 20 }} />
                      </Typography>
                      {selectedTenant.mpesaCode && (
                        <Typography variant="body2"><strong>M-Pesa Code:</strong> {selectedTenant.mpesaCode}</Typography>
                      )}
                    </Box>
                  </Box>
                )}
                
                <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
                  {tenantDetails?.phone && (
                    <Button variant="outlined" fullWidth startIcon={<PhoneIcon />} onClick={() => window.open(`tel:${tenantDetails.phone}`)}>
                      Call Tenant
                    </Button>
                  )}
                  <Button variant="contained" fullWidth onClick={handleCloseModal}>
                    Close
                  </Button>
                </Box>
              </>
            )}
          </Box>
        </Box>
      </Modal>

      {/* Performance Indicator */}
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          ⚡ Live updates • {filteredPayments.length} payments loaded
        </Typography>
      </Box>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default PaymentPage;