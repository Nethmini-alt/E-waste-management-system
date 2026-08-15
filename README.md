# E-Waste Management System

**SE3090 - Assignment 1 | Group XX**

## Team
| Student | Component | Agentic AI Role |
|---------|-----------|-----------------|
| Student 1 | Component A – Generator & Submission | Analyzer Agent |
| Student 2 | Component B – Collection & Logistics | Matcher Agent |
| Student 3 | Component C – Processing & Inventory | Validator Agent |
| Student 4 | Component D – Sales, Pricing & Export | Planner Agent |

## Technology Stack
- Backend: ASP.NET Core 8 Web API + Entity Framework Core
- Database: PostgreSQL
- Web Frontend: React + Vite
- Mobile: Flutter
- Agentic AI: LangGraph (Python)

## Project Structure
/
├── backend/              # ASP.NET Core Web API
├── frontend-react/       # React Admin + Staff App
├── mobile-flutter/       # Flutter Mobile App
├── agentic-ai/           # Python Agentic AI Service
├── docs/                 # ADRs, diagrams, reports
└── .github/workflows/    # CI/CD


## Getting Started
(Instructions will be added soon)

## Branching Strategy
- `main` → stable
- `develop` → integration branch
- Feature branches: `feature/component-a-...`, etc.

**Rules:**
- Never push directly to `main`
- All work must be done in feature branches
- Create a Pull Request into `develop`
- After review, merge into `develop
