// src/services/analyticsService.js
import { db } from "../pages/firebase/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy,
  limit,
  Timestamp 
} from 'firebase/firestore';
import { 
  calculateCollectionRate,
  calculateVacancyRate,
  calculateTenantRiskScore,
  analyzePaymentPatterns,
  generateInsights 
} from './analyticsCalculations';

/**
 * Main Analytics Service - UPDATED WITH FIXED VACANCY CALCULATION
 */
class AnalyticsService {
  
  /**
   * Get Rent Collection Analytics - FIXED
   */
  async getRentCollectionAnalytics(timeframe = 'monthly', startDate = null, endDate = null) {
    try {
      // 1. Get all properties and units - USING YOUR STRUCTURE
      const properties = await this._getAllProperties();
      const totalUnits = properties.reduce((sum, prop) => sum + (prop.units || 0), 0);
      
      // 2. Get occupied units (tenants with status = 'active')
      const occupiedUnits = await this._getOccupiedUnits();
      
      // 3. Get payments for the timeframe - USING YOUR PAYMENT STRUCTURE
      const payments = await this._getPaymentsForTimeframe(timeframe, startDate, endDate);
      
      // 4. Calculate expected rent (based on tenant monthlyRent)
      const expectedRent = await this._calculateExpectedRent(occupiedUnits, timeframe);
      
      // 5. Calculate collected rent (completed payments only)
      const collectedRent = payments
        .filter(p => p.status === 'completed')
        .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
      
      // 6. Get overdue payments (pending payments)
      const overduePayments = payments.filter(p => p.status === 'pending');
      
      return {
        summary: {
          totalUnits,
          occupiedUnits: occupiedUnits.length,
          expectedRent,
          collectedRent,
          collectionRate: calculateCollectionRate(collectedRent, expectedRent),
          outstandingAmount: overduePayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
          latePaymentsCount: overduePayments.length,
          completedPaymentsCount: payments.filter(p => p.status === 'completed').length
        },
        details: {
          payments: payments.slice(0, 50), // Limit for performance
          overduePayments,
          properties: properties.map(p => ({
            id: p.id,
            name: p.name,
            units: p.units,
            occupiedCount: occupiedUnits.filter(unit => unit.propertyId === p.id).length
          }))
        },
        timeframe: this._getTimeframeLabel(timeframe, startDate, endDate)
      };
    } catch (error) {
      console.error('Error getting rent collection analytics:', error);
      throw error;
    }
  }
  
  /**
   * Get Vacancy Rate Analytics - FIXED WITH CORRECT VACANCY COUNTING
   */
  async getVacancyRateAnalytics() {
    try {
      // 1. Get all properties
      const properties = await this._getAllProperties();
      const allUnits = [];
      
      // 2. Get units from each property subcollection
      for (const property of properties) {
        try {
          const unitsRef = collection(db, `properties/${property.id}/units`);
          const unitsSnapshot = await getDocs(unitsRef);
          
          unitsSnapshot.forEach((unitDoc) => {
            const unitData = unitDoc.data();
            
            // Check occupancy using YOUR dual status system
            const occupancyStatus = unitData.occupancyStatus || 
                                   (unitData.status && unitData.status.toLowerCase() === 'leased' ? 'leased' : 'vacant');
            const maintenanceStatus = unitData.maintenanceStatus || 'normal';
            
            const isOccupied = occupancyStatus === 'leased';
            const isUnderMaintenance = maintenanceStatus === 'under_maintenance';
            
            allUnits.push({
              id: unitDoc.id,
              propertyId: property.id,
              propertyName: property.name,
              unitNumber: unitData.unitNumber || unitData.unitName || `Unit ${unitDoc.id.substring(0, 8)}`,
              occupancyStatus,
              maintenanceStatus,
              tenantId: unitData.tenantId,
              tenantName: unitData.tenantName,
              rentAmount: unitData.rentAmount || unitData.monthlyRent || 0,
              isOccupied,
              isUnderMaintenance,
              // FIXED: A unit is vacant if occupancyStatus is "vacant" (regardless of maintenance status)
              isVacant: occupancyStatus === 'vacant',
              displayStatus: isUnderMaintenance 
                ? (isOccupied ? 'LEASED & UNDER MAINTENANCE' : 'VACANT & UNDER MAINTENANCE')
                : occupancyStatus.toUpperCase()
            });
          });
          
        } catch (error) {
          console.log(`No units found for property ${property.name}:`, error.message);
        }
      }
      
      // 3. Categorize units - FIXED VERSION
      const vacantUnits = allUnits.filter(unit => unit.occupancyStatus === "vacant");
      const occupiedUnits = allUnits.filter(unit => unit.occupancyStatus === "leased");
      const maintenanceUnits = allUnits.filter(unit => unit.maintenanceStatus === "under_maintenance");
      
      // Calculate intersection counts for detailed insights
      const vacantUnderMaintenance = vacantUnits.filter(unit => unit.isUnderMaintenance).length;
      const leasedUnderMaintenance = occupiedUnits.filter(unit => unit.isUnderMaintenance).length;
      
      // 4. Calculate vacancy durations
      const vacancyDurations = this._calculateVacancyDurations(vacantUnits);
      
      return {
        summary: {
          totalUnits: allUnits.length,
          occupiedUnits: occupiedUnits.length,
          vacantUnits: vacantUnits.length, // ALL units with occupancyStatus = "vacant"
          maintenanceUnits: maintenanceUnits.length,
          // Detailed breakdown
          vacantNormal: vacantUnits.length - vacantUnderMaintenance,
          vacantUnderMaintenance: vacantUnderMaintenance,
          leasedNormal: occupiedUnits.length - leasedUnderMaintenance,
          leasedUnderMaintenance: leasedUnderMaintenance,
          
          vacancyRate: calculateVacancyRate(vacantUnits.length, allUnits.length),
          occupancyRate: calculateVacancyRate(occupiedUnits.length, allUnits.length),
          maintenanceRate: calculateVacancyRate(maintenanceUnits.length, allUnits.length),
          avgVacancyDays: vacancyDurations.avgDays || 0,
          longestVacancy: vacancyDurations.longest || 0
        },
        details: {
          vacantUnits: vacantUnits.map(unit => ({
            ...unit,
            vacancyDays: vacancyDurations.unitDays[unit.id] || 0
          })),
          occupiedUnits,
          maintenanceUnits,
          byProperty: this._groupUnitsByProperty(allUnits)
        }
      };
    } catch (error) {
      console.error('Error getting vacancy rate analytics:', error);
      throw error;
    }
  }
  
  /**
   * Get Tenant Payment Behavior Analytics - FIXED
   */
  async getTenantBehaviorAnalytics() {
    try {
      // 1. Get all ACTIVE tenants (status = 'active')
      const tenants = await this._getAllTenants();
      
      // 2. Get payment history for each tenant
      const tenantAnalytics = await Promise.all(
        tenants.map(async (tenant) => {
          const payments = await this._getTenantPayments(tenant.id);
          const overduePayments = payments.filter(p => p.status === 'pending');
          
          return {
            tenantId: tenant.id,
            tenantName: tenant.fullName || tenant.email,
            propertyId: tenant.propertyId,
            propertyName: tenant.propertyName,
            unitId: tenant.unitId,
            unitNumber: tenant.unitNumber,
            monthlyRent: tenant.monthlyRent || 0,
            balance: tenant.balance || 0,
            status: tenant.status,
            payments,
            overduePayments,
            riskScore: calculateTenantRiskScore(payments, overduePayments),
            paymentPatterns: analyzePaymentPatterns(payments),
            lastPayment: payments.length > 0 ? payments[0].transactionDate || payments[0].createdAt : null,
            totalPaid: payments
              .filter(p => p.status === 'completed')
              .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
          };
        })
      );
      
      // 3. Generate insights from tenant data
      const insights = generateInsights(tenantAnalytics);
      
      return {
        summary: {
          totalTenants: tenantAnalytics.length,
          averageRiskScore: tenantAnalytics.reduce((sum, t) => sum + t.riskScore, 0) / tenantAnalytics.length || 0,
          onTimePayers: tenantAnalytics.filter(t => t.paymentPatterns.onTimeRate > 0.8).length,
          frequentLatePayers: tenantAnalytics.filter(t => t.paymentPatterns.lateFrequency > 0.3).length,
          totalMonthlyRent: tenantAnalytics.reduce((sum, t) => sum + t.monthlyRent, 0),
          totalOutstandingBalance: tenantAnalytics.reduce((sum, t) => sum + t.balance, 0)
        },
        details: {
          tenants: tenantAnalytics,
          riskDistribution: this._categorizeRisk(tenantAnalytics),
          paymentPatterns: this._aggregatePatterns(tenantAnalytics),
          topTenants: tenantAnalytics.sort((a, b) => b.riskScore - a.riskScore).slice(0, 10)
        },
        insights
      };
    } catch (error) {
      console.error('Error getting tenant behavior analytics:', error);
      throw error;
    }
  }
  
  /**
   * Generate Analytics Insights (Rule-based) - UPDATED WITH FIXED DATA STRUCTURE
   */
  async generateAnalyticsInsights() {
    try {
      // Get all three analytics datasets
      const [rentData, vacancyData, tenantData] = await Promise.all([
        this.getRentCollectionAnalytics(),
        this.getVacancyRateAnalytics(),
        this.getTenantBehaviorAnalytics()
      ]);
      
      // Apply rule-based intelligence
      const insights = [];
      const timestamp = Date.now();
      
      // Rule 1: Low collection rate alert
      if (rentData.summary.collectionRate < 0.85) {
        insights.push({
          id: `insight_${timestamp}_1`,
          type: 'warning',
          category: 'rent_collection',
          title: 'Low Collection Rate',
          description: `Collection rate is ${(rentData.summary.collectionRate * 100).toFixed(1)}%, below the 85% target`,
          priority: 'high',
          recommendation: 'Review pending payments and send reminders to tenants',
          action: 'Review pending payments and send reminders to tenants',
          // FLATTENED DATA - no nested objects
          data: {
            collectionRate: rentData.summary.collectionRate,
            outstandingAmount: rentData.summary.outstandingAmount,
            pendingPayments: rentData.summary.latePaymentsCount,
            expectedRent: rentData.summary.expectedRent,
            collectedRent: rentData.summary.collectedRent
          },
          tenants: []
        });
      }
      
      // Rule 2: High vacancy rate alert
      if (vacancyData.summary.vacancyRate > 0.15) {
        insights.push({
          id: `insight_${timestamp}_2`,
          type: 'warning',
          category: 'vacancy',
          title: 'High Vacancy Rate',
          description: `Vacancy rate is ${(vacancyData.summary.vacancyRate * 100).toFixed(1)}%, above the 15% threshold`,
          priority: 'medium',
          recommendation: 'Consider rent adjustments or marketing campaigns',
          action: 'Consider rent adjustments or marketing campaigns',
          // FLATTENED DATA
          data: {
            vacancyRate: vacancyData.summary.vacancyRate,
            vacantUnits: vacancyData.summary.vacantUnits,
            avgVacancyDays: vacancyData.summary.avgVacancyDays,
            totalUnits: vacancyData.summary.totalUnits,
            occupiedUnits: vacancyData.summary.occupiedUnits
          },
          tenants: []
        });
      }
      
      // Rule 3: High-risk tenants alert
      const highRiskTenants = tenantData.details.tenants.filter(t => t.riskScore > 70);
      if (highRiskTenants.length > 0) {
        // Extract tenant names only (not full objects)
        const highRiskTenantNames = highRiskTenants.map(t => t.tenantName || 'Unknown Tenant');
        
        insights.push({
          id: `insight_${timestamp}_3`,
          type: 'alert',
          category: 'tenant_behavior',
          title: 'High-Risk Tenants Detected',
          description: `${highRiskTenants.length} tenants have high risk scores`,
          priority: 'high',
          recommendation: 'Review these tenants for possible lease termination or additional deposits',
          action: 'Review these tenants for possible lease termination or additional deposits',
          // FLATTENED DATA - using simple values
          data: {
            highRiskCount: highRiskTenants.length,
            averageRiskScore: highRiskTenants.reduce((sum, t) => sum + t.riskScore, 0) / highRiskTenants.length,
            totalOutstanding: highRiskTenants.reduce((sum, t) => sum + t.balance, 0),
            totalLatePayments: highRiskTenants.reduce((sum, t) => sum + t.overduePayments.length, 0)
          },
          tenants: highRiskTenantNames.slice(0, 5) // Limit to 5 names
        });
      }
      
      // Rule 4: Units under maintenance
      if (vacancyData.summary.maintenanceUnits > 0) {
        // Get unit numbers/names for display
        const maintenanceUnitNames = vacancyData.details.maintenanceUnits
          .slice(0, 3)
          .map(unit => unit.unitNumber || `Unit ${unit.id.substring(0, 8)}`);
        
        insights.push({
          id: `insight_${timestamp}_4`,
          type: 'maintenance',
          category: 'vacancy',
          title: 'Units Under Maintenance',
          description: `${vacancyData.summary.maintenanceUnits} units are under maintenance`,
          priority: 'medium',
          recommendation: 'Check maintenance status and estimated completion dates',
          action: 'Check maintenance status and estimated completion dates',
          // FLATTENED DATA
          data: {
            maintenanceUnits: vacancyData.summary.maintenanceUnits,
            leasedUnderMaintenance: vacancyData.summary.leasedUnderMaintenance,
            vacantUnderMaintenance: vacancyData.summary.vacantUnderMaintenance
          },
          tenants: maintenanceUnitNames
        });
      }
      
      // Rule 5: Vacant units under maintenance
      if (vacancyData.summary.vacantUnderMaintenance > 0) {
        // Get unit numbers for vacant units under maintenance
        const vacantMaintenanceUnits = vacancyData.details.vacantUnits
          .filter(unit => unit.isUnderMaintenance)
          .slice(0, 3)
          .map(unit => unit.unitNumber || `Unit ${unit.id.substring(0, 8)}`);
        
        insights.push({
          id: `insight_${timestamp}_5`,
          type: 'maintenance',
          category: 'vacancy',
          title: 'Vacant Units Under Maintenance',
          description: `${vacancyData.summary.vacantUnderMaintenance} vacant units are under maintenance`,
          priority: 'medium',
          recommendation: 'Prioritize maintenance completion to make these units rent-ready',
          action: 'Prioritize maintenance completion to make these units rent-ready',
          // FLATTENED DATA
          data: {
            vacantUnderMaintenance: vacancyData.summary.vacantUnderMaintenance,
            normalVacant: vacancyData.summary.vacantNormal,
            totalVacant: vacancyData.summary.vacantUnits
          },
          tenants: vacantMaintenanceUnits
        });
      }
      
      // Rule 6: Positive insight - Good collection rate
      if (rentData.summary.collectionRate >= 0.95) {
        insights.push({
          id: `insight_${timestamp}_6`,
          type: 'positive',
          category: 'rent_collection',
          title: 'Excellent Collection Rate',
          description: `Collection rate is ${(rentData.summary.collectionRate * 100).toFixed(1)}%, exceeding the 95% target`,
          priority: 'low',
          recommendation: 'Continue current collection strategies',
          action: 'Continue current collection strategies',
          // FLATTENED DATA
          data: {
            collectionRate: rentData.summary.collectionRate,
            completedPayments: rentData.summary.completedPaymentsCount,
            latePayments: rentData.summary.latePaymentsCount
          },
          tenants: []
        });
      }
      
      // Rule 7: Low vacancy rate (positive)
      if (vacancyData.summary.vacancyRate < 0.05) {
        insights.push({
          id: `insight_${timestamp}_7`,
          type: 'positive',
          category: 'vacancy',
          title: 'Low Vacancy Rate',
          description: `Vacancy rate is ${(vacancyData.summary.vacancyRate * 100).toFixed(1)}%, below the 5% target`,
          priority: 'low',
          recommendation: 'Property is operating at high occupancy',
          action: 'Property is operating at high occupancy',
          // FLATTENED DATA
          data: {
            vacancyRate: vacancyData.summary.vacancyRate,
            occupancyRate: vacancyData.summary.occupancyRate,
            totalUnits: vacancyData.summary.totalUnits,
            occupiedUnits: vacancyData.summary.occupiedUnits
          },
          tenants: []
        });
      }
      
      // Add more rules as needed...
      
      return insights;
    } catch (error) {
      console.error('Error generating insights:', error);
      // Return empty array instead of throwing error to prevent UI crash
      return [];
    }
  }
  
  // ============ PRIVATE HELPER METHODS - UPDATED WITH YOUR FIELD NAMES ============
  
  async _getAllProperties() {
    try {
      const querySnapshot = await getDocs(collection(db, "properties"));
      const properties = [];
      
      querySnapshot.forEach((doc) => {
        properties.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return properties;
    } catch (error) {
      console.error('Error fetching properties:', error);
      return [];
    }
  }
  
  async _getOccupiedUnits() {
    try {
      const occupiedUnits = [];
      
      // Get all ACTIVE tenants from tenants collection
      const tenantsQuery = query(
        collection(db, "tenants"),
        where("status", "==", "active")
      );
      const tenantsSnapshot = await getDocs(tenantsQuery);
      
      tenantsSnapshot.forEach((tenantDoc) => {
        const tenantData = tenantDoc.data();
        
        // Only include tenants with property and unit IDs
        if (tenantData.propertyId && tenantData.unitId) {
          occupiedUnits.push({
            id: tenantDoc.id,
            tenantId: tenantDoc.id,
            tenantName: tenantData.fullName,
            propertyId: tenantData.propertyId,
            unitId: tenantData.unitId,
            monthlyRent: tenantData.monthlyRent || 0,
            leaseStart: tenantData.leaseStart,
            leaseEnd: tenantData.leaseEnd,
            balance: tenantData.balance || 0
          });
        }
      });
      
      console.log(`Found ${occupiedUnits.length} occupied units from tenants collection`);
      return occupiedUnits;
      
    } catch (error) {
      console.error('Error fetching occupied units:', error);
      return [];
    }
  }
  
  async _getPaymentsForTimeframe(timeframe, startDate, endDate) {
    try {
      let dateFilter = this._getDateRange(timeframe, startDate, endDate);
      
      // Get payments within timeframe
      const paymentsRef = collection(db, 'payments');
      const q = query(
        paymentsRef,
        where('createdAt', '>=', dateFilter.start),
        where('createdAt', '<=', dateFilter.end),
        orderBy('createdAt', 'desc'),
        limit(1000) // Limit for performance
      );
      
      const querySnapshot = await getDocs(q);
      const payments = [];
      
      querySnapshot.forEach((doc) => {
        const paymentData = doc.data();
        payments.push({
          id: doc.id,
          ...paymentData,
          amount: Number(paymentData.amount) || 0
        });
      });
      
      return payments;
    } catch (error) {
      console.error('Error fetching payments:', error);
      return [];
    }
  }
  
  async _calculateExpectedRent(occupiedUnits, timeframe) {
    // Calculate expected rent based on tenant monthlyRent
    const monthlyRent = occupiedUnits.reduce((sum, unit) => sum + (unit.monthlyRent || 0), 0);
    
    switch (timeframe) {
      case 'monthly':
        return monthlyRent;
      case 'quarterly':
        return monthlyRent * 3;
      case 'yearly':
        return monthlyRent * 12;
      default:
        return monthlyRent;
    }
  }
  
  async _getAllTenants() {
    try {
      // Get only ACTIVE tenants for analytics
      const q = query(
        collection(db, "tenants"),
        where("status", "==", "active")
      );
      
      const snapshot = await getDocs(q);
      const tenants = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        tenants.push({
          id: doc.id,
          ...data
        });
      });
      
      return tenants;
    } catch (error) {
      console.error('Error fetching tenants:', error);
      return [];
    }
  }
  
  async _getTenantPayments(tenantId) {
    try {
      // Get payments for specific tenant
      const paymentsRef = collection(db, 'payments');
      const q = query(
        paymentsRef,
        where('tenantId', '==', tenantId),
        orderBy('createdAt', 'desc'),
        limit(12) // Last 12 payments
      );
      
      const querySnapshot = await getDocs(q);
      const payments = [];
      
      querySnapshot.forEach((doc) => {
        const paymentData = doc.data();
        payments.push({
          id: doc.id,
          ...paymentData,
          amount: Number(paymentData.amount) || 0
        });
      });
      
      return payments;
    } catch (error) {
      console.error(`Error fetching payments for tenant ${tenantId}:`, error);
      return [];
    }
  }
  
  _calculateVacancyDurations(vacantUnits) {
    // Simplified calculation - in production, you'd track vacancy start dates
    const unitDays = {};
    let totalDays = 0;
    let longest = 0;
    
    // Mock data for now - you should implement actual vacancy duration tracking
    vacantUnits.forEach(unit => {
      // For now, use random days 1-90
      const days = Math.floor(Math.random() * 90) + 1;
      unitDays[unit.id] = days;
      totalDays += days;
      if (days > longest) longest = days;
    });
    
    return {
      unitDays,
      avgDays: vacantUnits.length > 0 ? Math.round(totalDays / vacantUnits.length) : 0,
      longest
    };
  }
  
  _getDateRange(timeframe, customStart, customEnd) {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    
    switch (timeframe) {
      case 'daily':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'weekly':
        start.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'quarterly':
        start.setMonth(now.getMonth() - 3);
        break;
      case 'yearly':
        start.setFullYear(now.getFullYear() - 1);
        break;
      case 'custom':
        start = customStart || new Date();
        end = customEnd || new Date();
        break;
      default:
        start.setMonth(now.getMonth() - 1);
    }
    
    return {
      start: Timestamp.fromDate(start),
      end: Timestamp.fromDate(end)
    };
  }
  
  _getTimeframeLabel(timeframe, startDate, endDate) {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    
    if (timeframe === 'custom' && startDate && endDate) {
      return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
    }
    
    const labels = {
      daily: 'Today',
      weekly: 'Last 7 Days',
      monthly: 'This Month',
      quarterly: 'Last Quarter',
      yearly: 'Last Year'
    };
    
    return labels[timeframe] || 'Current Period';
  }
  
  _groupUnitsByProperty(allUnits) {
    const grouped = {};
    
    allUnits.forEach(unit => {
      if (!grouped[unit.propertyId]) {
        grouped[unit.propertyId] = {
          propertyName: unit.propertyName,
          totalUnits: 0,
          occupiedUnits: 0,
          vacantUnits: 0,
          maintenanceUnits: 0,
          vacantNormal: 0,
          vacantUnderMaintenance: 0,
          leasedNormal: 0,
          leasedUnderMaintenance: 0
        };
      }
      
      grouped[unit.propertyId].totalUnits++;
      
      // Count based on occupancy status
      if (unit.occupancyStatus === 'leased') {
        grouped[unit.propertyId].occupiedUnits++;
        if (unit.isUnderMaintenance) {
          grouped[unit.propertyId].leasedUnderMaintenance++;
        } else {
          grouped[unit.propertyId].leasedNormal++;
        }
      } else {
        grouped[unit.propertyId].vacantUnits++;
        if (unit.isUnderMaintenance) {
          grouped[unit.propertyId].vacantUnderMaintenance++;
        } else {
          grouped[unit.propertyId].vacantNormal++;
        }
      }
      
      // Also count maintenance separately
      if (unit.isUnderMaintenance) {
        grouped[unit.propertyId].maintenanceUnits++;
      }
    });
    
    // Convert to array and calculate rates
    return Object.values(grouped).map(prop => ({
      ...prop,
      occupancyRate: prop.totalUnits > 0 ? prop.occupiedUnits / prop.totalUnits : 0,
      vacancyRate: prop.totalUnits > 0 ? prop.vacantUnits / prop.totalUnits : 0,
      maintenanceRate: prop.totalUnits > 0 ? prop.maintenanceUnits / prop.totalUnits : 0
    }));
  }
  
  _categorizeRisk(tenantAnalytics) {
    const categories = {
      low: { min: 0, max: 30, count: 0, tenants: [] },
      medium: { min: 31, max: 70, count: 0, tenants: [] },
      high: { min: 71, max: 100, count: 0, tenants: [] }
    };
    
    tenantAnalytics.forEach(tenant => {
      if (tenant.riskScore <= 30) {
        categories.low.count++;
        categories.low.tenants.push(tenant.tenantName);
      } else if (tenant.riskScore <= 70) {
        categories.medium.count++;
        categories.medium.tenants.push(tenant.tenantName);
      } else {
        categories.high.count++;
        categories.high.tenants.push(tenant.tenantName);
      }
    });
    
    return categories;
  }
  
  _aggregatePatterns(tenantAnalytics) {
    const patterns = {
      alwaysOnTime: 0,
      occasionallyLate: 0,
      frequentlyLate: 0,
      avgDaysLate: 0,
      totalTenants: tenantAnalytics.length
    };
    
    let totalLateDays = 0;
    let lateCount = 0;
    
    tenantAnalytics.forEach(tenant => {
      if (tenant.paymentPatterns.onTimeRate >= 0.9) {
        patterns.alwaysOnTime++;
      } else if (tenant.paymentPatterns.lateFrequency >= 0.3) {
        patterns.frequentlyLate++;
      } else {
        patterns.occasionallyLate++;
      }
      
      if (tenant.paymentPatterns.avgDaysLate > 0) {
        totalLateDays += tenant.paymentPatterns.avgDaysLate;
        lateCount++;
      }
    });
    
    patterns.avgDaysLate = lateCount > 0 ? (totalLateDays / lateCount).toFixed(1) : 0;
    
    return patterns;
  }
}

// Export a singleton instance
export const analyticsService = new AnalyticsService();