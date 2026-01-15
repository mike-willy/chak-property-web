// firebase/maintenanceService.js
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy,
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from './firebase'; // Import auth too

// ========== USER ROLE HELPERS ==========
export const getUserRole = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    return userDoc.data()?.role || null;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
};

// ========== MAINTENANCE CATEGORIES ==========
export const getMaintenanceCategories = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'maintenance_categories'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting categories:', error);
    throw error;
  }
};

export const addMaintenanceCategory = async (categoryData) => {
  try {
    // Check if user is admin
    const role = await getUserRole();
    if (role !== 'admin') throw new Error('Only admin can add categories');
    
    const docRef = await addDoc(collection(db, 'maintenance_categories'), {
      ...categoryData,
      createdAt: serverTimestamp()
    });
    return { id: docRef.id, ...categoryData };
  } catch (error) {
    console.error('Error adding category:', error);
    throw error;
  }
};

// ========== MAINTENANCE REQUESTS ==========
export const submitMaintenanceRequest = async (requestData) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    // Check if user is tenant
    const role = await getUserRole();
    if (role !== 'tenant') throw new Error('Only tenants can submit maintenance requests');
    
    // Generate request ID
    const requestId = `MNT-${Date.now()}`;
    
    const request = {
      ...requestData,
      id: requestId,
      tenantId: user.uid, // Always use current user's ID
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      adminNotes: '',
      completedAt: null
    };

    const docRef = await addDoc(collection(db, 'maintenance'), request);
    return { id: docRef.id, ...request };
  } catch (error) {
    console.error('Error submitting request:', error);
    throw error;
  }
};

// Get all requests (Admin only)
export const getAllMaintenanceRequests = async () => {
  try {
    const role = await getUserRole();
    if (role !== 'admin') throw new Error('Only admin can view all requests');
    
    const q = query(collection(db, 'maintenance'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));
  } catch (error) {
    console.error('Error getting requests:', error);
    throw error;
  }
};

// Get tenant's own requests
export const getTenantMaintenanceRequests = async () => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    const q = query(
      collection(db, 'maintenance'),
      where('tenantId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting tenant requests:', error);
    throw error;
  }
};

// Get landlord's property requests
export const getLandlordMaintenanceRequests = async () => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    // First get landlord's properties
    const propertiesQuery = query(
      collection(db, 'properties'),
      where('landlordId', '==', user.uid)
    );
    const propertiesSnapshot = await getDocs(propertiesQuery);
    const propertyIds = propertiesSnapshot.docs.map(doc => doc.id);
    
    if (propertyIds.length === 0) return [];
    
    // Get maintenance requests for these properties
    const q = query(
      collection(db, 'maintenance'),
      where('propertyId', 'in', propertyIds),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting landlord requests:', error);
    throw error;
  }
};

// Update request (Admin can update all, tenant can update their own)
export const updateMaintenanceRequest = async (requestId, updates) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    const role = await getUserRole();
    const requestRef = doc(db, 'maintenance', requestId);
    const requestDoc = await getDoc(requestRef);
    const requestData = requestDoc.data();
    
    // Check permissions
    if (role !== 'admin' && requestData.tenantId !== user.uid) {
      throw new Error('You do not have permission to update this request');
    }
    
    const updateData = {
      ...updates,
      updatedAt: serverTimestamp()
    };

    if (updates.status === 'completed') {
      updateData.completedAt = serverTimestamp();
    }

    await updateDoc(requestRef, updateData);
    
    // Get updated document
    const updatedDoc = await getDoc(requestRef);
    return { id: updatedDoc.id, ...updatedDoc.data() };
  } catch (error) {
    console.error('Error updating request:', error);
    throw error;
  }
};

// ========== REAL-TIME LISTENERS ==========
// For Admin Dashboard (all requests)
export const subscribeToAllRequests = (callback) => {
  const q = query(collection(db, 'maintenance'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(requests);
  });
};

// For Tenant App (their requests only)
export const subscribeToTenantRequests = (callback) => {
  const user = auth.currentUser;
  if (!user) return () => {};
  
  const q = query(
    collection(db, 'maintenance'),
    where('tenantId', '==', user.uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(requests);
  });
};

// For Landlord App (their properties' requests)
export const subscribeToLandlordRequests = (callback) => {
  const user = auth.currentUser;
  if (!user) return () => {};
  
  // This is simplified - in practice you might need to handle this differently
  // since Firestore doesn't support querying across collections easily
  const q = query(collection(db, 'maintenance'), orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, async (snapshot) => {
    // First get landlord's properties
    const propertiesQuery = query(
      collection(db, 'properties'),
      where('landlordId', '==', user.uid)
    );
    const propertiesSnapshot = await getDocs(propertiesQuery);
    const propertyIds = propertiesSnapshot.docs.map(doc => doc.id);
    
    // Filter requests for landlord's properties
    const allRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const landlordRequests = allRequests.filter(request => 
      propertyIds.includes(request.propertyId)
    );
    
    callback(landlordRequests);
  });
};

// ========== STATISTICS ==========
export const getMaintenanceStats = async () => {
  try {
    const role = await getUserRole();
    
    let querySnapshot;
    if (role === 'admin') {
      // Admin sees all
      querySnapshot = await getDocs(collection(db, 'maintenance'));
    } else if (role === 'landlord') {
      // Landlord sees their properties' requests
      const requests = await getLandlordMaintenanceRequests();
      return calculateStats(requests);
    } else if (role === 'tenant') {
      // Tenant sees their own requests
      const requests = await getTenantMaintenanceRequests();
      return calculateStats(requests);
    } else {
      return { pending: 0, inProgress: 0, completed: 0, total: 0 };
    }
    
    const requests = querySnapshot.docs.map(doc => doc.data());
    return calculateStats(requests);
  } catch (error) {
    console.error('Error getting statistics:', error);
    return { pending: 0, inProgress: 0, completed: 0, total: 0 };
  }
};

const calculateStats = (requests) => {
  const pending = requests.filter(r => r.status === 'pending').length;
  const inProgress = requests.filter(r => r.status === 'in-progress').length;
  const completed = requests.filter(r => r.status === 'completed').length;
  const total = requests.length;
  
  return { pending, inProgress, completed, total };
};

// ========== SIMPLIFIED VERSION ==========
// Since your rules are simple, here's a simpler version that might work better:

export const maintenanceService = {
  // For Admin Web
  admin: {
    getAllRequests: getAllMaintenanceRequests,
    updateRequest: updateMaintenanceRequest,
    getStats: getMaintenanceStats,
    subscribe: subscribeToAllRequests,
    
    // Categories management
    getCategories: getMaintenanceCategories,
    addCategory: addMaintenanceCategory,
    deleteCategory: async (categoryId) => {
      const role = await getUserRole();
      if (role !== 'admin') throw new Error('Only admin can delete categories');
      await deleteDoc(doc(db, 'maintenance_categories', categoryId));
      return true;
    }
  },
  
  // For Tenant Mobile App
  tenant: {
    submitRequest: submitMaintenanceRequest,
    getMyRequests: getTenantMaintenanceRequests,
    updateMyRequest: updateMaintenanceRequest,
    subscribe: subscribeToTenantRequests,
    getCategories: getMaintenanceCategories
  },
  
  // For Landlord Mobile App
  landlord: {
    getMyPropertiesRequests: getLandlordMaintenanceRequests,
    subscribe: subscribeToLandlordRequests,
    getCategories: getMaintenanceCategories
  }
};