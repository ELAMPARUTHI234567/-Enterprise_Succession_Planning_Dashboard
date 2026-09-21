from flask import Blueprint, request, jsonify
from services.ml_service import run_ml_readiness_prediction
from models.employee import Employee
from models.role import LeadershipRole
from models.ai_recommendation import AIRecommendation
from services.gap_service import calculate_competency_gaps
from services.readiness_service import calculate_successor_readiness
from extensions import db
from datetime import datetime

ml_bp = Blueprint('ml', __name__)

@ml_bp.route('/predict-readiness', methods=['POST'])
def predict_readiness_route():
    data = request.get_json() or {}
    employee_id = data.get('employee_id')
    role_id = data.get('role_id', 1)

    if not employee_id:
        return jsonify({"success": False, "message": "employee_id is required"}), 400

    result = run_ml_readiness_prediction(employee_id, role_id)
    if not result["success"]:
        return jsonify(result), 400

    return jsonify(result), 200

@ml_bp.route('/ai/recommendation', methods=['POST'])
def generate_ai_recommendation():
    """
    POST /api/ai/recommendation
    Generates AI-Assisted Insights for an employee and leadership role.
    """
    data = request.get_json() or {}
    employee_id = data.get('employee_id')
    role_id = data.get('role_id', 1)

    if not employee_id:
        return jsonify({"success": False, "message": "employee_id is required"}), 400

    employee = Employee.query.get(employee_id)
    role = LeadershipRole.query.get(role_id)

    if not employee or not role:
        return jsonify({"success": False, "message": "Employee or Leadership Role not found"}), 404

    gap_data = calculate_competency_gaps(employee_id, role_id)
    readiness_data = calculate_successor_readiness(employee_id, role_id)

    # Determine strengths and development areas
    strengths = []
    development_areas = []

    for comp in gap_data.get("competencies", []):
        if comp["status"] == "Strength":
            strengths.append(comp["competency_name"])
        else:
            development_areas.append(f"{comp['competency_name']} (Gap: {comp['gap']} pts)")

    strengths_str = ", ".join(strengths[:3]) if strengths else "overall technical domain expertise"
    dev_str = ", ".join(development_areas[:2]) if development_areas else "advanced strategic planning"

    readiness_score = readiness_data["readiness_score"]
    readiness_lvl = readiness_data["readiness_level"]

    if readiness_score >= 80.0:
        conclusion = f"Employee {employee.name} exhibits HIGH readiness ({readiness_score}%) for the {role.role_name} role. Immediate succession candidate."
    elif readiness_score >= 60.0:
        conclusion = f"Employee {employee.name} shows strong potential ({readiness_score}%) for the {role.role_name} role after addressing identified competency gaps."
    else:
        conclusion = f"Employee {employee.name} requires structured mentoring and targeted training ({readiness_score}%) before assuming the {role.role_name} role."

    insights_text = (
        f"• Strengths: Strong {strengths_str} identified.\n"
        f"• Development Areas: {dev_str} require further development.\n"
        f"• AI Recommendation: {conclusion}"
    )

    rec = AIRecommendation(
        employee_id=employee_id,
        role_id=role_id,
        recommendation_type="Competency Analysis",
        recommendation_text=insights_text
    )
    db.session.add(rec)
    db.session.commit()

    return jsonify({
        "success": True,
        "data": {
            "employee_id": employee.id,
            "employee_name": employee.name,
            "role_id": role.id,
            "role_name": role.role_name,
            "readiness_score": readiness_score,
            "readiness_level": readiness_lvl,
            "strengths": strengths,
            "development_areas": development_areas,
            "insights": insights_text,
            "disclaimer": "AI-Assisted Insights are generated for decision-support purposes and should be reviewed alongside human HR evaluation."
        }
    }), 200

@ml_bp.route('/ai/role-replacement', methods=['POST'])
def role_replacement_recommendation():
    """
    POST /api/ai/role-replacement
    Simulates employee unavailablity scenario, identifies vacant role,
    evaluates all available employees, and returns AI-assisted candidate replacement recommendations.
    """
    data = request.get_json() or {}
    unavail_emp_id = data.get('employee_id')
    vacant_role_id = data.get('role_id')

    # If employee specified, set their status to Unavailable
    unavail_emp = None
    if unavail_emp_id:
        unavail_emp = Employee.query.get(unavail_emp_id)
        if unavail_emp:
            unavail_emp.availability_status = 'Unavailable'
            db.session.commit()

    if not vacant_role_id and unavail_emp:
        # Default to Project Manager (1) or Team Lead (2)
        vacant_role_id = 1

    vacant_role = LeadershipRole.query.get(vacant_role_id or 1)
    if not vacant_role:
        return jsonify({"success": False, "message": "Vacant role not found"}), 404

    # Find available candidates
    candidates_query = Employee.query.filter(Employee.availability_status == 'Available').all()

    ranked_candidates = []
    for cand in candidates_query:
        if unavail_emp and cand.id == unavail_emp.id:
            continue

        readiness = calculate_successor_readiness(cand.id, vacant_role.id)
        gap = calculate_competency_gaps(cand.id, vacant_role.id)

        # Match percentage calculation
        comp_match = round(readiness["competency_score"], 1)
        role_match = round((readiness["readiness_score"] * 0.9 + readiness["performance_score"] * 0.1), 1)

        ranked_candidates.append({
            "employee_id": cand.id,
            "employee_code": cand.employee_code,
            "name": cand.name,
            "designation": cand.designation,
            "department": cand.department,
            "experience_years": cand.experience_years,
            "performance_score": cand.performance_score,
            "competency_score": readiness["competency_score"],
            "readiness_score": readiness["readiness_score"],
            "readiness_level": readiness["readiness_level"],
            "competency_match": f"{comp_match}%",
            "role_match": f"{role_match}%",
            "major_gap": readiness["major_gap"],
            "recommendation_summary": f"{cand.name} demonstrates a {role_match}% role match with {readiness['readiness_level']} readiness level to replace {unavail_emp.name if unavail_emp else 'vacant position'} as {vacant_role.role_name}."
        })

    # Sort candidates by highest readiness score
    ranked_candidates.sort(key=lambda x: x["readiness_score"], reverse=True)

    return jsonify({
        "success": True,
        "data": {
            "vacant_role": {
                "id": vacant_role.id,
                "role_name": vacant_role.role_name,
                "department": vacant_role.department
            },
            "unavailable_employee": {
                "id": unavail_emp.id if unavail_emp else None,
                "name": unavail_emp.name if unavail_emp else "Unassigned Leadership Position",
                "designation": unavail_emp.designation if unavail_emp else "Leadership Role",
                "availability_status": "Unavailable"
            },
            "recommendation_count": len(ranked_candidates),
            "top_candidate": ranked_candidates[0] if ranked_candidates else None,
            "replacement_candidates": ranked_candidates[:5],
            "label": "AI-assisted replacement recommendation",
            "disclaimer": "This result is an AI-assisted recommendation to support succession decisions, not an automatic HR placement."
        }
    }), 200
