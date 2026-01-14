// src/pages/AddProperty.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  getDocs,
  updateDoc,
  doc,
  arrayUnion 
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../pages/firebase/firebase";
import "../styles/Addproperty.css";
import { 
  FaImage, 
  FaUpload, 
  FaTrash, 
  FaHome, 
  FaBed, 
  FaBath, 
  FaWifi, 
  FaCar, 
  FaTv, 
  FaSnowflake,
  FaSwimmingPool,
  FaDumbbell,
  FaBuilding,
  FaDoorClosed,
  FaCheckCircle,
  FaStore,
  FaWarehouse
} from "react-icons/fa";

const AddProperty = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [landlords, setLandlords] = useState([]);
  const [fetchingLandlords, setFetchingLandlords] = useState(true);
  const [propertyImages, setPropertyImages] = useState([]);
  
  // Property types with icons and descriptions
  const propertyTypes = [
    { value: "single", label: "Single Room", icon: "🏠", description: "Single self-contained room", hasBedrooms: false },
    { value: "bedsitter", label: "Bedsitter", icon: "🛌", description: "Bed-sitting room with kitchenette", hasBedrooms: false },
    { value: "one-bedroom", label: "One Bedroom", icon: "1️⃣", description: "One bedroom apartment", hasBedrooms: true },
    { value: "two-bedroom", label: "Two Bedroom", icon: "2️⃣", description: "Two bedroom apartment", hasBedrooms: true },
    { value: "three-bedroom", label: "Three Bedroom", icon: "3️⃣", description: "Three bedroom apartment", hasBedrooms: true },
    { value: "one-two-bedroom", label: "1BR + 2BR", icon: "🏘️", description: "Mix of 1BR and 2BR units", hasBedrooms: true },
    { value: "apartment", label: "Apartment Complex", icon: "🏢", description: "Multi-unit apartment building", hasBedrooms: false },
    { value: "commercial", label: "Commercial", icon: "🏪", description: "Commercial property", hasBedrooms: false },
  ];
  
  // Amenities options
  const amenitiesOptions = [
    { id: "wifi", label: "WiFi", icon: <FaWifi /> },
    { id: "parking", label: "Parking", icon: <FaCar /> },
    { id: "tv", label: "TV", icon: <FaTv /> },
    { id: "ac", label: "A/C", icon: <FaSnowflake /> },
    { id: "pool", label: "Swimming Pool", icon: <FaSwimmingPool /> },
    { id: "gym", label: "Gym", icon: <FaDumbbell /> },
    { id: "water", label: "24/7 Water", icon: "💧" },
    { id: "security", label: "Security", icon: "👮" },
    { id: "backup", label: "Power Backup", icon: "⚡" },
    { id: "laundry", label: "Laundry", icon: "🧺" },
  ];
  
  const [form, setForm] = useState({
    name: "",
    address: "",
    type: "apartment",
    units: 1,
    rentAmount: "",
    landlordId: "",
    landlordName: "",
    status: "available",
    description: "",
    location: "",
    city: "",
    country: "Kenya",
    amenities: [],
    propertyType: "apartment",
    bedrooms: 1,
    bathrooms: 1,
    size: "",
    images: [],
    pricing: {
      single: "",
      bedsitter: "",
      oneBedroom: "",
      twoBedroom: "",
      threeBedroom: ""
    },
    // NEW: Application and fee-related fields
    applicationFee: "",
    securityDeposit: "",
    petDeposit: "",
    otherFees: "",
    leaseTerm: 12, // Default 12 months
    noticePeriod: 30, // Default 30 days
    latePaymentFee: "",
    gracePeriod: 5, // Default 5 days
    feeDetails: {
      includesWater: false,
      includesElectricity: false,
      includesInternet: false,
      includesMaintenance: false
    },
    // Unit tracking fields
    unitDetails: {
      totalUnits: 1,
      vacantCount: 1,
      leasedCount: 0,
      maintenanceCount: 0,
      occupancyRate: 0,
      units: []
    }
  });

  // Fetch all landlords when component loads
  useEffect(() => {
    fetchLandlords();
  }, []);

  // Function to generate units based on total units count
  const generateUnits = (totalUnits, propertyName, rentAmount) => {
    const units = [];
    const propertyPrefix = propertyName 
      ? propertyName.replace(/\s+/g, '').substring(0, 3).toUpperCase() 
      : 'APT';
    
    const baseRent = Number(rentAmount) || 0;
    
    for (let i = 1; i <= totalUnits; i++) {
      const unitNumber = i.toString().padStart(3, '0');
      units.push({
        unitId: `${propertyPrefix}-${unitNumber}`,
        unitNumber: unitNumber,
        unitName: `${propertyName || 'Property'} - Unit ${unitNumber}`,
        status: "vacant",
        rentAmount: baseRent,
        size: form.size || "",
        amenities: [...form.amenities],
        tenantId: null,
        tenantName: "",
        tenantPhone: "",
        tenantEmail: "",
        leaseStart: null,
        leaseEnd: null,
        rentPaidUntil: null,
        notes: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    return units;
  };

  // Fetch landlords from landlords collection
  const fetchLandlords = async () => {
    try {
      setFetchingLandlords(true);
      const querySnapshot = await getDocs(collection(db, "landlords"));
      const landlordsData = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        landlordsData.push({
          id: doc.id,
          name: data.name || data.fullName || "Unnamed Landlord",
          email: data.email || "No email",
          phone: data.phone || data.phoneNumber || "Not provided",
          propertiesCount: data.totalProperties || data.properties?.length || 0
        });
      });
      
      setLandlords(landlordsData);
      
      if (landlordsData.length === 0) {
        console.log("No landlords found in landlords collection.");
      }
    } catch (error) {
      console.error("Error fetching landlords from landlords collection:", error);
      alert("Failed to load landlords from database.");
    } finally {
      setFetchingLandlords(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // If selecting landlord, also get landlord name
    if (name === "landlordId") {
      const selectedLandlord = landlords.find(l => l.id === value);
      setForm({
        ...form,
        landlordId: value,
        landlordName: selectedLandlord ? selectedLandlord.name : ""
      });
    } else if (name.startsWith("pricing.")) {
      const pricingField = name.split(".")[1];
      setForm({
        ...form,
        pricing: {
          ...form.pricing,
          [pricingField]: value
        }
      });
    } else if (name === "units") {
      // Handle units change - generate units automatically
      const totalUnits = parseInt(value) || 1;
      const generatedUnits = generateUnits(totalUnits, form.name, getPriceForType());
      
      setForm(prev => ({
        ...prev,
        units: totalUnits,
        unitDetails: {
          totalUnits: totalUnits,
          vacantCount: totalUnits,
          leasedCount: 0,
          maintenanceCount: 0,
          occupancyRate: 0,
          units: generatedUnits
        }
      }));
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  // Handle image upload
  const handleImageUpload = async (files) => {
    if (files.length === 0) return;
    
    setUploadingImages(true);
    const uploadedUrls = [];
    
    try {
      for (let i = 0; i < Math.min(files.length, 10); i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        
        // Create a unique filename
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${file.name}`;
        const storageRef = ref(storage, `properties/${fileName}`);
        
        // Upload file
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);
        uploadedUrls.push(downloadURL);
        
        // Update preview
        setPropertyImages(prev => [...prev, { url: downloadURL, name: file.name }]);
      }
      
      // Update form with image URLs
      setForm(prev => ({
        ...prev,
        images: [...prev.images, ...uploadedUrls]
      }));
      
    } catch (error) {
      console.error("Error uploading images:", error);
      alert("Failed to upload some images. Please try again.");
    } finally {
      setUploadingImages(false);
    }
  };

  // Remove image
  const removeImage = (index) => {
    setPropertyImages(prev => prev.filter((_, i) => i !== index));
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    handleImageUpload(files);
  };

  // Handle property type selection
  const handlePropertyTypeSelect = (type) => {
    // When property type changes, regenerate units if name exists
    if (form.name && form.units > 0) {
      const generatedUnits = generateUnits(form.units, form.name, getPriceForType());
      setForm(prev => ({
        ...prev,
        propertyType: type,
        unitDetails: {
          ...prev.unitDetails,
          units: generatedUnits
        }
      }));
    } else {
      setForm(prev => ({ ...prev, propertyType: type }));
    }
  };

  // Handle amenities toggle
  const toggleAmenity = (amenityId) => {
    const newAmenities = form.amenities.includes(amenityId)
      ? form.amenities.filter(id => id !== amenityId)
      : [...form.amenities, amenityId];
    
    // Update amenities in all units if they exist
    const updatedUnits = form.unitDetails.units.map(unit => ({
      ...unit,
      amenities: newAmenities
    }));
    
    setForm(prev => ({
      ...prev,
      amenities: newAmenities,
      unitDetails: {
        ...prev.unitDetails,
        units: updatedUnits
      }
    }));
  };

  // Get price based on property type
  const getPriceForType = () => {
    switch(form.propertyType) {
      case 'single': return form.pricing.single;
      case 'bedsitter': return form.pricing.bedsitter;
      case 'one-bedroom': return form.pricing.oneBedroom;
      case 'two-bedroom': return form.pricing.twoBedroom;
      case 'three-bedroom': return form.pricing.threeBedroom;
      default: return form.rentAmount;
    }
  };

  // Check if property type requires pricing input
  const requiresPricingInput = () => {
    const noPricingTypes = ['apartment', 'commercial', 'one-two-bedroom'];
    return !noPricingTypes.includes(form.propertyType);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.landlordId) {
      alert("Please select a landlord");
      return;
    }
    
    // Validate pricing based on property type
    if (requiresPricingInput()) {
      const selectedPrice = getPriceForType();
      if (!selectedPrice || selectedPrice <= 0) {
        const propertyTypeLabel = propertyTypes.find(t => t.value === form.propertyType)?.label;
        alert(`Please enter a valid price for ${propertyTypeLabel}`);
        return;
      }
    } else if (form.propertyType === 'apartment' || form.propertyType === 'commercial') {
      // For apartment complex and commercial, use rentAmount field
      if (!form.rentAmount || form.rentAmount <= 0) {
        alert("Please enter a valid monthly rent amount");
        return;
      }
    }
    
    setLoading(true);
    
    try {
      // Generate units if not already generated
      const priceForUnits = requiresPricingInput() ? getPriceForType() : form.rentAmount;
      const unitsArray = form.unitDetails.units.length > 0 
        ? form.unitDetails.units 
        : generateUnits(form.units, form.name, priceForUnits);
      
      // Calculate monthly revenue from leased units
      const leasedUnits = unitsArray.filter(unit => unit.status === "leased");
      const monthlyRevenue = leasedUnits.reduce((total, unit) => total + (unit.rentAmount || 0), 0);
      
      // Create property data with unit details
      const propertyData = {
        // Basic info
        name: form.name,
        address: form.address,
        city: form.city,
        country: form.country,
        rentAmount: Number(priceForUnits),
        units: Number(form.units),
        propertyType: form.propertyType,
        bedrooms: Number(form.bedrooms),
        bathrooms: Number(form.bathrooms),
        size: form.size,
        description: form.description,
        amenities: form.amenities,
        images: form.images,
        
        // Landlord info
        landlordId: form.landlordId,
        landlordName: form.landlordName,
        
        // NEW: Application and fee-related fields
        applicationFee: Number(form.applicationFee) || 0,
        securityDeposit: Number(form.securityDeposit) || 0,
        petDeposit: Number(form.petDeposit) || 0,
        otherFees: form.otherFees || "",
        leaseTerm: Number(form.leaseTerm),
        noticePeriod: Number(form.noticePeriod),
        latePaymentFee: Number(form.latePaymentFee) || 0,
        gracePeriod: Number(form.gracePeriod),
        feeDetails: form.feeDetails,
        
        // Unit details
        unitDetails: {
          totalUnits: Number(form.units),
          vacantCount: Number(form.units),
          leasedCount: 0,
          maintenanceCount: 0,
          occupancyRate: 0,
          units: unitsArray
        },
        
        // Status and timestamps
        status: "available",
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        monthlyRevenue: monthlyRevenue,
        totalTenants: leasedUnits.length,
        occupancy: 0
      };
      
      // Add pricing if exists (only for property types that use pricing object)
      if (form.pricing && (Object.values(form.pricing).some(val => val !== ""))) {
        propertyData.pricing = form.pricing;
      }
      
      // Remove empty arrays/strings
      Object.keys(propertyData).forEach(key => {
        if (propertyData[key] === "" || (Array.isArray(propertyData[key]) && propertyData[key].length === 0)) {
          delete propertyData[key];
        }
      });
      
      // Save to Firestore
      const propertyRef = await addDoc(collection(db, "properties"), propertyData);
      const propertyId = propertyRef.id;
      
      console.log("✅ Property created with ID:", propertyId, "with", form.units, "units");
      
      // Update the landlord's document in landlords collection
      const landlordRef = doc(db, "landlords", form.landlordId);
      const currentTime = new Date().toISOString();
      
      await updateDoc(landlordRef, {
        properties: arrayUnion({
          propertyId: propertyId,
          propertyName: form.name,
          address: form.address,
          rentAmount: Number(priceForUnits),
          units: Number(form.units),
          vacantUnits: Number(form.units),
          leasedUnits: 0,
          status: "active",
          addedAt: currentTime,
          propertyType: form.propertyType
        }),
        totalProperties: (form.totalProperties || 0) + 1,
        lastUpdated: serverTimestamp()
      });
      
      console.log("✅ Updated landlord in landlords collection");
      
      alert(`✅ Property added successfully with ${form.units} units!`);
      navigate("/properties");
      
    } catch (error) {
      console.error("Error adding property:", error);
      alert("Error adding property: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate("/properties");
  };

  // Get current property type details
  const currentPropertyType = propertyTypes.find(t => t.value === form.propertyType);

  return (
    <div className="add-property-container">
      <div className="add-property-header">
        <h1>Add New Property</h1>
        <button className="back-button" onClick={handleCancel}>
          ← Back to Properties
        </button>
      </div>
      
      <div className="add-property-card">
        <h2>Property Details</h2>
        <p className="form-subtitle">Fill in property details and assign to a landlord</p>
        
        <form onSubmit={handleSubmit} className="add-property-form">
          
          {/* IMAGE UPLOAD SECTION */}
          <div className="form-section">
            <h3>Property Images</h3>
            <div className="image-upload-section">
              <div 
                className="drop-zone"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
              >
                <FaUpload className="upload-icon" />
                <p>Drag & drop images here or click to browse</p>
                <p className="upload-hint">Recommended: 5-10 images, max 5MB each</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => handleImageUpload(Array.from(e.target.files))}
                  multiple
                  accept="image/*"
                  style={{ display: 'none' }}
                />
              </div>
              
              {uploadingImages && (
                <div className="uploading-status">
                  <div className="spinner"></div>
                  <p>Uploading images...</p>
                </div>
              )}
              
              {propertyImages.length > 0 && (
                <div className="image-preview-container">
                  <h4>Uploaded Images ({propertyImages.length})</h4>
                  <div className="image-grid">
                    {propertyImages.map((image, index) => (
                      <div key={index} className="image-preview">
                        <img src={image.url} alt={`Property ${index + 1}`} />
                        <button
                          type="button"
                          className="remove-image-btn"
                          onClick={() => removeImage(index)}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* PROPERTY TYPE SELECTION */}
          <div className="form-section">
            <h3>Property Type</h3>
            <div className="property-type-grid">
              {propertyTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  className={`property-type-card ${form.propertyType === type.value ? 'selected' : ''}`}
                  onClick={() => handlePropertyTypeSelect(type.value)}
                >
                  <span className="property-icon">{type.icon}</span>
                  <span className="property-label">{type.label}</span>
                  <span className="property-desc">{type.description}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* PRICING SECTION - Dynamic based on property type */}
          {requiresPricingInput() ? (
            <div className="form-section">
              <h3>Pricing</h3>
              <div className="pricing-section">
                <div className="selected-type-display">
                  <h4>Selected: {currentPropertyType?.label}</h4>
                  <p>{currentPropertyType?.description}</p>
                </div>
                
                {/* Display relevant price field based on property type */}
                <div className="price-input-container">
                  {form.propertyType === 'single' && (
                    <div className="form-group">
                      <label className="required">Monthly Rent for Single Room (KSh)</label>
                      <input
                        type="number"
                        name="pricing.single"
                        value={form.pricing.single}
                        onChange={handleChange}
                        placeholder="e.g., 8,000"
                        required
                        disabled={loading}
                      />
                    </div>
                  )}
                  
                  {form.propertyType === 'bedsitter' && (
                    <div className="form-group">
                      <label className="required">Monthly Rent for Bedsitter (KSh)</label>
                      <input
                        type="number"
                        name="pricing.bedsitter"
                        value={form.pricing.bedsitter}
                        onChange={handleChange}
                        placeholder="e.g., 12,000"
                        required
                        disabled={loading}
                      />
                    </div>
                  )}
                  
                  {form.propertyType === 'one-bedroom' && (
                    <div className="form-group">
                      <label className="required">Monthly Rent for 1 Bedroom (KSh)</label>
                      <input
                        type="number"
                        name="pricing.oneBedroom"
                        value={form.pricing.oneBedroom}
                        onChange={handleChange}
                        placeholder="e.g., 25,000"
                        required
                        disabled={loading}
                      />
                    </div>
                  )}
                  
                  {form.propertyType === 'two-bedroom' && (
                    <div className="form-group">
                      <label className="required">Monthly Rent for 2 Bedrooms (KSh)</label>
                      <input
                        type="number"
                        name="pricing.twoBedroom"
                        value={form.pricing.twoBedroom}
                        onChange={handleChange}
                        placeholder="e.g., 40,000"
                        required
                        disabled={loading}
                      />
                    </div>
                  )}
                  
                  {form.propertyType === 'three-bedroom' && (
                    <div className="form-group">
                      <label className="required">Monthly Rent for 3 Bedrooms (KSh)</label>
                      <input
                        type="number"
                        name="pricing.threeBedroom"
                        value={form.pricing.threeBedroom}
                        onChange={handleChange}
                        placeholder="e.g., 60,000"
                        required
                        disabled={loading}
                      />
                    </div>
                  )}
                  
                  <div className="price-summary">
                    <p><strong>Monthly Revenue Estimate:</strong> KSh {(getPriceForType() || 0) * form.units}</p>
                    <p className="note">Based on {form.units} unit(s) × KSh {getPriceForType() || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // For apartment complex and commercial properties
            <div className="form-section">
              <h3>Monthly Rent</h3>
              <div className="pricing-section">
                <div className="selected-type-display">
                  <h4>{currentPropertyType?.label}</h4>
                  <p>{currentPropertyType?.description}</p>
                  <p className="note">Enter the base monthly rent amount</p>
                </div>
                
                <div className="form-group">
                  <label className="required">Monthly Rent Amount (KSh)</label>
                  <input
                    type="number"
                    name="rentAmount"
                    value={form.rentAmount}
                    onChange={handleChange}
                    placeholder={form.propertyType === 'commercial' ? "e.g., 50,000" : "e.g., 15,000"}
                    required
                    disabled={loading}
                  />
                  <div className="price-summary">
                    <p><strong>Total Monthly Potential:</strong> KSh {(form.rentAmount || 0) * form.units}</p>
                    <p className="note">{form.units} unit(s) × KSh {form.rentAmount || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* FEES AND DEPOSITS SECTION - NEW */}
          <div className="form-section">
            <h3>Fees & Deposits</h3>
            <p className="form-subtitle">Set application fees, deposits, and other charges</p>
            
            <div className="form-row">
              <div className="form-group">
                <label>Application Fee (KSh)</label>
                <input
                  type="number"
                  name="applicationFee"
                  value={form.applicationFee}
                  onChange={handleChange}
                  placeholder="e.g., 1,000"
                  disabled={loading}
                />
                <small className="form-hint">One-time non-refundable fee</small>
              </div>
              
              <div className="form-group">
                <label>Security Deposit (KSh)</label>
                <input
                  type="number"
                  name="securityDeposit"
                  value={form.securityDeposit}
                  onChange={handleChange}
                  placeholder="e.g., 15,000"
                  disabled={loading}
                />
                <small className="form-hint">Refundable deposit (usually 1-2 months rent)</small>
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Pet Deposit (KSh)</label>
                <input
                  type="number"
                  name="petDeposit"
                  value={form.petDeposit}
                  onChange={handleChange}
                  placeholder="e.g., 5,000"
                  disabled={loading}
                />
                <small className="form-hint">If pets are allowed</small>
              </div>
              
              <div className="form-group">
                <label>Late Payment Fee (KSh)</label>
                <input
                  type="number"
                  name="latePaymentFee"
                  value={form.latePaymentFee}
                  onChange={handleChange}
                  placeholder="e.g., 500"
                  disabled={loading}
                />
                <small className="form-hint">Per day late fee</small>
              </div>
            </div>
            
            <div className="form-group">
              <label>Other Fees (Description)</label>
              <textarea
                name="otherFees"
                value={form.otherFees}
                onChange={handleChange}
                placeholder="Describe any other fees or charges..."
                rows="2"
                disabled={loading}
              />
              <small className="form-hint">Parking fees, storage, etc.</small>
            </div>
            
            {/* Lease Terms */}
            <div className="form-row">
              <div className="form-group">
                <label>Standard Lease Term (Months)</label>
                <select
                  name="leaseTerm"
                  value={form.leaseTerm}
                  onChange={handleChange}
                  disabled={loading}
                >
                  <option value="6">6 Months</option>
                  <option value="12">12 Months</option>
                  <option value="24">24 Months</option>
                  <option value="36">36 Months</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Notice Period (Days)</label>
                <select
                  name="noticePeriod"
                  value={form.noticePeriod}
                  onChange={handleChange}
                  disabled={loading}
                >
                  <option value="30">30 Days</option>
                  <option value="60">60 Days</option>
                  <option value="90">90 Days</option>
                </select>
              </div>
            </div>
            
            {/* Fee Inclusions */}
            <div className="form-group">
              <label className="fee-inclusion-label">What's Included in Rent?</label>
              <div className="fee-inclusions-grid">
                <div className="fee-inclusion-checkbox">
                  <input
                    type="checkbox"
                    id="includesWater"
                    checked={form.feeDetails.includesWater}
                    onChange={(e) => setForm({
                      ...form,
                      feeDetails: {
                        ...form.feeDetails,
                        includesWater: e.target.checked
                      }
                    })}
                  />
                  <label htmlFor="includesWater">Water Bill</label>
                </div>
                
                <div className="fee-inclusion-checkbox">
                  <input
                    type="checkbox"
                    id="includesElectricity"
                    checked={form.feeDetails.includesElectricity}
                    onChange={(e) => setForm({
                      ...form,
                      feeDetails: {
                        ...form.feeDetails,
                        includesElectricity: e.target.checked
                      }
                    })}
                  />
                  <label htmlFor="includesElectricity">Electricity</label>
                </div>
                
                <div className="fee-inclusion-checkbox">
                  <input
                    type="checkbox"
                    id="includesInternet"
                    checked={form.feeDetails.includesInternet}
                    onChange={(e) => setForm({
                      ...form,
                      feeDetails: {
                        ...form.feeDetails,
                        includesInternet: e.target.checked
                      }
                    })}
                  />
                  <label htmlFor="includesInternet">Internet</label>
                </div>
                
                <div className="fee-inclusion-checkbox">
                  <input
                    type="checkbox"
                    id="includesMaintenance"
                    checked={form.feeDetails.includesMaintenance}
                    onChange={(e) => setForm({
                      ...form,
                      feeDetails: {
                        ...form.feeDetails,
                        includesMaintenance: e.target.checked
                      }
                    })}
                  />
                  <label htmlFor="includesMaintenance">Maintenance</label>
                </div>
              </div>
            </div>
          </div>
          
          {/* AMENITIES SECTION */}
          <div className="form-section">
            <h3>Amenities & Features</h3>
            <div className="amenities-grid">
              {amenitiesOptions.map((amenity) => (
                <div
                  key={amenity.id}
                  className={`amenity-checkbox ${form.amenities.includes(amenity.id) ? 'selected' : ''}`}
                  onClick={() => toggleAmenity(amenity.id)}
                >
                  <div className="amenity-icon">{amenity.icon}</div>
                  <span className="amenity-label">{amenity.label}</span>
                  <input
                    type="checkbox"
                    checked={form.amenities.includes(amenity.id)}
                    onChange={() => {}}
                    style={{ display: 'none' }}
                  />
                </div>
              ))}
            </div>
          </div>
          
          {/* Basic Property Info */}
          <div className="form-section">
            <h3>Property Information</h3>
            
            <div className="form-group">
              <label className="required">Property Name</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g., Greenview Apartments"
                required
                disabled={loading}
              />
              {form.name && form.units > 0 && (
                <p className="form-hint">
                  Units will be named: {form.name.replace(/\s+/g, '').substring(0, 3).toUpperCase()}-001 to {form.name.replace(/\s+/g, '').substring(0, 3).toUpperCase()}-{form.units.toString().padStart(3, '0')}
                </p>
              )}
            </div>
            
            <div className="form-group">
              <label className="required">Address</label>
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Full physical address"
                required
                disabled={loading}
              />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label className="required">City</label>
                <input
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="e.g., Nairobi"
                  required
                  disabled={loading}
                />
              </div>
              
              <div className="form-group">
                <label className="required">Country</label>
                <select
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                  required
                  disabled={loading}
                >
                  <option value="Kenya">Kenya</option>
                  <option value="Uganda">Uganda</option>
                  <option value="Tanzania">Tanzania</option>
                  <option value="Rwanda">Rwanda</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            
            {/* Professional Bedrooms/Bathrooms Section - Only show for property types that have bedrooms */}
            {currentPropertyType?.hasBedrooms ? (
              <div className="form-row">
                <div className="form-group">
                  <label>Bedrooms</label>
                  <select
                    name="bedrooms"
                    value={form.bedrooms}
                    onChange={handleChange}
                    disabled={loading}
                  >
                    {[1, 2, 3, 4, 5, 6].map(num => (
                      <option key={num} value={num}>{num} {num === 1 ? 'Bedroom' : 'Bedrooms'}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Bathrooms</label>
                  <select
                    name="bathrooms"
                    value={form.bathrooms}
                    onChange={handleChange}
                    disabled={loading}
                  >
                    {[1, 2, 3, 4].map(num => (
                      <option key={num} value={num}>{num} {num === 1 ? 'Bathroom' : 'Bathrooms'}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              // For property types without bedrooms (single, bedsitter, apartment, commercial)
              <div className="property-specs-section">
                <h4>Property Specifications</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Property Size (sq ft)</label>
                    <input
                      type="number"
                      name="size"
                      value={form.size}
                      onChange={handleChange}
                      placeholder="Total area in square feet"
                      disabled={loading}
                    />
                    <small className="form-hint">Total property area</small>
                  </div>
                  
                  {form.propertyType === 'commercial' && (
                    <div className="form-group">
                      <label>Commercial Type</label>
                      <select
                        name="commercialType"
                        value={form.commercialType || ""}
                        onChange={handleChange}
                        disabled={loading}
                      >
                        <option value="">Select type</option>
                        <option value="office">Office Space</option>
                        <option value="retail">Retail Shop</option>
                        <option value="warehouse">Warehouse</option>
                        <option value="industrial">Industrial</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Size input for all property types */}
            {currentPropertyType?.hasBedrooms && (
              <div className="form-group">
                <label>Size (sq ft)</label>
                <input
                  type="number"
                  name="size"
                  value={form.size}
                  onChange={handleChange}
                  placeholder="Total area in square feet"
                  disabled={loading}
                />
                <small className="form-hint">Total property area</small>
              </div>
            )}
            
            {/* UNITS INPUT WITH PREVIEW */}
            <div className="form-group">
              <label className="required">Number of Units</label>
              <div className="units-input-container">
                <input
                  type="number"
                  name="units"
                  value={form.units}
                  onChange={handleChange}
                  min="1"
                  max="500"
                  required
                  disabled={loading}
                  className="units-input"
                />
                <span className="units-label">units</span>
              </div>
              <small className="form-hint">
                {form.units} unit(s) will be created. Each can be managed individually.
              </small>
              
              {/* Unit Preview */}
              {form.units > 0 && (
                <div className="units-preview">
                  <div className="units-stats-preview">
                    <div className="stat-item">
                      <FaBuilding />
                      <span className="stat-value">{form.units}</span>
                      <span className="stat-label">Total</span>
                    </div>
                    <div className="stat-item vacant">
                      <FaDoorClosed />
                      <span className="stat-value">{form.units}</span>
                      <span className="stat-label">Vacant</span>
                    </div>
                    <div className="stat-item leased">
                      <FaCheckCircle />
                      <span className="stat-value">0</span>
                      <span className="stat-label">Leased</span>
                    </div>
                    <div className="stat-item maintenance">
                      <FaHome />
                      <span className="stat-value">0</span>
                      <span className="stat-label">Maintenance</span>
                    </div>
                  </div>
                  
                  {form.units <= 10 && form.unitDetails.units.length > 0 && (
                    <div className="units-list-preview">
                      <p className="preview-title">First 10 Unit Numbers:</p>
                      <div className="unit-numbers-grid">
                        {form.unitDetails.units.slice(0, 10).map((unit, index) => (
                          <span key={index} className="unit-number-badge">
                            {unit.unitNumber}
                          </span>
                        ))}
                        {form.units > 10 && (
                          <span className="unit-number-badge more">
                            +{form.units - 10} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder={`Describe the ${form.propertyType === 'commercial' ? 'commercial space' : 'property'} features, location, access routes...`}
                rows="4"
                disabled={loading}
              />
            </div>
          </div>
          
          {/* Landlord Assignment */}
          <div className="form-section">
            <h3>Assign to Landlord</h3>
            
            <div className="form-group">
              <label className="required">Select Landlord</label>
              {fetchingLandlords ? (
                <div className="loading-state">
                  <div className="spinner-small"></div>
                  <span>Loading landlords...</span>
                </div>
              ) : landlords.length === 0 ? (
                <div className="no-landlords">
                  <p>No landlords found in the system.</p>
                  <button 
                    type="button" 
                    className="secondary-button"
                    onClick={() => navigate("/landlords/add")}
                  >
                    Register a Landlord First
                  </button>
                </div>
              ) : (
                <select
                  name="landlordId"
                  value={form.landlordId}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className="landlord-select"
                >
                  <option value="">-- Select a Landlord --</option>
                  {landlords.map(landlord => (
                    <option key={landlord.id} value={landlord.id}>
                      {landlord.name} ({landlord.email}) - {landlord.propertiesCount} properties
                    </option>
                  ))}
                </select>
              )}
              
              {form.landlordName && (
                <div className="selected-landlord-info">
                  <p>Selected: <strong>{form.landlordName}</strong></p>
                </div>
              )}
            </div>
          </div>
          
          <div className="form-actions">
            <button 
              type="button" 
              className="cancel-button" 
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="submit-button"
              disabled={loading || fetchingLandlords || landlords.length === 0}
            >
              {loading ? (
                <>
                  <span className="spinner-small"></span>
                  Adding Property...
                </>
              ) : `Add ${currentPropertyType?.label} with ${form.units} Units`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProperty;