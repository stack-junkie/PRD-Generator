const ValidationEngine = require('../../../src/services/ValidationEngine');

describe('ValidationEngine', () => {
  let validationEngine;
  let mockValidationRules;

  beforeEach(() => {
    mockValidationRules = {
      introduction: {
        productDescription: {
          minLength: 50,
          requiredElements: ['what', 'who', 'why'],
          qualityThreshold: 75
        }
      }
    };
    
    validationEngine = new ValidationEngine(mockValidationRules);
  });

  describe('constructor', () => {
    it('should initialize with validation rules', () => {
      expect(validationEngine.rules).toEqual(mockValidationRules);
    });

    it('should throw error if no rules provided', () => {
      expect(() => new ValidationEngine()).toThrow('Validation rules are required');
    });
  });

  describe('validateSection', () => {
    it('should validate complete section and return results', () => {
      const responses = {
        productDescription: 'A comprehensive habit tracking app that helps users (who) build daily routines (what) to improve their lives (why).'
      };
      
      const result = validationEngine.validateSection('introduction', responses);
      
      expect(result).toHaveProperty('overall');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('missingRequired');
    });

    it('should fail validation for incomplete responses', () => {
      const incompleteResponses = {
        productDescription: 'Short'
      };
      
      const result = validationEngine.validateSection('introduction', incompleteResponses);
      
      expect(result.overall).toBe(false);
    });
  });

  describe('validateField', () => {
    it('should pass validation for quality responses', () => {
      const response = 'A comprehensive habit tracking app that helps users (who) build daily routines (what) to improve their lives (why).';
      const rules = mockValidationRules.introduction.productDescription;
      
      const result = validationEngine.validateField(response, rules);
      
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(rules.qualityThreshold);
    });

    it('should fail validation for poor responses', () => {
      const response = 'An app';
      const rules = mockValidationRules.introduction.productDescription;
      
      const result = validationEngine.validateField(response, rules);
      
      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(rules.qualityThreshold);
    });
  });

  describe('calculateQualityScore', () => {
    it('should return score between 0 and 100', () => {
      const rules = mockValidationRules.introduction.productDescription;
      const score = validationEngine.calculateQualityScore('Test response', rules);
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('containsElement', () => {
    it('should detect required elements in response', () => {
      const response = 'This application helps users who want to build habits';
      
      expect(validationEngine.containsElement(response, 'who')).toBe(true);
      expect(validationEngine.containsElement(response, 'why')).toBe(false);
    });
  });
});