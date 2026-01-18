import React, { useState, useEffect } from 'react';
import {
    X, Home, User, AlertCircle, Save, Building, MapPin, List, FileText
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../pages/firebase/firebase';
import { maintenanceService } from '../../pages/firebase/maintenanceService';
import '../../styles/maintenance.css'; // Reusing maintenance styles

const CreateMaintenanceRequestModal = ({ onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [properties, setProperties] = useState([]);
    const [categories, setCategories] = useState([]);
    const [units, setUnits] = useState([]);

    const [formData, setFormData] = useState({
        propertyId: '',
        propertyName: '',
        unitId: '', // This will be the unit ID (e.g. APT-001)
        unitNumber: '', // This will be the display number (e.g. 001)
        category: '', // Saved as title
        description: '',
        priority: 'medium',
        tenantId: null, // Populated from unit if available
        tenantName: ''
    });

    const [isLoadingData, setIsLoadingData] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setIsLoadingData(true);
        try {
            // Fetch Properties
            const propertiesSnapshot = await getDocs(collection(db, 'properties'));
            const propertiesList = propertiesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setProperties(propertiesList);

            // Fetch Categories
            try {
                const categoriesList = await maintenanceService.admin.getCategories();
                setCategories(categoriesList);
            } catch (err) {
                console.warn('Failed to fetch categories, using defaults', err);
                // Fallback or empty, user can type? 
                // For now rely on fetched.
            }

        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Failed to load properties. ' + err.message);
        } finally {
            setIsLoadingData(false);
        }
    };

    const handlePropertyChange = (e) => {
        const propertyId = e.target.value;
        if (!propertyId) {
            setFormData(prev => ({
                ...prev,
                propertyId: '',
                propertyName: '',
                unitId: '',
                unitNumber: '',
                tenantId: null,
                tenantName: ''
            }));
            setUnits([]);
            return;
        }

        const selectedProperty = properties.find(p => p.id === propertyId);

        // Extract units
        let propertyUnits = [];
        if (selectedProperty.unitDetails && selectedProperty.unitDetails.units) {
            propertyUnits = selectedProperty.unitDetails.units;
        }

        setUnits(propertyUnits);
        setFormData(prev => ({
            ...prev,
            propertyId: propertyId,
            propertyName: selectedProperty.name || 'Unknown Property',
            unitId: '',
            unitNumber: '',
            tenantId: null,
            tenantName: ''
        }));
    };

    const handleUnitChange = (e) => {
        const unitId = e.target.value;
        if (!unitId) {
            setFormData(prev => ({ ...prev, unitId: '', unitNumber: '', tenantId: null, tenantName: '' }));
            return;
        }

        const selectedUnit = units.find(u => u.unitId === unitId || u.id === unitId || u.unitNumber === unitId);
        // Note: PropertyUnits.jsx generates units with 'unitId'. Some might checks 'id'. 
        // Let's assume 'unitId' is the unique identifier within the array.

        setFormData(prev => ({
            ...prev,
            unitId: unitId,
            unitNumber: selectedUnit ? (selectedUnit.unitNumber || selectedUnit.unitId) : unitId,
            unitName: selectedUnit ? (selectedUnit.unitName || selectedUnit.unitNumber || selectedUnit.unitId) : '', // Capture unit name
            tenantId: selectedUnit ? selectedUnit.tenantId : null,
            tenantName: selectedUnit ? selectedUnit.tenantName : ''
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.propertyId || !formData.category || !formData.description) {
            setError('Please fill in all required fields');
            return;
        }

        // Validating unit selection if property has units
        if (units.length > 0 && !formData.unitId) {
            setError('Please select a unit');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const requestData = {
                propertyId: formData.propertyId,
                propertyName: formData.propertyName,
                unitId: formData.unitId || 'N/A', // Handle single unit properties or no-unit cases gracefully?
                unitNumber: formData.unitNumber || 'N/A',
                unitName: formData.unitName || `Unit ${formData.unitNumber}`, // Save unitName
                // App uses 'title' for category name. Web previously used 'category'. 
                // We will match App: title = category_name. And also save category = category_name.
                title: formData.category,
                category: formData.category,
                description: formData.description,
                priority: formData.priority,
                tenantId: formData.tenantId, // Might be null if vacant
                tenantName: formData.tenantName,
                images: [] // TODO: Add image upload if needed later
            };

            await maintenanceService.submitMaintenanceRequest(requestData);

            onSuccess();
            onClose();
        } catch (err) {
            console.error('Error submitting request:', err);
            setError('Failed to create request: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mnt-detail-overlay">
            <div className="mnt-detail-container" style={{ maxWidth: '600px' }}>
                <div className="mnt-detail-header">
                    <div className="mnt-detail-header-top">
                        <h2 className="mnt-detail-title">New Maintenance Request</h2>
                        <button onClick={onClose} className="mnt-detail-close-btn">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="mnt-detail-content">
                    {isLoadingData ? (
                        <div className="mnt-loading-state">Loading properties...</div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            {error && (
                                <div className="mnt-cat-error" style={{ marginBottom: '1rem' }}>
                                    <AlertCircle size={16} style={{ marginRight: '8px' }} />
                                    {error}
                                </div>
                            )}

                            {/* Property Selection */}
                            <div className="mnt-detail-section">
                                <label className="mnt-cat-form-label">Property *</label>
                                <div className="mnt-input-group">
                                    <Building size={16} className="mnt-input-icon" />
                                    <select
                                        className="mnt-cat-form-select"
                                        value={formData.propertyId}
                                        onChange={handlePropertyChange}
                                        required
                                    >
                                        <option value="">Select Property</option>
                                        {properties.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Unit Selection */}
                            <div className="mnt-detail-section">
                                <label className="mnt-cat-form-label">Unit *</label>
                                <div className="mnt-input-group">
                                    <Home size={16} className="mnt-input-icon" />
                                    <select
                                        className="mnt-cat-form-select"
                                        value={formData.unitId}
                                        onChange={handleUnitChange}
                                        disabled={!formData.propertyId || units.length === 0}
                                        required={units.length > 0}
                                    >
                                        <option value="">
                                            {units.length === 0 && formData.propertyId
                                                ? 'No units found / Single Unit'
                                                : 'Select Unit'}
                                        </option>
                                        {units.map(u => (
                                            <option key={u.unitId || u.id || u.unitNumber} value={u.unitId || u.id || u.unitNumber}>
                                                {u.unitName || `Unit ${u.unitNumber}`} {u.tenantName ? `(${u.tenantName})` : '(Vacant)'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {formData.tenantName && (
                                    <div className="mnt-field-hint">
                                        <User size={12} /> Tenant: {formData.tenantName}
                                    </div>
                                )}
                            </div>

                            {/* Category Selection */}
                            <div className="mnt-detail-section">
                                <label className="mnt-cat-form-label">Category *</label>
                                <div className="mnt-input-group">
                                    <List size={16} className="mnt-input-icon" />
                                    <select
                                        className="mnt-cat-form-select"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Category</option>
                                        {categories.map(c => (
                                            <option key={c.id || c.name} value={c.name}>{c.name}</option>
                                        ))}
                                        {/* Fallback if no categories loaded */}
                                        {categories.length === 0 && (
                                            <>
                                                <option value="Plumbing">Plumbing</option>
                                                <option value="Electrical">Electrical</option>
                                                <option value="General">General</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>

                            {/* Priority */}
                            <div className="mnt-detail-section">
                                <label className="mnt-cat-form-label">Priority</label>
                                <div className="mnt-priority-selector">
                                    {['low', 'medium', 'high', 'emergency'].map(p => (
                                        <button
                                            key={p}
                                            type="button"
                                            className={`mnt-priority-btn ${formData.priority === p ? `selected ${p}` : ''}`}
                                            onClick={() => setFormData({ ...formData, priority: p })}
                                        >
                                            {p.charAt(0).toUpperCase() + p.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Description */}
                            <div className="mnt-detail-section">
                                <label className="mnt-cat-form-label">Description *</label>
                                <div className="mnt-input-group">
                                    <textarea
                                        className="mnt-cat-form-input"
                                        rows="4"
                                        placeholder="Describe the issue..."
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="mnt-detail-actions-grid">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="mnt-detail-delete-cancel-btn"
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="mnt-detail-action-btn mnt-detail-action-complete"
                                    disabled={loading}
                                    style={{ justifyContent: 'center' }}
                                >
                                    {loading ? 'Creating...' : 'Create Request'}
                                </button>
                            </div>

                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CreateMaintenanceRequestModal;
