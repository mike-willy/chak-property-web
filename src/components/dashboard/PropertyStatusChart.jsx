import React, { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../pages/firebase/firebase";
import "../../styles/propertyStatusChart.css";

const PropertyStatusChart = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [lastUpdated, setLastUpdated] = useState("");

  const fetchLiveData = async () => {
    try {
      setLoading(true);
      // Fetch all maintenance requests
      const maintenanceSnapshot = await getDocs(collection(db, "maintenance"));
      let maintenanceRequestCount = 0;
      maintenanceSnapshot.forEach(doc => {
        const req = doc.data();
        // Count only pending, in-progress, or on-hold
        if (["pending", "in-progress", "on-hold"].includes((req.status || "").toLowerCase())) {
          maintenanceRequestCount++;
        }
      });

      // Fetch all units for total, leased, and maintenance
      const propertiesSnapshot = await getDocs(collection(db, "properties"));
      let totalUnits = 0;
      let leasedCount = 0;
      let unitMaintenanceCount = 0;
      for (const prop of propertiesSnapshot.docs) {
        const units = await getDocs(collection(db, `properties/${prop.id}/units`));
        totalUnits += units.size;
        let leasedInThisProperty = 0;
        let maintenanceInThisProperty = 0;
        units.forEach(u => {
          const unitData = u.data();
          const status = (unitData.status || 'vacant').toLowerCase();
          const isLeased = status === 'leased' || status === 'occupied' || status === 'rented';
          const isUnderMaintenance = status === 'maintenance' || status === 'repair';
          if (isLeased) {
            leasedInThisProperty++;
          }
          if (isUnderMaintenance) {
            maintenanceInThisProperty++;
          }
        });
        leasedCount += leasedInThisProperty;
        unitMaintenanceCount += maintenanceInThisProperty;
      }
      const vacantCount = Math.max(0, totalUnits - leasedCount);

      // Maintenance = units under maintenance + maintenance requests
      const maintenanceCount = unitMaintenanceCount + maintenanceRequestCount;

      setData([
        { name: "Leased", value: leasedCount, color: "#4361ee" },
        { name: "Vacant", value: vacantCount, color: "#4cc9f0" },
        { name: "Maint", value: maintenanceCount, color: "#f72585" },
      ].filter(d => d.value > 0));
      setTotal(totalUnits);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchLiveData(); 
  }, []);

  return (
    <div className="property-status-card dashboard-card">
      <div className="status-header">
        <h3 className="status-title">STATUS</h3>
        <button className="refresh-button" onClick={fetchLiveData}>↻</button>
      </div>
      <div className="status-content">
        {loading ? <div className="loading-text">Loading...</div> : (
          <>
            <div className="chart-main-section">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} innerRadius={20} outerRadius={35} paddingAngle={3} dataKey="value" stroke="none">
                    {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="chart-center-text">
                <div className="center-total">{total}</div>
                <div className="center-label">Units</div>
              </div>
            </div>
            <div className="status-legend">
              {data.map((item, i) => (
                <div key={i} className="legend-item">
                  <div className="legend-info">
                    <div className="legend-dot" style={{ backgroundColor: item.color }} />
                    <span className="legend-label">{item.name} ({item.value})</span>
                  </div>
                  <span className="legend-percent">{Math.round((item.value / total) * 100)}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="last-updated">Updated: {lastUpdated}</div>
    </div>
  );
};

export default PropertyStatusChart;