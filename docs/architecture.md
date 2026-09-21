# System Architecture Blueprint

## Enterprise Succession Planning Dashboard with Automated Leadership Competency Gap Analysis Models

### 1. Architectural Overview

The application adopts a decoupled, multi-tier micro-services architecture designed for enterprise scalability, real-time analytics, and automated decision support.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PRESENTATION LAYER                               │
│            React.js SPA (Vite + Tailwind CSS + Chart.js + Lucide)           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Axios HTTP / REST APIs
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            APPLICATION/API LAYER                            │
│           Python Flask REST API Framework (Blueprints + CORS)               │
└──────────────┬───────────────────────┬────────────────────────┬─────────────┘
               │                       │                        │
               ▼                       ▼                        ▼
┌──────────────────────────┐┌──────────────────────┐┌──────────────────────┐
│     DATABASE LAYER       ││BUSINESS LOGIC ENGINE ││   MACHINE LEARNING   │
│  MySQL (with SQLite      ││ Automated Competency ││ Scikit-Learn Random  │
│  fallback engine)        ││ Gap & Readiness      ││ Forest Classifier    │
└──────────────────────────┘└──────────────────────┘└──────────────────────┘
```

---

### 2. Core Layers & Responsibilities

#### A. Presentation Layer (React.js Frontend)
- Built with React 18 and Vite for fast bundling.
- Styled using a customized Tailwind CSS enterprise design system (Deep Navy `#0f172a`, Indigo accents, Emerald for High Readiness, Amber for Medium, Rose for High Gaps).
- Interactive Chart.js visualizations (Bar charts, Spider radar charts, Doughnut pie charts).
- Centralized Axios API service with automatic token injection and unified error handling.

#### B. API & Application Layer (Python Flask Backend)
- Structured using Flask Blueprints (`auth`, `employees`, `roles`, `competencies`, `assessments`, `gap_analysis`, `successors`, `dashboard`, `analytics`, `ml`, `reports`).
- SQLAlchemy ORM database layer mapping model schemas.
- Automatic database table creation and seed data populator for seamless local environment execution.

#### C. Business Logic Engine
1. **Automated Competency Gap Analysis**:
   - `Gap = max(0, Required Score - Current Score)`
   - Gap level classification:
     - 0 – 10: Low Gap
     - 11 – 20: Medium Gap
     - > 20: High Gap (Critical Alert)
   - Status:
     - `Current >= Required`: Strength
     - `Current < Required`: Improvement Area
2. **Successor Readiness Calculation**:
   - Normalized Experience Score: `min(100.0, (Experience Years / 10.0) * 100.0)`
   - Weighted Formula:
     `Readiness Score = (Competency Score * 0.40) + (Performance Score * 0.25) + (Experience Score * 0.15) + (Leadership Score * 0.20)`
   - Classification:
     - 80.0 – 100.0%: High Readiness
     - 60.0 – 79.99%: Medium Readiness
     - Below 60.0%: Low Readiness

#### D. Machine Learning Layer
- Scikit-Learn `RandomForestClassifier` model trained on synthetic employee competency dataset (400 samples).
- Features: 8 core competency scores + performance score + experience years.
- Model persistence via `joblib`.
- Endpoint `/api/predict-readiness` loads saved model artifact and outputs class predictions and probability distributions.
