/**
 * Markdown Formatter Utility
 * 
 * Comprehensive markdown formatting utilities for PRD generation with support for
 * multiple export formats, templates, and specialized formatting features.
 */

const FORMATTER_VERSION = '1.0.0';

// Export format types
const EXPORT_FORMATS = {
  GITHUB: 'github',
  CONFLUENCE: 'confluence', 
  PDF: 'pdf',
  STANDARD: 'standard'
};

// Section types for specialized formatting
const SECTION_TYPES = {
  INTRODUCTION: 'introduction',
  GOALS: 'goals',
  AUDIENCE: 'audience',
  USER_STORIES: 'userStories',
  FUNCTIONAL_REQUIREMENTS: 'functionalRequirements',
  SUCCESS_METRICS: 'successMetrics',
  OPEN_QUESTIONS: 'openQuestions'
};

// Priority levels for requirements and features
const PRIORITY_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  CRITICAL: 'critical'
};

/**
 * Default formatting templates for different export formats
 */
const DEFAULT_TEMPLATES = {
  [EXPORT_FORMATS.GITHUB]: {
    documentHeader: (metadata) => `# ${metadata.title}\n\n` +
      `**Author:** ${metadata.author}\n` +
      `**Date:** ${metadata.date}\n` +
      `**Version:** ${metadata.version}\n\n` +
      `---\n\n`,
    
    sectionHeader: (title, level, number) => `${'#'.repeat(level)} ${number ? `${number}. ` : ''}${title}\n\n`,
    
    documentFooter: (metadata) => `\n---\n\n` +
      `*Generated with PRD Maker v${FORMATTER_VERSION}*\n` +
      `*Last updated: ${new Date().toISOString().split('T')[0]}*\n`
  },

  [EXPORT_FORMATS.CONFLUENCE]: {
    documentHeader: (metadata) => `h1. ${metadata.title}\n\n` +
      `||Author||Date||Version||\n` +
      `|${metadata.author}|${metadata.date}|${metadata.version}|\n\n`,
    
    sectionHeader: (title, level, number) => `h${level}. ${number ? `${number}. ` : ''}${title}\n\n`,
    
    documentFooter: (metadata) => `\n{panel:title=Document Info}\n` +
      `Generated with PRD Maker v${FORMATTER_VERSION}\n` +
      `Last updated: ${new Date().toISOString().split('T')[0]}\n` +
      `{panel}\n`
  },

  [EXPORT_FORMATS.PDF]: {
    documentHeader: (metadata) => `# ${metadata.title}\n\n` +
      `<div style="page-break-after: always;"></div>\n\n` +
      `## Document Information\n\n` +
      `- **Author:** ${metadata.author}\n` +
      `- **Date:** ${metadata.date}\n` +
      `- **Version:** ${metadata.version}\n\n`,
    
    sectionHeader: (title, level, number) => {
      const pageBreak = level === 2 ? '<div style="page-break-before: always;"></div>\n\n' : '';
      return `${pageBreak}${'#'.repeat(level)} ${number ? `${number}. ` : ''}${title}\n\n`;
    },
    
    documentFooter: (metadata) => `\n<div style="page-break-before: always;"></div>\n\n` +
      `## Document Generation Info\n\n` +
      `Generated with PRD Maker v${FORMATTER_VERSION} on ${new Date().toISOString().split('T')[0]}\n`
  }
};

/**
 * Main MarkdownFormatter class
 */
class MarkdownFormatter {
  constructor(format = EXPORT_FORMATS.STANDARD, customTemplate = null) {
    this.format = format;
    this.template = customTemplate || DEFAULT_TEMPLATES[format] || DEFAULT_TEMPLATES[EXPORT_FORMATS.STANDARD];
    this.sectionCounter = 0;
    this.glossaryTerms = new Map();
    this.toc = [];
  }

  /**
   * Format a complete section with proper headers and content
   */
  formatSection(sectionName, content, options = {}) {
    const {
      level = 2,
      numbered = true,
      subsections = [],
      metadata = {}
    } = options;

    this.sectionCounter++;
    const sectionNumber = numbered ? this.sectionCounter : null;
    
    let output = '';
    
    // Add section header
    const header = this.template.sectionHeader 
      ? this.template.sectionHeader(sectionName, level, sectionNumber)
      : this._defaultSectionHeader(sectionName, level, sectionNumber);
    
    output += header;
    
    // Add to TOC
    this.toc.push({
      title: sectionName,
      level: level,
      number: sectionNumber,
      anchor: this._createAnchor(sectionName)
    });

    // Format main content based on section type
    const formattedContent = this._formatSectionContent(content, sectionName, metadata);
    output += formattedContent;

    // Add subsections if provided
    if (subsections.length > 0) {
      subsections.forEach(subsection => {
        output += this.formatSection(
          subsection.name, 
          subsection.content, 
          { ...options, level: level + 1, numbered: false }
        );
      });
    }

    return output;
  }

  /**
   * Create a table of contents with links
   */
  createTableOfContents(sections = null) {
    const tocSections = sections || this.toc;
    
    let toc = '## Table of Contents\n\n';
    
    tocSections.forEach(section => {
      const indentation = '  '.repeat(section.level - 2);
      const number = section.number ? `${section.number}. ` : '';
      const link = this.format === EXPORT_FORMATS.GITHUB 
        ? `[${number}${section.title}](#${section.anchor})`
        : `${number}${section.title}`;
      
      toc += `${indentation}- ${link}\n`;
    });
    
    return toc + '\n';
  }

  /**
   * Format user stories consistently
   */
  formatUserStory(story, options = {}) {
    const {
      includeAcceptanceCriteria = true,
      includeEstimate = false,
      includePriority = true,
      format = 'standard'
    } = options;

    let output = '';

    if (format === 'card') {
      output += '> **User Story**\n>\n';
      output += `> **As a** ${story.persona || 'user'}\n`;
      output += `> **I want** ${story.want}\n`;
      output += `> **So that** ${story.benefit}\n`;
      
      if (includePriority && story.priority) {
        output += `>\n> **Priority:** ${this._formatPriority(story.priority)}\n`;
      }
      
      if (includeEstimate && story.estimate) {
        output += `> **Estimate:** ${story.estimate}\n`;
      }
      
      output += '>\n';
    } else {
      output += `**As a** ${story.persona || 'user'}, `;
      output += `**I want** ${story.want}, `;
      output += `**so that** ${story.benefit}.\n\n`;
    }

    if (includeAcceptanceCriteria && story.acceptanceCriteria) {
      output += '**Acceptance Criteria:**\n\n';
      story.acceptanceCriteria.forEach((criteria, index) => {
        output += `- [ ] ${criteria}\n`;
      });
      output += '\n';
    }

    return output;
  }

  /**
   * Create requirements table with proper formatting
   */
  createRequirementsTable(requirements, options = {}) {
    const {
      includeStatus = true,
      includePriority = true,
      includeEffort = false,
      includeOwner = false,
      sortBy = 'priority'
    } = options;

    if (!requirements || requirements.length === 0) {
      return '*No requirements specified.*\n\n';
    }

    // Sort requirements
    const sortedRequirements = this._sortRequirements(requirements, sortBy);

    // Build table header
    let headers = ['ID', 'Requirement'];
    if (includePriority) headers.push('Priority');
    if (includeStatus) headers.push('Status');
    if (includeEffort) headers.push('Effort');
    if (includeOwner) headers.push('Owner');

    let table = `| ${headers.join(' | ')} |\n`;
    table += `| ${headers.map(() => '---').join(' | ')} |\n`;

    // Build table rows
    sortedRequirements.forEach(req => {
      let row = [
        req.id || 'TBD',
        req.description || req.text || 'No description'
      ];
      
      if (includePriority) {
        row.push(this._formatPriority(req.priority));
      }
      
      if (includeStatus) {
        row.push(this._formatStatus(req.status));
      }
      
      if (includeEffort) {
        row.push(req.effort || 'TBD');
      }
      
      if (includeOwner) {
        row.push(req.owner || 'Unassigned');
      }

      table += `| ${row.join(' | ')} |\n`;
    });

    return table + '\n';
  }

  /**
   * Add metadata headers and footers to document
   */
  addMetadata(document, metadata = {}) {
    const defaultMetadata = {
      title: 'Product Requirements Document',
      author: 'Unknown',
      date: new Date().toISOString().split('T')[0],
      version: '1.0.0',
      ...metadata
    };

    let output = '';
    
    // Add header
    if (this.template.documentHeader) {
      output += this.template.documentHeader(defaultMetadata);
    }
    
    // Add main document content
    output += document;
    
    // Add footer
    if (this.template.documentFooter) {
      output += this.template.documentFooter(defaultMetadata);
    }

    return output;
  }

  /**
   * Format SMART goals as structured lists
   */
  formatSMARTGoals(goals) {
    if (!goals || goals.length === 0) {
      return '*No SMART goals defined.*\n\n';
    }

    let output = '';
    
    goals.forEach((goal, index) => {
      output += `### Goal ${index + 1}: ${goal.title || 'Untitled Goal'}\n\n`;
      
      output += '| Criteria | Description |\n';
      output += '| --- | --- |\n';
      output += `| **Specific** | ${goal.specific || 'Not defined'} |\n`;
      output += `| **Measurable** | ${goal.measurable || 'Not defined'} |\n`;
      output += `| **Achievable** | ${goal.achievable || 'Not defined'} |\n`;
      output += `| **Relevant** | ${goal.relevant || 'Not defined'} |\n`;
      output += `| **Time-bound** | ${goal.timeBound || 'Not defined'} |\n\n`;
    });

    return output;
  }

  /**
   * Format user personas as cards/tables
   */
  formatUserPersonas(personas) {
    if (!personas || personas.length === 0) {
      return '*No user personas defined.*\n\n';
    }

    let output = '';
    
    personas.forEach(persona => {
      output += `### ${persona.name || 'Unnamed Persona'}\n\n`;
      
      if (this.format === EXPORT_FORMATS.GITHUB) {
        output += '> **Persona Profile**\n>\n';
        output += `> **Demographics:** ${persona.demographics || 'Not specified'}\n`;
        output += `> **Goals:** ${persona.goals || 'Not specified'}\n`;
        output += `> **Frustrations:** ${persona.frustrations || 'Not specified'}\n`;
        output += `> **Tech Comfort:** ${persona.techComfort || 'Not specified'}\n>\n`;
      } else {
        output += '| Attribute | Details |\n';
        output += '| --- | --- |\n';
        output += `| Demographics | ${persona.demographics || 'Not specified'} |\n`;
        output += `| Goals | ${persona.goals || 'Not specified'} |\n`;
        output += `| Frustrations | ${persona.frustrations || 'Not specified'} |\n`;
        output += `| Tech Comfort | ${persona.techComfort || 'Not specified'} |\n\n`;
      }
      
      if (persona.quote) {
        output += `> "${persona.quote}"\n\n`;
      }
    });

    return output;
  }

  /**
   * Format success metrics with ASCII charts
   */
  formatSuccessMetrics(metrics, options = {}) {
    const { includeCharts = true, chartWidth = 40 } = options;
    
    if (!metrics || metrics.length === 0) {
      return '*No success metrics defined.*\n\n';
    }

    let output = '';
    
    metrics.forEach(metric => {
      output += `#### ${metric.name || 'Unnamed Metric'}\n\n`;
      output += `**Description:** ${metric.description || 'No description'}\n\n`;
      
      if (metric.baseline && metric.target) {
        output += `**Baseline:** ${metric.baseline}\n`;
        output += `**Target:** ${metric.target}\n`;
        
        if (includeCharts && metric.type === 'percentage') {
          output += '\n**Progress Visualization:**\n\n';
          output += this._createProgressBar(metric.baseline, metric.target, chartWidth);
        }
      }
      
      if (metric.timeline) {
        output += `**Timeline:** ${metric.timeline}\n`;
      }
      
      output += '\n';
    });

    return output;
  }

  /**
   * Create risk matrix visualization
   */
  formatRiskMatrix(risks) {
    if (!risks || risks.length === 0) {
      return '*No risks identified.*\n\n';
    }

    let output = '### Risk Matrix\n\n';
    
    // Create 3x3 risk matrix
    const matrix = {
      high: { high: [], medium: [], low: [] },
      medium: { high: [], medium: [], low: [] },
      low: { high: [], medium: [], low: [] }
    };

    // Categorize risks
    risks.forEach(risk => {
      const impact = risk.impact || 'medium';
      const probability = risk.probability || 'medium';
      matrix[impact][probability].push(risk);
    });

    // Create visual matrix
    output += '```\n';
    output += '              PROBABILITY\n';
    output += '       Low    Medium    High\n';
    output += '     ┌──────┬──────┬──────┐\n';
    output += 'High │      │      │      │\n';
    output += '     ├──────┼──────┼──────┤ IMPACT\n';
    output += ' Med │      │      │      │\n';
    output += '     ├──────┼──────┼──────┤\n';
    output += ' Low │      │      │      │\n';
    output += '     └──────┴──────┴──────┘\n';
    output += '```\n\n';

    // List risks by category
    Object.keys(matrix).forEach(impact => {
      Object.keys(matrix[impact]).forEach(probability => {
        const categoryRisks = matrix[impact][probability];
        if (categoryRisks.length > 0) {
          output += `**${impact.toUpperCase()} Impact, ${probability.toUpperCase()} Probability:**\n`;
          categoryRisks.forEach(risk => {
            output += `- ${risk.description || risk.name}\n`;
          });
          output += '\n';
        }
      });
    });

    return output;
  }

  /**
   * Auto-generate glossary from collected terms
   */
  generateGlossary() {
    if (this.glossaryTerms.size === 0) {
      return '';
    }

    let output = '## Glossary\n\n';
    
    // Sort terms alphabetically
    const sortedTerms = Array.from(this.glossaryTerms.entries()).sort();
    
    sortedTerms.forEach(([term, definition]) => {
      output += `**${term}:** ${definition}\n\n`;
    });

    return output;
  }

  /**
   * Add a term to the glossary
   */
  addGlossaryTerm(term, definition) {
    this.glossaryTerms.set(term, definition);
  }

  /**
   * Export utilities for different platforms
   */
  static exportForGitHub(content, metadata = {}) {
    const formatter = new MarkdownFormatter(EXPORT_FORMATS.GITHUB);
    return formatter.addMetadata(content, metadata);
  }

  static exportForConfluence(content, metadata = {}) {
    const formatter = new MarkdownFormatter(EXPORT_FORMATS.CONFLUENCE);
    return formatter.addMetadata(content, metadata);
  }

  static exportForPDF(content, metadata = {}) {
    const formatter = new MarkdownFormatter(EXPORT_FORMATS.PDF);
    return formatter.addMetadata(content, metadata);
  }

  /**
   * Validate markdown output for common issues
   */
  validateOutput(content) {
    const issues = [];
    
    // Check for common markdown issues
    if (content.includes('undefined')) {
      issues.push('Content contains undefined values');
    }
    
    if (!content.includes('#')) {
      issues.push('No headers found in content');
    }
    
    // Check for malformed tables
    const tableRows = content.split('\n').filter(line => line.includes('|'));
    if (tableRows.length > 0) {
      const firstRow = tableRows[0];
      const columnCount = (firstRow.match(/\|/g) || []).length - 1;
      
      const malformedRows = tableRows.filter(row => {
        const rowColumnCount = (row.match(/\|/g) || []).length - 1;
        return rowColumnCount !== columnCount;
      });
      
      if (malformedRows.length > 0) {
        issues.push('Malformed table rows detected');
      }
    }
    
    return {
      valid: issues.length === 0,
      issues: issues
    };
  }

  // Private helper methods
  _defaultSectionHeader(title, level, number) {
    return `${'#'.repeat(level)} ${number ? `${number}. ` : ''}${title}\n\n`;
  }

  _formatSectionContent(content, sectionType, metadata) {
    // Apply section-specific formatting
    switch (sectionType.toLowerCase()) {
      case 'user stories':
        return this._formatUserStoriesSection(content);
      case 'success metrics':
        return this._formatMetricsSection(content);
      case 'functional requirements':
        return this._formatRequirementsSection(content);
      default:
        return typeof content === 'string' ? content + '\n\n' : this._formatGenericContent(content);
    }
  }

  _formatUserStoriesSection(content) {
    if (Array.isArray(content)) {
      return content.map(story => this.formatUserStory(story)).join('\n') + '\n';
    }
    return content + '\n\n';
  }

  _formatMetricsSection(content) {
    if (Array.isArray(content)) {
      return this.formatSuccessMetrics(content);
    }
    return content + '\n\n';
  }

  _formatRequirementsSection(content) {
    if (Array.isArray(content)) {
      return this.createRequirementsTable(content);
    }
    return content + '\n\n';
  }

  _formatGenericContent(content) {
    if (Array.isArray(content)) {
      return content.map(item => `- ${item}`).join('\n') + '\n\n';
    }
    if (typeof content === 'object') {
      return JSON.stringify(content, null, 2) + '\n\n';
    }
    return content + '\n\n';
  }

  _createAnchor(title) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  _formatPriority(priority) {
    const priorityEmojis = {
      [PRIORITY_LEVELS.CRITICAL]: '🔥 Critical',
      [PRIORITY_LEVELS.HIGH]: '🔴 High',
      [PRIORITY_LEVELS.MEDIUM]: '🟡 Medium',
      [PRIORITY_LEVELS.LOW]: '🟢 Low'
    };
    
    return priorityEmojis[priority] || priority;
  }

  _formatStatus(status) {
    const statusEmojis = {
      'todo': '⚪ To Do',
      'in-progress': '🟡 In Progress', 
      'done': '✅ Done',
      'blocked': '🔴 Blocked'
    };
    
    return statusEmojis[status] || status;
  }

  _sortRequirements(requirements, sortBy) {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    
    return [...requirements].sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
        case 'status':
          return (a.status || '').localeCompare(b.status || '');
        case 'id':
          return (a.id || '').localeCompare(b.id || '');
        default:
          return 0;
      }
    });
  }

  _createProgressBar(baseline, target, width) {
    const baselineNum = parseFloat(baseline.toString().replace(/[^0-9.-]/g, ''));
    const targetNum = parseFloat(target.toString().replace(/[^0-9.-]/g, ''));
    
    if (isNaN(baselineNum) || isNaN(targetNum)) {
      return '```\nUnable to create progress visualization\n```\n\n';
    }
    
    const progress = Math.min((baselineNum / targetNum) * 100, 100);
    const filledWidth = Math.round((progress / 100) * width);
    const emptyWidth = width - filledWidth;
    
    const progressBar = '█'.repeat(filledWidth) + '░'.repeat(emptyWidth);
    
    return `\`\`\`\n${baseline} [$progressBar] ${target} (${progress.toFixed(1)}%)\n\`\`\`\n\n`;
  }
}

// Export the class and constants
module.exports = {
  MarkdownFormatter,
  EXPORT_FORMATS,
  SECTION_TYPES,
  PRIORITY_LEVELS,
  DEFAULT_TEMPLATES
};