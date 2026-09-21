import os
import csv
import random

def generate_synthetic_dataset(output_path="ml/dataset/succession_dataset.csv", num_samples=400):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    random.seed(42)

    headers = [
        "leadership_score",
        "communication_score",
        "decision_making_score",
        "team_management_score",
        "strategic_thinking_score",
        "problem_solving_score",
        "adaptability_score",
        "technical_knowledge_score",
        "performance_score",
        "experience_years",
        "readiness_level"
    ]

    rows = []
    for i in range(num_samples):
        # Generate baseline scores (low, mid, high capability distributions)
        capability_tier = random.choices(["high", "mid", "low"], weights=[0.35, 0.40, 0.25])[0]

        if capability_tier == "high":
            comp_base = random.uniform(80.0, 98.0)
            perf_score = random.uniform(82.0, 98.0)
            exp_years = random.uniform(5.0, 15.0)
        elif capability_tier == "mid":
            comp_base = random.uniform(62.0, 83.0)
            perf_score = random.uniform(68.0, 85.0)
            exp_years = random.uniform(3.0, 9.0)
        else: # low
            comp_base = random.uniform(40.0, 65.0)
            perf_score = random.uniform(45.0, 70.0)
            exp_years = random.uniform(1.0, 6.0)

        # Add noise to individual competencies
        lead_s = round(min(100.0, max(30.0, comp_base + random.uniform(-6.0, 6.0))), 2)
        comm_s = round(min(100.0, max(30.0, comp_base + random.uniform(-6.0, 6.0))), 2)
        dec_s = round(min(100.0, max(30.0, comp_base + random.uniform(-6.0, 6.0))), 2)
        team_s = round(min(100.0, max(30.0, comp_base + random.uniform(-6.0, 6.0))), 2)
        strat_s = round(min(100.0, max(30.0, comp_base + random.uniform(-6.0, 6.0))), 2)
        prob_s = round(min(100.0, max(30.0, comp_base + random.uniform(-6.0, 6.0))), 2)
        adapt_s = round(min(100.0, max(30.0, comp_base + random.uniform(-6.0, 6.0))), 2)
        tech_s = round(min(100.0, max(30.0, comp_base + random.uniform(-6.0, 6.0))), 2)

        perf_s = round(min(100.0, max(30.0, perf_score)), 2)
        exp_y = round(min(20.0, max(0.5, exp_years)), 1)

        # Compute readiness baseline
        avg_comp = (lead_s + comm_s + dec_s + team_s + strat_s + prob_s + adapt_s + tech_s) / 8.0
        exp_score = min(100.0, (exp_y / 10.0) * 100.0)
        calculated_readiness = (avg_comp * 0.40) + (perf_s * 0.25) + (exp_score * 0.15) + (lead_s * 0.20)

        # Assign class with slight stochastic noise to mimic human evaluation variability
        noise = random.uniform(-3.0, 3.0)
        final_readiness = calculated_readiness + noise

        if final_readiness >= 80.0:
            readiness_level = "High"
        elif final_readiness >= 60.0:
            readiness_level = "Medium"
        else:
            readiness_level = "Low"

        rows.append([
            lead_s, comm_s, dec_s, team_s, strat_s, prob_s, adapt_s, tech_s,
            perf_s, exp_y, readiness_level
        ])

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)

    print(f"[SUCCESS] Synthetic dataset with {num_samples} records generated at: {output_path}")

if __name__ == "__main__":
    generate_synthetic_dataset()
