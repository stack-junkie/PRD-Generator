/**
 * PRD Controller
 * Handles PRD generation, preview, and export functionality
 */

// Import dependencies
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger'); // Assuming a winston-based logger

class PRDController {
  constructor(models = null, services = null) {
    // Dependency injection for models
    this.models = models || require('../models');
    this.PRDDocument = this.models.PRDDocument;
    this.UserSession = this.models.UserSession;
    this.Section = this.models.Section;
    
    // Initialize formatter service
    const MarkdownFormatter = require('../utils/MarkdownFormatter');
    this.markdownFormatter = services?.markdownFormatter || new MarkdownFormatter();
    
    // For document export
    this.exportDir = process.env.EXPORT_DIR || path.join(process.cwd(), 'exports');
    
    // Ensure export directory exists
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
    
    // Section order for PRD
    this.sectionOrder = [
      'introduction',
      'goals',
      'audience',
      'userStories',
      'requirements',
      'metrics',
      'questions'
    ];
    
    // Section titles for display
    this.sectionTitles = {
      'introduction': 'Introduction',
      'goals': 'Goals and Objectives',
      'audience': 'Target Audience',
      'userStories': 'User Stories',
      'requirements': 'Requirements',
      'metrics': 'Success Metrics',
      'questions': 'Open Questions'
    };
  }
  
  /**
   * Generate complete PRD document from session sections
   * @param {string} sessionId - Session ID
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated PRD content
   */
  async generatePRD(sessionId, options = {}) {
    const {
      includeMetadata = true,
      formatOptions = {},
      includeDrafts = false,
      regenerate = false
    } = options;
    
    logger.info('Generating PRD', { sessionId, regenerate });
    
    try {
      // Check if PRD already exists and regeneration is not requested
      const existingPRD = await this.PRDDocument.findOne({
        where: { sessionId }
      });
      
      if (existingPRD && existingPRD.content && !regenerate) {
        return {
          content: existingPRD.content,
          metadata: includeMetadata ? existingPRD.metadata : null,
          sections: existingPRD.sections,
          generated: false,
          lastGenerated: existingPRD.updatedAt
        };
      }
      
      // Get session data
      const session = await this.UserSession.findOne({
        where: { sessionId }
      });
      
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      
      // Get all sections
      const sections = await this.Section.findAll({
        where: { sessionId },
        order: [['id', 'ASC']]
      });
      
      // Group sections by completion status
      const completedSections = sections.filter(s => s.completionStatus);
      const incompleteSections = sections.filter(s => !s.completionStatus);
      
      // Collect section content
      const sectionContent = {};
      let incompleteSectionContent = {};
      
      // Process completed sections
      for (const section of completedSections) {
        if (section.sectionContent) {
          try {
            sectionContent[section.name] = JSON.parse(section.sectionContent);
          } catch (e) {
            logger.warn(`Error parsing section content for ${section.name}`, {
              error: e.message,
              sessionId
            });
            sectionContent[section.name] = {};
          }
        } else {
          sectionContent[section.name] = {};
        }
      }
      
      // Process incomplete sections if includeDrafts is true
      if (includeDrafts) {
        for (const section of incompleteSections) {
          if (section.sectionContent) {
            try {
              incompleteSectionContent[section.name] = JSON.parse(section.sectionContent);
            } catch (e) {
              logger.warn(`Error parsing draft section content for ${section.name}`, {
                error: e.message,
                sessionId
              });
              incompleteSectionContent[section.name] = {};
            }
          } else {
            incompleteSectionContent[section.name] = {};
          }
        }
      }
      
      // Generate PRD markdown content
      const markdown = this.formatPRDContent(
        session.projectName,
        sectionContent,
        includeDrafts ? incompleteSectionContent : null,
        formatOptions
      );
      
      // Update or create PRD document
      const prdData = {
        sections: sectionContent,
        content: markdown,
        metadata: {
          lastModified: new Date(),
          includedSections: Object.keys(sectionContent),
          completionStatus: {
            total: sections.length,
            completed: completedSections.length,
            percentComplete: Math.round((completedSections.length / sections.length) * 100)
          },
          projectName: session.projectName
        }
      };
      
      let prdDocument;
      
      if (existingPRD) {
        // Update existing document
        await existingPRD.update(prdData);
        prdDocument = existingPRD;
      } else {
        // Create new document
        prdDocument = await this.PRDDocument.create({
          id: uuidv4(),
          sessionId,
          ...prdData
        });
      }
      
      // Return generated PRD
      return {
        content: markdown,
        metadata: includeMetadata ? prdDocument.metadata : null,
        sections: prdDocument.sections,
        generated: true,
        lastGenerated: new Date()
      };
    } catch (error) {
      logger.error('Error generating PRD', {
        error: error.message,
        stack: error.stack,
        sessionId
      });
      throw error;
    }
  }
  
  /**
   * Format PRD content from section data
   * @private
   * @param {string} projectName - Project name
   * @param {Object} sectionContent - Section content data
   * @param {Object} draftContent - Draft content for incomplete sections
   * @param {Object} options - Formatting options
   * @returns {string} Formatted markdown content
   */
  formatPRDContent(projectName, sectionContent, draftContent = null, options = {}) {
    const {
      includeTableOfContents = true,
      includeMetadata = true,
      dateFormat = 'YYYY-MM-DD'
    } = options;
    
    // Start with document title
    let markdown = `# Product Requirements Document: ${projectName}\n\n`;
    
    // Add metadata if requested
    if (includeMetadata) {
      markdown += `**Generated:** ${this.formatDate(new Date(), dateFormat)}\n\n`;
      markdown += `**Project:** ${projectName}\n\n`;
      markdown += `---\n\n`;
    }
    
    // Add table of contents if requested
    if (includeTableOfContents) {
      markdown += `## Table of Contents\n\n`;
      
      // Add completed sections to TOC
      this.sectionOrder.forEach(sectionId => {
        if (sectionContent[sectionId]) {
          markdown += `- [${this.sectionTitles[sectionId] || sectionId}](#${sectionId})\n`;
        }
      });
      
      // Add draft sections to TOC if provided
      if (draftContent) {
        const draftSections = Object.keys(draftContent);
        if (draftSections.length > 0) {
          markdown += `- [Draft Sections](#draft-sections)\n`;
        }
      }
      
      markdown += `\n---\n\n`;
    }
    
    // Add section content in the defined order
    this.sectionOrder.forEach(sectionId => {
      if (sectionContent[sectionId]) {
        markdown += this.formatSection(sectionId, sectionContent[sectionId]);
        markdown += `\n\n`;
      }
    });
    
    // Add draft sections if provided
    if (draftContent && Object.keys(draftContent).length > 0) {
      markdown += `## Draft Sections\n\n`;
      markdown += `*The following sections are still in progress and may not be complete.*\n\n`;
      
      this.sectionOrder.forEach(sectionId => {
        if (draftContent[sectionId]) {
          markdown += `### ${this.sectionTitles[sectionId] || sectionId} (Draft)\n\n`;
          markdown += this.formatSectionDraft(sectionId, draftContent[sectionId]);
          markdown += `\n\n`;
        }
      });
    }
    
    // Add footer
    markdown += `---\n\n`;
    markdown += `*This PRD was generated by PRD-Maker. Last updated: ${this.formatDate(new Date(), dateFormat)}*`;
    
    return markdown;
  }
  
  /**
   * Format a completed section
   * @private
   * @param {string} sectionId - Section identifier
   * @param {Object} content - Section content
   * @returns {string} Formatted section markdown
   */
  formatSection(sectionId, content) {
    let markdown = `## ${this.sectionTitles[sectionId] || sectionId} {#${sectionId}}\n\n`;
    
    // Format section based on its type
    switch (sectionId) {
      case 'introduction':
        if (content.productDescription) {
          markdown += `### Product Description\n\n${content.productDescription}\n\n`;
        }
        if (content.problemStatement) {
          markdown += `### Problem Statement\n\n${content.problemStatement}\n\n`;
        }
        if (content.targetMarket) {
          markdown += `### Target Market\n\n${content.targetMarket}\n\n`;
        }
        break;
        
      case 'goals':
        if (content.businessObjectives) {
          markdown += `### Business Objectives\n\n${content.businessObjectives}\n\n`;
        }
        if (content.successMetrics) {
          markdown += `### Success Metrics\n\n${content.successMetrics}\n\n`;
        }
        break;
        
      case 'audience':
        if (content.primaryUsers) {
          markdown += `### Primary Users\n\n${content.primaryUsers}\n\n`;
        }
        if (content.userNeeds) {
          markdown += `### User Needs and Pain Points\n\n${content.userNeeds}\n\n`;
        }
        break;
        
      case 'userStories':
        markdown += `### User Stories\n\n`;
        if (content.coreStories) {
          const stories = this.formatList(content.coreStories);
          markdown += stories;
        }
        break;
        
      case 'requirements':
        if (content.functionalReqs) {
          markdown += `### Functional Requirements\n\n${content.functionalReqs}\n\n`;
        }
        if (content.nonFunctionalReqs) {
          markdown += `### Non-Functional Requirements\n\n${content.nonFunctionalReqs}\n\n`;
        }
        break;
        
      case 'metrics':
        if (content.kpis) {
          markdown += `### Key Performance Indicators\n\n${content.kpis}\n\n`;
        }
        break;
        
      case 'questions':
        markdown += `### Open Questions\n\n`;
        if (content.openQuestions) {
          const questions = this.formatList(content.openQuestions);
          markdown += questions;
        }
        break;
        
      default:
        // Generic handling for custom sections
        Object.entries(content).forEach(([key, value]) => {
          const title = key.replace(/([A-Z])/g, ' $1').trim();
          markdown += `### ${title.charAt(0).toUpperCase() + title.slice(1)}\n\n${value}\n\n`;
        });
    }
    
    return markdown;
  }
  
  /**
   * Format a draft section
   * @private
   * @param {string} sectionId - Section identifier
   * @param {Object} content - Section content
   * @returns {string} Formatted draft markdown
   */
  formatSectionDraft(sectionId, content) {
    // Use the same formatting as complete sections but mark as draft
    let markdown = this.formatSection(sectionId, content);
    
    // Add draft indicator
    markdown += `\n*This section is still in draft form.*\n`;
    
    return markdown;
  }
  
  /**
   * Format list items from text
   * @private
   * @param {string} text - Text containing list items
   * @returns {string} Formatted markdown list
   */
  formatList(text) {
    if (!text) return '';
    
    // Check if already formatted as list
    if (text.trim().startsWith('-') || text.trim().startsWith('*')) {
      return text;
    }
    
    // Split by newlines and format as list
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => `- ${line}`)
      .join('\n');
  }
  
  /**
   * Format date in specified format
   * @private
   * @param {Date} date - Date to format
   * @param {string} format - Date format
   * @returns {string} Formatted date
   */
  formatDate(date, format) {
    // Simple date formatter (for production would use a library like date-fns)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    if (format === 'YYYY-MM-DD') {
      return `${year}-${month}-${day}`;
    } else if (format === 'MM/DD/YYYY') {
      return `${month}/${day}/${year}`;
    } else if (format === 'DD/MM/YYYY') {
      return `${day}/${month}/${year}`;
    }
    
    return date.toISOString().split('T')[0];
  }
  
  /**
   * Get real-time PRD preview
   * @param {string} sessionId - Session ID
   * @param {Object} options - Preview options
   * @returns {Promise<Object>} Preview content
   */
  async getPreview(sessionId, options = {}) {
    const {
      previewFormat = 'markdown',
      previewSection = null,
      includeDrafts = true
    } = options;
    
    logger.info('Generating preview', { 
      sessionId, 
      format: previewFormat,
      section: previewSection 
    });
    
    try {
      // Get PRD content
      const prdResult = await this.generatePRD(sessionId, {
        includeMetadata: true,
        includeDrafts,
        regenerate: true // Always regenerate for preview
      });
      
      if (!prdResult) {
        throw new Error(`Failed to generate preview for session: ${sessionId}`);
      }
      
      // If specific section requested, filter content
      if (previewSection) {
        // Simple section extraction (would be more robust in production)
        const sectionTitle = this.sectionTitles[previewSection] || previewSection;
        const sectionHeader = `## ${sectionTitle}`;
        const nextSectionIndex = prdResult.content.indexOf('##', prdResult.content.indexOf(sectionHeader) + sectionHeader.length);
        
        let sectionContent;
        if (nextSectionIndex > 0) {
          sectionContent = prdResult.content.substring(
            prdResult.content.indexOf(sectionHeader),
            nextSectionIndex
          );
        } else {
          sectionContent = prdResult.content.substring(
            prdResult.content.indexOf(sectionHeader)
          );
        }
        
        // Return section preview
        return {
          content: sectionContent,
          format: previewFormat,
          section: previewSection,
          previewedAt: new Date(),
          isDraft: !prdResult.sections[previewSection]
        };
      }
      
      // Return full preview
      return {
        content: prdResult.content,
        format: previewFormat,
        sections: Object.keys(prdResult.sections),
        previewedAt: new Date(),
        metadata: prdResult.metadata
      };
    } catch (error) {
      logger.error('Error generating preview', {
        error: error.message,
        stack: error.stack,
        sessionId
      });
      throw error;
    }
  }
  
  /**
   * Export PRD as markdown/PDF/DOCX
   * @param {string} sessionId - Session ID
   * @param {string} format - Export format (markdown, pdf, docx)
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   */
  async exportPRD(sessionId, format = 'markdown', options = {}) {
    const {
      includeDrafts = false,
      styled = true,
      fileName = null
    } = options;
    
    logger.info('Exporting PRD', { sessionId, format });
    
    try {
      // Check if session exists
      const session = await this.UserSession.findOne({
        where: { sessionId }
      });
      
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      
      // Get completed section count
      const { count } = await this.Section.findAndCountAll({
        where: {
          sessionId,
          completionStatus: true
        }
      });
      
      if (count === 0 && !includeDrafts) {
        throw new Error('No completed sections to export');
      }
      
      // Generate PRD content
      const prdResult = await this.generatePRD(sessionId, {
        includeMetadata: true,
        includeDrafts,
        regenerate: true
      });
      
      if (!prdResult) {
        throw new Error(`Failed to generate PRD for export: ${sessionId}`);
      }
      
      // Generate file name if not provided
      const timestamp = new Date().toISOString().split('T')[0];
      const defaultFileName = `${session.projectName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-prd-${timestamp}`;
      const outputFileName = fileName || defaultFileName;
      
      // Handle different export formats
      let exportResult;
      
      switch (format.toLowerCase()) {
        case 'markdown':
          exportResult = await this.handleMarkdownExport(
            prdResult.content,
            outputFileName
          );
          break;
          
        case 'pdf':
          exportResult = await this.handlePDFExport(
            prdResult.content,
            outputFileName,
            styled
          );
          break;
          
        case 'docx':
          exportResult = await this.handleDOCXExport(
            prdResult.content,
            outputFileName,
            styled
          );
          break;
          
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
      
      // Update PRD document with export info
      await this.PRDDocument.update(
        {
          exportedAt: new Date(),
          metadata: {
            ...prdResult.metadata,
            lastExported: new Date(),
            exportFormat: format
          }
        },
        {
          where: { sessionId }
        }
      );
      
      return {
        ...exportResult,
        sessionId,
        projectName: session.projectName,
        exportedAt: new Date(),
        format
      };
    } catch (error) {
      logger.error('Error exporting PRD', {
        error: error.message,
        stack: error.stack,
        sessionId,
        format
      });
      throw error;
    }
  }
  
  /**
   * Handle Markdown export
   * @private
   * @param {string} content - Markdown content
   * @param {string} fileName - Output file name
   * @returns {Promise<Object>} Export result
   */
  async handleMarkdownExport(content, fileName) {
    // Create file path
    const filePath = path.join(this.exportDir, `${fileName}.md`);
    
    // Write content to file
    fs.writeFileSync(filePath, content, 'utf8');
    
    return {
      filePath,
      fileName: `${fileName}.md`,
      contentType: 'text/markdown',
      content: content
    };
  }
  
  /**
   * Handle PDF export
   * @private
   * @param {string} content - Markdown content
   * @param {string} fileName - Output file name
   * @param {boolean} styled - Whether to apply styling
   * @returns {Promise<Object>} Export result
   */
  async handlePDFExport(content, fileName, styled) {
    // Placeholder for PDF generation
    // In a real implementation, would use markdown-pdf or other library
    
    // For now, just save the markdown and note it should be converted to PDF
    const filePath = path.join(this.exportDir, `${fileName}.md`);
    fs.writeFileSync(filePath, 
      content + '\n\n<!-- Note: This would be converted to PDF in production -->',
      'utf8'
    );
    
    return {
      filePath,
      fileName: `${fileName}.pdf`, // Return PDF name even though we're saving MD for now
      contentType: 'application/pdf',
      note: 'PDF generation is simulated in this implementation'
    };
  }
  
  /**
   * Handle DOCX export
   * @private
   * @param {string} content - Markdown content
   * @param {string} fileName - Output file name
   * @param {boolean} styled - Whether to apply styling
   * @returns {Promise<Object>} Export result
   */
  async handleDOCXExport(content, fileName, styled) {
    // Placeholder for DOCX generation
    // In a real implementation, would use docx or other library
    
    // For now, just save the markdown and note it should be converted to DOCX
    const filePath = path.join(this.exportDir, `${fileName}.md`);
    fs.writeFileSync(filePath, 
      content + '\n\n<!-- Note: This would be converted to DOCX in production -->',
      'utf8'
    );
    
    return {
      filePath,
      fileName: `${fileName}.docx`, // Return DOCX name even though we're saving MD for now
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      note: 'DOCX generation is simulated in this implementation'
    };
  }
  
  /**
   * Update section content directly
   * @param {string} sessionId - Session ID
   * @param {string} sectionId - Section ID
   * @param {Object} content - Section content
   * @returns {Promise<Object>} Update result
   */
  async updateSection(sessionId, sectionId, content) {
    logger.info('Updating section directly', { sessionId, sectionId });
    
    try {
      // Get section
      const section = await this.Section.findOne({
        where: {
          sessionId,
          name: sectionId
        }
      });
      
      if (!section) {
        throw new Error(`Section not found: ${sectionId}`);
      }
      
      // Parse existing content
      let currentContent = {};
      if (section.sectionContent) {
        try {
          currentContent = JSON.parse(section.sectionContent);
        } catch (e) {
          logger.warn('Error parsing existing section content', {
            error: e.message,
            sectionId
          });
        }
      }
      
      // Merge new content with existing
      const mergedContent = {
        ...currentContent,
        ...content
      };
      
      // Update section
      await section.update({
        sectionContent: JSON.stringify(mergedContent),
        validationState: {
          ...section.validationState,
          lastEdited: new Date(),
          editedDirectly: true
        }
      });
      
      // If PRD document exists, mark it for regeneration
      await this.PRDDocument.update(
        {
          metadata: {
            lastModified: new Date(),
            regenerationNeeded: true
          }
        },
        {
          where: { sessionId }
        }
      );
      
      // Generate section preview
      const preview = this.formatSection(sectionId, mergedContent);
      
      return {
        sectionId,
        updatedAt: new Date(),
        preview,
        status: 'updated'
      };
    } catch (error) {
      logger.error('Error updating section', {
        error: error.message,
        stack: error.stack,
        sessionId,
        sectionId
      });
      throw error;
    }
  }
  
  /**
   * Get section preview
   * @param {string} sessionId - Session ID
   * @param {string} sectionId - Section ID
   * @returns {Promise<Object>} Section preview
   */
  async getSectionPreview(sessionId, sectionId) {
    try {
      // Get section
      const section = await this.Section.findOne({
        where: {
          sessionId,
          name: sectionId
        }
      });
      
      if (!section) {
        throw new Error(`Section not found: ${sectionId}`);
      }
      
      // Parse section content
      let content = {};
      if (section.sectionContent) {
        try {
          content = JSON.parse(section.sectionContent);
        } catch (e) {
          logger.warn('Error parsing section content for preview', {
            error: e.message,
            sectionId
          });
        }
      }
      
      // Format section content
      const preview = this.formatSection(sectionId, content);
      
      return {
        sectionId,
        title: this.sectionTitles[sectionId] || sectionId,
        preview,
        isComplete: section.completionStatus,
        updatedAt: section.updatedAt
      };
    } catch (error) {
      logger.error('Error getting section preview', {
        error: error.message,
        stack: error.stack,
        sessionId,
        sectionId
      });
      throw error;
    }
  }
  
  /**
   * Get document structure outline
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Document structure
   */
  async getDocumentStructure(sessionId) {
    try {
      // Get all sections
      const sections = await this.Section.findAll({
        where: { sessionId },
        order: [['id', 'ASC']]
      });
      
      if (sections.length === 0) {
        throw new Error(`No sections found for session: ${sessionId}`);
      }
      
      // Get session info
      const session = await this.UserSession.findOne({
        where: { sessionId }
      });
      
      // Build structure based on ordered sections
      const structure = {
        projectName: session.projectName,
        sections: []
      };
      
      // Add sections in the correct order
      this.sectionOrder.forEach(sectionId => {
        const section = sections.find(s => s.name === sectionId);
        if (section) {
          structure.sections.push({
            id: sectionId,
            title: this.sectionTitles[sectionId] || sectionId,
            isComplete: section.completionStatus,
            hasContent: !!section.sectionContent && section.sectionContent !== '{}'
          });
        }
      });
      
      // Calculate completion statistics
      const completedCount = sections.filter(s => s.completionStatus).length;
      structure.stats = {
        totalSections: sections.length,
        completedSections: completedCount,
        percentComplete: Math.round((completedCount / sections.length) * 100)
      };
      
      return structure;
    } catch (error) {
      logger.error('Error getting document structure', {
        error: error.message,
        stack: error.stack,
        sessionId
      });
      throw error;
    }
  }
  
  /**
   * Save PRD template customization
   * @param {string} sessionId - Session ID
   * @param {Object} customizationData - Customization data
   * @returns {Promise<Object>} Update result
   */
  async saveDocumentCustomization(sessionId, customizationData) {
    logger.info('Saving document customization', { sessionId });
    
    try {
      // Get PRD document
      let prdDocument = await this.PRDDocument.findOne({
        where: { sessionId }
      });
      
      if (!prdDocument) {
        // Create new document if it doesn't exist
        prdDocument = await this.PRDDocument.create({
          id: uuidv4(),
          sessionId,
          sections: {},
          content: '',
          metadata: {
            createdAt: new Date(),
            lastModified: new Date(),
            version: '1.0.0'
          }
        });
      }
      
      // Update template settings
      await prdDocument.update({
        metadata: {
          ...prdDocument.metadata,
          template: {
            ...(prdDocument.metadata.template || {}),
            ...customizationData
          },
          lastModified: new Date()
        }
      });
      
      return {
        sessionId,
        template: {
          ...(prdDocument.metadata.template || {}),
          ...customizationData
        },
        updatedAt: new Date()
      };
    } catch (error) {
      logger.error('Error saving document customization', {
        error: error.message,
        stack: error.stack,
        sessionId
      });
      throw error;
    }
  }
}

module.exports = PRDController;