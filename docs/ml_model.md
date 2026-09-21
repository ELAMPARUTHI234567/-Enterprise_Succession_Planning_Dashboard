# Machine Learning Model Documentation

## Automated Leadership Successor Readiness Prediction Model

### 1. Model Overview

The machine learning module implements a Scikit-Learn `RandomForestClassifier` trained on a synthetic dataset of 400 employee capability profiles. The model predicts candidate readiness levels (`High`, `Medium`, `Low`) and provides probability distributions across all classes.

---

### 2. Feature Vector Schema

The feature vector consists of 10 numerical features:

| Feature Name | Description | Range |
| :--- | :--- | :--- |
| `leadership_score` | Guidance and vision capability | 0 – 100 |
| `communication_score` | Executive and technical communication rating | 0 – 100 |
| `decision_making_score` | Data-driven action capability | 0 – 100 |
| `team_management_score` | Conflict resolution and mentoring rating | 0 – 100 |
| `strategic_thinking_score` | Long-term planning rating | 0 – 100 |
| `problem_solving_score` | Analytical troubleshooting score | 0 – 100 |
| `adaptability_score` | Flexibility in market/agile transformations | 0 – 100 |
| `technical_knowledge_score` | Operational domain expertise score | 0 – 100 |
| `performance_score` | Annual performance score | 0 – 100 |
| `experience_years` | Total professional tenure | 0 – 30 Yrs |

**Target Variable**: `readiness_level` (`High`, `Medium`, `Low`)

---

### 3. Model Hyperparameters & Training Configuration

- **Algorithm**: `RandomForestClassifier`
- **Trees (`n_estimators`)**: 100
- **Max Depth**: 10
- **Random State**: 42
- **Class Weight**: `balanced`
- **Train/Test Split**: 80% Training (320 samples), 20% Testing (80 samples stratified)
- **Model Output Artifact**: `ml/model/random_forest_model.joblib`

---

### 4. Empirical Evaluation Results

Actual metrics produced by model training on the test set:

- **Accuracy**: **92.50%**
- **Precision**: **92.58%**
- **Recall**: **92.50%**
- **F1-Score**: **92.51%**

#### Confusion Matrix (Labels: High, Medium, Low)
```
          Predicted High   Predicted Medium   Predicted Low
Actual High     26                2                0
Actual Medium    1               30                2
Actual Low       0                1               18
```

#### Feature Importances
1. `performance_score`: **23.22%**
2. `leadership_score`: **17.88%**
3. `strategic_thinking_score`: **14.13%**
4. `team_management_score`: **10.22%**
5. `adaptability_score`: **8.43%**
6. `decision_making_score`: **6.42%**
7. `communication_score`: **5.32%**
8. `experience_years`: **5.29%**
9. `technical_knowledge_score`: **4.92%**
10. `problem_solving_score`: **4.17%**

---

### 5. Synthetic Data Disclaimer

> [!IMPORTANT]
> Machine Learning results are demonstration results trained on synthetic/sample data and are not validated for real organizational HR decision-making.
