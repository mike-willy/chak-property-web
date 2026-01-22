// src/components/analytics/MetricCard.jsx
import React from 'react';
import { 
  FaArrowUp, 
  FaArrowDown, 
  FaMinus,
  FaDollarSign,
  FaHome,
  FaUsers,
  FaChartLine,
  FaExclamationTriangle,
  FaDoorClosed
} from 'react-icons/fa';
import '../../styles/analytics.css';

const MetricCard = ({ 
  title, 
  value, 
  icon, 
  trend = 'neutral', 
  subtitle, 
  color = 'primary',
  onClick 
}) => {
  const getTrendIcon = () => {
    switch(trend) {
      case 'up': return <FaArrowUp className="trend-icon up" />;
      case 'down': return <FaArrowDown className="trend-icon down" />;
      default: return <FaMinus className="trend-icon neutral" />;
    }
  };

  const getColorClass = () => {
    const colors = {
      primary: 'metric-primary',
      success: 'metric-success',
      warning: 'metric-warning',
      danger: 'metric-danger',
      info: 'metric-info'
    };
    return colors[color] || 'metric-primary';
  };

  const getIconComponent = () => {
    if (React.isValidElement(icon)) return icon;
    
    const iconMap = {
      dollar: <FaDollarSign />,
      home: <FaHome />,
      users: <FaUsers />,
      chart: <FaChartLine />,
      warning: <FaExclamationTriangle />,
      door: <FaDoorClosed />
    };
    
    return iconMap[icon] || <FaChartLine />;
  };

  return (
    <div className={`metric-card ${getColorClass()} ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="metric-header">
        <div className="metric-icon">
          {getIconComponent()}
        </div>
        <div className="metric-trend">
          {getTrendIcon()}
        </div>
      </div>
      
      <div className="metric-content">
        <div className="metric-value">{value}</div>
        <div className="metric-title">{title}</div>
        {subtitle && <div className="metric-subtitle">{subtitle}</div>}
      </div>
    </div>
  );
};

export default MetricCard;