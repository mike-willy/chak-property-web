// services/searchService.js - UPDATED WITH SIMPLER QUERIES
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit,
  orderBy
} from "firebase/firestore";
import { db } from "../pages/firebase/firebase";

// NEW: Simple property search that works with your rules
export const searchProperties = async (searchTerm, limitCount = 10) => {
  try {
    console.log("🔍 Searching properties for:", searchTerm);
    const propertiesRef = collection(db, "properties");
    
    // Get ALL properties first (allowed by your rules: allow read: if true)
    const snapshot = await getDocs(propertiesRef);
    console.log(`📊 Total properties in database: ${snapshot.size}`);
    
    // Filter locally
    const searchTermLower = searchTerm.toLowerCase();
    const results = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const propertyName = (data.propertyName || data.name || '').toLowerCase();
      const address = (data.address || '').toLowerCase();
      const description = (data.description || '').toLowerCase();
      const type = (data.type || '').toLowerCase();
      
      // Check if search term appears anywhere
      if (propertyName.includes(searchTermLower) || 
          address.includes(searchTermLower) || 
          description.includes(searchTermLower) ||
          type.includes(searchTermLower)) {
        
        console.log("✅ Found property match:", data.propertyName || data.name);
        
        results.push({
          id: doc.id,
          type: 'property',
          title: data.propertyName || data.name || 'Unnamed Property',
          subtitle: `Property • ${data.address || 'No address'} • ${data.type || 'No type'}`,
          route: `/properties/edit/${doc.id}`,
          data: data,
          relevance: propertyName.includes(searchTermLower) ? 3 : 
                    address.includes(searchTermLower) ? 2 : 1
        });
      }
    });
    
    console.log(`✅ Found ${results.length} properties for "${searchTerm}"`);
    return results.sort((a, b) => b.relevance - a.relevance).slice(0, limitCount);
  } catch (error) {
    console.error("❌ Property search error:", error.message);
    return [];
  }
};

// NEW: Simple tenant search
export const searchTenants = async (searchTerm, limitCount = 5) => {
  try {
    const tenantsRef = collection(db, "tenants");
    const snapshot = await getDocs(tenantsRef);
    
    const searchTermLower = searchTerm.toLowerCase();
    const results = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const fullName = (data.fullName || data.name || '').toLowerCase();
      const email = (data.email || '').toLowerCase();
      const phone = (data.phoneNumber || data.phone || '').toLowerCase();
      
      if (fullName.includes(searchTermLower) || 
          email.includes(searchTermLower) || 
          phone.includes(searchTermLower)) {
        
        results.push({
          id: doc.id,
          type: 'tenant',
          title: data.fullName || data.name || data.email || 'Unnamed Tenant',
          subtitle: `Tenant • ${data.email || 'No email'} • ${data.phoneNumber || 'No phone'}`,
          route: `/tenants`,
          data: data,
          relevance: fullName.includes(searchTermLower) ? 3 : 
                    email.includes(searchTermLower) ? 2 : 1
        });
      }
    });
    
    return results.sort((a, b) => b.relevance - a.relevance).slice(0, limitCount);
  } catch (error) {
    console.error("Tenant search error:", error);
    return [];
  }
};

// NEW: Simple landlord search
export const searchLandlords = async (searchTerm, limitCount = 5) => {
  try {
    const landlordsRef = collection(db, "landlords");
    const snapshot = await getDocs(landlordsRef);
    
    const searchTermLower = searchTerm.toLowerCase();
    const results = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const name = (data.name || '').toLowerCase();
      const email = (data.email || '').toLowerCase();
      const company = (data.company || '').toLowerCase();
      
      if (name.includes(searchTermLower) || 
          email.includes(searchTermLower) || 
          company.includes(searchTermLower)) {
        
        results.push({
          id: doc.id,
          type: 'landlord',
          title: data.name || data.email || 'Unnamed Landlord',
          subtitle: `Landlord • ${data.company || 'Individual'} • ${data.email || 'No email'}`,
          route: `/landlords/${doc.id}`,
          data: data,
          relevance: name.includes(searchTermLower) ? 3 : 
                    email.includes(searchTermLower) ? 2 : 1
        });
      }
    });
    
    return results.sort((a, b) => b.relevance - a.relevance).slice(0, limitCount);
  } catch (error) {
    console.error("Landlord search error:", error);
    return [];
  }
};

// NEW: Simple units search
export const searchUnits = async (searchTerm, limitCount = 5) => {
  try {
    const unitsRef = collection(db, "units");
    const snapshot = await getDocs(unitsRef);
    
    const searchTermLower = searchTerm.toLowerCase();
    const results = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const unitNumber = (data.unitNumber || '').toString().toLowerCase();
      const type = (data.type || '').toLowerCase();
      const status = (data.status || '').toLowerCase();
      
      if (unitNumber.includes(searchTermLower) || 
          type.includes(searchTermLower) || 
          status.includes(searchTermLower)) {
        
        results.push({
          id: doc.id,
          type: 'unit',
          title: `Unit ${data.unitNumber || 'Unknown'}`,
          subtitle: `Unit • ${data.type || 'No type'} • ${data.status || 'Available'}`,
          route: data.propertyId ? `/property/${data.propertyId}/units` : '/units',
          data: data,
          relevance: unitNumber.includes(searchTermLower) ? 3 : 
                    type.includes(searchTermLower) ? 2 : 1
        });
      }
    });
    
    return results.sort((a, b) => b.relevance - a.relevance).slice(0, limitCount);
  } catch (error) {
    console.error("Unit search error:", error);
    return [];
  }
};

// NEW: Simple applications search
export const searchApplications = async (searchTerm, limitCount = 5) => {
  try {
    const applicationsRef = collection(db, "applications");
    const snapshot = await getDocs(applicationsRef);
    
    const searchTermLower = searchTerm.toLowerCase();
    const results = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const applicantName = (data.applicantName || '').toLowerCase();
      const status = (data.status || '').toLowerCase();
      const propertyName = (data.propertyName || '').toLowerCase();
      
      if (applicantName.includes(searchTermLower) || 
          status.includes(searchTermLower) || 
          propertyName.includes(searchTermLower)) {
        
        results.push({
          id: doc.id,
          type: 'application',
          title: `${data.applicantName || 'Applicant'}'s Application`,
          subtitle: `Application • ${data.status || 'Pending'} • ${data.propertyName || 'No property'}`,
          route: `/applications`,
          data: data,
          relevance: applicantName.includes(searchTermLower) ? 3 : 
                    status.includes(searchTermLower) ? 2 : 1
        });
      }
    });
    
    return results.sort((a, b) => b.relevance - a.relevance).slice(0, limitCount);
  } catch (error) {
    console.error("Application search error:", error);
    return [];
  }
};

// NEW: Simple maintenance search
export const searchMaintenance = async (searchTerm, limitCount = 5) => {
  try {
    const maintenanceRef = collection(db, "maintenance");
    const snapshot = await getDocs(maintenanceRef);
    
    const searchTermLower = searchTerm.toLowerCase();
    const results = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const title = (data.title || '').toLowerCase();
      const description = (data.description || '').toLowerCase();
      const status = (data.status || '').toLowerCase();
      const priority = (data.priority || '').toLowerCase();
      
      if (title.includes(searchTermLower) || 
          description.includes(searchTermLower) || 
          status.includes(searchTermLower) ||
          priority.includes(searchTermLower)) {
        
        results.push({
          id: doc.id,
          type: 'maintenance',
          title: data.title || 'Maintenance Request',
          subtitle: `Maintenance • ${data.priority || 'Normal'} • ${data.status || 'Open'}`,
          route: `/maintenance`,
          data: data,
          relevance: title.includes(searchTermLower) ? 3 : 
                    description.includes(searchTermLower) ? 2 : 1
        });
      }
    });
    
    return results.sort((a, b) => b.relevance - a.relevance).slice(0, limitCount);
  } catch (error) {
    console.error("Maintenance search error:", error);
    return [];
  }
};

// NEW: Simple payments search
export const searchPayments = async (searchTerm, limitCount = 5) => {
  try {
    const paymentsRef = collection(db, "payments");
    const snapshot = await getDocs(paymentsRef);
    
    const searchTermLower = searchTerm.toLowerCase();
    const results = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const tenantName = (data.tenantName || '').toLowerCase();
      const status = (data.status || '').toLowerCase();
      const amount = (data.amount || '').toString().toLowerCase();
      
      if (tenantName.includes(searchTermLower) || 
          status.includes(searchTermLower) || 
          amount.includes(searchTermLower)) {
        
        results.push({
          id: doc.id,
          type: 'payment',
          title: `Payment - ${data.tenantName || 'Unknown'}`,
          subtitle: `Payment • $${data.amount || '0'} • ${data.status || 'Unknown'}`,
          route: `/finance`,
          data: data,
          relevance: tenantName.includes(searchTermLower) ? 3 : 
                    status.includes(searchTermLower) ? 2 : 1
        });
      }
    });
    
    return results.sort((a, b) => b.relevance - a.relevance).slice(0, limitCount);
  } catch (error) {
    console.error("Payment search error:", error);
    return [];
  }
};

// Global Search - Main Function
export const globalSearch = async (searchTerm, limitPerCategory = 3) => {
  if (!searchTerm.trim() || searchTerm.length < 2) {
    console.log("Search term too short:", searchTerm);
    return [];
  }

  console.log("=== STARTING GLOBAL SEARCH ===");
  console.log("Search term:", searchTerm);
  
  try {
    // Run ALL searches in parallel
    const results = await Promise.all([
      searchTenants(searchTerm, limitPerCategory),
      searchLandlords(searchTerm, limitPerCategory),
      searchProperties(searchTerm, limitPerCategory),
      searchUnits(searchTerm, limitPerCategory),
      searchApplications(searchTerm, limitPerCategory),
      searchMaintenance(searchTerm, limitPerCategory),
      searchPayments(searchTerm, limitPerCategory)
    ]);

    // DEBUG: Log results from each category
    console.log("=== SEARCH RESULTS BY CATEGORY ===");
    console.log("Tenants:", results[0].length);
    console.log("Landlords:", results[1].length);
    console.log("Properties:", results[2].length);
    console.log("Units:", results[3].length);
    console.log("Applications:", results[4].length);
    console.log("Maintenance:", results[5].length);
    console.log("Payments:", results[6].length);
    
    // Show property results in detail
    if (results[2].length > 0) {
      console.log("Property details found:", results[2].map(p => p.title));
    }

    // Flatten all results
    const allResults = results.flat();
    
    console.log(`✅ Total results found: ${allResults.length}`);
    
    // Sort by relevance
    return allResults.sort((a, b) => b.relevance - a.relevance).slice(0, 15);
  } catch (error) {
    console.error("❌ Global search error:", error);
    return [];
  }
};