import random
import json
from extensions import db
from models.question_bank import QuestionBank
from models.assessment import AssessmentAssignment, AssignmentQuestion
from models.role import LeadershipRole
from models.employee import Employee

LABELS = ["A", "B", "C", "D", "E", "F"]

def clean_option_text(raw_opt):
    """
    Strips leading option labels like 'A. ', 'B) ', '(C) ', 'D. '
    to extract the raw option text.
    """
    if not isinstance(raw_opt, str):
        return str(raw_opt or '')
    s = raw_opt.strip()
    if len(s) >= 3:
        if s[0] in "ABCDEF" and s[1:3] in [". ", ") "]:
            return s[3:].strip()
        if s[0] == "(" and s[1] in "ABCDEF" and s[2:4] in [") ", ")."]:
            return s[3:].strip()
    return s

def shuffle_options_and_relabel(raw_options, original_correct_answer):
    """
    Given a list of raw options and the original correct answer (e.g. 'B' or option text),
    randomizes option order, assigns fresh labels A, B, C, D, and calculates the updated correct label.
    """
    clean_items = []
    original_correct_text = None
    orig_corr_str = str(original_correct_answer or '').strip()
    orig_corr_letter = orig_corr_str[0].upper() if (len(orig_corr_str) > 0 and orig_corr_str[0] in "ABCDEF") else None

    for idx, opt in enumerate(raw_options):
        text = clean_option_text(opt)
        opt_letter = LABELS[idx] if idx < len(LABELS) else str(idx + 1)
        
        # Check if this option is the correct one
        is_corr = False
        if orig_corr_letter and opt_letter == orig_corr_letter:
            is_corr = True
        elif orig_corr_str and (orig_corr_str.lower() == text.lower() or text.lower().startswith(orig_corr_str.lower())):
            is_corr = True

        if is_corr and original_correct_text is None:
            original_correct_text = text

        clean_items.append(text)

    # Fallback if original correct answer wasn't matched
    if original_correct_text is None and len(clean_items) > 0:
        if orig_corr_letter:
            pos = ord(orig_corr_letter) - ord('A')
            if 0 <= pos < len(clean_items):
                original_correct_text = clean_items[pos]
        if original_correct_text is None:
            original_correct_text = clean_items[0]

    # Shuffle the options list
    shuffled_texts = list(clean_items)
    random.shuffle(shuffled_texts)

    # Re-assign labels and find new correct label
    formatted_options = []
    new_correct_label = "A"

    for idx, opt_text in enumerate(shuffled_texts):
        lbl = LABELS[idx] if idx < len(LABELS) else str(idx + 1)
        formatted_options.append({"label": lbl, "text": opt_text})
        if opt_text == original_correct_text:
            new_correct_label = lbl

    return formatted_options, new_correct_label

def generate_and_persist_attempt_questions(assignment, target_role_id, num_questions=10):
    """
    Generates and persists a fresh, role-specific question set for an employee's assessment assignment.
    
    Enforces Phase 3 requirements:
    1. Selects questions according to the target role, required competencies, and difficulty blueprint.
    2. Prevents duplicate questions within the same attempt.
    3. Avoids reusing questions previously attempted by this employee for this role.
    4. Randomizes question selection, question order, and answer-option order.
    5. Rejects with clear error if Question Bank has insufficient unused questions.
    6. Persists exact question IDs, question order, randomized options, and correct scoring references into assignment_questions.
    """
    if not assignment:
        return False, "Assessment assignment is required", 400

    role = LeadershipRole.query.get(target_role_id)
    if not role:
        return False, f"Leadership role #{target_role_id} not found", 404

    emp = Employee.query.get(assignment.employee_id)
    emp_name = emp.name if emp else f"Employee #{assignment.employee_id}"

    # 1. Find all question_bank_id previously assigned to this employee for this role in completed or active attempts
    used_qb_query = db.session.query(AssignmentQuestion.question_bank_id).join(
        AssessmentAssignment, AssignmentQuestion.assignment_id == AssessmentAssignment.id
    ).join(
        QuestionBank, AssignmentQuestion.question_bank_id == QuestionBank.id
    ).filter(
        AssessmentAssignment.employee_id == assignment.employee_id,
        QuestionBank.role_id == target_role_id,
        AssessmentAssignment.id != assignment.id,
        AssessmentAssignment.status.in_(['Completed', 'In-Progress'])
    ).distinct()

    used_qb_ids = {row[0] for row in used_qb_query.all() if row[0] is not None}

    # 2. Fetch all available question bank items for this role
    all_role_questions = QuestionBank.query.filter_by(role_id=target_role_id).all()
    if not all_role_questions:
        from utils.seed_question_bank import seed_question_bank
        seed_question_bank()
        all_role_questions = QuestionBank.query.filter_by(role_id=target_role_id).all()

    unused_pool = [q for q in all_role_questions if q.id not in used_qb_ids]

    # 3. Check question capacity (Requirement B.9)
    # If the question bank does not contain enough suitable unused questions, do not silently
    # reuse the old set or generate unrelated questions. Show a clear message to HR.
    if len(unused_pool) < num_questions:
        available_count = len(unused_pool)
        return False, (
            f"Question Bank capacity reached: Leadership Role '{role.role_name}' requires {num_questions} unused questions "
            f"for a fresh attempt, but only {available_count} unused question(s) remain for {emp_name}. "
            f"Please add more questions to the Question Bank before scheduling reassessment."
        ), 422

    # 4. Partition by difficulty according to the assessment blueprint
    # Target Blueprint for 10 questions: Easy ~ 3, Medium ~ 5, Hard ~ 2
    target_easy = max(1, int(round(num_questions * 0.30)))
    target_hard = max(1, int(round(num_questions * 0.20)))
    target_medium = num_questions - target_easy - target_hard

    easy_pool = [q for q in unused_pool if (q.difficulty or '').lower() == 'easy']
    med_pool = [q for q in unused_pool if (q.difficulty or '').lower() == 'medium']
    hard_pool = [q for q in unused_pool if (q.difficulty or '').lower() == 'hard']

    # Shuffle each pool to ensure randomized selection
    random.shuffle(easy_pool)
    random.shuffle(med_pool)
    random.shuffle(hard_pool)

    selected = []
    selected_ids = set()

    def pick_from_pool(pool, count):
        picked = []
        for q in pool:
            if len(picked) >= count:
                break
            if q.id not in selected_ids:
                picked.append(q)
                selected_ids.add(q.id)
        return picked

    selected.extend(pick_from_pool(easy_pool, target_easy))
    selected.extend(pick_from_pool(med_pool, target_medium))
    selected.extend(pick_from_pool(hard_pool, target_hard))

    # If difficulty pools were unbalanced, fill remaining from any available in unused_pool
    if len(selected) < num_questions:
        remaining_needed = num_questions - len(selected)
        fallback_pool = [q for q in unused_pool if q.id not in selected_ids]
        random.shuffle(fallback_pool)
        selected.extend(pick_from_pool(fallback_pool, remaining_needed))

    # Requirement B.4: Guarantee no duplicates within attempt
    assert len(selected) == len(set(q.id for q in selected)), "Duplicate questions detected within attempt"

    # Requirement B.3: Randomize question presentation order
    random.shuffle(selected)

    # 5. Clean up any existing questions for this assignment before persisting
    AssignmentQuestion.query.filter_by(assignment_id=assignment.id).delete()

    persisted_questions = []
    for idx, qb in enumerate(selected, start=1):
        raw_options = qb.get_options()
        shuffled_options, new_corr_label = shuffle_options_and_relabel(raw_options, qb.correct_answer)

        aq = AssignmentQuestion(
            assignment_id=assignment.id,
            question_bank_id=qb.id,
            question=qb.question_text,
            question_type=qb.question_type or 'Multiple Choice',
            competency_id=qb.competency_id,
            max_score=qb.max_score or 10.0,
            correct_answer=new_corr_label,
            explanation=qb.explanation or '',
            difficulty=qb.difficulty or 'Medium',
            order_index=idx
        )
        aq.set_options(shuffled_options)
        db.session.add(aq)
        persisted_questions.append(aq)

    return True, persisted_questions, 200
