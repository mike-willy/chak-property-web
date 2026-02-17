// src/components/StatsGrid.jsx - FIXED VERSION
import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../pages/firebase/firebase";
import StatCard from "./StatCard";
import "../../styles/statsGrid.css";
import {
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
    activeMaintenance: 0,
    totalUnits: 0,
    occupiedUnits: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();

    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchTotalActiveMaintenance = async () => {
    try {
      let totalActiveMaintenance = 0;

      // Count units with maintenance status
      const propertiesSnapshot = await getDocs(collection(db, "properties"));

      for (const propertyDoc of propertiesSnapshot.docs) {
        const propertyId = propertyDoc.id;

        try {
          const unitsRef = collection(db, `properties/${propertyId}/units`);
          const unitsSnapshot = await getDocs(unitsRef);

          unitsSnapshot.forEach((unitDoc) => {
            const unitData = unitDoc.data();
            const status = (unitData.status || '').toLowerCase();

            if (status === "maintenance" ||
              status === "repair" ||
              status === "under_repair") {
              totalActiveMaintenance++;
            }
          });
        } catch (error) {
          // No units found
        }
      }

      // Count active maintenance requests
      try {
        const maintenanceRequestsRef = collection(db, "maintenance");
        const requestsSnapshot = await getDocs(maintenanceRequestsRef);

        requestsSnapshot.forEach((doc) => {
          const request = doc.data();
          const status = request.status?.toLowerCase();

          if (status === 'pending' ||
            status === 'in-progress' ||
            status === 'on-hold') {
            totalActiveMaintenance++;
          }
        });

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

      // 1. Fetch Properties (for property-based stats)
      const propertiesSnapshot = await getDocs(collection(db, "properties"));
      const properties = [];

      let totalUnits = 0;
      let occupiedUnits = 0;
      // We no longer calculate revenue from properties

      const totalActiveMaintenance = await fetchTotalActiveMaintenance();

      propertiesSnapshot.forEach((doc) => {
        const property = doc.data();
        properties.push(property);

        totalUnits += property.units || 0;

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
      });

      // 2. Fetch Active Tenants (for monthly revenue)
      // This ensures we only count actual, active rental income
      const tenantsRef = collection(db, "tenants");
      // We can't use simple query here easily if we want to be safe about case sensitivity, 
      // but 'active' is standard. Let's fetch all and filter to be safe, or use query.
      // Using query is better for performance.
      const q = query(tenantsRef, where("status", "==", "active"));
      const tenantsSnapshot = await getDocs(q);

      let monthlyRevenue = 0;
      tenantsSnapshot.forEach((doc) => {
        const tenant = doc.data();
        // Sum up monthly rent
        monthlyRevenue += (parseFloat(tenant.monthlyRent) || 0);
      });

      const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

      setStats({
        totalProperties: properties.length,
        totalUnits,
        occupiedUnits,
        occupancyRate,
        monthlyRevenue, // Now sourced from active tenants
        activeMaintenance: totalActiveMaintenance
      });

    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="sg-grid">
        {[...Array(6)].map((_, index) => (
          <div key={index} className="sg-card sg-loading">
            <div className="sg-icon sg-shimmer"></div>
            <div className="sg-content">
              <div className="sg-value sg-shimmer"></div>
              <div className="sg-title sg-shimmer"></div>
              <div className="sg-description sg-shimmer"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="sg-grid">
      {/* REMOVED customClass, using unique CSS classes via color prop */}
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