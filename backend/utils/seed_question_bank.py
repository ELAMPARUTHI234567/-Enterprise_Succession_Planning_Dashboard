from extensions import db
from models.role import LeadershipRole
from models.competency import Competency
from models.question_bank import QuestionBank
from models.assessment import Assessment, AssessmentQuestion
import json

ROLE_QUESTION_TEMPLATES = {
    "Project Manager": [
        ("How should a Project Manager handle a sudden 25% scope expansion requested by executive stakeholders 2 weeks before release?",
         ["A. Accept all changes immediately without altering the project schedule or budget.",
          "B. Evaluate impact on schedule, budget, and resources, and present change requests with trade-offs to stakeholders.",
          "C. Reject the request outright without conducting any formal impact assessment.",
          "D. Ask the engineering team to work unrecorded overtime to complete the extra scope."],
         "B", "Scope changes require structured change management with thorough impact analysis on cost, schedule, and resources before approval.", "Decision Making", "Hard"),
        
        ("During a critical milestone, a key vendor fails to deliver a required component on time. What is the Project Manager's immediate risk mitigation action?",
         ["A. Cancel the project and notify executive management immediately.",
          "B. Execute the fallback vendor plan identified in the Risk Management Plan and adjust critical path dependencies.",
          "C. File a lawsuit against the vendor before seeking an operational solution.",
          "D. Ignore the delay and wait for the vendor to resolve their internal issues."],
         "B", "Contingency plans in the risk register should be activated immediately to protect the project's critical path.", "Risk Management", "Hard"),

        ("Which Earned Value Management (EVM) metric best measures schedule efficiency?",
         ["A. Schedule Performance Index (SPI) = Earned Value (EV) / Planned Value (PV).",
          "B. Cost Variance (CV) = Earned Value (EV) - Actual Cost (AC).",
          "C. Return on Investment (ROI) ratio.",
          "D. Defect Density ratio per thousand lines of code."],
         "A", "SPI evaluates schedule efficiency by comparing Earned Value against Planned Value; an SPI >= 1.0 indicates on-schedule performance.", "Planning and Execution", "Medium"),

        ("How should a Project Manager resolve a resource contention conflict between two high-priority projects requesting the same lead architect?",
         ["A. Assign the lead architect to whichever project manager complains loudest.",
          "B. Negotiate with portfolio leadership to evaluate business priorities, resource allocation, and task splitting options.",
          "C. Instruct both project teams to proceed without senior architectural guidance.",
          "D. Double the architect's working hours to cover both full-time positions simultaneously."],
         "B", "Resource contention across projects must be resolved based on enterprise portfolio priorities and collaborative negotiation.", "Team Management", "Medium"),

        ("When communicating project status to C-level executives, what format is most effective?",
         ["A. Deliver a 50-page technical log of daily commits and ticket activity.",
          "B. Present an executive dashboard highlighting milestone health, budget variance, top risks, and required decisions.",
          "C. Avoid sending updates until the project is 100% finished to avoid panic.",
          "D. Report only positive achievements and conceal all active project risks."],
         "B", "Executive communication requires concise, high-level summaries focusing on strategic goals, budget health, and actionable decisions.", "Communication", "Easy"),

        ("What is the primary purpose of a Project Baseline in project governance?",
         ["A. To lock down technical source code so developers cannot edit it.",
          "B. To establish an approved benchmark for scope, schedule, and cost against which performance is measured.",
          "C. To calculate employee annual bonus payouts.",
          "D. To document initial informal brainstorming ideas before project approval."],
         "B", "The performance measurement baseline (scope, schedule, cost) serves as the reference point for project control and variance analysis.", "Planning and Execution", "Medium"),

        ("A critical path task is delayed by 3 days. What is the impact on the overall project finish date?",
         ["A. No impact, because all tasks have float time.",
          "B. The overall project finish date will be delayed by 3 days unless schedule compression techniques are applied.",
          "C. The project finish date accelerates by 3 days.",
          "D. The project budget automatically doubles."],
         "B", "Tasks on the critical path have zero total float, meaning any delay directly delays the project completion date.", "Problem Solving", "Hard"),

        ("Which technique is best suited for estimating project duration when limited detailed historical data is available?",
         ["A. Parametric Estimating using mathematical algorithms.",
          "B. Three-Point Estimating (PERT) considering Optimistic, Most Likely, and Pessimistic scenarios.",
          "C. Bottom-Up Estimating of sub-component micro-tasks.",
          "D. Random guessing based on intuitive gut feel."],
         "B", "Three-point PERT estimation accounts for uncertainty by weighting optimistic, pessimistic, and most likely values.", "Planning and Execution", "Medium"),

        ("How should a Project Manager handle technical debt during an agile development cycle?",
         ["A. Ignore technical debt permanently to maximize feature output velocity.",
          "B. Collaborate with the technical lead to quantify debt risks and dedicate a backlog percentage for refactoring.",
          "C. Halt all feature development for six months to rewrite the codebase.",
          "D. Blame developers for creating technical debt."],
         "B", "Managing technical debt requires balancing feature delivery with dedicated backlog allocation for refactoring and maintenance.", "Strategic Thinking", "Medium"),

        ("During sprint planning, the team realizes the commitment exceeds their historical velocity. What should the Project Manager recommend?",
         ["A. Force the team to accept the commitment and mandate weekend work.",
          "B. Guide the Product Owner and team to re-prioritize and adjust the sprint scope to match sustainable velocity.",
          "C. Cancel the sprint immediately.",
          "D. Increase the team velocity metric artificially without changing workload."],
         "B", "Sustainable pace and realistic sprint commitments based on historical velocity prevent burnout and deliver reliable results.", "Leadership", "Easy"),

        ("What is the main objective of a Project Retrospective at the end of a phase?",
         ["A. Assign blame to individual team members for mistakes.",
          "B. Identify successes, root causes of challenges, and actionable improvements for future iterations.",
          "C. Celebrate without documenting any operational learnings.",
          "D. Fill out compliance paperwork for auditor inspection only."],
         "B", "Retrospectives drive continuous organizational learning by identifying practical process improvements.", "Adaptability", "Easy"),

        ("When managing a remote, multi-timezone project team, how should the Project Manager ensure effective collaboration?",
         ["A. Require all team members to attend meetings at 2:00 AM regardless of local time.",
          "B. Establish asynchronous communication protocols, clear documentation standards, and overlapping core hours.",
          "C. Eliminate all team meetings and communicate solely via email.",
          "D. Allow each regional group to operate completely independently without cross-syncing."],
         "B", "Asynchronous tools and structured communication norms enable smooth collaboration across diverse time zones.", "Communication", "Medium"),

        ("A key stakeholder demands daily detailed progress reports. How should the Project Manager respond?",
         ["A. Refuse to communicate with the stakeholder entirely.",
          "B. Understand the stakeholder's underlying concerns and establish an agreed-upon communication frequency and format.",
          "C. Spend 4 hours every day drafting custom daily reports manually.",
          "D. Escalate the stakeholder to executive board for harassment."],
         "B", "Effective stakeholder management involves setting structured expectations while addressing core stakeholder information needs.", "Communication", "Medium"),

        ("Which quality management tool helps identify the 20% of causes that create 80% of project problems?",
         ["A. Pareto Diagram based on the 80/20 rule.",
          "B. Fishbone (Ishikawa) Diagram.",
          "C. Gantt Chart schedule timeline.",
          "D. Control Chart for process limits."],
         "A", "Pareto charts rank defects or causes by frequency to focus quality efforts on the vital few issues.", "Problem Solving", "Medium"),

        ("What is the primary risk of using Fast Tracking as a schedule compression technique?",
         ["A. Increased project financial cost due to overtime.",
          "B. Increased risk of rework due to performing sequential activities in parallel.",
          "C. Reduced team size.",
          "D. Automatic cancellation of stakeholder contracts."],
         "B", "Fast tracking overlapping tasks originally planned sequentially increases risk of rework and coordination overhead.", "Risk Management", "Hard"),

        ("How should a Project Manager handle conflicting requirements from two key business sponsors?",
         ["A. Implement both conflicting requirements simultaneously in the software.",
          "B. Facilitate a requirements alignment session to evaluate strategic value, ROI, and consensus.",
          "C. Choose the requirement from the sponsor who joined the company most recently.",
          "D. Ignore both requirements and build a different feature."],
         "B", "Facilitated alignment sessions help resolve conflicting business requirements through strategic consensus.", "Leadership", "Medium"),

        ("What is the main purpose of a Project Charter?",
         ["A. To serve as a detailed technical user manual for customers.",
          "B. To formally authorize the project existence and grant the project manager authority to apply organizational resources.",
          "C. To list every individual employee salary.",
          "D. To document post-launch customer feedback complaints."],
         "B", "A Project Charter formally authorizes the project and defines high-level objectives, scope boundaries, and project manager authority.", "Leadership", "Easy"),

        ("Which procurement contract type carries the highest financial risk for the buyer?",
         ["A. Firm Fixed Price (FFP).",
          "B. Cost Plus Percentage of Cost (CPPC).",
          "C. Time and Materials (T&M) with ceiling limit.",
          "D. Fixed Price Incentive Fee (FPIF)."],
         "B", "Cost Plus Percentage of Cost puts maximum financial risk on the buyer because seller profits increase as costs rise.", "Risk Management", "Hard"),

        ("What action should a Project Manager take when closing a project successfully?",
         ["A. Reassign team members without archiving project records.",
          "B. Obtain final customer acceptance, archive documentation, release resources, and document lessons learned.",
          "C. Delete all project repositories and communication logs.",
          "D. Immediately start a new project without formal sign-off."],
         "B", "Formal project closure requires administrative sign-off, archiving artifacts, financial reconciliation, and capturing lessons learned.", "Planning and Execution", "Medium"),

        ("How does an agile Project Manager (Scrum Master) address an external impediment raised during daily standup?",
         ["A. Direct the development team member to resolve the external issue on their own.",
          "B. Take ownership of shielding the team and actively coordinate with external dependencies to clear the impediment.",
          "C. Log the impediment in a file and review it in three months.",
          "D. Cancel daily standups until the impediment resolves itself."],
         "B", "Servant leadership requires actively removing external blockers so the team can maintain focus and delivery velocity.", "Team Management", "Easy")
    ],

    "Team Lead": [
        ("Two senior developers on your engineering team strongly disagree on adopting a micro-frontend vs monolithic SPA architecture. How should the Team Lead facilitate resolution?",
         ["A. Pick your personal favorite architecture without consulting team data.",
          "B. Guide the team to conduct a trade-off matrix evaluation, prototype both solutions, and align on objective technical criteria.",
          "C. Force the developers to flip a coin to decide.",
          "D. Tell both developers to build separate modules independently using different frameworks."],
         "B", "Technical disagreements are best resolved through objective trade-off evaluation, prototyping, and consensus-building.", "Team Management", "Medium"),

        ("A junior developer consistently struggles to complete committed user stories within the sprint. What is the Team Lead's best coaching approach?",
         ["A. Publicly reprimand the developer during the daily standup meeting.",
          "B. Hold a private 1-on-1 to identify root causes, pair them with a senior mentor, and break tasks into smaller stories.",
          "C. Remove all technical responsibilities from the developer permanently.",
          "D. Ignore the performance gap and hope it resolves itself."],
         "B", "Direct, supportive 1-on-1 coaching combined with mentorship and manageable task decomposition builds developer capability.", "Leadership", "Medium"),

        ("How should a Team Lead manage sprint execution when a critical production bug requires immediate hotfix intervention?",
         ["A. Add the hotfix to the current sprint without adjusting planned commitments.",
          "B. Swap out lower-priority sprint items of equivalent effort with Product Owner agreement to maintain sustainable velocity.",
          "C. Abandon all sprint goals and stop working on feature tasks indefinitely.",
          "D. Refuse to fix production bugs until the next quarterly release."],
         "B", "Handling unplanned urgent work requires collaborative scope adjustment with the Product Owner to protect sprint predictability.", "Adaptability", "Medium"),

        ("What code review practice best promotes high engineering quality and continuous learning?",
         ["A. Approve all pull requests automatically without reading the code.",
          "B. Establish constructive review guidelines, focus on architecture/security/readability, and explain the reasoning behind suggestions.",
          "C. Reject pull requests with harsh critical remarks without offering constructive alternatives.",
          "D. Restrict code reviews exclusively to the Engineering Director."],
         "B", "Constructive code reviews focused on architectural standards and supportive explanations elevate team technical quality.", "Technical Knowledge", "Easy"),

        ("How should a Team Lead encourage pair programming effectively within the engineering team?",
         ["A. Mandate 100% pair programming for all tasks 8 hours a day.",
          "B. Strategically encourage pairing for complex features, onboarding, and knowledge transfer while respecting individual focus time.",
          "C. Ban pair programming because it reduces individual output metrics by half.",
          "D. Only allow pair programming when a production disaster occurs."],
         "B", "Pair programming is most valuable when targeted at complex problem solving, cross-skilling, and onboarding.", "Technical Knowledge", "Medium"),

        ("During a sprint retrospective, team members complain about unclear user story acceptance criteria. What action should the Team Lead take?",
         ["A. Blame the Product Owner and end the meeting.",
          "B. Work with the Product Owner to refine the 'Definition of Ready' and establish pre-sprint backlog refinement sessions.",
          "C. Tell the developers to code whatever they think is best without criteria.",
          "D. Eliminate sprint retrospectives entirely."],
         "B", "Improving backlog refinement and enforcing a clear Definition of Ready resolves ambiguity in user stories.", "Problem Solving", "Medium"),

        ("How should a Team Lead handle technical debt in a fast-paced feature delivery environment?",
         ["A. Never address technical debt under any circumstances.",
          "B. Track technical debt explicitly, quantify its impact on stability/velocity, and advocate allocating dedicated sprint bandwidth.",
          "C. Rebuild the system from scratch every 6 months.",
          "D. Hide technical refactoring work inside feature tickets without telling management."],
         "B", "Transparently tracking technical debt and demonstrating its ROI enables balanced allocation of sprint capacity.", "Strategic Thinking", "Hard"),

        ("A senior developer is exhibiting signs of severe burnout and frustration. How should the Team Lead respond?",
         ["A. Increase their workload commitment to distract them.",
          "B. Hold an empathetic 1-on-1, adjust immediate task allocations, encourage time off, and review workload sustainability.",
          "C. Fire the developer immediately.",
          "D. Ignore the behavioral changes."],
         "B", "Proactive empathy, workload adjustment, and supporting well-being are essential team lead responsibilities.", "Team Management", "Medium"),

        ("What is the primary benefit of enforcing automated testing (unit/integration) in the team's CI/CD pipeline?",
         ["A. Slowing down code deployment so engineers take longer breaks.",
          "B. Providing rapid feedback, preventing regression defects, and enabling confident continuous delivery.",
          "C. Replacing human developers with automated test robots.",
          "D. Fulfilling a cosmetic compliance checkbox."],
         "B", "Automated testing in CI/CD ensures code reliability, prevents regression defects, and accelerates delivery feedback.", "Technical Knowledge", "Easy"),

        ("How should a Team Lead foster psychological safety within an engineering team?",
         ["A. Punish team members for making any technical mistakes.",
          "B. Frame failures as learning opportunities, encourage open technical dialogue, and model vulnerability.",
          "C. Prevent developers from expressing dissenting opinions.",
          "D. Create a competitive environment where developers compete against each other."],
         "B", "Psychological safety thrives when leaders encourage transparent communication and view mistakes as collective growth opportunities.", "Leadership", "Medium"),

        ("What strategy should a Team Lead use when onboarding a new software engineer?",
         ["A. Hand them a 500-page manual and expect them to push production code on day 1 alone.",
          "B. Assign an onboarding buddy, provide structured documentation, and set incremental 30-60-90 day goals with early wins.",
          "C. Leave the new engineer without access permissions for 2 weeks.",
          "D. Require the new hire to fix legacy bugs without codebase orientation."],
         "B", "Structured onboarding with buddy mentorship and incremental milestones builds confidence and speeds time-to-productivity.", "Leadership", "Easy"),

        ("How should a Team Lead measure team productivity effectively?",
         ["A. Count lines of code written per engineer per day.",
          "B. Measure outcome-based metrics like business value delivered, sprint goal achievement, cycle time, and defect rate.",
          "C. Count the number of total git commits per hour.",
          "D. Track how many hours employees stay logged in."],
         "B", "Outcome-driven metrics (cycle time, value delivery, stability) provide accurate productivity insights over superficial output counts.", "Decision Making", "Hard"),

        ("An engineer consistently submits massive pull requests with over 2,000 changed lines. What advice should the Team Lead give?",
         ["A. Praise the engineer for submitting large changes all at once.",
          "B. Encourage breaking changes into smaller, atomic feature-flagged pull requests for easier, safer code review.",
          "C. Ask the engineer to merge directly without review.",
          "D. Ban the engineer from submitting code."],
         "B", "Small, atomic pull requests reduce review cognitive load, decrease bug risk, and speed up integration feedback.", "Technical Knowledge", "Medium"),

        ("How should a Team Lead handle a situation where a team member is constantly interrupted by external support requests?",
         ["A. Tell the engineer to work late hours to compensate for interrupted time.",
          "B. Rotate a designated 'on-call' or 'support engineer' role weekly to shield the rest of the team.",
          "C. Ignore external support requests completely.",
          "D. Tell external teams that engineering does not support live software."],
         "B", "Role rotation for support duties protects focus time for the rest of the team while maintaining operational responsiveness.", "Problem Solving", "Medium"),

        ("What approach should a Team Lead take when introducing a new framework or technology stack?",
         ["A. Re-write the entire production stack overnight without telling the team.",
          "B. Conduct a Proof of Concept (PoC), present tech trade-offs, collect team feedback, and plan incremental adoption.",
          "C. Force the team to adopt the technology without training.",
          "D. Ban all new technologies permanently."],
         "B", "Structured PoCs and collaborative feedback ensure smooth technology adoption without introducing unplanned operational risk.", "Strategic Thinking", "Hard"),

        ("During sprint execution, a developer identifies an architectural dependency on another team that was missed during planning. What is the Team Lead's priority action?",
         ["A. Wait until the end of the sprint to mention it.",
          "B. Contact the counterpart Team Lead immediately to align cross-team dependencies and adjust current sprint expectations.",
          "C. Blame the developer for discovering the dependency late.",
          "D. Cancel the entire project."],
         "B", "Proactive cross-team alignment and early communication are critical for resolving unexpected external dependencies.", "Adaptability", "Medium"),

        ("How can a Team Lead effectively delegate technical tasks to team members?",
         ["A. Delegate only tedious tasks while keeping all interesting architecture work for yourself.",
          "B. Align tasks with individual growth goals, provide clear expectations and autonomy, and offer check-in support.",
          "C. Micro-manage every line of code written by team members.",
          "D. Give complex tasks without providing background context or support."],
         "B", "Effective delegation pairs task assignments with professional growth, trust, clear expectations, and supportive check-ins.", "Leadership", "Medium"),

        ("What should a Team Lead do when team velocity fluctuates significantly from sprint to sprint?",
         ["A. Discipline the team for inconsistent output.",
          "B. Analyze underlying causes in retrospectives, such as story sizing inconsistencies, external interruptions, or scope creep.",
          "C. Stop tracking velocity metrics completely.",
          "D. Artificially inflate story point estimates."],
         "B", "Analyzing velocity variance root causes helps stabilize estimation accuracy and operational predictability.", "Planning and Execution", "Medium"),

        ("How should a Team Lead handle constructive feedback received from team members in 1-on-1 meetings?",
         ["A. Become defensive and penalize the employee for speaking up.",
          "B. Listen actively, thank the team member, reflect objectively, and follow up with concrete actionable changes.",
          "C. Ignore the feedback and pretend the conversation did not happen.",
          "D. Tell the team member that leadership feedback flows in only one direction."],
         "B", "Receiving feedback openly and taking visible corrective action reinforces trust and psychological safety.", "Communication", "Easy"),

        ("What is the primary role of a Team Lead during technical architecture discussions?",
         ["A. Dictate every technical decision without allowing team input.",
          "B. Facilitate structured debate, ensure non-functional requirements (security, scale) are considered, and drive alignment.",
          "C. Remain completely silent and let the team argue indefinitely.",
          "D. Delegate architectural decisions to external consultants."],
         "B", "Team Leads guide architectural alignment by fostering structured discussion while keeping business requirements in focus.", "Leadership", "Hard")
    ],

    "Department Manager": [
        ("What is the primary objective of Strategic Workforce Planning for a Department Manager?",
         ["A. Minimizing immediate payroll costs regardless of long-term operational capabilities.",
          "B. Aligning department talent capabilities, headcounts, and succession pipelines with multi-year organizational strategic goals.",
          "C. Hiring as many employees as possible to maximize department budget size.",
          "D. Replacing all full-time employees with short-term contractors."],
         "B", "Strategic workforce planning connects talent acquisition, skill development, and succession pipelines with overarching business strategy.", "Strategic Thinking", "Hard"),

        ("A department operational audit reveals a 15% budget overrun due to inefficient manual workflows. What is the Department Manager's strategic priority?",
         ["A. Cut employee salaries across the board to cover the deficit.",
          "B. Conduct a process optimization review, automate repetitive workflows, and reallocate operational budget sustainably.",
          "C. Request an emergency budget increase without addressing underlying inefficiencies.",
          "D. Conceal audit findings from executive leadership."],
         "B", "Managing operational budget deficits requires root-cause process improvement and sustainable workflow optimization.", "Decision Making", "Hard"),

        ("How should a Department Manager handle cross-departmental alignment conflicts when launching a major initiative?",
         ["A. Enforce department priorities unilaterally without consulting other division managers.",
          "B. Establish shared Key Performance Indicators (KPIs), conduct alignment workshops, and define transparent SLA handoffs.",
          "C. Escalate every minor dispute directly to the CEO.",
          "D. Delay the initiative indefinitely until other departments change their priorities."],
         "B", "Cross-departmental success relies on shared KPIs, collaborative SLA definitions, and mutual strategic alignment.", "Leadership", "Hard"),

        ("Which framework is most effective for leading organizational change across a large operational department?",
         ["A. Mandating changes overnight via company-wide email without explanation.",
          "B. Utilizing a structured change model (e.g., Kotter's 8-Step) emphasizing urgency, coalition building, clear vision, and quick wins.",
          "C. Allowing each employee to choose whether or not to adopt the new processes.",
          "D. Hiring external actors to enforce change anonymously."],
         "B", "Structured change management frameworks address resistance, build leadership coalitions, and ensure sustainable transformation.", "Adaptability", "Medium"),

        ("How should a Department Manager establish Key Performance Indicators (KPIs) for department leaders?",
         ["A. Assign arbitrary targets without evaluating historical benchmark data.",
          "B. Define SMART (Specific, Measurable, Achievable, Relevant, Time-bound) metrics aligned with executive organizational goals.",
          "C. Use vague qualitative guidelines with no measurable criteria.",
          "D. Copy KPIs directly from an unrelated industry company."],
         "B", "SMART KPIs tied to strategic enterprise goals provide clear operational direction and objective performance evaluation.", "Planning and Execution", "Medium"),

        ("What is the primary role of a Department Manager in Succession Planning?",
         ["A. Selecting successors based on personal friendships.",
          "B. Identifying high-potential talent, defining critical role competency gaps, and implementing structured leadership development pipelines.",
          "C. Keeping succession plans secret until a senior leader resigns.",
          "D. Outsourcing leadership development to unverified third-party websites."],
         "B", "Proactive succession planning builds robust leadership pipelines through competency gap evaluation and targeted development.", "Leadership", "Hard"),

        ("How should a Department Manager handle a situation where two sub-departments are operating in isolated functional silos?",
         ["A. Encourage competition between silos to see who performs better.",
          "B. Create cross-functional project teams, incentivize shared outcome metrics, and foster joint operational reviews.",
          "C. Merge the two sub-departments forcibly without restructuring workflows.",
          "D. Ignore the silo behavior as long as individual metrics are met."],
         "B", "Breaking functional silos requires cross-functional project structures, joint governance, and shared performance incentives.", "Team Management", "Medium"),

        ("When faced with unexpected quarterly budget cuts of 10%, how should a Department Manager prioritize expenditure reductions?",
         ["A. Eliminate all employee training and career development programs permanently.",
          "B. Conduct a value-stream analysis to protect core revenue-generating operations while trimming non-essential discretionary expenses.",
          "C. Cancel all software vendor contracts immediately.",
          "D. Freeze all employee communications regarding financial status."],
         "B", "Strategic cost management protects core operational drivers and talent development while pruning low-ROI discretionary spending.", "Decision Making", "Hard"),

        ("How should a Department Manager evaluate the Return on Investment (ROI) of a major technology infrastructure upgrade?",
         ["A. Focus exclusively on the initial software purchasing cost.",
          "B. Analyze Total Cost of Ownership (TCO) against quantifiable benefits like efficiency gains, error reduction, and risk mitigation.",
          "C. Assume all technology upgrades automatically deliver 500% ROI.",
          "D. Rely solely on vendor marketing claims without internal analysis."],
         "B", "Robust ROI analysis balances Total Cost of Ownership against measurable productivity, security, and financial benefits.", "Problem Solving", "Hard"),

        ("What strategy best maintains employee morale and retention during a company-wide restructuring process?",
         ["A. Withhold information until the restructuring is completely finished.",
          "B. Maintain transparent communication, articulate the rationale for change, provide support resources, and highlight growth opportunities.",
          "C. Promise that no jobs or roles will ever change.",
          "D. Discourage employees from asking questions about their future."],
         "B", "Transparent, empathetic communication during organizational restructuring mitigates anxiety and sustains employee retention.", "Communication", "Medium"),

        ("How should a Department Manager handle a chronic underperforming team leader within the department?",
         ["A. Transfer the underperforming leader to another department without notice.",
          "B. Establish a formal Performance Improvement Plan (PIP) with clear expectations, mentoring support, and defined timeline metrics.",
          "C. Ignore the underperformance to avoid difficult conversations.",
          "D. Demote the leader publicly during a department all-hands meeting."],
         "B", "Constructive performance management requires formal guidance, measurable goals, supportive resources, and clear consequences.", "Team Management", "Medium"),

        ("Which approach is best for managing department operational risk?",
         ["A. Assuming major operational failures will never happen to your company.",
          "B. Maintaining a comprehensive Risk Register, conducting periodic risk assessments, and establishing business continuity plans.",
          "C. Buying maximum insurance coverage and ignoring operational controls.",
          "D. Delegating risk management entirely to junior staff."],
         "B", "Proactive risk management involves continuous risk identification, impact quantification, and business continuity planning.", "Risk Management", "Hard"),

        ("How should a Department Manager handle conflicting strategic directives from different C-level executives?",
         ["A. Choose the directive from whichever executive spoke to you last.",
          "B. Schedule an alignment meeting with the executives to present operational trade-offs and seek a unified strategic consensus.",
          "C. Attempt to execute both directives secretly even if they contradict.",
          "D. Ignore both directives until the executives resolve their conflict."],
         "B", "Resolving executive misalignment requires facilitating transparent trade-off discussions to achieve unified strategic clarity.", "Communication", "Hard"),

        ("What is the primary benefit of implementing regular 360-degree feedback reviews for department leaders?",
         ["A. Generating HR paperwork for audit compliance.",
          "B. Providing comprehensive leadership growth insights from peers, direct reports, and supervisors to identify blind spots.",
          "C. Encouraging anonymous workplace gossip.",
          "D. Automatically determining salary deductions."],
         "B", "360-degree feedback offers holistic self-awareness insights that empower leaders to develop critical interpersonal competencies.", "Leadership", "Medium"),

        ("How should a Department Manager foster an organizational culture of innovation and continuous improvement?",
         ["A. Require approval from 5 management levels for any new process idea.",
          "B. Establish innovation hackathons, reward calculated risk-taking, streamline approval pathways, and celebrate experimentation.",
          "C. Punish employees whenever an innovative pilot fails.",
          "D. Restrict innovative thinking exclusively to the R&D department."],
         "B", "Cultivating innovation requires encouraging psychological safety, rewarding smart experimentation, and removing bureaucratic barriers.", "Adaptability", "Medium"),

        ("When reviewing department vendor SLAs (Service Level Agreements), what should a Department Manager focus on?",
         ["A. Checking if the vendor logo looks professional.",
          "B. Verifying performance compliance against contractual metrics, availability targets, penalty clauses, and service quality.",
          "C. Accepting vendor self-reported status without verification.",
          "D. Renewing contracts automatically without review."],
         "B", "Vendor SLA management ensures third-party partners consistently deliver contractual performance, quality, and reliability.", "Planning and Execution", "Medium"),

        ("What approach should a Department Manager take regarding Diversity, Equity, and Inclusion (DEI) in hiring?",
         ["A. Treat DEI as a mandatory HR compliance checkbox without operational integration.",
          "B. Embed inclusive hiring practices, diverse interview panels, and objective merit-based criteria into department talent acquisition.",
          "C. Ignore diversity considerations entirely.",
          "D. Restrict recruitment solely to internal employee referrals."],
         "B", "Integrating inclusive recruitment workflows and objective evaluation expands talent access and enhances organizational performance.", "Leadership", "Medium"),

        ("How should a Department Manager manage high-capacity utilization across department teams to prevent burnout?",
         ["A. Maintain 100% capacity utilization indefinitely.",
          "B. Monitor team workload metrics, build operational buffer capacity (e.g., 80-85%), and optimize resource distribution.",
          "C. Mandate unpaid mandatory weekend shifts.",
          "D. Ignore workload feedback from team leads."],
         "B", "Sustainable operational management maintains healthy buffer capacity to prevent burnout while sustaining high throughput.", "Team Management", "Medium"),

        ("What is the main goal of a Quarterly Business Review (QBR) led by a Department Manager?",
         ["A. Spending 3 hours presenting slides with no actionable outcomes.",
          "B. Evaluating quarterly performance against strategic objectives, analyzing variances, and realigning resources for the upcoming quarter.",
          "C. Canceling next quarter's strategic goals.",
          "D. Replacing department leaders every quarter."],
         "B", "QBRs provide essential strategic checkpoints for reviewing performance variances and realigning operational priorities.", "Planning and Execution", "Medium"),

        ("How should a Department Manager prepare the department for long-term digital transformation initiatives?",
         ["A. Purchase expensive AI software tools without training employees.",
          "B. Assess digital maturity, invest in employee upskilling, modernize legacy infrastructure, and foster an agile mindset.",
          "C. Resist all digital changes to protect existing legacy workflows.",
          "D. Replace all existing employees with automated artificial intelligence."],
         "B", "Successful digital transformation combines technology modernization with comprehensive workforce upskilling and change management.", "Strategic Thinking", "Hard")
    ],

    "Technical Lead": [
        ("How should a Technical Lead evaluate whether to migrate a monolithic legacy core system to a microservices architecture?",
         ["A. Migrate immediately because microservices are a popular industry trend.",
          "B. Perform a rigorous trade-off analysis evaluating domain boundaries, team cognitive load, operational complexity, and network latency.",
          "C. Reject microservices under all circumstances.",
          "D. Delegate the architectural decision entirely to entry-level interns."],
         "B", "Architectural migrations require evaluating domain boundaries, operational complexity, team capabilities, and system performance.", "Technical Knowledge", "Hard"),

        ("What is the most effective approach for a Technical Lead to manage technical debt in an enterprise codebase?",
         ["A. Ignore technical debt until the system crashes in production.",
          "B. Quantify technical debt impact on developer velocity and bug frequency, allocating dedicated capacity (e.g., 15-20%) in each delivery cycle.",
          "C. Freeze all business feature delivery for 6 months to rewrite the codebase completely.",
          "D. Require developers to refactor code only during unpaid personal time."],
         "B", "Sustainable technical debt management pairs quantifiable business impact with continuous backlog refactoring allocation.", "Problem Solving", "Medium"),

        ("Which architectural pattern best ensures high availability and fault isolation in a distributed microservices system?",
         ["A. Single Point of Failure (SPOF) architecture.",
          "B. Circuit Breaker, Bulkhead isolation, and Graceful Degradation patterns.",
          "C. Shared database monolith with synchronous HTTP chains.",
          "D. Hardcoded IP addressing without load balancing."],
         "B", "Resilience patterns like Circuit Breakers and Bulkheads isolate failures, preventing cascading system outages.", "Technical Knowledge", "Hard"),

        ("How should a Technical Lead enforce secure coding standards across engineering teams?",
         ["A. Conduct manual security audits once every two years.",
          "B. Integrate automated Static (SAST) and Dynamic (DAST) security analysis into the CI/CD pipeline alongside developer security training.",
          "C. Trust developers to write secure code without validation.",
          "D. Disable security checks to speed up build times."],
         "B", "Automated SAST/DAST pipeline integration combined with security education provides continuous security assurance.", "Technical Knowledge", "Medium"),

        ("What approach should a Technical Lead take when designing public RESTful API specifications?",
         ["A. Change API endpoints and breaking schemas frequently without notice.",
          "B. Enforce semantic versioning, OpenAPI documentation standards, backward compatibility, and robust input validation.",
          "C. Avoid documenting APIs so competitors cannot inspect them.",
          "D. Use non-standard custom HTTP verbs for basic CRUD actions."],
         "B", "RESTful API design standards require semantic versioning, clear OpenAPI documentation, and backward compatibility.", "Technical Knowledge", "Medium"),

        ("How should a Technical Lead optimize database performance when query response times degrade significantly under load?",
         ["A. Reboot the database server every hour.",
          "B. Analyze execution plans, optimize indexing strategies, eliminate N+1 queries, and implement query caching/read-replicas.",
          "C. Delete half the database records to free up disk space.",
          "D. Tell users to execute fewer database searches."],
         "B", "Database performance optimization requires query execution analysis, index tuning, caching, and read-replica scaling.", "Problem Solving", "Hard"),

        ("What is the primary benefit of documenting system architecture using Architectural Decision Records (ADRs)?",
         ["A. Creating long documentation nobody reads.",
          "B. Capturing context, technical trade-offs, and rationale behind critical design choices for current and future engineers.",
          "C. Satisfying HR annual review checkboxes.",
          "D. Preventing software developers from modifying code."],
         "B", "ADRs capture institutional knowledge, explaining why architectural decisions were made and what trade-offs were accepted.", "Communication", "Easy"),

        ("How should a Technical Lead handle zero-downtime deployment requirements for a critical production system?",
         ["A. Schedule 8 hours of user downtime during peak business hours.",
          "B. Implement Blue-Green or Canary deployment strategies supported by database migration scripts with backward compatibility.",
          "C. Deploy updates directly to production servers without testing.",
          "D. Shut down all database servers during deployment."],
         "B", "Blue-Green and Canary deployments paired with non-breaking database schema migrations enable seamless zero-downtime updates.", "Planning and Execution", "Hard"),

        ("Which strategy best addresses high latency issues in a distributed cloud application?",
         ["A. Adding more CPU cores to front-end web servers without measuring bottlenecks.",
          "B. Implementing distributed tracing (e.g., OpenTelemetry), profiling network calls, and adding multi-layer caching (Redis/CDN).",
          "C. Disabling encryption algorithms to speed up processing.",
          "D. Increasing network timeout limits to 10 minutes."],
         "B", "Distributed tracing identifies precise bottleneck latency spans, guiding effective caching and network optimizations.", "Problem Solving", "Hard"),

        ("How should a Technical Lead approach technical mentoring for senior engineers on the path to principal architect roles?",
         ["A. Micromanage their daily coding tasks.",
          "B. Provide systemic design challenges, involve them in enterprise architecture strategy, and coach them on technical communication.",
          "C. Prevent them from attending architectural design sessions.",
          "D. Require them to perform only junior QA testing tasks."],
         "B", "Mentoring senior engineers involves elevating their systemic vision, architectural trade-off evaluation, and executive influence.", "Leadership", "Medium"),

        ("What is the primary risk of adopting a Serverless (FaaS) architecture without proper governance?",
         ["A. Serverless systems cannot run JavaScript code.",
          "B. Vendor lock-in, unpredictable cold-start latencies, complex local debugging, and unexpected billing spikes under high load.",
          "C. Serverless architectures eliminate the need for security protocols.",
          "D. Serverless systems require manual server hardware maintenance."],
         "B", "Serverless adoption risks include vendor lock-in, cold-start latency overhead, billing complexity, and debugging challenges.", "Risk Management", "Medium"),

        ("How should a Technical Lead evaluate third-party open-source libraries before introducing them into an enterprise codebase?",
         ["A. Install any open-source package with no review.",
          "B. Assess license compliance, security vulnerabilities, active maintenance activity, community support, and dependency overhead.",
          "C. Avoid open-source software completely.",
          "D. Copy raw unverified source code from internet forums directly into production."],
         "B", "Evaluating open-source libraries requires checking license terms, security vulnerability histories, maintenance vitality, and bloat.", "Decision Making", "Medium"),

        ("What caching strategy is most appropriate for high-frequency, read-heavy data that changes infrequently?",
         ["A. Write-Through cache with immediate eviction.",
          "B. Cache-Aside (Lazy Loading) with appropriate Time-To-Live (TTL) expiration and invalidate-on-write hooks.",
          "C. No caching, always query the primary relational database.",
          "D. Cache data exclusively in browser local storage."],
         "B", "Cache-Aside pattern with TTL expiration and invalidation on updates optimizes read-heavy workloads while maintaining consistency.", "Technical Knowledge", "Medium"),

        ("How should a Technical Lead address a critical zero-day security vulnerability discovered in a core dependency?",
         ["A. Wait until the next annual system maintenance cycle.",
          "B. Assess vulnerability impact, apply vendor patch or workaround in a hotfix branch, run regression tests, and deploy immediately.",
          "C. Ignore the vulnerability if no active exploit is publicly visible yet.",
          "D. Shut down the company website permanently."],
         "B", "Zero-day vulnerability response requires immediate risk assessment, hotfix patching, verification testing, and rapid deployment.", "Adaptability", "Hard"),

        ("Which data storage model is best suited for handling unstructured log telemetry at massive scale?",
         ["A. Normalized Relational SQL Database (ACID compliant).",
          "B. Distributed Columnar or Document/Search Database (e.g., Elasticsearch, ClickHouse, Cassandra).",
          "C. Excel spreadsheet CSV files.",
          "D. Single SQLite database file on a shared network drive."],
         "B", "Log telemetry and unstructured time-series analytics require distributed document/columnar storage optimized for write-heavy throughput.", "Technical Knowledge", "Medium"),

        ("How should a Technical Lead handle event-driven messaging consistency across microservices?",
         ["A. Assume network messages are always delivered instantly with 100% reliability.",
          "B. Implement Outbox Pattern, Idempotent Consumer handlers, and Dead Letter Queues (DLQ) to manage message delivery failures.",
          "C. Avoid using message queues.",
          "D. Delete messages whenever a consumer service throws an exception."],
         "B", "Reliable event-driven architectures rely on the Outbox pattern, consumer idempotency, and DLQs to ensure eventual consistency.", "Problem Solving", "Hard"),

        ("What is the primary role of a Technical Lead in disaster recovery (DR) planning?",
         ["A. Writing disaster scenarios for fictional movies.",
          "B. Defining technical Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO), and verifying automated failover backups.",
          "C. Buying extra office furniture.",
          "D. Relying on cloud providers to recover lost data without testing backups."],
         "B", "Disaster recovery readiness requires defining precise RTO/RPO metrics and regularly testing automated backup failover systems.", "Planning and Execution", "Hard"),

        ("How should a Technical Lead establish domain-driven design (DDD) boundaries in a complex software ecosystem?",
         ["A. Create database tables first before understanding business workflows.",
          "B. Conduct Event Storming with domain experts to identify Bounded Contexts, Ubiquitous Language, and Core Subdomains.",
          "C. Let each developer define their own unique terminology.",
          "D. Build one giant universal data model for all business operations."],
         "B", "Domain-Driven Design establishes Bounded Contexts and Ubiquitous Language through collaborative domain expert sessions.", "Strategic Thinking", "Hard"),

        ("What approach should a Technical Lead take when legacy code lacks any existing automated test coverage?",
         ["A. Delete the legacy code immediately.",
          "B. Add characterization tests around critical paths before refactoring, gradually building automated unit and integration coverage.",
          "C. Refactor the code blindly without tests.",
          "D. Never touch the legacy code."],
         "B", "Safely refactoring untested legacy code requires writing characterization tests to lock down current behavior before modifying logic.", "Technical Knowledge", "Medium"),

        ("How should a Technical Lead measure and control software complexity?",
         ["A. Counting total lines of code in a file.",
          "B. Monitoring Cyclomatic Complexity, Maintainability Index, and coupling metrics in static analysis tooling.",
          "C. Counting how many comments developers write.",
          "D. Measuring file download size."],
         "B", "Cyclomatic complexity and coupling metrics evaluate code maintainability and risk of defect introduction during changes.", "Decision Making", "Medium")
    ],

    "Operations Manager": [
        ("How should an Operations Manager implement a new succession planning framework across enterprise operations?",
         ["A. Enforce the framework abruptly without training or change communication.",
          "B. Engage leadership stakeholders, establish transparent competency benchmarks, and execute structured pilot phases with feedback loops.",
          "C. Keep succession planning benchmarks confidential and accessible only to executive HR.",
          "D. Implement succession recommendations solely based on employee tenure."],
         "B", "Successful operational frameworks rely on stakeholder engagement, transparent benchmarks, and structured change management.", "Planning and Execution", "Medium"),

        ("When addressing a critical bottleneck in employee onboarding workflows, what should an Operations Manager do first?",
         ["A. Blame the onboarding HR team publicly.",
          "B. Map the end-to-end value stream to identify delay stages, handoff friction, and manual step automation opportunities.",
          "C. Add 5 additional manual approval steps to the process.",
          "D. Outsource the onboarding process to an unverified third party."],
         "B", "Resolving process bottlenecks begins with value stream mapping and analyzing stage-by-stage operational handoffs.", "Problem Solving", "Medium"),

        ("How should an Operations Manager establish Service Level Agreements (SLAs) for internal operational support teams?",
         ["A. Set impossible targets like 1-second response times for all requests.",
          "B. Collaborate with business stakeholders to define realistic response/resolution SLAs aligned with operational business impact.",
          "C. Avoid setting SLAs so support teams are never held accountable.",
          "D. Copy SLA metrics from an external retail company."],
         "B", "Internal SLAs should balance business impact expectations with realistic operational team capacities.", "Planning and Execution", "Easy"),

        ("Which strategy best mitigates operational risk when migrating core enterprise business software?",
         ["A. Perform a direct cutover on Monday morning without back-up plans.",
          "B. Execute parallel run testing, establish rollback criteria, and conduct user acceptance validation during off-peak hours.",
          "C. Turn off legacy systems 2 weeks before launching new software.",
          "D. Skip user acceptance testing to accelerate deployment timelines."],
         "B", "Operational risk mitigation during software migration requires parallel running, rollback protocols, and robust user testing.", "Risk Management", "Hard"),

        ("How should an Operations Manager optimize resource capacity planning for peak operational seasons?",
         ["A. Hire 200% temporary staff without analyzing historical demand trends.",
          "B. Analyze historical workload patterns, cross-train core staff, and utilize flexible contingency staffing models.",
          "C. Require existing employees to work 16-hour shifts daily.",
          "D. Turn away customers during peak seasons."],
         "B", "Data-driven capacity planning combines historical trend analysis with flexible staffing and cross-trained team resources.", "Strategic Thinking", "Medium"),

        ("What is the primary focus of Lean Operations management in HR and business processes?",
         ["A. Cutting employee benefits to minimize expenses.",
          "B. Eliminating non-value-added waste (muda), streamlining workflows, and continuous process improvement (kaizen).",
          "C. Increasing bureaucracy and documentation requirements.",
          "D. Terminating staff whenever operational metrics drop."],
         "B", "Lean management focuses on eliminating operational waste, streamlining continuous value streams, and empowering frontline teams.", "Problem Solving", "Easy"),

        ("How should an Operations Manager evaluate key performance metrics across multiple operational facilities?",
         ["A. Compare facilities without normalizing for size or regional market differences.",
          "B. Establish standardized operational scorecards (e.g., SLA compliance, error rate, cost per transaction) normalized across locations.",
          "C. Rank facilities solely based on total headcount.",
          "D. Ignore performance differences between facilities."],
         "B", "Standardized, normalized operational scorecards enable fair performance benchmarking across diverse facility locations.", "Decision Making", "Medium"),

        ("What step should an Operations Manager take when employee compliance training completion rates drop below target?",
         ["A. Fire all non-compliant employees immediately.",
          "B. Audit training accessibility, simplify learning modules, automate reminder notifications, and engage line managers.",
          "C. Cancel compliance training requirements permanently.",
          "D. Blame the compliance department."],
         "B", "Improving compliance training completion requires removing friction, enhancing course accessibility, and driving manager accountability.", "Leadership", "Easy"),

        ("How should an Operations Manager manage third-party vendor performance issues?",
         ["A. Cancel vendor contracts immediately without reviewing contract terms.",
          "B. Review SLA metrics, issue formal corrective action requests (CAPA), and conduct structured vendor performance reviews.",
          "C. Ignore vendor underperformance and continue paying full invoices.",
          "D. Complain on social media about the vendor."],
         "B", "Managing vendor underperformance involves structured contractual reviews, corrective action plans, and objective metric tracking.", "Adaptability", "Medium"),

        ("What is the main goal of Business Continuity Planning (BCP) in operations management?",
         ["A. Maximize short-term quarterly profit margins.",
          "B. Ensure critical business functions can continue operating or recover quickly during major unexpected disruptions or disasters.",
          "C. Replace all human workers with automated machinery.",
          "D. Eliminate company policy documentation."],
         "B", "Business Continuity Planning ensures enterprise operational resilience and rapid recovery during catastrophic disruptions.", "Risk Management", "Hard"),

        ("How should an Operations Manager foster cross-functional collaboration between HR and IT operations?",
         ["A. Prevent HR and IT staff from communicating directly.",
          "B. Establish joint project steering committees, shared SLA objectives, and integrated workflow automation projects.",
          "C. Require all cross-department messages to be routed through executive VPs.",
          "D. Force HR to manage IT infrastructure without training."],
         "B", "Cross-functional synergy between HR and IT is fostered through shared project governance and automated workflow alignment.", "Team Management", "Medium"),

        ("What approach should an Operations Manager take when managing a high volume of customer service operational escalations?",
         ["A. Ignore customer complaints until they go away.",
          "B. Perform root-cause analysis (e.g., 5 Whys), implement preventative workflow fixes, and update knowledge base resources.",
          "C. Hire more escalation agents without addressing underlying root causes.",
          "D. Disable the customer support phone number."],
         "B", "Resolving operational escalation trends requires systematic root-cause analysis to prevent recurring systemic failures.", "Problem Solving", "Medium"),

        ("How should an Operations Manager approach process automation for repetitive manual tasks?",
         ["A. Automate broken, inefficient processes without streamlining them first.",
          "B. Standardize and optimize the manual workflow first, then implement Robotic Process Automation (RPA) or workflow software.",
          "C. Avoid automation because manual work builds character.",
          "D. Require employees to write manual logs on physical paper."],
         "B", "Optimizing and standardizing workflows before automating prevents accelerating inefficient or flawed operational steps.", "Strategic Thinking", "Medium"),

        ("What key metric best evaluates the efficiency of an employee offboarding operational workflow?",
         ["A. Time to revoke security access permissions and asset recovery completion rate within policy SLAs.",
          "B. Number of exit interviews canceled.",
          "C. Total severance pay cost.",
          "D. Length of the offboarding checklist document."],
         "A", "Offboarding operational efficiency is measured by rapid security access revocation, asset recovery, and SLA compliance.", "Planning and Execution", "Medium"),

        ("How should an Operations Manager manage change resistance when introducing a new operational policy?",
         ["A. Threaten resistant employees with disciplinary action.",
          "B. Communicate the 'why' behind policy changes, address employee concerns, provide clear training, and identify operational champions.",
          "C. Cancel the policy change at the first sign of feedback.",
          "D. Keep the policy hidden from staff."],
         "B", "Overcoming policy resistance requires clear strategic context, active listening, supportive training, and change champion enablement.", "Adaptability", "Easy"),

        ("What is the primary benefit of establishing standard operating procedures (SOPs)?",
         ["A. Increasing paper usage in office filing cabinets.",
          "B. Ensuring operational consistency, quality assurance, regulatory compliance, and rapid onboarding.",
          "C. Preventing employees from suggesting process improvements.",
          "D. Automatically increasing product prices."],
         "B", "SOPs establish consistent quality benchmarks, compliance safeguards, and clear operational guidance for employees.", "Planning and Execution", "Easy"),

        ("How should an Operations Manager respond to an internal operational audit finding non-compliance in safety records?",
         ["A. Destroy the audit report immediately.",
          "B. Formulate a Corrective and Preventive Action (CAPA) plan, assign clear ownership, and implement automated audit tracking.",
          "C. Argue with auditors that compliance rules do not apply.",
          "D. Suspend operations permanently."],
         "B", "Addressing audit non-compliance requires structured CAPA plans, clear leadership accountability, and tracking controls.", "Leadership", "Medium"),

        ("What strategy should an Operations Manager use to manage remote operational workforce productivity?",
         ["A. Install intrusive keystroke logging spyware on employee computers.",
          "B. Set clear outcome-based deliverables, establish regular sync cadence, and monitor objective SLA metrics.",
          "C. Require remote workers to stay on live webcam calls 8 hours a day.",
          "D. Stop tracking productivity for remote workers."],
         "B", "Managing remote workforce productivity is best achieved through objective outcome metrics, trust, and clear communication cadence.", "Team Management", "Medium"),

        ("How should an Operations Manager evaluate facility space utilization for modern hybrid work models?",
         ["A. Mandate 100% daily physical desk attendance.",
          "B. Analyze badge-in occupancy data, implement desk booking software, and optimize physical space for collaborative vs focus zones.",
          "C. Sell all office real estate immediately.",
          "D. Allow employees to occupy any desk without tracking space usage."],
         "B", "Data-driven occupancy tracking and flexible booking software optimize physical real estate for hybrid operational work patterns.", "Strategic Thinking", "Medium"),

        ("What is the ultimate goal of operational excellence for an Operations Manager?",
         ["A. Achieving flawless internal paperwork metrics at any cost.",
          "B. Delivering maximum customer value efficiently through resilient, continuous-improvement operational processes.",
          "C. Eliminating all operational management roles.",
          "D. Running operations without any technology."],
         "B", "Operational excellence seeks to maximize customer value and organizational agility through resilient, continuous process optimization.", "Leadership", "Hard")
    ]
}

def generate_questions_for_role(role_name, role_id, competencies_map):
    """
    Generates 20 high quality, role-specific questions for roles without hardcoded templates.
    """
    questions = []
    comp_ids = list(competencies_map.keys()) if competencies_map else [1]
    comp_names = list(competencies_map.values()) if competencies_map else ["Leadership"]

    scenarios = [
        "strategic vision and roadmap alignment",
        "resource allocation and scope management",
        "cross-functional stakeholder communication",
        "escalation and emergency conflict resolution",
        "performance metrics and KPI monitoring",
        "technical architecture and debt management",
        "team mentorship and skill development",
        "risk mitigation and contingency planning",
        "process improvement and agile workflows",
        "budgeting and operational cost control",
        "change management and organizational adaptation",
        "vendor and third-party integration management",
        "security policy and compliance enforcement",
        "crisis management and system reliability",
        "strategic hiring and talent pipeline building",
        "innovation management and R&D prioritization",
        "cross-team dependency alignment",
        "quality assurance and standards enforcement",
        "high-pressure decision making and ethics",
        "executive reporting and stakeholder presentation"
    ]

    for i in range(1, 21):
        comp_id = comp_ids[(i - 1) % len(comp_ids)]
        comp_name = comp_names[(i - 1) % len(comp_names)]
        scenario = scenarios[(i - 1) % len(scenarios)]
        diff = "Hard" if i % 3 == 0 else ("Medium" if i % 2 == 0 else "Easy")

        q_text = f"In the capacity of {role_name}, how would you strategically manage {scenario} during a high-stakes business scenario?"
        options = [
            f"A. Formulate a structured data-driven strategy, align key stakeholders, and execute with continuous evaluation.",
            f"B. Delegate the entire responsibility without providing clear guidance or monitoring.",
            f"C. Postpone addressing the scenario until external pressure forces immediate action.",
            f"D. Enforce rigid historical rules without evaluating current context or trade-offs."
        ]
        correct = "A"
        explanation = f"As a {role_name}, effective {scenario} requires structured analysis, stakeholder alignment, and continuous governance."

        questions.append((q_text, options, correct, explanation, comp_name, diff))

    return questions

def ensure_question_bank_is_custom_column():
    try:
        inspector = db.inspect(db.engine)
        columns = [c['name'] for c in inspector.get_columns('question_bank')]
        if 'is_custom' not in columns:
            with db.engine.connect() as conn:
                conn.execute(db.text("ALTER TABLE question_bank ADD COLUMN is_custom BOOLEAN DEFAULT FALSE"))
                conn.commit()
            print("[INFO] Added 'is_custom' column to question_bank table.")
    except Exception as e:
        print(f"[WARNING] Could not check/add is_custom column: {str(e)}")

def seed_question_bank():
    """
    Idempotent seeding function: Checks existing leadership roles and ensures EVERY role
    has AT LEAST 20 built-in MCQ questions in the question_bank table.
    """
    try:
        ensure_question_bank_is_custom_column()
        roles = LeadershipRole.query.all()
        if not roles:
            print("[INFO] No leadership roles found. Skipping Question Bank seed.")
            return

        competencies = Competency.query.all()
        comp_map_by_name = {c.name.strip().lower(): c.id for c in competencies}
        comp_map_by_id = {c.id: c.name for c in competencies}

        default_comp_id = competencies[0].id if competencies else 1

        total_seeded = 0
        roles_processed = 0

        for role in roles:
            roles_processed += 1
            existing_count = QuestionBank.query.filter_by(role_id=role.id).count()
            
            # Fetch template or generate questions
            q_source = ROLE_QUESTION_TEMPLATES.get(role.role_name)
            if not q_source:
                q_source = generate_questions_for_role(role.role_name, role.id, comp_map_by_id)

            seeded_for_this_role = 0

            for idx, item in enumerate(q_source, start=1):
                stable_code = f"QB_{role.id}_{idx:02d}"
                
                # Check if question already exists by stable_code or role_id + index
                existing_q = QuestionBank.query.filter_by(stable_code=stable_code).first()
                if not existing_q:
                    existing_q = QuestionBank.query.filter_by(role_id=role.id, question_text=item[0]).first()

                q_text, opts, corr, expl, c_name, diff = item
                
                # Match competency ID
                matched_cid = comp_map_by_name.get(c_name.strip().lower(), default_comp_id)

                if not existing_q:
                    q_bank_obj = QuestionBank(
                        role_id=role.id,
                        competency_id=matched_cid,
                        question_text=q_text,
                        question_type='Multiple Choice',
                        correct_answer=corr,
                        explanation=expl,
                        difficulty=diff,
                        max_score=1.0,
                        stable_code=stable_code
                    )
                    q_bank_obj.set_options(opts)
                    db.session.add(q_bank_obj)
                    seeded_for_this_role += 1
                    total_seeded += 1
                else:
                    # Update fields if needed ensuring idempotency
                    existing_q.role_id = role.id
                    existing_q.competency_id = matched_cid
                    existing_q.correct_answer = corr
                    existing_q.explanation = expl
                    existing_q.difficulty = diff
                    existing_q.max_score = 1.0
                    existing_q.set_options(opts)

            db.session.commit()
            final_count = QuestionBank.query.filter_by(role_id=role.id).count()
            print(f"[INFO] Question Bank for '{role.role_name}' (ID {role.id}): {final_count} questions present ({seeded_for_this_role} newly seeded).")

        print(f"[SUCCESS] Built-in Question Bank Verified: {roles_processed} leadership roles checked, total {QuestionBank.query.count()} questions in database.")

        # Sync sample assessment questions if needed
        sync_sample_assessments_with_question_bank()

    except Exception as e:
        db.session.rollback()
        print(f"[WARNING] Error seeding question bank: {str(e)}")

def sync_sample_assessments_with_question_bank():
    """
    Ensures existing/seeded Assessment templates have questions linked from the built-in Question Bank.
    """
    try:
        assessments = Assessment.query.all()
        for ass in assessments:
            if not ass.questions or len(ass.questions) < 20:
                # Load built-in questions for this assessment's target role
                qb_questions = QuestionBank.query.filter_by(role_id=ass.role_id).all()
                if not qb_questions:
                    qb_questions = QuestionBank.query.all()[:20]

                if qb_questions:
                    # Clear sparse legacy questions and populate all 20 built-in questions
                    AssessmentQuestion.query.filter_by(assessment_id=ass.id).delete()
                    for idx, qb in enumerate(qb_questions, start=1):
                        aq = AssessmentQuestion(
                            assessment_id=ass.id,
                            question=qb.question_text,
                            question_type='Multiple Choice',
                            competency_id=qb.competency_id,
                            max_score=qb.max_score,
                            correct_answer=qb.correct_answer,
                            explanation=qb.explanation,
                            difficulty=qb.difficulty,
                            order_index=idx
                        )
                        aq.set_options(qb.get_options())
                        db.session.add(aq)
                    db.session.commit()
                    print(f"[INFO] Synchronized {len(qb_questions)} built-in questions into Assessment '{ass.title}' (ID {ass.id})")
    except Exception as e:
        db.session.rollback()
        print(f"[WARNING] Error syncing sample assessments: {str(e)}")
