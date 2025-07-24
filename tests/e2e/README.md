# E2E Test Suite

This directory contains end-to-end tests for the PRD Generator application using Playwright. The tests validate the complete user journey from creating a session to exporting the final PRD document.

## Overview

The E2E test suite covers:

- **Complete workflow testing**: Full PRD generation from start to finish
- **Session management**: Creating, resuming, and managing sessions
- **Section navigation**: Moving between different PRD sections
- **Response editing**: Modifying and updating previous responses
- **Document export**: Generating and downloading PRD documents
- **Edge cases**: Network interruptions, validation errors, timeouts
- **Performance testing**: Load testing and response time monitoring
- **Accessibility testing**: WCAG compliance validation

## Test Structure

```
tests/e2e/
├── fullWorkflow.test.js     # Main test scenarios
├── pages/                   # Page Object Models
│   ├── ChatPage.js         # Chat interface interactions
│   ├── ProgressPage.js     # Progress tracker interactions
│   └── PreviewPage.js      # Document preview and export
├── utils/                   # Test utilities
│   ├── TestDataManager.js  # Test data fixtures and management
│   └── APIHelper.js        # Direct API interactions
├── setup/                   # Global setup and teardown
│   ├── global-setup.js     # Pre-test initialization
│   └── global-teardown.js  # Post-test cleanup
└── README.md               # This file
```

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Docker (optional, for services)

### Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Set up test database
npm run db:migrate
```

### Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run in debug mode
npm run test:e2e:debug

# Run specific browser
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit

# Run mobile tests
npm run test:e2e:mobile

# Run with visible browser (non-headless)
npm run test:e2e:headed
```

### Environment Variables

```bash
# Test configuration
E2E_BASE_URL=http://localhost:3000    # Frontend URL
E2E_API_URL=http://localhost:3001     # Backend API URL
E2E_HEADLESS=true                     # Run headless browsers
E2E_RETRIES=2                         # Test retry count
E2E_PARALLEL=1                        # Parallel execution count
E2E_SLOW_MO=0                         # Slow motion delay (ms)
E2E_VIDEO=false                       # Record videos
E2E_SCREENSHOTS=true                  # Take screenshots on failure

# Database
TEST_DATABASE_URL=postgresql://test:test@localhost:5432/prd_generator_test

# Performance tracking
PERFORMANCE_TRACKING=true             # Enable performance metrics
UPDATE_SNAPSHOTS=false                # Update visual snapshots
```

## Test Scenarios

### 1. Complete PRD Generation

Tests the full happy path workflow:

1. Create new session
2. Complete all 7 sections (Introduction → Open Questions)
3. Verify section validation and quality scoring
4. Generate final PRD document
5. Export as Markdown/PDF/Word

**Key validations:**
- All sections marked as completed
- Quality scores above threshold (70+)
- Generated document contains all expected content
- Export functionality works correctly

### 2. Session Resume

Tests session persistence and recovery:

1. Create session and complete first 3 sections
2. Simulate browser refresh/reconnection
3. Resume session and verify progress maintained
4. Continue with remaining sections

**Key validations:**
- Session state persists across browser sessions
- Progress indicators show correct completion status
- Previous responses are preserved
- Current section is correctly identified

### 3. Section Navigation

Tests moving between different PRD sections:

1. Complete introduction section
2. Navigate back to previous sections
3. Navigate forward to next sections
4. Verify disabled state for incomplete sections

**Key validations:**
- Section navigation works correctly
- Previous responses remain visible
- Incomplete sections are properly disabled
- Active section is visually indicated

### 4. Response Editing

Tests modifying previous responses:

1. Complete a section with initial responses
2. Navigate back to edit responses
3. Update responses and verify validation
4. Check impact on downstream sections

**Key validations:**
- Response editing interface works
- Validation runs on updated responses
- Quality scores recalculate correctly
- Dependent sections flagged for review if needed

### 5. Document Export

Tests various export formats:

1. Complete full PRD generation
2. Export as Markdown, PDF, Word, JSON
3. Verify file downloads and content

**Key validations:**
- All export formats available and functional
- Downloaded files contain expected content
- File names and formats are correct
- Export preserves document structure

## Edge Cases

### Network Interruption Recovery

- Simulates network failures during API calls
- Tests automatic retry mechanisms
- Validates error message display
- Verifies recovery after network restoration

### Invalid Input Handling

- Tests empty/short responses (below quality threshold)
- Tests excessively long responses
- Tests special characters and XSS attempts
- Validates error messages and user guidance

### Session Timeout

- Simulates session expiration
- Tests session renewal process
- Validates data preservation during renewal
- Tests concurrent session access

### Large Document Handling

- Tests performance with extensive content
- Validates UI responsiveness with large datasets
- Tests export functionality with large documents
- Monitors memory usage and performance

## Page Object Models

### ChatPage

Handles interactions with the conversational interface:

```javascript
const chatPage = new ChatPage(page);

// Create new session
await chatPage.createNewSession();

// Answer questions
await chatPage.answerQuestion('Product name');
await chatPage.waitForAIResponse();

// Complete entire section
await chatPage.completeSection('introduction', sectionData);

// Edit previous responses
await chatPage.editResponse(0, 'Updated response');
```

### ProgressPage

Manages progress tracker interactions:

```javascript
const progressPage = new ProgressPage(page);

// Check section status
const status = await progressPage.getSectionStatus('introduction');

// Navigate between sections
await progressPage.clickSection('goals');

// Wait for completion
await progressPage.waitForSectionComplete('introduction');

// Get overall progress
const progress = await progressPage.getOverallProgress();
```

### PreviewPage

Handles document preview and export:

```javascript
const previewPage = new PreviewPage(page);

// Generate PRD
await previewPage.generatePRD();
await previewPage.waitForGeneration();

// Get content
const content = await previewPage.getPRDContent();

// Export documents
await previewPage.exportAsMarkdown();
await previewPage.exportAsPDF();
```

## Test Data Management

### TestDataManager

Provides comprehensive test data fixtures:

```javascript
const testData = new TestDataManager();

// Get complete session data
const sessionData = testData.getCompleteSessionData();

// Get partial data for resume tests
const partialData = testData.getPartialSessionData();

// Get large data for performance tests
const largeData = testData.getLargeSessionData();

// Get invalid data for validation tests
const invalidData = testData.getInvalidSessionData();

// Clean up test data
await testData.cleanup();
```

### APIHelper

Direct API interactions for setup and validation:

```javascript
const apiHelper = new APIHelper('http://localhost:3001');

// Create session via API
const session = await apiHelper.createSession(sessionData);

// Submit responses directly
await apiHelper.submitResponse(sessionId, 'introduction', responseData);

// Generate PRD via API
const prd = await apiHelper.generatePRD(sessionId);

// Clean up resources
await apiHelper.cleanup();
```

## Performance Monitoring

The test suite includes comprehensive performance monitoring:

### Metrics Collected

- **Test execution times**: Individual test duration
- **API response times**: Backend performance
- **Page load times**: Frontend performance
- **Memory usage**: Resource consumption
- **Core Web Vitals**: FCP, LCP, CLS metrics

### Performance Reports

After test execution, performance reports are generated:

```
test-results/performance/
├── performance-report.json    # Detailed metrics
├── performance-summary.txt    # Human-readable summary
└── core-web-vitals.json      # Web vitals data
```

### Performance Thresholds

- **API Response Time**: < 500ms for critical operations
- **Page Load Time**: < 3 seconds for initial load
- **First Contentful Paint**: < 2 seconds
- **Largest Contentful Paint**: < 4 seconds
- **Test Execution**: < 2 minutes per full workflow

## Accessibility Testing

Automated accessibility testing using axe-playwright:

```javascript
// Run accessibility scan
await injectAxe(page);
await checkA11y(page, null, {
  detailedReport: true,
  detailedReportOptions: { html: true }
});
```

### Accessibility Standards

- **WCAG 2.1 Level AA** compliance
- **Keyboard navigation** support
- **Screen reader** compatibility
- **Color contrast** validation
- **Focus management** testing

## CI/CD Integration

### GitHub Actions Workflow

The E2E tests run automatically on:

- **Pull requests** to main branches
- **Push to main/develop** branches
- **Nightly schedule** (2 AM UTC)
- **Manual dispatch** with browser/environment selection

### Test Matrix

- **Browsers**: Chromium, Firefox, WebKit
- **Platforms**: Ubuntu (Linux)
- **Node.js**: Version 18
- **Services**: PostgreSQL 14, Redis 7

### Artifacts

Test results and artifacts are uploaded:

- **Test reports** (HTML, JSON, JUnit)
- **Screenshots** on failure
- **Videos** on failure (optional)
- **Performance metrics**
- **Accessibility reports**

## Troubleshooting

### Common Issues

1. **Services not starting**
   ```bash
   # Check if ports are available
   lsof -i :3000 -i :3001
   
   # Kill existing processes
   pkill -f "node.*3000"
   pkill -f "node.*3001"
   ```

2. **Database connection errors**
   ```bash
   # Verify PostgreSQL is running
   pg_isready -h localhost -p 5432
   
   # Check test database exists
   psql -h localhost -U test -d prd_generator_test -c "SELECT 1"
   ```

3. **Browser installation issues**
   ```bash
   # Reinstall browsers
   npx playwright install --force
   
   # Install system dependencies
   npx playwright install-deps
   ```

4. **Test timeouts**
   - Increase timeout values in `playwright.config.js`
   - Check system resources and load
   - Verify network connectivity

### Debug Mode

Run tests in debug mode for step-by-step debugging:

```bash
# Debug specific test
npx playwright test --debug --grep "Complete PRD generation"

# Debug with headed browser
npx playwright test --headed --grep "Resume session"

# Generate trace files
npx playwright test --trace on
```

### Verbose Logging

Enable detailed logging:

```bash
# Enable all debug logs
DEBUG=pw:* npm run test:e2e

# Enable API logs only
DEBUG=pw:api npm run test:e2e

# Custom logging in tests
console.log('Test checkpoint:', await page.title());
```

## Contributing

### Adding New Tests

1. **Create test file** in appropriate category
2. **Use page object models** for UI interactions
3. **Include data fixtures** in TestDataManager
4. **Add cleanup logic** in global teardown
5. **Update CI/CD workflow** if needed

### Test Naming Convention

```javascript
test('Feature: specific scenario with expected outcome', async ({ page }) => {
  // Test implementation
});

test.describe('Feature Group', () => {
  test('Scenario 1: description', async ({ page }) => {});
  test('Scenario 2: description', async ({ page }) => {});
});
```

### Best Practices

- **Use descriptive test names** that explain the scenario
- **Implement proper wait strategies** (avoid hard waits)
- **Clean up test data** after each test
- **Use page object pattern** for reusability
- **Include performance assertions** where relevant
- **Test both happy and error paths**
- **Validate accessibility** in user-facing features

## Support

For questions or issues with the E2E test suite:

1. Check this README and troubleshooting section
2. Review existing test implementations for examples
3. Check GitHub Actions logs for CI/CD issues
4. Open an issue with detailed error information

---

**Last Updated**: 2024-07-24  
**Playwright Version**: 1.40.0  
**Node.js Version**: 18+