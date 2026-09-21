# Enterprise Succession Planning Dashboard with Automated Leadership Competency Gap Analysis Models

A production-ready, full-stack enterprise web application designed for organization-wide leadership succession planning, automated competency gap analysis, successor readiness evaluation, interactive assessment workflows, and AI-assisted role replacement modeling.

---

## 📌 Project Overview

- **Domain**: Full Stack Web Application / HR Analytics / Machine Learning / Role-Based Access Control (RBAC)
- **Team Lead**: Elamparuthi K P
- **Team Members**: Nivetha R, Yuvanraj B

---

## 🔑 Key Features & Role-Based Access Control (RBAC)

The system enforces strict permission boundaries across three distinct user roles:

### 1. 🏢 HR / Admin Role
- **Executive HR Dashboard**: Real-time organization metrics, total active employees, pending/completed assessments, gap alerts, and overall talent pipeline distribution.
- **Employee Directory**: Comprehensive CRUD management for organization staff, department tagging, and manager assignments.
- **Leadership Roles & Competencies**: Definition of critical leadership positions and key required competencies with target score benchmarks.
- **Assessment Management**: Create dynamic multi-question competency evaluation templates and dispatch test assignments.
- **Successor Planning Matrix**: View ranked candidates per leadership position based on weighted readiness algorithms.
- **AI-Assisted Analysis & Role Replacement**: Generate predictive candidate insights and execute automated role replacement modeling for unavailable leaders.
- **Reports & Data Export**: View system summaries and download structured CSV reports.

### 2. 👥 Manager Role
- **Team Management Dashboard**: Access direct-report team members, team readiness stats, and competency gap summaries.
- **Assessment Administration**: Assign created assessment templates to direct reports and monitor completion status.
- **Team Analytics**: Track team skill strengths and pinpoint critical leadership gaps.

### 3. 👤 Employee Role
- **Self-Service Personal Portal**: Access individual profile, target role metrics, and personal readiness score.
- **Assigned Assessments**: View pending tests assigned by managers or HR.
- **Interactive Test-Taking Interface**: Complete competency evaluations with live countdown timers, progress indicators, auto-save status, and instant grading.
- **Personal Competency Breakdown**: View individual competency scores, identified strength areas, and suggested development goals.
- **Data Isolation**: Strict permission guards ensure employees cannot view other staff records, manager dashboards, or organization-wide rankings.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite 5, Tailwind CSS, Lucide React Icons, Chart.js, react-chartjs-2, React Router DOM v6, Axios.
- **Backend**: Python 3.14 / 3.11+, Flask, Flask-CORS, Flask-SQLAlchemy, PyMySQL / PostgreSQL, Gunicorn.
- **Database**: MySQL (`succession_planning` database) with SQLite automatic fallback engine.
- **Machine Learning**: Python, Pandas, NumPy, Scikit-Learn (Random Forest Classifier), Joblib.

---

## 📐 System Architecture

```
                               ┌───────────────────────────────┐
                               │       USER BROWSERS           │
                               │  (HR / Manager / Employee)    │
                               └───────────────┬───────────────┘
                                               │
                                      HTTP / REST API Calls
                                               │
                                               ▼
                               ┌───────────────────────────────┐
                               │   Vercel / React Frontend     │
                               │        (Port 5173 / 3000)     │
                               └───────────────┬───────────────┘
                                               │
                                        Axios Interceptor
                                               │
                                               ▼
                               ┌───────────────────────────────┐
                               │   Render / Flask REST API     │
                               │           (Port 5000)         │
                               └───────┬───────────────┬───────┘
                                       │               │
                                       ▼               ▼
                       ┌──────────────────┐   ┌──────────────────┐
                       │ MySQL / Postgres │   │  Scikit-Learn    │
                       │     Database     │   │     ML Model     │
                       └──────────────────┘   └──────────────────┘
```

---

## 🧮 Business Logic Formulas

### 1. Automated Competency Gap Analysis
$$\text{Gap} = \max(0, \text{Required Score} - \text{Current Score})$$

- **Categorization**:
  - `0 – 10`: Low Gap
  - `11 – 20`: Medium Gap
  - `> 20`: High Gap (Critical Alert)
- **Status**:
  - `Current >= Required`: **Strength**
  - `Current < Required`: **Improvement Area**

### 2. Experience Score Normalization
$$\text{Experience Score} = \min\left(100.0, \frac{\text{Experience Years}}{10.0} \times 100.0\right)$$

### 3. Successor Readiness Weighted Score
$$\text{Readiness Score} = (\text{Competency Score} \times 0.40) + (\text{Performance Score} \times 0.25) + (\text{Experience Score} \times 0.15) + (\text{Leadership Score} \times 0.20)$$

- **Classification**:
  - `80 – 100%`: **High Readiness**
  - `60 – 79.99%`: **Medium Readiness**
  - `Below 60%`: **Low Readiness**

---

## 🤖 AI-Assisted Role Replacement Engine

When key executive personnel or department leads become **Unavailable** (leave, transition, or emergency absence), the system executes an automated replacement analysis:

1. **Vacancy Identification**: System marks the leader as `Unavailable` and identifies the vacant leadership role.
2. **Candidate Evaluation**: Scans active employees, compares target role required competencies against available employee skill scores.
3. **Multi-Factor Scoring**: Evaluates competency match %, readiness score, performance history, and relevant experience.
4. **Recommendation Generation**: Ranks replacement candidates and generates actionable development notes.
5. **Transparency**: Recommendations are clearly labeled **"AI-Assisted Recommendation"** to support human HR decision-making.

---

## 🔄 Complete Assessment Workflow

```
┌──────────────┐     ┌───────────────────┐     ┌─────────────────┐
│ HR / Manager │ ──> │ Create Assessment │ ──> │ Assign Test to  │
│    Login     │     │     Template      │     │    Employee     │
└──────────────┘     └───────────────────┘     └────────┬────────┘
                                                        │
┌──────────────┐     ┌───────────────────┐              │
│ View Results │ <── │  Automated Grade  │ <────────────┘
│ & Analytics  │     │ & Gap Update      │
└──────────────┘     └───────────────────┘
```

---

## 🔐 Demo Credentials

Use the pre-seeded accounts for testing role-based access:

| Role | Username / Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **HR Admin** | `hr` or `hr@enterprise.com` | `hr123` | Full Access (All HR & Admin Pages) |
| **Manager** | `manager` or `manager@enterprise.com` | `manager123` | Team Management & Assessment Assignment |
| **Employee** | `employee` or `employee@enterprise.com` | `employee123` | Self-Service Portal & Test-Taking |

---

## 🚀 Local Quickstart Guide

### 1. Repository Setup
```bash
git clone https://github.com/ELAMPARUTHI234567/-Enterprise_Succession_Planning_Dashboard.git
cd -Enterprise_Succession_Planning_Dashboard
```

### 2. Backend Setup (Flask REST API)
```bash
cd backend
python -m venv venv
# On Windows: venv\Scripts\activate | On macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python app.py
```
*Backend runs at `http://localhost:5000` with health check endpoint at `http://localhost:5000/api/health`.*

### 3. Frontend Setup (React / Vite)
```bash
cd ../frontend
npm install
cp .env.example .env
npm run dev
```
*Frontend runs at `http://localhost:5173` (or `http://localhost:3000`).*

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)
```ini
VITE_API_URL=http://localhost:5000/api
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/succession_planning
SECRET_KEY=your_secret_key_here
JWT_SECRET_KEY=your_jwt_secret_key_here
USE_SQLITE=false
CORS_ORIGINS=http://localhost:5173,https://your-app.vercel.app
```

### Frontend (`frontend/.env`)
```ini
VITE_API_URL=http://localhost:5000/api
```

---

## 🌐 Production Deployment Guide

### Frontend Deployment (Vercel)
1. Push code to GitHub repository.
2. Import project into Vercel and set Root Directory to `frontend`.
3. Add Environment Variable:
   - `VITE_API_URL`: `https://your-backend-api.onrender.com/api`
4. Deploy! Vercel automatically builds using `npm run build`.

### Backend Deployment (Render / Railway)
1. Create a new Web Service on Render/Railway pointing to the `backend` directory.
2. Set Build Command: `pip install -r requirements.txt`
3. Set Start Command: `gunicorn app:app`
4. Add Environment Variables:
   - `DATABASE_URL`: Production MySQL/PostgreSQL connection string
   - `SECRET_KEY`: Production secret key
   - `JWT_SECRET_KEY`: Production JWT secret key
   - `CORS_ORIGINS`: `https://your-frontend.vercel.app`
5. Verify deployment via `GET /api/health`.

---

## 📂 Project Structure

```
Enterprise_Succession_Planning_Dashboard/
│
├── frontend/
│   ├── src/
│   │   ├── components/         # Reusable UI components & cards
│   │   ├── layouts/            # Sidebar & header layout wrapper
│   │   ├── pages/              # Role-specific dashboard pages
│   │   ├── services/           # Axios API service client
│   │   └── App.jsx             # RBAC route protection & router
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── backend/
│   ├── app.py                  # Application entrypoint & health check
│   ├── config.py               # Database & environment configurations
│   ├── extensions.py           # SQLAlchemy & CORS extensions
│   ├── models/                 # Database schema models
│   ├── routes/                 # REST API blueprints
│   ├── services/               # Core gap analysis & readiness engine
│   ├── utils/                  # Data seeding & setup scripts
│   └── requirements.txt
│
├── database/
│   └── schema.sql              # MySQL DDL relational schema
│
├── ml/
│   ├── dataset/                # Model training datasets
│   ├── model/                  # Trained Joblib model artifacts
│   ├── train.py                # Model training pipeline
│   └── predict.py              # ML prediction pipeline
│
├── .gitignore
├── .env.example
└── README.md
```
