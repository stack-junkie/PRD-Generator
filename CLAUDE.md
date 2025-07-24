# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains an **AI-powered PRD (Product Requirements Document) generator** designed to guide users through creating professional PRDs via conversational AI. The system is currently in the requirements/planning phase with detailed specifications in `prd-generator-requirements.md`.

## Development Commands

This project is still in the planning phase. Once implemented, it will likely use:
- Standard web development build tools (npm/yarn for frontend)
- Backend API framework commands (likely Node.js or Python)
- Testing framework commands
- Linting and formatting tools

**Current available commands:**
- See `serena/` subdirectory for Serena agent toolkit commands

## Architecture Overview

Based on the requirements document, the planned architecture includes:

### High-Level System Design
```
Frontend (React/Next.js) ↔ Backend API (Node.js/Python) ↔ AI Service (LLM)
         ↓                           ↓
    State Manager              Database (PostgreSQL)
```

### Core Components (Planned)

**Frontend Modules:**
- `ChatInterface.jsx` - Main conversational interface
- `ProgressTracker.jsx` - Visual progress through PRD sections
- `MessageList.jsx` - Conversation history display
- `PreviewPanel.jsx` - Real-time PRD preview and editing
- `ExportManager.jsx` - Document export functionality

**Backend Modules:**
- `ConversationManager.js` - Manages AI conversation flow and state
- `ValidationEngine.js` - Validates user responses for completeness/quality
- `ContextProcessor.js` - Extracts and maintains conversation context
- `DocumentBuilder.js` - Assembles final PRD from collected information
- `SessionManager.js` - User session and persistence handling

**AI Integration:**
- `ResponseAnalyzer.js` - Analyzes user input for information extraction
- `QuestionGenerator.js` - Creates contextual follow-up questions
- `QualityScorer.js` - Scores response quality (0-100 scale)

### Data Models (Planned)

Key data structures include:
- `UserSession` - Session state with progress tracking
- `Section` - Individual PRD sections with validation states
- `Question/Response` - Q&A pairs with quality scoring
- `PRDDocument` - Final structured document output

### PRD Generation Workflow

The system guides users through 7 main sections:
1. Introduction/Overview
2. Goals/Objectives  
3. Target Audience
4. User Stories
5. Functional Requirements
6. Success Metrics
7. Open Questions

Each section uses intelligent validation, quality scoring, and adaptive questioning based on previous responses.

## Serena Integration

This project includes **Serena**, a powerful coding agent toolkit located in the `serena/` subdirectory:

- Serena provides semantic code analysis and editing capabilities
- Supports 13+ programming languages via Language Server Protocol (LSP)
- Can be used as an MCP server for Claude Code integration
- See `serena/CLAUDE.md` for detailed Serena-specific guidance

**Serena Commands:**
- `cd serena && uv run serena-mcp-server` - Start Serena MCP server
- `cd serena && uv run poe test` - Run Serena tests
- `cd serena && uv run poe format` - Format Serena code

## Implementation Notes

### Validation Strategy
- Quality threshold of 70+ required for section completion
- Maximum 2 clarification attempts per response
- Context persistence across sections to avoid redundant questions
- Comprehensive validation rules per section type

### AI Behavior Specifications
- Max 4 questions per AI response
- Adaptive questioning based on response completeness
- Conversation compression for token management
- Section-specific prompt templates and scoring weights

### Security Considerations
- Input sanitization for all user responses
- Session-based access control
- XSS protection in frontend components
- Safe markdown rendering and export

## Development Approach

This project is designed for incremental development:
1. **Phase 1**: Core conversation engine and basic PRD generation
2. **Phase 2**: Advanced validation, quality scoring, and export features  
3. **Phase 3**: Multi-format export, team collaboration, version control

The requirements document provides comprehensive implementation details including API endpoints, component specifications, test strategies, and deployment configurations.

## Key Files

- `prd-generator-requirements.md` - Complete system specification and implementation guide
- `serena/` - Coding agent toolkit subproject
- `serena/CLAUDE.md` - Serena-specific development guidance