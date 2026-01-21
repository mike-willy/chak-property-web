// src/components/StatsGrid.jsx - UPDATED FOR BOTH UNIT MAINTENANCE & REQUESTS
import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../pages/firebase/firebase";
import StatCard from "./StatCard";
import "../../styles/statsGrid.css";
import { 
  FaHome, 
  FaChartLine, 
  FaMoneyBillWave, 
  FaTools,
  FaBed,
  FaUser,
  FaBuilding
} from "react-icons/fa";

const StatsGrid = () => {
  const [stats, setStats] = useState({
    totalProperties: 0,
    occupancyRate: 0,
    monthlyRevenue: 0,
    activeMaintenance: 0, // This counts BOTH unit maintenance + active requests
    totalUnits: 0,
    occupiedUnits: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Function to fetch BOTH types of maintenance
  const fetchTotalActiveMaintenance = async () => {
    try {
      let totalActiveMaintenance = 0;
      
      // PART 1: Count units with maintenance status
      const propertiesSnapshot = await getDocs(collection(db, "properties"));
      
      for (const propertyDoc of propertiesSnapshot.docs) {
        const propertyId = propertyDoc.id;
        
        try {
          const unitsRef = collection(db, `properties/${propertyId}/units`);
          const unitsSnapshot = await getDocs(unitsRef);
          
          unitsSnapshot.forEach((unitDoc) => {
            const unitData = unitDoc.data();
            const status = (unitData.status || '').toLowerCase();
            
            // Count units marked as maintenance by admin
            if (status === "maintenance" || 
                status === "repair" || 
                status === "under_repair") {
              totalActiveMaintenance++;
            }
          });
        } catch (error) {
          // No units found for this property
        }
      }
      
      // PART 2: Count active maintenance requests from tenants
      try {
        const maintenanceRequestsRef = collection(db, "maintenance");
        const requestsSnapshot = await getDocs(maintenanceRequestsRef);
        
        requestsSnapshot.forEach((doc) => {
          const request = doc.data();
          const status = request.status?.toLowerCase();
          
          // Count ACTIVE maintenance requests (pending, in-progress, on-hold)
          // DO NOT count completed/cancelled requests
          if (status === 'pending' || 
              status === 'in-progress' || 
              status === 'on-hold') {
            totalActiveMaintenance++;
          }
        });
        
        console.log(`Active maintenance: ${totalActiveMaintenance} (units + requests)`);
        
      } catch (error) {
        console.log("No maintenance requests collection found");
      }
      
      return totalActiveMaintenance;
      
    } catch (error) {
      console.error("Error fetching maintenance data:", error);
      return 0;
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Fetch properties
      const propertiesSnapshot = await getDocs(collection(db, "properties"));
      const properties = [];
      
      let totalUnits = 0;
      let occupiedUnits = 0;
      let monthlyRevenue = 0;
      
      // Fetch TOTAL active maintenance (units + requests)
      const totalActiveMaintenance = await fetchTotalActiveMaintenance();

      propertiesSnapshot.forEach((doc) => {
        const property = doc.data();
        properties.push(property);
        
        // Calculate stats
        totalUnits += property.units || 0;
        
        // Occupancy calculation
        if (property.leasedCount !== undefined) {
          occupiedUnits += property.leasedCount;
        } else if (property.unitDetails?.leasedCount !== undefined) {
          occupiedUnits += property.unitDetails.leasedCount;
        } else if (property.occupiedUnits !== undefined) {
          occupiedUnits += property.occupiedUnits;
        } else if (property.occupied !== undefined) {
          occupiedUnits += property.occupied;
        } else if (property.leasedUnits !== undefined) {
          occupiedUnits += property.leasedUnits;
        } else {
          occupiedUnits += property.status === "leased" ? property.units || 0 : 0;
        }
        
        // Monthly revenue
        monthlyRevenue += property.monthlyRevenue || (property.rentAmount || 0) * (property.units || 0);
      });

      const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

      setStats({
        totalProperties: properties.length,
        totalUnits,
        occupiedUnits,
        occupancyRate,
        monthlyRevenue,
        activeMaintenance: totalActiveMaintenance // This is the combined count
      });
      
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="stats-grid">
        {[...Array(6)].map((_, index) => (
          <div key={index} className="stat-card loading">
            <div className="stat-icon shimmer"></div>
            <div className="stat-content">
              <div className="stat-value shimmer"></div>
              <div className="stat-title shimmer"></div>
              <div className="stat-description shimmer"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="stats-grid">
      <StatCard 
        title="Total Properties" 
        value={stats.totalProperties.toString()} 
        icon={<FaBuilding />}
        color="blue"
        description={`${stats.totalUnits} total units`}
      />
      
      <StatCard 
        title="Occupancy Rate" 
        value={`${stats.occupancyRate}%`}
        icon={<FaChartLine />}
        color="green"
        description={`${stats.occupiedUnits}/${stats.totalUnits} units occupied`}
        trend={stats.occupancyRate > 90 ? "up" : stats.occupancyRate < 70 ? "down" : "neutral"}
      />
      
      <StatCard 
        title="Monthly Revenue" 
        value={formatCurrency(stats.monthlyRevenue)}
        icon={<FaMoneyBillWave />}
        color="purple"
        description="Projected monthly income"
      />
      
      <StatCard 
        title="Active Maintenance" 
        value={stats.activeMaintenance.toString()}
        icon={<FaTools />}
        color="orange"
        description="Units + Requests needing attention"
        alert={stats.activeMaintenance > 0}
      />
      
      <StatCard 
        title="Total Units" 
        value={stats.totalUnits.toString()}
        icon={<FaBed />}
        color="teal"
        description="All rental units"
      />
      
      <StatCard 
        title="Occupied Units" 
        value={stats.occupiedUnits.toString()}
        icon={<FaUser />}
        color="indigo"
        description={`${stats.occupancyRate}% occupancy`}
      />
    </div>
  );
};

export default StatsGrid;