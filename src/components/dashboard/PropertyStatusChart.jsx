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
      
      // Fetch all properties
      const propertiesSnapshot = await getDocs(collection(db, "properties"));
      let leasedCount = 0;
      let vacantCount = 0;
      let maintenanceCount = 0;
      
      // For each property, count units by status
      for (const propertyDoc of propertiesSnapshot.docs) {
        const propertyData = propertyDoc.data();
        const propertyId = propertyDoc.id;
        
        try {
          // Try to get units from subcollection
          const unitsSnapshot = await getDocs(
            collection(db, `properties/${propertyId}/units`)
          );
          
          for (const unitDoc of unitsSnapshot.docs) {
            const unitData = unitDoc.data();
            const status = unitData.status?.toLowerCase() || "vacant";
            
            switch (status) {
              case "leased":
                leasedCount++;
                break;
              case "vacant":
                vacantCount++;
                break;
              case "maintenance":
                maintenanceCount++;
                break;
              default:
                vacantCount++;
            }
          }
        } catch (error) {
          // If no units subcollection, use property summary data
          const unitDetails = propertyData.unitDetails || {};
          leasedCount += unitDetails.leasedCount || 0;
          vacantCount += unitDetails.vacantCount || 0;
          maintenanceCount += unitDetails.maintenanceCount || 0;
        }
      }
      
      // Calculate total
      const totalUnits = leasedCount + vacantCount + maintenanceCount;
      
      // Prepare data with same colors as before
      const liveData = [
        { name: "Leased", value: leasedCount, color: "#4361ee" },
        { name: "Vacant", value: vacantCount, color: "#4cc9f0" },
        { name: "Maintenance", value: maintenanceCount, color: "#f72585" },
      ].filter(item => item.value > 0); // Remove zero values
      
      setData(liveData);
      setTotal(totalUnits);
      setLastUpdated(new Date().toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      }));
      
    } catch (error) {
      console.error("Error fetching live data:", error);
      // Fallback to sample data
      setData([
        { name: "Leased", value: 13, color: "#4361ee" },
        { name: "Vacant", value: 4, color: "#4cc9f0" },
        { name: "Maintenance", value: 4, color: "#f72585" },
      ]);
      setTotal(21);
      setLastUpdated("Error loading");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveData();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchLiveData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    fetchLiveData();
  };

  if (loading) {
    return (
      <div className="property-status-card">
        <div className="status-header">
          <h3 className="status-title">Status</h3>
          <button 
            className="refresh-button" 
            onClick={handleRefresh}
            disabled={loading}
          >
            ↻
          </button>
        </div>
        <div className="loading-state">
          <div className="spinner-small"></div>
          <span>Loading live data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="property-status-card">
      <div className="status-header">
        <h3 className="status-title">Status</h3>
        <button 
          className="refresh-button" 
          onClick={handleRefresh}
          title="Refresh data"
        >
          ↻
        </button>
      </div>
      
      <div className="status-content">
        <div className="chart-container">
          {data.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                    paddingAngle={2}
                    dataKey="value"
                    animationDuration={1000}
                  >
                    {data.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color} 
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="chart-center-text">
                <div className="center-total">{total}</div>
                <div className="center-label">Total Units</div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>No units data available</p>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="status-legend">
          {data.map((item, index) => (
            <div key={index} className="legend-item">
              <div 
                className="legend-color" 
                style={{ backgroundColor: item.color }}
              ></div>
              <div className="legend-text">
                <span className="legend-label">{item.name}</span>
                <div className="legend-value-container">
                  <span className="legend-value">({item.value})</span>
                  {total > 0 && (
                    <span className="legend-percentage">
                      {Math.round((item.value / total) * 100)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Last Updated */}
      <div className="last-updated">
        <span className="update-time">Updated: {lastUpdated}</span>
      </div>
    </div>
  );
};

export default PropertyStatusChart;