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
      const propertiesSnapshot = await getDocs(collection(db, "properties"));
      let totalUnits = 0;
      let leasedCount = 0;
      let maintenanceCount = 0;
      
      for (const prop of propertiesSnapshot.docs) {
        const units = await getDocs(collection(db, `properties/${prop.id}/units`));
        totalUnits += units.size;
        
        units.forEach(u => {
          const unitData = u.data();
          const status = (unitData.status || 'vacant').toLowerCase();
          
          const isUnderMaintenance = status === 'maintenance' || status === 'repair';
          const isLeased = status === 'leased' || status === 'occupied' || status === 'rented';
          
          if (isUnderMaintenance) {
            maintenanceCount++;
            if (isLeased || unitData.tenantId || unitData.leaseStatus === 'active') {
              leasedCount++;  // Leased unit under maintenance
            }
          } else if (isLeased) {
            leasedCount++;  // Regular leased unit
          }
        });
      }
      
      // Vacant = Total - Leased (includes vacant units under maintenance)
      const vacantCount = Math.max(0, totalUnits - leasedCount);
      
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