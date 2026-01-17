import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from "recharts";
import "../../styles/financialChart.css";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../pages/firebase/firebase"; // Adjust path as needed

const FinancialChart = () => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("6months");
  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    fetchPaymentData();
  }, [selectedPeriod]);

  const fetchPaymentData = async () => {
    try {
      setLoading(true);
      
      // Get current date and calculate date range
      const now = new Date();
      let startDate = new Date();
      
      switch (selectedPeriod) {
        case "3months":
          startDate.setMonth(now.getMonth() - 3);
          break;
        case "6months":
          startDate.setMonth(now.getMonth() - 6);
          break;
        case "1year":
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          startDate.setMonth(now.getMonth() - 6);
      }

      // Query completed payments within date range
      const paymentsRef = collection(db, "payments");
      const q = query(
        paymentsRef,
        where("status", "==", "completed"),
        where("completedAt", ">=", startDate),
        orderBy("completedAt", "asc")
      );

      const snapshot = await getDocs(q);
      const payments = [];
      let total = 0;
      
      snapshot.forEach((doc) => {
        const payment = doc.data();
        payments.push({
          id: doc.id,
          ...payment,
          // Ensure completedAt is a Date object
          completedAt: payment.completedAt?.toDate()
        });
        total += payment.amount || 0;
      });

      setTotalRevenue(total);
      
      // Process data for chart
      const processedData = processChartData(payments, selectedPeriod);
      setChartData(processedData);
      
    } catch (error) {
      console.error("Error fetching payment data:", error);
      // Fallback to empty data if error
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (payments, period) => {
    // Group payments by month
    const monthlyData = {};
    
    payments.forEach(payment => {
      if (payment.completedAt) {
        const monthYear = payment.completedAt.toLocaleString('default', { 
          month: 'short', 
          year: 'numeric' 
        });
        
        if (!monthlyData[monthYear]) {
          monthlyData[monthYear] = {
            month: monthYear,
            amount: 0,
            count: 0
          };
        }
        
        monthlyData[monthYear].amount += payment.amount || 0;
        monthlyData[monthYear].count += 1;
      }
    });

    // Convert to array and sort by date
    let result = Object.values(monthlyData).sort((a, b) => {
      const dateA = new Date(`1 ${a.month}`);
      const dateB = new Date(`1 ${b.month}`);
      return dateA - dateB;
    });

    // Limit to number of months based on period
    const monthLimit = period === "3months" ? 3 : period === "6months" ? 6 : 12;
    result = result.slice(-monthLimit);

    return result;
  };

  const formatCurrency = (amount) => {
    return `KSh ${amount?.toLocaleString() || 0}`;
  };

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case "3months": return "Last 3 Months";
      case "6months": return "Last 6 Months";
      case "1year": return "Last Year";
      default: return "Last 6 Months";
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{label}</p>
          <p className="tooltip-value">
            Amount: <strong>{formatCurrency(payload[0].value)}</strong>
          </p>
          <p className="tooltip-count">
            Payments: <strong>{payload[0].payload.count || 0}</strong>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="financial-chart-card">
      <div className="chart-header">
        <div>
          <h3 className="chart-title">Financial Performance</h3>
          <p className="chart-subtitle">{getPeriodLabel()}</p>
        </div>
        <div className="chart-stats">
          <div className="total-revenue">
            <span className="revenue-label">Total Revenue:</span>
            <span className="revenue-amount">{formatCurrency(totalRevenue)}</span>
          </div>
        </div>
        <div className="chart-filter">
          <button 
            className={`filter-btn ${selectedPeriod === "3months" ? "active" : ""}`}
            onClick={() => setSelectedPeriod("3months")}
          >
            3 Months
          </button>
          <button 
            className={`filter-btn ${selectedPeriod === "6months" ? "active" : ""}`}
            onClick={() => setSelectedPeriod("6months")}
          >
            6 Months
          </button>
          <button 
            className={`filter-btn ${selectedPeriod === "1year" ? "active" : ""}`}
            onClick={() => setSelectedPeriod("1year")}
          >
            1 Year
          </button>
        </div>
      </div>
      
      <div className="chart-wrapper">
        {loading ? (
          <div className="chart-loading">
            <div className="spinner"></div>
            <p>Loading payment data...</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="no-data">
            <p>No payment data available for the selected period.</p>
            <p className="no-data-sub">Payments will appear here once tenants start paying via M-Pesa.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart 
              data={chartData} 
              margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9ecef" />
              <XAxis 
                dataKey="month" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6c757d', fontSize: 12 }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6c757d', fontSize: 11 }}
                tickFormatter={(value) => `KSh ${(value/1000).toFixed(0)}K`}
              />
              <Tooltip 
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(67, 97, 238, 0.1)' }}
              />
              <Bar 
                dataKey="amount" 
                name="Monthly Revenue"
                fill="url(#colorGradient)"
                radius={[6, 6, 0, 0]}
                barSize={40}
              />
              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4361ee" />
                  <stop offset="100%" stopColor="#3a56d4" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Summary Stats */}
      {chartData.length > 0 && (
        <div className="chart-summary">
          <div className="summary-item">
            <span className="summary-label">Average Monthly:</span>
            <span className="summary-value">
              {formatCurrency(
                chartData.reduce((sum, item) => sum + item.amount, 0) / chartData.length
              )}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Highest Month:</span>
            <span className="summary-value highlight">
              {formatCurrency(
                Math.max(...chartData.map(item => item.amount))
              )}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Total Payments:</span>
            <span className="summary-value">
              {chartData.reduce((sum, item) => sum + (item.count || 0), 0)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialChart;