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
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

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

export const deleteMaintenanceCategory = async (categoryId) => {
  try {
    const role = await getUserRole();
    if (role !== 'admin') throw new Error('Only admin can delete categories');

    await deleteDoc(doc(db, 'maintenance_categories', categoryId));
    return true;
  } catch (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
};

// ========== MAINTENANCE REQUESTS ==========
export const submitMaintenanceRequest = async (requestData) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    // Check if user is tenant, admin or landlord
    const role = await getUserRole();
    if (role !== 'tenant' && role !== 'admin' && role !== 'landlord') {
      throw new Error('Unauthorized to submit maintenance requests');
    }

    // Generate request ID
    const requestId = `MNT-${Date.now()}`;

    // Determine tenantId: if passed in requestData (from admin selecting a unit), use it.
    // Otherwise use current user's UID (if tenant).
    const tenantId = requestData.tenantId || user.uid;

    const request = {
      ...requestData,
      id: requestId,
      tenantId: tenantId,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      adminNotes: '',
      completedAt: null,
      onHoldAt: null,
      cancelledAt: null,
      submittedByRole: role // Track who submitted it
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
      updatedAt: doc.data().updatedAt?.toDate(),
      completedAt: doc.data().completedAt?.toDate(),
      onHoldAt: doc.data().onHoldAt?.toDate(),
      cancelledAt: doc.data().cancelledAt?.toDate()
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

    // Prepare update data
    const updateData = {
      ...updates,
      updatedAt: serverTimestamp()
    };

    // Handle special timestamps for status changes
    if (updates.status === 'completed') {
      updateData.completedAt = serverTimestamp();
      updateData.onHoldAt = null; // Clear on-hold if completing
    } else if (updates.status === 'on-hold') {
      updateData.onHoldAt = serverTimestamp();
      updateData.completedAt = null; // Clear completed if putting on hold
    } else if (updates.status === 'cancelled') {
      updateData.cancelledAt = serverTimestamp();
      updateData.completedAt = null;
      updateData.onHoldAt = null;
    } else if (updates.status === 'pending' || updates.status === 'in-progress') {
      // Clear special timestamps when moving back to normal status
      updateData.completedAt = null;
      updateData.onHoldAt = null;
      updateData.cancelledAt = null;
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

// Delete maintenance request (Admin only, completed/cancelled only)
export const deleteMaintenanceRequest = async (requestId) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const role = await getUserRole();
    if (role !== 'admin') throw new Error('Only admin can delete requests');

    // Check if request exists and can be deleted
    const requestRef = doc(db, 'maintenance', requestId);
    const requestDoc = await getDoc(requestRef);
    const requestData = requestDoc.data();

    if (!requestData) {
      throw new Error('Maintenance request not found');
    }

    // Only allow deletion of completed or cancelled requests
    if (requestData.status !== 'completed' && requestData.status !== 'cancelled') {
      throw new Error('Only completed or cancelled requests can be deleted');
    }

    // Check if request was completed/cancelled more than 24 hours ago
    const lastUpdate = requestData.completedAt || requestData.cancelledAt || requestData.updatedAt;
    if (lastUpdate) {
      const lastUpdateDate = lastUpdate.toDate ? lastUpdate.toDate() : new Date(lastUpdate);
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      if (lastUpdateDate > twentyFourHoursAgo) {
        throw new Error('Requests can only be deleted 24 hours after completion/cancellation');
      }
    }

    await deleteDoc(requestRef);
    return true;
  } catch (error) {
    console.error('Error deleting request:', error);
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
  if (!user) return () => { };

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
  if (!user) return () => { };

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
      return { pending: 0, inProgress: 0, completed: 0, onHold: 0, cancelled: 0, total: 0 };
    }

    const requests = querySnapshot.docs.map(doc => doc.data());
    return calculateStats(requests);
  } catch (error) {
    console.error('Error getting statistics:', error);
    return { pending: 0, inProgress: 0, completed: 0, onHold: 0, cancelled: 0, total: 0 };
  }
};

const calculateStats = (requests) => {
  const pending = requests.filter(r => r.status === 'pending').length;
  const inProgress = requests.filter(r => r.status === 'in-progress').length;
  const completed = requests.filter(r => r.status === 'completed').length;
  const onHold = requests.filter(r => r.status === 'on-hold').length;
  const cancelled = requests.filter(r => r.status === 'cancelled').length;
  const total = requests.length;

  return { pending, inProgress, completed, onHold, cancelled, total };
};

// ========== ADDITIONAL HELPER FUNCTIONS ==========
// Get request by ID
export const getMaintenanceRequestById = async (requestId) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const requestRef = doc(db, 'maintenance', requestId);
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) {
      throw new Error('Maintenance request not found');
    }

    const role = await getUserRole();
    const requestData = requestDoc.data();

    // Check permissions
    if (role !== 'admin' && requestData.tenantId !== user.uid) {
      throw new Error('You do not have permission to view this request');
    }

    return { id: requestDoc.id, ...requestData };
  } catch (error) {
    console.error('Error getting request by ID:', error);
    throw error;
  }
};

// Add admin notes to request
export const addAdminNotes = async (requestId, notes) => {
  try {
    const role = await getUserRole();
    if (role !== 'admin') throw new Error('Only admin can add notes');

    const requestRef = doc(db, 'maintenance', requestId);
    await updateDoc(requestRef, {
      adminNotes: notes,
      updatedAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error('Error adding admin notes:', error);
    throw error;
  }
};

// ========== SERVICE OBJECT ==========
export const maintenanceService = {
  // For Admin Web
  admin: {
    getAllRequests: getAllMaintenanceRequests,
    updateRequest: updateMaintenanceRequest,
    deleteRequest: deleteMaintenanceRequest, // Added
    getRequestById: getMaintenanceRequestById, // Added
    addAdminNotes: addAdminNotes, // Added
    getStats: getMaintenanceStats,
    subscribe: subscribeToAllRequests,

    // Categories management
    getCategories: getMaintenanceCategories,
    addCategory: addMaintenanceCategory,
    deleteCategory: deleteMaintenanceCategory,
  },

  // For Tenant Mobile App
  tenant: {
    submitRequest: submitMaintenanceRequest,
    getMyRequests: getTenantMaintenanceRequests,
    updateMyRequest: updateMaintenanceRequest,
    getRequestById: getMaintenanceRequestById,
    subscribe: subscribeToTenantRequests,
    getCategories: getMaintenanceCategories
  },

  // For Landlord Mobile App
  landlord: {
    getMyPropertiesRequests: getLandlordMaintenanceRequests,
    subscribe: subscribeToLandlordRequests,
    getCategories: getMaintenanceCategories
  },

  // Common functions
  common: {
    getCategories: getMaintenanceCategories
  }
};