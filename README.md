# AI-Powered PRD Generator

An intelligent web application that guides users through creating comprehensive Product Requirements Documents (PRDs) via conversational AI. The system extracts necessary information through targeted questioning, validates responses, and generates professional PRDs in markdown format.

## 🚀 Features

- **Conversational AI Interface**: Natural language interaction for information gathering
- **Section-by-Section Workflow**: Guided progression through 7 key PRD sections
- **Intelligent Validation**: Quality scoring (0-100) with adaptive questioning
- **Real-time Preview**: Live PRD generation with editing capabilities
- **Context Persistence**: Information carries across sections to prevent redundancy
- **Export Functionality**: Export to Markdown, with PDF support planned

## 📋 PRD Sections

1. **Introduction/Overview** - Product description, problem statement, value proposition
2. **Goals/Objectives** - Business objectives and success criteria
3. **Target Audience** - User personas, demographics, market analysis
4. **User Stories** - Feature requirements in user story format
5. **Functional Requirements** - Detailed technical specifications
6. **Success Metrics** - KPIs, measurement methods, targets
7. **Open Questions** - Risks, assumptions, future considerations

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend UI   │────▶│   Backend API    │────▶│  AI Service     │
│  (React/Next.js)│◀────│  (Node.js/Express)│◀────│  (OpenAI)       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                         
         ▼                       ▼                         
┌─────────────────┐     ┌──────────────────┐              
│  State Manager  │     │    Database      │              
│   (Zustand)     │     │  (PostgreSQL)    │              
└─────────────────┘     └──────────────────┘              
```

## 🛠️ Technology Stack

### Backend
- **Framework**: Node.js with Express
- **Database**: PostgreSQL with Sequelize ORM
- **Cache**: Redis for session management
- **AI Integration**: OpenAI API
- **Authentication**: JWT with bcrypt
- **Validation**: Joi for input validation
- **Testing**: Jest with Supertest

### Frontend
- **Framework**: React with Next.js
- **State Management**: Zustand + React Query
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with Lucide icons
- **Markdown**: React Markdown with syntax highlighting
- **Testing**: Jest with React Testing Library

### DevOps
- **Containerization**: Docker with Docker Compose
- **Development**: Hot reload for both frontend and backend
- **Database**: PostgreSQL and Redis containers
- **Reverse Proxy**: Nginx (production)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 8+
- Docker and Docker Compose
- OpenAI API key

### 1. Clone and Setup

```bash
git clone <repository-url>
cd prd-maker

# Copy environment variables
cp .env.example .env

# Edit .env file with your configuration
# REQUIRED: Add your OpenAI API key
```

### 2. Docker Development (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Access applications
# Frontend: http://localhost:3000
# Backend API: http://localhost:3001
# Database: localhost:5432
```

### 3. Local Development

#### Backend Setup

```bash
cd backend
npm install

# Setup database
npm run db:migrate
npm run db:seed

# Start development server
npm run dev
```

#### Frontend Setup

```bash
cd frontend
npm install

# Start development server
npm run dev
```

## 📊 Development Workflow

### Testing

```bash
# Backend tests
cd backend
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report

# Frontend tests
cd frontend
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

### Code Quality

```bash
# Linting
npm run lint            # Check code style
npm run lint:fix        # Fix auto-fixable issues

# Formatting
npm run format          # Format code with Prettier

# Type checking (frontend)
npm run type-check      # TypeScript type checking
```

### Database Management

```bash
cd backend

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed

# Create new migration
npx sequelize-cli migration:generate --name migration-name

# Create new seed
npx sequelize-cli seed:generate --name seed-name
```

## 🔧 Configuration

### Environment Variables

Key configuration options (see `.env.example` for complete list):

```env
# Required
OPENAI_API_KEY=sk-your-openai-api-key-here
DATABASE_URL=postgresql://user:password@localhost:5432/prd_generator
JWT_SECRET=your-jwt-secret-key

# Optional
NODE_ENV=development
PORT=3001
REDIS_URL=redis://localhost:6379
```

### AI Configuration

```env
OPENAI_MODEL=gpt-4              # AI model to use
OPENAI_TEMPERATURE=0.7          # Response creativity (0-1)
OPENAI_MAX_TOKENS=2000          # Response length limit
AI_RATE_LIMIT_PER_HOUR=100      # API rate limiting
```

## 📁 Project Structure

```
prd-maker/
├── backend/                    # Node.js API server
│   ├── src/
│   │   ├── controllers/        # Request handlers
│   │   ├── services/          # Business logic
│   │   ├── models/            # Database models
│   │   ├── routes/            # API routes
│   │   ├── middleware/        # Express middleware
│   │   ├── utils/             # Helper utilities
│   │   └── config/            # Configuration files
│   ├── tests/                 # Backend tests
│   └── package.json
├── frontend/                   # React/Next.js application
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── services/          # API clients
│   │   ├── utils/             # Helper utilities
│   │   └── styles/            # CSS and styling
│   ├── public/                # Static assets
│   ├── tests/                 # Frontend tests
│   └── package.json
├── shared/                     # Shared TypeScript types
│   └── types/
├── docker-compose.yml          # Development environment
├── .env.example               # Environment template
└── README.md
```

## 🔄 API Endpoints

### Session Management
- `POST /api/sessions` - Create new PRD session
- `GET /api/sessions/:id` - Get session details
- `PUT /api/sessions/:id` - Update session
- `DELETE /api/sessions/:id` - Delete session

### Conversation Processing
- `POST /api/sessions/:id/messages` - Process user message
- `GET /api/sessions/:id/context` - Get conversation context
- `POST /api/sessions/:id/sections/:sectionId/validate` - Validate section

### PRD Generation
- `POST /api/sessions/:id/generate-prd` - Generate final PRD
- `GET /api/sessions/:id/prd/preview` - Get PRD preview
- `GET /api/sessions/:id/prd/export` - Export PRD

## 🎯 Validation System

The system implements intelligent validation with quality scoring:

### Quality Metrics (0-100 scale)
- **Completeness**: Presence of required information
- **Specificity**: Concrete details vs vague statements
- **Relevance**: Alignment with question intent
- **Clarity**: Structure and readability

### Validation Rules
- Each section has specific validation criteria
- Minimum quality thresholds per question type
- Maximum 2 clarification attempts before acceptance
- Context-aware validation to prevent redundancy

## 🚀 Deployment

### Production Build

```bash
# Build both applications
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Deploy with production configuration
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Environment-specific Deployment

```bash
# Staging
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 🔍 Monitoring & Debugging

### Logs

```bash
# View all logs
docker-compose logs -f

# Service-specific logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Health Checks

- Backend: `http://localhost:3001/health`
- Frontend: `http://localhost:3000/api/health`
- Database: Check via adminer or direct connection

### Performance Monitoring

- Application metrics: `/metrics` endpoint
- Database performance: Built-in PostgreSQL monitoring
- Redis monitoring: Redis CLI or GUI tools

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and add tests
4. Run quality checks: `npm run lint && npm test`
5. Commit your changes: `git commit -m 'Add some feature'`
6. Push to the branch: `git push origin feature/your-feature`
7. Submit a pull request

### Development Guidelines

- Follow the existing code style and patterns
- Write tests for new functionality
- Update documentation for API changes
- Use meaningful commit messages
- Ensure all tests pass before submitting PR

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- Create an issue for bugs or feature requests
- Check existing issues before creating new ones
- Provide detailed reproduction steps for bugs
- Include environment details and logs when applicable

## 🗺️ Roadmap

### Phase 1 (Current)
- ✅ Core conversation engine
- ✅ Basic PRD generation
- ✅ Section-by-section workflow
- 🔄 Validation and quality scoring

### Phase 2 (Planned)
- 📋 Multi-format export (PDF, DOCX)
- 👥 Team collaboration features
- 📊 Advanced analytics and insights
- 🎨 Custom PRD templates

### Phase 3 (Future)
- 🎤 Voice input support
- 🔗 Integration with project management tools
- 📈 Industry-specific PRD templates
- 🤖 Advanced AI suggestions and analysis

---

For detailed implementation guides and API documentation, see the `/docs` directory (coming soon).