# REST API Reference Documentation

Base URL: `http://localhost:5000/api`

---

## 1. Authentication Endpoints

### `POST /api/login`
Authenticates HR / Admin credentials.

- **Request Body**:
  ```json
  {
    "username": "admin",
    "password": "admin123"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "user": { "id": 1, "username": "admin", "role": "Admin" },
      "token": "demo-jwt-token-enterprise-succession-2026",
      "message": "Login successful"
    }
  }
  ```

---

## 2. Employee Management Endpoints

### `GET /api/employees`
Returns list of all employees with baseline readiness ratings. Optional query params: `search`, `department`.

### `GET /api/employees/<id>`
Returns single employee detailed profile, competency scores, gap analysis, and readiness rating. Optional query param: `role_id`.

### `POST /api/employees`
Creates a new employee profile.

### `PUT /api/employees/<id>`
Updates existing employee profile details.

### `DELETE /api/employees/<id>`
Deletes an employee record.

---

## 3. Leadership Roles & Competencies Endpoints

### `GET /api/roles`
Returns all leadership roles with target required competency benchmarks.

### `POST /api/roles/<role_id>/competencies`
Updates target required competency scores for a leadership role.

### `GET /api/competencies`
Returns core competency dictionary.

---

## 4. Assessment & Gap Analysis Endpoints

### `POST /api/assessments`
Submits employee competency assessment, recalculates gap levels, updates readiness scores, and records result.

### `GET /api/gap-analysis/<employee_id>/<role_id>`
Computes automated competency gap analysis between employee current scores and role benchmarks.

---

## 5. Successor Ranking & Analytics Endpoints

### `GET /api/successors/<role_id>`
Ranks all candidates for a target leadership role sorted by readiness score descending.

### `GET /api/dashboard-summary`
Returns KPI counts, chart metrics, and top potential successor spotlight.

### `GET /api/analytics`
Returns deep enterprise analytics (department distributions, competency averages, gap severity breakdowns).

---

## 6. Machine Learning Prediction Endpoint

### `POST /api/predict-readiness`
Executes Random Forest model inference for a candidate.

- **Request Body**:
  ```json
  {
    "employee_id": 1,
    "role_id": 1
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "prediction_id": 1,
      "employee_id": 1,
      "employee_name": "Arun Kumar",
      "predicted_class": "High",
      "probabilities": {
        "High": 0.8800,
        "Medium": 0.1000,
        "Low": 0.0200
      },
      "disclaimer": "Machine Learning results are demonstration results based on synthetic data."
    }
  }
  ```

---

## 7. Export & Reports Endpoints

### `GET /api/reports/summary`
Returns summary report dataset.

### `GET /api/reports/export-csv?type=readiness|gaps|employees`
Downloads CSV report export.
