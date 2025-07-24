# Performance Test Suite

This comprehensive performance test suite validates the PRD Generator application under various load conditions using k6 for load testing. The suite includes concurrent user testing, throughput analysis, AI response time validation, database performance testing, and stress testing scenarios.

## Overview

The performance test suite provides:

- **Load Testing**: Gradual ramp-up testing with configurable user loads
- **Concurrent User Testing**: Tests system behavior with simultaneous users (up to 1000)
- **Throughput Testing**: Message processing capacity validation (target: 100+ RPS)
- **AI Response Testing**: AI processing performance under load (target: <3s response time)
- **Database Performance**: Query optimization and export generation testing
- **Stress Testing**: Spike, endurance, volume, and breakpoint testing
- **Regression Detection**: Automated performance regression analysis
- **Comprehensive Reporting**: Multi-format reports with actionable insights

## Quick Start

### Prerequisites

- **k6**: Load testing tool ([Installation Guide](https://k6.io/docs/getting-started/installation/))
- **Node.js**: Version 18+ for application services
- **PostgreSQL**: Database for local testing
- **Redis**: Caching layer for local testing

### Installation

```bash
# Install k6 (Ubuntu/Debian)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Install project dependencies
npm install
cd frontend && npm install
cd ../backend && npm install

# Start local services for testing
npm run dev
```

### Running Tests

```bash
# Run all performance tests with default settings
./tests/performance/scripts/run-all-tests.sh

# Run specific test scenarios
./tests/performance/scripts/run-all-tests.sh -s "load,concurrent" -v 100 -d 10m

# Run tests in parallel for faster execution
./tests/performance/scripts/run-all-tests.sh -s all -p

# Run with regression analysis
./tests/performance/scripts/run-all-tests.sh -r -s load

# Run against staging environment
./tests/performance/scripts/run-all-tests.sh -e staging -u https://api-staging.example.com
```

## Test Scenarios

### 1. Load Testing (`load`)

**Purpose**: Validate system performance under expected load conditions.

**Configuration**:
- Gradual ramp-up: 1 → 10 → 50 → 100 users
- Duration: 12 minutes total (2m ramp + 8m steady + 2m ramp down)
- Target: <200ms P95 response time, <0.1% error rate

**Usage**:
```bash
k6 run tests/performance/loadTest.js --env SCENARIO=default --env TARGET_VUS=100
```

### 2. Concurrent Users (`concurrent`)

**Purpose**: Test system behavior with simultaneous user sessions.

**Configuration**:
- Target: 100 concurrent users (configurable)
- Operations: Session creation, message processing, status updates
- Focus: Resource contention, connection pooling, session management

**Usage**:
```bash
k6 run tests/performance/scenarios/concurrent-users.js --env TARGET_VUS=100
```

### 3. Throughput Testing (`throughput`)

**Purpose**: Measure message processing capacity.

**Configuration**:
- Target: 50 requests per second (configurable)
- Test Type: Constant arrival rate
- Metrics: Processing latency, queue depth, success rate

**Usage**:
```bash
k6 run tests/performance/scenarios/throughput.js --env TARGET_RPS=50
```

### 4. AI Response Testing (`ai-response`)

**Purpose**: Validate AI processing performance under load.

**Configuration**:
- Lower VU count (20) due to AI processing intensity
- Complex prompts and context processing
- Token usage tracking and cost analysis

**Usage**:
```bash
k6 run tests/performance/scenarios/ai-response.js --env AI_LOAD_VUS=20
```

### 5. Database & Export Testing (`database-export`)

**Purpose**: Test database query performance and export generation.

**Configuration**:
- Database query optimization testing
- Multi-format export generation (PDF, Word, Markdown, JSON)
- Large document handling

**Usage**:
```bash
k6 run tests/performance/scenarios/database-export.js --env DB_LOAD_VUS=30
```

### 6. Stress Testing (`stress-*`)

**Purpose**: Find system limits and test recovery capabilities.

**Scenarios**:
- **Spike**: Sudden load increases (10 → 200 → 10 users in 30s)
- **Endurance**: Sustained load over extended periods (30+ minutes)
- **Volume**: Large data processing capabilities
- **Breakpoint**: Find maximum system capacity

**Usage**:
```bash
k6 run tests/performance/scenarios/stress-tests.js --env STRESS_TEST_TYPE=spike
```

## Configuration

### Environment Variables

```bash
# Test Configuration
E2E_BASE_URL=http://localhost:3001          # Backend API URL
E2E_FRONTEND_URL=http://localhost:3000      # Frontend URL
ENVIRONMENT=local                           # Test environment
TARGET_VUS=50                               # Target virtual users
DURATION=5m                                 # Test duration

# Performance Targets
API_RESPONSE_TIME_TARGET=200                # P95 response time (ms)
AI_RESPONSE_TIME_TARGET=3000               # AI response time (ms)
EXPORT_TIME_TARGET=5000                    # Export generation (ms)
ERROR_RATE_TARGET=0.1                      # Error rate (%)

# Regression Analysis
BASELINE_SOURCE=local                       # Baseline data source
REGRESSION_THRESHOLD=0.2                   # 20% regression threshold
ALERT_WEBHOOK_URL=https://hooks.slack.com   # Alert webhook
```

### Performance Targets (SLA)

| Metric | Target | Critical Threshold |
|--------|--------|--------------------|
| API Response Time (P95) | <200ms | <400ms |
| AI Response Time (P95) | <3s | <5s |
| Export Generation (P95) | <5s | <8s |
| Error Rate | <0.1% | <0.5% |
| Uptime | 99.9% | 99.5% |
| Concurrent Users | 1000+ | 500+ |

## Test Structure

```
tests/performance/
├── loadTest.js                 # Main load test entry point
├── config.js                   # Configuration and utilities
├── scenarios/                  # Individual test scenarios
│   ├── concurrent-users.js     # Concurrent user testing
│   ├── throughput.js           # Throughput testing
│   ├── ai-response.js          # AI performance testing
│   ├── database-export.js      # Database and export testing
│   └── stress-tests.js         # Stress testing scenarios
├── utils/                      # Utilities and helpers
│   ├── regression-detector.js  # Performance regression analysis
│   └── reporter.js             # Advanced reporting utilities
├── scripts/                    # Test execution scripts
│   └── run-all-tests.sh        # Main test runner script
└── README.md                   # This documentation
```

## Metrics & Monitoring

### Core Metrics

**HTTP Performance**:
- Response time percentiles (P50, P95, P99)
- Request rate (RPS)
- Error rate and types
- Connection metrics

**Business Metrics**:
- Sessions created per test
- Sections completed
- PRDs generated
- Exports completed

**AI Metrics**:
- AI response times
- Token usage (input/output)
- AI success rate
- Cost per request

**System Metrics**:
- Memory usage
- CPU utilization
- Database connections
- Concurrent sessions

### Custom Dashboards

The test suite generates multiple report formats:

1. **HTML Dashboard**: Interactive performance report
2. **JSON Data**: Machine-readable metrics
3. **CSV Export**: Spreadsheet-compatible data
4. **Executive Summary**: Business-focused Markdown report

## Regression Analysis

### Automatic Regression Detection

The test suite includes automated regression detection that:

- Compares current results against historical baselines
- Identifies performance degradations >20% (configurable)
- Generates actionable recommendations
- Sends alerts for critical regressions

### Baseline Management

```bash
# Update performance baseline (run after verified good performance)
./scripts/run-all-tests.sh --update-baseline

# Compare against specific baseline
./scripts/run-all-tests.sh --baseline-date 2024-01-15

# Use custom baseline source
./scripts/run-all-tests.sh --baseline-source s3
```

## CI/CD Integration

### GitHub Actions

The test suite integrates with GitHub Actions for automated testing:

```yaml
# Trigger performance tests
on:
  push:
    branches: [ main, develop ]
  schedule:
    - cron: '0 3 * * *'  # Nightly at 3 AM
  workflow_dispatch:     # Manual trigger
```

**Features**:
- Multi-scenario matrix testing
- Environment-specific configurations
- Automatic baseline updates
- Slack/webhook notifications
- Performance trend tracking

### Manual CI/CD Integration

```bash
# Jenkins Pipeline Example
pipeline {
    stage('Performance Tests') {
        steps {
            sh './tests/performance/scripts/run-all-tests.sh -s all -p'
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'test-results/performance',
                reportFiles: 'consolidated-report.html',
                reportName: 'Performance Test Report'
            ])
        }
    }
}
```

## Troubleshooting

### Common Issues

1. **k6 Installation Problems**
   ```bash
   # macOS with Homebrew
   brew install k6
   
   # Windows with Chocolatey
   choco install k6
   
   # Docker alternative
   docker run --rm -i grafana/k6:latest run - <tests/performance/loadTest.js
   ```

2. **Service Connection Issues**
   ```bash
   # Verify services are running
   curl http://localhost:3001/api/health
   curl http://localhost:3000
   
   # Check logs
   npm run logs
   ```

3. **Test Failures**
   ```bash
   # Run with debug output
   k6 run --verbose tests/performance/loadTest.js
   
   # Check specific error logs
   tail -f test-results/performance/error.log
   ```

4. **Memory Issues with Large Tests**
   ```bash
   # Reduce VUs or duration
   ./scripts/run-all-tests.sh -v 25 -d 2m
   
   # Run scenarios individually
   ./scripts/run-all-tests.sh -s load
   ```

### Performance Debugging

1. **Slow Response Times**
   - Check database query performance
   - Review API endpoint optimization
   - Analyze network latency
   - Monitor resource utilization

2. **High Error Rates**
   - Review application logs
   - Check database connection limits
   - Validate input data quality
   - Monitor memory usage

3. **AI Performance Issues**
   - Check AI service availability
   - Monitor token usage limits
   - Review prompt complexity
   - Validate concurrent request limits

## Best Practices

### Test Design

1. **Realistic Load Patterns**
   - Use gradual ramp-up for load tests
   - Include realistic think times
   - Vary request patterns and data

2. **Resource Management**
   - Monitor system resources during tests
   - Clean up test data between runs
   - Use connection pooling appropriately

3. **Data Management**
   - Use representative test data
   - Clean up generated test sessions
   - Rotate test user accounts

### Monitoring & Analysis

1. **Baseline Management**
   - Update baselines after verified improvements
   - Maintain separate baselines per environment
   - Document baseline changes

2. **Trend Analysis**
   - Track performance metrics over time
   - Identify gradual performance degradation
   - Correlate performance with code changes

3. **Alert Configuration**
   - Set appropriate alert thresholds
   - Avoid alert fatigue with smart filtering
   - Include actionable information in alerts

## Advanced Usage

### Custom Test Scenarios

Create custom test scenarios:

```javascript
// tests/performance/scenarios/custom-test.js
import { CONFIG, getEnvironmentConfig } from '../config.js';

export const options = {
  scenarios: {
    custom_scenario: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '5m', target: 20 },
        { duration: '2m', target: 0 }
      ]
    }
  }
};

export default function() {
  // Custom test logic
}
```

### Integration with Monitoring Systems

```javascript
// Send metrics to external monitoring
export function handleSummary(data) {
  return {
    'stdout': generateConsoleReport(data),
    'datadog': sendToDataDog(data),
    'newrelic': sendToNewRelic(data)
  };
}
```

### Performance Budgets

Set performance budgets in your CI/CD:

```yaml
# performance-budget.yml
budgets:
  response_time_p95: 200ms
  error_rate: 0.1%
  ai_response_time: 3s
  export_generation: 5s
```

## Contributing

### Adding New Test Scenarios

1. Create test file in `scenarios/` directory
2. Follow existing naming conventions
3. Include proper error handling and cleanup
4. Add configuration options to `config.js`
5. Update documentation

### Improving Regression Detection

1. Enhance statistical analysis methods
2. Add new baseline storage options
3. Improve alert logic and notifications
4. Add trend analysis capabilities

### Extending Reporting

1. Add new report formats
2. Enhance HTML dashboard features
3. Integrate with monitoring systems
4. Improve executive summaries

---

**Support**: For questions or issues with the performance test suite, check the troubleshooting section or open an issue with detailed error information.

**Last Updated**: 2024-07-24  
**k6 Version**: 0.47.0+  
**Node.js Version**: 18+