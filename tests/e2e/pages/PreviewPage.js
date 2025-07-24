/**
 * Page Object Model for PRD Preview and Export
 * Handles interactions with the document preview and export functionality
 */

class PreviewPage {
  constructor(page) {
    this.page = page;
    
    // Selectors
    this.selectors = {
      previewPanel: '[data-testid="preview-panel"]',
      previewContent: '[data-testid="preview-content"]',
      generateButton: '[data-testid="generate-prd"]',
      generationStatus: '[data-testid="generation-status"]',
      generationSpinner: '[data-testid="generation-spinner"]',
      exportDropdown: '[data-testid="export-dropdown"]',
      exportMarkdown: '[data-testid="export-markdown"]',
      exportPDF: '[data-testid="export-pdf"]',
      exportWord: '[data-testid="export-word"]',
      exportJSON: '[data-testid="export-json"]',
      previewTabs: '[data-testid="preview-tabs"]',
      rawTab: '[data-testid="raw-tab"]',
      formattedTab: '[data-testid="formatted-tab"]',
      editButton: '[data-testid="edit-preview"]',
      saveButton: '[data-testid="save-preview"]',
      cancelButton: '[data-testid="cancel-edit"]',
      previewEditor: '[data-testid="preview-editor"]',
      sectionHeaders: '[data-testid="section-header"]',
      tableOfContents: '[data-testid="table-of-contents"]',
      wordCount: '[data-testid="word-count"]',
      lastGenerated: '[data-testid="last-generated"]',
      regenerateButton: '[data-testid="regenerate-prd"]'
    };
  }

  /**
   * Wait for preview panel to load
   */
  async waitForLoad() {
    await this.page.waitForSelector(this.selectors.previewPanel, { 
      state: 'visible',
      timeout: 10000 
    });
  }

  /**
   * Generate PRD from current session data
   */
  async generatePRD() {
    await this.page.click(this.selectors.generateButton);
    
    // Wait for generation to start
    await this.page.waitForSelector(this.selectors.generationSpinner, { 
      state: 'visible',
      timeout: 5000 
    });
  }

  /**
   * Wait for PRD generation to complete
   */
  async waitForGeneration() {
    // Wait for spinner to disappear
    await this.page.waitForSelector(this.selectors.generationSpinner, { 
      state: 'hidden',
      timeout: 60000 
    });
    
    // Wait for content to be populated
    await this.page.waitForFunction(() => {
      const content = document.querySelector('[data-testid="preview-content"]');
      return content && content.textContent.trim().length > 100;
    }, { timeout: 30000 });
  }

  /**
   * Get the generated PRD content
   */
  async getPRDContent() {
    await this.page.waitForSelector(this.selectors.previewContent, { 
      state: 'visible',
      timeout: 10000 
    });
    
    const content = await this.page.$eval(
      this.selectors.previewContent,
      el => el.textContent || el.innerHTML
    );
    
    return content.trim();
  }

  /**
   * Get the raw markdown content
   */
  async getRawMarkdown() {
    // Switch to raw tab if available
    try {
      await this.page.click(this.selectors.rawTab);
      await this.page.waitForTimeout(1000);
    } catch (e) {
      // Raw tab might not be available
    }
    
    const rawContent = await this.page.$eval(
      this.selectors.previewContent,
      el => {
        // Try to get markdown from data attribute or textarea
        return el.getAttribute('data-markdown') || 
               el.querySelector('textarea')?.value ||
               el.textContent;
      }
    );
    
    return rawContent;
  }

  /**
   * Export PRD as Markdown
   */
  async exportAsMarkdown() {
    await this.page.click(this.selectors.exportDropdown);
    await this.page.click(this.selectors.exportMarkdown);
  }

  /**
   * Export PRD as PDF
   */
  async exportAsPDF() {
    await this.page.click(this.selectors.exportDropdown);
    await this.page.click(this.selectors.exportPDF);
  }

  /**
   * Export PRD as Word document
   */
  async exportAsWord() {
    await this.page.click(this.selectors.exportDropdown);
    await this.page.click(this.selectors.exportWord);
  }

  /**
   * Export PRD as JSON
   */
  async exportAsJSON() {
    await this.page.click(this.selectors.exportDropdown);
    await this.page.click(this.selectors.exportJSON);
  }

  /**
   * Check if PDF export is available
   */
  async isPDFExportAvailable() {
    try {
      await this.page.click(this.selectors.exportDropdown);
      const pdfOption = await this.page.$(this.selectors.exportPDF);
      
      // Close dropdown
      await this.page.click(this.selectors.exportDropdown);
      
      return pdfOption !== null;
    } catch (e) {
      return false;
    }
  }

  /**
   * Check if Word export is available
   */
  async isWordExportAvailable() {
    try {
      await this.page.click(this.selectors.exportDropdown);
      const wordOption = await this.page.$(this.selectors.exportWord);
      
      // Close dropdown
      await this.page.click(this.selectors.exportDropdown);
      
      return wordOption !== null;
    } catch (e) {
      return false;
    }
  }

  /**
   * Edit preview content directly
   */
  async editPreview(newContent) {
    await this.page.click(this.selectors.editButton);
    
    // Wait for editor to appear
    const editor = await this.page.waitForSelector(this.selectors.previewEditor, { 
      timeout: 5000 
    });
    
    // Clear and enter new content
    await editor.fill(newContent);
    
    // Save changes
    await this.page.click(this.selectors.saveButton);
    
    // Wait for save to complete
    await this.page.waitForSelector(this.selectors.previewEditor, { 
      state: 'hidden',
      timeout: 5000 
    });
  }

  /**
   * Cancel preview editing
   */
  async cancelEdit() {
    await this.page.click(this.selectors.cancelButton);
    
    await this.page.waitForSelector(this.selectors.previewEditor, { 
      state: 'hidden',
      timeout: 5000 
    });
  }

  /**
   * Get all section headers from the preview
   */
  async getSectionHeaders() {
    const headers = await this.page.$$eval(
      this.selectors.sectionHeaders,
      elements => elements.map(el => ({
        level: parseInt(el.tagName.replace('H', '')),
        text: el.textContent.trim(),
        id: el.id || el.getAttribute('data-section-id')
      }))
    );
    
    return headers;
  }

  /**
   * Get table of contents
   */
  async getTableOfContents() {
    try {
      const tocElement = await this.page.waitForSelector(this.selectors.tableOfContents, { 
        timeout: 5000 
      });
      
      const tocItems = await tocElement.$$eval(
        'a, li',
        elements => elements.map(el => ({
          text: el.textContent.trim(),
          href: el.getAttribute('href'),
          level: el.getAttribute('data-level') || '1'
        }))
      );
      
      return tocItems;
    } catch (e) {
      return [];
    }
  }

  /**
   * Get word count
   */
  async getWordCount() {
    try {
      const wordCountElement = await this.page.waitForSelector(this.selectors.wordCount, { 
        timeout: 5000 
      });
      
      const wordCountText = await wordCountElement.textContent();
      const match = wordCountText.match(/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    } catch (e) {
      // Calculate word count from content
      const content = await this.getPRDContent();
      const words = content.split(/\s+/).filter(word => word.length > 0);
      return words.length;
    }
  }

  /**
   * Get last generation timestamp
   */
  async getLastGenerated() {
    try {
      const timestampElement = await this.page.waitForSelector(this.selectors.lastGenerated, { 
        timeout: 5000 
      });
      
      const timestampText = await timestampElement.textContent();
      return new Date(timestampText);
    } catch (e) {
      return null;
    }
  }

  /**
   * Regenerate PRD
   */
  async regeneratePRD() {
    await this.page.click(this.selectors.regenerateButton);
    await this.waitForGeneration();
  }

  /**
   * Check if preview has unsaved changes
   */
  async hasUnsavedChanges() {
    try {
      const indicator = await this.page.$('[data-testid="unsaved-changes"]');
      return indicator !== null;
    } catch (e) {
      return false;
    }
  }

  /**
   * Search within preview content
   */
  async searchInPreview(searchTerm) {
    // Use browser find functionality
    await this.page.keyboard.press('Control+F');
    await this.page.keyboard.type(searchTerm);
    
    // Count matches
    const matches = await this.page.evaluate((term) => {
      const content = document.querySelector('[data-testid="preview-content"]');
      if (!content) return 0;
      
      const text = content.textContent;
      const regex = new RegExp(term, 'gi');
      const matches = text.match(regex);
      return matches ? matches.length : 0;
    }, searchTerm);
    
    // Close find dialog
    await this.page.keyboard.press('Escape');
    
    return matches;
  }

  /**
   * Validate PRD structure
   */
  async validatePRDStructure() {
    const content = await this.getPRDContent();
    const headers = await this.getSectionHeaders();
    
    const requiredSections = [
      'Introduction',
      'Goals',
      'Target Audience',
      'User Stories',
      'Functional Requirements',
      'Success Metrics',
      'Open Questions'
    ];
    
    const validation = {
      hasAllSections: true,
      missingSections: [],
      hasContent: content.length > 500,
      hasHeaders: headers.length >= requiredSections.length,
      wordCount: await this.getWordCount()
    };
    
    for (const section of requiredSections) {
      const hasSection = headers.some(h => h.text.includes(section)) ||
                        content.includes(section);
      
      if (!hasSection) {
        validation.hasAllSections = false;
        validation.missingSections.push(section);
      }
    }
    
    return validation;
  }

  /**
   * Get generation status
   */
  async getGenerationStatus() {
    try {
      const statusElement = await this.page.waitForSelector(this.selectors.generationStatus, { 
        timeout: 3000 
      });
      
      return await statusElement.textContent();
    } catch (e) {
      return 'unknown';
    }
  }

  /**
   * Check if generation is in progress
   */
  async isGenerating() {
    try {
      await this.page.waitForSelector(this.selectors.generationSpinner, { 
        state: 'visible',
        timeout: 1000 
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Share PRD via link
   */
  async sharePRD() {
    const shareButton = '[data-testid="share-prd"]';
    await this.page.click(shareButton);
    
    // Wait for share link to be generated
    const shareLink = await this.page.waitForSelector('[data-testid="share-link"]', { 
      timeout: 10000 
    });
    
    return await shareLink.getAttribute('value');
  }

  /**
   * Print PRD
   */
  async printPRD() {
    const printPromise = this.page.waitForEvent('dialog');
    await this.page.click('[data-testid="print-prd"]');
    
    const dialog = await printPromise;
    await dialog.accept();
  }
}

module.exports = { PreviewPage };