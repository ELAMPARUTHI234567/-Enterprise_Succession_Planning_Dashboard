import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split

FEATURE_COLUMNS = [
    "leadership_score",
    "communication_score",
    "decision_making_score",
    "team_management_score",
    "strategic_thinking_score",
    "problem_solving_score",
    "adaptability_score",
    "technical_knowledge_score",
    "performance_score",
    "experience_years"
]

TARGET_COLUMN = "readiness_level"

def load_and_preprocess_data(csv_path="ml/dataset/succession_dataset.csv", test_size=0.2, random_state=42):
    """
    Loads dataset, handles missing values, cleans feature ranges, and performs stratified split.
    """
    df = pd.read_csv(csv_path)

    # 1. Fill missing numeric values with column median if any
    for col in FEATURE_COLUMNS:
        if col in df.columns and df[col].isnull().sum() > 0:
            df[col] = df[col].fillna(df[col].median())

    # 2. Drop rows missing target label
    df = df.dropna(subset=[TARGET_COLUMN])

    # 3. Clean numeric bounds
    for col in FEATURE_COLUMNS:
        if col != "experience_years":
            df[col] = df[col].clip(0.0, 100.0)
        else:
            df[col] = df[col].clip(0.0, 40.0)

    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN]

    # 4. Stratified Train / Test Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
    )

    return X_train, X_test, y_train, y_test, df
