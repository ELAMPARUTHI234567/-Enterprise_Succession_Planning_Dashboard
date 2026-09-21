import os
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, classification_report
from preprocessing import load_and_preprocess_data, FEATURE_COLUMNS, TARGET_COLUMN
from dataset.generate_dataset import generate_synthetic_dataset

def train_model(dataset_path="ml/dataset/succession_dataset.csv", model_output_path="ml/model/random_forest_model.joblib"):
    # Ensure dataset exists
    if not os.path.exists(dataset_path):
        print("[INFO] Generating synthetic dataset first...")
        generate_synthetic_dataset(output_path=dataset_path, num_samples=400)

    print("[INFO] Loading and preprocessing dataset...")
    X_train, X_test, y_train, y_test, full_df = load_and_preprocess_data(dataset_path)

    print(f"[INFO] Dataset shape: {full_df.shape}. Train set: {X_train.shape[0]}, Test set: {X_test.shape[0]}")

    # Initialize Random Forest Classifier
    rf_classifier = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        random_state=42,
        class_weight="balanced"
    )

    print("[INFO] Training Random Forest model...")
    rf_classifier.fit(X_train, y_train)

    # Evaluate model
    y_pred = rf_classifier.predict(X_test)

    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, average="weighted")
    recall = recall_score(y_test, y_pred, average="weighted")
    f1 = f1_score(y_test, y_pred, average="weighted")
    conf_mat = confusion_matrix(y_test, y_pred, labels=["High", "Medium", "Low"])

    print("\n" + "="*50)
    print("       RANDOM FOREST MODEL EVALUATION METRICS       ")
    print("="*50)
    print(f"Accuracy:  {accuracy * 100:.2f}%")
    print(f"Precision: {precision * 100:.2f}%")
    print(f"Recall:    {recall * 100:.2f}%")
    print(f"F1-Score:  {f1 * 100:.2f}%")
    print("\nConfusion Matrix (Labels: High, Medium, Low):")
    print(conf_mat)
    print("\nDetailed Classification Report:")
    print(classification_report(y_test, y_pred))
    print("="*50 + "\n")

    # Feature Importances
    importances = dict(zip(FEATURE_COLUMNS, rf_classifier.feature_importances_))
    print("Feature Importances:")
    for feat, imp in sorted(importances.items(), key=lambda x: x[1], reverse=True):
        print(f" - {feat:30s}: {imp:.4f}")

    # Save model and metadata
    os.makedirs(os.path.dirname(model_output_path), exist_ok=True)
    joblib_payload = {
        "model": rf_classifier,
        "feature_columns": FEATURE_COLUMNS,
        "classes": rf_classifier.classes_.tolist(),
        "metrics": {
            "accuracy": round(accuracy, 4),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(f1, 4)
        }
    }
    joblib.dump(joblib_payload, model_output_path)
    print(f"[SUCCESS] Model successfully saved to {model_output_path}")

    return joblib_payload

if __name__ == "__main__":
    train_model()
