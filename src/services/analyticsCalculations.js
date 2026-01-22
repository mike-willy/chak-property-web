// src/services/analyticsCalculations.js

/**
 * Calculate collection rate percentage
 * @param {number} collected - Amount collected
 * @param {number} expected - Amount expected
 * @returns {number} Collection rate (0-1)
 */
export const calculateCollectionRate = (collected, expected) => {
  if (expected <= 0) return 0;
  return Math.min(1, collected / expected);
};

/**
 * Calculate vacancy rate percentage
 * @param {number} vacantUnits - Number of vacant units
 * @param {number} totalUnits - Total number of units
 * @returns {number} Vacancy rate (0-1)
 */
export const calculateVacancyRate = (vacantUnits, totalUnits) => {
  if (totalUnits <= 0) return 0;
  return vacantUnits / totalUnits;
};

/**
 * Calculate tenant risk score (0-100)
 * Rule-based scoring system
 */
export const calculateTenantRiskScore = (payments, overduePayments) => {
  if (payments.length === 0) return 50; // Neutral score for new tenants
  
  const totalPayments = payments.length;
  const overdueCount = overduePayments.length;
  
  // Rule 1: Payment history weight (60%)
  const onTimeRate = Math.max(0, (totalPayments - overdueCount) / totalPayments);
  const historyScore = onTimeRate * 60;
  
  // Rule 2: Recent behavior weight (30%)
  const recentPayments = payments.slice(0, Math.min(3, payments.length));
  const recentOverdue = recentPayments.filter(p => 
    p.status === 'late' || p.status === 'overdue'
  ).length;
  const recentScore = (1 - (recentOverdue / recentPayments.length)) * 30;
  
  // Rule 3: Amount consistency weight (10%)
  const amounts = payments.map(p => p.amount).filter(Boolean);
  const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
  const consistency = amounts.every(amt => 
    Math.abs(amt - avgAmount) / avgAmount < 0.1
  ) ? 10 : 5;
  
  let score = historyScore + recentScore + consistency;
  
  // Apply penalty for current overdue payments
  const currentOverdue = overduePayments.filter(p => 
    p.status === 'overdue' && !p.paid
  ).length;
  
  if (currentOverdue > 0) {
    score -= currentOverdue * 10;
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
};

/**
 * Analyze payment patterns for a tenant
 */
export const analyzePaymentPatterns = (payments) => {
  if (payments.length === 0) {
    return {
      onTimeRate: 1,
      lateFrequency: 0,
      avgDaysLate: 0,
      consistency: 'unknown',
      paymentMethod: null
    };
  }
  
  const validPayments = payments.filter(p => p.date && p.dueDate);
  const onTimePayments = validPayments.filter(p => {
    if (!p.date || !p.dueDate) return true;
    const paymentDate = p.date.toDate ? p.date.toDate() : new Date(p.date);
    const dueDate = p.dueDate.toDate ? p.dueDate.toDate() : new Date(p.dueDate);
    return paymentDate <= dueDate;
  });
  
  const latePayments = validPayments.filter(p => {
    if (!p.date || !p.dueDate) return false;
    const paymentDate = p.date.toDate ? p.date.toDate() : new Date(p.date);
    const dueDate = p.dueDate.toDate ? p.dueDate.toDate() : new Date(p.dueDate);
    return paymentDate > dueDate;
  });
  
  // Calculate average days late
  let totalLateDays = 0;
  latePayments.forEach(p => {
    const paymentDate = p.date.toDate ? p.date.toDate() : new Date(p.date);
    const dueDate = p.dueDate.toDate ? p.dueDate.toDate() : new Date(p.dueDate);
    const daysLate = Math.ceil((paymentDate - dueDate) / (1000 * 60 * 60 * 24));
    totalLateDays += Math.max(0, daysLate);
  });
  
  // Analyze payment methods
  const methods = {};
  payments.forEach(p => {
    if (p.paymentMethod) {
      methods[p.paymentMethod] = (methods[p.paymentMethod] || 0) + 1;
    }
  });
  
  const mostCommonMethod = Object.entries(methods)
    .sort((a, b) => b[1] - a[1])[0];
  
  return {
    onTimeRate: validPayments.length > 0 ? onTimePayments.length / validPayments.length : 1,
    lateFrequency: validPayments.length > 0 ? latePayments.length / validPayments.length : 0,
    avgDaysLate: latePayments.length > 0 ? totalLateDays / latePayments.length : 0,
    consistency: getConsistencyLevel(validPayments.length, latePayments.length),
    paymentMethod: mostCommonMethod ? mostCommonMethod[0] : null,
    paymentMethodCount: mostCommonMethod ? mostCommonMethod[1] : 0
  };
};

/**
 * Generate insights from tenant analytics data
 */
export const generateInsights = (tenantAnalytics) => {
  const insights = [];
  
  // Insight 1: High-risk tenants
  const highRiskTenants = tenantAnalytics.filter(t => t.riskScore > 70);
  if (highRiskTenants.length > 0) {
    insights.push({
      type: 'risk_alert',
      title: 'High Risk Tenants',
      description: `${highRiskTenants.length} tenants have risk scores above 70`,
      priority: 'high',
      action: 'Review these tenants for possible lease termination or additional deposits',
      tenants: highRiskTenants.map(t => t.tenantName)
    });
  }
  
  // Insight 2: Consistent late payers
  const latePayers = tenantAnalytics.filter(t => t.paymentPatterns.lateFrequency > 0.5);
  if (latePayers.length > 0) {
    insights.push({
      type: 'payment_pattern',
      title: 'Frequent Late Payers',
      description: `${latePayers.length} tenants are frequently late with payments`,
      priority: 'medium',
      action: 'Consider implementing late fee policies or payment reminders',
      tenants: latePayers.map(t => t.tenantName)
    });
  }
  
  // Insight 3: Excellent payers
  const excellentPayers = tenantAnalytics.filter(t => 
    t.riskScore < 20 && t.payments.length >= 3
  );
  if (excellentPayers.length > 0) {
    insights.push({
      type: 'positive',
      title: 'Excellent Payers',
      description: `${excellentPayers.length} tenants have perfect payment records`,
      priority: 'low',
      action: 'Consider offering lease renewal incentives or rent discounts',
      tenants: excellentPayers.map(t => t.tenantName)
    });
  }
  
  // Insight 4: New tenants needing monitoring
  const newTenants = tenantAnalytics.filter(t => t.payments.length < 3);
  if (newTenants.length > 0) {
    insights.push({
      type: 'monitoring',
      title: 'New Tenants',
      description: `${newTenants.length} tenants have less than 3 payment records`,
      priority: 'medium',
      action: 'Monitor these tenants closely for their first few payments',
      tenants: newTenants.map(t => t.tenantName)
    });
  }
  
  return insights;
};

/**
 * Helper: Get consistency level
 */
const getConsistencyLevel = (totalPayments, latePayments) => {
  if (totalPayments === 0) return 'unknown';
  
  const onTimeRate = (totalPayments - latePayments) / totalPayments;
  
  if (onTimeRate >= 0.9) return 'excellent';
  if (onTimeRate >= 0.8) return 'good';
  if (onTimeRate >= 0.7) return 'fair';
  return 'poor';
};

/**
 * Calculate turnover cost for a vacant unit
 */
export const calculateTurnoverCost = (unit, vacancyDays) => {
  const dailyRent = (unit.monthlyRent || 0) / 30;
  const lostRent = dailyRent * vacancyDays;
  
  // Estimated costs (these could be configurable)
  const cleaningCost = 100;
  const advertisingCost = 50;
  const adminCost = 75;
  
  return {
    lostRent,
    cleaningCost,
    advertisingCost,
    adminCost,
    total: lostRent + cleaningCost + advertisingCost + adminCost,
    vacancyDays
  };
};

/**
 * Predict occupancy trend (simple rule-based)
 */
export const predictOccupancyTrend = (historicalData) => {
  if (!historicalData || historicalData.length < 2) {
    return { trend: 'stable', confidence: 'low' };
  }
  
  const recent = historicalData.slice(-3);
  const older = historicalData.slice(-6, -3);
  
  if (recent.length === 0 || older.length === 0) {
    return { trend: 'stable', confidence: 'low' };
  }
  
  const recentAvg = recent.reduce((sum, d) => sum + d.occupancyRate, 0) / recent.length;
  const olderAvg = older.reduce((sum, d) => sum + d.occupancyRate, 0) / older.length;
  
  const change = recentAvg - olderAvg;
  const percentChange = (change / olderAvg) * 100;
  
  if (percentChange > 5) {
    return { trend: 'improving', confidence: percentChange > 10 ? 'high' : 'medium' };
  } else if (percentChange < -5) {
    return { trend: 'declining', confidence: percentChange < -10 ? 'high' : 'medium' };
  } else {
    return { trend: 'stable', confidence: 'medium' };
  }
};