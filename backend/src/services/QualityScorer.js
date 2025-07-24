class QualityScorer {
  constructor() {
    // Define question type configurations
    this.questionTypeWeights = {
      productDescription: { completeness: 0.4, specificity: 0.3, relevance: 0.2, clarity: 0.1 },
      problemStatement: { completeness: 0.4, specificity: 0.3, relevance: 0.2, clarity: 0.1 },
      businessObjectives: { completeness: 0.35, specificity: 0.35, relevance: 0.2, clarity: 0.1 },
      targetMarket: { completeness: 0.4, specificity: 0.3, relevance: 0.2, clarity: 0.1 },
      userStories: { relevance: 0.4, specificity: 0.3, completeness: 0.2, clarity: 0.1 },
      functionalReqs: { completeness: 0.4, specificity: 0.3, relevance: 0.2, clarity: 0.1 },
      successMetrics: { specificity: 0.4, completeness: 0.3, relevance: 0.2, clarity: 0.1 },
      // Default for unknown types
      default: { completeness: 0.4, specificity: 0.3, relevance: 0.2, clarity: 0.1 }
    };

    // Pattern definitions for scoring
    this.patterns = {
      specific: [
        /\d+/g, // Numbers
        /\$\d+(?:,\d{3})*(?:\.\d{2})?/g, // Dollar amounts
        /\d+%/g, // Percentages
        /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/gi, // Months
        /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, // Dates
        /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, // Proper nouns (two words)
        /\b(?:API|SDK|SaaS|B2B|B2C|CRM|ERP|UI|UX|MVP|KPI|ROI|CEO|CTO|CMO)\b/g, // Technical terms
        /\b(?:daily|weekly|monthly|quarterly|annually)\b/gi, // Time periods
        /\b(?:mobile|web|desktop|iOS|Android|Windows|macOS|Linux)\b/gi, // Platforms
        /\b\d+(?:st|nd|rd|th)\s+(?:quarter|Q[1-4])\b/gi // Quarters
      ],
      vague: [
        /\b(?:probably|maybe|might|perhaps|possibly|kind\s+of|sort\s+of|stuff|things|people|users|some|many|various|several)\b/gi,
        /\b(?:good|bad|nice|great|awesome|terrible|amazing|wonderful)\b/gi,
        /\b(?:a\s+lot|lots\s+of|bunch\s+of|tons\s+of)\b/gi,
        /\b(?:etc|and\s+so\s+on|and\s+stuff)\b/gi
      ],
      structured: [
        /^\s*[-*•]\s+/gm, // Bullet points
        /^\s*\d+\.\s+/gm, // Numbered lists
        /\n\s*\n/g, // Paragraph breaks
        /\b(?:first|second|third|fourth|fifth|finally|lastly|in\s+conclusion)\b/gi, // Sequential indicators
        /\b(?:however|therefore|furthermore|additionally|moreover|consequently)\b/gi, // Logical connectors
        /:/g // Colons indicating structure
      ],
      detailed: [
        /\b(?:for\s+example|such\s+as|including|specifically|namely)\b/gi, // Example indicators
        /\b(?:scenario|use\s+case|edge\s+case|corner\s+case)\b/gi, // Case mentions
        /\b(?:because|since|due\s+to|as\s+a\s+result)\b/gi, // Causal language
        /\b(?:when|if|unless|provided\s+that|in\s+case)\b/gi, // Conditional language
        /"/g, // Quotes
        /\([^)]+\)/g // Parenthetical explanations
      ],
      clarity: [
        /\b(?:because|therefore|however|furthermore|additionally|first|second|third)\b/gi, // Logical connectors
        /[.!?]+/g, // Sentence endings
        /\b(?:this|that|these|those|it|they)\s+(?:means|indicates|shows|demonstrates)\b/gi, // Explanatory phrases
        /\b(?:in\s+other\s+words|to\s+clarify|specifically|that\s+is)\b/gi // Clarification phrases
      ],
      poorGrammar: [
        /\b(?:dont|doesnt|wont|cant|im|youre|theyre|well|yeah|ok|okay)\b/gi, // Informal contractions
        /\.{2,}/g, // Multiple periods
        /\s{2,}/g, // Multiple spaces
        /[,;]{2,}/g, // Multiple punctuation
        /\b(?:alot|recieve|seperate|definately|loose)\b/gi // Common misspellings
      ]
    };

    // Relevance keywords by question type
    this.relevanceKeywords = {
      productDescription: ['product', 'application', 'app', 'platform', 'tool', 'service', 'solution', 'users', 'customers', 'target', 'market', 'problem', 'solve', 'benefit', 'value'],
      problemStatement: ['problem', 'issue', 'challenge', 'difficulty', 'pain', 'struggle', 'obstacle', 'barrier', 'frustration', 'inefficiency', 'cost', 'time', 'effort'],
      businessObjectives: ['objective', 'goal', 'target', 'aim', 'mission', 'vision', 'strategy', 'revenue', 'growth', 'market', 'competitive', 'advantage', 'success'],
      targetMarket: ['market', 'audience', 'users', 'customers', 'demographic', 'segment', 'persona', 'age', 'income', 'location', 'behavior', 'needs'],
      userStories: ['user', 'customer', 'persona', 'story', 'scenario', 'journey', 'workflow', 'task', 'goal', 'need', 'want', 'experience'],
      functionalReqs: ['requirement', 'function', 'feature', 'capability', 'functionality', 'system', 'interface', 'integration', 'process', 'workflow'],
      successMetrics: ['metric', 'measure', 'KPI', 'target', 'goal', 'percentage', 'number', 'rate', 'volume', 'performance', 'success', 'benchmark']
    };
  }

  scoreResponse(response, questionType, context = {}) {
    if (!response || typeof response !== 'string') {
      return 0;
    }

    if (response.trim().length === 0) {
      return 0;
    }

    // Get weights for this question type
    const weights = this.getWeights(questionType);

    // Calculate individual dimension scores
    const completeness = this.scoreCompleteness(response, context);
    const specificity = this.scoreSpecificity(response);
    const relevance = this.scoreRelevance(response, { questionType, ...context });
    const clarity = this.scoreClarity(response);

    // Calculate weighted score
    const weightedScore = 
      (completeness * weights.completeness) +
      (specificity * weights.specificity) +
      (relevance * weights.relevance) +
      (clarity * weights.clarity);

    return Math.round(Math.max(0, Math.min(100, weightedScore)));
  }

  scoreCompleteness(response) {
    if (!response || typeof response !== 'string') {
      return 0;
    }

    let score = 0;
    const responseLength = response.trim().length;

    // Base score based on length
    if (responseLength >= 200) {
      score += 40;
    } else if (responseLength >= 100) {
      score += 30;
    } else if (responseLength >= 50) {
      score += 20;
    } else if (responseLength >= 20) {
      score += 10;
    }

    // Word count bonus
    const wordCount = response.split(/\s+/).length;
    if (wordCount >= 50) {
      score += 20;
    } else if (wordCount >= 25) {
      score += 15;
    } else if (wordCount >= 10) {
      score += 10;
    }

    // Sentence count bonus
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length >= 5) {
      score += 20;
    } else if (sentences.length >= 3) {
      score += 15;
    } else if (sentences.length >= 2) {
      score += 10;
    }

    // Conceptual coverage bonus
    const concepts = this.extractConcepts(response);
    if (concepts.length >= 5) {
      score += 20;
    } else if (concepts.length >= 3) {
      score += 15;
    } else if (concepts.length >= 2) {
      score += 10;
    }

    return Math.min(100, score);
  }

  scoreSpecificity(response) {
    if (!response || typeof response !== 'string') {
      return 0;
    }

    let score = 30; // Base score

    // Count specific patterns
    let specificCount = 0;
    this.patterns.specific.forEach(pattern => {
      const matches = response.match(pattern);
      if (matches) {
        specificCount += matches.length;
      }
    });

    // Add points for specific elements
    score += Math.min(specificCount * 5, 40);

    // Count vague patterns and subtract points
    let vagueCount = 0;
    this.patterns.vague.forEach(pattern => {
      const matches = response.match(pattern);
      if (matches) {
        vagueCount += matches.length;
      }
    });

    score -= vagueCount * 3;

    // Bonus for detailed patterns
    let detailedCount = 0;
    this.patterns.detailed.forEach(pattern => {
      const matches = response.match(pattern);
      if (matches) {
        detailedCount += matches.length;
      }
    });

    score += Math.min(detailedCount * 3, 20);

    // Bonus for proper nouns and technical terms
    const properNouns = response.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
    if (properNouns) {
      score += Math.min(properNouns.length * 2, 10);
    }

    return Math.max(0, Math.min(100, score));
  }

  scoreRelevance(response, context = {}) {
    if (!response || typeof response !== 'string') {
      return 0;
    }

    let score = 50; // Base score
    const questionType = context.questionType || 'default';
    const relevantKeywords = this.relevanceKeywords[questionType] || [];

    // Count relevant keywords
    const lowerResponse = response.toLowerCase();
    let keywordMatches = 0;

    relevantKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = lowerResponse.match(regex);
      if (matches) {
        keywordMatches += matches.length;
      }
    });

    // Add points for keyword relevance
    score += Math.min(keywordMatches * 5, 30);

    // Bonus for section-specific context
    if (context.section) {
      const sectionKeywords = this.getSectionKeywords(context.section);
      sectionKeywords.forEach(keyword => {
        if (lowerResponse.includes(keyword.toLowerCase())) {
          score += 3;
        }
      });
    }

    // Penalty for completely off-topic responses
    const commonIrrelevantPhrases = [
      'pizza', 'weather', 'movie', 'music', 'sports', 'vacation',
      'birthday', 'weekend', 'shopping', 'cooking', 'pets'
    ];

    let irrelevantCount = 0;
    commonIrrelevantPhrases.forEach(phrase => {
      if (lowerResponse.includes(phrase)) {
        irrelevantCount++;
      }
    });

    if (irrelevantCount > 0) {
      score -= irrelevantCount * 15;
    }

    // Bonus for answering the implicit question
    if (this.answersImplicitQuestion(response, questionType)) {
      score += 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  scoreClarity(response) {
    if (!response || typeof response !== 'string') {
      return 0;
    }

    let score = 40; // Base score

    // Check for structured writing
    let structuredCount = 0;
    this.patterns.structured.forEach(pattern => {
      const matches = response.match(pattern);
      if (matches) {
        structuredCount += matches.length;
      }
    });

    score += Math.min(structuredCount * 3, 25);

    // Check for clarity indicators
    let clarityCount = 0;
    this.patterns.clarity.forEach(pattern => {
      const matches = response.match(pattern);
      if (matches) {
        clarityCount += matches.length;
      }
    });

    score += Math.min(clarityCount * 2, 20);

    // Sentence structure analysis
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;

    // Optimal sentence length is 15-25 words
    if (avgSentenceLength >= 15 && avgSentenceLength <= 25) {
      score += 10;
    } else if (avgSentenceLength >= 10 && avgSentenceLength <= 30) {
      score += 5;
    }

    // Paragraph structure bonus
    const paragraphs = response.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    if (paragraphs.length > 1) {
      score += 5;
    }

    // Penalties for poor grammar
    let grammarIssues = 0;
    this.patterns.poorGrammar.forEach(pattern => {
      const matches = response.match(pattern);
      if (matches) {
        grammarIssues += matches.length;
      }
    });

    score -= grammarIssues * 2;

    // Penalty for run-on sentences (> 40 words)
    const longSentences = sentences.filter(s => s.split(/\s+/).length > 40);
    score -= longSentences.length * 5;

    return Math.max(0, Math.min(100, score));
  }

  getWeights(questionType) {
    return this.questionTypeWeights[questionType] || this.questionTypeWeights.default;
  }

  extractConcepts(response) {
    // Extract key concepts from response
    const concepts = [];
    const words = response.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    // Common concept indicators
    const conceptPatterns = [
      /\b(?:application|platform|system|service|tool|product|solution)\b/gi,
      /\b(?:user|customer|client|stakeholder|audience|market)\b/gi,
      /\b(?:problem|issue|challenge|need|requirement|goal|objective)\b/gi,
      /\b(?:feature|function|capability|workflow|process|method)\b/gi,
      /\b(?:business|commercial|enterprise|organization|company)\b/gi
    ];

    conceptPatterns.forEach(pattern => {
      const matches = response.match(pattern);
      if (matches) {
        concepts.push(...matches.map(m => m.toLowerCase()));
      }
    });

    return [...new Set(concepts)]; // Remove duplicates
  }

  getSectionKeywords(section) {
    const sectionKeywordMap = {
      introduction: ['product', 'overview', 'summary', 'what', 'who', 'why'],
      goals: ['objective', 'goal', 'target', 'aim', 'success', 'achieve'],
      audience: ['user', 'customer', 'audience', 'demographic', 'persona', 'segment'],
      userStories: ['story', 'scenario', 'journey', 'workflow', 'task', 'user'],
      requirements: ['requirement', 'specification', 'feature', 'function', 'capability'],
      metrics: ['metric', 'measure', 'KPI', 'target', 'benchmark', 'performance'],
      questions: ['question', 'concern', 'issue', 'uncertainty', 'clarification']
    };

    return sectionKeywordMap[section] || [];
  }

  answersImplicitQuestion(response, questionType) {
    // Check if response addresses the implicit questions for each type
    const implicitQuestionPatterns = {
      productDescription: [/\bwhat\b.*\bis\b/i, /\bwho\b.*\bfor\b/i, /\bwhy\b.*\bneed\b/i],
      problemStatement: [/\bproblem\b/i, /\bissue\b/i, /\bchallenge\b/i, /\bdifficult/i],
      businessObjectives: [/\bgoal\b/i, /\bobjective\b/i, /\bsuccess\b/i, /\bachieve\b/i],
      targetMarket: [/\bwho\b/i, /\bmarket\b/i, /\bcustomer\b/i, /\buser\b/i],
      userStories: [/\buser\b/i, /\bas\s+a\b/i, /\bi\s+want\b/i, /\bso\s+that\b/i],
      functionalReqs: [/\bshall\b/i, /\bmust\b/i, /\brequirement\b/i, /\bfunction\b/i],
      successMetrics: [/\bmeasure\b/i, /\bmetric\b/i, /\btarget\b/i, /\bKPI\b/i]
    };

    const patterns = implicitQuestionPatterns[questionType] || [];
    return patterns.some(pattern => pattern.test(response));
  }

  getScoreBreakdown(response, questionType, context = {}) {
    if (!response || typeof response !== 'string') {
      return {
        overall: 0,
        completeness: 0,
        specificity: 0,
        relevance: 0,
        clarity: 0,
        weights: this.getWeights(questionType)
      };
    }

    const weights = this.getWeights(questionType);
    const completeness = this.scoreCompleteness(response, context);
    const specificity = this.scoreSpecificity(response);
    const relevance = this.scoreRelevance(response, { questionType, ...context });
    const clarity = this.scoreClarity(response);

    const overall = Math.round(
      (completeness * weights.completeness) +
      (specificity * weights.specificity) +
      (relevance * weights.relevance) +
      (clarity * weights.clarity)
    );

    return {
      overall,
      completeness,
      specificity,
      relevance,
      clarity,
      weights
    };
  }
}

module.exports = QualityScorer;