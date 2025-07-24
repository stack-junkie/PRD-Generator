/**
 * Performance Regression Detection Utility
 * 
 * Analyzes performance test results against historical baselines
 * to detect performance regressions and generate automated reports.
 */

import http from 'k6/http';
import { Counter, Rate } from 'k6/metrics';

// Regression detection metrics
const regressionsDetected = new Counter('regressions_detected');
const performanceImprovement = new Counter('performance_improvements');

/**
 * Performance Regression Detector Class
 */
export class RegressionDetector {
  constructor(config = {}) {
    this.baselineSource = config.baselineSource || 'local'; // local, s3, database
    this.regressionThreshold = config.regressionThreshold || 0.2; // 20% regression
    this.improvementThreshold = config.improvementThreshold || 0.1; // 10% improvement
    this.significanceLevel = config.significanceLevel || 0.05; // Statistical significance
    this.minSampleSize = config.minSampleSize || 10; // Minimum samples for comparison
    this.baselineUrl = config.baselineUrl || 'http://localhost:3001/api/performance/baseline';
    this.alertWebhook = config.alertWebhook;
    
    this.criticalMetrics = [
      'http_req_duration',
      'ai_response_time_ms',
      'export_generation_time_ms',
      'db_query_time_ms',
      'sessions_created',
      'http_req_failed'
    ];
  }

  /**
   * Analyze current test results against baseline
   */
  async analyzeResults(currentResults, testType = 'load') {
    console.log('🔍 Starting performance regression analysis...');
    
    try {
      // Load baseline data
      const baseline = await this.loadBaseline(testType);
      if (!baseline) {
        console.warn('⚠️  No baseline data found, skipping regression analysis');
        return this.createEmptyReport(currentResults, testType);
      }
      
      // Perform regression analysis
      const analysis = this.performRegressionAnalysis(currentResults, baseline);
      
      // Generate report
      const report = this.generateRegressionReport(analysis, currentResults, baseline, testType);
      
      // Send alerts if needed
      if (analysis.hasRegressions) {
        await this.sendRegressionAlerts(report);
      }
      
      // Save current results as potential future baseline
      await this.updateBaseline(currentResults, testType);
      
      console.log(`✅ Regression analysis completed. Found ${analysis.regressions.length} regressions and ${analysis.improvements.length} improvements`);
      
      return report;
      
    } catch (error) {
      console.error('❌ Regression analysis failed:', error.message);
      return this.createErrorReport(error, currentResults, testType);
    }
  }

  /**
   * Load baseline performance data
   */
  async loadBaseline(testType) {
    switch (this.baselineSource) {
      case 'local':
        return this.loadLocalBaseline(testType);
      case 's3':
        return this.loadS3Baseline(testType);
      case 'database':
        return this.loadDatabaseBaseline(testType);
      case 'api':
        return this.loadAPIBaseline(testType);
      default:
        return this.loadLocalBaseline(testType);
    }
  }

  /**
   * Load baseline from local storage/file system
   */
  loadLocalBaseline(testType) {
    try {
      // In a real implementation, this would read from a file
      // For k6, we'll simulate with some default baselines
      const baselines = {
        load: {
          timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
          metrics: {
            http_req_duration: { avg: 150, p95: 200, p99: 400 },
            ai_response_time_ms: { avg: 2000, p95: 3000, p99: 5000 },
            export_generation_time_ms: { avg: 3000, p95: 5000, p99: 8000 },
            db_query_time_ms: { avg: 50, p95: 100, p99: 200 },
            sessions_created: { count: 500 },
            http_req_failed: { rate: 0.01 },
            http_reqs: { count: 10000 }
          },
          environment: 'test',
          version: '1.0.0'
        },
        concurrent: {
          timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          metrics: {
            http_req_duration: { avg: 200, p95: 300, p99: 600 },
            sessions_created: { count: 1000 },
            concurrent_sessions_active: { max: 100 },
            http_req_failed: { rate: 0.02 }
          }
        },
        throughput: {
          timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          metrics: {
            http_req_duration: { avg: 180, p95: 250, p99: 500 },
            messages_processed_total: { count: 5000 },
            message_processing_success: { rate: 0.99 }
          }
        },
        'ai-response': {
          timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          metrics: {
            ai_response_time_ms: { avg: 1800, p95: 2800, p99: 4500 },
            ai_success_rate: { rate: 0.97 },
            token_usage_total: { count: 50000 }
          }
        }
      };
      
      return baselines[testType] || baselines.load;
    } catch (error) {
      console.warn('Failed to load local baseline:', error.message);
      return null;
    }
  }

  /**
   * Load baseline from S3
   */
  async loadS3Baseline(testType) {
    // Implementation would fetch from S3
    console.log('Loading baseline from S3...');
    return null; // Placeholder
  }

  /**
   * Load baseline from database
   */
  async loadDatabaseBaseline(testType) {
    // Implementation would query database
    console.log('Loading baseline from database...');
    return null; // Placeholder
  }

  /**
   * Load baseline from API
   */
  async loadAPIBaseline(testType) {
    try {
      const response = http.get(`${this.baselineUrl}/${testType}`, {
        timeout: '10s'
      });
      
      if (response.status === 200) {
        return response.json();
      }
    } catch (error) {
      console.warn('Failed to load baseline from API:', error.message);
    }
    return null;
  }

  /**
   * Perform statistical regression analysis
   */
  performRegressionAnalysis(current, baseline) {
    const regressions = [];
    const improvements = [];
    const unchanged = [];
    
    this.criticalMetrics.forEach(metricName => {
      const analysis = this.analyzeMetric(metricName, current, baseline);
      
      if (analysis.hasRegression) {
        regressions.push(analysis);
        regressionsDetected.add(1);
      } else if (analysis.hasImprovement) {
        improvements.push(analysis);
        performanceImprovement.add(1);
      } else {
        unchanged.push(analysis);
      }
    });
    
    return {
      hasRegressions: regressions.length > 0,
      hasImprovements: improvements.length > 0,
      regressions,
      improvements,
      unchanged,
      totalMetricsAnalyzed: this.criticalMetrics.length
    };
  }

  /**
   * Analyze individual metric for regression
   */
  analyzeMetric(metricName, current, baseline) {
    const currentMetric = this.extractMetricValue(current, metricName);
    const baselineMetric = this.extractMetricValue(baseline, metricName);
    
    if (!currentMetric || !baselineMetric) {
      return {
        metric: metricName,
        status: 'no_data',
        message: 'Insufficient data for comparison'
      };
    }
    
    const analysis = {
      metric: metricName,
      current: currentMetric,
      baseline: baselineMetric,
      status: 'unchanged'
    };
    
    // Analyze different metric types
    if (this.isLatencyMetric(metricName)) {
      return this.analyzeLatencyMetric(analysis);
    } else if (this.isRateMetric(metricName)) {
      return this.analyzeRateMetric(analysis);
    } else if (this.isCountMetric(metricName)) {
      return this.analyzeCountMetric(analysis);
    }
    
    return analysis;
  }

  /**
   * Analyze latency metrics (lower is better)
   */
  analyzeLatencyMetric(analysis) {
    const { current, baseline } = analysis;
    
    // Compare P95 values primarily
    const currentP95 = current.p95 || current.avg;
    const baselineP95 = baseline.p95 || baseline.avg;
    
    if (!currentP95 || !baselineP95) {
      return { ...analysis, status: 'no_data' };
    }
    
    const changePercent = ((currentP95 - baselineP95) / baselineP95) * 100;
    const absoluteChange = currentP95 - baselineP95;
    
    analysis.changePercent = changePercent;
    analysis.absoluteChange = absoluteChange;
    analysis.significance = this.calculateSignificance(currentP95, baselineP95);
    
    if (changePercent > (this.regressionThreshold * 100)) {
      analysis.hasRegression = true;
      analysis.status = 'regression';
      analysis.severity = this.calculateSeverity(changePercent);
      analysis.message = `P95 latency increased by ${changePercent.toFixed(1)}% (${absoluteChange.toFixed(0)}ms)`;
    } else if (changePercent < -(this.improvementThreshold * 100)) {
      analysis.hasImprovement = true;
      analysis.status = 'improvement';
      analysis.message = `P95 latency improved by ${Math.abs(changePercent).toFixed(1)}% (${Math.abs(absoluteChange).toFixed(0)}ms)`;
    } else {
      analysis.message = `P95 latency changed by ${changePercent.toFixed(1)}% (within acceptable range)`;
    }
    
    return analysis;
  }

  /**
   * Analyze rate metrics (depends on context)
   */
  analyzeRateMetric(analysis) {
    const { current, baseline, metric } = analysis;
    
    const currentRate = current.rate || current.avg || current.count;
    const baselineRate = baseline.rate || baseline.avg || baseline.count;
    
    if (currentRate === undefined || baselineRate === undefined) {
      return { ...analysis, status: 'no_data' };
    }
    
    const changePercent = ((currentRate - baselineRate) / baselineRate) * 100;
    
    analysis.changePercent = changePercent;
    analysis.absoluteChange = currentRate - baselineRate;
    
    // Error rates: higher is worse
    if (metric.includes('failed') || metric.includes('error')) {
      if (changePercent > (this.regressionThreshold * 100)) {
        analysis.hasRegression = true;
        analysis.status = 'regression';
        analysis.severity = this.calculateSeverity(changePercent);
        analysis.message = `Error rate increased by ${changePercent.toFixed(2)}%`;
      } else if (changePercent < -(this.improvementThreshold * 100)) {
        analysis.hasImprovement = true;
        analysis.status = 'improvement';
        analysis.message = `Error rate improved by ${Math.abs(changePercent).toFixed(2)}%`;
      }
    } else {
      // Success rates: lower is worse
      if (changePercent < -(this.regressionThreshold * 100)) {
        analysis.hasRegression = true;
        analysis.status = 'regression';
        analysis.severity = this.calculateSeverity(Math.abs(changePercent));
        analysis.message = `Success rate decreased by ${Math.abs(changePercent).toFixed(2)}%`;
      } else if (changePercent > (this.improvementThreshold * 100)) {
        analysis.hasImprovement = true;
        analysis.status = 'improvement';
        analysis.message = `Success rate improved by ${changePercent.toFixed(2)}%`;
      }
    }
    
    if (!analysis.message) {
      analysis.message = `Rate changed by ${changePercent.toFixed(2)}% (within acceptable range)`;
    }
    
    return analysis;
  }

  /**
   * Analyze count metrics (context dependent)
   */
  analyzeCountMetric(analysis) {
    const { current, baseline, metric } = analysis;
    
    const currentCount = current.count || current.total || current.avg;
    const baselineCount = baseline.count || baseline.total || baseline.avg;
    
    if (currentCount === undefined || baselineCount === undefined) {
      return { ...analysis, status: 'no_data' };
    }
    
    const changePercent = ((currentCount - baselineCount) / baselineCount) * 100;
    
    analysis.changePercent = changePercent;
    analysis.absoluteChange = currentCount - baselineCount;
    
    // For throughput metrics, lower might be a regression
    if (metric.includes('sessions') || metric.includes('processed') || metric.includes('reqs')) {
      if (changePercent < -(this.regressionThreshold * 100)) {
        analysis.hasRegression = true;
        analysis.status = 'regression';
        analysis.severity = this.calculateSeverity(Math.abs(changePercent));
        analysis.message = `Throughput decreased by ${Math.abs(changePercent).toFixed(1)}%`;
      } else if (changePercent > (this.improvementThreshold * 100)) {
        analysis.hasImprovement = true;
        analysis.status = 'improvement';
        analysis.message = `Throughput improved by ${changePercent.toFixed(1)}%`;
      }
    }
    
    if (!analysis.message) {
      analysis.message = `Count changed by ${changePercent.toFixed(1)}% (${analysis.absoluteChange.toFixed(0)} units)`;
    }
    
    return analysis;
  }

  /**
   * Extract metric value from results
   */
  extractMetricValue(results, metricName) {
    // Handle nested metric structure
    if (results.metrics && results.metrics[metricName]) {
      return results.metrics[metricName].values || results.metrics[metricName];
    }
    
    // Handle custom metrics
    if (results.customMetrics && results.customMetrics[metricName]) {
      return results.customMetrics[metricName];
    }
    
    return null;
  }

  /**
   * Determine if metric is a latency metric
   */
  isLatencyMetric(metricName) {
    return metricName.includes('duration') || 
           metricName.includes('time') || 
           metricName.includes('latency');
  }

  /**
   * Determine if metric is a rate metric
   */
  isRateMetric(metricName) {
    return metricName.includes('rate') || 
           metricName.includes('failed') || 
           metricName.includes('success');
  }

  /**
   * Determine if metric is a count metric
   */
  isCountMetric(metricName) {
    return metricName.includes('count') || 
           metricName.includes('total') || 
           metricName.includes('sessions') || 
           metricName.includes('reqs');
  }

  /**
   * Calculate statistical significance
   */
  calculateSignificance(current, baseline) {
    // Simplified significance calculation
    // In a real implementation, you'd use proper statistical tests
    const ratio = current / baseline;
    if (ratio > 1.5 || ratio < 0.5) {
      return 'high';
    } else if (ratio > 1.2 || ratio < 0.8) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Calculate regression severity
   */
  calculateSeverity(changePercent) {
    const absChange = Math.abs(changePercent);
    if (absChange > 50) {
      return 'critical';
    } else if (absChange > 30) {
      return 'high';
    } else if (absChange > 20) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Generate comprehensive regression report
   */
  generateRegressionReport(analysis, current, baseline, testType) {
    const report = {
      timestamp: new Date().toISOString(),
      testType: testType,
      analysis: analysis,
      summary: {
        totalMetricsAnalyzed: analysis.totalMetricsAnalyzed,
        regressionsFound: analysis.regressions.length,
        improvementsFound: analysis.improvements.length,
        unchangedMetrics: analysis.unchanged.length,
        overallStatus: this.determineOverallStatus(analysis)
      },
      baseline: {
        timestamp: baseline.timestamp,
        source: this.baselineSource,
        version: baseline.version || 'unknown'
      },
      current: {
        timestamp: current.timestamp || new Date().toISOString(),
        testDuration: current.testRunDuration || 0,
        totalRequests: this.extractMetricValue(current, 'http_reqs')?.count || 0
      },
      recommendations: this.generateRecommendations(analysis),
      alerts: this.generateAlerts(analysis)
    };
    
    return report;
  }

  /**
   * Determine overall status
   */
  determineOverallStatus(analysis) {
    if (analysis.regressions.length === 0) {
      return analysis.improvements.length > 0 ? 'improved' : 'stable';
    }
    
    const criticalRegressions = analysis.regressions.filter(r => r.severity === 'critical');
    const highRegressions = analysis.regressions.filter(r => r.severity === 'high');
    
    if (criticalRegressions.length > 0) {
      return 'critical_regression';
    } else if (highRegressions.length > 0) {
      return 'significant_regression';
    } else {
      return 'minor_regression';
    }
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(analysis) {
    const recommendations = [];
    
    analysis.regressions.forEach(regression => {
      switch (regression.metric) {
        case 'http_req_duration':
          recommendations.push({
            metric: regression.metric,
            priority: regression.severity,
            action: 'Investigate API response time degradation',
            details: 'Check database queries, external service calls, and application logic'
          });
          break;
          
        case 'ai_response_time_ms':
          recommendations.push({
            metric: regression.metric,
            priority: regression.severity,
            action: 'Optimize AI processing pipeline',
            details: 'Review model performance, token usage, and concurrent request handling'
          });
          break;
          
        case 'db_query_time_ms':
          recommendations.push({
            metric: regression.metric,
            priority: regression.severity,
            action: 'Optimize database performance',
            details: 'Check query execution plans, index usage, and connection pooling'
          });
          break;
          
        case 'http_req_failed':
          recommendations.push({
            metric: regression.metric,
            priority: 'high',
            action: 'Investigate error rate increase',
            details: 'Review error logs, check service health, and validate error handling'
          });
          break;
          
        default:
          recommendations.push({
            metric: regression.metric,
            priority: regression.severity,
            action: `Investigate ${regression.metric} performance degradation`,
            details: regression.message
          });
      }
    });
    
    return recommendations;
  }

  /**
   * Generate alerts for critical regressions
   */
  generateAlerts(analysis) {
    const alerts = [];
    
    analysis.regressions.forEach(regression => {
      if (regression.severity === 'critical' || regression.severity === 'high') {
        alerts.push({
          level: regression.severity,
          metric: regression.metric,
          message: regression.message,
          changePercent: regression.changePercent,
          significance: regression.significance,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    return alerts;
  }

  /**
   * Send regression alerts via webhook
   */
  async sendRegressionAlerts(report) {
    if (!this.alertWebhook || report.alerts.length === 0) {
      return;
    }
    
    try {
      const alertPayload = {
        text: `🚨 Performance Regression Detected - ${report.testType}`,
        attachments: [
          {
            color: 'danger',
            title: `${report.summary.regressionsFound} Performance Regressions Found`,
            fields: report.alerts.map(alert => ({
              title: alert.metric,
              value: `${alert.message} (${alert.level} severity)`,
              short: true
            }))
          }
        ]
      };
      
      const response = http.post(this.alertWebhook, JSON.stringify(alertPayload), {
        headers: { 'Content-Type': 'application/json' },
        timeout: '10s'
      });
      
      if (response.status === 200) {
        console.log('✅ Regression alerts sent successfully');
      } else {
        console.warn(`⚠️  Failed to send alerts: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Failed to send regression alerts:', error.message);
    }
  }

  /**
   * Update baseline with current results
   */
  async updateBaseline(currentResults, testType) {
    // In a real implementation, this would save to persistent storage
    console.log(`📊 Updating baseline for ${testType} test type`);
    
    const newBaseline = {
      timestamp: new Date().toISOString(),
      testType: testType,
      metrics: currentResults.metrics || {},
      customMetrics: currentResults.customMetrics || {},
      environment: __ENV.ENVIRONMENT || 'test',
      version: __ENV.APP_VERSION || 'unknown'
    };
    
    // Save logic would go here
    return newBaseline;
  }

  /**
   * Create empty report when no baseline exists
   */
  createEmptyReport(currentResults, testType) {
    return {
      timestamp: new Date().toISOString(),
      testType: testType,
      analysis: {
        hasRegressions: false,
        hasImprovements: false,
        regressions: [],
        improvements: [],
        unchanged: [],
        totalMetricsAnalyzed: 0
      },
      summary: {
        overallStatus: 'no_baseline',
        message: 'No baseline data available for comparison'
      },
      baseline: null,
      current: currentResults,
      recommendations: [],
      alerts: []
    };
  }

  /**
   * Create error report when analysis fails
   */
  createErrorReport(error, currentResults, testType) {
    return {
      timestamp: new Date().toISOString(),
      testType: testType,
      analysis: {
        hasRegressions: false,
        hasImprovements: false,
        regressions: [],
        improvements: [],
        unchanged: [],
        totalMetricsAnalyzed: 0
      },
      summary: {
        overallStatus: 'analysis_error',
        message: `Regression analysis failed: ${error.message}`
      },
      error: {
        message: error.message,
        stack: error.stack
      },
      current: currentResults,
      recommendations: [],
      alerts: []
    };
  }
}

// Export convenience function
export function detectRegressions(testResults, config = {}) {
  const detector = new RegressionDetector(config);
  return detector.analyzeResults(testResults, config.testType || 'load');
}

export default RegressionDetector;