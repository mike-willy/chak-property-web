// src/components/analytics/PDFExportButton.jsx
import React, { useState } from 'react';
import { Button, Menu, MenuItem, IconButton } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { analyticsService } from '../../services/analyticsService';
import { toast } from 'react-toastify';

const PDFExportButton = ({ 
  reportType, 
  analyticsData, 
  timeframe = 'monthly',
  label = "Export",
  variant = "contained",
  size = "medium",
  iconOnly = false
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(false);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleExport = async (format) => {
    try {
      setLoading(true);
      
      let result;
      if (analyticsData) {
        // Export existing data
        result = await analyticsService.exportAnalytics(reportType, analyticsData, format);
      } else {
        // Generate new report
        const reportMap = {
          'rent-collection': 'rent',
          'vacancy-rates': 'vacancy',
          'tenant-behavior': 'tenants',
          'insights': 'insights'
        };
        
        const mappedType = reportMap[reportType] || reportType;
        result = await analyticsService.generateComprehensiveReport(mappedType, timeframe, format);
      }
      
      if (result.success) {
        toast.success(`${format.toUpperCase()} report downloaded successfully!`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(`Failed to export ${format.toUpperCase()} report`);
    } finally {
      setLoading(false);
      handleClose();
    }
  };

  const getButtonContent = () => {
    if (iconOnly) {
      return <DownloadIcon />;
    }
    
    return (
      <>
        {label}
        <ArrowDropDownIcon />
      </>
    );
  };

  return (
    <>
      <Button
        variant={variant}
        color="primary"
        size={size}
        startIcon={!iconOnly && <DownloadIcon />}
        onClick={handleClick}
        disabled={loading}
        sx={{
          backgroundColor: '#1976d2',
          '&:hover': {
            backgroundColor: '#1565c0'
          }
        }}
      >
        {loading ? 'Exporting...' : getButtonContent()}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={() => handleExport('csv')}>
          <DescriptionIcon sx={{ mr: 1, color: '#2e7d32' }} />
          Export as CSV (Excel)
        </MenuItem>
        <MenuItem onClick={() => handleExport('pdf')}>
          <PictureAsPdfIcon sx={{ mr: 1, color: '#d32f2f' }} />
          Export as PDF
        </MenuItem>
      </Menu>
    </>
  );
};

export default PDFExportButton;