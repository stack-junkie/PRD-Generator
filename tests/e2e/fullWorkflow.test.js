/**
 * E2E Tests for Complete PRD Generation Workflow
 * 
 * Tests the entire user journey from creating a session to exporting the final PRD.
 * Covers main scenarios, edge cases, and recovery flows.
 */

const { test, expect } = require('@playwright/test');
const { ChatPage } = require('./pages/ChatPage');
const { ProgressPage } = require('./pages/ProgressPage');
const { PreviewPage } = require('./pages/PreviewPage');
const { TestDataManager } = require('./utils/TestDataManager');
const { APIHelper } = require('./utils/APIHelper');

// Test configuration
const TEST_CONFIG = {
  baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
  apiURL: process.env.E2E_API_URL || 'http://localhost:3001',
  timeout: {
    navigation: 30000,
    assertion: 15000,
    action: 10000
  },
  retries: 2
};

test.describe('PRD Generation - Full Workflow', () => {
  let chatPage, progressPage, previewPage, testData, apiHelper;

  test.beforeEach(async ({ page }) => {
    // Initialize page objects
    chatPage = new ChatPage(page);
    progressPage = new ProgressPage(page);
    previewPage = new PreviewPage(page);
    testData = new TestDataManager();
    apiHelper = new APIHelper(TEST_CONFIG.apiURL);

    // Set longer timeouts for E2E tests
    test.setTimeout(120000);
    
    // Navigate to application
    await page.goto(TEST_CONFIG.baseURL);
    await expect(page).toHaveTitle(/PRD Generator/);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup test data
    await testData.cleanup();
    
    // Take screenshot on failure
    if (test.info().status === 'failed') {
      await page.screenshot({ 
        path: `tests/screenshots/failure-${test.info().title}-${Date.now()}.png`,
        fullPage: true 
      });
    }
  });

  test('Complete PRD generation from start to finish', async ({ page }) => {
    // Scenario 1: Happy path - complete workflow
    const sessionData = testData.getCompleteSessionData();
    
    // Step 1: Create new session
    await chatPage.createNewSession();
    const sessionId = await chatPage.getSessionId();
    expect(sessionId).toBeTruthy();

    // Step 2: Verify progress tracker shows all sections
    await progressPage.waitForLoad();
    const sections = await progressPage.getAllSections();
    expect(sections).toHaveLength(7);
    expect(sections[0].name).toBe('Introduction');
    expect(sections[0].status).toBe('active');

    // Step 3: Complete Introduction section
    await chatPage.waitForInitialQuestion();
    await chatPage.answerQuestion(sessionData.introduction.productName);
    await chatPage.answerQuestion(sessionData.introduction.description);
    await chatPage.answerQuestion(sessionData.introduction.timeline);
    
    // Verify section completion
    await progressPage.waitForSectionComplete('introduction');
    const introSection = await progressPage.getSectionStatus('introduction');
    expect(introSection.status).toBe('completed');
    expect(introSection.quality).toBeGreaterThanOrEqual(70);

    // Step 4: Complete Goals section
    await chatPage.answerQuestion(sessionData.goals.primary);
    await chatPage.answerQuestion(sessionData.goals.secondary);
    await chatPage.answerQuestion(sessionData.goals.success);
    
    await progressPage.waitForSectionComplete('goals');

    // Step 5: Complete Target Audience section
    await chatPage.answerQuestion(sessionData.audience.primary);
    await chatPage.answerQuestion(sessionData.audience.personas);
    await chatPage.answerQuestion(sessionData.audience.painPoints);
    
    await progressPage.waitForSectionComplete('audience');

    // Step 6: Complete User Stories section
    await chatPage.answerQuestion(sessionData.userStories.stories);
    await chatPage.answerQuestion(sessionData.userStories.acceptance);
    
    await progressPage.waitForSectionComplete('userStories');

    // Step 7: Complete Functional Requirements section
    await chatPage.answerQuestion(sessionData.requirements.features);
    await chatPage.answerQuestion(sessionData.requirements.technical);
    await chatPage.answerQuestion(sessionData.requirements.constraints);
    
    await progressPage.waitForSectionComplete('requirements');

    // Step 8: Complete Success Metrics section
    await chatPage.answerQuestion(sessionData.metrics.kpis);
    await chatPage.answerQuestion(sessionData.metrics.measurement);
    
    await progressPage.waitForSectionComplete('metrics');

    // Step 9: Complete Open Questions section
    await chatPage.answerQuestion(sessionData.openQuestions.technical);
    await chatPage.answerQuestion(sessionData.openQuestions.business);
    
    await progressPage.waitForSectionComplete('openQuestions');

    // Step 10: Verify all sections completed
    const allSections = await progressPage.getAllSections();
    const completedSections = allSections.filter(s => s.status === 'completed');
    expect(completedSections).toHaveLength(7);

    // Step 11: Generate and verify PRD
    await previewPage.generatePRD();
    await previewPage.waitForGeneration();
    
    const prdContent = await previewPage.getPRDContent();
    expect(prdContent).toContain(sessionData.introduction.productName);
    expect(prdContent).toContain('## Introduction');
    expect(prdContent).toContain('## Goals');
    expect(prdContent).toContain('## Success Metrics');

    // Step 12: Export PRD
    const downloadPromise = page.waitForEvent('download');
    await previewPage.exportAsMarkdown();
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/.*\.md$/);
    
    // Verify exported content
    const exportedContent = await download.path();
    const fs = require('fs');
    const content = fs.readFileSync(exportedContent, 'utf8');
    expect(content).toContain('# Product Requirements Document');
  });

  test('Resume interrupted session', async ({ page }) => {
    // Scenario 2: Session recovery
    const partialData = testData.getPartialSessionData();
    
    // Create session and complete first 3 sections
    await chatPage.createNewSession();
    await chatPage.completeSection('introduction', partialData.introduction);
    await chatPage.completeSection('goals', partialData.goals);
    await chatPage.completeSection('audience', partialData.audience);
    
    const sessionId = await chatPage.getSessionId();
    
    // Simulate browser refresh/reconnection
    await page.reload();
    
    // Resume session
    await chatPage.resumeSession(sessionId);
    
    // Verify progress is maintained
    const completedSections = await progressPage.getCompletedSections();
    expect(completedSections).toHaveLength(3);
    expect(completedSections).toContain('introduction');
    expect(completedSections).toContain('goals');
    expect(completedSections).toContain('audience');
    
    // Verify current section is correct
    const currentSection = await progressPage.getCurrentSection();
    expect(currentSection).toBe('userStories');
    
    // Continue with remaining sections
    await chatPage.completeSection('userStories', partialData.userStories);
    await progressPage.waitForSectionComplete('userStories');
  });

  test('Navigate between sections', async ({ page }) => {
    // Scenario 3: Section navigation
    await chatPage.createNewSession();
    
    // Complete introduction
    const sessionData = testData.getCompleteSessionData();
    await chatPage.completeSection('introduction', sessionData.introduction);
    
    // Navigate to goals section (should be auto-activated)
    await progressPage.waitForSectionActive('goals');
    
    // Navigate back to introduction
    await progressPage.clickSection('introduction');
    await progressPage.waitForSectionActive('introduction');
    
    // Verify we can see previous responses
    const previousResponses = await chatPage.getSectionResponses('introduction');
    expect(previousResponses.length).toBeGreaterThan(0);
    
    // Navigate forward to goals
    await progressPage.clickSection('goals');
    await progressPage.waitForSectionActive('goals');
    
    // Try to navigate to incomplete section (should be disabled)
    const userStoriesClickable = await progressPage.isSectionClickable('userStories');
    expect(userStoriesClickable).toBe(false);
  });

  test('Edit and update responses', async ({ page }) => {
    // Scenario 4: Response editing
    const sessionData = testData.getCompleteSessionData();
    
    await chatPage.createNewSession();
    await chatPage.completeSection('introduction', sessionData.introduction);
    
    // Navigate back to introduction
    await progressPage.clickSection('introduction');
    
    // Edit a previous response
    const originalResponse = sessionData.introduction.productName;
    const updatedResponse = 'Updated Product Name';
    
    await chatPage.editResponse(0, updatedResponse);
    await chatPage.waitForValidation();
    
    // Verify response was updated
    const updatedResponses = await chatPage.getSectionResponses('introduction');
    expect(updatedResponses[0]).toContain(updatedResponse);
    
    // Verify section quality recalculated
    const sectionQuality = await progressPage.getSectionQuality('introduction');
    expect(sectionQuality).toBeGreaterThanOrEqual(0);
    
    // Verify downstream sections are invalidated if needed
    const goalsStatus = await progressPage.getSectionStatus('goals');
    if (goalsStatus.status === 'completed') {
      // Should trigger re-validation
      expect(goalsStatus.needsReview).toBe(true);
    }
  });

  test('Export final document', async ({ page }) => {
    // Scenario 5: Document export
    await chatPage.createNewSession();
    const sessionData = testData.getCompleteSessionData();
    
    // Complete all sections quickly
    await chatPage.completeAllSections(sessionData);
    
    // Test different export formats
    await previewPage.generatePRD();
    await previewPage.waitForGeneration();
    
    // Export as Markdown
    const markdownDownload = page.waitForEvent('download');
    await previewPage.exportAsMarkdown();
    const mdFile = await markdownDownload;
    expect(mdFile.suggestedFilename()).toMatch(/.*\.md$/);
    
    // Export as PDF (if implemented)
    if (await previewPage.isPDFExportAvailable()) {
      const pdfDownload = page.waitForEvent('download');
      await previewPage.exportAsPDF();
      const pdfFile = await pdfDownload;
      expect(pdfFile.suggestedFilename()).toMatch(/.*\.pdf$/);
    }
    
    // Export as Word (if implemented)
    if (await previewPage.isWordExportAvailable()) {
      const wordDownload = page.waitForEvent('download');
      await previewPage.exportAsWord();
      const docFile = await wordDownload;
      expect(docFile.suggestedFilename()).toMatch(/.*\.docx$/);
    }
  });
});

test.describe('PRD Generation - Edge Cases', () => {
  let chatPage, progressPage, testData, apiHelper;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page);
    progressPage = new ProgressPage(page);
    testData = new TestDataManager();
    apiHelper = new APIHelper(TEST_CONFIG.apiURL);
    
    await page.goto(TEST_CONFIG.baseURL);
  });

  test('Network interruption recovery', async ({ page }) => {
    // Scenario 6: Network resilience
    await chatPage.createNewSession();
    
    // Start answering questions
    await chatPage.answerQuestion('Test Product');
    
    // Simulate network interruption
    await page.setOfflineMode(true);
    
    // Try to submit response (should queue or show error)
    await chatPage.answerQuestion('This should fail');
    
    // Verify error handling
    const errorMessage = await chatPage.getErrorMessage();
    expect(errorMessage).toContain('connection');
    
    // Restore network
    await page.setOfflineMode(false);
    
    // Verify automatic retry or manual retry works
    await chatPage.retryFailedSubmission();
    
    // Continue normal flow
    await chatPage.answerQuestion('Description after recovery');
    await chatPage.waitForValidation();
  });

  test('Invalid input handling', async ({ page }) => {
    // Scenario 7: Input validation
    await chatPage.createNewSession();
    
    // Test empty responses
    await chatPage.answerQuestion('');
    const emptyError = await chatPage.getValidationError();
    expect(emptyError).toContain('required');
    
    // Test overly short responses (below quality threshold)
    await chatPage.answerQuestion('No');
    const shortError = await chatPage.getValidationError();
    expect(shortError).toContain('detail');
    
    // Test extremely long responses
    const longText = 'Lorem ipsum '.repeat(1000);
    await chatPage.answerQuestion(longText);
    const lengthError = await chatPage.getValidationError();
    expect(lengthError).toContain('length');
    
    // Test invalid characters or XSS attempts
    await chatPage.answerQuestion('<script>alert("xss")</script>');
    const xssError = await chatPage.getValidationError();
    expect(xssError).toContain('invalid');
  });

  test('Session timeout behavior', async ({ page }) => {
    // Scenario 8: Session management
    await chatPage.createNewSession();
    const sessionId = await chatPage.getSessionId();
    
    // Complete some work
    await chatPage.answerQuestion('Test Product');
    
    // Simulate session timeout by waiting or manipulating session
    await apiHelper.expireSession(sessionId);
    
    // Try to continue (should detect expired session)
    await chatPage.answerQuestion('This should trigger re-auth');
    
    // Verify session renewal or re-authentication
    const renewalPrompt = await chatPage.getSessionRenewalPrompt();
    expect(renewalPrompt).toBeTruthy();
    
    // Renew session and continue
    await chatPage.renewSession();
    await chatPage.answerQuestion('Continuing after renewal');
  });

  test('Concurrent session editing', async ({ browser }) => {
    // Scenario 9: Multi-tab/concurrent access
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    const chatPage1 = new ChatPage(page1);
    const chatPage2 = new ChatPage(page2);
    
    // Create session in first tab
    await page1.goto(TEST_CONFIG.baseURL);
    await chatPage1.createNewSession();
    const sessionId = await chatPage1.getSessionId();
    
    // Access same session in second tab
    await page2.goto(TEST_CONFIG.baseURL);
    await chatPage2.resumeSession(sessionId);
    
    // Make changes in both tabs
    await chatPage1.answerQuestion('Response from tab 1');
    await chatPage2.answerQuestion('Response from tab 2');
    
    // Verify conflict resolution
    const conflictWarning = await chatPage2.getConflictWarning();
    expect(conflictWarning).toBeTruthy();
    
    // Resolve conflict
    await chatPage2.resolveConflict('keep-latest');
    
    await context1.close();
    await context2.close();
  });

  test('Large document handling', async ({ page }) => {
    // Scenario 10: Performance with large content
    const largeData = testData.getLargeSessionData();
    
    await chatPage.createNewSession();
    
    // Complete all sections with extensive content
    for (const section of Object.keys(largeData)) {
      await chatPage.completeSection(section, largeData[section]);
      
      // Verify UI remains responsive
      const responseTime = await page.evaluate(() => performance.now());
      expect(responseTime).toBeLessThan(5000); // 5 second threshold
    }
    
    // Generate large PRD
    await previewPage.generatePRD();
    
    // Measure performance
    const generationStartTime = Date.now();
    await previewPage.waitForGeneration();
    const generationTime = Date.now() - generationStartTime;
    
    expect(generationTime).toBeLessThan(30000); // 30 second threshold
    
    // Verify large document export
    const downloadPromise = page.waitForEvent('download');
    await previewPage.exportAsMarkdown();
    const download = await downloadPromise;
    
    const filePath = await download.path();
    const fs = require('fs');
    const stats = fs.statSync(filePath);
    expect(stats.size).toBeGreaterThan(10000); // At least 10KB
  });
});

test.describe('PRD Generation - Accessibility & Performance', () => {
  test('Accessibility compliance', async ({ page }) => {
    await page.goto(TEST_CONFIG.baseURL);
    
    // Run axe accessibility tests
    const { injectAxe, checkA11y } = require('axe-playwright');
    
    await injectAxe(page);
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true }
    });
  });

  test('Performance metrics', async ({ page }) => {
    await page.goto(TEST_CONFIG.baseURL);
    
    // Measure Core Web Vitals
    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const metrics = {};
          
          entries.forEach((entry) => {
            if (entry.name === 'first-contentful-paint') {
              metrics.FCP = entry.startTime;
            }
            if (entry.name === 'largest-contentful-paint') {
              metrics.LCP = entry.startTime;
            }
          });
          
          resolve(metrics);
        }).observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
        
        setTimeout(() => resolve({}), 5000);
      });
    });
    
    if (metrics.FCP) expect(metrics.FCP).toBeLessThan(2000);
    if (metrics.LCP) expect(metrics.LCP).toBeLessThan(4000);
  });
});