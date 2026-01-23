// src/components/StatCard.jsx - FINAL FIXED VERSION
import React from "react";

const StatCard = ({ 
  title, 
  value, 
  icon, 
  color = "blue", 
  description, 
  trend,
  alert = false,
  customClass = ""
}) => {
  const getTrendIcon = () => {
    switch(trend) {
      case "up": return "↗";
      case "down": return "↘";
      case "neutral": return "→";
      default: return null;
    }
  };

  return (
    <div className={`sg-card sg-${color} ${alert ? 'sg-card-alert' : ''} ${customClass}`}>
      {/* Changed 'sg-alert' to 'sg-card-alert' ^^^ */}
      <div className="sg-header">
        <div className="sg-icon">
          {icon}
        </div>
        <div className="sg-trend">
          {getTrendIcon()}
          {alert && <span className="sg-alert-badge">!</span>}
        </div>
      </div>
      <div className="sg-content">
        <div className="sg-value">{value}</div>
        <div className="sg-title">{title}</div>
        {description && (
          <div className="sg-description">{description}</div>
        )}
      </div>
    </div>
  );
};

export default StatCard;