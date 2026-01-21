import React, { useState } from "react";
import { FaHome, FaUserPlus, FaEnvelope } from "react-icons/fa";
import { Link } from "react-router-dom";
import MessageModal from "./MessageModal";
import "../../styles/quickActions.css";

const QuickActions = () => {
  const [showMessageModal, setShowMessageModal] = useState(false);

  const actions = [
    { label: "New Property", icon: <FaHome />, path: "/properties/add" },
    { label: "Add Tenant", icon: <FaUserPlus />, path: "/tenants/add" },
    { label: "Add Landlord", icon: <FaUserPlus />, path: "/landlords/add" },
    { label: "Message", icon: <FaEnvelope />, onClick: () => setShowMessageModal(true) },
  ];

  return (
    <div className="quick-actions-card dashboard-card">
      <h3 className="quick-actions-title">QUICK ACTIONS</h3>
      <div className="quick-actions-grid">
        {actions.map((action, index) => {
          const content = (
            <div className="quick-action-btn-content">
              <span className="action-icon">{action.icon}</span>
              <span className="action-label">{action.label}</span>
            </div>
          );

          return action.path ? (
            <Link key={index} to={action.path} className="quick-action-item">
              {content}
            </Link>
          ) : (
            <button key={index} className="quick-action-item" onClick={action.onClick}>
              {content}
            </button>
          );
        })}
      </div>
      <MessageModal isOpen={showMessageModal} onClose={() => setShowMessageModal(false)} />
    </div>
  );
};

export default QuickActions;