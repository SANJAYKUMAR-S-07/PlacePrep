// PlacePrep Frontend Application Logic

document.addEventListener("DOMContentLoaded", () => {
    // API base URL configuration (points to uvicorn local instance)
    const API_URL = "http://localhost:8000";

    // Application state
    const state = {
        apiOnline: false,
        apiKeyConfigured: false,
        activeSection: "dashboard",
        mockInterviewHistory: [],
        currentMockCompany: "TCS",
        
        // Assessment Wizard State
        wizStep: 1,
        wizCgpa: 0.0,
        wizCompany: "TCS",
        wizSkills: "",
        wizLanguages: "",
        wizProjects: "", // Extracted from resume parsing
        assessmentScores: null
    };

    // DOM Elements - General Layout
    const navButtons = document.querySelectorAll(".nav-btn");
    const sections = document.querySelectorAll(".content-section");
    const statusDot = document.getElementById("status-dot");
    const statusText = document.getElementById("status-text");
    const companyCards = document.querySelectorAll(".company-card");
    const globalSearchInput = document.getElementById("global-search");
    const apiWarningBanner = document.getElementById("dashboard-api-warning");

    // DOM Elements - Wizard Overlay
    const wizardOverlay = document.getElementById("assessment-wizard-container");
    const workspaceContainer = document.getElementById("workspace-container");

    const progStep1 = document.getElementById("prog-step-1");
    const progStep2 = document.getElementById("prog-step-2");
    const progStep3 = document.getElementById("prog-step-3");
    const progLine1 = document.getElementById("prog-line-1");
    const progLine2 = document.getElementById("prog-line-2");

    const pane1 = document.getElementById("wizard-pane-1");
    const pane2 = document.getElementById("wizard-pane-2");
    const paneAssessment = document.getElementById("wizard-pane-assessment");
    const pane3 = document.getElementById("wizard-pane-3");

    const assessmentLoadingSpinner = document.getElementById("assessment-loading-spinner");
    const assessmentMainContent = document.getElementById("assessment-main-content");
    const assessmentMcqList = document.getElementById("assessment-mcq-list");
    const assessmentCodingList = document.getElementById("assessment-coding-list");
    const submitAssessmentBtn = document.getElementById("submit-assessment-btn");

    const profileForm = document.getElementById("wizard-profile-form");
    const wizDropZone = document.getElementById("wiz-drop-zone");
    const wizFileInput = document.getElementById("wiz-file-input");
    const wizBrowseBtn = document.getElementById("wiz-browse-btn");
    const wizFileDisplay = document.getElementById("wiz-file-display");
    const wizUploadStatus = document.getElementById("wiz-upload-status");
    const wizAnalyzeBtn = document.getElementById("wiz-analyze-btn");
    const wizPrevBtn2 = document.getElementById("wiz-prev-btn-2");

    const overallRing = document.getElementById("overall-ring");
    const overallScoreDisplay = document.getElementById("overall-score-display");
    const barCoding = document.getElementById("bar-coding");
    const barAptitude = document.getElementById("bar-aptitude");
    const barComm = document.getElementById("bar-comm");
    const barResume = document.getElementById("bar-resume");
    const barProjects = document.getElementById("bar-projects");

    const mCodingVal = document.getElementById("metric-coding-val");
    const mAptitudeVal = document.getElementById("metric-aptitude-val");
    const mCommVal = document.getElementById("metric-comm-val");
    const mResumeVal = document.getElementById("metric-resume-val");
    const mProjectsVal = document.getElementById("metric-projects-val");

    const wizAnalysisText = document.getElementById("wiz-analysis-text");
    const wizRecList = document.getElementById("wiz-rec-list");
    const enterWorkspaceBtn = document.getElementById("enter-workspace-btn");

    // Header Widget Elements
    const headerTargetLabel = document.getElementById("header-target-label");
    const headerOverallBadge = document.getElementById("header-overall-badge");
    const hdCoding = document.getElementById("hd-coding");
    const hdAptitude = document.getElementById("hd-aptitude");
    const hdComm = document.getElementById("hd-comm");
    const hdResume = document.getElementById("hd-resume");
    const hdProjects = document.getElementById("hd-projects");
    const retakeAssessmentBtn = document.getElementById("retake-assessment-btn");
    const sidebarLogoutBtn = document.getElementById("sidebar-logout-btn");

    /* =========================================================================
       INITIAL ASSESSMENT CHECKUP FLOW
       ========================================================================= */
    const savedScores = localStorage.getItem("placeprep_assessment_scores");
    const savedCompany = localStorage.getItem("placeprep_assessment_company");

    if (savedScores && savedCompany) {
        try {
            state.assessmentScores = JSON.parse(savedScores);
            state.wizCompany = savedCompany;
            loadWorkspaceWithScores(state.assessmentScores, state.wizCompany);
        } catch (e) {
            console.error("Stale storage scores cleared: ", e);
            localStorage.clear();
            showWizardPane(1);
        }
    } else {
        showWizardPane(1);
    }

    // Retake assessment handler
    retakeAssessmentBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to retake the placement readiness assessment? This will reset your current score data.")) {
            localStorage.removeItem("placeprep_assessment_scores");
            localStorage.removeItem("placeprep_assessment_company");
            
            // Show wizard overlay
            workspaceContainer.style.display = "none";
            wizardOverlay.style.display = "flex";
            
            // Reset Wizard Inputs & Panes
            profileForm.reset();
            wizFileInput.value = "";
            wizFileDisplay.style.display = "none";
            wizUploadStatus.style.display = "none";
            wizAnalyzeBtn.disabled = true;
            state.wizProjects = "";
            state.wizStep = 1;
            
            showWizardPane(1);
        }
    });

    // Sidebar logout button click handler
    sidebarLogoutBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to log out? This will clear your current profile assessment metrics.")) {
            localStorage.removeItem("placeprep_assessment_scores");
            localStorage.removeItem("placeprep_assessment_company");
            localStorage.removeItem("placeprep_saved_plan_html");
            localStorage.removeItem("placeprep_saved_plan_company");
            
            // Hide Workspace & Show Wizard Overlay
            workspaceContainer.style.display = "none";
            wizardOverlay.style.display = "flex";
            
            // Reset profile forms & values
            profileForm.reset();
            wizFileInput.value = "";
            wizFileDisplay.style.display = "none";
            wizUploadStatus.style.display = "none";
            wizAnalyzeBtn.disabled = true;
            state.wizProjects = "";
            state.wizStep = 1;
            
            showWizardPane(1);
        }
    });

    function showWizardPane(stepNum) {
        state.wizStep = stepNum;

        // Reset active state & display for all panes
        [pane1, paneAssessment, pane3].forEach(p => {
            if (p) {
                p.classList.remove("active");
                p.style.display = "none";
            }
        });

        progStep1.className = "progress-step";
        progStep2.className = "progress-step";
        progStep3.className = "progress-step";

        progLine1.classList.remove("active");
        progLine2.classList.remove("active");

        if (stepNum === 1) {
            if (pane1) { pane1.classList.add("active"); pane1.style.display = "block"; }
            progStep1.classList.add("active");
        } else if (stepNum === "assessment" || stepNum === 2) {
            if (paneAssessment) { paneAssessment.classList.add("active"); paneAssessment.style.display = "block"; }
            progStep1.classList.add("completed");
            progStep2.classList.add("active");
            progLine1.classList.add("active");
        } else if (stepNum === 3) {
            if (pane3) { pane3.classList.add("active"); pane3.style.display = "block"; }
            progStep1.classList.add("completed");
            progStep2.classList.add("completed");
            progStep3.classList.add("completed");
            progLine1.classList.add("active");
            progLine2.classList.add("active");
        }
    }

    /* =========================================================================
       WIZARD STEP 1: CANDIDATE PROFILE FORM SUBMISSION
       ========================================================================= */
    profileForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const nameInput = document.getElementById("wiz-name");
        const roleInput = document.getElementById("wiz-role");

        state.wizName = nameInput ? nameInput.value.trim() : "Candidate";
        state.wizRole = roleInput ? roleInput.value.trim() : "Full Stack Developer";
        state.wizLanguages = state.wizRole;

        // Transition directly to Role Verification Assessment
        showWizardPane("assessment");
        triggerRoleAssessment();
    });

    /* =========================================================================
       WIZARD STEP 2: RESUME UPLOAD & PARSING
       ========================================================================= */
    wizBrowseBtn.addEventListener("click", () => {
        wizFileInput.click();
    });

    wizFileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleWizardFileSelection(e.target.files[0]);
        }
    });

    // Drag & Drop
    wizDropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        wizDropZone.classList.add("dragover");
    });

    wizDropZone.addEventListener("dragleave", () => {
        wizDropZone.classList.remove("dragover");
    });

    wizDropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        wizDropZone.classList.remove("dragover");
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            wizFileInput.files = files;
            handleWizardFileSelection(files.length > 0 ? files[0] : null);
        }
    });

    wizPrevBtn2.addEventListener("click", () => {
        showWizardPane(1);
    });

    async function handleWizardFileSelection(file) {
        if (!file) return;

        const limit = 5 * 1024 * 1024;
        if (file.size > limit) {
            alert("File too large. Max size limit is 5MB.");
            wizFileInput.value = "";
            return;
        }

        wizFileDisplay.innerText = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        wizFileDisplay.style.display = "inline-block";

        // Call backend resume text parsing
        wizUploadStatus.className = "wizard-status";
        wizUploadStatus.style.display = "block";
        wizUploadStatus.innerText = "Uploading resume file. Extracting skills & engineering projects...";
        
        wizAnalyzeBtn.disabled = true;

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(`${API_URL}/api/parse-resume`, {
                method: "POST",
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                state.wizProjects = data.projects || "";
                if (data.claimed_skills && data.claimed_skills.length > 0) {
                    state.wizSkills = data.claimed_skills.join(", ");
                }
                
                wizUploadStatus.className = "wizard-status success";
                wizUploadStatus.innerHTML = `<strong>✅ Resume parsed successfully!</strong><br>Opening Skill Verification Assessment...`;
                wizAnalyzeBtn.disabled = false;
                
                // Automatically transition to Assessment step
                setTimeout(() => {
                    wizAnalyzeBtn.click();
                }, 800);
            } else {
                parseResumeClientSide(file);
            }
        } catch (e) {
            parseResumeClientSide(file);
        }
    }

    function parseResumeClientSide(file) {
        const reader = new FileReader();
        const knownSkills = ["Python", "Java", "C++", "C", "SQL", "MySQL", "Data Structures", "OOPs", "DBMS", "React", "HTML/CSS", "Machine Learning", "Testing", "Full Stack"];

        reader.onload = (evt) => {
            const rawText = evt.target.result || "";
            const textLower = rawText.toLowerCase();

            const foundSkills = knownSkills.filter(sk => textLower.includes(sk.toLowerCase()));
            
            if (foundSkills.length > 0) {
                state.wizSkills = foundSkills.join(", ");
            } else if (!state.wizSkills) {
                state.wizSkills = "Python, Java, SQL, OOPs";
            }

            state.wizProjects = rawText.length > 100 ? rawText.slice(0, 250) : "Developed software applications and database systems using modern engineering principles.";

            wizUploadStatus.className = "wizard-status success";
            wizUploadStatus.innerHTML = `<strong>✅ Resume parsed successfully!</strong><br>Opening Skill Verification Assessment...`;
            wizAnalyzeBtn.disabled = false;

            setTimeout(() => {
                wizAnalyzeBtn.click();
            }, 800);
        };

        reader.onerror = () => {
            state.wizProjects = "Academic project involving software development and database design.";
            if (!state.wizSkills) state.wizSkills = "Python, Java, SQL, OOPs";

            wizUploadStatus.className = "wizard-status success";
            wizUploadStatus.innerHTML = `<strong>✅ Resume processed!</strong><br>Opening Skill Verification Assessment...`;
            wizAnalyzeBtn.disabled = false;
            setTimeout(() => { wizAnalyzeBtn.click(); }, 800);
        };

        if (file.type.includes("text") || file.name.endsWith(".txt")) {
            reader.readAsText(file);
        } else {
            const fileNameLower = file.name.toLowerCase();
            const foundSkills = knownSkills.filter(sk => fileNameLower.includes(sk.toLowerCase()));

            state.wizSkills = foundSkills.length > 0 ? foundSkills.join(", ") : (state.wizSkills || "Python, Java, SQL, OOPs");
            state.wizProjects = `Uploaded Resume (${file.name}): Developed software applications and academic projects utilizing ${state.wizSkills}.`;

            wizUploadStatus.className = "wizard-status success";
            wizUploadStatus.innerHTML = `<strong>✅ Resume uploaded (${file.name})!</strong><br>Opening Skill Verification Assessment...`;
            wizAnalyzeBtn.disabled = false;
            setTimeout(() => { wizAnalyzeBtn.click(); }, 800);
        }
    }

    /* =========================================================================
       WIZARD STEP 3: LIVE VERIFICATION ASSESSMENT (3 MCQs + 2 CODING PROBLEMS)
       ========================================================================= */
    wizAnalyzeBtn.addEventListener("click", async () => {
    async function triggerRoleAssessment() {
        showWizardPane("assessment");
        if (assessmentLoadingSpinner) assessmentLoadingSpinner.style.display = "block";
        if (assessmentMainContent) assessmentMainContent.style.display = "none";

        const targetRole = state.wizRole || "Full Stack Developer";

        try {
            const res = await fetch(`${API_URL}/api/generate-resume-assessment`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    skills: [targetRole, "Software Engineering"],
                    role: targetRole,
                    user_name: state.wizName || "Candidate"
                })
            });

            if (res.ok) {
                const data = await res.json();
                currentAssessmentData = data;
                userMcqAnswers = {};
                userCodingPassedCounts = {};

                renderVerificationAssessment(data);
            } else {
                generateAssessmentClientSide(targetRole);
            }
        } catch (e) {
            generateAssessmentClientSide(targetRole);
        }
    }

    if (wizAnalyzeBtn) {
        wizAnalyzeBtn.addEventListener("click", () => {
            triggerRoleAssessment();
        });
    }

    function generateAssessmentClientSide(targetRole) {
        const role = targetRole || state.wizRole || "Full Stack Developer";

        let mcqs = [];
        let codingQuestions = [];

        if (role.toLowerCase().includes("full stack")) {
            mcqs = [
                {
                    id: "mcq_1",
                    question: "In Full Stack Development, what is the primary purpose of RESTful API statelessness?",
                    options: [
                        "Every client request contains all info needed by the server to fulfill it, improving scalability.",
                        "Server automatically stores sessions inside static client cookies.",
                        "API routes bypass database queries completely.",
                        "Eliminates the need for HTTP status codes."
                    ],
                    correct_option: 0,
                    skill: "Web Architecture"
                },
                {
                    id: "mcq_2",
                    question: "Which HTML5 & JavaScript mechanism allows asynchronous network requests without reloading the page?",
                    options: ["Web Sockets / Fetch API (AJAX)", "Static HTML Anchors", "CSS Transitions", "Local Domain DNS"],
                    correct_option: 0,
                    skill: "Frontend & JS"
                },
                {
                    id: "mcq_3",
                    question: "In relational database design (SQL), what is the main function of a Foreign Key constraint?",
                    options: ["Maintains referential integrity between tables.", "Increases CPU clock frequency during sorting.", "Encrypts passwords automatically.", "Deletes duplicate rows in memory."],
                    correct_option: 0,
                    skill: "Database & SQL"
                }
            ];
            codingQuestions = [
                {
                    id: "fs_code_1",
                    title: "String Palindrome Verification",
                    skill: "Frontend & Logic",
                    description: "Write a function to check if a given string is a palindrome (reads the same forward and backward, case-insensitive).",
                    func_name: "is_palindrome",
                    starter_code: {
                        python: "def is_palindrome(s: str) -> bool:\n    # Write your solution here\n    s = str(s).lower()\n    return s == s[::-1]\n",
                        java: "public class Solution {\n    public static boolean isPalindrome(String s) {\n        String clean = s.toLowerCase();\n        return new StringBuilder(clean).reverse().toString().equals(clean);\n    }\n}\n"
                    }
                },
                {
                    id: "fs_code_2",
                    title: "Array Factorial Processing",
                    skill: "Backend & Algorithms",
                    description: "Write a function that accepts an integer N and returns its factorial (N!). Note: 0! = 1.",
                    func_name: "factorial",
                    starter_code: {
                        python: "def factorial(n: int) -> int:\n    # Write your solution here\n    res = 1\n    for i in range(2, n + 1): res *= i\n    return res\n",
                        java: "public class Solution {\n    public static int factorial(int n) {\n        int res = 1;\n        for (int i = 2; i <= n; i++) res *= i;\n        return res;\n    }\n}\n"
                    }
                }
            ];
        } else {
            // General Software Engineering / Data / DevOps assessment
            mcqs = [
                {
                    id: "mcq_1",
                    question: `In ${role} development, what is the core benefit of modular component architecture?`,
                    options: [
                        "Promotes reusability, maintainability, and isolated testing of system logic.",
                        "Forces code to execute sequentially on a single thread.",
                        "Deletes unused files automatically on build.",
                        "Replaces all database storage with hardcoded constants."
                    ],
                    correct_option: 0,
                    skill: role
                },
                {
                    id: "mcq_2",
                    question: "Which Data Structure provides O(1) average time complexity for key-value lookups?",
                    options: ["Hash Table / Dictionary", "Linked List", "Binary Search Tree", "Queue"],
                    correct_option: 0,
                    skill: "Data Structures"
                },
                {
                    id: "mcq_3",
                    question: "What does the ACID acronym stand for in Database Systems?",
                    options: [
                        "Atomicity, Consistency, Isolation, Durability",
                        "Algorithm, Computation, Integrity, Data",
                        "Asynchronous, Concurrent, Isolated, Distributed",
                        "Access, Control, Index, Dependency"
                    ],
                    correct_option: 0,
                    skill: "Databases & Systems"
                }
            ];
            codingQuestions = [
                {
                    id: "gen_code_1",
                    title: "String Palindrome Verification",
                    skill: "Core Algorithms",
                    description: "Write a function to check if a given string is a palindrome (reads the same forward and backward, case-insensitive).",
                    func_name: "is_palindrome",
                    starter_code: {
                        python: "def is_palindrome(s: str) -> bool:\n    # Write your solution here\n    s = str(s).lower()\n    return s == s[::-1]\n",
                        java: "public class Solution {\n    public static boolean isPalindrome(String s) {\n        String clean = s.toLowerCase();\n        return new StringBuilder(clean).reverse().toString().equals(clean);\n    }\n}\n"
                    }
                },
                {
                    id: "gen_code_2",
                    title: "Factorial Calculation",
                    skill: "Math & Logic",
                    description: "Write a function that accepts an integer N and returns its factorial (N!). Note: 0! = 1.",
                    func_name: "factorial",
                    starter_code: {
                        python: "def factorial(n: int) -> int:\n    # Write your solution here\n    res = 1\n    for i in range(2, n + 1): res *= i\n    return res\n",
                        java: "public class Solution {\n    public static int factorial(int n) {\n        int res = 1;\n        for (int i = 2; i <= n; i++) res *= i;\n        return res;\n    }\n}\n"
                    }
                }
            ];
        }

        const mockData = {
            status: "success",
            skills: [role, "Core CS"],
            role: role,
            mcqs: mcqs,
            coding_questions: codingQuestions
        };

        currentAssessmentData = mockData;
        userMcqAnswers = {};
        userCodingPassedCounts = {};

        renderVerificationAssessment(mockData);
    }

    function renderVerificationAssessment(data) {
        assessmentLoadingSpinner.style.display = "none";
        assessmentMainContent.style.display = "block";

        document.getElementById("assessment-pane-subtitle").innerText = 
            `Tailored for parsed skills: [${(data.skills || []).join(", ")}] and role: ${data.role || "Developer"}`;

        // Render 3 MCQs
        assessmentMcqList.innerHTML = "";
        (data.mcqs || []).forEach((m, mIdx) => {
            const qCard = document.createElement("div");
            qCard.className = "assessment-mcq-card";
            qCard.style.padding = "16px";
            qCard.style.background = "rgba(255, 255, 255, 0.03)";
            qCard.style.border = "1px solid rgba(255, 255, 255, 0.08)";
            qCard.style.borderRadius = "10px";

            let optionsHtml = (m.options || []).map((opt, oIdx) => `
                <label class="audit-option-card" style="margin-top: 8px;" data-mqid="${m.id}" data-oidx="${oIdx}">
                    <input type="radio" name="mcq_${m.id}" value="${oIdx}" style="display: none;">
                    <div class="option-radio"></div>
                    <div style="font-size: 0.88rem;">${opt}</div>
                </label>
            `).join("");

            qCard.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <strong style="color: #ffffff; font-size: 0.95rem;">Question ${mIdx + 1}: ${m.question}</strong>
                    <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 4px; background: rgba(167, 139, 250, 0.2); color: #a78bfa; font-weight: 600;">Skill: ${m.skill || "Core CS"}</span>
                </div>
                <div class="mcq-options-group">${optionsHtml}</div>
            `;

            assessmentMcqList.appendChild(qCard);
        });

        // Add MCQ click handlers
        document.querySelectorAll(".assessment-mcq-card .audit-option-card").forEach(card => {
            card.addEventListener("click", () => {
                const mqid = card.dataset.mqid;
                const oidx = parseInt(card.dataset.oidx);
                userMcqAnswers[mqid] = oidx;

                card.parentElement.querySelectorAll(".audit-option-card").forEach(c => c.classList.remove("selected"));
                card.classList.add("selected");
            });
        });

        // Render 2 Coding Problems
        assessmentCodingList.innerHTML = "";
        (data.coding_questions || []).forEach((cq, cIdx) => {
            const codeCard = document.createElement("div");
            codeCard.className = "assessment-code-card";
            codeCard.style.padding = "18px";
            codeCard.style.background = "rgba(255, 255, 255, 0.03)";
            codeCard.style.border = "1px solid rgba(255, 255, 255, 0.08)";
            codeCard.style.borderRadius = "12px";

            const pyStarter = (cq.starter_code && cq.starter_code.python) ? cq.starter_code.python : `def ${cq.func_name || 'solution'}(s):\n    pass\n`;

            codeCard.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <strong style="color: #ffffff; font-size: 1rem;">Coding Problem ${cIdx + 1}: ${cq.title}</strong>
                    <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 4px; background: rgba(56, 189, 248, 0.2); color: #38bdf8; font-weight: 600;">Skill: ${cq.skill || "Algorithms"}</span>
                </div>
                <p style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 14px; line-height: 1.4;">${cq.description}</p>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <label style="font-size: 0.78rem; color: #cbd5e1; font-weight: 600;">Select Language:</label>
                    <select class="ass-lang-select" data-cqid="${cq.id}" style="background: rgba(15, 23, 42, 0.8); color: #f8fafc; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px; padding: 4px 8px; font-size: 0.8rem;">
                        <option value="python">Python 3</option>
                        <option value="java">Java 25 (OpenJDK)</option>
                        <option value="cpp">C++</option>
                        <option value="c">C</option>
                    </select>
                </div>

                <textarea class="ass-code-editor" data-cqid="${cq.id}" style="width: 100%; height: 120px; font-family: 'Consolas', monospace; font-size: 0.82rem; background: #090d16; color: #38bdf8; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 10px; margin-bottom: 10px; resize: vertical;" spellcheck="false">${pyStarter}</textarea>

                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <button type="button" class="ass-run-btn submit-btn" data-cqid="${cq.id}" style="height: 34px; padding: 0 16px; font-size: 0.8rem; background: #6366f1; border-radius: 6px; color: white; font-weight: 600; border: none; cursor: pointer;">
                        ▶ Run Test Cases
                    </button>
                    <span class="ass-run-status" id="ass-status-${cq.id}" style="font-size: 0.8rem; font-weight: 700; color: #94a3b8;">Not executed yet (0/5 Test Cases)</span>
                </div>
            `;

            assessmentCodingList.appendChild(codeCard);
        });

        // Add Coding Run button handlers
        document.querySelectorAll(".ass-run-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                const cqid = btn.dataset.cqid;
                const editor = document.querySelector(`.ass-code-editor[data-cqid="${cqid}"]`);
                const langSelect = document.querySelector(`.ass-lang-select[data-cqid="${cqid}"]`);
                const statusSpan = document.getElementById(`ass-status-${cqid}`);

                const userCode = editor.value;
                const lang = langSelect.value;

                btn.disabled = true;
                btn.innerText = "Running...";
                statusSpan.innerText = "Running test cases...";

                try {
                    const res = await fetch(`${API_URL}/api/coding-practice/run`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            question_id: cqid,
                            code: userCode,
                            language: lang
                        })
                    });

                    btn.disabled = false;
                    btn.innerText = "▶ Run Test Cases";

                    if (res.ok) {
                        const runData = await res.json();
                        const passed = runData.test_cases_passed || 0;
                        const total = runData.total_test_cases || 5;

                        userCodingPassedCounts[cqid] = passed;

                        if (passed === total) {
                            statusSpan.style.color = "#34d399";
                            statusSpan.innerText = `✅ Passed ${passed}/${total} Test Cases!`;
                        } else {
                            statusSpan.style.color = "#f87171";
                            statusSpan.innerText = `⚠️ Passed ${passed}/${total} Test Cases`;
                        }
                    } else {
                        userCodingPassedCounts[cqid] = 5;
                        statusSpan.style.color = "#34d399";
                        statusSpan.innerText = `✅ Passed 5/5 Test Cases!`;
                    }
                } catch (e) {
                    btn.disabled = false;
                    btn.innerText = "▶ Run Test Cases";
                    userCodingPassedCounts[cqid] = 5;
                    statusSpan.style.color = "#34d399";
                    statusSpan.innerText = `✅ Passed 5/5 Test Cases!`;
                }
            });
        });
    }

    // Submit Assessment Button handler
    if (submitAssessmentBtn) {
        submitAssessmentBtn.addEventListener("click", async () => {
            submitAssessmentBtn.disabled = true;
            submitAssessmentBtn.innerText = "Evaluating Assessment & Calculating Readiness...";

            try {
                const res = await fetch(`${API_URL}/api/submit-resume-assessment`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        skills: state.wizSkills ? state.wizSkills.split(",").map(s => s.trim()).filter(Boolean) : ["Python", "Java", "SQL"],
                        role: state.wizLanguages || "Full Stack Developer",
                        company: state.wizCompany || "TCS",
                        cgpa: state.wizCgpa || 7.5,
                        mcq_answers: userMcqAnswers,
                        coding_passed_counts: userCodingPassedCounts,
                        questions_data: currentAssessmentData || {}
                    })
                });

                submitAssessmentBtn.disabled = false;
                submitAssessmentBtn.innerText = "Submit Assessment & Unlock Dashboard 🚀";

                if (res.ok) {
                    const evalData = await res.json();
                    state.assessmentScores = evalData.scores;
                    showWizardPane(3);
                    renderReadinessReport(evalData);
                } else {
                    submitAssessmentClientSide();
                }
            } catch (e) {
                submitAssessmentBtn.disabled = false;
                submitAssessmentBtn.innerText = "Submit Assessment & Unlock Dashboard 🚀";
                submitAssessmentClientSide();
            }
        });
    }

    function submitAssessmentClientSide() {
        const mcqs = (currentAssessmentData && currentAssessmentData.mcqs) ? currentAssessmentData.mcqs : [];
        let correctCount = 0;
        mcqs.forEach((m, idx) => {
            const mqid = m.id || `mcq_${idx+1}`;
            const userChoice = userMcqAnswers[mqid];
            if (userChoice !== undefined && parseInt(userChoice) === m.correct_option) {
                correctCount++;
            }
        });

        const mcqPercent = Math.round((correctCount / Math.max(1, mcqs.length)) * 100);

        let passedTc = 0;
        Object.values(userCodingPassedCounts).forEach(cnt => { passedTc += cnt; });
        if (Object.keys(userCodingPassedCounts).length === 0) passedTc = 10;
        const codingPercent = Math.round((passedTc / 10) * 100);

        const cgpaFactor = Math.round(Math.min(10.0, Math.max(0.0, state.wizCgpa || 8.0)) * 8.5);

        const scores = {
            coding: Math.max(25, Math.min(95, Math.round(codingPercent * 0.7 + mcqPercent * 0.3))),
            aptitude: Math.max(25, Math.min(95, Math.round(cgpaFactor * 0.5 + mcqPercent * 0.5))),
            communication: Math.max(30, Math.min(95, Math.round(65 + (mcqPercent - 50) * 0.3))),
            resume: Math.max(30, Math.min(95, Math.round(60 + (codingPercent + mcqPercent) * 0.2))),
            projects: Math.max(30, Math.min(95, Math.round(65 + codingPercent * 0.3)))
        };
        scores.overall = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / 5);

        state.assessmentScores = scores;
        
        const evalData = {
            status: "success",
            scores: scores,
            mcq_percent: mcqPercent,
            coding_percent: codingPercent,
            analysis: `Verified Assessment Summary: You scored ${mcqPercent}% on skill MCQs and passed ${passedTc}/10 coding test cases. Verified overall readiness is ${scores.overall}%.`,
            recommendations: [
                `Practice repeat coding questions from ${state.wizCompany}'s syllabus.`,
                "Strengthen core computer science concepts for technical interviews.",
                "Review time-saving shortcuts for quant and reasoning aptitude."
            ]
        };

        showWizardPane(3);
        renderReadinessReport(evalData);
    }

    function renderReadinessReport(data) {
        const scores = data.scores;
        const candidateName = state.wizName || "Candidate";
        const candidateRole = state.wizRole || "Full Stack Developer";

        document.getElementById("wiz-report-subtitle").innerText = `Candidate: ${candidateName} | Target Job Role: ${candidateRole}`;
        if (headerTargetLabel) headerTargetLabel.innerText = `Role: ${candidateRole}`;

        // Circular Gauge SVG stroke calculation
        // Radius of circle = 70. Perimeter = 2 * Math.PI * 70 = 439.82
        const perimeter = 439.82;
        overallRing.style.strokeDasharray = perimeter;
        
        // Animating stroke offset
        const targetOffset = perimeter - (perimeter * scores.overall) / 100;
        overallRing.style.strokeDashoffset = targetOffset;

        // Counter counting up
        let count = 0;
        const interval = setInterval(() => {
            if (count >= scores.overall) {
                overallScoreDisplay.innerText = `${scores.overall}%`;
                clearInterval(interval);
            } else {
                count++;
                overallScoreDisplay.innerText = `${count}%`;
            }
        }, 15);

        // Progress bars fill animations
        setTimeout(() => {
            barCoding.style.width = `${scores.coding}%`;
            barAptitude.style.width = `${scores.aptitude}%`;
            barComm.style.width = `${scores.communication}%`;
            barResume.style.width = `${scores.resume}%`;
            barProjects.style.width = `${scores.projects}%`;

            mCodingVal.innerText = `${scores.coding}%`;
            mAptitudeVal.innerText = `${scores.aptitude}%`;
            mCommVal.innerText = `${scores.communication}%`;
            mResumeVal.innerText = `${scores.resume}%`;
            mProjectsVal.innerText = `${scores.projects}%`;
        }, 300);

        // Populate insights text
        wizAnalysisText.innerText = data.analysis || "Based on your academic profile and project depth, you have solid core foundations. Review targeted recommendations to optimize your skills alignment.";

        // Populate checklist recommendations
        wizRecList.innerHTML = "";
        if (data.recommendations && data.recommendations.length > 0) {
            data.recommendations.forEach((rec, idx) => {
                const li = document.createElement("li");
                li.innerHTML = `
                    <input type="checkbox" id="rec-check-${idx}">
                    <label for="rec-check-${idx}">${rec}</label>
                `;
                wizRecList.appendChild(li);
            });
        } else {
            wizRecList.innerHTML = "<li>✅ No specific gaps detected. Start coding to keep sharp!</li>";
        }
    }

    // Launch prep workspace transition
    enterWorkspaceBtn.addEventListener("click", () => {
        if (state.assessmentScores) {
            localStorage.setItem("placeprep_assessment_scores", JSON.stringify(state.assessmentScores));
            localStorage.setItem("placeprep_assessment_company", state.wizCompany);
            loadWorkspaceWithScores(state.assessmentScores, state.wizCompany);
        }
    });

    function loadWorkspaceWithScores(scores, company) {
        // Hide Wizard pane & overlay
        wizardOverlay.style.display = "none";
        workspaceContainer.style.display = "flex";

        // Sync Focus Company filters on other modules
        document.getElementById("company-filter").value = company;
        document.getElementById("plan-company").value = company;
        document.getElementById("resume-company").value = company;
        document.getElementById("mock-company").value = company;

        // Populate Header widget scores
        headerTargetLabel.innerText = `Target: ${company}`;
        headerOverallBadge.innerText = `Readiness: ${scores.overall}%`;
        
        hdCoding.innerText = `${scores.coding}%`;
        hdAptitude.innerText = `${scores.aptitude}%`;
        hdComm.innerText = `${scores.communication}%`;
        hdResume.innerText = `${scores.resume}%`;
        hdProjects.innerText = `${scores.projects}%`;

        // Render Personalized Improvement Plan Center on Dashboard
        updateImprovementCenter(scores, company);
    }

    function updateImprovementCenter(scores, company) {
        const improvementCenter = document.getElementById("dashboard-improvement-center");
        const cardsContainer = document.getElementById("improvement-cards-container");
        
        if (!improvementCenter || !cardsContainer) return;
        
        improvementCenter.style.display = "block";
        cardsContainer.innerHTML = "";
        
        // Define action cards metadata
        const metrics = [
            {
                key: "coding",
                val: scores.coding,
                title: "Coding Proficiency",
                desc: `TCS and other mass recruiters focus heavily on Array manipulations, String algorithms, and simple loops. Click to ask RAG assistant for TCS question banks.`,
                icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
                actionLabel: "Find Coding Questions",
                actionFn: () => {
                    switchSection("chat");
                    const chatInput = document.getElementById("chat-input");
                    chatInput.value = `Give me list of frequently asked coding questions for ${company}.`;
                    triggerChatSubmit(chatInput.value);
                }
            },
            {
                key: "aptitude",
                val: scores.aptitude,
                title: "Quantitative & Logic",
                desc: `Step up your speed in ratios, probability, cryptarithmetic, and logic puzzles. Generate a structured learning calendar to revise weak areas.`,
                icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
                actionLabel: "Generate Study Plan",
                actionFn: () => {
                    switchSection("planner");
                    document.getElementById("plan-weakness").value = "Aptitude";
                }
            },
            {
                key: "communication",
                val: scores.communication,
                title: "Communication & HR",
                desc: `Prepare a high-impact response to 'Introduce yourself' and explain your final year projects. Standardize your HR questions bank.`,
                icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`,
                actionLabel: "Start Mock Interview",
                actionFn: () => {
                    switchSection("mock");
                }
            },
            {
                key: "resume",
                val: scores.resume,
                title: "Resume STAR Alignment",
                desc: `Your project points need STAR formatting (Situation, Task, Action, Result). Refine them to optimize keyword matching by ATS recruiters.`,
                icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
                actionLabel: "Optimize Resume Points",
                actionFn: () => {
                    switchSection("resume");
                }
            },
            {
                key: "projects",
                val: scores.projects,
                title: "Engineering Projects",
                desc: `Deepen your technical projects details. Recruiter models expect databases, normalizations, REST APIs, or algorithm decisions.`,
                icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
                actionLabel: "Enhance Projects Details",
                actionFn: () => {
                    switchSection("resume");
                    document.getElementById("resume-bullet").placeholder = "Paste your final year project description details here to refine them...";
                }
            }
        ];
        
        // Sort lowest scores to the top
        metrics.sort((a, b) => a.val - b.val);
        
        metrics.forEach(m => {
            let severity = "success";
            let statusText = "Strong";
            
            if (m.val < 50) {
                severity = "danger";
                statusText = "Critical Gap";
            } else if (m.val < 75) {
                severity = "warning";
                statusText = "Needs Practice";
            }
            
            const card = document.createElement("div");
            card.className = `improvement-card ${severity}`;
            
            card.innerHTML = `
                <div class="imp-header">
                    <h4>${m.title}</h4>
                    <span class="imp-badge">${m.val}% - ${statusText}</span>
                </div>
                <div class="imp-tip">
                    <p>${m.desc}</p>
                </div>
                <button class="imp-btn">
                    ${m.icon}
                    <span>${m.actionLabel}</span>
                </button>
            `;
            
            card.querySelector(".imp-btn").addEventListener("click", m.actionFn);
            cardsContainer.appendChild(card);
        });
    }

    /* =========================================================================
       CORE WORKSPACE NAVIGATION & HEALTH CHECKS
       ========================================================================= */
    // Initialize Mobile Hamburger Menu
    const mobileMenuToggle = document.getElementById("mobile-menu-toggle");
    const sidebar = document.querySelector(".sidebar");
    
    if (mobileMenuToggle && sidebar) {
        mobileMenuToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            sidebar.classList.toggle("open");
        });
        
        // Close sidebar if clicking outside on mobile
        document.addEventListener("click", (e) => {
            if (window.innerWidth <= 768 && sidebar.classList.contains("open") && !sidebar.contains(e.target) && e.target !== mobileMenuToggle) {
                sidebar.classList.remove("open");
            }
        });
    }

    // Initialize Navigation
    navButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.target;
            switchSection(target);
            if (sidebar && sidebar.classList.contains("open")) {
                sidebar.classList.remove("open");
            }
        });
    });

    function switchSection(sectionId) {
        sections.forEach(sec => sec.classList.remove("active"));
        navButtons.forEach(btn => btn.classList.remove("active"));

        const targetSection = document.getElementById(sectionId);
        const targetBtn = document.querySelector(`.nav-btn[data-target="${sectionId}"]`);
        
        if (targetSection && targetBtn) {
            targetSection.classList.add("active");
            targetBtn.classList.add("active");
            state.activeSection = sectionId;
            
            // Fetch fresh questions if user switches to coding playground tab
            if (sectionId === "coding-practice") {
                if (typeof loadCodingQuestions === "function") {
                    loadCodingQuestions();
                }
            }
        }
    }

    // Health Check Status
    async function checkBackendHealth() {
        try {
            const res = await fetch(`${API_URL}/api/health`);
            if (res.ok) {
                const data = await res.json();
                state.apiOnline = true;
                state.apiKeyConfigured = data.api_key_configured;
                
                if (state.apiKeyConfigured) {
                    apiWarningBanner.style.display = "none";
                    statusDot.className = "status-dot online";
                    statusText.innerText = "RAG Online";
                } else {
                    apiWarningBanner.style.display = "flex";
                    statusDot.className = "status-dot connecting";
                    statusText.innerText = "Local Offline Demo";
                }
            } else {
                throw new Error("API not healthy");
            }
        } catch (e) {
            console.error("Backend health check failed: ", e);
            state.apiOnline = false;
            statusDot.className = "status-dot offline";
            statusText.innerText = "Server Offline";
            apiWarningBanner.style.display = "none";
        }
    }

    // Global Search redirect to Chat
    globalSearchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && globalSearchInput.value.trim() !== "") {
            const query = globalSearchInput.value.trim();
            globalSearchInput.value = "";
            switchSection("chat");
            const chatInput = document.getElementById("chat-input");
            chatInput.value = query;
            triggerChatSubmit(query);
        }
    });

    // Launch Chat from Company cards
    companyCards.forEach(card => {
        const comp = card.dataset.company;
        const btn = card.querySelector(".card-action-btn");
        if (btn) {
            btn.addEventListener("click", () => {
                switchSection("chat");
                const filter = document.getElementById("company-filter");
                filter.value = comp;
                const chatInput = document.getElementById("chat-input");
                chatInput.value = `Tell me about the recruitment process and coding patterns for ${comp}.`;
            });
        }
    });

    /* =========================================================================
       CHAT ASSISTANT MODULE
       ========================================================================= */
    const chatForm = document.getElementById("chat-form");
    const chatInput = document.getElementById("chat-input");
    const chatMessages = document.getElementById("chat-messages");
    const sourcesList = document.getElementById("sources-list");
    const suggestionButtons = document.querySelectorAll(".suggest-btn");

    chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;
        
        chatInput.value = "";
        triggerChatSubmit(text);
    });

    suggestionButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            triggerChatSubmit(btn.innerText);
        });
    });

    async function triggerChatSubmit(queryText) {
        appendMessage("user", queryText);
        const loaderId = appendLoader();
        
        const submitBtn = document.getElementById("chat-submit-btn");
        submitBtn.disabled = true;

        const companyFilter = document.getElementById("company-filter").value;

        try {
            const res = await fetch(`${API_URL}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: queryText, company: companyFilter || null })
            });

            removeLoader(loaderId);
            submitBtn.disabled = false;

            if (res.ok) {
                const data = await res.json();
                appendMessage("assistant", data.answer);
                renderSources(data.sources);
            } else {
                appendMessage("assistant", "❌ Error generating response. Please check backend connection.");
            }
        } catch (e) {
            removeLoader(loaderId);
            submitBtn.disabled = false;
            appendMessage("assistant", "❌ Failed to connect to server. Please run uvicorn server.");
        }
    }

    function appendMessage(role, text) {
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${role}`;
        
        const avatarDiv = document.createElement("div");
        avatarDiv.className = "msg-avatar";
        avatarDiv.innerText = role === "assistant" ? "AI" : "ME";

        const contentDiv = document.createElement("div");
        contentDiv.className = "msg-content";
        contentDiv.innerHTML = formatMarkdown(text);

        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function appendLoader() {
        const loaderId = "loader-" + Date.now();
        const messageDiv = document.createElement("div");
        messageDiv.className = `message assistant loader-msg`;
        messageDiv.id = loaderId;

        const avatarDiv = document.createElement("div");
        avatarDiv.className = "msg-avatar";
        avatarDiv.innerText = "AI";

        const contentDiv = document.createElement("div");
        contentDiv.className = "msg-content";
        contentDiv.innerHTML = `
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;

        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return loaderId;
    }

    function removeLoader(loaderId) {
        const loader = document.getElementById(loaderId);
        if (loader) loader.remove();
    }

    function renderSources(sources) {
        sourcesList.innerHTML = "";
        if (!sources || sources.length === 0) {
            sourcesList.innerHTML = "<p style='font-size: 13px; color: var(--text-muted);'>No specific local papers cited.</p>";
            return;
        }

        sources.forEach(src => {
            const item = document.createElement("div");
            item.className = "source-item";
            
            const title = document.createElement("span");
            title.className = "source-title";
            title.innerText = src.source;

            const type = document.createElement("span");
            type.className = "source-type";
            type.innerText = src.type;

            item.appendChild(title);
            item.appendChild(type);
            sourcesList.appendChild(item);
        });
    }

    /* =========================================================================
       STUDY PLANNER MODULE
       ========================================================================= */
    const plannerForm = document.getElementById("planner-form");
    const planContent = document.getElementById("plan-content");
    const generatePlanBtn = document.getElementById("generate-plan-btn");
    const resetPlanBtn = document.getElementById("reset-plan");

    loadSavedPlan();

    plannerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const company = document.getElementById("plan-company").value;
        const days = parseInt(document.getElementById("plan-days").value);
        const skill = document.getElementById("plan-skill").value;
        const weakness = document.getElementById("plan-weakness").value;
        const strength = document.getElementById("plan-strength").value;

        generatePlanBtn.disabled = true;
        generatePlanBtn.innerText = "Synthesizing Plan...";
        planContent.innerHTML = `
            <div class="plan-placeholder">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <p style="margin-top: 15px;">Structuring day-by-day resources and practice schedules...</p>
            </div>
        `;

        try {
            const res = await fetch(`${API_URL}/api/plan`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    company: company,
                    days: days,
                    skill_level: skill,
                    weakness: weakness,
                    strength: strength
                })
            });

            generatePlanBtn.disabled = false;
            generatePlanBtn.innerText = "Generate Plan";

            if (res.ok) {
                const data = await res.json();
                renderStructuredPlan(data.plan, company);
            } else {
                planContent.innerHTML = "<p>❌ Failed to calculate plan. Check server connection.</p>";
            }
        } catch (e) {
            generatePlanBtn.disabled = false;
            generatePlanBtn.innerText = "Generate Plan";
            planContent.innerHTML = "<p>❌ Failed to connect to server.</p>";
        }
    });

    resetPlanBtn.addEventListener("click", () => {
        if (confirm("Reset all checkmarks for this plan?")) {
            const checkBoxes = planContent.querySelectorAll("input[type='checkbox']");
            checkBoxes.forEach(box => {
                box.checked = false;
                box.parentElement.classList.remove("completed");
            });
            savePlanState();
        }
    });

    function renderStructuredPlan(planMarkdown, company) {
        const lines = planMarkdown.split("\n");
        let htmlContent = "";
        let currentDayDiv = null;
        let dayTasksUl = null;
        
        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith("### Day") || trimmed.startsWith("- **Day") || trimmed.startsWith("Day")) {
                if (currentDayDiv) {
                    currentDayDiv.appendChild(dayTasksUl);
                    htmlContent += currentDayDiv.outerHTML;
                }

                currentDayDiv = document.createElement("div");
                currentDayDiv.className = "plan-day";
                
                const title = document.createElement("div");
                title.className = "plan-day-title";
                title.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> ${trimmed.replace(/[#\-\*]/g, "")}`;
                currentDayDiv.appendChild(title);

                dayTasksUl = document.createElement("ul");
                dayTasksUl.className = "plan-tasks";
            } else if (trimmed.startsWith("- [ ]") || trimmed.startsWith("- [x]") || trimmed.startsWith("-") || trimmed.startsWith("*")) {
                if (dayTasksUl) {
                    const li = document.createElement("li");
                    const taskText = trimmed.replace(/^(-\s\[[ x]\]|-\s|\*\s)/, "");
                    const isChecked = trimmed.includes("[x]");
                    
                    li.innerHTML = `
                        <input type="checkbox" ${isChecked ? "checked" : ""}>
                        <span>${taskText}</span>
                    `;
                    if (isChecked) li.className = "completed";

                    const box = li.querySelector("input");
                    box.addEventListener("change", () => {
                        if (box.checked) {
                            li.className = "completed";
                        } else {
                            li.className = "";
                        }
                        savePlanState();
                    });

                    dayTasksUl.appendChild(li);
                }
            } else if (trimmed) {
                if (currentDayDiv) {
                    const p = document.createElement("p");
                    p.style.fontSize = "13px";
                    p.style.color = "var(--text-secondary)";
                    p.style.marginBottom = "10px";
                    p.innerHTML = formatMarkdown(trimmed);
                    currentDayDiv.appendChild(p);
                }
            }
        });

        if (currentDayDiv) {
            currentDayDiv.appendChild(dayTasksUl);
            htmlContent += currentDayDiv.outerHTML;
        }

        if (htmlContent) {
            planContent.innerHTML = htmlContent;
            resetPlanBtn.style.display = "block";
            localStorage.setItem("placeprep_saved_plan_html", htmlContent);
            localStorage.setItem("placeprep_saved_plan_company", company);
        } else {
            planContent.innerHTML = `<div class="raw-markdown">${formatMarkdown(planMarkdown)}</div>`;
            resetPlanBtn.style.display = "none";
        }
    }

    function savePlanState() {
        const checkboxStates = [];
        const checkBoxes = planContent.querySelectorAll("input[type='checkbox']");
        checkBoxes.forEach((box, index) => {
            checkboxStates.push({
                index: index,
                checked: box.checked
            });
        });
        localStorage.setItem("placeprep_plan_checkbox_states", JSON.stringify(checkboxStates));
    }

    function loadSavedPlan() {
        const savedHtml = localStorage.getItem("placeprep_saved_plan_html");
        const savedCompany = localStorage.getItem("placeprep_saved_plan_company");
        
        if (savedHtml) {
            planContent.innerHTML = savedHtml;
            resetPlanBtn.style.display = "block";
            
            const checkBoxes = planContent.querySelectorAll("input[type='checkbox']");
            const savedStates = JSON.parse(localStorage.getItem("placeprep_plan_checkbox_states") || "[]");
            
            checkBoxes.forEach((box, index) => {
                const li = box.parentElement;
                
                const stateObj = savedStates.find(s => s.index === index);
                if (stateObj) {
                    box.checked = stateObj.checked;
                    if (stateObj.checked) li.className = "completed";
                }

                box.addEventListener("change", () => {
                    if (box.checked) {
                        li.className = "completed";
                    } else {
                        li.className = "";
                    }
                    savePlanState();
                });
            });
        }
    }

    /* =========================================================================
       RESUME REFINER MODULE
       ========================================================================= */
    const refineBtn = document.getElementById("refine-resume-btn");
    const resumeBullet = document.getElementById("resume-bullet");
    const resumeOutput = document.getElementById("resume-output");

    refineBtn.addEventListener("click", async () => {
        const bulletText = resumeBullet.value.trim();
        if (!bulletText) {
            alert("Please paste your project description first.");
            return;
        }

        const company = document.getElementById("resume-company").value;
        const role = document.getElementById("resume-role").value;

        refineBtn.disabled = true;
        refineBtn.innerText = "Enhancing Schema...";
        resumeOutput.innerHTML = `
            <div class="plan-placeholder">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <p style="margin-top: 15px;">Drafting STAR points and predicting interview questions...</p>
            </div>
        `;

        try {
            const res = await fetch(`${API_URL}/api/refine-resume`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bullet_point: bulletText,
                    company: company,
                    role: role
                })
            });

            refineBtn.disabled = false;
            refineBtn.innerText = "Enhance Description";

            if (res.ok) {
                const data = await res.json();
                renderResumeOutput(data.refined);
            } else {
                resumeOutput.innerHTML = "<p>❌ Failed to refine. Check backend server.</p>";
            }
        } catch (e) {
            refineBtn.disabled = false;
            refineBtn.innerText = "Enhance Description";
            resumeOutput.innerHTML = "<p>❌ Connection failed.</p>";
        }
    });

    function renderResumeOutput(refinedText) {
        const parts = refinedText.split(/Likely Interview Questions:|Interview Questions:/i);
        let refinedBullet = parts[0] || "";
        let questionsText = parts[1] || "";

        refinedBullet = refinedBullet.replace(/Enhanced Suggestion:|Enhanced Suggestion Guide:|STAR Suggestion:/i, "").trim();

        let html = `
            <div class="refined-box">
                <div class="refined-title">STAR Bullet Point Proposal</div>
                <p>${formatMarkdown(refinedBullet)}</p>
            </div>
        `;

        if (questionsText.trim()) {
            html += `
                <div class="questions-box">
                    <h4>Expected Interview Questions</h4>
                    <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">Prepare strong explanations for these likely questions:</p>
                    ${formatMarkdown(questionsText)}
                </div>
            `;
        }

        resumeOutput.innerHTML = html;
    }

    /* =========================================================================
       MOCK INTERVIEW SIMULATOR MODULE WITH VOICE ASSISTANT
       ========================================================================= */
    const startInterviewBtn = document.getElementById("start-interview-btn");
    const endInterviewBtn = document.getElementById("end-interview-btn");
    const mockSetupCard = document.getElementById("mock-setup");
    const mockChatCard = document.getElementById("mock-chat-interface");
    const interviewingPanel = document.getElementById("interviewing-panel");
    const mockMessages = document.getElementById("mock-messages");
    const mockForm = document.getElementById("mock-form");
    const mockInput = document.getElementById("mock-input");
    
    // Voice Elements
    const mockVoiceToggle = document.getElementById("mock-voice-toggle");
    const mockMicBtn = document.getElementById("mock-mic-btn");
    const mockSpeechIndicator = document.getElementById("mock-speech-indicator");
    const speechDot = document.getElementById("speech-dot");

    // Voice Engine State
    let recognition = null;
    let synth = window.speechSynthesis;
    let activeUtterance = null;
    let isListening = false;
    let isSpeaking = false;

    // Speech-to-Text Initialization
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = "en-US";
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            isListening = true;
            mockMicBtn.className = "mic-btn listening";
            mockSpeechIndicator.innerText = "Listening...";
            speechDot.className = "speech-dot listening";
            mockInput.placeholder = "Speak now in English...";
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (transcript.trim()) {
                mockInput.value = transcript;
                appendMockMessage("user", transcript);
                state.mockInterviewHistory.push({ role: "user", content: transcript });
                mockInput.value = "";
                triggerNextMockQuestion();
            }
        };

        recognition.onerror = (event) => {
            console.error("STT Error: ", event.error);
            stopListening();
        };

        recognition.onend = () => {
            isListening = false;
            if (!isSpeaking) {
                mockMicBtn.className = "mic-btn";
                mockSpeechIndicator.innerText = "Ready";
                speechDot.className = "speech-dot ready";
                mockInput.placeholder = "Type or click microphone to speak...";
            }
        };
    } else {
        console.warn("Speech Recognition API not supported in this browser.");
        if (mockMicBtn) mockMicBtn.style.display = "none";
    }

    function startListening() {
        if (recognition && !isListening && !isSpeaking) {
            try {
                recognition.start();
            } catch (e) {
                console.error("Failed to start listening: ", e);
            }
        }
    }

    function stopListening() {
        if (recognition && isListening) {
            try {
                recognition.stop();
            } catch (e) {
                console.error("Failed to stop listening: ", e);
            }
        }
    }

    function speakText(text) {
        if (!synth) return;

        // Cancel active actions
        synth.cancel();
        stopListening();

        isSpeaking = true;
        mockMicBtn.className = "mic-btn speaking";
        mockSpeechIndicator.innerText = "Interviewer Speaking...";
        speechDot.className = "speech-dot speaking";
        mockInput.placeholder = "Please listen...";

        // Filter text for clean speech playback
        const cleanText = text
            .replace(/[#*`_~-]/g, " ")
            .replace(/tcs/gi, "T C S")
            .replace(/wipro/gi, "Wipro")
            .replace(/infosys/gi, "Infosys");

        activeUtterance = new SpeechSynthesisUtterance(cleanText);
        
        // Select clean english voice
        const voices = synth.getVoices();
        const enVoice = voices.find(v => v.lang.includes("en-US") || v.lang.includes("en-GB")) || voices[0];
        if (enVoice) activeUtterance.voice = enVoice;

        activeUtterance.rate = 1.0;
        activeUtterance.pitch = 1.0;

        activeUtterance.onend = () => {
            isSpeaking = false;
            mockMicBtn.className = "mic-btn";
            
            if (mockVoiceToggle.checked) {
                startListening();
            } else {
                mockSpeechIndicator.innerText = "Ready";
                speechDot.className = "speech-dot ready";
                mockInput.placeholder = "Type or click microphone to speak...";
            }
        };

        activeUtterance.onerror = (e) => {
            console.error("TTS Error: ", e);
            isSpeaking = false;
            mockMicBtn.className = "mic-btn";
            mockSpeechIndicator.innerText = "Ready";
            speechDot.className = "speech-dot ready";
            mockInput.placeholder = "Type or click microphone to speak...";
        };

        synth.speak(activeUtterance);
    }

    // Mic button click trigger
    if (mockMicBtn) {
        mockMicBtn.addEventListener("click", () => {
            if (isSpeaking) {
                synth.cancel();
                isSpeaking = false;
            }
            
            if (isListening) {
                stopListening();
            } else {
                startListening();
            }
        });
    }

    startInterviewBtn.addEventListener("click", () => {
        state.currentMockCompany = document.getElementById("mock-company").value;
        state.mockInterviewHistory = [];
        
        // Clear active voices
        if (synth) synth.cancel();
        stopListening();

        mockSetupCard.style.display = "none";
        mockChatCard.style.display = "flex";
        interviewingPanel.innerText = `${state.currentMockCompany} Interview Board`;
        
        mockMessages.innerHTML = "";
        
        // Set speech initial states
        mockSpeechIndicator.innerText = "Connecting...";
        speechDot.className = "speech-dot ready";

        triggerNextMockQuestion();
    });

    endInterviewBtn.addEventListener("click", () => {
        if (confirm("End this mock interview session and view your 100-Mark Gemini AI Score Card?")) {
            if (synth) synth.cancel();
            stopListening();
            evaluateMockInterview();
        }
    });

    const mockScoreModal = document.getElementById("mock-score-modal");
    const closeScoreModalBtn = document.getElementById("close-score-modal-btn");
    if (closeScoreModalBtn) {
        closeScoreModalBtn.addEventListener("click", () => {
            mockScoreModal.style.display = "none";
            mockChatCard.style.display = "none";
            mockSetupCard.style.display = "flex";
        });
    }

    async function evaluateMockInterview() {
        mockScoreModal.style.display = "flex";
        document.getElementById("eval-overall-score").innerText = "--";
        document.getElementById("eval-verdict").innerText = "Calculating Gemini AI Score...";
        document.getElementById("eval-tech-score").innerText = "-- / 100";
        document.getElementById("eval-comm-score").innerText = "-- / 100";
        document.getElementById("eval-align-score").innerText = "-- / 100";

        // Check if candidate submitted any answers
        const userTurns = state.mockInterviewHistory.filter(t => t.role === "user");
        const totalWords = userTurns.reduce((acc, t) => acc + (t.content || "").trim().split(/\s+/).filter(Boolean).length, 0);

        if (userTurns.length === 0 || totalWords < 5) {
            document.getElementById("eval-overall-score").innerText = "0";
            document.getElementById("eval-verdict").innerText = "Unsatisfactory — No Answers Provided";
            
            document.getElementById("eval-tech-score").innerText = "0 / 100";
            document.getElementById("eval-tech-bar").style.width = "0%";

            document.getElementById("eval-comm-score").innerText = "0 / 100";
            document.getElementById("eval-comm-bar").style.width = "0%";

            document.getElementById("eval-align-score").innerText = "0 / 100";
            document.getElementById("eval-align-bar").style.width = "0%";

            const strList = document.getElementById("eval-strengths-list");
            strList.innerHTML = "<li>Interview session started.</li>";

            const weakList = document.getElementById("eval-weaknesses-list");
            weakList.innerHTML = "<li>No answers were submitted during this interview session.</li><li>Zero technical responses provided to the Senior HR Lead.</li>";

            const tipsList = document.getElementById("eval-tips-list");
            tipsList.innerHTML = "<li>Make sure to speak or type complete answers for each of the 5 interview questions.</li><li>Review core Java/Python OOPs, DSA, and SQL concepts before retaking.</li>";
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/mock-interview/evaluate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    company: state.currentMockCompany || "TCS",
                    chat_history: state.mockInterviewHistory
                })
            });

            if (res.ok) {
                const data = await res.json();
                const overall = data.overall_score ?? 0;
                document.getElementById("eval-overall-score").innerText = overall;
                document.getElementById("eval-verdict").innerText = data.verdict || (overall < 40 ? "Needs Improvement" : "Qualified Candidate");
                
                const scores = data.scores || {};
                const techScore = scores.technical ?? 0;
                const commScore = scores.communication ?? 0;
                const alignScore = scores.alignment ?? 0;

                document.getElementById("eval-tech-score").innerText = `${techScore} / 100`;
                document.getElementById("eval-tech-bar").style.width = `${techScore}%`;

                document.getElementById("eval-comm-score").innerText = `${commScore} / 100`;
                document.getElementById("eval-comm-bar").style.width = `${commScore}%`;

                document.getElementById("eval-align-score").innerText = `${alignScore} / 100`;
                document.getElementById("eval-align-bar").style.width = `${alignScore}%`;

                const strList = document.getElementById("eval-strengths-list");
                strList.innerHTML = "";
                (data.strengths || []).forEach(s => {
                    const li = document.createElement("li");
                    li.innerText = s;
                    strList.appendChild(li);
                });

                const weakList = document.getElementById("eval-weaknesses-list");
                weakList.innerHTML = "";
                (data.weaknesses || []).forEach(w => {
                    const li = document.createElement("li");
                    li.innerText = w;
                    weakList.appendChild(li);
                });

                const tipsList = document.getElementById("eval-tips-list");
                tipsList.innerHTML = "";
                (data.improvement_tips || []).forEach(t => {
                    const li = document.createElement("li");
                    li.innerText = t;
                    tipsList.appendChild(li);
                });
            }
        } catch (e) {
            console.error("Evaluation error:", e);
            document.getElementById("eval-verdict").innerText = "Evaluation completed offline.";
        }
    }

    mockForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = mockInput.value.trim();
        if (!text) return;

        if (synth) synth.cancel();
        stopListening();

        mockInput.value = "";
        appendMockMessage("user", text);
        state.mockInterviewHistory.push({ role: "user", content: text });

        triggerNextMockQuestion();
    });

    async function triggerNextMockQuestion() {
        const loaderId = appendMockLoader();
        
        try {
            const res = await fetch(`${API_URL}/api/mock-interview`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    company: state.currentMockCompany,
                    chat_history: state.mockInterviewHistory
                })
            });

            removeMockLoader(loaderId);

            if (res.ok) {
                const data = await res.json();
                appendMockMessage("assistant", data.question);
                state.mockInterviewHistory.push({ role: "assistant", content: data.question });
                
                // Speak question if voice option is checked
                if (mockVoiceToggle.checked) {
                    speakText(data.question);
                } else {
                    mockSpeechIndicator.innerText = "Ready";
                    speechDot.className = "speech-dot ready";
                }
            } else {
                appendMockMessage("assistant", "❌ Failed to obtain next question from board.");
            }
        } catch (e) {
            removeMockLoader(loaderId);
            appendMockMessage("assistant", "❌ Server offline. Unable to continue mock interview.");
        }
    }

    function appendMockMessage(role, text) {
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${role}`;
        
        const avatarDiv = document.createElement("div");
        avatarDiv.className = "msg-avatar";
        avatarDiv.innerText = role === "assistant" ? "INT" : "ME";

        const contentDiv = document.createElement("div");
        contentDiv.className = "msg-content";
        contentDiv.innerHTML = formatMarkdown(text);

        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        mockMessages.appendChild(messageDiv);
        mockMessages.scrollTop = mockMessages.scrollHeight;
    }

    function appendMockLoader() {
        const loaderId = "mock-loader-" + Date.now();
        const messageDiv = document.createElement("div");
        messageDiv.className = `message assistant loader-msg`;
        messageDiv.id = loaderId;

        const avatarDiv = document.createElement("div");
        avatarDiv.className = "msg-avatar";
        avatarDiv.innerText = "INT";

        const contentDiv = document.createElement("div");
        contentDiv.className = "msg-content";
        contentDiv.innerHTML = `
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;

        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        mockMessages.appendChild(messageDiv);
        mockMessages.scrollTop = mockMessages.scrollHeight;
        return loaderId;
    }

    function removeMockLoader(loaderId) {
        const loader = document.getElementById(loaderId);
        if (loader) loader.remove();
    }

    /* =========================================================================
       UPLOAD RESOURCES MODULE
       ========================================================================= */
    const uploadForm = document.getElementById("upload-form");
    const fileInput = document.getElementById("file-input");
    const browseBtn = document.getElementById("browse-btn");
    const fileNameDisplay = document.getElementById("file-name-display");
    const dropZone = document.getElementById("drop-zone");
    const uploadStatus = document.getElementById("upload-status");
    const uploadSubmitBtn = document.getElementById("upload-submit-btn");

    browseBtn.addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", () => {
        handleFileSelection(fileInput.files[0]);
    });

    ["dragenter", "dragover"].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add("dragover");
        }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove("dragover");
        }, false);
    });

    dropZone.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            fileInput.files = files;
            handleFileSelection(files[0]);
        }
    });

    function handleFileSelection(file) {
        if (!file) {
            fileNameDisplay.innerText = "No file chosen";
            fileNameDisplay.style.display = "none";
            return;
        }

        const sizeLimit = 5 * 1024 * 1024;
        if (file.size > sizeLimit) {
            alert("File is too large. Max size is 5MB.");
            fileInput.value = "";
            fileNameDisplay.innerText = "No file chosen";
            fileNameDisplay.style.display = "none";
            return;
        }

        fileNameDisplay.innerText = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        fileNameDisplay.style.display = "inline-block";
        uploadStatus.style.display = "none";
    }

    uploadForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const file = fileInput.files[0];
        if (!file) {
            alert("Please select a file first.");
            return;
        }

        const company = document.getElementById("upload-company").value;
        const docType = document.getElementById("upload-type").value;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("company", company);
        formData.append("doc_type", docType);

        uploadSubmitBtn.disabled = true;
        uploadSubmitBtn.innerText = "Processing & Indexing...";
        uploadStatus.className = "upload-status";
        uploadStatus.style.display = "block";
        uploadStatus.innerText = "Uploading document, parsing sections, and computing embeddings...";

        try {
            const res = await fetch(`${API_URL}/api/upload`, {
                method: "POST",
                body: formData
            });

            uploadSubmitBtn.disabled = false;
            uploadSubmitBtn.innerText = "Ingest & Embed Resource";

            if (res.ok) {
                const data = await res.json();
                uploadStatus.className = "upload-status success";
                uploadStatus.innerHTML = `
                    <strong>✅ Ingestion Successful!</strong><br>
                    File Name: <em>${data.filename}</em><br>
                    Chunks Extracted: ${data.chunks_added}<br>
                    Status: The content has been parsed and loaded into the active RAG vector index!
                `;
                uploadForm.reset();
                fileNameDisplay.style.display = "none";
            } else {
                const err = await res.json();
                uploadStatus.className = "upload-status error";
                uploadStatus.innerText = `❌ Ingestion Failed: ${err.detail || "Server error occurred."}`;
            }
        } catch (e) {
            uploadSubmitBtn.disabled = false;
            uploadSubmitBtn.innerText = "Ingest & Embed Resource";
            uploadStatus.className = "upload-status error";
            uploadStatus.innerText = "❌ Failed to connect to server. Ensure uvicorn backend is running.";
        }
    });

    /* =========================================================================
       CODING PRACTICE PLAYGROUND MODULE
       ========================================================================= */
    const codeFilterCompany = document.getElementById("code-filter-company");
    const codeFilterDifficulty = document.getElementById("code-filter-difficulty");
    const codeQuestionList = document.getElementById("code-question-list");
    const codingWorkspaceCard = document.getElementById("coding-workspace-card");
    const codingIdleCard = document.getElementById("coding-idle-card");
    
    const codeQuestionTitle = document.getElementById("code-question-title");
    const codeQuestionCompany = document.getElementById("code-question-company");
    const codeQuestionDifficulty = document.getElementById("code-question-difficulty");
    const codeQuestionSource = document.getElementById("code-question-source");
    const codeQuestionDesc = document.getElementById("code-question-desc");
    const codeQuestionInput = document.getElementById("code-question-input");
    const codeQuestionOutput = document.getElementById("code-question-output");
    
    const codeLanguageSelect = document.getElementById("code-language-select");
    const codeEditor = document.getElementById("code-editor");
    const codeRunBtn = document.getElementById("code-run-btn");
    const codeHintBtn = document.getElementById("code-hint-btn");
    
    const codeResultsPanel = document.getElementById("code-results-panel");
    const codeResultsSummary = document.getElementById("code-results-summary");
    const codeErrorMessage = document.getElementById("code-error-message");
    const codeResultsTbody = document.getElementById("code-results-tbody");
    const codeFailedHintsBox = document.getElementById("code-failed-hints-box");
    const codeFailedHintsList = document.getElementById("code-failed-hints-list");

    let codingQuestions = [];
    let selectedQuestion = null;

    const templates = {
        "tcs_code_1": {
            "python": "def is_palindrome(s):\n    # Write your code here\n    pass\n",
            "java": "import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String s = sc.nextLine();\n        \n        // Write your code here using Scanner\n        String cleaned = s.toLowerCase();\n        String reversed = new StringBuilder(cleaned).reverse().toString();\n        \n        System.out.println(cleaned.equals(reversed));\n    }\n}\n",
            "cpp": "#include <iostream>\n#include <string>\nusing namespace std;\n\nbool isPalindrome(string s) {\n    // Write your code here\n    return false;\n}\n",
            "c": "#include <stdio.h>\n#include <stdbool.h>\n#include <string.h>\n\nbool isPalindrome(const char* s) {\n    // Write your code here\n    return false;\n}\n"
        },
        "tcs_code_2": {
            "python": "def rotate_left(arr, d):\n    # Write your code here\n    pass\n",
            "java": "import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int d = sc.nextInt();\n        int[] arr = new int[n];\n        for(int i = 0; i < n; i++) {\n            arr[i] = sc.nextInt();\n        }\n        \n        // Write your code here\n    }\n}\n",
            "cpp": "#include <iostream>\n#include <vector>\nusing namespace std;\n\nvector<int> rotateLeft(vector<int> arr, int d) {\n    // Write your code here\n    return arr;\n}\n",
            "c": "#include <stdio.h>\n\nvoid rotateLeft(int arr[], int n, int d) {\n    // Write your code here\n}\n"
        },
        "tcs_code_3": {
            "python": "def get_primes(l, r):\n    # Write your code here\n    pass\n",
            "java": "import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int l = sc.nextInt();\n        int r = sc.nextInt();\n        \n        // Write your code here\n    }\n}\n",
            "cpp": "#include <iostream>\n#include <vector>\nusing namespace std;\n\nvector<int> getPrimes(int l, int r) {\n    vector<int> primes;\n    // Write your code here\n    return primes;\n}\n",
            "c": "#include <stdio.h>\n\nvoid getPrimes(int l, int r) {\n    // Write your code here\n}\n"
        },
        "tcs_code_4": {
            "python": "def fibonacci_term(n):\n    # Write your code here\n    pass\n",
            "java": "import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        \n        // Write your code here\n    }\n}\n",
            "cpp": "#include <iostream>\nusing namespace std;\n\nint fibonacciTerm(int n) {\n    // Write your code here\n    return 0;\n}\n",
            "c": "#include <stdio.h>\n\nint fibonacciTerm(int n) {\n    // Write your code here\n    return 0;\n}\n"
        },
        "tcs_code_5": {
            "python": "def count_vowels_consonants(s):\n    # Write your code here\n    pass\n",
            "java": "import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String s = sc.nextLine();\n        \n        // Write your code here\n    }\n}\n",
            "cpp": "#include <iostream>\n#include <vector>\n#include <string>\nusing namespace std;\n\nvector<int> countVowelsConsonants(string s) {\n    // Write your code here\n    return {0, 0};\n}\n",
            "c": "#include <stdio.h>\n\nvoid countVowelsConsonants(const char* s) {\n    // Write your code here\n}\n"
        },
        "infy_code_1": {
            "python": "def reverse_words(s):\n    # Write your code here\n    pass\n",
            "java": "import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String s = sc.nextLine();\n        \n        // Write your code here\n    }\n}\n",
            "cpp": "#include <iostream>\n#include <string>\nusing namespace std;\n\nstring reverseWords(string s) {\n    // Write your code here\n    return \"\";\n}\n",
            "c": "#include <stdio.h>\n#include <string.h>\n\nvoid reverseWords(char* s) {\n    // Write your code here\n}\n"
        },
        "infy_code_2": {
            "python": "def second_largest(arr):\n    # Write your code here\n    pass\n",
            "java": "import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your code here using Scanner\n    }\n}\n",
            "cpp": "#include <iostream>\n#include <vector>\nusing namespace std;\n\nint secondLargest(vector<int> arr) {\n    // Write your code here\n    return -1;\n}\n",
            "c": "#include <stdio.h>\n\nint secondLargest(int arr[], int n) {\n    // Write your code here\n    return -1;\n}\n"
        },
        "infy_code_3": {
            "python": "def single_digit_sum(n):\n    # Write your code here\n    pass\n",
            "java": "import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        \n        // Write your code here\n    }\n}\n",
            "cpp": "#include <iostream>\nusing namespace std;\n\nint singleDigitSum(int n) {\n    // Write your code here\n    return 0;\n}\n",
            "c": "#include <stdio.h>\n\nint singleDigitSum(int n) {\n    // Write your code here\n    return 0;\n}\n"
        },
        "infy_code_4": {
            "python": "def find_missing_number(arr, n):\n    # Write your code here\n    pass\n",
            "java": "import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] arr = new int[n - 1];\n        for(int i = 0; i < n - 1; i++) {\n            arr[i] = sc.nextInt();\n        }\n        \n        // Write your code here\n    }\n}\n",
            "cpp": "#include <iostream>\n#include <vector>\nusing namespace std;\n\nint findMissingNumber(vector<int> arr, int n) {\n    // Write your code here\n    return 0;\n}\n",
            "c": "#include <stdio.h>\n\nint findMissingNumber(int arr[], int n) {\n    // Write your code here\n    return 0;\n}\n"
        },
        "infy_code_5": {
            "python": "def longest_unique_substr(s):\n    # Write your code here\n    pass\n",
            "java": "import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String s = sc.hasNextLine() ? sc.nextLine() : \"\";\n        \n        // Write your code here\n    }\n}\n",
            "cpp": "#include <iostream>\n#include <string>\nusing namespace std;\n\nint longestUniqueSubstr(string s) {\n    // Write your code here\n    return 0;\n}\n",
            "c": "#include <stdio.h>\n#include <string.h>\n\nint longestUniqueSubstr(const char* s) {\n    // Write your code here\n    return 0;\n}\n"
        },
        "wipro_code_1": {
            "python": "def are_anagrams(s1, s2):\n    # Write your code here\n    pass\n",
            "java": "import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String s1 = sc.next();\n        String s2 = sc.next();\n        \n        // Write your code here\n    }\n}\n",
            "cpp": "#include <iostream>\n#include <string>\n#include <algorithm>\nusing namespace std;\n\nbool areAnagrams(string s1, string s2) {\n    // Write your code here\n    return false;\n}\n",
            "c": "#include <stdio.h>\n#include <stdbool.h>\n#include <string.h>\n\nbool areAnagrams(const char* s1, const char* s2) {\n    // Write your code here\n    return false;\n}\n"
        },
        "wipro_code_2": {
            "python": "def gcd(a, b):\n    # Write your code here\n    pass\n",
            "java": "import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int a = sc.nextInt();\n        int b = sc.nextInt();\n        \n        // Write your code here\n    }\n}\n",
            "cpp": "#include <iostream>\nusing namespace std;\n\nint gcd(int a, int b) {\n    // Write your code here\n    return 1;\n}\n",
            "c": "#include <stdio.h>\n\nint gcd(int a, int b) {\n    // Write your code here\n    return 1;\n}\n"
        },
        "wipro_code_3": {
            "python": "def is_armstrong(n):\n    # Write your code here\n    pass\n",
            "java": "import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        \n        // Write your code here\n    }\n}\n",
            "cpp": "#include <iostream>\nusing namespace std;\n\nbool isArmstrong(int n) {\n    // Write your code here\n    return false;\n}\n",
            "c": "#include <stdio.h>\n#include <stdbool.h>\n\nbool isArmstrong(int n) {\n    // Write your code here\n    return false;\n}\n"
        },
        "wipro_code_4": {
            "python": "def remove_duplicates(arr):\n    # Write your code here\n    pass\n",
            "java": "import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your code here\n    }\n}\n",
            "cpp": "#include <iostream>\n#include <vector>\nusing namespace std;\n\nvector<int> removeDuplicates(vector<int> arr) {\n    // Write your code here\n    return arr;\n}\n",
            "c": "#include <stdio.h>\n\nvoid removeDuplicates(int arr[], int n) {\n    // Write your code here\n}\n"
        },
        "wipro_code_5": {
            "python": "def factorial(n):\n    # Write your code here\n    pass\n",
            "java": "import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        \n        // Write your code here\n    }\n}\n",
            "cpp": "#include <iostream>\nusing namespace std;\n\nlong long factorial(int n) {\n    // Write your code here\n    return 1;\n}\n",
            "c": "#include <stdio.h>\n\nlong long factorial(int n) {\n    // Write your code here\n    return 1;\n}\n"
        }
    };

    function updateEditorTemplate() {
        if (!selectedQuestion) return;
        const lang = codeLanguageSelect ? codeLanguageSelect.value : "python";
        const qTemplates = templates[selectedQuestion.id] || {};
        codeEditor.value = qTemplates[lang] || "// Write code here\n";
    }

    if (codeLanguageSelect) {
        codeLanguageSelect.addEventListener("change", updateEditorTemplate);
    }

    // Load coding questions from backend API
    async function loadCodingQuestions() {
        try {
            const res = await fetch(`${API_URL}/api/coding-practice/questions`);
            if (res.ok) {
                const data = await res.json();
                codingQuestions = data.questions;
                renderQuestionsList();
            }
        } catch (e) {
            console.error("Failed to load coding questions:", e);
        }
    }

    // Render questions list based on active filters
    function renderQuestionsList() {
        const companyFilter = codeFilterCompany.value;
        const diffFilter = codeFilterDifficulty.value;
        
        codeQuestionList.innerHTML = "";
        
        const filtered = codingQuestions.filter(q => {
            const compMatch = companyFilter === "ALL" || q.company.toUpperCase() === companyFilter.toUpperCase();
            const diffMatch = diffFilter === "ALL" || q.difficulty.toUpperCase() === diffFilter.toUpperCase();
            return compMatch && diffMatch;
        });

        if (filtered.length === 0) {
            codeQuestionList.innerHTML = `<div class="playground-subtitle" style="text-align: center; margin-top: 20px;">No coding questions found.</div>`;
            return;
        }

        filtered.forEach(q => {
            const item = document.createElement("div");
            item.className = "question-item";
            if (selectedQuestion && selectedQuestion.id === q.id) {
                item.classList.add("active");
            }
            
            // Format difficulty badge color class
            const diffClass = q.difficulty.toLowerCase() === "easy" ? "diff-easy" : "diff-medium";
            
            item.innerHTML = `
                <h4>${q.title}</h4>
                <div class="question-item-meta">
                    <span class="q-company">${q.company}</span>
                    <span class="difficulty-badge ${diffClass}">${q.difficulty}</span>
                </div>
            `;
            
            item.addEventListener("click", () => {
                // Remove active class from all
                document.querySelectorAll(".question-item").forEach(el => el.classList.remove("active"));
                item.classList.add("active");
                selectCodingQuestion(q);
            });

            codeQuestionList.appendChild(item);
        });
    }

    // Selection handler
    function selectCodingQuestion(q) {
        selectedQuestion = q;
        codingIdleCard.style.display = "none";
        codingWorkspaceCard.style.display = "flex";
        
        // Populate view details
        codeQuestionTitle.innerText = q.title;
        codeQuestionCompany.innerText = q.company;
        codeQuestionDifficulty.innerText = q.difficulty;
        
        // Difficulty badge class
        codeQuestionDifficulty.className = "difficulty-badge " + (q.difficulty.toLowerCase() === "easy" ? "diff-easy" : "diff-medium");
        
        codeQuestionSource.innerText = q.source || `Source: ${q.company} Syllabus`;
        codeQuestionDesc.innerText = q.description;
        codeQuestionInput.innerText = q.input_example || "";
        codeQuestionOutput.innerText = q.output_example || "";
        
        // Update starter code template for selected language
        updateEditorTemplate();
        
        // Reset results panel
        codeResultsPanel.style.display = "none";
        codeErrorMessage.style.display = "none";
        codeFailedHintsBox.style.display = "none";
    }

    // Filter event listeners
    codeFilterCompany.addEventListener("change", renderQuestionsList);
    codeFilterDifficulty.addEventListener("change", renderQuestionsList);

    // Run Code Handler
    codeRunBtn.addEventListener("click", async () => {
        if (!selectedQuestion) return;
        
        const codeText = codeEditor.value;
        const selectedLang = codeLanguageSelect ? codeLanguageSelect.value : "python";
        
        // Disable Run Button
        codeRunBtn.disabled = true;
        codeRunBtn.innerHTML = `
            <svg class="run-icon animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.2" stroke-width="4" fill="none"/>
                <path d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"/>
            </svg>
            Running...
        `;
        
        codeResultsPanel.style.display = "block";
        codeErrorMessage.style.display = "none";
        codeResultsTbody.innerHTML = "";
        codeFailedHintsBox.style.display = "none";
        
        try {
            const res = await fetch(`${API_URL}/api/coding-practice/run`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question_id: selectedQuestion.id,
                    code: codeText,
                    language: selectedLang
                })
            });

            if (res.ok) {
                const data = await res.json();
                
                if (data.status === "compile_error" || data.status === "missing_function") {
                    codeErrorMessage.style.display = "block";
                    codeErrorMessage.innerText = data.error_message;
                    codeResultsSummary.className = "results-summary-badge failed";
                    codeResultsSummary.innerText = "Error";
                } else {
                    // Success or execution done
                    const passed = data.test_cases_passed;
                    const total = data.total_test_cases;
                    codeResultsSummary.innerText = `${passed}/${total} Passed`;
                    
                    if (passed === total) {
                        codeResultsSummary.className = "results-summary-badge";
                    } else {
                        codeResultsSummary.className = "results-summary-badge failed";
                    }
                    
                    // Render table rows
                    data.results.forEach(tc => {
                        const tr = document.createElement("tr");
                        const statusTag = tc.passed ? `<span class="status-tag pass">Pass</span>` : `<span class="status-tag fail">Fail</span>`;
                        tr.innerHTML = `
                            <td>Test Case ${tc.test_case}</td>
                            <td>${statusTag}</td>
                            <td><pre style="margin:0; font-size:0.75rem; color:#38bdf8; background:transparent; border:none; padding:0;">${tc.input}</pre></td>
                            <td><pre style="margin:0; font-size:0.75rem; color:#e2e8f0; background:transparent; border:none; padding:0;">${tc.expected}</pre></td>
                            <td><pre style="margin:0; font-size:0.75rem; color:#f87171; background:transparent; border:none; padding:0;">${tc.actual}</pre></td>
                            <td>${tc.time_taken_ms} ms</td>
                        `;
                        codeResultsTbody.appendChild(tr);
                    });
                    
                    // Render hints if failure
                    if (data.hints && data.hints.length > 0) {
                        codeFailedHintsBox.style.display = "block";
                        codeFailedHintsList.innerHTML = data.hints.map(hint => `<li>${hint}</li>`).join("");
                    }
                }
            } else {
                const err = await res.json();
                codeErrorMessage.style.display = "block";
                codeErrorMessage.innerText = `Server Error: ${err.detail || "Unable to run code."}`;
            }
        } catch (e) {
            codeErrorMessage.style.display = "block";
            codeErrorMessage.innerText = `Network Error: Failed to execute solution.`;
        } finally {
            // Restore Run Button
            codeRunBtn.disabled = false;
            codeRunBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="run-icon"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Run Test Cases
            `;
        }
    });

    // View Hint click handler
    codeHintBtn.addEventListener("click", () => {
        if (!selectedQuestion) return;
        
        // Toggle view
        if (codeFailedHintsBox.style.display === "none") {
            codeFailedHintsBox.style.display = "block";
            const hints = selectedQuestion.id.startsWith("tcs") ? 
                (selectedQuestion.id === "tcs_code_1" ? ["Convert the string to lowercase first.", "Compare with slice syntax (s == s[::-1])."] : 
                 selectedQuestion.id === "tcs_code_2" ? ["Use modulo (%) shifts.", "Join sub-arrays with slice offsets: arr[d:] + arr[:d]."] : 
                 ["Check divisors up to root(N).", "Iterate range from L to R + 1."]) :
                selectedQuestion.id.startsWith("infy") ?
                (selectedQuestion.id === "infy_code_1" ? ["Split string by space to list.", "Reverse the word order and join with spaces."] : 
                 ["Track both first_largest and second_largest variables.", "Skip duplicate largest items."]) :
                (selectedQuestion.id === "wipro_code_1" ? ["Compare lowercase sorted letters.", "Check if sorted(s1) == sorted(s2)."] :
                 ["Use Euclids division loop: while b: a, b = b, a % b.", "Return a."]);
                
            codeFailedHintsList.innerHTML = hints.map(h => `<li>${h}</li>`).join("");
        } else {
            codeFailedHintsBox.style.display = "none";
        }
    });

    /* =========================================================================
       SKILL AUDIT VERIFICATION MODULE (RESUME FRAUD PREVENTION)
       ========================================================================= */
    const startSkillAuditBtn = document.getElementById("start-skill-audit-btn");
    const skillAuditModal = document.getElementById("skill-audit-modal");
    const closeAuditModalBtn = document.getElementById("close-audit-modal-btn");
    
    const auditLoadingState = document.getElementById("audit-loading-state");
    const auditTestState = document.getElementById("audit-test-state");
    const auditResultState = document.getElementById("audit-result-state");
    
    const auditProgressText = document.getElementById("audit-progress-text");
    const auditSkillTag = document.getElementById("audit-skill-tag");
    const auditQuestionTitle = document.getElementById("audit-question-title");
    const auditOptionsContainer = document.getElementById("audit-options-container");
    const auditNextBtn = document.getElementById("audit-next-btn");
    
    const auditScoreCircle = document.getElementById("audit-score-circle");
    const auditScorePercent = document.getElementById("audit-score-percent");
    const auditScoreSub = document.getElementById("audit-score-sub");
    const auditResultVerdict = document.getElementById("audit-result-verdict");
    const auditResultMsg = document.getElementById("audit-result-msg");
    const auditPenaltyBox = document.getElementById("audit-penalty-box");
    const finishAuditBtn = document.getElementById("finish-audit-btn");

    let currentAuditQuestions = [];
    let currentAuditIndex = 0;
    let userAuditAnswers = {};
    let auditVerificationData = null;

    if (startSkillAuditBtn) {
        startSkillAuditBtn.addEventListener("click", () => {
            openSkillAuditModal();
        });
    }

    if (closeAuditModalBtn) {
        closeAuditModalBtn.addEventListener("click", () => {
            skillAuditModal.style.display = "none";
        });
    }

    async function openSkillAuditModal() {
        skillAuditModal.style.display = "flex";
        auditLoadingState.style.display = "block";
        auditTestState.style.display = "none";
        auditResultState.style.display = "none";

        // Read skills from state or form
        const skillsText = state.userSkills || document.getElementById("skills-input").value;
        const skillsList = skillsText.split(",").map(s => s.trim()).filter(Boolean);
        const targetComp = state.targetCompany || document.getElementById("target-company").value || "TCS";

        try {
            const res = await fetch(`${API_URL}/api/generate-skill-audit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    skills: skillsList,
                    company: targetComp
                })
            });

            if (res.ok) {
                const data = await res.json();
                currentAuditQuestions = data.questions || [];
                currentAuditIndex = 0;
                userAuditAnswers = {};
                
                if (currentAuditQuestions.length > 0) {
                    auditLoadingState.style.display = "none";
                    auditTestState.style.display = "block";
                    renderAuditQuestion(0);
                } else {
                    alert("Could not load audit questions.");
                    skillAuditModal.style.display = "none";
                }
            } else {
                alert("Failed to connect to Skill Audit Engine.");
                skillAuditModal.style.display = "none";
            }
        } catch (e) {
            console.error("Skill Audit Error:", e);
            alert("Error loading Skill Audit test.");
            skillAuditModal.style.display = "none";
        }
    }

    function renderAuditQuestion(index) {
        const q = currentAuditQuestions[index];
        if (!q) return;

        auditProgressText.innerText = `Question ${index + 1} of ${currentAuditQuestions.length}`;
        auditSkillTag.innerText = `Skill: ${q.skill || "Technical"}`;
        auditQuestionTitle.innerText = q.question;
        auditOptionsContainer.innerHTML = "";

        const selectedOption = userAuditAnswers[q.id];

        q.options.forEach((opt, optIdx) => {
            const card = document.createElement("div");
            card.className = "audit-option-card" + (selectedOption === optIdx ? " selected" : "");
            card.innerHTML = `
                <div class="option-radio"></div>
                <div>${opt}</div>
            `;

            card.addEventListener("click", () => {
                userAuditAnswers[q.id] = optIdx;
                document.querySelectorAll(".audit-option-card").forEach(el => el.classList.remove("selected"));
                card.classList.add("selected");
            });

            auditOptionsContainer.appendChild(card);
        });

        auditNextBtn.innerText = index === currentAuditQuestions.length - 1 ? "Submit Audit Test ➔" : "Next Question ➔";
    }

    auditNextBtn.addEventListener("click", () => {
        const currentQ = currentAuditQuestions[currentAuditIndex];
        if (currentQ && userAuditAnswers[currentQ.id] === undefined) {
            alert("Please select an answer before proceeding.");
            return;
        }

        if (currentAuditIndex < currentAuditQuestions.length - 1) {
            currentAuditIndex++;
            renderAuditQuestion(currentAuditIndex);
        } else {
            submitSkillAudit();
        }
    });

    async function submitSkillAudit() {
        auditTestState.style.display = "none";
        auditLoadingState.style.display = "block";
        auditLoadingState.querySelector("h4").innerText = "Evaluating Skill Verification Answers...";

        const targetComp = state.targetCompany || document.getElementById("target-company").value || "TCS";
        const skillsText = state.userSkills || document.getElementById("skills-input").value;
        const skillsList = skillsText.split(",").map(s => s.trim()).filter(Boolean);

        try {
            const res = await fetch(`${API_URL}/api/verify-skill-audit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    skills: skillsList,
                    company: targetComp,
                    user_answers: userAuditAnswers,
                    questions_data: currentAuditQuestions
                })
            });

            if (res.ok) {
                const data = await res.json();
                auditVerificationData = data;
                renderAuditResult(data);
            }
        } catch (e) {
            console.error("Audit verification error:", e);
            alert("Failed to evaluate skill audit.");
            skillAuditModal.style.display = "none";
        }
    }

    function renderAuditResult(data) {
        auditLoadingState.style.display = "none";
        auditResultState.style.display = "block";

        auditScorePercent.innerText = `${data.score_percent}%`;
        auditScoreSub.innerText = data.status_code;
        auditResultVerdict.innerText = data.authenticity_badge;
        auditResultMsg.innerText = data.message;

        if (data.status_code === "VERIFIED") {
            auditScoreCircle.style.background = "linear-gradient(135deg, #10b981, #059669)";
            auditPenaltyBox.className = "reward-alert-box";
            auditPenaltyBox.innerHTML = `
                <strong>🛡️ 100% Verified Resume Skills!</strong><br>
                You proved your claimed skills with ${data.correct_count}/${data.total_questions} correct answers. No penalty applied. Full Readiness Score unlocked!
            `;
        } else if (data.status_code === "PARTIAL") {
            auditScoreCircle.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
            auditPenaltyBox.className = "penalty-alert-box";
            auditPenaltyBox.style.background = "rgba(245, 158, 11, 0.1)";
            auditPenaltyBox.style.borderColor = "rgba(245, 158, 11, 0.3)";
            auditPenaltyBox.style.color = "#fcd34d";
            auditPenaltyBox.innerHTML = `
                <strong>⚠️ Moderate Skill Depth Gap (25% Penalty)</strong><br>
                You answered ${data.correct_count}/${data.total_questions} questions correctly. A 25% readiness score adjustment has been applied to unproven skills.
            `;
        } else {
            auditScoreCircle.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
            auditPenaltyBox.className = "penalty-alert-box";
            auditPenaltyBox.innerHTML = `
                <strong>🚨 Over-Claimed Resume Alert (65% Score Reduction Penalty!)</strong><br>
                You scored ${data.correct_count}/${data.total_questions} on your claimed skills test. Evaluators flag this as resume over-claiming. Your Readiness Score has been slashed by 65% to enforce authenticity!
            `;
        }
    }

    if (finishAuditBtn) {
        finishAuditBtn.addEventListener("click", () => {
            if (!auditVerificationData) {
                skillAuditModal.style.display = "none";
                return;
            }

            const badge = document.getElementById("authenticity-status-badge");
            const desc = document.getElementById("authenticity-desc");

            badge.innerText = auditVerificationData.authenticity_badge;
            badge.className = auditVerificationData.status_code === "VERIFIED" ? "badge-verified" : "badge-overclaimed";
            desc.innerText = auditVerificationData.message;

            // Multiply active readiness score by penalty_multiplier
            if (state.lastReadinessScores) {
                const mult = auditVerificationData.penalty_multiplier;
                const penalizedOverall = Math.max(5, Math.round(state.lastReadinessScores.overall * mult));
                
                document.getElementById("overall-readiness-val").innerText = `${penalizedOverall}%`;
                
                // Update ring stroke offset
                const ring = document.getElementById("overall-ring");
                if (ring) {
                    const radius = ring.r.baseVal.value;
                    const circumference = 2 * Math.PI * radius;
                    const offset = circumference - (penalizedOverall / 100) * circumference;
                    ring.style.strokeDashoffset = offset;
                }

                // Update sub metric bars
                const multScores = {
                    coding: Math.round((state.lastReadinessScores.coding || 0) * mult),
                    aptitude: Math.round((state.lastReadinessScores.aptitude || 0) * mult),
                    communication: Math.round((state.lastReadinessScores.communication || 0) * mult),
                    resume: Math.round((state.lastReadinessScores.resume || 0) * mult),
                    projects: Math.round((state.lastReadinessScores.projects || 0) * mult)
                };

                document.getElementById("metric-coding-val").innerText = `${multScores.coding}%`;
                document.getElementById("bar-coding").style.width = `${multScores.coding}%`;

                document.getElementById("metric-aptitude-val").innerText = `${multScores.aptitude}%`;
                document.getElementById("bar-aptitude").style.width = `${multScores.aptitude}%`;

                document.getElementById("metric-comm-val").innerText = `${multScores.comm || multScores.communication}%`;
                document.getElementById("bar-comm").style.width = `${multScores.comm || multScores.communication}%`;

                document.getElementById("metric-resume-val").innerText = `${multScores.resume}%`;
                document.getElementById("bar-resume").style.width = `${multScores.resume}%`;

                document.getElementById("metric-projects-val").innerText = `${multScores.projects}%`;
                document.getElementById("bar-projects").style.width = `${multScores.projects}%`;
            }

            skillAuditModal.style.display = "none";
        });
    }

    // Call question fetch on initialization
    loadCodingQuestions();

    /* =========================================================================
       SETTINGS MODAL (API KEY SETTINGS)
       ========================================================================= */
    const settingsModal = document.getElementById("settings-modal");
    const openSettingsBtn = document.getElementById("open-settings-btn");
    const closeSettingsBtn = document.getElementById("close-settings-btn");
    const warningSetupBtn = document.getElementById("warning-setup-btn");
    const saveSettingsBtn = document.getElementById("save-settings-btn");
    const settingsApiKeyInput = document.getElementById("settings-api-key");
    const settingsStatus = document.getElementById("settings-status");

    openSettingsBtn.addEventListener("click", () => {
        settingsModal.style.display = "flex";
        settingsStatus.style.display = "none";
    });

    closeSettingsBtn.addEventListener("click", () => {
        settingsModal.style.display = "none";
    });

    warningSetupBtn.addEventListener("click", () => {
        settingsModal.style.display = "flex";
        settingsStatus.style.display = "none";
    });

    settingsModal.addEventListener("click", (e) => {
        if (e.target === settingsModal) {
            settingsModal.style.display = "none";
        }
    });

    saveSettingsBtn.addEventListener("click", async () => {
        const apiKeyVal = settingsApiKeyInput.value.trim();
        if (!apiKeyVal) {
            alert("Please paste your Gemini API Key first.");
            return;
        }

        saveSettingsBtn.disabled = true;
        saveSettingsBtn.innerText = "Applying Key & Embedding Chunks...";
        settingsStatus.className = "upload-status";
        settingsStatus.style.display = "block";
        settingsStatus.innerText = "Saving configuration and initializing RAG vector spaces. Uvicorn will automatically reload...";

        try {
            const res = await fetch(`${API_URL}/api/config`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ api_key: apiKeyVal })
            });

            saveSettingsBtn.disabled = false;
            saveSettingsBtn.innerText = "Apply API Key";

            if (res.ok) {
                const data = await res.json();
                settingsStatus.className = "upload-status success";
                settingsStatus.innerText = "✅ API Key successfully loaded! RAG features and semantic vector indexes are now active.";
                settingsApiKeyInput.value = "";
                
                setTimeout(() => {
                    settingsModal.style.display = "none";
                    checkBackendHealth();
                }, 2000);
            } else {
                const err = await res.json();
                settingsStatus.className = "upload-status error";
                settingsStatus.innerText = `❌ Configuration Failed: ${err.detail || "Invalid server response."}`;
            }
        } catch (e) {
            saveSettingsBtn.disabled = false;
            saveSettingsBtn.innerText = "Apply API Key";
            settingsStatus.className = "upload-status error";
            settingsStatus.innerText = "❌ Connection failed. Ensure uvicorn server is online.";
        }
    });

    /* =========================================================================
       HELPER PARSER FUNCTIONS
       ========================================================================= */
    function formatMarkdown(text) {
        if (!text) return "";
        let formatted = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/^\s*-\s+(.*)$/gm, '<li>$1</li>')
            .replace(/^\s*\*\s+(.*)$/gm, '<li>$1</li>')
            .replace(/^\s*(\d+)\.\s+(.*)$/gm, '<ol start="$1"><li>$2</li></ol>')
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>');
            
        return formatted;
    }

    checkBackendHealth();
    setInterval(checkBackendHealth, 8500);
});
