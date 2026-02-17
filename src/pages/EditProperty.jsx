// src/pages/EditProperty.jsx - UPDATED WITH CLOUDINARY
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  Timestamp,
  addDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../pages/firebase/firebase";
import { uploadMultipleImages } from "../services/cloudinary"; // Import Cloudinary service
import "../styles/EditProperty.css";
import {
  FaSave,
  FaTimes,
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
  FaTrash,
  FaUpload,
  FaMapMarkerAlt,
  FaUser,
  FaEye,
  FaEdit,
  FaPlus,
  FaSearch,
  FaMoneyBillWave,
  FaFileSignature,
  FaPaw,
  FaClock,
  FaTint,
  FaBolt,
  FaWrench
} from "react-icons/fa";

const EditProperty = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [propertyImages, setPropertyImages] = useState([]);

  // NEW: State for Unit Images
  const [unitImages, setUnitImages] = useState([]);
  const [uploadingUnitImages, setUploadingUnitImages] = useState(false);
  const unitFileInputRef = React.useRef(null);

  // Property types with icons and descriptions - MUST MATCH AddProperty.jsx
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

  // Amenities options - MUST MATCH AddProperty.jsx
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

  // State structure - MUST MATCH AddProperty.jsx
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
    // NEW: Application and fee-related fields - MUST MATCH AddProperty.jsx
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

  // Fetch property data
  useEffect(() => {
    fetchProperty();
  }, [id]);

  const fetchProperty = async () => {
    try {
      setLoading(true);
      const docRef = doc(db, "properties", id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log("Fetched property data:", data); // Debug log

        // Load images for preview
        if (data.images && data.images.length > 0) {
          setPropertyImages(data.images.map(url => ({ url, name: "Property Image" })));
        }

        // Set form with all fields - MUST MATCH AddProperty.jsx structure
        setForm({
          // Basic info
          name: data.name || "",
          address: data.address || "",
          city: data.city || "",
          country: data.country || "Kenya",
          rentAmount: data.rentAmount || "",
          units: data.units || 1,
          propertyType: data.propertyType || "apartment",
          bedrooms: data.bedrooms || 1,
          bathrooms: data.bathrooms || 1,
          size: data.size || "",
          description: data.description || "",
          amenities: data.amenities || [],
          images: data.images || [],

          // Landlord info
          landlordId: data.landlordId || "",
          landlordName: data.landlordName || "",

          // NEW: Fee-related fields
          applicationFee: data.applicationFee || "",
          securityDeposit: data.securityDeposit || "",
          petDeposit: data.petDeposit || "",
          otherFees: data.otherFees || "",
          leaseTerm: data.leaseTerm || 12,
          noticePeriod: data.noticePeriod || 30,
          latePaymentFee: data.latePaymentFee || "",
          gracePeriod: data.gracePeriod || 5,
          feeDetails: data.feeDetails || {
            includesWater: false,
            includesElectricity: false,
            includesInternet: false,
            includesMaintenance: false
          },

          // Pricing
          pricing: data.pricing || {
            single: "",
            bedsitter: "",
            oneBedroom: "",
            twoBedroom: "",
            threeBedroom: ""
          },

          // Unit details
          unitDetails: {
            totalUnits: data.units || 1,
            vacantCount: data.unitDetails?.vacantCount || data.units || 1,
            leasedCount: data.unitDetails?.leasedCount || 0,
            maintenanceCount: data.unitDetails?.maintenanceCount || 0,
            occupancyRate: data.unitDetails?.occupancyRate || 0,
            units: data.unitDetails?.units || []
          },

          // Status
          status: data.status || "available"
        });
      } else {
        alert("Property not found");
        navigate("/properties");
      }
    } catch (error) {
      console.error("Error fetching property:", error);
      alert("Failed to load property");
    } finally {
      setLoading(false);
    }
  };

  // Handle input changes - MUST MATCH AddProperty.jsx logic
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name.startsWith("pricing.")) {
      const pricingField = name.split(".")[1];
      setForm(prev => ({
        ...prev,
        pricing: {
          ...prev.pricing,
          [pricingField]: value
        }
      }));
    } else if (name === "units") {
      const totalUnits = parseInt(value) || 1;
      setForm(prev => ({
        ...prev,
        units: totalUnits,
        unitDetails: {
          ...prev.unitDetails,
          totalUnits: totalUnits,
          vacantCount: totalUnits - (prev.unitDetails.leasedCount || 0) - (prev.unitDetails.maintenanceCount || 0)
        }
      }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  // Handle property type selection - MUST MATCH AddProperty.jsx
  const handlePropertyTypeSelect = (type) => {
    setForm(prev => ({ ...prev, propertyType: type }));
  };

  // Handle amenities toggle - MUST MATCH AddProperty.jsx
  const toggleAmenity = (amenityId) => {
    const newAmenities = form.amenities.includes(amenityId)
      ? form.amenities.filter(id => id !== amenityId)
      : [...form.amenities, amenityId];

    setForm(prev => ({
      ...prev,
      amenities: newAmenities
    }));
  };

  // Handle image upload - UPDATED TO USE CLOUDINARY
  const handleImageUpload = async (files) => {
    if (files.length === 0) return;

    setUploadingImages(true);

    try {
      // Use Cloudinary service to upload images
      const uploadResults = await uploadMultipleImages(files, {
        folder: 'properties' // Use the same folder as AddProperty.jsx
      });

      console.log("Cloudinary upload results:", uploadResults);

      // Filter successful uploads
      const successfulUploads = uploadResults.filter(result => result.success);
      const uploadedUrls = successfulUploads.map(result => result.url);

      // Update preview
      successfulUploads.forEach((result, index) => {
        setPropertyImages(prev => [...prev, {
          url: result.url,
          name: `Property Image ${index + 1}`,
          size: result.bytes
        }]);
      });

      // Update form with Cloudinary URLs
      setForm(prev => ({
        ...prev,
        images: [...prev.images, ...uploadedUrls]
      }));

      // Show warning for failed uploads
      const failedUploads = uploadResults.filter(result => !result.success);
      if (failedUploads.length > 0) {
        console.warn(`${failedUploads.length} image(s) failed to upload`);
      }

      if (successfulUploads.length > 0) {
        alert(`✅ ${successfulUploads.length} image(s) uploaded successfully to Cloudinary!`);
      }

    } catch (error) {
      console.error("Image upload error:", error);
      alert(`Failed to upload images: ${error.message}`);
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

  // --- NEW: Unit Image Handlers ---

  const handleUnitImageUpload = async (files) => {
    if (files.length === 0) return;

    setUploadingUnitImages(true);

    try {
      // Use Cloudinary service to upload images
      const uploadResults = await uploadMultipleImages(files, {
        folder: form.name ? `properties/${form.name.replace(/\s+/g, '_')}/units` : 'properties/units'
      });

      // Filter successful uploads
      const successfulUploads = uploadResults.filter(result => result.success);

      // Update preview
      successfulUploads.forEach((result, index) => {
        setUnitImages(prev => [...prev, {
          url: result.url,
          name: `Unit Image ${index + 1}`,
          size: result.bytes
        }]);
      });

      // Show warning for failed uploads
      const failedUploads = uploadResults.filter(result => !result.success);
      if (failedUploads.length > 0) {
        console.warn(`${failedUploads.length} unit image(s) failed to upload`);
      }

    } catch (error) {
      console.error("Unit image upload error:", error);
      alert("Failed to upload unit images. Please try again.");
    } finally {
      setUploadingUnitImages(false);
    }
  };

  const removeUnitImage = (index) => {
    setUnitImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleUnitDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleUnitDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    handleUnitImageUpload(files);
  };

  // Check if property type requires pricing input - MUST MATCH AddProperty.jsx
  const requiresPricingInput = () => {
    const noPricingTypes = ['apartment', 'commercial', 'one-two-bedroom'];
    return !noPricingTypes.includes(form.propertyType);
  };

  // Get price based on property type - MUST MATCH AddProperty.jsx
  const getPriceForType = () => {
    switch (form.propertyType) {
      case 'single': return form.pricing.single;
      case 'bedsitter': return form.pricing.bedsitter;
      case 'one-bedroom': return form.pricing.oneBedroom;
      case 'two-bedroom': return form.pricing.twoBedroom;
      case 'three-bedroom': return form.pricing.threeBedroom;
      default: return form.rentAmount;
    }
  };

  // Get current property type details
  const currentPropertyType = propertyTypes.find(t => t.value === form.propertyType);

  // Handle form submission - UPDATED TO SYNC UNITS
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
      if (!form.rentAmount || form.rentAmount <= 0) {
        alert("Please enter a valid monthly rent amount");
        return;
      }
    }

    setSaving(true);

    try {
      // Calculate price for units
      const priceForUnits = requiresPricingInput() ? getPriceForType() : form.rentAmount;
      const numPrice = Number(priceForUnits);

      // Prepare property data
      const propertyData = {
        // Basic info
        name: form.name,
        address: form.address,
        city: form.city,
        country: form.country,
        rentAmount: numPrice,
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

        // Fee-related fields
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
          vacantCount: form.unitDetails.vacantCount,
          leasedCount: form.unitDetails.leasedCount,
          maintenanceCount: form.unitDetails.maintenanceCount,
          occupancyRate: form.unitDetails.occupancyRate,
          units: form.unitDetails.units
        },

        // Status and timestamps
        status: form.status,
        updatedAt: Timestamp.now()
      };

      // Add pricing if exists
      if (form.pricing && (Object.values(form.pricing).some(val => val !== ""))) {
        propertyData.pricing = form.pricing;
      }

      // 1. Update Property Document
      const propertyRef = doc(db, "properties", id);
      await updateDoc(propertyRef, propertyData);

      // 2. Propagate changes to Units Subcollection
      // Fetch all units first to verify count and update details
      const unitsRef = collection(db, `properties/${id}/units`);
      const unitsSnapshot = await getDocs(unitsRef);
      const currentActualUnits = unitsSnapshot.size;
      const targetUnits = Number(form.units);

      console.log(`Syncing units: Current=${currentActualUnits}, Target=${targetUnits}`);

      // --- HANDLE UNIT ADDITION/REMOVAL ---
      if (targetUnits > currentActualUnits) {
        // ADD NEW UNITS
        const unitsToAdd = targetUnits - currentActualUnits;
        const propertyPrefix = form.name
          ? form.name.replace(/\s+/g, '').substring(0, 3).toUpperCase()
          : 'APT';

        let baseRent = 0;
        switch (form.propertyType) {
          case 'single': baseRent = parseFloat(form.pricing.single) || 0; break;
          case 'bedsitter': baseRent = parseFloat(form.pricing.bedsitter) || 0; break;
          case 'one-bedroom': baseRent = parseFloat(form.pricing.oneBedroom) || 0; break;
          case 'two-bedroom': baseRent = parseFloat(form.pricing.twoBedroom) || 0; break;
          case 'three-bedroom': baseRent = parseFloat(form.pricing.threeBedroom) || 0; break;
          default: baseRent = parseFloat(form.rentAmount) || 0;
        }

        const addPromises = [];
        for (let i = 1; i <= unitsToAdd; i++) {
          const newUnitNum = currentActualUnits + i;
          const unitNumber = newUnitNum.toString().padStart(3, '0');

          // Determine specs for mixed type
          let unitBedrooms = Number(form.bedrooms);
          let unitBathrooms = Number(form.bathrooms);
          let unitRent = baseRent;

          if (form.propertyType === "one-two-bedroom") {
            const isOneBedroom = newUnitNum % 2 === 1;
            unitBedrooms = isOneBedroom ? 1 : 2;
            unitBathrooms = isOneBedroom ? 1 : 2;
            unitRent = isOneBedroom ?
              (parseFloat(form.pricing.oneBedroom) || 0) :
              (parseFloat(form.pricing.twoBedroom) || 0);
          } else {
            // For regular types, rely on property settings
            // (already grabbed from form)
          }

          const newUnitData = {
            unitId: `${propertyPrefix}-${unitNumber}`,
            unitNumber: unitNumber,
            unitName: `${form.name} - Unit ${unitNumber}`,
            propertyId: id,
            propertyName: form.name,
            propertyAddress: form.address,
            propertyType: form.propertyType,

            // Specs
            bedrooms: unitBedrooms,
            bathrooms: unitBathrooms,
            size: form.size || "",
            amenities: form.amenities,
            images: unitImages.length > 0 ? unitImages.map(img => img.url) : (form.images || []),

            // Financials
            rentAmount: unitRent,
            applicationFee: propertyData.applicationFee,
            securityDeposit: propertyData.securityDeposit,
            petDeposit: propertyData.petDeposit,
            leaseTerm: propertyData.leaseTerm,
            noticePeriod: propertyData.noticePeriod,
            latePaymentFee: propertyData.latePaymentFee,
            gracePeriod: propertyData.gracePeriod,
            feeDetails: propertyData.feeDetails,

            // Status
            status: "vacant",
            isAvailable: true,
            isActive: true,

            // Empty Tenant Fields
            tenantId: null,
            tenantName: "",
            tenantPhone: "",
            tenantEmail: "",

            maintenanceRequests: 0,
            createdAt: serverTimestamp(), // Need to import this
            updatedAt: serverTimestamp(),
            unitOrder: newUnitNum,

            searchKeywords: [
              form.name.toLowerCase(),
              `unit ${unitNumber}`.toLowerCase(),
              "vacant"
            ]
          };

          addPromises.push(addDoc(unitsRef, newUnitData)); // Need to import addDoc
        }
        await Promise.all(addPromises);
        console.log(`Added ${unitsToAdd} new units.`);

      } else if (targetUnits < currentActualUnits) {
        // REMOVE UNITS (Latest first)
        const unitsToRemove = currentActualUnits - targetUnits;

        // Sort units by unitNumber descending to find the last created ones
        const sortedUnits = unitsSnapshot.docs.sort((a, b) => {
          const numA = parseInt(a.data().unitNumber) || 0;
          const numB = parseInt(b.data().unitNumber) || 0;
          return numB - numA;
        });

        const unitsToDelete = sortedUnits.slice(0, unitsToRemove);

        // Check for occupancy
        const occupiedUnits = unitsToDelete.filter(doc => {
          const d = doc.data();
          return d.status !== 'vacant' || d.tenantId;
        });

        if (occupiedUnits.length > 0) {
          throw new Error(`Cannot reduce units to ${targetUnits}. The following high-numbered units are occupied: ${occupiedUnits.map(d => d.data().unitName).join(', ')}. Please vacant them or move tenants first.`);
        }

        const deletePromises = unitsToDelete.map(doc => deleteDoc(doc.ref)); // Need deleteDoc
        await Promise.all(deletePromises);
        console.log(`Removed ${unitsToRemove} vacant units.`);
      }

      // --- END UNIT SYNC ---

      // Re-fetch units if we changed them, to ensure updates apply to all (including new ones if any, though new ones have latest data already)
      // Actually, we can just update the *remaining* units from the original snapshot + the *new* ones are already correct.
      // But for simplicity, let's just proceed to update the *originally existing* units that weren't deleted.
      // If we added units, they are already up to date. If we deleted, they are gone.
      // We only need to update the *surviving* units from the original snapshot.

      if (!unitsSnapshot.empty) {
        const batchUpdates = unitsSnapshot.docs.map(async (unitDoc) => {
          // Skip if this doc was just deleted
          if (targetUnits < currentActualUnits) {
            const unitNum = parseInt(unitDoc.data().unitNumber);
            if (unitNum > targetUnits) return; // This was deleted
          }

          const unit = unitDoc.data();
          const unitRef = doc(db, `properties/${id}/units`, unitDoc.id);

          const updates = {
            // ALWAYS update policy/fee fields to match property
            // This ensures all units have the latest fees
            applicationFee: propertyData.applicationFee,
            securityDeposit: propertyData.securityDeposit,
            petDeposit: propertyData.petDeposit,
            leaseTerm: propertyData.leaseTerm,
            noticePeriod: propertyData.noticePeriod,
            latePaymentFee: propertyData.latePaymentFee,
            gracePeriod: propertyData.gracePeriod,
            feeDetails: propertyData.feeDetails,
            amenities: propertyData.amenities,
            propertyType: propertyData.propertyType,
            updatedAt: new Date().toISOString(),
            rentAmount: numPrice,
            // Don't overwrite deposit if it was custom, but here we enforce property default for consistency or check logic
            // The original code reset it: deposit: propertyData.securityDeposit
          };

          // NEW: Update unit images if provided
          if (unitImages.length > 0) {
            updates.images = unitImages.map(img => img.url);
          }

          await updateDoc(unitRef, updates);
        });

        await Promise.all(batchUpdates);
        console.log(`Updated existing units with property changes`);
      }

      alert("✅ Property and associated units updated successfully!");
      navigate("/properties");

    } catch (error) {
      console.error("Error updating property:", error);
      alert("Error updating property: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (window.confirm("Are you sure? Any unsaved changes will be lost.")) {
      navigate("/properties");
    }
  };

  if (loading) {
    return (
      <div className="edit-property-loading">
        <div className="spinner"></div>
        <p>Loading property data...</p>
      </div>
    );
  }

  return (
    <div className="add-property-container">
      <div className="add-property-header">
        <h1>Edit Property: {form.name}</h1>
        <button className="back-button" onClick={handleCancel}>
          ← Cancel
        </button>
      </div>

      <div className="add-property-card">
        <h2>Edit Property Details</h2>
        <p className="form-subtitle">Update property details and fees</p>

        <form onSubmit={handleSubmit} className="add-property-form">

          {/* IMAGE UPLOAD SECTION - UPDATED FOR CLOUDINARY */}
          <div className="form-section">
            <h3>Property Images</h3>
            <div className="image-upload-section">
              <div
                className="drop-zone"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => document.getElementById('image-upload-input').click()}
              >
                <FaUpload className="upload-icon" />
                <p>Drag & drop images here or click to browse</p>
                <p className="upload-hint">Recommended: 5-10 images, max 5MB each</p>
                <input
                  id="image-upload-input"
                  type="file"
                  onChange={(e) => handleImageUpload(Array.from(e.target.files))}
                  multiple
                  accept="image/*"
                  style={{ display: 'none' }}
                />
              </div>

              {uploadingImages && (
                <div className="uploading-status">
                  <div className="spinner"></div>
                  <p>Uploading images to Cloudinary...</p>
                </div>
              )}

              {propertyImages.length > 0 && (
                <div className="image-preview-container">
                  <h4>Property Images ({propertyImages.length})</h4>
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
                        disabled={saving}
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
                        disabled={saving}
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
                        disabled={saving}
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
                        disabled={saving}
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
                        disabled={saving}
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
                    disabled={saving}
                  />
                  <div className="price-summary">
                    <p><strong>Total Monthly Potential:</strong> KSh {(form.rentAmount || 0) * form.units}</p>
                    <p className="note">{form.units} unit(s) × KSh {form.rentAmount || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FEES AND DEPOSITS SECTION - MATCHING AddProperty.jsx */}
          <div className="form-section">
            <h3>Fees & Deposits</h3>
            <p className="form-subtitle">Update application fees, deposits, and other charges</p>

            <div className="form-row">
              <div className="form-group">
                <label>Application Fee (KSh)</label>
                <input
                  type="number"
                  name="applicationFee"
                  value={form.applicationFee}
                  onChange={handleChange}
                  placeholder="e.g., 1,000"
                  disabled={saving}
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
                  disabled={saving}
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
                  disabled={saving}
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
                  disabled={saving}
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
                disabled={saving}
              />
              <small className="form-hint">Parking fees, storage, etc.</small>
            </div>

            {/* NEW: Unit Images Upload Section */}
            <div className="form-group">
              <label>Default Unit Images</label>
              <p className="form-helper">These images will be applied to ALL units. Existing unit images will be overwritten if you upload new ones here.</p>

              <div
                className={`image-upload-area ${uploadingUnitImages ? 'uploading' : ''}`}
                onDragOver={handleUnitDragOver}
                onDrop={handleUnitDrop}
                onClick={() => unitFileInputRef.current.click()}
              >
                <FaUpload className="upload-icon" />
                <p>Drag & drop unit images here or click to browse</p>
                <p className="upload-hint">Interior views, bathroom, kitchen specific to units</p>
                <input
                  type="file"
                  ref={unitFileInputRef}
                  onChange={(e) => handleUnitImageUpload(Array.from(e.target.files))}
                  multiple
                  accept="image/*"
                  style={{ display: 'none' }}
                />
              </div>

              {uploadingUnitImages && (
                <div className="uploading-status">
                  <div className="spinner"></div>
                  <p>Uploading unit images...</p>
                </div>
              )}

              {unitImages.length > 0 && (
                <div className="image-preview-container">
                  <h4>Uploaded Unit Images ({unitImages.length})</h4>
                  <div className="image-grid">
                    {unitImages.map((image, index) => (
                      <div key={index} className="image-preview">
                        <img src={image.url} alt={`Unit ${index + 1}`} />
                        <button
                          type="button"
                          className="remove-image-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeUnitImage(index);
                          }}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Lease Terms */}
            <div className="form-row">
              <div className="form-group">
                <label>Standard Lease Term (Months)</label>
                <select
                  name="leaseTerm"
                  value={form.leaseTerm}
                  onChange={handleChange}
                  disabled={saving}
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
                  disabled={saving}
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
                    onChange={() => { }}
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
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label className="required">Address</label>
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Full physical address"
                required
                disabled={saving}
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
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label className="required">Country</label>
                <select
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                  required
                  disabled={saving}
                >
                  <option value="Kenya">Kenya</option>
                  <option value="Uganda">Uganda</option>
                  <option value="Tanzania">Tanzania</option>
                  <option value="Rwanda">Rwanda</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Professional Bedrooms/Bathrooms Section */}
            {currentPropertyType?.hasBedrooms ? (
              <div className="form-row">
                <div className="form-group">
                  <label>Bedrooms</label>
                  <select
                    name="bedrooms"
                    value={form.bedrooms}
                    onChange={handleChange}
                    disabled={saving}
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
                    disabled={saving}
                  >
                    {[1, 2, 3, 4].map(num => (
                      <option key={num} value={num}>{num} {num === 1 ? 'Bathroom' : 'Bathrooms'}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
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
                      disabled={saving}
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
                        disabled={saving}
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
                  disabled={saving}
                />
                <small className="form-hint">Total property area</small>
              </div>
            )}

            {/* UNITS INPUT */}
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
                  disabled={saving}
                  className="units-input"
                />
                <span className="units-label">units</span>
              </div>
              <small className="form-hint">
                {form.units} unit(s) in this property
              </small>
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder={`Describe the ${form.propertyType === 'commercial' ? 'commercial space' : 'property'} features, location, access routes...`}
                rows="4"
                disabled={saving}
              />
            </div>
          </div>

          {/* Status Section */}
          <div className="form-section">
            <h3>Property Status</h3>
            <div className="form-group">
              <label>Current Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                disabled={saving}
                className="status-select"
              >
                <option value="available">Available</option>
                <option value="leased">Leased</option>
                <option value="vacant">Vacant</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-button"
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="spinner-small"></span>
                  Updating Property...
                </>
              ) : `Update ${currentPropertyType?.label}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProperty;