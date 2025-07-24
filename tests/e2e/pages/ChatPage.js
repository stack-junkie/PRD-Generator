/**
 * Page Object Model for Chat Interface
 * Handles all interactions with the conversational PRD generation interface
 */

class ChatPage {
  constructor(page) {
    this.page = page;
    
    // Selectors
    this.selectors = {
      newSessionButton: '[data-testid="new-session-button"]',
      chatContainer: '[data-testid="chat-container"]',
      messageInput: '[data-testid="message-input"]',
      sendButton: '[data-testid="send-button"]',
      messageList: '[data-testid="message-list"]',
      aiMessage: '[data-testid="ai-message"]',
      userMessage: '[data-testid="user-message"]',
      typingIndicator: '[data-testid="typing-indicator"]',
      sessionId: '[data-testid="session-id"]',
      errorMessage: '[data-testid="error-message"]',
      validationError: '[data-testid="validation-error"]',
      retryButton: '[data-testid="retry-button"]',
      editButton: '[data-testid="edit-response"]',
      sessionRenewalPrompt: '[data-testid="session-renewal-prompt"]',
      conflictWarning: '[data-testid="conflict-warning"]',
      resolveConflictButton: '[data-testid="resolve-conflict"]'
    };
  }

  /**
   * Create a new PRD generation session
   */
  async createNewSession() {
    await this.page.click(this.selectors.newSessionButton);
    await this.waitForChatReady();
  }

  /**
   * Resume an existing session by ID
   */
  async resumeSession(sessionId) {
    await this.page.evaluate((id) => {
      localStorage.setItem('currentSessionId', id);
    }, sessionId);
    await this.page.reload();
    await this.waitForChatReady();
  }

  /**
   * Wait for chat interface to be ready
   */
  async waitForChatReady() {
    await this.page.waitForSelector(this.selectors.chatContainer, { 
      state: 'visible',
      timeout: 10000 
    });
    await this.page.waitForSelector(this.selectors.messageInput, { 
      state: 'visible' 
    });
  }

  /**
   * Wait for the initial AI question to appear
   */
  async waitForInitialQuestion() {
    await this.page.waitForSelector(this.selectors.aiMessage, { 
      state: 'visible',
      timeout: 15000 
    });
    
    // Wait for typing indicator to disappear
    await this.page.waitForSelector(this.selectors.typingIndicator, { 
      state: 'hidden',
      timeout: 10000 
    });
  }

  /**
   * Answer a question by typing and sending a response
   */
  async answerQuestion(response) {
    // Wait for input to be ready
    await this.page.waitForSelector(this.selectors.messageInput, { 
      state: 'visible' 
    });
    
    // Clear any existing text and type response
    await this.page.fill(this.selectors.messageInput, '');
    await this.page.type(this.selectors.messageInput, response, { delay: 50 });
    
    // Send the message
    await this.page.click(this.selectors.sendButton);
    
    // Wait for message to be sent and AI response
    await this.waitForAIResponse();
  }

  /**
   * Wait for AI response after sending a message
   */
  async waitForAIResponse() {
    // Wait for typing indicator
    await this.page.waitForSelector(this.selectors.typingIndicator, { 
      state: 'visible',
      timeout: 5000 
    });
    
    // Wait for typing to finish
    await this.page.waitForSelector(this.selectors.typingIndicator, { 
      state: 'hidden',
      timeout: 30000 
    });
    
    // Wait for new AI message
    await this.page.waitForFunction(() => {
      const messages = document.querySelectorAll('[data-testid="ai-message"]');
      return messages.length > 0;
    }, { timeout: 15000 });
  }

  /**
   * Wait for validation to complete
   */
  async waitForValidation() {
    // Wait for any validation indicators to appear and disappear
    await this.page.waitForTimeout(2000); // Allow validation processing time
    
    try {
      // Wait for validation to complete (loading states to disappear)
      await this.page.waitForSelector('[data-testid="validation-loading"]', { 
        state: 'hidden',
        timeout: 10000 
      });
    } catch (e) {
      // Validation loading might not appear for fast responses
    }
  }

  /**
   * Complete an entire section with provided data
   */
  async completeSection(sectionName, sectionData) {
    for (const response of Object.values(sectionData)) {
      await this.answerQuestion(response);
      await this.waitForValidation();
    }
    
    // Wait for section completion
    await this.page.waitForFunction((section) => {
      const progressTracker = document.querySelector('[data-testid="progress-tracker"]');
      if (!progressTracker) return false;
      
      const sectionElement = progressTracker.querySelector(`[data-section="${section}"]`);
      return sectionElement && sectionElement.classList.contains('completed');
    }, sectionName, { timeout: 15000 });
  }

  /**
   * Complete all sections with provided data
   */
  async completeAllSections(sessionData) {
    const sectionOrder = [
      'introduction', 'goals', 'audience', 'userStories', 
      'requirements', 'metrics', 'openQuestions'
    ];
    
    for (const section of sectionOrder) {
      if (sessionData[section]) {
        await this.completeSection(section, sessionData[section]);
      }
    }
  }

  /**
   * Get the current session ID
   */
  async getSessionId() {
    try {
      const sessionElement = await this.page.waitForSelector(this.selectors.sessionId, { 
        timeout: 5000 
      });
      return await sessionElement.textContent();
    } catch (e) {
      // Try to get from localStorage if not visible in UI
      return await this.page.evaluate(() => {
        return localStorage.getItem('currentSessionId');
      });
    }
  }

  /**
   * Get responses for a specific section
   */
  async getSectionResponses(sectionName) {
    const messages = await this.page.$$eval(
      `${this.selectors.userMessage}[data-section="${sectionName}"]`,
      elements => elements.map(el => el.textContent.trim())
    );
    return messages;
  }

  /**
   * Edit a previous response by index
   */
  async editResponse(responseIndex, newText) {
    const userMessages = await this.page.$$(this.selectors.userMessage);
    if (responseIndex >= userMessages.length) {
      throw new Error(`Response index ${responseIndex} out of range`);
    }
    
    const messageElement = userMessages[responseIndex];
    await messageElement.hover();
    
    const editButton = await messageElement.$(this.selectors.editButton);
    await editButton.click();
    
    // Wait for edit mode
    const editInput = await this.page.waitForSelector('[data-testid="edit-input"]');
    await editInput.fill(newText);
    
    // Save edit
    await this.page.click('[data-testid="save-edit"]');
    await this.waitForValidation();
  }

  /**
   * Get error message if present
   */
  async getErrorMessage() {
    try {
      const errorElement = await this.page.waitForSelector(this.selectors.errorMessage, { 
        timeout: 3000 
      });
      return await errorElement.textContent();
    } catch (e) {
      return null;
    }
  }

  /**
   * Get validation error if present
   */
  async getValidationError() {
    try {
      const errorElement = await this.page.waitForSelector(this.selectors.validationError, { 
        timeout: 3000 
      });
      return await errorElement.textContent();
    } catch (e) {
      return null;
    }
  }

  /**
   * Retry a failed submission
   */
  async retryFailedSubmission() {
    const retryButton = await this.page.waitForSelector(this.selectors.retryButton, { 
      timeout: 5000 
    });
    await retryButton.click();
    await this.waitForAIResponse();
  }

  /**
   * Get session renewal prompt
   */
  async getSessionRenewalPrompt() {
    try {
      await this.page.waitForSelector(this.selectors.sessionRenewalPrompt, { 
        timeout: 3000 
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Renew expired session
   */
  async renewSession() {
    await this.page.click('[data-testid="renew-session"]');
    await this.waitForChatReady();
  }

  /**
   * Get conflict warning
   */
  async getConflictWarning() {
    try {
      await this.page.waitForSelector(this.selectors.conflictWarning, { 
        timeout: 3000 
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Resolve session conflict
   */
  async resolveConflict(strategy = 'keep-latest') {
    await this.page.selectOption(
      '[data-testid="conflict-resolution"]', 
      strategy
    );
    await this.page.click(this.selectors.resolveConflictButton);
    await this.waitForChatReady();
  }

  /**
   * Get all messages in the chat
   */
  async getAllMessages() {
    const aiMessages = await this.page.$$eval(
      this.selectors.aiMessage,
      elements => elements.map(el => ({
        type: 'ai',
        content: el.textContent.trim(),
        timestamp: el.getAttribute('data-timestamp')
      }))
    );
    
    const userMessages = await this.page.$$eval(
      this.selectors.userMessage,
      elements => elements.map(el => ({
        type: 'user',
        content: el.textContent.trim(),
        timestamp: el.getAttribute('data-timestamp')
      }))
    );
    
    // Combine and sort by timestamp
    const allMessages = [...aiMessages, ...userMessages];
    allMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    return allMessages;
  }

  /**
   * Clear chat history
   */
  async clearChat() {
    await this.page.click('[data-testid="clear-chat"]');
    await this.page.click('[data-testid="confirm-clear"]');
    await this.waitForChatReady();
  }

  /**
   * Export chat transcript
   */
  async exportChatTranscript() {
    const downloadPromise = this.page.waitForEvent('download');
    await this.page.click('[data-testid="export-chat"]');
    return await downloadPromise;
  }
}

module.exports = { ChatPage };