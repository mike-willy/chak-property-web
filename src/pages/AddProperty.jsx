// src/pages/AddProperty.jsx - FIXED VERSION
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
  
  // Property types with icons, descriptions, and AUTO bedroom/bathroom mapping
  const propertyTypes = [
    { 
      value: "single", 
      label: "Single Room", 
      icon: "🏠", 
      description: "Single self-contained room", 
      hasBedrooms: false,
      autoBedrooms: 0,    // Single room doesn't have separate bedroom count
      autoBathrooms: 1    // Usually has 1 bathroom
    },
    { 
      value: "bedsitter", 
      label: "Bedsitter", 
      icon: "🛌", 
      description: "Bed-sitting room with kitchenette", 
      hasBedrooms: false,
      autoBedrooms: 0,    // Studio style
      autoBathrooms: 1    // Usually has 1 bathroom
    },
    { 
      value: "one-bedroom", 
      label: "One Bedroom", 
      icon: "1️⃣", 
      description: "One bedroom apartment", 
      hasBedrooms: true,
      autoBedrooms: 1,    // 1 bedroom
      autoBathrooms: 1    // 1 bathroom
    },
    { 
      value: "two-bedroom", 
      label: "Two Bedroom", 
      icon: "2️⃣", 
      description: "Two bedroom apartment", 
      hasBedrooms: true,
      autoBedrooms: 2,    // 2 bedrooms
      autoBathrooms: 2    // 2 bathrooms
    },
    { 
      value: "three-bedroom", 
      label: "Three Bedroom", 
      icon: "3️⃣", 
      description: "Three bedroom apartment", 
      hasBedrooms: true,
      autoBedrooms: 3,    // 3 bedrooms
      autoBathrooms: 3    // 3 bathrooms
    },
    { 
      value: "one-two-bedroom", 
      label: "1BR + 2BR", 
      icon: "🏘️", 
      description: "Mix of 1BR and 2BR units", 
      hasBedrooms: true,
      autoBedrooms: 0,    // Mixed - will be set per unit
      autoBathrooms: 0    // Mixed - will be set per unit
    },
    { 
      value: "apartment", 
      label: "Apartment Complex", 
      icon: "🏢", 
      description: "Multi-unit apartment building", 
      hasBedrooms: false,
      autoBedrooms: 1,    // Default 1 bedroom for apartment units
      autoBathrooms: 1    // Default 1 bathroom for apartment units
    },
    { 
      value: "commercial", 
      label: "Commercial", 
      icon: "🏪", 
      description: "Commercial property", 
      hasBedrooms: false,
      autoBedrooms: 0,    // No bedrooms for commercial
      autoBathrooms: 1    // Usually has bathrooms
    },
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
    bedrooms: 1,  // Will be auto-updated when property type changes
    bathrooms: 1, // Will be auto-updated when property type changes
    size: "",
    images: [],
    pricing: {
      single: "",
      bedsitter: "",
      oneBedroom: "",
      twoBedroom: "",
      threeBedroom: ""
    },
    // FEE FIELDS - Fixed: Using strings to prevent number bugs
    applicationFee: "",
    securityDeposit: "",
    petDeposit: "",
    otherFees: "",
    leaseTerm: "12", // Keep as string
    noticePeriod: "30", // Keep as string
    latePaymentFee: "",
    gracePeriod: "5", // Keep as string
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

  // Auto-update bedrooms/bathrooms when property type changes
  useEffect(() => {
    const currentType = propertyTypes.find(t => t.value === form.propertyType);
    if (currentType) {
      // For property types with auto values, update them
      if (form.propertyType !== "one-two-bedroom" && form.propertyType !== "apartment" && form.propertyType !== "commercial") {
        setForm(prev => ({
          ...prev,
          bedrooms: currentType.autoBedrooms,
          bathrooms: currentType.autoBathrooms
        }));
      }
      // For apartment, set default values if not already set
      else if (form.propertyType === "apartment") {
        if (form.bedrooms === 0) {
          setForm(prev => ({ ...prev, bedrooms: 1 }));
        }
        if (form.bathrooms === 0) {
          setForm(prev => ({ ...prev, bathrooms: 1 }));
        }
      }
      // For commercial, set default values
      else if (form.propertyType === "commercial") {
        setForm(prev => ({
          ...prev,
          bedrooms: 0,
          bathrooms: 1
        }));
      }
    }
  }, [form.propertyType]);

  // Function to generate units based on total units count
  const generateUnits = (totalUnits, propertyName, rentAmount, propertyType) => {
    const units = [];
    const propertyPrefix = propertyName 
      ? propertyName.replace(/\s+/g, '').substring(0, 3).toUpperCase() 
      : 'APT';
    
    // Get base rent based on property type
    let baseRent = 0;
    switch(propertyType) {
      case 'single': baseRent = parseFloat(form.pricing.single) || 0; break;
      case 'bedsitter': baseRent = parseFloat(form.pricing.bedsitter) || 0; break;
      case 'one-bedroom': baseRent = parseFloat(form.pricing.oneBedroom) || 0; break;
      case 'two-bedroom': baseRent = parseFloat(form.pricing.twoBedroom) || 0; break;
      case 'three-bedroom': baseRent = parseFloat(form.pricing.threeBedroom) || 0; break;
      default: baseRent = parseFloat(rentAmount) || 0;
    }
    
    // SPECIAL HANDLING FOR MIXED PROPERTY TYPE (one-two-bedroom)
    if (propertyType === "one-two-bedroom") {
      for (let i = 1; i <= totalUnits; i++) {
        const unitNumber = i.toString().padStart(3, '0');
        
        // Alternate between 1BR and 2BR units
        const isOneBedroom = i % 2 === 1; // Odd numbers = 1BR, Even = 2BR
        
        const unitBedrooms = isOneBedroom ? 1 : 2;
        const unitBathrooms = isOneBedroom ? 1 : 2;
        const unitRent = isOneBedroom ? 
          (parseFloat(form.pricing.oneBedroom) || 0) : 
          (parseFloat(form.pricing.twoBedroom) || 0);
        
        units.push({
          unitId: `${propertyPrefix}-${unitNumber}`,
          unitNumber: unitNumber,
          unitName: `${propertyName || 'Property'} - Unit ${unitNumber} (${unitBedrooms}BR)`,
          status: "vacant",
          rentAmount: unitRent,
          size: form.size || "",
          amenities: [...form.amenities],
          // Unit-specific bedroom/bathroom for mixed type
          bedrooms: unitBedrooms,
          bathrooms: unitBathrooms,
          // Tenant info
          tenantId: null,
          tenantName: "",
          tenantPhone: "",
          tenantEmail: "",
          // Lease info
          leaseStart: null,
          leaseEnd: null,
          rentPaidUntil: null,
          // Maintenance info
          maintenanceRequests: 0,
          lastMaintenanceDate: null,
          currentMaintenance: false,
          // Notes
          notes: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    } 
    // REGULAR PROPERTY TYPES
    else {
      // Get bedroom/bathroom counts for this property type
      const currentType = propertyTypes.find(t => t.value === propertyType);
      const unitBedrooms = currentType?.hasBedrooms ? currentType.autoBedrooms : form.bedrooms;
      const unitBathrooms = currentType?.hasBedrooms ? currentType.autoBathrooms : form.bathrooms;
      
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
          // Unit-specific bedroom/bathroom
          bedrooms: unitBedrooms,
          bathrooms: unitBathrooms,
          // Tenant info
          tenantId: null,
          tenantName: "",
          tenantPhone: "",
          tenantEmail: "",
          // Lease info
          leaseStart: null,
          leaseEnd: null,
          rentPaidUntil: null,
          // Maintenance info
          maintenanceRequests: 0,
          lastMaintenanceDate: null,
          currentMaintenance: false,
          // Notes
          notes: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
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
    const { name, value, type } = e.target;
    
    // Handle all inputs normally - FIXED: No blocking logic
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
      const totalUnits = parseInt(value) || 1;
      const generatedUnits = generateUnits(totalUnits, form.name, getPriceForType(), form.propertyType);
      
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
    } else if (name === "bedrooms" || name === "bathrooms") {
      // Allow manual input for bedroom/bathroom
      setForm(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    } else {
      // Handle all other inputs normally
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
    const selectedType = propertyTypes.find(t => t.value === type);
    
    // Auto-set bedrooms/bathrooms based on property type
    let newBedrooms = form.bedrooms;
    let newBathrooms = form.bathrooms;
    
    if (type !== "one-two-bedroom" && type !== "apartment" && type !== "commercial") {
      newBedrooms = selectedType.autoBedrooms;
      newBathrooms = selectedType.autoBathrooms;
    } else if (type === "commercial") {
      newBedrooms = 0;
      newBathrooms = 1;
    } else if (type === "apartment") {
      // Keep existing or default to 1
      newBedrooms = form.bedrooms || 1;
      newBathrooms = form.bathrooms || 1;
    }
    
    setForm(prev => ({
      ...prev,
      propertyType: type,
      bedrooms: newBedrooms,
      bathrooms: newBathrooms
    }));
    
    // Regenerate units with new property type
    if (form.name && form.units > 0) {
      const generatedUnits = generateUnits(form.units, form.name, getPriceForType(), type);
      setForm(prev => ({
        ...prev,
        unitDetails: {
          ...prev.unitDetails,
          units: generatedUnits
        }
      }));
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
    let price = 0;
    switch(form.propertyType) {
      case 'single': price = parseFloat(form.pricing.single) || 0; break;
      case 'bedsitter': price = parseFloat(form.pricing.bedsitter) || 0; break;
      case 'one-bedroom': price = parseFloat(form.pricing.oneBedroom) || 0; break;
      case 'two-bedroom': price = parseFloat(form.pricing.twoBedroom) || 0; break;
      case 'three-bedroom': price = parseFloat(form.pricing.threeBedroom) || 0; break;
      default: price = parseFloat(form.rentAmount) || 0;
    }
    return price;
  };

  // Check if property type requires pricing input
  const requiresPricingInput = () => {
    const noPricingTypes = ['apartment', 'commercial', 'one-two-bedroom'];
    return !noPricingTypes.includes(form.propertyType);
  };

  // FIXED: Proper number handling for fees
  const parseFeeValue = (value) => {
    if (!value || value === "") return 0;
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
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
      const rentAmount = parseFloat(form.rentAmount) || 0;
      if (!rentAmount || rentAmount <= 0) {
        alert("Please enter a valid monthly rent amount");
        return;
      }
    }
    
    setLoading(true);
    
    try {
      // Generate units if not already generated
      const priceForUnits = requiresPricingInput() ? getPriceForType() : parseFloat(form.rentAmount) || 0;
      const unitsArray = form.unitDetails.units.length > 0 
        ? form.unitDetails.units 
        : generateUnits(form.units, form.name, priceForUnits, form.propertyType);
      
      // Get current property type details
      const currentPropertyType = propertyTypes.find(t => t.value === form.propertyType);
      
      // FIXED: Create property data with proper number conversion
      const propertyData = {
        // Basic info
        name: form.name,
        address: form.address,
        city: form.city,
        country: form.country,
        // FIXED: Proper number conversion - no division bug
        rentAmount: parseFloat(priceForUnits) || 0,
        units: parseInt(form.units) || 1,
        propertyType: form.propertyType,
        // Auto-set bedrooms/bathrooms based on property type
        bedrooms: currentPropertyType?.hasBedrooms ? currentPropertyType.autoBedrooms : parseInt(form.bedrooms) || 0,
        bathrooms: currentPropertyType?.hasBedrooms ? currentPropertyType.autoBathrooms : parseInt(form.bathrooms) || 0,
        size: form.size,
        description: form.description,
        amenities: form.amenities,
        images: form.images,
        
        // Landlord info
        landlordId: form.landlordId,
        landlordName: form.landlordName,
        
        // FIXED: Application and fee-related fields - NO DIVISION BUG
        applicationFee: parseFeeValue(form.applicationFee),
        securityDeposit: parseFeeValue(form.securityDeposit),
        petDeposit: parseFeeValue(form.petDeposit),
        otherFees: form.otherFees || "",
        leaseTerm: parseInt(form.leaseTerm) || 12,
        noticePeriod: parseInt(form.noticePeriod) || 30,
        latePaymentFee: parseFeeValue(form.latePaymentFee),
        gracePeriod: parseInt(form.gracePeriod) || 5,
        feeDetails: form.feeDetails,
        
        // Store unit counts
        unitDetails: {
          totalUnits: parseInt(form.units) || 1,
          vacantCount: parseInt(form.units) || 1,
          leasedCount: 0,
          maintenanceCount: 0,
          occupancyRate: 0
        },
        
        // Status and timestamps
        status: "available",
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        monthlyRevenue: 0,
        totalTenants: 0,
        occupancy: 0
      };
      
      // Add pricing if exists
      if (form.pricing && (Object.values(form.pricing).some(val => val !== "" && val !== "0"))) {
        const pricingNumbers = {};
        Object.keys(form.pricing).forEach(key => {
          pricingNumbers[key] = parseFloat(form.pricing[key]) || 0;
        });
        propertyData.pricing = pricingNumbers;
      }
      
      console.log("Saving property data:", propertyData);
      console.log("Bedrooms:", propertyData.bedrooms, "Bathrooms:", propertyData.bathrooms);
      console.log("Fees - Application:", propertyData.applicationFee, "Security:", propertyData.securityDeposit);
      
      // Save the main property document to Firestore
      const propertyRef = await addDoc(collection(db, "properties"), propertyData);
      const propertyId = propertyRef.id;
      
      console.log("✅ Main property created with ID:", propertyId);
      
      // Create unit documents
      const unitCreationPromises = unitsArray.map(async (unitData, index) => {
        const unitDocData = {
          unitId: unitData.unitId,
          unitNumber: unitData.unitNumber,
          unitName: unitData.unitName,
          propertyId: propertyId,
          propertyName: form.name,
          propertyAddress: form.address,
          propertyType: form.propertyType,
          
          // Unit specifications
          bedrooms: unitData.bedrooms || propertyData.bedrooms,
          bathrooms: unitData.bathrooms || propertyData.bathrooms,
          size: form.size || "",
          amenities: [...form.amenities],
          
          // Pricing - FIXED: No division bug
          rentAmount: parseFloat(unitData.rentAmount) || 0,
          applicationFee: parseFeeValue(form.applicationFee),
          securityDeposit: parseFeeValue(form.securityDeposit),
          petDeposit: parseFeeValue(form.petDeposit),
          leaseTerm: parseInt(form.leaseTerm) || 12,
          latePaymentFee: parseFeeValue(form.latePaymentFee),
          gracePeriod: parseInt(form.gracePeriod) || 5,
          feeDetails: form.feeDetails,
          
          // Status tracking
          status: "vacant",
          isAvailable: true,
          isActive: true,
          
          // Tenant info
          tenantId: null,
          tenantName: "",
          tenantPhone: "",
          tenantEmail: "",
          tenantNationalId: "",
          emergencyContact: "",
          leaseStartDate: null,
          leaseEndDate: null,
          rentPaidUntil: null,
          lastPaymentDate: null,
          leaseDocumentUrl: "",
          
          // Maintenance info
          maintenanceRequests: 0,
          lastMaintenanceDate: null,
          currentMaintenance: false,
          
          // Landlord info
          landlordId: form.landlordId,
          landlordName: form.landlordName,
          
          // Timestamps
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          unitOrder: index + 1,
          
          // For easy querying
          searchKeywords: [
            form.name.toLowerCase(),
            `unit ${unitData.unitNumber}`.toLowerCase(),
            form.address.toLowerCase(),
            form.city.toLowerCase(),
            "vacant"
          ]
        };
        
        await addDoc(collection(db, `properties/${propertyId}/units`), unitDocData);
        return unitData.unitId;
      });
      
      await Promise.all(unitCreationPromises);
      console.log(`✅ Created ${unitsArray.length} unit documents`);
      
      // Update landlord's document
      const landlordRef = doc(db, "landlords", form.landlordId);
      const currentTime = new Date().toISOString();
      
      await updateDoc(landlordRef, {
        properties: arrayUnion({
          propertyId: propertyId,
          propertyName: form.name,
          address: form.address,
          rentAmount: parseFloat(priceForUnits) || 0,
          units: parseInt(form.units) || 1,
          vacantUnits: parseInt(form.units) || 1,
          leasedUnits: 0,
          maintenanceUnits: 0,
          status: "active",
          addedAt: currentTime,
          propertyType: form.propertyType,
          bedrooms: propertyData.bedrooms,
          bathrooms: propertyData.bathrooms
        }),
        totalProperties: (form.totalProperties || 0) + 1,
        lastUpdated: serverTimestamp()
      });
      
      console.log("✅ Updated landlord");
      
      // Success message
      const successMessage = `✅ Property "${form.name}" added successfully!\n\n` +
        `📊 Details:\n` +
        `• Type: ${propertyTypes.find(t => t.value === form.propertyType)?.label}\n` +
        `• Bedrooms: ${propertyData.bedrooms}\n` +
        `• Bathrooms: ${propertyData.bathrooms}\n` +
        `• Units: ${form.units}\n` +
        `• Rent: KSh ${propertyData.rentAmount.toLocaleString()}/month\n` +
        `• Security Deposit: KSh ${propertyData.securityDeposit.toLocaleString()}\n` +
        `• Application Fee: KSh ${propertyData.applicationFee.toLocaleString()}\n\n` +
        `Each unit is now individually manageable.`;
      
      alert(successMessage);
      navigate("/properties");
      
    } catch (error) {
      console.error("❌ Error adding property:", error);
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
          
          {/* PROPERTY TYPE SELECTION WITH AUTO INFO */}
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
                  {/* Show auto bedroom/bathroom info */}
                  {type.autoBedrooms > 0 && (
                    <span className="property-auto-info">
                      🛏️ {type.autoBedrooms} BR | 🚿 {type.autoBathrooms} BA
                    </span>
                  )}
                  {(type.value === "single" || type.value === "bedsitter") && (
                    <span className="property-auto-info">🚿 1 Bathroom</span>
                  )}
                  {type.value === "commercial" && (
                    <span className="property-auto-info">🏪 Commercial Space</span>
                  )}
                </button>
              ))}
            </div>
            
            {/* Current Selection Info */}
            {currentPropertyType && (
              <div className="current-type-info">
                <p>
                  <strong>Selected:</strong> {currentPropertyType.label}
                  {(currentPropertyType.value === "single" || currentPropertyType.value === "bedsitter") && (
                    <span> • 🚿 1 Bathroom</span>
                  )}
                  {currentPropertyType.autoBedrooms > 0 && (
                    <span> • 🛏️ {currentPropertyType.autoBedrooms} Bedrooms</span>
                  )}
                  {currentPropertyType.autoBathrooms > 0 && currentPropertyType.value !== "single" && currentPropertyType.value !== "bedsitter" && (
                    <span> • 🚿 {currentPropertyType.autoBathrooms} Bathrooms</span>
                  )}
                </p>
                <p className="type-description">{currentPropertyType.description}</p>
              </div>
            )}
          </div>
          
          {/* PRICING SECTION */}
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
            <div className="form-section">
              <h3>Monthly Rent</h3>
              <div className="pricing-section">
                <div className="selected-type-display">
                  <h4>{currentPropertyType?.label}</h4>
                  <p>{currentPropertyType?.description}</p>
                  
                  {form.propertyType === "one-two-bedroom" && (
                    <div className="mixed-type-pricing">
                      <p className="note">🔀 This property type will have a mix of 1BR and 2BR units</p>
                      <div className="form-row">
                        <div className="form-group">
                          <label className="required">1 Bedroom Rent (KSh)</label>
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
                        
                        <div className="form-group">
                          <label className="required">2 Bedroom Rent (KSh)</label>
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
                      </div>
                    </div>
                  )}
                  
                  {(form.propertyType === "apartment" || form.propertyType === "commercial") && (
                    <p className="note">Enter the base monthly rent amount</p>
                  )}
                </div>
                
                {(form.propertyType === "apartment" || form.propertyType === "commercial") && (
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
                      <p><strong>Total Monthly Potential:</strong> KSh {(parseFloat(form.rentAmount) || 0) * form.units}</p>
                      <p className="note">{form.units} unit(s) × KSh {parseFloat(form.rentAmount) || 0}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* FEES AND DEPOSITS SECTION - FIXED */}
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
            
            {/* Bedroom/Bathroom Section - Only show for types that allow user input */}
            {(form.propertyType === "apartment" || form.propertyType === "commercial" || form.propertyType === "one-two-bedroom") && (
              <div className="form-row">
                {form.propertyType !== "commercial" && (
                  <div className="form-group">
                    <label>Bedrooms</label>
                    <select
                      name="bedrooms"
                      value={form.bedrooms}
                      onChange={handleChange}
                      disabled={loading}
                    >
                      {form.propertyType === "apartment" && [1, 2, 3, 4].map(num => (
                        <option key={num} value={num}>{num} {num === 1 ? 'Bedroom' : 'Bedrooms'}</option>
                      ))}
                      {form.propertyType === "one-two-bedroom" && (
                        <>
                          <option value="1">1 Bedroom</option>
                          <option value="2">2 Bedrooms</option>
                        </>
                      )}
                    </select>
                  </div>
                )}
                
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
            )}
            
            {/* Auto-set info for other types */}
            {(form.propertyType === "single" || form.propertyType === "bedsitter" || 
              form.propertyType === "one-bedroom" || form.propertyType === "two-bedroom" || 
              form.propertyType === "three-bedroom") && (
              <div className="auto-set-display">
                <div className="auto-set-info-box">
                  <p><strong>Auto-set based on property type:</strong></p>
                  <div className="auto-set-values">
                    <span className="auto-set-item">
                      🛏️ {currentPropertyType?.autoBedrooms || 0} Bedroom{currentPropertyType?.autoBedrooms !== 1 ? 's' : ''}
                    </span>
                    <span className="auto-set-item">
                      🚿 {currentPropertyType?.autoBathrooms || 1} Bathroom{currentPropertyType?.autoBathrooms !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Size input */}
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