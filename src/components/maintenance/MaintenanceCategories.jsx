// components/maintenance/MaintenanceCategories.jsx
import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { maintenanceService } from '../../pages/firebase/maintenanceService';
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

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await maintenanceService.admin.getCategories();
      setCategories(data);
    } catch (err) {
      setError('Failed to load categories');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.name.trim()) {
      setError('Category name is required');
      return;
    }

    try {
      setError('');
      await maintenanceService.admin.addCategory(newCategory);
      setNewCategory({ name: '', description: '', icon: 'wrench' });
      loadCategories();
    } catch (err) {
      setError(err.message || 'Failed to add category');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;

    try {
      await maintenanceService.admin.deleteCategory(id);
      loadCategories();
    } catch (err) {
      setError('Failed to delete category: ' + err.message);
    }
  };

  const iconOptions = [
    'wrench', 'home', 'droplet', 'zap', 'thermometer', 
    'shield', 'key', 'lock', 'alert-circle', 'tool', 
    'hammer', 'plug', 'lightbulb', 'droplets', 'fan'
  ];

  return (
    <div className="mnt-cat-container">
      <h2 className="mnt-cat-title">Maintenance Categories</h2>
      <p className="mnt-cat-subtitle">
        Categories will appear in the tenant mobile app
      </p>

      {error && (
        <div className="mnt-cat-error">{error}</div>
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
            />
          </div>
          <div className="mnt-cat-form-group">
            <label className="mnt-cat-form-label">Description</label>
            <input
              type="text"
              value={newCategory.description}
              onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
              placeholder="Brief description"
              className="mnt-cat-form-input"
            />
          </div>
          <div className="mnt-cat-form-group">
            <label className="mnt-cat-form-label">Icon</label>
            <select
              value={newCategory.icon}
              onChange={(e) => setNewCategory({...newCategory, icon: e.target.value})}
              className="mnt-cat-form-select"
            >
              {iconOptions.map(icon => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" className="mnt-cat-add-button">
          <Plus style={{ width: '16px', height: '16px' }} />
          Add Category
        </button>
      </form>

      {/* Categories List */}
      <div>
        <h3 className="mnt-cat-list-title">
          Existing Categories ({categories.length})
        </h3>
        
        {loading ? (
          <div className="mnt-cat-loading">Loading categories...</div>
        ) : categories.length === 0 ? (
          <div className="mnt-cat-empty">
            No categories yet. Add your first category above.
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
                  <tr key={category.id}>
                    <td>
                      <span className="mnt-cat-name">{category.name}</span>
                    </td>
                    <td>
                      <span className="mnt-cat-description">
                        {category.description || '—'}
                      </span>
                    </td>
                    <td>
                      <span className="mnt-cat-icon">{category.icon}</span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        className="mnt-cat-delete-button"
                        title="Delete"
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