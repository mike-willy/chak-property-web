// src/services/analyticsService.js
import { db } from "../pages/firebase/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy,
  limit,
  Timestamp,
  addDoc,
  updateDoc,
  doc,
  getDoc
} from 'firebase/firestore';
import { 
  calculateCollectionRate,
  calculateVacancyRate,
  calculateTenantRiskScore,
  analyzePaymentPatterns,
  generateInsights 
} from './analyticsCalculations';

/**
 * Main Analytics Service - UPDATED WITH CSV/PDF REPORTS ONLY (NO JSON)
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

  // ============ CSV EXPORT METHODS (NO JSON) ============

  /**
   * Export Analytics Data to CSV
   */
  async exportAnalyticsToCSV(analyticsType, data, customFilename = null) {
    try {
      console.log(`Exporting ${analyticsType} data as CSV...`);
      
      let csvContent = '';
      let filename = '';
      
      switch (analyticsType) {
        case 'rent-collection':
          csvContent = this._generateRentCollectionCSV(data);
          filename = customFilename || `Rent_Collection_Report_${new Date().toISOString().split('T')[0]}.csv`;
          break;
        
        case 'tenant-behavior':
          csvContent = this._generateTenantBehaviorCSV(data);
          filename = customFilename || `Tenant_Behavior_Report_${new Date().toISOString().split('T')[0]}.csv`;
          break;
        
        case 'vacancy-rate':
          csvContent = this._generateVacancyRateCSV(data);
          filename = customFilename || `Vacancy_Rate_Report_${new Date().toISOString().split('T')[0]}.csv`;
          break;
        
        case 'analytics-insights':
          csvContent = this._generateInsightsCSV(data);
          filename = customFilename || `Analytics_Insights_Report_${new Date().toISOString().split('T')[0]}.csv`;
          break;
        
        default:
          throw new Error(`Unknown analytics type: ${analyticsType}`);
      }
      
      // Trigger immediate download
      this._triggerFileDownload(csvContent, filename, 'text/csv;charset=utf-8;');
      
      return { 
        success: true, 
        message: `Download started: ${filename}`,
        filename: filename 
      };
    } catch (error) {
      console.error('Error exporting analytics data:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive report (CSV ONLY - NO JSON)
   */
  async generateComprehensiveReport(reportType, timeframe = 'monthly') {
    try {
      let reportData = {};
      let filename = '';
      
      // Collect all analytics data for the report
      switch (reportType) {
        case 'full':
          const [rentData, vacancyData, tenantData, insights] = await Promise.all([
            this.getRentCollectionAnalytics(timeframe),
            this.getVacancyRateAnalytics(),
            this.getTenantBehaviorAnalytics(),
            this.generateAnalyticsInsights()
          ]);
          
          reportData = {
            rentCollection: rentData,
            vacancyRate: vacancyData,
            tenantBehavior: tenantData,
            insights: insights
          };
          filename = `Complete_Analytics_Report_${new Date().toISOString().split('T')[0]}.csv`;
          
          // Generate comprehensive CSV
          const csvContent = this._generateFullReportCSV(reportData);
          this._triggerFileDownload(csvContent, filename, 'text/csv;charset=utf-8;');
          break;
        
        case 'rent':
          reportData = await this.getRentCollectionAnalytics(timeframe);
          filename = `Rent_Collection_Report_${new Date().toISOString().split('T')[0]}.csv`;
          const rentCSV = this._generateRentCollectionCSV(reportData);
          this._triggerFileDownload(rentCSV, filename, 'text/csv;charset=utf-8;');
          break;
        
        case 'vacancy':
          reportData = await this.getVacancyRateAnalytics();
          filename = `Vacancy_Rate_Report_${new Date().toISOString().split('T')[0]}.csv`;
          const vacancyCSV = this._generateVacancyRateCSV(reportData);
          this._triggerFileDownload(vacancyCSV, filename, 'text/csv;charset=utf-8;');
          break;
        
        case 'tenants':
          reportData = await this.getTenantBehaviorAnalytics();
          filename = `Tenant_Behavior_Report_${new Date().toISOString().split('T')[0]}.csv`;
          const tenantCSV = this._generateTenantBehaviorCSV(reportData);
          this._triggerFileDownload(tenantCSV, filename, 'text/csv;charset=utf-8;');
          break;
        
        default:
          throw new Error(`Unknown report type: ${reportType}`);
      }
      
      return {
        success: true,
        message: `CSV Report downloaded: ${filename}`,
        filename: filename,
        format: 'csv'
      };
    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    }
  }

  /**
   * Generate PDF Report (Simple Text-Based PDF - For Future Implementation)
   */
  async generatePDFReport(reportType, timeframe = 'monthly') {
    try {
      // For now, generate a simple text-based PDF
      // In production, you would use jsPDF or similar library
      
      let reportData = {};
      let title = '';
      
      switch (reportType) {
        case 'rent-collection':
          reportData = await this.getRentCollectionAnalytics(timeframe);
          title = 'Rent Collection Report';
          break;
        
        case 'vacancy-rate':
          reportData = await this.getVacancyRateAnalytics();
          title = 'Vacancy Rate Report';
          break;
        
        case 'tenant-behavior':
          reportData = await this.getTenantBehaviorAnalytics();
          title = 'Tenant Behavior Report';
          break;
        
        case 'full':
          const [rentData, vacancyData, tenantData, insights] = await Promise.all([
            this.getRentCollectionAnalytics(timeframe),
            this.getVacancyRateAnalytics(),
            this.getTenantBehaviorAnalytics(),
            this.generateAnalyticsInsights()
          ]);
          
          reportData = {
            rentCollection: rentData,
            vacancyRate: vacancyData,
            tenantBehavior: tenantData,
            insights: insights
          };
          title = 'Complete Analytics Report';
          break;
        
        default:
          throw new Error(`Unknown report type: ${reportType}`);
      }
      
      // For now, generate a simple text file as placeholder for PDF
      // TODO: Integrate with jsPDF library for proper PDF generation
      const pdfContent = this._generateSimplePDFText(reportData, title);
      const filename = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
      
      this._triggerFileDownload(pdfContent, filename, 'text/plain');
      
      return {
        success: true,
        message: `PDF report placeholder downloaded. Install jsPDF for proper PDF generation.`,
        filename: filename,
        format: 'text' // Will be 'pdf' when jsPDF is implemented
      };
    } catch (error) {
      console.error('Error generating PDF report:', error);
      throw error;
    }
  }

  /**
   * Send payment reminder to a specific tenant
   */
  async sendPaymentReminder(tenantId, reminderType = 'standard') {
    try {
      // Get tenant details
      const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));
      if (!tenantDoc.exists()) {
        throw new Error(`Tenant not found: ${tenantId}`);
      }

      const tenant = tenantDoc.data();
      
      // Create reminder notification
      const reminderData = {
        tenantId,
        tenantName: tenant.fullName || tenant.email,
        reminderType,
        sentAt: new Date(),
        status: 'sent',
        message: this._generateReminderMessage(tenant, reminderType)
      };

      // Save reminder to database
      await addDoc(collection(db, 'reminders'), reminderData);
      
      // TODO: Integrate with SMS/Email service here
      console.log(`Reminder sent to ${tenant.fullName || tenant.email}`);
      
      return { 
        success: true, 
        message: `Reminder sent to ${tenant.fullName || tenant.email}`,
        reminderId: reminderData.id 
      };
    } catch (error) {
      console.error('Error sending payment reminder:', error);
      throw error;
    }
  }

  /**
   * Send bulk reminders to multiple tenants
   */
  async sendBulkReminders(tenantIds, reminderType = 'standard') {
    try {
      const results = [];
      
      for (const tenantId of tenantIds) {
        try {
          const result = await this.sendPaymentReminder(tenantId, reminderType);
          results.push({ tenantId, success: true, ...result });
        } catch (error) {
          results.push({ tenantId, success: false, error: error.message });
        }
      }
      
      return {
        success: results.some(r => r.success),
        total: tenantIds.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      };
    } catch (error) {
      console.error('Error sending bulk reminders:', error);
      throw error;
    }
  }

  /**
   * Flag tenant for review
   */
  async flagTenantForReview(tenantId, reason, priority = 'medium') {
    try {
      // Update tenant with flag
      await updateDoc(doc(db, 'tenants', tenantId), {
        flagged: true,
        flagReason: reason,
        flagPriority: priority,
        flaggedAt: new Date()
      });

      // Create flag record
      const flagData = {
        tenantId,
        reason,
        priority,
        flaggedAt: new Date(),
        resolved: false
      };

      await addDoc(collection(db, 'tenant_flags'), flagData);
      
      return { success: true, message: 'Tenant flagged for review' };
    } catch (error) {
      console.error('Error flagging tenant:', error);
      throw error;
    }
  }

  /**
   * Acknowledge insight (store in database for persistence)
   */
  async acknowledgeInsight(insightId, userId) {
    try {
      const acknowledgementData = {
        insightId,
        userId,
        acknowledgedAt: new Date(),
        acknowledged: true
      };

      await addDoc(collection(db, 'insight_acknowledgements'), acknowledgementData);
      
      return { success: true, message: 'Insight acknowledged' };
    } catch (error) {
      console.error('Error acknowledging insight:', error);
      throw error;
    }
  }

  /**
   * Get tenant details for view
   */
  async getTenantDetails(tenantId) {
    try {
      const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));
      if (!tenantDoc.exists()) {
        throw new Error('Tenant not found');
      }

      const tenantData = tenantDoc.data();
      const payments = await this._getTenantPayments(tenantId);
      const propertyDoc = tenantData.propertyId 
        ? await getDoc(doc(db, 'properties', tenantData.propertyId))
        : null;
      const unitDoc = tenantData.unitId 
        ? await getDoc(doc(db, `properties/${tenantData.propertyId}/units`, tenantData.unitId))
        : null;

      return {
        tenant: {
          id: tenantDoc.id,
          ...tenantData
        },
        property: propertyDoc?.exists() ? propertyDoc.data() : null,
        unit: unitDoc?.exists() ? unitDoc.data() : null,
        payments: payments,
        analytics: {
          riskScore: calculateTenantRiskScore(payments, []),
          paymentPatterns: analyzePaymentPatterns(payments),
          totalPaid: payments
            .filter(p => p.status === 'completed')
            .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
        }
      };
    } catch (error) {
      console.error('Error getting tenant details:', error);
      throw error;
    }
  }

  // ============ PRIVATE HELPER METHODS ============

  _generateRentCollectionCSV(data) {
    const headers = ['Date', 'Tenant Name', 'Amount (KES)', 'Status', 'Month', 'Payment Method', 'Transaction ID'];
    const rows = data.details.payments.map(payment => [
      payment.createdAt?.toDate?.().toLocaleDateString('en-KE') || 'N/A',
      `"${payment.tenantName || 'Unknown'}"`,
      Number(payment.amount).toLocaleString('en-KE'),
      payment.status,
      payment.month || 'N/A',
      payment.method || 'N/A',
      payment.id || 'N/A'
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  _generateTenantBehaviorCSV(data) {
    const headers = ['Tenant Name', 'Property', 'Unit', 'Risk Score', 'Risk Level', 'Monthly Rent (KES)', 'Balance (KES)', 'On-Time Rate %', 'Avg Days Late', 'Status', 'Last Payment'];
    const rows = data.details.tenants.map(tenant => {
      const riskLevel = tenant.riskScore <= 30 ? 'Low' : tenant.riskScore <= 70 ? 'Medium' : 'High';
      const lastPaymentDate = tenant.lastPayment 
        ? (tenant.lastPayment.toDate ? tenant.lastPayment.toDate().toLocaleDateString('en-KE') : tenant.lastPayment)
        : 'Never';
      
      return [
        `"${tenant.tenantName}"`,
        `"${tenant.propertyName || 'N/A'}"`,
        `"${tenant.unitNumber || tenant.unitId || 'N/A'}"`,
        tenant.riskScore,
        riskLevel,
        Number(tenant.monthlyRent).toLocaleString('en-KE'),
        Number(tenant.balance).toLocaleString('en-KE'),
        `${(tenant.paymentPatterns.onTimeRate * 100).toFixed(1)}`,
        tenant.paymentPatterns.avgDaysLate || '0',
        tenant.status,
        lastPaymentDate
      ];
    });
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  _generateVacancyRateCSV(data) {
    const headers = ['Property Name', 'Total Units', 'Occupied Units', 'Vacant Units', 'Vacancy Rate %', 'Under Maintenance', 'Occupancy Rate %', 'Avg Vacancy Days'];
    const rows = data.details.byProperty.map(property => [
      `"${property.propertyName}"`,
      property.totalUnits,
      property.occupiedUnits,
      property.vacantUnits,
      `${(property.vacancyRate * 100).toFixed(1)}`,
      property.maintenanceUnits,
      `${(property.occupancyRate * 100).toFixed(1)}`,
      Math.floor(Math.random() * 90) + 1 // Mock vacancy days
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  _generateInsightsCSV(data) {
    const headers = ['Type', 'Priority', 'Category', 'Title', 'Description', 'Recommendation', 'Generated Date'];
    const rows = data.map(insight => [
      insight.type,
      insight.priority,
      insight.category || 'general',
      `"${insight.title}"`,
      `"${insight.description}"`,
      `"${insight.recommendation}"`,
      new Date().toLocaleDateString('en-KE')
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  _generateFullReportCSV(reportData) {
    let csvContent = '';
    const date = new Date().toLocaleDateString('en-KE');
    
    // Report Header
    csvContent += `COMPLETE PROPERTY MANAGEMENT ANALYTICS REPORT\n`;
    csvContent += `Generated: ${date}\n`;
    csvContent += `===============================================\n\n`;
    
    // Rent Collection Summary
    const rent = reportData.rentCollection.summary;
    csvContent += `RENT COLLECTION SUMMARY\n`;
    csvContent += `Time Period,${reportData.rentCollection.timeframe}\n`;
    csvContent += `Total Units,${rent.totalUnits}\n`;
    csvContent += `Occupied Units,${rent.occupiedUnits}\n`;
    csvContent += `Expected Rent,KES ${rent.expectedRent.toLocaleString('en-KE')}\n`;
    csvContent += `Collected Rent,KES ${rent.collectedRent.toLocaleString('en-KE')}\n`;
    csvContent += `Collection Rate,${(rent.collectionRate * 100).toFixed(1)}%\n`;
    csvContent += `Outstanding Amount,KES ${rent.outstandingAmount.toLocaleString('en-KE')}\n`;
    csvContent += `Late Payments,${rent.latePaymentsCount}\n`;
    csvContent += `Completed Payments,${rent.completedPaymentsCount}\n\n`;
    
    // Vacancy Summary
    const vacancy = reportData.vacancyRate.summary;
    csvContent += `VACANCY SUMMARY\n`;
    csvContent += `Total Units,${vacancy.totalUnits}\n`;
    csvContent += `Occupied Units,${vacancy.occupiedUnits}\n`;
    csvContent += `Vacant Units,${vacancy.vacantUnits}\n`;
    csvContent += `Vacancy Rate,${(vacancy.vacancyRate * 100).toFixed(1)}%\n`;
    csvContent += `Occupancy Rate,${(vacancy.occupancyRate * 100).toFixed(1)}%\n`;
    csvContent += `Under Maintenance,${vacancy.maintenanceUnits}\n`;
    csvContent += `Average Vacancy Days,${vacancy.avgVacancyDays}\n\n`;
    
    // Tenant Behavior Summary
    const tenant = reportData.tenantBehavior.summary;
    csvContent += `TENANT BEHAVIOR SUMMARY\n`;
    csvContent += `Total Tenants,${tenant.totalTenants}\n`;
    csvContent += `Average Risk Score,${tenant.averageRiskScore.toFixed(1)}\n`;
    csvContent += `On-Time Payers,${tenant.onTimePayers}\n`;
    csvContent += `Frequent Late Payers,${tenant.frequentLatePayers}\n`;
    csvContent += `Total Monthly Rent,KES ${tenant.totalMonthlyRent.toLocaleString('en-KE')}\n`;
    csvContent += `Total Outstanding,KES ${tenant.totalOutstandingBalance.toLocaleString('en-KE')}\n\n`;
    
    // Key Insights
    csvContent += `KEY INSIGHTS & RECOMMENDATIONS\n`;
    reportData.insights.forEach((insight, index) => {
      csvContent += `Insight ${index + 1},${insight.priority.toUpperCase()},${insight.title},${insight.recommendation}\n`;
    });
    
    return csvContent;
  }

  _generateSimplePDFText(reportData, title) {
    // Simple text-based PDF placeholder
    // In production, replace with jsPDF implementation
    const date = new Date().toLocaleString('en-KE');
    
    let text = `===============================================\n`;
    text += `${title}\n`;
    text += `Generated: ${date}\n`;
    text += `===============================================\n\n`;
    
    if (title.includes('Rent')) {
      const summary = reportData.summary;
      text += `RENT COLLECTION SUMMARY\n`;
      text += `Time Period: ${reportData.timeframe}\n`;
      text += `Total Units: ${summary.totalUnits}\n`;
      text += `Occupied Units: ${summary.occupiedUnits}\n`;
      text += `Expected Rent: KES ${summary.expectedRent.toLocaleString('en-KE')}\n`;
      text += `Collected Rent: KES ${summary.collectedRent.toLocaleString('en-KE')}\n`;
      text += `Collection Rate: ${(summary.collectionRate * 100).toFixed(1)}%\n`;
      text += `Outstanding Amount: KES ${summary.outstandingAmount.toLocaleString('en-KE')}\n`;
      text += `Late Payments: ${summary.latePaymentsCount}\n`;
      text += `Completed Payments: ${summary.completedPaymentsCount}\n\n`;
      
      text += `NOTE: Install jsPDF library for proper PDF formatting with charts and tables.\n`;
    }
    
    return text;
  }

  _triggerFileDownload(content, filename, mimeType) {
    // Create blob with proper MIME type
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  }

  _generateReminderMessage(tenant, type) {
    const templates = {
      standard: `Hello ${tenant.fullName}, this is a reminder that your rent payment is due. Please make your payment of KSh ${tenant.monthlyRent?.toLocaleString() || '0'} for the current month.`,
      overdue: `Hello ${tenant.fullName}, your rent payment is overdue. Please make your payment of KSh ${tenant.balance?.toLocaleString() || tenant.monthlyRent?.toLocaleString() || '0'} as soon as possible.`,
      final: `Hello ${tenant.fullName}, this is a final reminder that your rent payment is overdue. Please contact us immediately to avoid further action.`
    };
    
    return templates[type] || templates.standard;
  }

  // ============ EXISTING PRIVATE HELPER METHODS ============
  
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