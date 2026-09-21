import os
import sys

# Add ML directory to sys.path to import predict module
ML_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "ml"))
if ML_DIR not in sys.path:
    sys.path.insert(0, ML_DIR)

from models.employee import Employee
from models.employee_competency import EmployeeCompetency
from models.competency import Competency
from models.ml_prediction import MLPrediction
from extensions import db

def run_ml_readiness_prediction(employee_id, role_id):
    """
    Fetches employee competency profile, constructs feature vector, calls Random Forest model predict function,
    stores result in ml_predictions table, and returns prediction details.
    """
    employee = Employee.query.get(employee_id)
    if not employee:
        return {"success": False, "message": "Employee not found"}

    # Fetch employee competency scores
    emp_competencies = EmployeeCompetency.query.filter_by(employee_id=employee_id).all()
    score_map = {ec.competency_id: ec.score for ec in emp_competencies}
    
    competencies = Competency.query.all()
    comp_map = {c.name.lower().replace(" ", "_") + "_score": score_map.get(c.id, 50.0) for c in competencies}

    # Construct feature dictionary required by Random Forest model
    features = {
        "leadership_score": comp_map.get("leadership_score", employee.leadership_score),
        "communication_score": comp_map.get("communication_score", 70.0),
        "decision_making_score": comp_map.get("decision_making_score", 70.0),
        "team_management_score": comp_map.get("team_management_score", 70.0),
        "strategic_thinking_score": comp_map.get("strategic_thinking_score", 70.0),
        "problem_solving_score": comp_map.get("problem_solving_score", 70.0),
        "adaptability_score": comp_map.get("adaptability_score", 70.0),
        "technical_knowledge_score": comp_map.get("technical_knowledge_score", 70.0),
        "performance_score": employee.performance_score,
        "experience_years": employee.experience_years
    }

    try:
        from predict import predict_readiness
        pred_res = predict_readiness(features)
        
        predicted_class = pred_res["prediction"]
        probs = pred_res["probabilities"]

        high_prob = float(probs.get("High", 0.0))
        med_prob = float(probs.get("Medium", 0.0))
        low_prob = float(probs.get("Low", 0.0))

        # Save to database
        ml_record = MLPrediction(
            employee_id=employee_id,
            role_id=role_id,
            predicted_class=predicted_class,
            high_probability=high_prob,
            medium_probability=med_prob,
            low_probability=low_prob
        )
        db.session.add(ml_record)
        db.session.commit()

        return {
            "success": True,
            "data": {
                "prediction_id": ml_record.id,
                "employee_id": employee_id,
                "employee_name": employee.name,
                "role_id": role_id,
                "predicted_class": predicted_class,
                "probabilities": {
                    "High": high_prob,
                    "Medium": med_prob,
                    "Low": low_prob
                },
                "disclaimer": "Machine Learning results are demonstration results based on synthetic data."
            }
        }
    except Exception as e:
        return {"success": False, "message": f"ML prediction error: {str(e)}"}
