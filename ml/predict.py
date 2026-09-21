import os
import joblib
import pandas as pd
from preprocessing import FEATURE_COLUMNS

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model", "random_forest_model.joblib")

_MODEL_CACHE = None

def get_trained_model():
    global _MODEL_CACHE
    if _MODEL_CACHE is None:
        if not os.path.exists(MODEL_PATH):
            # Fallback: train on the fly if model file doesn't exist
            from train import train_model
            train_model(model_output_path=MODEL_PATH)
        _MODEL_CACHE = joblib.load(MODEL_PATH)
    return _MODEL_CACHE

def predict_readiness(features):
    """
    Accepts a dictionary of feature values or list of feature values in order of FEATURE_COLUMNS.
    Returns prediction dictionary:
    {
        "prediction": "High" | "Medium" | "Low",
        "probabilities": {
            "High": 0.85,
            "Medium": 0.12,
            "Low": 0.03
        }
    }
    """
    model_data = get_trained_model()
    classifier = model_data["model"]

    if isinstance(features, dict):
        row = [features.get(col, 50.0) for col in FEATURE_COLUMNS]
    else:
        row = list(features)

    df_input = pd.DataFrame([row], columns=FEATURE_COLUMNS)

    predicted_class = classifier.predict(df_input)[0]
    probs = classifier.predict_proba(df_input)[0]

    classes = classifier.classes_
    prob_dict = {str(cls): round(float(prob), 4) for cls, prob in zip(classes, probs)}

    # Ensure all three classes exist in probability dict
    for c in ["High", "Medium", "Low"]:
        if c not in prob_dict:
            prob_dict[c] = 0.0

    return {
        "prediction": str(predicted_class),
        "probabilities": prob_dict
    }

if __name__ == "__main__":
    test_sample = {
        "leadership_score": 85.0,
        "communication_score": 88.0,
        "decision_making_score": 80.0,
        "team_management_score": 85.0,
        "strategic_thinking_score": 82.0,
        "problem_solving_score": 90.0,
        "adaptability_score": 85.0,
        "technical_knowledge_score": 92.0,
        "performance_score": 90.0,
        "experience_years": 8.0
    }
    result = predict_readiness(test_sample)
    print("\nTest Prediction Result:")
    print(result)
