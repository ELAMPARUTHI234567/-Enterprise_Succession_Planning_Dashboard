import logging
import time
from extensions import db
from models.competency import Competency
from models.employee_competency import EmployeeCompetency
from models.employee import Employee
from models.role_competency import RoleCompetency
from sqlalchemy import func

logger = logging.getLogger(__name__)

_COMP_INTEL_CACHE = {}
_COMP_INTEL_CACHE_TTL = 60 # 60 seconds

def clear_competency_intelligence_cache():
    _COMP_INTEL_CACHE.clear()

def get_competency_intelligence(manager_id=None, department=None, force_refresh=False):
    """
    Module 3: Enterprise & Team Competency Gap Intelligence across the 8 core dimensions:
    Leadership, Communication, Decision Making, Team Management, Strategic Thinking,
    Problem Solving, Adaptability, Technical Knowledge.
    
    Supports filtering by manager (for Manager Portal) or department.
    """
    cache_key = f"{manager_id}:{department}"
    now = time.time()
    if not force_refresh and cache_key in _COMP_INTEL_CACHE:
        entry = _COMP_INTEL_CACHE[cache_key]
        if now - entry["timestamp"] < _COMP_INTEL_CACHE_TTL:
            return entry["data"]
    # 1. Base employee query
    emp_query = Employee.query.filter(Employee.availability_status != 'Unavailable')
    if manager_id:
        emp_query = emp_query.filter(Employee.manager_id == manager_id)
    if department:
        emp_query = emp_query.filter(Employee.department == department)

    employees = emp_query.all()
    emp_ids = [e.id for e in employees]

    if not emp_ids:
        return {
            "success": True,
            "total_employees": 0,
            "dimensions": [],
            "critical_gaps": [],
            "top_strengths": [],
            "department_breakdown": {},
            "ai_insights": "No active employees found for competency intelligence analysis."
        }

    # 2. Query average scores for each competency
    avg_scores_query = db.session.query(
        EmployeeCompetency.competency_id,
        func.avg(EmployeeCompetency.score).label("avg_score"),
        func.count(EmployeeCompetency.id).label("eval_count")
    ).filter(
        EmployeeCompetency.employee_id.in_(emp_ids)
    ).group_by(
        EmployeeCompetency.competency_id
    ).all()

    avg_map = {row.competency_id: round(float(row.avg_score), 1) for row in avg_scores_query}

    # 3. Query role required benchmarks (average required score across roles)
    role_benchmarks_query = db.session.query(
        RoleCompetency.competency_id,
        func.avg(RoleCompetency.required_score).label("avg_required")
    ).group_by(
        RoleCompetency.competency_id
    ).all()

    req_map = {row.competency_id: round(float(row.avg_required), 1) for row in role_benchmarks_query}

    # 4. Process all 8 competencies
    all_comps = Competency.query.order_by(Competency.id).all()
    dimensions = []
    critical_gaps = []
    top_strengths = []

    for comp in all_comps:
        curr_score = avg_map.get(comp.id, 0.0)
        target_score = req_map.get(comp.id, 80.0)
        gap = round(max(0.0, target_score - curr_score), 1)
        pct_achieved = round((curr_score / target_score) * 100.0, 1) if target_score > 0 else 100.0

        if gap == 0 or curr_score >= target_score:
            status = "Strength"
            severity = "Low"
        elif gap <= 15.0:
            status = "Moderate Gap"
            severity = "Medium"
        else:
            status = "Critical Gap"
            severity = "High"

        dim_data = {
            "competency_id": comp.id,
            "name": comp.name,
            "description": comp.description or f"Core capability in {comp.name}",
            "current_score": curr_score,
            "target_benchmark": target_score,
            "gap": gap,
            "achievement_pct": min(100.0, pct_achieved),
            "status": status,
            "severity": severity,
            "recommended_training": _get_training_recommendation(comp.name, gap)
        }
        dimensions.append(dim_data)

        if severity == "High":
            critical_gaps.append(dim_data)
        elif status == "Strength":
            top_strengths.append(dim_data)

    # Sort critical gaps descending by gap
    critical_gaps.sort(key=lambda x: x["gap"], reverse=True)
    top_strengths.sort(key=lambda x: x["current_score"], reverse=True)

    # 5. Department Breakdown
    dept_breakdown = {}
    if not manager_id:
        dept_rows = db.session.query(
            Employee.department,
            func.avg(EmployeeCompetency.score).label("dept_avg"),
            func.count(func.distinct(Employee.id)).label("emp_count")
        ).join(
            EmployeeCompetency, Employee.id == EmployeeCompetency.employee_id
        ).filter(
            Employee.availability_status != 'Unavailable'
        ).group_by(
            Employee.department
        ).all()

        for d_row in dept_rows:
            if d_row.department:
                dept_breakdown[d_row.department] = {
                    "average_score": round(float(d_row.dept_avg or 0.0), 1),
                    "employee_count": d_row.emp_count
                }

    # 6. Synthesize AI narrative
    if critical_gaps:
        top_gap_names = ", ".join([g["name"] for g in critical_gaps[:2]])
        ai_narrative = (
            f"Enterprise competency intelligence identifies critical gaps in {top_gap_names} "
            f"(average deficit of {critical_gaps[0]['gap']} pts below leadership benchmarks). "
            f"Prioritize targeted acceleration programs to mitigate leadership bench risk."
        )
    else:
        ai_narrative = (
            "Workforce competency distribution indicates healthy alignment with leadership targets. "
            "Continuous reinforcement through advanced executive simulations recommended."
        )

    result = {
        "success": True,
        "total_employees": len(employees),
        "scope": f"Manager #{manager_id}" if manager_id else "Enterprise-wide",
        "dimensions": dimensions,
        "critical_gaps": critical_gaps,
        "top_strengths": top_strengths,
        "department_breakdown": dept_breakdown,
        "ai_insights": ai_narrative
    }
    _COMP_INTEL_CACHE[cache_key] = {
        "timestamp": now,
        "data": result
    }
    return result

def _get_training_recommendation(comp_name, gap):
    catalog = {
        "Leadership": "Executive Mentorship & Strategic Vision Accelerator (4-week cohort)",
        "Strategic Thinking": "Scenario-Based Strategic Planning & Enterprise Risk Workshop",
        "Communication": "Executive Presence, Stakeholder Negotiation & High-Stakes Storytelling",
        "Decision Making": "Data-Driven Decision Frameworks & Crisis Management Simulation",
        "Team Management": "High-Performance Team Leadership & Delegation Masterclass",
        "Problem Solving": "Root-Cause Architecture & Critical Systems Analysis Labs",
        "Adaptability": "Agile Transformation Leadership & Cross-Functional Resilience Labs",
        "Technical Knowledge": "Modern Distributed Architectures & System Design Deep-Dive"
    }
    base = catalog.get(comp_name, f"Advanced {comp_name} Leadership Workshop")
    if gap > 20:
        return f"{base} (Urgent 6-week intensive)"
    elif gap > 10:
        return f"{base} (Recommended 4-week program)"
    else:
        return f"{base} (Elective development module)"
