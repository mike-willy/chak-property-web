// src/services/analyticsService.js - FIXED VERSION
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

// Import jsPDF for PDF generation
import jsPDF from 'jspdf';
import 'jspdf-autotable';
// Import xlsx for professional Excel reports
import * as XLSX from 'xlsx';

/**
 * Main Analytics Service - FIXED WITH SINGLE PDF DOWNLOAD
 */
class AnalyticsService {
  constructor() {
    this.cache = {
      properties: null,
      units: null,
      tenants: null,
      payments: null,
      timestamp: null,
      CACHE_DURATION_MS: 5 * 60 * 1000 // 5 minutes
    };
  }

  /**
   * Clears the internal cache
   */
  clearCache() {
    this.cache = {
      properties: null,
      units: null,
      tenants: null,
      payments: null,
      timestamp: null,
      CACHE_DURATION_MS: 5 * 60 * 1000
    };
  }

  /**
   * Checks if cache is valid
   */
  _isCacheValid() {
    return this.cache.timestamp && (Date.now() - this.cache.timestamp < this.cache.CACHE_DURATION_MS);
  }

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
   * Get Vacancy Rate Analytics - FIXED WITH CONCURRENT FETCHING
   */
  async getVacancyRateAnalytics() {
    try {
      // 1. Get all properties
      const properties = await this._getAllProperties();

      // 2. Get units from each property subcollection CONCURRENTLY
      const allUnitsArrays = await Promise.all(
        properties.map(async (property) => {
          try {
            const unitsRef = collection(db, `properties/${property.id}/units`);
            const unitsSnapshot = await getDocs(unitsRef);

            const propertyUnits = [];
            unitsSnapshot.forEach((unitDoc) => {
              const unitData = unitDoc.data();

              // Check occupancy using YOUR dual status system
              const occupancyStatus = unitData.occupancyStatus ||
                (unitData.status && unitData.status.toLowerCase() === 'leased' ? 'leased' : 'vacant');
              const maintenanceStatus = unitData.maintenanceStatus || 'normal';

              const isOccupied = occupancyStatus === 'leased';
              const isUnderMaintenance = maintenanceStatus === 'under_maintenance';

              propertyUnits.push({
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
                isVacant: occupancyStatus === 'vacant',
                displayStatus: isUnderMaintenance
                  ? (isOccupied ? 'LEASED & UNDER MAINTENANCE' : 'VACANT & UNDER MAINTENANCE')
                  : occupancyStatus.toUpperCase()
              });
            });
            return propertyUnits;
          } catch (error) {
            console.log(`No units found for property ${property.name}:`, error.message);
            return [];
          }
        })
      );

      // Flatten the array of arrays
      const allUnits = allUnitsArrays.flat();

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
      // CLEAR CACHE before full generation to ensure fresh data
      this.clearCache();

      // The individual get* calls will now use the cache populated by the first call or themselves.
      // But because Promise.all initiates them concurrently, we should fetch base collections once first.
      await Promise.all([
        this._getAllProperties(),
        this._getAllTenants(),
      ]);

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

  // ============ CSV EXPORT METHODS ============

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
          filename = customFilename || `Jesma_Investments_Rent_Collection_${new Date().toISOString().split('T')[0]}.csv`;
          break;

        case 'tenant-behavior':
          csvContent = this._generateTenantBehaviorCSV(data);
          filename = customFilename || `Jesma_Investments_Tenant_Behavior_${new Date().toISOString().split('T')[0]}.csv`;
          break;

        case 'vacancy-rate':
          csvContent = this._generateVacancyRateCSV(data);
          filename = customFilename || `Jesma_Investments_Vacancy_Rate_${new Date().toISOString().split('T')[0]}.csv`;
          break;

        case 'analytics-insights':
          csvContent = this._generateInsightsCSV(data);
          filename = customFilename || `Jesma_Investments_Analytics_Insights_${new Date().toISOString().split('T')[0]}.csv`;
          break;

        default:
          throw new Error(`Unknown analytics type: ${analyticsType}`);
      }

      // Trigger immediate download
      this._triggerFileDownload(csvContent, filename, 'text/csv;charset=utf-8;');

      return {
        success: true,
        message: `CSV download started: ${filename}`,
        filename: filename,
        format: 'csv'
      };
    } catch (error) {
      console.error('Error exporting analytics data:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive report with format selection
   */
  async generateComprehensiveReport(reportType, timeframe = 'monthly', format = 'csv') {
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
            insights: insights,
            generatedAt: new Date(),
            timeframe: timeframe
          };

          if (format === 'csv') {
            filename = `Jesma_Investments_Full_Analytics_Report_${new Date().toISOString().split('T')[0]}.csv`;
            const csvContent = this._generateFullReportCSV(reportData);
            this._triggerFileDownload(csvContent, filename, 'text/csv;charset=utf-8;');
          } else if (format === 'xlsx') {
            filename = `Jesma_Investments_Full_Analytics_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
            this._generateFullReportXLSX(reportData, filename);
          } else if (format === 'pdf') {
            filename = `Jesma_Investments_Full_Analytics_Report_${new Date().toISOString().split('T')[0]}.pdf`;
            // FIXED: Use the corrected method that doesn't call save multiple times
            await this._generateFullReportPDF(reportData, filename);
          }
          break;

        case 'rent':
          reportData = await this.getRentCollectionAnalytics(timeframe);
          if (format === 'csv') {
            filename = `Jesma_Investments_Rent_Collection_${new Date().toISOString().split('T')[0]}.csv`;
            const rentCSV = this._generateRentCollectionCSV(reportData);
            this._triggerFileDownload(rentCSV, filename, 'text/csv;charset=utf-8;');
          } else if (format === 'xlsx') {
            filename = `Jesma_Investments_Rent_Collection_${new Date().toISOString().split('T')[0]}.xlsx`;
            this._generateRentCollectionXLSX(reportData, filename);
          } else if (format === 'pdf') {
            filename = `Jesma_Investments_Rent_Collection_${new Date().toISOString().split('T')[0]}.pdf`;
            await this._generateRentCollectionPDF(reportData, filename);
          }
          break;

        case 'vacancy':
          reportData = await this.getVacancyRateAnalytics();
          if (format === 'csv') {
            filename = `Jesma_Investments_Vacancy_Rate_${new Date().toISOString().split('T')[0]}.csv`;
            const vacancyCSV = this._generateVacancyRateCSV(reportData);
            this._triggerFileDownload(vacancyCSV, filename, 'text/csv;charset=utf-8;');
          } else if (format === 'xlsx') {
            filename = `Jesma_Investments_Vacancy_Rate_${new Date().toISOString().split('T')[0]}.xlsx`;
            this._generateVacancyRateXLSX(reportData, filename);
          } else if (format === 'pdf') {
            filename = `Jesma_Investments_Vacancy_Rate_${new Date().toISOString().split('T')[0]}.pdf`;
            await this._generateVacancyRatePDF(reportData, filename);
          }
          break;

        case 'tenants':
          reportData = await this.getTenantBehaviorAnalytics();
          if (format === 'csv') {
            filename = `Jesma_Investments_Tenant_Behavior_${new Date().toISOString().split('T')[0]}.csv`;
            const tenantCSV = this._generateTenantBehaviorCSV(reportData);
            this._triggerFileDownload(tenantCSV, filename, 'text/csv;charset=utf-8;');
          } else if (format === 'xlsx') {
            filename = `Jesma_Investments_Tenant_Behavior_${new Date().toISOString().split('T')[0]}.xlsx`;
            this._generateTenantBehaviorXLSX(reportData, filename);
          } else if (format === 'pdf') {
            filename = `Jesma_Investments_Tenant_Behavior_${new Date().toISOString().split('T')[0]}.pdf`;
            await this._generateTenantBehaviorPDF(reportData, filename);
          }
          break;

        case 'insights':
          reportData = await this.generateAnalyticsInsights();
          if (format === 'csv') {
            filename = `Jesma_Investments_Analytics_Insights_${new Date().toISOString().split('T')[0]}.csv`;
            const insightsCSV = this._generateInsightsCSV(reportData);
            this._triggerFileDownload(insightsCSV, filename, 'text/csv;charset=utf-8;');
          } else if (format === 'xlsx') {
            filename = `Jesma_Investments_Analytics_Insights_${new Date().toISOString().split('T')[0]}.xlsx`;
            this._generateInsightsXLSX(reportData, filename);
          } else if (format === 'pdf') {
            filename = `Jesma_Investments_Analytics_Insights_${new Date().toISOString().split('T')[0]}.pdf`;
            await this._generateInsightsPDF(reportData, filename);
          }
          break;

        default:
          throw new Error(`Unknown report type: ${reportType}`);
      }

      return {
        success: true,
        message: `${format.toUpperCase()} Report downloaded: ${filename}`,
        filename: filename,
        format: format
      };
    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    }
  }

  // ============ PDF EXPORT METHODS ============

  /**
   * Generate PDF Report with jsPDF
   */
  async generatePDFReport(reportType, timeframe = 'monthly', customFilename = null) {
    try {
      let reportData = {};
      let title = '';
      let filename = customFilename || '';

      switch (reportType) {
        case 'rent-collection':
          reportData = await this.getRentCollectionAnalytics(timeframe);
          title = 'Rent Collection Report';
          filename = filename || `Jesma_Investments_Rent_Collection_${new Date().toISOString().split('T')[0]}.pdf`;
          await this._generateRentCollectionPDF(reportData, filename);
          break;

        case 'vacancy-rate':
          reportData = await this.getVacancyRateAnalytics();
          title = 'Vacancy Rate Report';
          filename = filename || `Jesma_Investments_Vacancy_Rate_${new Date().toISOString().split('T')[0]}.pdf`;
          await this._generateVacancyRatePDF(reportData, filename);
          break;

        case 'tenant-behavior':
          reportData = await this.getTenantBehaviorAnalytics();
          title = 'Tenant Behavior Report';
          filename = filename || `Jesma_Investments_Tenant_Behavior_${new Date().toISOString().split('T')[0]}.pdf`;

          // SAFEGUARD: Large tenant list PDF generation
          if (reportData.summary.totalTenants > 200) {
            console.warn('Large dataset detected: Generating PDF for >200 tenants may take a few moments.');
            // This is a service class, so toast might not be directly available, but we log the warning.
            // A better place is in the component that calls it, but we can emit a small delay or break it up if needed in the future.
          }

          await this._generateTenantBehaviorPDF(reportData, filename);
          break;

        case 'analytics-insights':
          reportData = await this.generateAnalyticsInsights();
          title = 'Analytics Insights Report';
          filename = filename || `Jesma_Investments_Analytics_Insights_${new Date().toISOString().split('T')[0]}.pdf`;
          await this._generateInsightsPDF(reportData, filename);
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
            insights: insights,
            generatedAt: new Date(),
            timeframe: timeframe
          };
          // title = 'Complete Analytics Report';
          filename = filename || `Jesma_Investments_Full_Analytics_Report_${new Date().toISOString().split('T')[0]}.pdf`;

          // SAFEGUARD: Large total dataset
          if (tenantData.summary.totalTenants > 200 || rentData.summary.totalUnits > 400) {
            console.warn('Extremely large dataset detected. Browser thread may block during PDF generation.');
          }

          await this._generateFullReportPDF(reportData, filename);
          break;

        default:
          throw new Error(`Unknown report type: ${reportType}`);
      }

      return {
        success: true,
        message: `PDF Report downloaded: ${filename}`,
        filename: filename,
        format: 'pdf'
      };
    } catch (error) {
      console.error('Error generating PDF report:', error);
      throw error;
    }
  }

  /**
   * Export analytics data in specified format
   */
  async exportAnalytics(analyticsType, data, format = 'csv', customFilename = null) {
    try {
      if (format === 'csv') {
        return await this.exportAnalyticsToCSV(analyticsType, data, customFilename);
      } else if (format === 'pdf') {
        let reportType = analyticsType;
        // Convert analyticsType to reportType format
        if (analyticsType === 'rent-collection') reportType = 'rent-collection';
        else if (analyticsType === 'tenant-behavior') reportType = 'tenant-behavior';
        else if (analyticsType === 'vacancy-rate') reportType = 'vacancy-rate';
        else if (analyticsType === 'analytics-insights') reportType = 'analytics-insights';

        return await this.generatePDFReport(reportType, 'monthly', customFilename);
      } else {
        throw new Error(`Unsupported format: ${format}. Use 'csv' or 'pdf'`);
      }
    } catch (error) {
      console.error('Error exporting analytics:', error);
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

  // ============ PDF GENERATION METHODS ============

  _generateRentCollectionPDF(data, filename) {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('RENT COLLECTION REPORT', pageWidth / 2, yPosition, { align: 'center' });

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      yPosition += 10;
      doc.text(`Time Period: ${data.timeframe}`, pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 8;
      doc.text(`Generated: ${new Date().toLocaleDateString('en-KE')}`, pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 15;

      // Summary Section
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('SUMMARY', 20, yPosition);

      yPosition += 10;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');

      const summaryData = [
        ['Total Units', data.summary.totalUnits],
        ['Occupied Units', data.summary.occupiedUnits],
        ['Expected Rent', `KES ${this._formatNumber(data.summary.expectedRent)}`],
        ['Collected Rent', `KES ${this._formatNumber(data.summary.collectedRent)}`],
        ['Collection Rate', `${(data.summary.collectionRate * 100).toFixed(1)}%`],
        ['Outstanding Amount', `KES ${this._formatNumber(data.summary.outstandingAmount)}`],
        ['Late Payments', data.summary.latePaymentsCount],
        ['Completed Payments', data.summary.completedPaymentsCount]
      ];

      // Check if autoTable is available
      if (typeof doc.autoTable === 'function') {
        doc.autoTable({
          startY: yPosition,
          head: [['Metric', 'Value']],
          body: summaryData,
          theme: 'grid',
          headStyles: { fillColor: [26, 54, 93], textColor: 255, fontStyle: 'bold' },
          margin: { left: 20, right: 20 }
        });

        yPosition = doc.lastAutoTable.finalY + 15;
      } else {
        // Fallback: Simple table without autoTable
        summaryData.forEach((row, index) => {
          doc.text(`${row[0]}:`, 25, yPosition);
          doc.text(row[1], pageWidth - 30, yPosition, { align: 'right' });
          yPosition += 8;
        });
        yPosition += 10;
      }

      // Overdue Payments Section (if any)
      if (data.details.overduePayments.length > 0) {
        if (yPosition > pageHeight - 50) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('OVERDUE PAYMENTS', 20, yPosition);

        yPosition += 10;

        const overdueTableData = data.details.overduePayments.slice(0, 10).map(payment => [
          payment.tenantName || 'Unknown',
          payment.propertyName || 'N/A',
          payment.unitNumber || payment.unitId || 'N/A',
          `KES ${this._formatNumber(payment.amount)}`,
          payment.month || 'N/A',
          payment.status || 'pending'
        ]);

        if (typeof doc.autoTable === 'function') {
          doc.autoTable({
            startY: yPosition,
            head: [['Tenant', 'Property', 'Unit', 'Amount', 'Month', 'Status']],
            body: overdueTableData,
            theme: 'grid',
            headStyles: { fillColor: [26, 54, 93], textColor: 255, fontStyle: 'bold' },
            margin: { left: 20, right: 20 }
          });
        } else {
          // Fallback
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          overdueTableData.forEach((row, index) => {
            if (yPosition > pageHeight - 30) {
              doc.addPage();
              yPosition = 20;
            }
            doc.text(`${index + 1}. ${row[0]}`, 25, yPosition);
            yPosition += 6;
            doc.text(`   Amount: ${row[1]}`, 30, yPosition);
            yPosition += 6;
            doc.text(`   Status: ${row[3]}`, 30, yPosition);
            yPosition += 10;
          });
        }
      }

      // Footer
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(50, 50, 50); // Darker gray for visibility
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - 20, pageHeight - 15, { align: 'right' });
        doc.text('Jesma Investments', 20, pageHeight - 15);
      }

      doc.save(filename);
    } catch (error) {
      console.error('Error in _generateRentCollectionPDF:', error);
      throw error;
    }
  }

  _generateTenantBehaviorPDF(data, filename) {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('TENANT BEHAVIOR REPORT', pageWidth / 2, yPosition, { align: 'center' });

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      yPosition += 10;
      doc.text(`Generated: ${new Date().toLocaleDateString('en-KE')}`, pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 15;

      // Summary Section
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('SUMMARY', 20, yPosition);

      yPosition += 10;

      const summaryData = [
        ['Total Tenants', data.summary.totalTenants],
        ['Average Risk Score', data.summary.averageRiskScore.toFixed(1)],
        ['On-Time Payers', data.summary.onTimePayers],
        ['Frequent Late Payers', data.summary.frequentLatePayers],
        ['Total Monthly Rent', `KES ${this._formatNumber(data.summary.totalMonthlyRent)}`],
        ['Total Outstanding', `KES ${this._formatNumber(data.summary.totalOutstandingBalance)}`]
      ];

      if (typeof doc.autoTable === 'function') {
        doc.autoTable({
          startY: yPosition,
          head: [['Metric', 'Value']],
          body: summaryData,
          theme: 'grid',
          headStyles: { fillColor: [26, 54, 93], textColor: 255, fontStyle: 'bold' },
          margin: { left: 20, right: 20 }
        });

        yPosition = doc.lastAutoTable.finalY + 15;
      } else {
        summaryData.forEach((row, index) => {
          doc.text(`${row[0]}:`, 25, yPosition);
          doc.text(row[1], pageWidth - 30, yPosition, { align: 'right' });
          yPosition += 8;
        });
        yPosition += 10;
      }

      // High-Risk Tenants Section
      if (data.details.topTenants.length > 0) {
        if (yPosition > pageHeight - 50) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('HIGH-RISK TENANTS', 20, yPosition);

        yPosition += 10;

        const highRiskData = data.details.topTenants.slice(0, 5).map(tenant => [
          tenant.tenantName || 'Unknown',
          tenant.propertyName ? `${tenant.propertyName} / ${tenant.unitNumber || ''}` : 'N/A',
          tenant.status || 'Active',
          tenant.riskScore.toFixed(1),
          `KES ${this._formatNumber(tenant.balance)}`,
          tenant.overduePayments?.length || 0
        ]);

        if (typeof doc.autoTable === 'function') {
          doc.autoTable({
            startY: yPosition,
            head: [['Tenant Name', 'Property/Unit', 'Status', 'Risk Score', 'Balance', 'Overdue']],
            body: highRiskData,
            theme: 'grid',
            headStyles: { fillColor: [26, 54, 93], textColor: 255, fontStyle: 'bold' },
            margin: { left: 20, right: 20 }
          });
        } else {
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          highRiskData.forEach((row, index) => {
            if (yPosition > pageHeight - 30) {
              doc.addPage();
              yPosition = 20;
            }
            doc.text(`${index + 1}. ${row[0]}`, 25, yPosition);
            doc.text(`Risk: ${row[1]}`, 30, yPosition + 6);
            yPosition += 15;
          });
        }
      }

      // Footer
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(50, 50, 50); // Darker gray for visibility
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - 20, pageHeight - 15, { align: 'right' });
        doc.text('Jesma Investments', 20, pageHeight - 15);
      }

      doc.save(filename);
    } catch (error) {
      console.error('Error in _generateTenantBehaviorPDF:', error);
      throw error;
    }
  }

  _generateVacancyRatePDF(data, filename) {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('VACANCY RATE REPORT', pageWidth / 2, yPosition, { align: 'center' });

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      yPosition += 10;
      doc.text(`Generated: ${new Date().toLocaleDateString('en-KE')}`, pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 15;

      // Summary Section
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('SUMMARY', 20, yPosition);

      yPosition += 10;

      const summaryData = [
        ['Total Units', data.summary.totalUnits],
        ['Occupied Units', data.summary.occupiedUnits],
        ['Vacant Units', data.summary.vacantUnits],
        ['Under Maintenance', data.summary.maintenanceUnits],
        ['Vacancy Rate', `${(data.summary.vacancyRate * 100).toFixed(1)}%`],
        ['Occupancy Rate', `${(data.summary.occupancyRate * 100).toFixed(1)}%`],
        ['Avg Vacancy Days', data.summary.avgVacancyDays],
        ['Longest Vacancy', data.summary.longestVacancy]
      ];

      if (typeof doc.autoTable === 'function') {
        doc.autoTable({
          startY: yPosition,
          head: [['Metric', 'Value']],
          body: summaryData,
          theme: 'grid',
          headStyles: { fillColor: [26, 54, 93], textColor: 255, fontStyle: 'bold' },
          margin: { left: 20, right: 20 }
        });
      } else {
        summaryData.forEach((row, index) => {
          doc.text(`${row[0]}:`, 25, yPosition);
          doc.text(row[1], pageWidth - 30, yPosition, { align: 'right' });
          yPosition += 8;
        });
      }

      // Footer
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(50, 50, 50); // Darker gray for visibility
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - 20, pageHeight - 15, { align: 'right' });
        doc.text('Jesma Investments', 20, pageHeight - 15);
      }

      doc.save(filename);
    } catch (error) {
      console.error('Error in _generateVacancyRatePDF:', error);
      throw error;
    }
  }

  _generateInsightsPDF(data, filename) {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('ANALYTICS INSIGHTS REPORT', pageWidth / 2, yPosition, { align: 'center' });

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      yPosition += 10;
      doc.text(`Generated: ${new Date().toLocaleDateString('en-KE')}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;
      doc.text(`Total Insights: ${data.length}`, pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 15;

      if (data.length === 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'italic');
        doc.text('No insights generated. All systems are performing optimally.', pageWidth / 2, yPosition, { align: 'center' });
      } else {
        // Show all insights
        data.forEach((insight, index) => {
          if (yPosition > pageHeight - 50) {
            doc.addPage();
            yPosition = 20;
          }

          // Set color based on priority
          const colors = {
            high: [231, 76, 60],
            medium: [243, 156, 18],
            low: [46, 204, 113]
          };

          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...colors[insight.priority] || [0, 0, 0]);
          doc.text(`${index + 1}. ${insight.title}`, 20, yPosition);
          doc.setTextColor(0, 0, 0);

          yPosition += 7;
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          const descriptionLines = doc.splitTextToSize(insight.description, pageWidth - 40);
          doc.text(descriptionLines, 25, yPosition);
          yPosition += (descriptionLines.length * 5) + 5;

          doc.setFont('helvetica', 'italic');
          doc.text(`Recommendation: ${insight.recommendation}`, 25, yPosition);
          yPosition += 10;
        });
      }

      // Footer
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(50, 50, 50); // Darker gray for visibility
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - 20, pageHeight - 15, { align: 'right' });
        doc.text('Jesma Investments', 20, pageHeight - 15);
      }

      doc.save(filename);
    } catch (error) {
      console.error('Error in _generateInsightsPDF:', error);
      throw error;
    }
  }

  // FIXED: Full report now uses same structure and styling as individual reports
  _generateFullReportPDF(reportData, filename) {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Title Page (same as before but better styling)
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 54, 93); // Blue color
      doc.text('COMPLETE ANALYTICS REPORT', pageWidth / 2, 80, { align: 'center' });

      doc.setFontSize(16);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Jesma Investments', pageWidth / 2, 100, { align: 'center' });

      doc.setFontSize(14);
      doc.setTextColor(150, 150, 150);
      doc.text(`Time Period: ${reportData.timeframe}`, pageWidth / 2, 120, { align: 'center' });
      doc.text(`Generated: ${new Date().toLocaleDateString('en-KE')}`, pageWidth / 2, 130, { align: 'center' });

      // Add decorative line
      doc.setDrawColor(26, 54, 93);
      doc.setLineWidth(1);
      doc.line(50, 145, pageWidth - 50, 145);

      // Generate Report Content
      // Table of Contents Page
      doc.addPage();
      this._addTableOfContents(doc, reportData);

      // Rent Collection Section
      doc.addPage();
      this._addRentCollectionSectionWithTables(doc, reportData.rentCollection);

      // Vacancy Rate Section
      doc.addPage();
      this._addVacancyRateSectionWithTables(doc, reportData.vacancyRate);

      // Tenant Behavior Section
      doc.addPage();
      this._addTenantBehaviorSectionWithTables(doc, reportData.tenantBehavior);

      // Insights Section
      doc.addPage();
      this._addInsightsSectionWithStyling(doc, reportData.insights);

      // Update all page numbers (consistent footer)
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(50, 50, 50); // Darker gray for visibility
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - 20, pageHeight - 15, { align: 'right' });
        doc.text('Jesma Investments', 20, pageHeight - 15);
      }

      // Save only once
      doc.save(filename);
    } catch (error) {
      console.error('Error in _generateFullReportPDF:', error);
      throw error;
    }
  }

  // Table of Contents
  _addTableOfContents(doc, reportData) {
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 40;

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 54, 93);
    doc.text('TABLE OF CONTENTS', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 30; // Increased spacing after title
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);

    const sections = [
      '1. Rent Collection Analysis',
      '2. Vacancy Rate Analysis',
      '3. Tenant Behavior Analysis',
      '4. Insights & Recommendations'
    ];

    sections.forEach((section, index) => {
      const pageNum = `Page ${index + 3}`;

      // Draw section title
      doc.text(section, 40, yPosition);

      // Draw page number right-aligned
      doc.text(pageNum, pageWidth - 40, yPosition, { align: 'right' });

      // Draw dot leaders dynamically
      const sectionWidth = doc.getTextWidth(section);
      const pageNumWidth = doc.getTextWidth(pageNum);
      const startX = 40 + sectionWidth + 5;
      const endX = pageWidth - 40 - pageNumWidth - 5;

      if (startX < endX) {
        const dots = ".".repeat(Math.floor((endX - startX) / 1.5));
        doc.text(dots, startX, yPosition);
      }

      yPosition += 20; // Consistent vertical spacing
    });
  }

  // Rent Collection with tables and styling (matches individual report)
  _addRentCollectionSectionWithTables(doc, data) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 30;

    // Section Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 54, 93);
    doc.text('1. RENT COLLECTION ANALYSIS', pageWidth / 2, yPosition, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    yPosition += 10;
    doc.text(`Time Period: ${data.timeframe}`, pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 15;

    // Summary Section with table
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('SUMMARY', 20, yPosition);

    yPosition += 10;

    const summaryData = [
      ['Total Units', data.summary.totalUnits],
      ['Occupied Units', data.summary.occupiedUnits],
      ['Expected Rent', `KES ${this._formatNumber(data.summary.expectedRent)}`],
      ['Collected Rent', `KES ${this._formatNumber(data.summary.collectedRent)}`],
      ['Collection Rate', `${(data.summary.collectionRate * 100).toFixed(1)}%`],
      ['Outstanding Amount', `KES ${this._formatNumber(data.summary.outstandingAmount)}`],
      ['Late Payments', data.summary.latePaymentsCount],
      ['Completed Payments', data.summary.completedPaymentsCount]
    ];

    if (typeof doc.autoTable === 'function') {
      doc.autoTable({
        startY: yPosition,
        head: [['Metric', 'Value']],
        body: summaryData,
        theme: 'grid',
        headStyles: {
          fillColor: [26, 54, 93],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 11
        },
        bodyStyles: { fontSize: 10 },
        margin: { left: 20, right: 20 }
      });

      yPosition = doc.lastAutoTable.finalY + 15;
    } else {
      // Fallback
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      summaryData.forEach((row) => {
        doc.text(`${row[0]}:`, 25, yPosition);
        doc.text(row[1], pageWidth - 30, yPosition, { align: 'right' });
        yPosition += 8;
      });
      yPosition += 10;
    }

    // Overdue Payments Section (if any)
    if (data.details.overduePayments.length > 0 && yPosition < pageHeight - 100) {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('OVERDUE PAYMENTS', 20, yPosition);

      yPosition += 10;

      const overdueTableData = data.details.overduePayments.slice(0, 8).map(payment => [
        payment.tenantName || 'Unknown',
        payment.propertyName || 'N/A',
        payment.unitNumber || payment.unitId || 'N/A',
        `KES ${this._formatNumber(payment.amount)}`,
        payment.month || 'N/A',
        payment.status || 'pending'
      ]);

      if (typeof doc.autoTable === 'function') {
        doc.autoTable({
          startY: yPosition,
          head: [['Tenant', 'Property', 'Unit', 'Amount', 'Month', 'Status']],
          body: overdueTableData,
          theme: 'grid',
          headStyles: {
            fillColor: [26, 54, 93],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 11
          },
          bodyStyles: { fontSize: 9 },
          margin: { left: 20, right: 20 }
        });
      }
    }
  }

  // Vacancy Rate with tables and styling
  _addVacancyRateSectionWithTables(doc, data) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 30;

    // Section Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 54, 93); // Green color
    doc.text('2. VACANCY RATE ANALYSIS', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 15;

    // Summary Section with table
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('SUMMARY', 20, yPosition);

    yPosition += 10;

    const summaryData = [
      ['Total Units', data.summary.totalUnits],
      ['Occupied Units', data.summary.occupiedUnits],
      ['Vacant Units', data.summary.vacantUnits],
      ['Under Maintenance', data.summary.maintenanceUnits],
      ['Vacancy Rate', `${(data.summary.vacancyRate * 100).toFixed(1)}%`],
      ['Occupancy Rate', `${(data.summary.occupancyRate * 100).toFixed(1)}%`],
      ['Avg Vacancy Days', data.summary.avgVacancyDays],
      ['Longest Vacancy', data.summary.longestVacancy]
    ];

    if (typeof doc.autoTable === 'function') {
      doc.autoTable({
        startY: yPosition,
        head: [['Metric', 'Value']],
        body: summaryData,
        theme: 'grid',
        headStyles: {
          fillColor: [26, 54, 93],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 11
        },
        bodyStyles: { fontSize: 10 },
        margin: { left: 20, right: 20 }
      });

      yPosition = doc.lastAutoTable.finalY + 15;
    }

    // Property Breakdown (if space)
    if (data.details.byProperty.length > 0 && yPosition < pageHeight - 100) {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('PROPERTY BREAKDOWN', 20, yPosition);

      yPosition += 10;

      const propertyData = data.details.byProperty.slice(0, 5).map(property => [
        property.propertyName,
        property.totalUnits,
        property.occupiedUnits,
        property.vacantUnits,
        property.maintenanceUnits || 0,
        `${(property.vacancyRate * 100).toFixed(1)}%`,
        `${(property.occupancyRate * 100).toFixed(1)}%`
      ]);

      if (typeof doc.autoTable === 'function') {
        doc.autoTable({
          startY: yPosition,
          head: [['Property', 'Total', 'Occupied', 'Vacant', 'Maintenance', 'Vacancy %', 'Occupancy %']],
          body: propertyData,
          theme: 'grid',
          headStyles: {
            fillColor: [26, 54, 93],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 10
          },
          bodyStyles: { fontSize: 9 },
          margin: { left: 20, right: 20 }
        });
      }
    }
  }

  // Tenant Behavior with tables and styling
  _addTenantBehaviorSectionWithTables(doc, data) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 30;

    // Section Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 54, 93); // Purple color
    doc.text('3. TENANT BEHAVIOR ANALYSIS', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 15;

    // Summary Section with table
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('SUMMARY', 20, yPosition);

    yPosition += 10;

    const summaryData = [
      ['Total Tenants', data.summary.totalTenants],
      ['Average Risk Score', data.summary.averageRiskScore.toFixed(1)],
      ['On-Time Payers', data.summary.onTimePayers],
      ['Frequent Late Payers', data.summary.frequentLatePayers],
      ['Total Monthly Rent', `KES ${this._formatNumber(data.summary.totalMonthlyRent)}`],
      ['Total Outstanding', `KES ${this._formatNumber(data.summary.totalOutstandingBalance)}`]
    ];

    if (typeof doc.autoTable === 'function') {
      doc.autoTable({
        startY: yPosition,
        head: [['Metric', 'Value']],
        body: summaryData,
        theme: 'grid',
        headStyles: {
          fillColor: [26, 54, 93],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 11
        },
        bodyStyles: { fontSize: 10 },
        margin: { left: 20, right: 20 }
      });

      yPosition = doc.lastAutoTable.finalY + 15;
    }

    // Top High-Risk Tenants (if space)
    if (data.details.topTenants.length > 0 && yPosition < pageHeight - 100) {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(231, 76, 60); // Red for high risk
      doc.text('TOP HIGH-RISK TENANTS', 20, yPosition);
      doc.setTextColor(0, 0, 0);

      yPosition += 10;

      const highRiskData = data.details.topTenants.slice(0, 5).map(tenant => [
        tenant.tenantName || 'Unknown',
        tenant.propertyName ? `${tenant.propertyName} / ${tenant.unitNumber || ''}` : 'N/A',
        tenant.status || 'Active',
        tenant.riskScore.toFixed(1),
        `KES ${this._formatNumber(tenant.balance)}`,
        tenant.overduePayments?.length || 0
      ]);

      if (typeof doc.autoTable === 'function') {
        doc.autoTable({
          startY: yPosition,
          head: [['Tenant Name', 'Property/Unit', 'Status', 'Risk Score', 'Balance', 'Overdue']],
          body: highRiskData,
          theme: 'grid',
          headStyles: {
            fillColor: [26, 54, 93],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 10
          },
          bodyStyles: { fontSize: 9 },
          margin: { left: 20, right: 20 }
        });
      }
    }
  }

  // Insights with styling
  _addInsightsSectionWithStyling(doc, insights) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 30;

    // Section Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 54, 93); // Orange color
    doc.text('4. INSIGHTS & RECOMMENDATIONS', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 15;

    if (insights.length === 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text('No insights generated. All systems are performing optimally.', pageWidth / 2, yPosition, { align: 'center' });
    } else {
      // Group by priority for better organization
      const highPriority = insights.filter(i => i.priority === 'high');
      const mediumPriority = insights.filter(i => i.priority === 'medium');
      const lowPriority = insights.filter(i => i.priority === 'low');

      // High Priority Insights
      if (highPriority.length > 0) {
        if (yPosition > pageHeight - 80) {
          doc.addPage();
          yPosition = 30;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(231, 76, 60); // Red
        doc.text(`HIGH PRIORITY (${highPriority.length})`, 20, yPosition);

        yPosition += 10;

        highPriority.forEach((insight, index) => {
          if (yPosition > pageHeight - 60) {
            doc.addPage();
            yPosition = 30;
          }

          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(231, 76, 60);
          doc.text(`${index + 1}. ${insight.title}`, 20, yPosition);

          yPosition += 7;
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          const descriptionLines = doc.splitTextToSize(insight.description, pageWidth - 40);
          doc.text(descriptionLines, 25, yPosition);
          yPosition += (descriptionLines.length * 5) + 5;

          doc.setFont('helvetica', 'italic');
          doc.text(`Recommendation: ${insight.recommendation}`, 25, yPosition);
          yPosition += 10;
        });

        yPosition += 5;
      }

      // Medium Priority Insights
      if (mediumPriority.length > 0) {
        if (yPosition > pageHeight - 80) {
          doc.addPage();
          yPosition = 30;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(26, 54, 93); // Orange
        doc.text(`MEDIUM PRIORITY (${mediumPriority.length})`, 20, yPosition);

        yPosition += 10;

        mediumPriority.forEach((insight, index) => {
          if (yPosition > pageHeight - 60) {
            doc.addPage();
            yPosition = 30;
          }

          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(26, 54, 93);
          doc.text(`${index + 1}. ${insight.title}`, 20, yPosition);

          yPosition += 7;
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          const descriptionLines = doc.splitTextToSize(insight.description, pageWidth - 40);
          doc.text(descriptionLines, 25, yPosition);
          yPosition += (descriptionLines.length * 5) + 5;

          doc.setFont('helvetica', 'italic');
          doc.text(`Recommendation: ${insight.recommendation}`, 25, yPosition);
          yPosition += 10;
        });

        yPosition += 5;
      }

      // Low Priority Insights
      if (lowPriority.length > 0) {
        if (yPosition > pageHeight - 80) {
          doc.addPage();
          yPosition = 30;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(46, 204, 113); // Green
        doc.text(`LOW PRIORITY (${lowPriority.length})`, 20, yPosition);

        yPosition += 10;

        lowPriority.forEach((insight, index) => {
          if (yPosition > pageHeight - 60) {
            doc.addPage();
            yPosition = 30;
          }

          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(46, 204, 113);
          doc.text(`${index + 1}. ${insight.title}`, 20, yPosition);

          yPosition += 7;
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          const descriptionLines = doc.splitTextToSize(insight.description, pageWidth - 40);
          doc.text(descriptionLines, 25, yPosition);
          yPosition += (descriptionLines.length * 5) + 5;

          doc.setFont('helvetica', 'italic');
          doc.text(`Recommendation: ${insight.recommendation}`, 25, yPosition);
          yPosition += 10;
        });
      }
    }
  }

  // ============ CSV GENERATION METHODS (UNCHANGED) ============

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

  // ============ PROFESSIONAL XLSX GENERATION METHODS ============

  _generateRentCollectionXLSX(data, filename) {
    const ws_data = [
      ["JESMA INVESTMENTS - RENT COLLECTION REPORT"],
      [`Generated: ${new Date().toLocaleDateString('en-KE')}`],
      [],
      ["Date", "Tenant Name", "Property", "Unit", "Amount (KES)", "Month", "Status", "Method", "Transaction ID"]
    ];

    data.details.payments.forEach(payment => {
      ws_data.push([
        payment.createdAt?.toDate?.().toLocaleDateString('en-KE') || 'N/A',
        payment.tenantName || 'Unknown',
        payment.propertyName || 'N/A',
        payment.unitNumber || payment.unitId || 'N/A',
        payment.amount,
        payment.month || 'N/A',
        payment.status,
        payment.method || 'N/A',
        payment.id || 'N/A'
      ]);
    });

    this._exportToXLSX(ws_data, filename, "Rent Collection");
  }

  _generateTenantBehaviorXLSX(data, filename) {
    const ws_data = [
      ["JESMA INVESTMENTS - TENANT BEHAVIOR REPORT"],
      [`Generated: ${new Date().toLocaleDateString('en-KE')}`],
      [],
      ["Tenant Name", "Property", "Unit", "Risk Score", "Status", "Monthly Rent", "Balance", "On-Time Rate %", "Avg Days Late", "Last Payment"]
    ];

    data.details.tenants.forEach(tenant => {
      const lastPaymentDate = tenant.lastPayment
        ? (tenant.lastPayment.toDate ? tenant.lastPayment.toDate().toLocaleDateString('en-KE') : tenant.lastPayment)
        : 'Never';

      ws_data.push([
        tenant.tenantName,
        tenant.propertyName || 'N/A',
        tenant.unitNumber || tenant.unitId || 'N/A',
        tenant.riskScore,
        tenant.status,
        tenant.monthlyRent,
        tenant.balance,
        (tenant.paymentPatterns.onTimeRate * 100).toFixed(1),
        tenant.paymentPatterns.avgDaysLate || 0,
        lastPaymentDate
      ]);
    });

    this._exportToXLSX(ws_data, filename, "Tenant Behavior");
  }

  _generateVacancyRateXLSX(data, filename) {
    const ws_data = [
      ["JESMA INVESTMENTS - VACANCY RATE REPORT"],
      [`Generated: ${new Date().toLocaleDateString('en-KE')}`],
      [],
      ["Property Name", "Total Units", "Occupied Units", "Vacant Units", "Vacancy Rate %", "Under Maintenance", "Occupancy Rate %", "Avg Vacancy Days"]
    ];

    data.details.byProperty.forEach(property => {
      ws_data.push([
        property.propertyName,
        property.totalUnits,
        property.occupiedUnits,
        property.vacantUnits,
        (property.vacancyRate * 100).toFixed(1),
        property.maintenanceUnits,
        (property.occupancyRate * 100).toFixed(1),
        property.avgVacancyDays || 0
      ]);
    });

    this._exportToXLSX(ws_data, filename, "Vacancy Rates");
  }

  _generateInsightsXLSX(data, filename) {
    const ws_data = [
      ["JESMA INVESTMENTS - ANALYTICS INSIGHTS REPORT"],
      [`Generated: ${new Date().toLocaleDateString('en-KE')}`],
      [],
      ["Priority", "Title", "Category", "Description", "Recommendation"]
    ];

    data.forEach(insight => {
      ws_data.push([
        insight.priority.toUpperCase(),
        insight.title,
        insight.category || 'general',
        insight.description,
        insight.recommendation
      ]);
    });

    this._exportToXLSX(ws_data, filename, "Insights");
  }

  _generateFullReportXLSX(reportData, filename) {
    const wb = XLSX.utils.book_new();

    // 1. Overview Sheet
    const overview_data = [
      ["JESMA INVESTMENTS - COMPLETE ANALYTICS REPORT"],
      [`Generated: ${new Date().toLocaleDateString('en-KE')}`],
      [`Timeframe: ${reportData.timeframe}`],
      [],
      ["SECTION", "METRIC", "VALUE"],
      ["Rent Collection", "Collection Rate", `${(reportData.rentCollection.summary.collectionRate * 100).toFixed(1)}%`],
      ["Rent Collection", "Expected Rent", reportData.rentCollection.summary.expectedRent],
      ["Rent Collection", "Collected Rent", reportData.rentCollection.summary.collectedRent],
      ["Vacancy", "Vacancy Rate", `${(reportData.vacancyRate.summary.vacancyRate * 100).toFixed(1)}%`],
      ["Vacancy", "Occupied Units", reportData.vacancyRate.summary.occupiedUnits],
      ["Vacancy", "Vacant Units", reportData.vacancyRate.summary.vacantUnits],
      ["Tenants", "Average Risk Score", reportData.tenantBehavior.summary.averageRiskScore.toFixed(1)],
      ["Tenants", "Total Outstanding", reportData.tenantBehavior.summary.totalOutstandingBalance]
    ];
    const ws_overview = XLSX.utils.aoa_to_sheet(overview_data);
    this._styleXLSXSheet(ws_overview, overview_data);
    XLSX.utils.book_append_sheet(wb, ws_overview, "Overview Summary");

    // 2. Rent Collection Sheet
    const rent_data = [
      ["RENT COLLECTION DETAILS"],
      [],
      ["Date", "Tenant Name", "Property", "Unit", "Amount (KES)", "Month", "Status"]
    ];
    reportData.rentCollection.details.payments.forEach(p => {
      rent_data.push([
        p.createdAt?.toDate?.().toLocaleDateString('en-KE') || 'N/A',
        p.tenantName, p.propertyName, p.unitNumber, p.amount, p.month, p.status
      ]);
    });
    const ws_rent = XLSX.utils.aoa_to_sheet(rent_data);
    this._styleXLSXSheet(ws_rent, rent_data);
    XLSX.utils.book_append_sheet(wb, ws_rent, "Rent Details");

    // 3. Vacancy Sheet
    const vacancy_data = [
      ["VACANCY BY PROPERTY"],
      [],
      ["Property", "Total", "Occupied", "Vacant", "Vacancy %", "Maintenance"]
    ];
    reportData.vacancyRate.details.byProperty.forEach(p => {
      vacancy_data.push([
        p.propertyName, p.totalUnits, p.occupiedUnits, p.vacantUnits,
        `${(p.vacancyRate * 100).toFixed(1)}%`, p.maintenanceUnits
      ]);
    });
    const ws_vacancy = XLSX.utils.aoa_to_sheet(vacancy_data);
    this._styleXLSXSheet(ws_vacancy, vacancy_data);
    XLSX.utils.book_append_sheet(wb, ws_vacancy, "Vacancy Details");

    // 4. Insights Sheet
    const insights_data = [
      ["KEY INSIGHTS & RECOMMENDATIONS"],
      [],
      ["Priority", "Title", "Description", "Recommendation"]
    ];
    reportData.insights.forEach(i => {
      insights_data.push([i.priority.toUpperCase(), i.title, i.description, i.recommendation]);
    });
    const ws_insights = XLSX.utils.aoa_to_sheet(insights_data);
    this._styleXLSXSheet(ws_insights, insights_data);
    XLSX.utils.book_append_sheet(wb, ws_insights, "Insights");

    // Save Workbook
    XLSX.writeFile(wb, filename);
  }

  // XLSX Helper: Style and export
  _exportToXLSX(aoaData, filename, sheetName) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoaData);

    // Apply auto-column widths
    this._styleXLSXSheet(ws, aoaData);

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
  }

  // XLSX Helper: Auto-size columns
  _styleXLSXSheet(ws, aoaData) {
    if (!aoaData || aoaData.length === 0) return;

    // Calculate max width for each column
    const colWidths = aoaData[0].map((_, colIndex) => {
      const maxWidth = aoaData.reduce((max, row) => {
        const cellValue = row[colIndex] ? String(row[colIndex]) : "";
        return Math.max(max, cellValue.length);
      }, 10);
      return { wch: maxWidth + 5 }; // Add padding
    });

    ws['!cols'] = colWidths;
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

  _formatNumber(num) {
    return num ? num.toLocaleString('en-KE') : '0';
  }

  // ============ EXISTING PRIVATE HELPER METHODS ============

  async _getAllProperties() {
    try {
      if (this._isCacheValid() && this.cache.properties) {
        return this.cache.properties;
      }

      const querySnapshot = await getDocs(collection(db, "properties"));
      const properties = [];

      querySnapshot.forEach((doc) => {
        properties.push({
          id: doc.id,
          ...doc.data()
        });
      });

      this.cache.properties = properties;
      this.cache.timestamp = Date.now();
      return properties;
    } catch (error) {
      console.error('Error fetching properties:', error);
      return [];
    }
  }

  async _getOccupiedUnits() {
    try {
      if (this._isCacheValid() && this.cache.units) {
        return this.cache.units;
      }

      const occupiedUnits = [];

      // We can leverage the tenant cache here if it exists!
      let tenantsSnapshot;
      if (this._isCacheValid() && this.cache.tenants) {
        // Use cached tenants
        tenantsSnapshot = this.cache.tenants;
      } else {
        // Get all ACTIVE tenants from tenants collection
        const tenantsQuery = query(
          collection(db, "tenants"),
          where("status", "==", "active")
        );
        const result = await getDocs(tenantsQuery);
        tenantsSnapshot = [];
        result.forEach(doc => tenantsSnapshot.push({ id: doc.id, ...doc.data() }));
        // Also update tenant cache since we fetched it
        this.cache.tenants = tenantsSnapshot;
        this.cache.timestamp = Date.now();
      }

      tenantsSnapshot.forEach((tenantData) => {
        // Only include tenants with property and unit IDs
        if (tenantData.propertyId && tenantData.unitId) {
          occupiedUnits.push({
            id: tenantData.id,
            tenantId: tenantData.id,
            tenantName: tenantData.fullName || tenantData.tenantName,
            propertyId: tenantData.propertyId,
            unitId: tenantData.unitId,
            unitNumber: tenantData.unitNumber || tenantData.unitName || tenantData.unitId,
            monthlyRent: tenantData.monthlyRent || 0,
            leaseStart: tenantData.leaseStart,
            leaseEnd: tenantData.leaseEnd,
            balance: tenantData.balance || 0
          });
        }
      });

      console.log(`Found ${occupiedUnits.length} occupied units from tenants collection`);
      this.cache.units = occupiedUnits;
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

      // We need property and unit names, let's fetch caches to map them
      const properties = await this._getAllProperties();
      const propertiesMap = properties.reduce((map, p) => {
        map[p.id] = p.name || p.propertyName;
        return map;
      }, {});

      // For units, we can use the tenants or units cache to map tenantId -> propertyId/unitId
      const units = await this._getOccupiedUnits();
      const unitsMap = units.reduce((map, u) => {
        map[u.tenantId || u.id] = { propertyId: u.propertyId, unitId: u.unitId, unitNumber: u.unitNumber };
        return map;
      }, {});

      querySnapshot.forEach((doc) => {
        const paymentData = doc.data();
        let propId = paymentData.propertyId;
        let pUnitId = paymentData.unitNumber || paymentData.unitName || paymentData.unitId;

        // If missing from payment doc, try to find from occupied units mapping
        if ((!propId || !pUnitId) && paymentData.tenantId && unitsMap[paymentData.tenantId]) {
          propId = propId || unitsMap[paymentData.tenantId].propertyId;
          pUnitId = pUnitId || unitsMap[paymentData.tenantId].unitNumber || unitsMap[paymentData.tenantId].unitId;
        }

        payments.push({
          id: doc.id,
          ...paymentData,
          propertyName: paymentData.propertyName || propertiesMap[propId] || 'N/A',
          unitId: pUnitId,
          unitNumber: pUnitId,
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
      if (this._isCacheValid() && this.cache.tenants) {
        return this.cache.tenants;
      }

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

      this.cache.tenants = tenants;
      this.cache.timestamp = Date.now();
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

      // We need property and unit names, let's fetch caches to map them
      const properties = await this._getAllProperties();
      const propertiesMap = properties.reduce((map, p) => {
        map[p.id] = p.name || p.propertyName;
        return map;
      }, {});

      // For units, we can use the tenants or units cache to map tenantId -> propertyId/unitId
      const units = await this._getOccupiedUnits();
      const unitsMap = units.reduce((map, u) => {
        map[u.tenantId || u.id] = { propertyId: u.propertyId, unitId: u.unitId, unitNumber: u.unitNumber };
        return map;
      }, {});

      querySnapshot.forEach((doc) => {
        const paymentData = doc.data();
        let propId = paymentData.propertyId;
        let pUnitId = paymentData.unitNumber || paymentData.unitName || paymentData.unitId;

        // If missing from payment doc, try to find from occupied units mapping
        if ((!propId || !pUnitId) && paymentData.tenantId && unitsMap[paymentData.tenantId]) {
          propId = propId || unitsMap[paymentData.tenantId].propertyId;
          pUnitId = pUnitId || unitsMap[paymentData.tenantId].unitNumber || unitsMap[paymentData.tenantId].unitId;
        }

        payments.push({
          id: doc.id,
          ...paymentData,
          propertyName: paymentData.propertyName || propertiesMap[propId] || 'N/A',
          unitId: pUnitId,
          unitNumber: pUnitId,
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