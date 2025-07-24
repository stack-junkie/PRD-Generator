const ConversationManager = require('../../../src/services/ConversationManager');
const ValidationEngine = require('../../../src/services/ValidationEngine');

jest.mock('../../../src/services/ValidationEngine');

describe('ConversationManager', () => {
  let conversationManager;
  let mockValidationEngine;

  beforeEach(() => {
    mockValidationEngine = {
      validateSection: jest.fn().mockReturnValue({
        overall: true,
        details: {},
        missingRequired: [],
        suggestions: []
      }),
      validateField: jest.fn(),
      rules: {
        introduction: {
          productDescription: {
            minLength: 50,
            requiredElements: ['what', 'who', 'why'],
            qualityThreshold: 75
          }
        }
      }
    };
    
    conversationManager = new ConversationManager(mockValidationEngine);
  });

  describe('constructor', () => {
    it('should initialize with validation engine', () => {
      expect(conversationManager.validationEngine).toBe(mockValidationEngine);
    });

    it('should throw error if no validation engine provided', () => {
      expect(() => new ConversationManager()).toThrow('ValidationEngine is required');
    });
  });

  describe('initializeSection', () => {
    it('should return initial questions for a section', () => {
      const result = conversationManager.initializeSection('introduction', {});
      
      expect(result).toHaveProperty('questions');
      expect(result).toHaveProperty('section');
      expect(result.section).toBe('introduction');
      expect(Array.isArray(result.questions)).toBe(true);
    });

    it('should update conversation state', () => {
      conversationManager.initializeSection('introduction', {});
      
      expect(conversationManager.state.currentSection).toBe('introduction');
    });
  });

  describe('processUserInput', () => {
    it('should process and validate user input', async () => {
      mockValidationEngine.validateField.mockReturnValue({
        passed: true,
        score: 85,
        issues: [],
        suggestions: []
      });

      const result = await conversationManager.processUserInput(
        'Test input',
        'introduction',
        { fieldName: 'productDescription' }
      );
      
      expect(result).toHaveProperty('validation');
      expect(result).toHaveProperty('nextAction');
      expect(mockValidationEngine.validateField).toHaveBeenCalled();
    });

    it('should store responses in conversation state', async () => {
      mockValidationEngine.validateField.mockReturnValue({
        passed: true,
        score: 85,
        issues: [],
        suggestions: []
      });

      await conversationManager.processUserInput(
        'Test input',
        'introduction',
        { fieldName: 'productDescription' }
      );
      
      expect(conversationManager.state.responses.introduction.productDescription).toBe('Test input');
    });
  });

  describe('shouldAskFollowUp', () => {
    it('should return true for failed validations', () => {
      const validation = { passed: false, score: 45 };
      
      expect(conversationManager.shouldAskFollowUp(validation)).toBe(true);
    });

    it('should return false for high quality responses', () => {
      const validation = { passed: true, score: 85 };
      
      expect(conversationManager.shouldAskFollowUp(validation)).toBe(false);
    });
  });

  describe('canProceedToNext', () => {
    it('should return true when section is complete', () => {
      mockValidationEngine.validateSection.mockReturnValue({
        overall: true,
        missingRequired: []
      });

      const result = conversationManager.canProceedToNext('introduction');
      
      expect(result.canProceed).toBe(true);
    });

    it('should return false when section is incomplete', () => {
      mockValidationEngine.validateSection.mockReturnValue({
        overall: false,
        missingRequired: ['productDescription']
      });

      const result = conversationManager.canProceedToNext('introduction');
      
      expect(result.canProceed).toBe(false);
    });
  });

  describe('compressConversation', () => {
    it('should compress completed sections', () => {
      const messages = [
        { role: 'user', content: 'Test message', section: 'introduction' }
      ];
      
      conversationManager.state.completedSections = ['introduction'];
      
      const compressed = conversationManager.compressConversation(messages);
      
      expect(compressed.length).toBeLessThanOrEqual(messages.length);
    });
  });
});