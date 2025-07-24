const QualityScorer = require('../../../src/services/QualityScorer');

describe('QualityScorer', () => {
  let qualityScorer;

  beforeEach(() => {
    qualityScorer = new QualityScorer();
  });

  describe('constructor', () => {
    it('should initialize QualityScorer', () => {
      expect(qualityScorer).toBeInstanceOf(QualityScorer);
    });
  });

  describe('scoreResponse', () => {
    it('should score high-quality responses above 85', () => {
      const response = 'TaskMaster Pro is a comprehensive project management application that helps remote teams (who) collaborate effectively on complex projects (what) to deliver high-quality results on time and within budget (why). It addresses the critical problem of coordination challenges that cost companies an average of $62 million annually in failed projects.';
      const questionType = 'productDescription';
      const context = { section: 'introduction' };

      const score = qualityScorer.scoreResponse(response, questionType, context);

      expect(score).toBeGreaterThan(85);
    });

    it('should score vague responses below 50', () => {
      const response = 'An app that does stuff for people who want things.';
      const questionType = 'productDescription';
      const context = { section: 'introduction' };

      const score = qualityScorer.scoreResponse(response, questionType, context);

      expect(score).toBeLessThan(50);
    });

    it('should return score between 0 and 100', () => {
      const response = 'Medium quality response with some details.';
      const questionType = 'productDescription';
      const context = { section: 'introduction' };

      const score = qualityScorer.scoreResponse(response, questionType, context);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('scoreCompleteness', () => {
    it('should score complete responses high', () => {
      const response = 'Our mobile application helps busy professionals manage their daily tasks efficiently because time management is crucial for productivity.';

      const score = qualityScorer.scoreCompleteness(response);

      expect(score).toBeGreaterThan(70);
    });

    it('should score incomplete responses low', () => {
      const response = 'An app.';

      const score = qualityScorer.scoreCompleteness(response);

      expect(score).toBeLessThan(30);
    });
  });

  describe('scoreSpecificity', () => {
    it('should score specific details high', () => {
      const response = 'Our SaaS platform targets 25-35 year old marketing professionals in Fortune 500 companies, with 10,000+ daily active users and 95% customer retention rate.';

      const score = qualityScorer.scoreSpecificity(response);

      expect(score).toBeGreaterThan(80);
    });

    it('should score vague language low', () => {
      const response = 'Some users might use this sometimes for various things.';

      const score = qualityScorer.scoreSpecificity(response);

      expect(score).toBeLessThan(40);
    });
  });

  describe('scoreRelevance', () => {
    it('should score relevant responses high', () => {
      const response = 'The main problem is that remote teams struggle with real-time collaboration, leading to 40% longer project timelines.';
      const context = { questionType: 'problemStatement', section: 'introduction' };

      const score = qualityScorer.scoreRelevance(response, context);

      expect(score).toBeGreaterThan(75);
    });

    it('should score off-topic responses low', () => {
      const response = 'I like pizza and the weather is nice today.';
      const context = { questionType: 'problemStatement', section: 'introduction' };

      const score = qualityScorer.scoreRelevance(response, context);

      expect(score).toBeLessThan(25);
    });
  });

  describe('scoreClarity', () => {
    it('should score well-structured responses high', () => {
      const response = 'Our product addresses three key challenges: First, communication gaps between remote team members. Second, lack of real-time project visibility. Third, inefficient task prioritization that leads to missed deadlines.';

      const score = qualityScorer.scoreClarity(response);

      expect(score).toBeGreaterThan(80);
    });

    it('should score poorly structured responses low', () => {
      const response = 'well so like there are problems and stuff happens and users dont like when things dont work good and yeah...';

      const score = qualityScorer.scoreClarity(response);

      expect(score).toBeLessThan(65);
    });
  });

  describe('getWeights', () => {
    it('should return proper weights for productDescription questions', () => {
      const weights = qualityScorer.getWeights('productDescription');

      expect(weights).toHaveProperty('completeness');
      expect(weights).toHaveProperty('specificity');
      expect(weights).toHaveProperty('relevance');
      expect(weights).toHaveProperty('clarity');
      expect(Math.round((weights.completeness + weights.specificity + weights.relevance + weights.clarity) * 10) / 10).toBe(1);
    });

    it('should return different weights for different question types', () => {
      const productWeights = qualityScorer.getWeights('productDescription');
      const problemWeights = qualityScorer.getWeights('problemStatement');

      expect(productWeights).not.toEqual(problemWeights);
    });
  });

  describe('integration scenarios', () => {
    it('should handle comprehensive product description scoring', () => {
      const response = 'HabitBuilder Pro is a mobile application designed for busy professionals aged 25-40 who struggle to maintain consistent daily routines. The app uses AI-powered coaching and social accountability features to help users build lasting habits that improve their productivity and well-being. This addresses the widespread problem where 92% of people fail to stick to their New Year resolutions, costing them personal growth opportunities.';
      
      const overallScore = qualityScorer.scoreResponse(response, 'productDescription', { section: 'introduction' });
      const completeness = qualityScorer.scoreCompleteness(response);
      const specificity = qualityScorer.scoreSpecificity(response);
      const clarity = qualityScorer.scoreClarity(response);

      expect(overallScore).toBeGreaterThan(80);
      expect(completeness).toBeGreaterThan(75);
      expect(specificity).toBeGreaterThan(70);
      expect(clarity).toBeGreaterThan(75);
    });

    it('should properly weight different scoring dimensions', () => {
      const response = 'Test response for weighting validation';
      const questionType = 'businessObjectives';
      
      const weights = qualityScorer.getWeights(questionType);
      const overallScore = qualityScorer.scoreResponse(response, questionType, {});

      expect(typeof overallScore).toBe('number');
      expect(weights.completeness).toBeGreaterThan(0);
      expect(weights.specificity).toBeGreaterThan(0);
      expect(weights.relevance).toBeGreaterThan(0);
      expect(weights.clarity).toBeGreaterThan(0);
    });
  });
});