// components/maintenance/MaintenanceCategories.jsx
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { maintenanceService } from '../../pages/firebase/maintenanceService';
import { auth } from '../../pages/firebase/firebase';
import '../../styles/maintenance-categories.css'; // Unique CSS file

const MaintenanceCategories = () => {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState({ 
    name: '', 
    description: '', 
    icon: 'wrench' 
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatingDefaults, setCreatingDefaults] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [operationInProgress, setOperationInProgress] = useState(false);

  useEffect(() => {
    // Check authentication state
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      if (user) {
        loadCategories();
      } else {
        setLoading(false);
        setError('Please log in to access maintenance categories');
      }
    });

    return () => unsubscribe();
  }, []);

  // Default categories for first-time setup
  const defaultCategories = [
    { name: 'Plumbing Issues', description: 'Tap/faucet leaks, clogged drains, toilet problems', icon: 'droplet' },
    { name: 'Electrical Problems', description: 'Power outages, faulty switches, socket issues', icon: 'zap' },
    { name: 'HVAC/Heating & Cooling', description: 'AC not working, heater issues, thermostat problems', icon: 'thermometer' },
    { name: 'Appliance Repair', description: 'Refrigerator, stove, oven, dishwasher malfunctions', icon: 'home' },
    { name: 'Lock & Security', description: 'Broken locks, key issues, security concerns', icon: 'lock' },
    { name: 'Window & Door Repair', description: 'Broken windows, stuck doors, screen damage', icon: 'shield' },
    { name: 'Pest Control', description: 'Insects, rodents, termite issues', icon: 'alert-circle' },
    { name: 'Flooring Issues', description: 'Damaged tiles, creaky floors, carpet problems', icon: 'tool' },
    { name: 'Wall & Paint', description: 'Cracks, peeling paint, wall damage', icon: 'tool' },
    { name: 'Roof & Ceiling', description: 'Leaks, water stains, ceiling damage', icon: 'home' },
    { name: 'Kitchen Issues', description: 'Cabinets, countertops, sink problems', icon: 'home' },
    { name: 'Bathroom Problems', description: 'Shower, tiles, ventilation issues', icon: 'droplets' },
    { name: 'Laundry Area', description: 'Washing machine, dryer, plumbing issues', icon: 'tool' },
    { name: 'Lighting & Fixtures', description: 'Broken lights, fan problems, fixture issues', icon: 'lightbulb' },
    { name: 'General Handyman', description: 'Minor repairs, installations, assembly', icon: 'wrench' },
  ];

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccessMessage('');
      
      console.log('Loading categories for user:', currentUser?.uid);
      
      const data = await maintenanceService.admin.getCategories();
      console.log('Categories fetched:', data.length);
      
      // If no categories exist, create default ones
      if (data.length === 0) {
        console.log('No categories found, creating defaults...');
        await createDefaultCategories();
        // Reload after creating defaults
        const newData = await maintenanceService.admin.getCategories();
        setCategories(newData);
        setSuccessMessage('Default maintenance categories created successfully!');
      } else {
        setCategories(data);
      }
      
    } catch (err) {
      console.error('Error in loadCategories:', err);
      let errorMsg = 'Failed to load categories';
      
      if (err.code === 'permission-denied') {
        errorMsg = 'Permission denied. You may not have admin privileges.';
      } else if (err.code === 'unauthenticated') {
        errorMsg = 'Please log in to access this feature.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
      setCreatingDefaults(false);
    }
  };

  const createDefaultCategories = async () => {
    try {
      setCreatingDefaults(true);
      console.log('Creating default maintenance categories...');
      
      let createdCount = 0;
      let failedCount = 0;
      
      // Create all default categories with better error handling
      for (const category of defaultCategories) {
        try {
          await maintenanceService.admin.addCategory(category);
          createdCount++;
          console.log(`✓ Created category: ${category.name}`);
          
          // Small delay to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          failedCount++;
          console.error(`✗ Failed to create category: ${category.name}`, error);
          // Continue with other categories even if one fails
        }
      }
      
      console.log(`Created ${createdCount} categories, ${failedCount} failed`);
      
      if (failedCount > 0) {
        throw new Error(`Created ${createdCount} categories, but ${failedCount} failed. You can add them manually.`);
      }
      
    } catch (error) {
      console.error('Error creating default categories:', error);
      throw error;
    } finally {
      setCreatingDefaults(false);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    
    if (!newCategory.name.trim()) {
      setError('Category name is required');
      return;
    }

    if (operationInProgress) return;
    
    try {
      setOperationInProgress(true);
      setError('');
      setSuccessMessage('');
      
      console.log('Adding new category:', newCategory.name);
      await maintenanceService.admin.addCategory(newCategory);
      
      setSuccessMessage(`Category "${newCategory.name}" added successfully!`);
      setNewCategory({ name: '', description: '', icon: 'wrench' });
      
      // Reload categories
      await loadCategories();
      
    } catch (err) {
      console.error('Error adding category:', err);
      let errorMsg = 'Failed to add category';
      
      if (err.message.includes('Only admin can add categories')) {
        errorMsg = 'Admin privileges required to add categories';
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      setError(errorMsg);
    } finally {
      setOperationInProgress(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (operationInProgress) return;
    
    const category = categories.find(cat => cat.id === id);
    if (!category) return;
    
    if (!window.confirm(`Are you sure you want to delete "${category.name}"?`)) return;

    try {
      setOperationInProgress(true);
      setError('');
      setSuccessMessage('');
      
      console.log('Deleting category:', category.name);
      await maintenanceService.admin.deleteCategory(id);
      
      setSuccessMessage(`Category "${category.name}" deleted successfully!`);
      
      // Reload categories
      await loadCategories();
      
    } catch (err) {
      console.error('Error deleting category:', err);
      let errorMsg = 'Failed to delete category';
      
      if (err.message.includes('Only admin can delete categories')) {
        errorMsg = 'Admin privileges required to delete categories';
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      setError(errorMsg);
    } finally {
      setOperationInProgress(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (operationInProgress) return;
    
    if (!window.confirm('This will delete all existing categories and recreate the default set. This action cannot be undone. Continue?')) return;

    try {
      setOperationInProgress(true);
      setError('');
      setSuccessMessage('');
      
      console.log('Resetting to default categories...');
      
      // Delete all existing categories
      let deletedCount = 0;
      for (const category of categories) {
        try {
          await maintenanceService.admin.deleteCategory(category.id);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete category: ${category.name}`, error);
        }
      }
      
      console.log(`Deleted ${deletedCount} categories`);
      
      // Create defaults
      await createDefaultCategories();
      
      // Reload categories
      await loadCategories();
      
      setSuccessMessage('Successfully reset to default categories!');
      
    } catch (err) {
      console.error('Error resetting categories:', err);
      setError('Failed to reset categories: ' + err.message);
    } finally {
      setOperationInProgress(false);
    }
  };

  const handleRefresh = async () => {
    if (operationInProgress) return;
    
    try {
      setOperationInProgress(true);
      setError('');
      setSuccessMessage('');
      
      await loadCategories();
      setSuccessMessage('Categories refreshed successfully!');
      
    } catch (err) {
      console.error('Error refreshing categories:', err);
      setError('Failed to refresh categories');
    } finally {
      setOperationInProgress(false);
    }
  };

  const iconOptions = [
    'wrench', 'home', 'droplet', 'zap', 'thermometer', 
    'shield', 'key', 'lock', 'alert-circle', 'tool', 
    'hammer', 'plug', 'lightbulb', 'droplets', 'fan',
    'thermometer-sun', 'droplet-off', 'zap-off', 'home-off',
    'lock-open', 'shield-off', 'alert-triangle', 'settings'
  ];

  const clearMessages = () => {
    setError('');
    setSuccessMessage('');
  };

  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Clear error after 10 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('');
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (!currentUser) {
    return (
      <div className="mnt-cat-container">
        <div className="mnt-cat-loading">
          <AlertCircle style={{ width: '24px', height: '24px', marginBottom: '1rem', color: '#dc2626' }} />
          <p>Please log in to access maintenance categories.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mnt-cat-container">
      <div className="mnt-cat-header">
        <div>
          <h2 className="mnt-cat-title">Maintenance Categories</h2>
          <p className="mnt-cat-subtitle">
            Categories will appear in the tenant mobile app for maintenance requests
          </p>
        </div>
        <div className="mnt-cat-header-actions">
          <button 
            onClick={handleRefresh} 
            className="mnt-cat-refresh-button"
            disabled={operationInProgress || loading}
            title="Refresh Categories"
          >
            <RefreshCw style={{ width: '16px', height: '16px' }} />
            Refresh
          </button>
          <button 
            onClick={handleResetToDefaults} 
            className="mnt-cat-reset-button"
            disabled={operationInProgress || loading || categories.length === 0}
            title="Reset to Default Categories"
          >
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mnt-cat-success" onClick={clearMessages}>
          <CheckCircle style={{ width: '16px', height: '16px', marginRight: '0.5rem' }} />
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mnt-cat-error" onClick={clearMessages}>
          <AlertCircle style={{ width: '16px', height: '16px', marginRight: '0.5rem' }} />
          {error}
        </div>
      )}

      {/* Add New Category Form */}
      <form onSubmit={handleAddCategory} className="mnt-cat-form">
        <h3 className="mnt-cat-form-title">Add New Category</h3>
        <div className="mnt-cat-form-grid">
          <div className="mnt-cat-form-group">
            <label className="mnt-cat-form-label">Category Name *</label>
            <input
              type="text"
              value={newCategory.name}
              onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
              placeholder="e.g., Plumbing"
              className="mnt-cat-form-input"
              required
              disabled={operationInProgress || loading || creatingDefaults}
              maxLength={50}
            />
          </div>
          <div className="mnt-cat-form-group">
            <label className="mnt-cat-form-label">Description</label>
            <input
              type="text"
              value={newCategory.description}
              onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
              placeholder="Brief description for tenants"
              className="mnt-cat-form-input"
              disabled={operationInProgress || loading || creatingDefaults}
              maxLength={100}
            />
          </div>
          <div className="mnt-cat-form-group">
            <label className="mnt-cat-form-label">Icon</label>
            <select
              value={newCategory.icon}
              onChange={(e) => setNewCategory({...newCategory, icon: e.target.value})}
              className="mnt-cat-form-select"
              disabled={operationInProgress || loading || creatingDefaults}
            >
              {iconOptions.map(icon => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button 
          type="submit" 
          className="mnt-cat-add-button"
          disabled={operationInProgress || loading || creatingDefaults || !newCategory.name.trim()}
        >
          <Plus style={{ width: '16px', height: '16px' }} />
          {operationInProgress ? 'Adding...' : 'Add Category'}
        </button>
      </form>

      {/* Categories List */}
      <div className="mnt-cat-list-section">
        <div className="mnt-cat-list-header">
          <h3 className="mnt-cat-list-title">
            Existing Categories ({categories.length})
            {creatingDefaults && ' - Creating default categories...'}
          </h3>
          {categories.length > 0 && (
            <div className="mnt-cat-stats">
              <span className="mnt-cat-stat-item">Total: {categories.length}</span>
            </div>
          )}
        </div>
        
        {loading ? (
          <div className="mnt-cat-loading">
            <RefreshCw className="mnt-cat-spinner" />
            Loading categories...
          </div>
        ) : creatingDefaults ? (
          <div className="mnt-cat-loading">
            <RefreshCw className="mnt-cat-spinner" />
            Creating default maintenance categories... This may take a moment.
          </div>
        ) : categories.length === 0 ? (
          <div className="mnt-cat-empty">
            <AlertCircle style={{ width: '24px', height: '24px', marginBottom: '1rem', color: '#6b7280' }} />
            <p>No categories found. Default categories should have been created automatically.</p>
            <button 
              onClick={handleResetToDefaults} 
              className="mnt-cat-empty-action"
              disabled={operationInProgress}
            >
              Create Default Categories
            </button>
          </div>
        ) : (
          <div className="mnt-cat-table-wrapper">
            <table className="mnt-cat-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Icon</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id} className={operationInProgress ? 'mnt-cat-row-disabled' : ''}>
                    <td>
                      <span className="mnt-cat-name">{category.name}</span>
                    </td>
                    <td>
                      <span className="mnt-cat-description">
                        {category.description || 'No description'}
                      </span>
                    </td>
                    <td>
                      <span className="mnt-cat-icon">{category.icon}</span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        className="mnt-cat-delete-button"
                        title={`Delete ${category.name}`}
                        disabled={operationInProgress || creatingDefaults}
                      >
                        <Trash2 style={{ width: '16px', height: '16px' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MaintenanceCategories;