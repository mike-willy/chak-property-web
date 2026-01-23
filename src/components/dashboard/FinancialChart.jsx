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
import { collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";
import { db } from "../../pages/firebase/firebase";

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

      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(now);

      const paymentsRef = collection(db, "payments");
      const q = query(
        paymentsRef,
        where("status", "==", "completed"),
        where("completedAt", ">=", startTimestamp),
        where("completedAt", "<=", endTimestamp)
      );

      const snapshot = await getDocs(q);
      const payments = [];
      let total = 0;
      
      snapshot.forEach((doc) => {
        const payment = doc.data();
        
        let completedAt;
        if (payment.completedAt && payment.completedAt.toDate) {
          completedAt = payment.completedAt.toDate();
        } else if (payment.completedAt) {
          completedAt = new Date(payment.completedAt);
        } else if (payment.createdAt && payment.createdAt.toDate) {
          completedAt = payment.createdAt.toDate();
        } else if (payment.createdAt) {
          completedAt = new Date(payment.createdAt);
        } else {
          return;
        }
        
        if (completedAt >= startDate && completedAt <= now) {
          const amount = Number(payment.amount) || 0;
          payments.push({
            id: doc.id,
            ...payment,
            amount: amount,
            completedAt: completedAt
          });
          total += amount;
        }
      });

      setTotalRevenue(total);
      const processedData = processChartData(payments, selectedPeriod);
      setChartData(processedData);
      
    } catch (error) {
      console.error("Error fetching payment data:", error);
      
      if (error.code === 'failed-precondition') {
        console.error("Firebase index error. You need to create a composite index in Firebase Console.");
        console.error("Index fields: status (asc), completedAt (asc)");
      }
      
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (payments, period) => {
    if (!payments || payments.length === 0) return [];
    
    const monthlyData = {};
    
    payments.forEach(payment => {
      if (payment.completedAt) {
        const date = new Date(payment.completedAt);
        const monthYear = date.toLocaleString('en-US', { 
          month: 'short', 
          year: 'numeric' 
        });
        
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            month: monthYear,
            monthKey: monthKey,
            amount: 0,
            count: 0
          };
        }
        
        monthlyData[monthKey].amount += Number(payment.amount) || 0;
        monthlyData[monthKey].count += 1;
      }
    });

    let result = Object.values(monthlyData).sort((a, b) => {
      return a.monthKey.localeCompare(b.monthKey);
    });

    const monthLimit = period === "3months" ? 3 : period === "6months" ? 6 : 12;
    result = result.slice(-monthLimit);

    return result;
  };

  const formatCurrency = (amount) => {
    const numAmount = Number(amount) || 0;
    
    if (numAmount === 0) return "KSh 0";
    if (numAmount < 1000) return `KSh ${numAmount.toLocaleString('en-KE')}`;
    if (numAmount < 10000) return `KSh ${(numAmount).toLocaleString('en-KE')}`;
    if (numAmount < 100000) return `KSh ${(numAmount/1000).toFixed(1)}K`;
    if (numAmount < 1000000) return `KSh ${Math.round(numAmount/1000)}K`;
    if (numAmount < 10000000) return `KSh ${(numAmount/1000000).toFixed(2)}M`;
    if (numAmount < 100000000) return `KSh ${(numAmount/1000000).toFixed(1)}M`;
    if (numAmount < 1000000000) return `KSh ${Math.round(numAmount/1000000)}M`;
    
    return `KSh ${(numAmount/1000000000).toFixed(1)}B`;
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
        <div className="fc-custom-tooltip">
          <p className="fc-tooltip-label">{label}</p>
          <p className="fc-tooltip-value">
            Amount: <strong>{formatCurrency(payload[0].value)}</strong>
          </p>
          <p className="fc-tooltip-count">
            Payments: <strong>{payload[0].payload.count || 0}</strong>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fc-container"> {/* Unique class */}
      <div className="fc-card"> {/* Unique class */}
        <div className="fc-header"> {/* Unique class */}
          <div className="fc-header-left">
            <h3 className="fc-title">Financial Performance</h3>
            <p className="fc-subtitle">{getPeriodLabel()}</p>
          </div>
          <div className="fc-stats"> {/* Unique class */}
            <div className="fc-total-revenue">
              <span className="fc-revenue-label">Total Revenue:</span>
              <span className="fc-revenue-amount">{formatCurrency(totalRevenue)}</span>
            </div>
          </div>
          <div className="fc-filter"> {/* Unique class */}
            <button 
              className={`fc-filter-btn ${selectedPeriod === "3months" ? "fc-active" : ""}`}
              onClick={() => setSelectedPeriod("3months")}
            >
              3 Months
            </button>
            <button 
              className={`fc-filter-btn ${selectedPeriod === "6months" ? "fc-active" : ""}`}
              onClick={() => setSelectedPeriod("6months")}
            >
              6 Months
            </button>
            <button 
              className={`fc-filter-btn ${selectedPeriod === "1year" ? "fc-active" : ""}`}
              onClick={() => setSelectedPeriod("1year")}
            >
              1 Year
            </button>
          </div>
        </div>
        
        <div className="fc-chart-wrapper"> {/* Unique class */}
          {loading ? (
            <div className="fc-chart-loading">
              <div className="fc-spinner"></div>
              <p>Loading payment data...</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="fc-no-data">
              <p>No payment data available for the selected period.</p>
              <p className="fc-no-data-sub">Payments will appear here once tenants start paying via M-Pesa.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={chartData} 
                margin={{ top: 15, right: 15, left: 5, bottom: 25 }}
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
                  tickFormatter={(value) => {
                    if (value === 0) return "KSh 0";
                    if (value < 1000) return `KSh ${value}`;
                    if (value < 10000) return `KSh ${value}`;
                    if (value < 100000) return `KSh ${(value/1000).toFixed(1)}K`;
                    if (value < 1000000) return `KSh ${Math.round(value/1000)}K`;
                    if (value < 10000000) return `KSh ${(value/1000000).toFixed(2)}M`;
                    return `KSh ${(value/1000000).toFixed(1)}M`;
                  }}
                  width={60}
                />
                <Tooltip 
                  content={<CustomTooltip />}
                  cursor={{ fill: 'rgba(67, 97, 238, 0.1)' }}
                />
                <Bar 
                  dataKey="amount" 
                  name="Monthly Revenue"
                  fill="url(#fc-colorGradient)"
                  radius={[6, 6, 0, 0]}
                  barSize={40}
                />
                <defs>
                  <linearGradient id="fc-colorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4361ee" />
                    <stop offset="100%" stopColor="#3a56d4" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {chartData.length > 0 && (
          <div className="fc-summary"> {/* Unique class */}
            <div className="fc-summary-item">
              <span className="fc-summary-label">Average Monthly:</span>
              <span className="fc-summary-value">
                {formatCurrency(
                  chartData.reduce((sum, item) => sum + item.amount, 0) / chartData.length
                )}
              </span>
            </div>
            <div className="fc-summary-item">
              <span className="fc-summary-label">Highest Month:</span>
              <span className="fc-summary-value fc-highlight">
                {formatCurrency(
                  Math.max(...chartData.map(item => item.amount))
                )}
              </span>
            </div>
            <div className="fc-summary-item">
              <span className="fc-summary-label">Total Payments:</span>
              <span className="fc-summary-value">
                {chartData.reduce((sum, item) => sum + (item.count || 0), 0)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialChart;