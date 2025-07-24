/**
 * Token counting utilities for conversation management
 */

/**
 * Approximate token count for OpenAI models (rough estimation)
 * @param {string} text - The text to count tokens for
 * @returns {number} - Estimated token count
 */
function countTokens(text) {
  if (typeof text !== 'string') {
    return 0;
  }
  
  // Rough approximation: 1 token ≈ 4 characters for English text
  // This is a simplified version - for production use tiktoken library
  const avgCharsPerToken = 4;
  return Math.ceil(text.length / avgCharsPerToken);
}

/**
 * Count tokens in a conversation array
 * @param {Array} messages - Array of message objects with content
 * @returns {number} - Total estimated token count
 */
function countConversationTokens(messages) {
  if (!Array.isArray(messages)) {
    return 0;
  }
  
  return messages.reduce((total, message) => {
    const content = typeof message === 'string' ? message : message.content || '';
    return total + countTokens(content);
  }, 0);
}

/**
 * Estimate cost based on token count (rough estimation for GPT models)
 * @param {number} tokens - Number of tokens
 * @param {string} model - Model name (default: 'gpt-3.5-turbo')
 * @returns {number} - Estimated cost in USD
 */
function estimateTokenCost(tokens, model = 'gpt-3.5-turbo') {
  // Rough pricing (as of 2024, subject to change)
  const pricing = {
    'gpt-3.5-turbo': 0.0015 / 1000, // $0.0015 per 1K tokens
    'gpt-4': 0.03 / 1000, // $0.03 per 1K tokens
    'gpt-4-turbo': 0.01 / 1000 // $0.01 per 1K tokens
  };
  
  const pricePerToken = pricing[model] || pricing['gpt-3.5-turbo'];
  return tokens * pricePerToken;
}

/**
 * Check if text exceeds token limit
 * @param {string} text - Text to check
 * @param {number} limit - Token limit (default: 4000)
 * @returns {boolean} - True if exceeds limit
 */
function exceedsTokenLimit(text, limit = 4000) {
  return countTokens(text) > limit;
}

module.exports = {
  countTokens,
  countConversationTokens,
  estimateTokenCost,
  exceedsTokenLimit
};