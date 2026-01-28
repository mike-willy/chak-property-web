import React, { useState, useEffect } from 'react';
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
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  Refresh as RefreshIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Home as HomeIcon,
  CalendarToday as CalendarIcon,
  AccountCircle as AccountIcon,
  Payment as PaymentHistoryIcon
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
  getDoc
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

  // Real-time listener for payments
  useEffect(() => {
    const paymentsRef = collection(db, 'payments');
    const q = query(paymentsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
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
        
        // Fetch tenant names for payments that don't have tenantName
        await fetchMissingTenantNames(paymentsData);
        
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

  // Fetch tenant names for payments that only have tenantId
  const fetchMissingTenantNames = async (paymentsData) => {
    try {
      const paymentsNeedingNames = paymentsData.filter(p => 
        p.tenantId && !p.tenantName && !tenantNameCache[p.tenantId]
      );
      
      if (paymentsNeedingNames.length === 0) return;
      
      // Get unique tenant IDs
      const tenantIds = [...new Set(paymentsNeedingNames.map(p => p.tenantId))];
      
      // Fetch tenant names in batch
      const newCache = { ...tenantNameCache };
      
      for (const tenantId of tenantIds) {
        if (!newCache[tenantId]) {
          try {
            const tenantRef = doc(db, 'tenants', tenantId);
            const tenantSnap = await getDoc(tenantRef);
            
            if (tenantSnap.exists()) {
              const tenantData = tenantSnap.data();
              newCache[tenantId] = tenantData.fullName || tenantData.name || 'Unknown Tenant';
            } else {
              // Try alternative lookup
              const tenantsRef = collection(db, 'tenants');
              const q = query(tenantsRef, where('tenantId', '==', tenantId));
              const querySnapshot = await getDocs(q);
              
              if (!querySnapshot.empty) {
                const tenantData = querySnapshot.docs[0].data();
                newCache[tenantId] = tenantData.fullName || tenantData.name || 'Unknown Tenant';
              } else {
                newCache[tenantId] = 'Unknown Tenant';
              }
            }
          } catch (error) {
            console.error(`Error fetching tenant ${tenantId}:`, error);
            newCache[tenantId] = 'Unknown Tenant';
          }
        }
      }
      
      setTenantNameCache(newCache);
      
      // Update payments with names
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
      console.error('Error fetching tenant names:', error);
    }
  };

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
      filtered = filtered.filter(payment => {
        const tenantName = payment.tenantName || tenantNameCache[payment.tenantId] || '';
        return (
          (payment.tenantId && payment.tenantId.toLowerCase().includes(term)) ||
          (tenantName && tenantName.toLowerCase().includes(term)) ||
          (payment.mpesaCode && payment.mpesaCode.toLowerCase().includes(term)) ||
          (payment.phoneNumber && payment.phoneNumber.toLowerCase().includes(term)) ||
          (payment.month && payment.month.toLowerCase().includes(term))
        );
      });
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

  // Fetch tenant details from tenants collection
  const fetchTenantDetails = async (tenantId) => {
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
          // Ensure we use the correct field names from your tenants collection
          name: data.fullName || data.name || 'Unknown Tenant',
          phone: data.phone || data.phoneNumber || 'Not provided',
          email: data.email || 'Not provided',
          unit: data.unitNumber || data.unitId || 'Not specified',
          propertyName: data.propertyName || 'Not specified',
          monthlyRent: data.monthlyRent || data.rent || 0
        };
      } else {
        // Try to find tenant by other identifiers if direct ID doesn't work
        const tenantsRef = collection(db, 'tenants');
        const q = query(tenantsRef, where('tenantId', '==', tenantId));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const doc = querySnapshot.docs[0];
          const data = doc.data();
          return { 
            id: doc.id, 
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
      }
    } catch (error) {
      console.error('Error fetching tenant details:', error);
      return null;
    } finally {
      setLoadingTenant(false);
    }
  };

  // Handle view tenant details
  const handleViewTenantDetails = async (payment) => {
    setSelectedTenant(payment);
    
    // Get tenant name from cache or payment
    const tenantName = payment.tenantName || tenantNameCache[payment.tenantId] || 'Unknown Tenant';
    
    // Basic info from payment
    const tenantInfo = {
      name: tenantName,
      phone: payment.phoneNumber || 'Not provided',
      unit: payment.unitNumber || payment.propertyId || 'Not specified',
      id: payment.tenantId || 'N/A'
    };
    
    setTenantDetails(tenantInfo);
    
    // Fetch additional details from tenants collection
    if (payment.tenantId) {
      const fullDetails = await fetchTenantDetails(payment.tenantId);
      if (fullDetails) {
        setTenantDetails({
          ...tenantInfo,
          ...fullDetails,
          email: fullDetails.email || 'Not provided',
          joinDate: fullDetails.createdAt || fullDetails.joinDate || 'Unknown',
          rentAmount: fullDetails.monthlyRent || fullDetails.rent || 'Not specified',
          propertyName: fullDetails.propertyName || 'Not specified',
          unit: fullDetails.unit || tenantInfo.unit,
          status: fullDetails.status || 'Active'
        });
      }
    }
    
    setModalOpen(true);
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

  // NEW: Get display month from payment date when month field is missing
  const getDisplayMonth = (payment) => {
    // If month field exists, use it
    if (payment.month) return payment.month;
    
    // Otherwise, get month from payment date (createdAt)
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
    
    // Format: "Jan 2024" - professional property management style
    return `${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
  };

  const handleExport = () => {
    const headers = ['Tenant ID', 'Tenant Name', 'Month', 'Amount', 'Status', 'M-Pesa Code', 'Date', 'Phone'];
    const csvData = filteredPayments.map(p => {
      const tenantName = p.tenantName || tenantNameCache[p.tenantId] || 'Unknown Tenant';
      const displayMonth = getDisplayMonth(p); // Use the new function
      return [
        p.tenantId || 'N/A',
        tenantName,
        displayMonth,
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
  };

  const getUniqueMonths = () => {
    // Use the display month function for consistency
    const months = payments
      .map(p => getDisplayMonth(p))
      .filter(Boolean)
      .sort((a, b) => {
        const monthsOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        // Extract month name for comparison
        const monthA = a.split(' ')[0];
        const monthB = b.split(' ')[0];
        return monthsOrder.indexOf(monthA) - monthsOrder.indexOf(monthB);
      });
    return [...new Set(months)];
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedTenant(null);
    setTenantDetails(null);
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Get display name for tenant
  const getTenantDisplayName = (payment) => {
    return payment.tenantName || tenantNameCache[payment.tenantId] || 'Unknown Tenant';
  };

  // Get initial for avatar
  const getTenantInitial = (payment) => {
    const name = getTenantDisplayName(payment);
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="payment-page">
      {/* Header */}
      <Box className="page-header">
        <Box>
          <Typography variant="h4" fontWeight="bold" className="page-title">
            <PaymentIcon className="header-icon" sx={{ mr: 1 }} />
            Jesma Payments
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
                filteredPayments.map((payment) => {
                  const tenantName = getTenantDisplayName(payment);
                  const tenantInitial = getTenantInitial(payment);
                  
                  return (
                    <TableRow 
                      key={payment.id} 
                      hover
                      sx={{ 
                        '&:hover': { bgcolor: '#fafafa' },
                        borderBottom: '1px solid #e0e0e0'
                      }}
                    >
                      {/* TENANT CELL - Now with actual names fetched from tenants collection */}
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          {/* Avatar/Initials */}
                          <Avatar 
                            sx={{ 
                              width: 36, 
                              height: 36, 
                              bgcolor: '#1976d2',
                              fontSize: '0.9rem'
                            }}
                          >
                            {tenantInitial}
                          </Avatar>
                          
                          {/* Name + Details */}
                          <Box>
                            <Typography fontWeight="bold" fontSize="0.95rem">
                              {tenantName}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                ID: {payment.tenantId || 'N/A'}
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
                      
                      {/* MONTH CELL - NOW SHOWS PAYMENT DATE WHEN MONTH IS MISSING */}
                      <TableCell>
                        {getDisplayMonth(payment)}
                      </TableCell>
                      
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
      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        aria-labelledby="tenant-details-modal"
      >
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
          {/* Modal Header */}
          <Box sx={{ 
            p: 3, 
            bgcolor: '#1976d2', 
            color: 'white',
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8
          }}>
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

          {/* Modal Content */}
          <Box sx={{ p: 3 }}>
            {loadingTenant ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <AccountIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Tenant ID" 
                      secondary={tenantDetails?.id || 'N/A'} 
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemIcon>
                      <PhoneIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Phone Number" 
                      secondary={tenantDetails?.phone ? 
                        tenantDetails.phone.replace('254', '0') : 
                        (tenantDetails?.phoneNumber ? tenantDetails.phoneNumber.replace('254', '0') : 'Not provided')
                      } 
                    />
                  </ListItem>
                  
                  {tenantDetails?.email && tenantDetails.email !== 'Not provided' && (
                    <ListItem>
                      <ListItemIcon>
                        <EmailIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Email" 
                        secondary={tenantDetails.email} 
                      />
                    </ListItem>
                  )}
                  
                  <ListItem>
                    <ListItemIcon>
                      <HomeIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Unit/Property" 
                      secondary={
                        tenantDetails?.unit && tenantDetails?.propertyName ? 
                        `${tenantDetails.unit} • ${tenantDetails.propertyName}` :
                        (tenantDetails?.unit || tenantDetails?.propertyName || 'Not specified')
                      } 
                    />
                  </ListItem>
                  
                  {tenantDetails?.rentAmount && (
                    <ListItem>
                      <ListItemIcon>
                        <PaymentIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Monthly Rent" 
                        secondary={formatCurrency(tenantDetails.rentAmount)} 
                      />
                    </ListItem>
                  )}
                  
                  {tenantDetails?.joinDate && tenantDetails.joinDate !== 'Unknown' && (
                    <ListItem>
                      <ListItemIcon>
                        <CalendarIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Joined" 
                        secondary={formatDate(tenantDetails.joinDate)} 
                      />
                    </ListItem>
                  )}
                </List>

                <Divider sx={{ my: 2 }} />
                
                {/* Current Payment Info */}
                {selectedTenant && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                      Current Payment Details
                    </Typography>
                    <Box sx={{ pl: 2 }}>
                      <Typography variant="body2">
                        <strong>Amount:</strong> {formatCurrency(selectedTenant.amount)}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Month:</strong> {getDisplayMonth(selectedTenant)}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Status:</strong> 
                        <Chip
                          label={selectedTenant.status}
                          color={getStatusColor(selectedTenant.status)}
                          size="small"
                          sx={{ ml: 1, height: 20 }}
                        />
                      </Typography>
                      {selectedTenant.mpesaCode && (
                        <Typography variant="body2">
                          <strong>M-Pesa Code:</strong> {selectedTenant.mpesaCode}
                        </Typography>
                      )}
                      <Typography variant="body2">
                        <strong>Date:</strong> {formatDate(selectedTenant.completedAt || selectedTenant.createdAt)}
                      </Typography>
                    </Box>
                  </Box>
                )}
                
                {/* Action Buttons */}
                <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
                  {(tenantDetails?.phone || tenantDetails?.phoneNumber) && (
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<PhoneIcon />}
                      onClick={() => window.open(`tel:${tenantDetails.phone || tenantDetails.phoneNumber}`)}
                    >
                      Call Tenant
                    </Button>
                  )}
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleCloseModal}
                  >
                    Close
                  </Button>
                </Box>
              </>
            )}
          </Box>
        </Box>
      </Modal>

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