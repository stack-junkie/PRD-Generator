/**
 * Page Object Model for Progress Tracker
 * Handles interactions with the PRD section progress tracking interface
 */

class ProgressPage {
  constructor(page) {
    this.page = page;
    
    // Selectors
    this.selectors = {
      progressTracker: '[data-testid="progress-tracker"]',
      section: '[data-testid="progress-section"]',
      sectionName: '[data-testid="section-name"]',
      sectionStatus: '[data-testid="section-status"]',
      sectionQuality: '[data-testid="section-quality"]',
      qualityScore: '[data-testid="quality-score"]',
      completionIndicator: '[data-testid="completion-indicator"]',
      activeIndicator: '[data-testid="active-indicator"]',
      sectionButton: '[data-testid="section-button"]',
      overallProgress: '[data-testid="overall-progress"]',
      progressBar: '[data-testid="progress-bar"]',
      progressPercentage: '[data-testid="progress-percentage"]'
    };
  }

  /**
   * Wait for progress tracker to load
   */
  async waitForLoad() {
    await this.page.waitForSelector(this.selectors.progressTracker, { 
      state: 'visible',
      timeout: 10000 
    });
    
    // Wait for all sections to be rendered
    await this.page.waitForFunction(() => {
      const sections = document.querySelectorAll('[data-testid="progress-section"]');
      return sections.length === 7; // Expected number of PRD sections
    }, { timeout: 15000 });
  }

  /**
   * Get all sections with their current status
   */
  async getAllSections() {
    await this.waitForLoad();
    
    const sections = await this.page.$$eval(this.selectors.section, elements => {
      return elements.map(el => {
        const nameEl = el.querySelector('[data-testid="section-name"]');
        const statusEl = el.querySelector('[data-testid="section-status"]');
        const qualityEl = el.querySelector('[data-testid="quality-score"]');
        
        return {
          name: nameEl ? nameEl.textContent.trim() : '',
          status: statusEl ? statusEl.getAttribute('data-status') : 'pending',
          quality: qualityEl ? parseInt(qualityEl.textContent) : 0,
          element: el
        };
      });
    });
    
    return sections;
  }

  /**
   * Get status of a specific section
   */
  async getSectionStatus(sectionName) {
    const sectionSelector = `${this.selectors.section}[data-section="${sectionName}"]`;
    
    await this.page.waitForSelector(sectionSelector, { timeout: 10000 });
    
    const sectionInfo = await this.page.$eval(sectionSelector, el => {
      const statusEl = el.querySelector('[data-testid="section-status"]');
      const qualityEl = el.querySelector('[data-testid="quality-score"]');
      const needsReviewEl = el.querySelector('[data-testid="needs-review"]');
      
      return {
        status: statusEl ? statusEl.getAttribute('data-status') : 'pending',
        quality: qualityEl ? parseInt(qualityEl.textContent) : 0,
        needsReview: needsReviewEl ? needsReviewEl.style.display !== 'none' : false
      };
    });
    
    return sectionInfo;
  }

  /**
   * Get quality score for a specific section
   */
  async getSectionQuality(sectionName) {
    const sectionSelector = `${this.selectors.section}[data-section="${sectionName}"] ${this.selectors.qualityScore}`;
    
    try {
      const qualityElement = await this.page.waitForSelector(sectionSelector, { 
        timeout: 5000 
      });
      const qualityText = await qualityElement.textContent();
      return parseInt(qualityText);
    } catch (e) {
      return 0;
    }
  }

  /**
   * Wait for a section to be marked as completed
   */
  async waitForSectionComplete(sectionName) {
    const sectionSelector = `${this.selectors.section}[data-section="${sectionName}"]`;
    
    await this.page.waitForFunction((selector) => {
      const sectionEl = document.querySelector(selector);
      if (!sectionEl) return false;
      
      const statusEl = sectionEl.querySelector('[data-testid="section-status"]');
      return statusEl && statusEl.getAttribute('data-status') === 'completed';
    }, sectionSelector, { timeout: 30000 });
  }

  /**
   * Wait for a section to become active
   */
  async waitForSectionActive(sectionName) {
    const sectionSelector = `${this.selectors.section}[data-section="${sectionName}"]`;
    
    await this.page.waitForFunction((selector) => {
      const sectionEl = document.querySelector(selector);
      if (!sectionEl) return false;
      
      const statusEl = sectionEl.querySelector('[data-testid="section-status"]');
      return statusEl && statusEl.getAttribute('data-status') === 'active';
    }, sectionSelector, { timeout: 15000 });
  }

  /**
   * Click on a specific section to navigate to it
   */
  async clickSection(sectionName) {
    const sectionSelector = `${this.selectors.section}[data-section="${sectionName}"] ${this.selectors.sectionButton}`;
    
    await this.page.waitForSelector(sectionSelector, { timeout: 10000 });
    await this.page.click(sectionSelector);
    
    // Wait for navigation to complete
    await this.waitForSectionActive(sectionName);
  }

  /**
   * Check if a section is clickable (not disabled)
   */
  async isSectionClickable(sectionName) {
    const sectionSelector = `${this.selectors.section}[data-section="${sectionName}"] ${this.selectors.sectionButton}`;
    
    try {
      const buttonElement = await this.page.waitForSelector(sectionSelector, { 
        timeout: 5000 
      });
      
      const isDisabled = await buttonElement.evaluate(el => {
        return el.disabled || el.classList.contains('disabled') || 
               el.getAttribute('aria-disabled') === 'true';
      });
      
      return !isDisabled;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get the currently active section
   */
  async getCurrentSection() {
    const activeSection = await this.page.$eval(
      `${this.selectors.section}[data-status="active"]`,
      el => el.getAttribute('data-section')
    );
    
    return activeSection;
  }

  /**
   * Get all completed sections
   */
  async getCompletedSections() {
    const completedSections = await this.page.$$eval(
      `${this.selectors.section}[data-status="completed"]`,
      elements => elements.map(el => el.getAttribute('data-section'))
    );
    
    return completedSections;
  }

  /**
   * Get overall progress percentage
   */
  async getOverallProgress() {
    try {
      const progressElement = await this.page.waitForSelector(this.selectors.progressPercentage, { 
        timeout: 5000 
      });
      const progressText = await progressElement.textContent();
      return parseInt(progressText.replace('%', ''));
    } catch (e) {
      // Calculate from completed sections if no explicit progress indicator
      const allSections = await this.getAllSections();
      const completedCount = allSections.filter(s => s.status === 'completed').length;
      return Math.round((completedCount / allSections.length) * 100);
    }
  }

  /**
   * Get progress bar fill percentage
   */
  async getProgressBarFill() {
    try {
      const progressBar = await this.page.waitForSelector(this.selectors.progressBar, { 
        timeout: 5000 
      });
      
      const fillPercentage = await progressBar.evaluate(el => {
        const style = getComputedStyle(el);
        const width = style.width;
        const parentWidth = getComputedStyle(el.parentElement).width;
        
        return Math.round((parseInt(width) / parseInt(parentWidth)) * 100);
      });
      
      return fillPercentage;
    } catch (e) {
      return await this.getOverallProgress();
    }
  }

  /**
   * Check if all sections are completed
   */
  async areAllSectionsCompleted() {
    const allSections = await this.getAllSections();
    return allSections.every(section => section.status === 'completed');
  }

  /**
   * Get sections that need review
   */
  async getSectionsNeedingReview() {
    const sectionsNeedingReview = await this.page.$$eval(
      `${this.selectors.section}[data-needs-review="true"]`,
      elements => elements.map(el => ({
        name: el.getAttribute('data-section'),
        reason: el.querySelector('[data-testid="review-reason"]')?.textContent || 'Unknown'
      }))
    );
    
    return sectionsNeedingReview;
  }

  /**
   * Get minimum quality score across all sections
   */
  async getMinimumQualityScore() {
    const allSections = await this.getAllSections();
    const qualityScores = allSections
      .filter(s => s.status === 'completed')
      .map(s => s.quality);
    
    return qualityScores.length > 0 ? Math.min(...qualityScores) : 0;
  }

  /**
   * Get average quality score across all sections
   */
  async getAverageQualityScore() {
    const allSections = await this.getAllSections();
    const qualityScores = allSections
      .filter(s => s.status === 'completed')
      .map(s => s.quality);
    
    if (qualityScores.length === 0) return 0;
    
    const sum = qualityScores.reduce((acc, score) => acc + score, 0);
    return Math.round(sum / qualityScores.length);
  }

  /**
   * Check if progress tracker shows any errors
   */
  async getProgressErrors() {
    const errors = await this.page.$$eval(
      '[data-testid="progress-error"]',
      elements => elements.map(el => ({
        section: el.getAttribute('data-section'),
        message: el.textContent.trim()
      }))
    );
    
    return errors;
  }

  /**
   * Reset progress for a specific section
   */
  async resetSection(sectionName) {
    const resetButton = `${this.selectors.section}[data-section="${sectionName}"] [data-testid="reset-section"]`;
    
    await this.page.click(resetButton);
    await this.page.click('[data-testid="confirm-reset"]');
    
    // Wait for section to be reset
    await this.page.waitForFunction((section) => {
      const sectionEl = document.querySelector(`[data-section="${section}"]`);
      if (!sectionEl) return false;
      
      const statusEl = sectionEl.querySelector('[data-testid="section-status"]');
      return statusEl && statusEl.getAttribute('data-status') === 'pending';
    }, sectionName, { timeout: 10000 });
  }

  /**
   * Export progress report
   */
  async exportProgressReport() {
    const downloadPromise = this.page.waitForEvent('download');
    await this.page.click('[data-testid="export-progress"]');
    return await downloadPromise;
  }
}

module.exports = { ProgressPage };