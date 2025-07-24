/**
 * Input sanitization utilities for security
 */

/**
 * Sanitize user input to prevent XSS and injection attacks
 * @param {string} input - The input string to sanitize
 * @returns {string} - The sanitized string
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return input;
  }
  
  // Remove or escape HTML tags
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

/**
 * Sanitize HTML content for safe rendering
 * @param {string} html - The HTML string to sanitize
 * @returns {string} - The sanitized HTML string
 */
function sanitizeHtml(html) {
  if (typeof html !== 'string') {
    return html;
  }
  
  // Basic HTML sanitization - remove script tags and event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/g, '')
    .replace(/on\w+='[^']*'/g, '')
    .replace(/javascript:/gi, '');
}

/**
 * Validate and sanitize markdown content
 * @param {string} markdown - The markdown string to sanitize
 * @returns {string} - The sanitized markdown string
 */
function sanitizeMarkdown(markdown) {
  if (typeof markdown !== 'string') {
    return markdown;
  }
  
  // Remove potentially dangerous markdown patterns
  return markdown
    .replace(/^\s*<script.*?<\/script>/gmi, '')
    .replace(/\[.*?\]\(javascript:.*?\)/gi, '')
    .replace(/\[.*?\]\(data:.*?\)/gi, '');
}

module.exports = {
  sanitizeInput,
  sanitizeHtml,
  sanitizeMarkdown
};