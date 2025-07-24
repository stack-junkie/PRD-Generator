/**
 * Document builder service for generating PRDs
 */

const { MarkdownFormatter } = require('../utils/MarkdownFormatter');

class DocumentBuilder {
  constructor() {
    this.formatter = new MarkdownFormatter();
    this.sectionOrder = [
      'introduction',
      'goals',
      'targetAudience',
      'userStories',
      'functionalRequirements',
      'successMetrics',
      'openQuestions'
    ];
  }

  /**
   * Build complete PRD from session data
   * @param {Object} sessionData - Complete session data with all sections
   * @returns {Object} - Built PRD document
   */
  buildPRD(sessionData) {
    if (!sessionData || !sessionData.sections) {
      throw new Error('Invalid session data provided');
    }

    const prd = {
      metadata: {
        title: sessionData.title || 'Product Requirements Document',
        createdAt: new Date().toISOString(),
        version: '1.0',
        sessionId: sessionData.id
      },
      content: {},
      markdown: '',
      wordCount: 0,
      completionScore: 0
    };

    // Build each section in order
    this.sectionOrder.forEach(sectionName => {
      if (sessionData.sections[sectionName]) {
        prd.content[sectionName] = this.formatSection(
          sectionName, 
          sessionData.sections[sectionName]
        );
      }
    });

    // Generate markdown representation
    prd.markdown = this.generateMarkdown(prd);
    
    // Calculate metrics
    prd.wordCount = this.calculateWordCount(prd.markdown);
    prd.completionScore = this.calculateCompletionScore(sessionData.sections);

    return prd;
  }

  /**
   * Format individual sections correctly
   * @param {string} sectionName - Name of the section
   * @param {Object} sectionData - Section data from session
   * @returns {Object} - Formatted section
   */
  formatSection(sectionName, sectionData) {
    const section = {
      title: this.getSectionTitle(sectionName),
      content: sectionData.responses || {},
      completionStatus: sectionData.completed || false,
      validationScore: sectionData.validationScore || 0
    };

    // Format content based on section type
    switch (sectionName) {
      case 'introduction':
        section.formatted = this.formatIntroduction(sectionData);
        break;
      case 'goals':
        section.formatted = this.formatGoals(sectionData);
        break;
      case 'targetAudience':
        section.formatted = this.formatTargetAudience(sectionData);
        break;
      case 'userStories':
        section.formatted = this.formatUserStories(sectionData);
        break;
      case 'functionalRequirements':
        section.formatted = this.formatFunctionalRequirements(sectionData);
        break;
      case 'successMetrics':
        section.formatted = this.formatSuccessMetrics(sectionData);
        break;
      case 'openQuestions':
        section.formatted = this.formatOpenQuestions(sectionData);
        break;
      default:
        section.formatted = this.formatGenericSection(sectionData);
    }

    return section;
  }

  /**
   * Generate export-ready document
   * @param {Object} prd - Built PRD object
   * @param {string} format - Export format ('markdown', 'html', 'json')
   * @returns {string} - Formatted export content
   */
  exportDocument(prd, format = 'markdown') {
    switch (format.toLowerCase()) {
      case 'markdown':
        return this.exportMarkdown(prd);
      case 'html':
        return this.exportHtml(prd);
      case 'json':
        return JSON.stringify(prd, null, 2);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Private formatting methods
  generateMarkdown(prd) {
    let markdown = `# ${prd.metadata.title}\n\n`;
    markdown += `*Created: ${new Date(prd.metadata.createdAt).toLocaleDateString()}*\n\n`;

    this.sectionOrder.forEach(sectionName => {
      if (prd.content[sectionName]) {
        const section = prd.content[sectionName];
        markdown += `## ${section.title}\n\n`;
        markdown += `${section.formatted}\n\n`;
      }
    });

    return markdown;
  }

  getSectionTitle(sectionName) {
    const titles = {
      introduction: 'Introduction & Overview',
      goals: 'Goals & Objectives',
      targetAudience: 'Target Audience',
      userStories: 'User Stories',
      functionalRequirements: 'Functional Requirements',
      successMetrics: 'Success Metrics',
      openQuestions: 'Open Questions'
    };
    return titles[sectionName] || sectionName;
  }

  formatIntroduction(sectionData) {
    const responses = sectionData.responses || {};
    let content = '';
    
    if (responses.productDescription) {
      content += `### Product Description\n${responses.productDescription}\n\n`;
    }
    
    if (responses.problemStatement) {
      content += `### Problem Statement\n${responses.problemStatement}\n\n`;
    }
    
    return content;
  }

  formatGoals(sectionData) {
    const responses = sectionData.responses || {};
    let content = '';
    
    if (responses.primaryGoals) {
      content += `### Primary Goals\n${responses.primaryGoals}\n\n`;
    }
    
    if (responses.businessObjectives) {
      content += `### Business Objectives\n${responses.businessObjectives}\n\n`;
    }
    
    return content;
  }

  formatTargetAudience(sectionData) {
    const responses = sectionData.responses || {};
    let content = '';
    
    if (responses.primaryUsers) {
      content += `### Primary Users\n${responses.primaryUsers}\n\n`;
    }
    
    if (responses.userPersonas) {
      content += `### User Personas\n${responses.userPersonas}\n\n`;
    }
    
    return content;
  }

  formatUserStories(sectionData) {
    const responses = sectionData.responses || {};
    return responses.userStories || '';
  }

  formatFunctionalRequirements(sectionData) {
    const responses = sectionData.responses || {};
    return responses.requirements || '';
  }

  formatSuccessMetrics(sectionData) {
    const responses = sectionData.responses || {};
    return responses.metrics || '';
  }

  formatOpenQuestions(sectionData) {
    const responses = sectionData.responses || {};
    return responses.questions || '';
  }

  formatGenericSection(sectionData) {
    const responses = sectionData.responses || {};
    return Object.values(responses).join('\n\n');
  }

  calculateWordCount(text) {
    if (typeof text !== 'string') return 0;
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  calculateCompletionScore(sections) {
    if (!sections) return 0;
    
    const totalSections = this.sectionOrder.length;
    const completedSections = this.sectionOrder.filter(
      sectionName => sections[sectionName]?.completed
    ).length;
    
    return Math.round((completedSections / totalSections) * 100);
  }

  exportMarkdown(prd) {
    return prd.markdown;
  }

  exportHtml(prd) {
    // Basic markdown to HTML conversion
    return prd.markdown
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }
}

module.exports = DocumentBuilder;