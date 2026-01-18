// App.js - Updated
import { Routes, Route, Navigate } from "react-router-dom";

import DashboardLayout from "./components/DashboardLayout";
import AdminLogin from "./pages/AdminLogin";
import AdminRoute from "./routes/AdminRoute";
import MpesaTest from './components/MpesaTest';

// Admin pages
import Dashboard from "./pages/Dashboard";
import Properties from "./pages/Properties";
import AddProperty from "./pages/AddProperty";
import Tenants from "./pages/Tenants";
import Landlords from "./pages/Landlords";
import AddLandlord from "./pages/AddLandlord"; 
import Messages from "./pages/Messages"; 
import Maintenance from "./pages/Maintenance";
import Finance from "./pages/Finance";
import Settings from "./pages/Settings";
import Support from "./pages/Support";
import PropertyUnits from "./pages/PropertyUnits";
import EditProperty from "./pages/EditProperty";
import Applications from "./pages/Applications";
import AddTenant from "./pages/AddTenant";
import LandlordDetails from "./pages/LandlordDetails";
import EditLandlord from "./pages/EditLandlord";
import Units from "./pages/Units";
import AssignTenant from "./pages/AssignTenant";
import ApprovedTenants from './pages/ApprovedTenants'; // Import the new component

// Wrapper component for admin pages with layout
const AdminPage = ({ children }) => {
  return (
    <AdminRoute>
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </AdminRoute>
  );
};

function App() {
  return (
    <Routes>
      {/* PUBLIC ROUTE */}
      <Route path="/login" element={<AdminLogin />} />

      {/* PROTECTED ADMIN ROUTES WITH LAYOUT */}
      <Route
        path="/dashboard"
        element={
          <AdminPage>
            <Dashboard />
          </AdminPage>
        }
      />

<Route path="/test-mpesa" element={<MpesaTest />} />

      <Route
        path="/properties/add"
        element={
          <AdminPage>
            <AddProperty />
          </AdminPage>
        }
      />

      <Route
        path="/properties"
        element={
          <AdminPage>
            <Properties />
          </AdminPage>
        }
      />

      <Route
        path="/property/:id/units"
        element={
          <AdminPage>
            <PropertyUnits />
          </AdminPage>
        }
      />

      <Route
        path="/properties/edit/:id"
        element={
          <AdminPage>
            <EditProperty />
          </AdminPage>
        }
      />

      <Route
        path="/applications"
        element={
          <AdminPage>
            <Applications />
          </AdminPage>
        }
      />

      <Route
        path="/landlords/:id"
        element={
          <AdminPage>
            <LandlordDetails />
          </AdminPage>
        }
      />

      <Route
        path="/landlords/edit/:id"
        element={
          <AdminPage>
            <EditLandlord />
          </AdminPage>
        }
      />

      <Route
        path="/units"
        element={
          <AdminPage>
            <Units />
          </AdminPage>
        }
      />

      <Route
        path="/units/:unitId/assign-tenant/:propertyId"
        element={
          <AdminPage>
            <AssignTenant />
          </AdminPage>
        }
      />

      <Route
        path="/tenants"
        element={
          <AdminPage>
            <Tenants />
          </AdminPage>
        }
      />

      <Route
        path="/tenants/add"
        element={
          <AdminPage>
            <AddTenant />
          </AdminPage>
        }
      />

      {/* NEW ROUTE: Approved Tenants Page */}
      <Route
        path="/approved-tenants"
        element={
          <AdminPage>
            <ApprovedTenants />
          </AdminPage>
        }
      />

      <Route
        path="/landlords"
        element={
          <AdminPage>
            <Landlords />
          </AdminPage>
        }
      />

      <Route
        path="/landlords/add"
        element={
          <AdminPage>
            <AddLandlord />
          </AdminPage>
        }
      />

      <Route
        path="/messages"
        element={
          <AdminPage>
            <Messages />
          </AdminPage>
        }
      />

      <Route
        path="/maintenance"
        element={
          <AdminPage>
            <Maintenance />
          </AdminPage>
        }
      />

      <Route
        path="/finance"
        element={
          <AdminPage>
            <Finance />
          </AdminPage>
        }
      />

      <Route
        path="/settings"
        element={
          <AdminPage>
            <Settings />
          </AdminPage>
        }
      />

      <Route
        path="/support"
        element={
          <AdminPage>
            <Support />
          </AdminPage>
        }
      />

      {/* DEFAULT ROUTE */}
      <Route path="/" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default App;