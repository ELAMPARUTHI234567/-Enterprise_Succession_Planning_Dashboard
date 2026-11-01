import logging
import re
from datetime import datetime
from extensions import db
from models.role import LeadershipRole
from models.employee import Employee
from models.assessment import Assessment, AssessmentAssignment
from services.successor_recommendation import get_top_3_successors
from services.competency_intelligence import get_competency_intelligence
from services.team_intelligence import get_team_intelligence
from services.executive_summary_service import get_hr_workforce_summary

logger = logging.getLogger(__name__)

def handle_ai_chat_query(user_query, user=None, current_employee=None):
    """
    Modules 5 & 8: AI HR & Manager Chat Assistant.
    Parses natural language queries and synthesizes factual, database-grounded answers.
    Enforces strict RBAC: Managers only receive intelligence for their direct reports.
    """
    if not user_query or not isinstance(user_query, str):
        return {
            "success": False,
            "reply": "Please enter a valid query.",
            "data": None,
            "suggested_prompts": []
        }

    q = user_query.strip().lower()
    is_manager = False
    is_hr = True

    if user and user.role.lower() == 'manager':
        is_manager = True
        is_hr = False

    mgr_emp_id = None
    if is_manager:
        if current_employee:
            mgr_emp_id = current_employee.id
        elif user:
            emp = Employee.query.filter_by(user_id=user.id).first()
            if emp:
                mgr_emp_id = emp.id

    # ---------------------------------------------------------
    # 1. Successor / Succession / Candidate Inquiries
    # ---------------------------------------------------------
    if any(k in q for k in ['successor', 'recommend', 'eligible', 'candidate', 'replace', 'bench']):
        # Find if a specific role is mentioned
        roles = LeadershipRole.query.all()
        matched_role = None
        for r in roles:
            if r.role_name.lower() in q:
                matched_role = r
                break

        if not matched_role:
            # Check keywords like "pm", "project manager", "lead", "tech lead"
            if 'project manager' in q or 'pm' in q:
                matched_role = next((r for r in roles if 'project manager' in r.role_name.lower()), roles[0] if roles else None)
            elif 'team lead' in q or 'lead' in q:
                matched_role = next((r for r in roles if 'team lead' in r.role_name.lower()), roles[0] if roles else None)
            elif 'technical' in q:
                matched_role = next((r for r in roles if 'technical' in r.role_name.lower()), None)
            elif 'department' in q:
                matched_role = next((r for r in roles if 'department' in r.role_name.lower()), None)
            elif 'operations' in q:
                matched_role = next((r for r in roles if 'operations' in r.role_name.lower()), None)
            else:
                matched_role = roles[0] if roles else None

        if matched_role:
            res = get_top_3_successors(
                matched_role.id,
                current_user=user,
                current_employee=current_employee,
                manager_id=mgr_emp_id if is_manager else None
            )
            cands = res.get("top_candidates", [])
            notice = res.get("notice", "")

            if not cands:
                reply = (
                    f"### 🎯 Top Successors for **{matched_role.role_name}**\n\n"
                    f"{notice}\n\n"
                    f"*Governance Note: Succession recommendations strictly require completed role assessments, "
                    f"active account standing, and prerequisite competency thresholds.*"
                )
            else:
                reply_lines = [
                    f"### 🎯 Top Eligible Successors for **{matched_role.role_name}** ({matched_role.department})\n",
                    f"{notice}\n"
                ]
                for c in cands:
                    reply_lines.append(
                        f"- **Rank #{c['rank']}: {c['name']}** ({c['designation']})\n"
                        f"  - **Overall Ranking Index:** `{c['ranking_score']}%`\n"
                        f"  - **Leadership Readiness:** `{c['readiness_score']}%` ({c['readiness_level']})\n"
                        f"  - **Role Assessment Score:** `{c['assessment_score']}%` (completed {c['assessment_date']})\n"
                        f"  - **Competency Match:** `{c['competency_match_pct']}%`\n"
                        f"  - **Primary Strength:** {c['major_strengths'][0] if c['major_strengths'] else 'Technical foundations'}\n"
                    )
                reply = "\n".join(reply_lines)

            return {
                "success": True,
                "intent": "successor_recommendation",
                "reply": reply,
                "data": res,
                "suggested_prompts": [
                    f"Compare top candidates for {matched_role.role_name}",
                    "What are the major competency gaps?",
                    "Show executive workforce summary"
                ]
            }

    # ---------------------------------------------------------
    # 2. Competency / Gap Inquiries
    # ---------------------------------------------------------
    if any(k in q for k in ['competency', 'gap', 'skill', 'weakness', 'strength']):
        comp_res = get_competency_intelligence(manager_id=mgr_emp_id if is_manager else None)
        crit_gaps = comp_res.get("critical_gaps", [])
        strengths = comp_res.get("top_strengths", [])

        reply_lines = [
            f"### 📊 Competency Intelligence Report ({'Team Scope' if is_manager else 'Enterprise-Wide'})\n",
            f"Evaluated across all 8 core leadership dimensions for {comp_res['total_employees']} active employees.\n"
        ]

        if crit_gaps:
            reply_lines.append("#### ⚠️ Priority Competency Deficits (Requiring Intervention):")
            for g in crit_gaps[:3]:
                reply_lines.append(
                    f"- **{g['name']}**: Current Avg `{g['current_score']}/100` vs Benchmark `{g['target_benchmark']}/100` "
                    f"(Deficit: **{g['gap']} pts**). *Action:* {g['recommended_training']}"
                )
            reply_lines.append("")

        if strengths:
            reply_lines.append("#### ✅ Top Organizational Strengths:")
            for s in strengths[:3]:
                reply_lines.append(f"- **{s['name']}**: Current Avg `{s['current_score']}/100` (Benchmark met)")
            reply_lines.append("")

        reply_lines.append(f"💡 **AI Recommendation:** {comp_res.get('ai_insights', '')}")
        reply = "\n".join(reply_lines)

        return {
            "success": True,
            "intent": "competency_intelligence",
            "reply": reply,
            "data": comp_res,
            "suggested_prompts": [
                "Which roles are most at risk?",
                "Recommend successors for Project Manager",
                "Show assessment completion statistics"
            ]
        }

    # ---------------------------------------------------------
    # 3. Assessment Inquiries
    # ---------------------------------------------------------
    if any(k in q for k in ['assessment', 'test', 'exam', 'quiz', 'score']):
        if is_manager and mgr_emp_id:
            team_res = get_team_intelligence(mgr_emp_id)
            reply = (
                f"### 📝 Team Assessment Status\n\n"
                f"- **Total Assigned:** {team_res['total_assessments_assigned']}\n"
                f"- **Total Completed:** {team_res['total_assessments_completed']}\n"
                f"- **Completion Rate:** `{team_res['assessment_completion_rate']}%`\n\n"
                f"**Team Member Details:**\n" +
                "\n".join([f"- **{m['name']}**: {m['assessments_completed']} completed of {m['assessments_assigned']} assigned" for m in team_res['members']])
            )
        else:
            total_assigned = AssessmentAssignment.query.count()
            completed = AssessmentAssignment.query.filter_by(status='Completed').count()
            pending = AssessmentAssignment.query.filter_by(status='Pending').count()
            in_prog = AssessmentAssignment.query.filter_by(status='In Progress').count()
            rate = round((completed / max(total_assigned, 1)) * 100.0, 1)

            reply = (
                f"### 📝 Enterprise Assessment Statistics\n\n"
                f"- **Total Assessment Assignments:** {total_assigned}\n"
                f"- **Completed:** {completed} (`{rate}%` completion rate)\n"
                f"- **Pending / Not Started:** {pending}\n"
                f"- **In Progress:** {in_prog}\n\n"
                f"To schedule new role-specific assessments, navigate to the **Assessment Management** portal."
            )

        return {
            "success": True,
            "intent": "assessment_status",
            "reply": reply,
            "data": None,
            "suggested_prompts": [
                "Who are the top eligible successors?",
                "What are our biggest competency gaps?",
                "Show team risk analysis"
            ]
        }

    # ---------------------------------------------------------
    # 4. Risk / Workload / Burnout Inquiries (Manager or HR)
    # ---------------------------------------------------------
    if any(k in q for k in ['risk', 'burnout', 'retention', 'flight', 'workload', 'stagnat']):
        if is_manager and mgr_emp_id:
            team_res = get_team_intelligence(mgr_emp_id)
            r_sum = team_res.get("risk_summary", {})
            reply_lines = [
                f"### 🛡️ Team Risk & Workload Analysis\n",
                f"- **Burnout Risk Alerts:** {r_sum.get('burnout_count', 0)} member(s)",
                f"- **Retention Risk Alerts:** {r_sum.get('retention_count', 0)} member(s)",
                f"- **Skill Stagnation Alerts:** {r_sum.get('stagnation_count', 0)} member(s)\n"
            ]
            for m in team_res.get("members", []):
                risks = m.get("risks", {})
                flagged = []
                for r_type, r_val in risks.items():
                    if r_val.get("level") in ['High', 'Medium']:
                        flagged.append(f"{r_type.capitalize()}: {r_val.get('reason')}")
                if flagged:
                    reply_lines.append(f"- **{m['name']}**: " + "; ".join(flagged))
                    reply_lines.append(f"  *Advisor:* {m['development_advice']}")

            reply = "\n".join(reply_lines)
            return {
                "success": True,
                "intent": "team_risk",
                "reply": reply,
                "data": team_res,
                "suggested_prompts": [
                    "Who are high performers on my team?",
                    "Top successors for Team Lead",
                    "What are my team's skill gaps?"
                ]
            }
        else:
            exec_res = get_hr_workforce_summary()
            at_risk = exec_res.get("roles_at_risk", [])
            reply_lines = [
                f"### 🛡️ Enterprise Succession & Leadership Risk Report\n",
                f"- **Roles Covered:** {exec_res['covered_roles_count']} / {exec_res['total_leadership_roles']} ({exec_res['coverage_ratio_pct']}% coverage)",
                f"- **Roles at Critical / High Risk:** {len(at_risk)}\n"
            ]
            for r in at_risk:
                reply_lines.append(
                    f"- **{r['role_name']}** ({r['department']}): Status: `{r['status']}`. "
                    f"Completed Assessments: {r['completed_assessments']}, Qualified Successors: {r['qualified_successors_count']}."
                )
            reply = "\n".join(reply_lines)
            return {
                "success": True,
                "intent": "enterprise_risk",
                "reply": reply,
                "data": exec_res,
                "suggested_prompts": [
                    "Show urgent succession alerts",
                    "Recommend successors for Project Manager",
                    "What are our largest competency gaps?"
                ]
            }

    # ---------------------------------------------------------
    # 5. Executive Summary / General Overview Inquiries
    # ---------------------------------------------------------
    if is_manager and mgr_emp_id:
        team_res = get_team_intelligence(mgr_emp_id)
        reply = (
            f"### 👥 AI Team Intelligence Briefing\n\n"
            f"{team_res['ai_team_summary']}\n\n"
            f"- **Team Members:** {team_res['team_size']}\n"
            f"- **Average Readiness:** `{team_res['team_readiness_avg']}%`\n"
            f"- **Average Performance:** `{team_res['team_performance_avg']}/5.0`\n"
            f"- **Assessment Completion:** `{team_res['assessment_completion_rate']}%`\n"
            f"- **High Performers:** {team_res['high_performers_count']} ready for advancement"
        )
        return {
            "success": True,
            "intent": "team_summary",
            "reply": reply,
            "data": team_res,
            "suggested_prompts": [
                "Who are the top successors for Team Lead?",
                "Show team risk & burnout analysis",
                "What are my team's competency gaps?"
            ]
        }
    else:
        exec_res = get_hr_workforce_summary()
        reply = (
            f"### 🏛️ Enterprise Succession Planning Executive Summary\n\n"
            f"- **Leadership Coverage Ratio:** `{exec_res['coverage_ratio_pct']}%` ({exec_res['covered_roles_count']} of {exec_res['total_leadership_roles']} roles)\n"
            f"- **Average Workforce Readiness:** `{exec_res['average_workforce_readiness_pct']}%`\n"
            f"- **Roles at Risk:** {exec_res['at_risk_roles_count']}\n"
            f"- **Total Workforce Evaluated:** {exec_res['total_workforce_evaluated']}\n\n"
            f"**Strategic Guidance:**\n" +
            "\n".join([f"- {rec}" for rec in exec_res['strategic_recommendations']])
        )
        return {
            "success": True,
            "intent": "executive_summary",
            "reply": reply,
            "data": exec_res,
            "suggested_prompts": [
                "Who are top successors for Project Manager?",
                "What are our biggest competency gaps?",
                "Which roles need assessments scheduled?"
            ]
        }
