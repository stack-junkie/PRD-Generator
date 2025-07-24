/**
 * Performance Test Reporter
 * 
 * Generates comprehensive performance test reports in multiple formats
 * including HTML dashboards, JSON data files, and integration with
 * monitoring systems.
 */

import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { RegressionDetector } from './regression-detector.js';
import { CONFIG } from '../config.js';

/**
 * Performance Reporter Class
 */
export class PerformanceReporter {
  constructor(config = {}) {
    this.outputDir = config.outputDir || 'test-results/performance';
    this.formats = config.formats || ['html', 'json', 'console', 'csv'];
    this.includeRegression = config.includeRegression !== false;
    this.includeTrends = config.includeTrends !== false;
    this.webhookUrl = config.webhookUrl;
    this.s3Bucket = config.s3Bucket;
    this.retentionDays = config.retentionDays || 30;
    
    this.regressionDetector = new RegressionDetector({
      baselineSource: config.baselineSource || 'local',
      regressionThreshold: config.regressionThreshold || 0.2,
      alertWebhook: config.alertWebhook
    });
  }

  /**
   * Generate comprehensive performance report
   */
  async generateReport(data, testType = 'load', metadata = {}) {
    console.log('📊 Generating performance test report...');
    
    try {
      // Analyze for regressions if enabled
      let regressionReport = null;
      if (this.includeRegression) {
        regressionReport = await this.regressionDetector.analyzeResults(data, testType);
      }
      
      // Extract and process metrics
      const processedMetrics = this.processMetrics(data, testType);
      
      // Generate trend analysis if enabled
      let trendAnalysis = null;
      if (this.includeTrends) {
        trendAnalysis = await this.generateTrendAnalysis(processedMetrics, testType);
      }
      
      // Create comprehensive report data
      const reportData = {
        metadata: {
          testType: testType,
          timestamp: new Date().toISOString(),
          testDuration: data.state?.testRunDuration || 0,
          k6Version: data.options?.k6Version || 'unknown',
          environment: metadata.environment || __ENV.ENVIRONMENT || 'test',
          version: metadata.version || __ENV.APP_VERSION || 'unknown',
          ...metadata
        },
        summary: this.generateSummary(processedMetrics, testType),
        metrics: processedMetrics,
        thresholds: this.analyzeThresholds(data),
        regression: regressionReport,
        trends: trendAnalysis,
        recommendations: this.generateRecommendations(processedMetrics, regressionReport),
        rawData: this.formats.includes('raw') ? data : null
      };
      
      // Generate reports in requested formats
      const reports = {};
      
      if (this.formats.includes('html')) {
        reports[`${this.outputDir}/performance-report.html`] = this.generateHTMLReport(reportData, data);
      }
      
      if (this.formats.includes('json')) {
        reports[`${this.outputDir}/performance-report.json`] = JSON.stringify(reportData, null, 2);
      }
      
      if (this.formats.includes('csv')) {
        reports[`${this.outputDir}/performance-metrics.csv`] = this.generateCSVReport(processedMetrics);
      }
      
      if (this.formats.includes('console')) {
        reports.stdout = this.generateConsoleReport(reportData, data);
      }
      
      // Generate executive summary
      reports[`${this.outputDir}/executive-summary.md`] = this.generateExecutiveSummary(reportData);
      
      // Send webhook notifications if configured
      if (this.webhookUrl) {
        await this.sendWebhookNotification(reportData);
      }
      
      console.log('✅ Performance report generation completed');
      return reports;
      
    } catch (error) {
      console.error('❌ Failed to generate performance report:', error.message);
      return this.generateErrorReport(error, data, testType);
    }
  }

  /**
   * Process and normalize metrics from k6 data
   */
  processMetrics(data, testType) {
    const metrics = data.metrics || {};
    const processed = {
      http: {},
      business: {},
      custom: {},
      system: {}
    };
    
    // Process HTTP metrics
    this.processHTTPMetrics(metrics, processed.http);
    
    // Process business metrics
    this.processBusinessMetrics(metrics, processed.business, testType);
    
    // Process custom metrics
    this.processCustomMetrics(metrics, processed.custom, testType);
    
    // Process system metrics
    this.processSystemMetrics(metrics, processed.system);
    
    return processed;
  }

  /**
   * Process HTTP-related metrics
   */
  processHTTPMetrics(metrics, httpMetrics) {
    const httpReqDuration = metrics.http_req_duration;
    if (httpReqDuration) {
      httpMetrics.responseTime = {
        average: httpReqDuration.values?.avg || 0,
        p50: httpReqDuration.values?.['p(50)'] || 0,
        p95: httpReqDuration.values?.['p(95)'] || 0,
        p99: httpReqDuration.values?.['p(99)'] || 0,
        max: httpReqDuration.values?.max || 0,
        min: httpReqDuration.values?.min || 0
      };
    }
    
    const httpReqs = metrics.http_reqs;
    if (httpReqs) {
      httpMetrics.requests = {
        total: httpReqs.values?.count || 0,
        rate: httpReqs.values?.rate || 0
      };
    }
    
    const httpReqFailed = metrics.http_req_failed;
    if (httpReqFailed) {
      httpMetrics.errors = {
        rate: httpReqFailed.values?.rate || 0,
        count: Math.round((httpReqFailed.values?.rate || 0) * (httpMetrics.requests?.total || 0))
      };
    }
    
    // Calculate derived metrics
    if (httpMetrics.requests?.total && httpReqDuration?.values?.avg) {
      const testDuration = (httpReqDuration.values.count || 1) * (httpReqDuration.values.avg || 0) / 1000;
      httpMetrics.throughput = {
        requestsPerSecond: testDuration > 0 ? httpMetrics.requests.total / testDuration : 0
      };
    }
  }

  /**
   * Process business-specific metrics
   */
  processBusinessMetrics(metrics, businessMetrics, testType) {
    const businessMetricNames = [
      'sessions_created',
      'sections_completed',
      'prds_generated',
      'exports_generated',
      'messages_processed_total',
      'concurrent_sessions_active'
    ];
    
    businessMetricNames.forEach(metricName => {
      const metric = metrics[metricName];
      if (metric) {
        businessMetrics[metricName] = {
          value: metric.values?.count || metric.values?.rate || metric.values?.avg || 0,
          type: this.getMetricType(metric),
          unit: this.getMetricUnit(metricName)
        };
      }
    });
  }

  /**
   * Process custom test-specific metrics
   */
  processCustomMetrics(metrics, customMetrics, testType) {
    const customMetricPatterns = [
      /ai_response_time/,
      /export_generation_time/,
      /db_query_time/,
      /token_usage/,
      /performance_/,
      /stress_/,
      /throughput_/
    ];
    
    Object.keys(metrics).forEach(metricName => {
      if (customMetricPatterns.some(pattern => pattern.test(metricName))) {
        const metric = metrics[metricName];
        customMetrics[metricName] = {
          values: metric.values || {},
          type: this.getMetricType(metric),
          unit: this.getMetricUnit(metricName),
          summary: this.summarizeMetric(metric)
        };
      }
    });
  }

  /**
   * Process system resource metrics
   */
  processSystemMetrics(metrics, systemMetrics) {
    const systemMetricNames = [
      'memory_usage_mb',
      'cpu_utilization_percent',
      'db_connections',
      'concurrent_connections'
    ];
    
    systemMetricNames.forEach(metricName => {
      const metric = metrics[metricName];
      if (metric) {
        systemMetrics[metricName] = {
          current: metric.values?.avg || 0,
          max: metric.values?.max || 0,
          min: metric.values?.min || 0,
          unit: this.getMetricUnit(metricName)
        };
      }
    });
  }

  /**
   * Generate test summary
   */
  generateSummary(metrics, testType) {
    const summary = {
      testType: testType,
      overallStatus: 'unknown',
      keyFindings: [],
      performanceScore: 0,
      slaCompliance: {}
    };
    
    // Determine overall status
    const errorRate = metrics.http?.errors?.rate || 0;
    const avgResponseTime = metrics.http?.responseTime?.average || 0;
    const p95ResponseTime = metrics.http?.responseTime?.p95 || 0;
    
    if (errorRate > 0.05) {
      summary.overallStatus = 'failed';
      summary.keyFindings.push(`High error rate: ${(errorRate * 100).toFixed(2)}%`);
    } else if (p95ResponseTime > CONFIG.sla.apiResponseTime.p95 * 2) {
      summary.overallStatus = 'degraded';
      summary.keyFindings.push(`Poor response times: P95 ${p95ResponseTime.toFixed(0)}ms`);
    } else if (p95ResponseTime > CONFIG.sla.apiResponseTime.p95) {
      summary.overallStatus = 'warning';
      summary.keyFindings.push(`Elevated response times: P95 ${p95ResponseTime.toFixed(0)}ms`);
    } else {
      summary.overallStatus = 'passed';
      summary.keyFindings.push('All performance metrics within acceptable ranges');
    }
    
    // Calculate performance score (0-100)
    summary.performanceScore = this.calculatePerformanceScore(metrics);
    
    // Check SLA compliance
    summary.slaCompliance = this.checkSLACompliance(metrics);
    
    return summary;
  }

  /**
   * Calculate overall performance score
   */
  calculatePerformanceScore(metrics) {
    let score = 100;
    
    // Response time scoring (40% weight)
    const p95ResponseTime = metrics.http?.responseTime?.p95 || 0;
    const responseTimeTarget = CONFIG.sla.apiResponseTime.p95;
    if (p95ResponseTime > responseTimeTarget) {
      const penalty = Math.min(40, (p95ResponseTime / responseTimeTarget - 1) * 40);
      score -= penalty;
    }
    
    // Error rate scoring (30% weight)
    const errorRate = metrics.http?.errors?.rate || 0;
    const errorRateTarget = CONFIG.sla.errorRates.total / 100;
    if (errorRate > errorRateTarget) {
      const penalty = Math.min(30, (errorRate / errorRateTarget - 1) * 30);
      score -= penalty;
    }
    
    // Throughput scoring (20% weight)
    const rps = metrics.http?.throughput?.requestsPerSecond || 0;
    const rpsTarget = CONFIG.sla.throughput.minRequestsPerSecond;
    if (rps < rpsTarget) {
      const penalty = Math.min(20, (1 - rps / rpsTarget) * 20);
      score -= penalty;
    }
    
    // Stability scoring (10% weight)
    const p99ResponseTime = metrics.http?.responseTime?.p99 || 0;
    const p95ResponseTime2 = metrics.http?.responseTime?.p95 || 0;
    if (p95ResponseTime2 > 0) {
      const variability = p99ResponseTime / p95ResponseTime2;
      if (variability > 2) {
        score -= Math.min(10, (variability - 2) * 5);
      }
    }
    
    return Math.max(0, Math.round(score));
  }

  /**
   * Check SLA compliance
   */
  checkSLACompliance(metrics) {
    const compliance = {};
    
    // Response time SLA
    const p95ResponseTime = metrics.http?.responseTime?.p95 || 0;
    compliance.responseTime = {
      target: CONFIG.sla.apiResponseTime.p95,
      actual: p95ResponseTime,
      passed: p95ResponseTime <= CONFIG.sla.apiResponseTime.p95,
      score: Math.max(0, 100 - Math.max(0, (p95ResponseTime / CONFIG.sla.apiResponseTime.p95 - 1) * 100))
    };
    
    // Error rate SLA
    const errorRate = metrics.http?.errors?.rate || 0;
    compliance.errorRate = {
      target: CONFIG.sla.errorRates.total,
      actual: errorRate * 100,
      passed: errorRate <= CONFIG.sla.errorRates.total / 100,
      score: Math.max(0, 100 - Math.max(0, (errorRate / (CONFIG.sla.errorRates.total / 100) - 1) * 100))
    };
    
    // Throughput SLA
    const rps = metrics.http?.throughput?.requestsPerSecond || 0;
    compliance.throughput = {
      target: CONFIG.sla.throughput.minRequestsPerSecond,
      actual: rps,
      passed: rps >= CONFIG.sla.throughput.minRequestsPerSecond,
      score: Math.min(100, (rps / CONFIG.sla.throughput.minRequestsPerSecond) * 100)
    };
    
    return compliance;
  }

  /**
   * Analyze threshold violations
   */
  analyzeThresholds(data) {
    const thresholds = data.thresholds || {};
    const analysis = {
      total: Object.keys(thresholds).length,
      passed: 0,
      failed: 0,
      violations: []
    };
    
    Object.entries(thresholds).forEach(([metricName, threshold]) => {
      if (threshold.ok) {
        analysis.passed++;
      } else {
        analysis.failed++;
        analysis.violations.push({
          metric: metricName,
          threshold: threshold.threshold,
          actual: threshold.actual,
          message: `${metricName} failed threshold: ${threshold.threshold}`
        });
      }
    });
    
    return analysis;
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(metrics, regressionReport) {
    const recommendations = [];
    
    // Performance-based recommendations
    const p95ResponseTime = metrics.http?.responseTime?.p95 || 0;
    const errorRate = metrics.http?.errors?.rate || 0;
    const rps = metrics.http?.throughput?.requestsPerSecond || 0;
    
    if (p95ResponseTime > CONFIG.sla.apiResponseTime.p95) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        title: 'Optimize API Response Times',
        description: `P95 response time (${p95ResponseTime.toFixed(0)}ms) exceeds SLA target (${CONFIG.sla.apiResponseTime.p95}ms)`,
        actions: [
          'Profile slow API endpoints',
          'Optimize database queries',
          'Review caching strategies',
          'Consider load balancer configuration'
        ]
      });
    }
    
    if (errorRate > CONFIG.sla.errorRates.total / 100) {
      recommendations.push({
        category: 'reliability',
        priority: 'critical',
        title: 'Reduce Error Rate',
        description: `Error rate (${(errorRate * 100).toFixed(2)}%) exceeds SLA target (${CONFIG.sla.errorRates.total}%)`,
        actions: [
          'Investigate error logs',
          'Improve error handling',
          'Add circuit breakers',
          'Implement retry mechanisms'
        ]
      });
    }
    
    if (rps < CONFIG.sla.throughput.minRequestsPerSecond) {
      recommendations.push({
        category: 'scalability',
        priority: 'medium',
        title: 'Improve System Throughput',
        description: `Current throughput (${rps.toFixed(1)} RPS) below target (${CONFIG.sla.throughput.minRequestsPerSecond} RPS)`,
        actions: [
          'Scale application instances',
          'Optimize connection pooling',
          'Review resource allocation',
          'Consider async processing'
        ]
      });
    }
    
    // Regression-based recommendations
    if (regressionReport?.recommendations) {
      recommendations.push(...regressionReport.recommendations.map(rec => ({
        category: 'regression',
        priority: rec.priority,
        title: rec.action,
        description: rec.details,
        metric: rec.metric
      })));
    }
    
    return recommendations;
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(reportData, rawData) {
    const htmlContent = htmlReport(rawData);
    
    // Enhance with custom sections
    const enhancedHTML = htmlContent.replace(
      '</body>',
      `
      <div class="custom-section">
        <h2>Performance Analysis</h2>
        <div class="performance-score">
          <h3>Performance Score: ${reportData.summary.performanceScore}/100</h3>
          <div class="score-bar">
            <div class="score-fill" style="width: ${reportData.summary.performanceScore}%"></div>
          </div>
        </div>
        
        ${reportData.recommendations.length > 0 ? `
        <div class="recommendations">
          <h3>Recommendations</h3>
          ${reportData.recommendations.map(rec => `
            <div class="recommendation ${rec.priority}">
              <h4>${rec.title}</h4>
              <p>${rec.description}</p>
              ${rec.actions ? `
                <ul>
                  ${rec.actions.map(action => `<li>${action}</li>`).join('')}
                </ul>
              ` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}
        
        ${reportData.regression?.analysis.hasRegressions ? `
        <div class="regressions">
          <h3>Performance Regressions</h3>
          ${reportData.regression.analysis.regressions.map(reg => `
            <div class="regression ${reg.severity}">
              <h4>${reg.metric}</h4>
              <p>${reg.message}</p>
              <p>Change: ${reg.changePercent.toFixed(1)}%</p>
            </div>
          `).join('')}
        </div>
        ` : ''}
      </div>
      
      <style>
        .custom-section { margin: 20px 0; }
        .performance-score { margin: 20px 0; }
        .score-bar { width: 100%; height: 20px; background: #eee; border-radius: 10px; }
        .score-fill { height: 100%; background: linear-gradient(90deg, #ff4444, #ffaa00, #44aa44); border-radius: 10px; }
        .recommendation, .regression { margin: 10px 0; padding: 10px; border-left: 4px solid; }
        .critical { border-color: #ff4444; background: #fff5f5; }
        .high { border-color: #ff8800; background: #fff8f0; }
        .medium { border-color: #ffaa00; background: #fffaf0; }
        .low { border-color: #44aa44; background: #f5fff5; }
      </style>
      </body>`
    );
    
    return enhancedHTML;
  }

  /**
   * Generate CSV report
   */
  generateCSVReport(metrics) {
    const csvRows = [];
    csvRows.push('Metric,Category,Value,Unit,Type');
    
    // HTTP metrics
    Object.entries(metrics.http).forEach(([key, value]) => {
      if (typeof value === 'object') {
        Object.entries(value).forEach(([subKey, subValue]) => {
          csvRows.push(`${key}.${subKey},HTTP,${subValue},${this.getMetricUnit(subKey)},gauge`);
        });
      } else {
        csvRows.push(`${key},HTTP,${value},${this.getMetricUnit(key)},gauge`);
      }
    });
    
    // Business metrics
    Object.entries(metrics.business).forEach(([key, value]) => {
      csvRows.push(`${key},Business,${value.value},${value.unit},${value.type}`);
    });
    
    // Custom metrics
    Object.entries(metrics.custom).forEach(([key, value]) => {
      if (value.values && typeof value.values === 'object') {
        Object.entries(value.values).forEach(([subKey, subValue]) => {
          csvRows.push(`${key}.${subKey},Custom,${subValue},${value.unit},${value.type}`);
        });
      }
    });
    
    return csvRows.join('\n');
  }

  /**
   * Generate console report
   */
  generateConsoleReport(reportData, rawData) {
    const baseReport = textSummary(rawData, { indent: ' ', enableColors: true });
    
    const customSections = `

🎯 Performance Summary
=====================
Test Type: ${reportData.metadata.testType}
Overall Status: ${reportData.summary.overallStatus.toUpperCase()}
Performance Score: ${reportData.summary.performanceScore}/100

📊 Key Metrics
==============
Response Time (P95): ${reportData.metrics.http?.responseTime?.p95?.toFixed(0) || 0}ms
Error Rate: ${((reportData.metrics.http?.errors?.rate || 0) * 100).toFixed(2)}%
Throughput: ${reportData.metrics.http?.throughput?.requestsPerSecond?.toFixed(1) || 0} RPS

✅ SLA Compliance
================
Response Time: ${reportData.summary.slaCompliance.responseTime?.passed ? '✅ PASS' : '❌ FAIL'}
Error Rate: ${reportData.summary.slaCompliance.errorRate?.passed ? '✅ PASS' : '❌ FAIL'}
Throughput: ${reportData.summary.slaCompliance.throughput?.passed ? '✅ PASS' : '❌ FAIL'}

${reportData.recommendations.length > 0 ? `
💡 Recommendations
==================
${reportData.recommendations.slice(0, 3).map(rec => `• ${rec.title}: ${rec.description}`).join('\n')}
` : ''}

${reportData.regression?.analysis.hasRegressions ? `
⚠️  Performance Regressions
==========================
${reportData.regression.analysis.regressions.slice(0, 3).map(reg => `• ${reg.metric}: ${reg.message}`).join('\n')}
` : ''}
`;
    
    return baseReport + customSections;
  }

  /**
   * Generate executive summary in Markdown
   */
  generateExecutiveSummary(reportData) {
    return `# Performance Test Executive Summary

## Test Overview
- **Test Type**: ${reportData.metadata.testType}
- **Date**: ${new Date(reportData.metadata.timestamp).toLocaleDateString()}
- **Duration**: ${Math.round(reportData.metadata.testDuration / 1000)}s
- **Environment**: ${reportData.metadata.environment}

## Key Results
- **Overall Status**: ${reportData.summary.overallStatus.toUpperCase()}
- **Performance Score**: ${reportData.summary.performanceScore}/100
- **Total Requests**: ${reportData.metrics.http?.requests?.total || 0}
- **Error Rate**: ${((reportData.metrics.http?.errors?.rate || 0) * 100).toFixed(2)}%

## Performance Metrics
| Metric | Value | SLA Target | Status |
|--------|-------|------------|--------|
| Response Time (P95) | ${reportData.metrics.http?.responseTime?.p95?.toFixed(0) || 0}ms | ${CONFIG.sla.apiResponseTime.p95}ms | ${reportData.summary.slaCompliance.responseTime?.passed ? '✅' : '❌'} |
| Error Rate | ${((reportData.metrics.http?.errors?.rate || 0) * 100).toFixed(2)}% | <${CONFIG.sla.errorRates.total}% | ${reportData.summary.slaCompliance.errorRate?.passed ? '✅' : '❌'} |
| Throughput | ${reportData.metrics.http?.throughput?.requestsPerSecond?.toFixed(1) || 0} RPS | >${CONFIG.sla.throughput.minRequestsPerSecond} RPS | ${reportData.summary.slaCompliance.throughput?.passed ? '✅' : '❌'} |

${reportData.summary.keyFindings.length > 0 ? `
## Key Findings
${reportData.summary.keyFindings.map(finding => `- ${finding}`).join('\n')}
` : ''}

${reportData.recommendations.length > 0 ? `
## Recommendations
${reportData.recommendations.slice(0, 5).map(rec => `
### ${rec.title} (${rec.priority} priority)
${rec.description}
${rec.actions ? rec.actions.map(action => `- ${action}`).join('\n') : ''}
`).join('\n')}
` : ''}

${reportData.regression?.analysis.hasRegressions ? `
## Performance Regressions
${reportData.regression.analysis.regressions.map(reg => `- **${reg.metric}**: ${reg.message}`).join('\n')}
` : ''}

---
*Report generated on ${new Date(reportData.metadata.timestamp).toISOString()}*
`;
  }

  /**
   * Generate trend analysis (placeholder for future implementation)
   */
  async generateTrendAnalysis(metrics, testType) {
    // This would analyze historical data to identify trends
    return {
      enabled: false,
      message: 'Trend analysis not yet implemented'
    };
  }

  /**
   * Send webhook notification
   */
  async sendWebhookNotification(reportData) {
    // Implementation would send notification to configured webhook
    console.log('📡 Webhook notification would be sent here');
  }

  /**
   * Generate error report
   */
  generateErrorReport(error, data, testType) {
    return {
      stdout: `❌ Performance report generation failed: ${error.message}`,
      [`${this.outputDir}/error-report.json`]: JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
        testType: testType,
        rawData: data
      }, null, 2)
    };
  }

  /**
   * Utility functions
   */
  getMetricType(metric) {
    if (metric.values?.count !== undefined) return 'counter';
    if (metric.values?.rate !== undefined) return 'rate';
    if (metric.values?.avg !== undefined) return 'trend';
    return 'gauge';
  }

  getMetricUnit(metricName) {
    if (metricName.includes('time') || metricName.includes('duration')) return 'ms';
    if (metricName.includes('rate') || metricName.includes('percent')) return '%';
    if (metricName.includes('bytes') || metricName.includes('memory')) return 'bytes';
    if (metricName.includes('rps') || metricName.includes('per_second')) return '/s';
    return '';
  }

  summarizeMetric(metric) {
    if (!metric.values) return {};
    
    return {
      count: metric.values.count || 0,
      avg: metric.values.avg || 0,
      min: metric.values.min || 0,
      max: metric.values.max || 0,
      p95: metric.values['p(95)'] || 0
    };
  }
}

// Export convenience function
export function generatePerformanceReport(data, testType, config = {}) {
  const reporter = new PerformanceReporter(config);
  return reporter.generateReport(data, testType);
}

export default PerformanceReporter;