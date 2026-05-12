const seedState = {
  currentResult: null,
  loggedIn: {
    student: false,
    teacher: false,
    admin: false,
  },
  admins: [{ username: "admin", password: "admin123" }],
  teachers: [{ username: "teacher", password: "teacher123" }],
  results: [
    { resultId: 1, rollNumber: "2021CS001", studentName: "Rahul Sharma", class: "B.Tech CSE", subjectName: "Data Structures", marksObtained: 88, maxMarks: 100, semester: "Semester 3", examType: "Final" },
    { resultId: 2, rollNumber: "2021CS001", studentName: "Rahul Sharma", class: "B.Tech CSE", subjectName: "Database Management", marksObtained: 85, maxMarks: 100, semester: "Semester 3", examType: "Final" },
    { resultId: 3, rollNumber: "2021CS001", studentName: "Rahul Sharma", class: "B.Tech CSE", subjectName: "Discrete Mathematics", marksObtained: 76, maxMarks: 100, semester: "Semester 3", examType: "Final" },
    { resultId: 4, rollNumber: "2021CS001", studentName: "Rahul Sharma", class: "B.Tech CSE", subjectName: "Digital Electronics", marksObtained: 91, maxMarks: 100, semester: "Semester 3", examType: "Final" },
    { resultId: 5, rollNumber: "2021CS002", studentName: "Priya Nair", class: "B.Tech CSE", subjectName: "Data Structures", marksObtained: 92, maxMarks: 100, semester: "Semester 3", examType: "Final" },
    { resultId: 6, rollNumber: "2021CS002", studentName: "Priya Nair", class: "B.Tech CSE", subjectName: "Database Management", marksObtained: 78, maxMarks: 100, semester: "Semester 3", examType: "Final" },
  ],
  students: [
    { studentId: 1, rollNumber: "2021CS001", name: "Rahul Sharma", class: "B.Tech CSE", section: "A", email: "rahul@example.com" },
    { studentId: 2, rollNumber: "2021CS002", name: "Priya Nair", class: "B.Tech CSE", section: "B", email: "priya@example.com" },
  ],
};

const qs = (selector, scope = document) => scope.querySelector(selector);
const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

function showToast(message, isError = false) {
  const toast = qs("#toast");
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 3000);
}

function getStored(key, fallback) {
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : fallback;
}

function setStored(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getLocalResults() {
  return getStored("resultPortalResults", seedState.results);
}

function saveLocalResults(results) {
  setStored("resultPortalResults", results);
}

function getLocalStudents() {
  return getStored("resultPortalStudents", seedState.students);
}

function saveLocalStudents(students) {
  setStored("resultPortalStudents", students);
}

function getReevalRequests() {
  return getStored("resultPortalReevalRequests", []);
}

function saveReevalRequests(requests) {
  setStored("resultPortalReevalRequests", requests);
}

function calculateGrade(marks, maxMarks) {
  const pct = (Number(marks) / Number(maxMarks)) * 100;
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  return "F";
}

function calculateOverallGrade(subjects) {
  const gradePoints = { "A+": 10, A: 9, "B+": 8, B: 7, C: 6, F: 0 };
  const total = subjects.reduce((sum, item) => sum + (gradePoints[item.grade] || 0), 0);
  const avg = total / Math.max(subjects.length, 1);
  if (avg >= 9) return "A+";
  if (avg >= 8) return "A";
  if (avg >= 7) return "B+";
  if (avg >= 6) return "B";
  if (avg >= 5) return "C";
  return "F";
}

async function api(path, options = {}) {
  try {
    const response = await fetch(`/api${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Request failed");
    }
    return await response.json();
  } catch (error) {
    if (options.fallback) return options.fallback();
    throw error;
  }
}

function searchResult(rollNumber, semester, examType = "Final") {
  return getLocalResults().filter(
    (result) =>
      result.rollNumber.toLowerCase() === rollNumber.toLowerCase() &&
      result.semester === semester &&
      (!examType || examType === "All" || result.examType === examType),
  );
}

function renderResult(subjects, rollNumber, semester) {
  const card = qs("#resultCard");
  if (!subjects.length) {
    seedState.currentResult = null;
    card.innerHTML = `<div class="empty-state">No result found for <strong>${rollNumber}</strong> in ${semester}.</div>`;
    return;
  }

  const enriched = subjects.map((subject) => ({
    ...subject,
    grade: calculateGrade(subject.marksObtained, subject.maxMarks),
  }));
  const totalMarks = enriched.reduce((sum, item) => sum + Number(item.marksObtained), 0);
  const totalMax = enriched.reduce((sum, item) => sum + Number(item.maxMarks), 0);
  const percentage = ((totalMarks / totalMax) * 100).toFixed(2);
  const overallGrade = calculateOverallGrade(enriched);
  const first = enriched[0];

  seedState.currentResult = {
    rollNumber,
    studentName: first.studentName,
    studentClass: first.class,
    semester,
    subjects: enriched,
    totalMarks,
    totalMax,
    percentage,
    overallGrade,
  };

  card.innerHTML = `
    <div class="result-header">
      <div>
        <p class="eyebrow">Mark Sheet</p>
        <h3>${first.studentName}</h3>
        <div class="student-meta">
          <span>Roll Number: ${rollNumber}</span>
          <span>${first.class} &middot; ${semester} &middot; ${first.examType}</span>
        </div>
      </div>
      <div class="summary-list">
        <strong class="grade-badge">${overallGrade}</strong>
        <span>${percentage}%</span>
      </div>
    </div>
    <div class="summary-pills">
      <span>Total ${totalMarks}/${totalMax}</span>
      <span>${enriched.length} Subjects</span>
      <span>${percentage >= 50 ? "Pass" : "Fail"}</span>
      <span>Grade ${overallGrade}</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Marks</th>
            <th>Max</th>
            <th>Percentage</th>
            <th>Grade</th>
          </tr>
        </thead>
        <tbody>
          ${enriched
            .map(
              (subject) => `
                <tr>
                  <td>${subject.subjectName}</td>
                  <td>${subject.marksObtained}</td>
                  <td>${subject.maxMarks}</td>
                  <td>${((subject.marksObtained / subject.maxMarks) * 100).toFixed(1)}%</td>
                  <td><span class="grade-pill">${subject.grade}</span></td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderClassResults(className, semester) {
  const results = getLocalResults().filter(
    (item) => item.class.toLowerCase() === className.toLowerCase() && item.semester === semester,
  );
  const view = qs("#classResultView");
  if (!results.length) {
    view.innerHTML = `<div class="empty-state">No class results found.</div>`;
    return;
  }

  view.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Roll Number</th>
          <th>Student</th>
          <th>Subject</th>
          <th>Marks</th>
          <th>Grade</th>
        </tr>
      </thead>
      <tbody>
        ${results
          .map(
            (item) => `
              <tr>
                <td>${item.rollNumber}</td>
                <td>${item.studentName}</td>
                <td>${item.subjectName}</td>
                <td>${item.marksObtained}/${item.maxMarks}</td>
                <td><span class="grade-pill">${calculateGrade(item.marksObtained, item.maxMarks)}</span></td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function updateMarks(rollNumber, subjectName, newMarks) {
  const results = getLocalResults();
  const index = results.findIndex(
    (item) =>
      item.rollNumber.toLowerCase() === rollNumber.toLowerCase() &&
      item.subjectName.toLowerCase() === subjectName.toLowerCase(),
  );
  if (index === -1) throw new Error("Result entry not found.");
  results[index].marksObtained = Number(newMarks);
  saveLocalResults(results);
}

function addLocalResult(formData) {
  const results = getLocalResults();
  const exists = results.some(
    (item) =>
      item.rollNumber.toLowerCase() === formData.rollNumber.toLowerCase() &&
      item.subjectName.toLowerCase() === formData.subjectName.toLowerCase() &&
      item.semester === formData.semester,
  );
  if (exists) throw new Error("A result for this subject already exists.");
  results.push({
    resultId: Date.now(),
    rollNumber: formData.rollNumber.toUpperCase(),
    studentName: formData.studentName,
    class: formData.class,
    subjectName: formData.subjectName,
    marksObtained: Number(formData.marksObtained),
    maxMarks: Number(formData.maxMarks),
    semester: formData.semester,
    examType: formData.examType,
  });
  saveLocalResults(results);
}

function renderReevalRequests() {
  const requests = getReevalRequests();
  const list = qs("#reevalRequests");
  if (!requests.length) {
    list.innerHTML = `<div class="empty-state">No revaluation requests submitted yet.</div>`;
    return;
  }

  list.innerHTML = requests
    .map(
      (request) => `
        <article class="request-card">
          <div>
            <strong>${request.rollNumber} &middot; ${request.subjectName}</strong>
            <span>${request.reason}</span>
          </div>
          <span>${request.status}</span>
        </article>
      `,
    )
    .join("");
}

function renderAnalysis() {
  const results = getLocalResults();
  const totalEntries = results.length;
  const passed = results.filter((item) => (item.marksObtained / item.maxMarks) * 100 >= 50).length;
  const average = totalEntries
    ? (results.reduce((sum, item) => sum + (item.marksObtained / item.maxMarks) * 100, 0) / totalEntries).toFixed(1)
    : "0.0";
  const requests = getReevalRequests().length;

  qs("#analysisCards").innerHTML = `
    <article class="metric-card"><strong>${totalEntries}</strong><span>Result Entries</span></article>
    <article class="metric-card"><strong>${passed}</strong><span>Pass Entries</span></article>
    <article class="metric-card"><strong>${average}%</strong><span>Average Score</span></article>
    <article class="metric-card"><strong>${requests}</strong><span>Reevaluation Requests</span></article>
  `;
}

function setupModuleTabs() {
  qsa(".module-tabs").forEach((tabs) => {
    tabs.addEventListener("click", (event) => {
      const button = event.target.closest(".tab-btn");
      if (!button) return;
      const dashboard = button.closest(".dashboard");
      qsa(".tab-btn", tabs).forEach((item) => item.classList.remove("active"));
      qsa(".module-panel", dashboard).forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      qs(`#${button.dataset.panel}`).classList.add("active");
      renderReevalRequests();
      renderAnalysis();
    });
  });
}

function setupTheme() {
  if (localStorage.getItem("resultPortalTheme") === "dark") document.body.classList.add("dark");
  qs("#themeToggle").addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem("resultPortalTheme", document.body.classList.contains("dark") ? "dark" : "light");
  });
}

function revealDashboard(form, dashboardSelector, role) {
  seedState.loggedIn[role] = true;
  qs(dashboardSelector).classList.remove("hidden");
  form.reset();
  showToast(`${role[0].toUpperCase() + role.slice(1)} login successful.`);
}

function setupForms() {
  qs("#studentLoginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(event.currentTarget));
    if (formData.password !== "student123") {
      showToast("Invalid student credentials.", true);
      return;
    }
    qs("#studentRollNumber").value = formData.rollNumber;
    revealDashboard(event.currentTarget, "#studentDashboard", "student");
    const subjects = searchResult(formData.rollNumber, "Semester 3", "Final");
    renderResult(subjects, formData.rollNumber, "Semester 3");
  });

  qs("#studentResultForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const rollNumber = qs("#studentRollNumber").value.trim();
    const semester = qs("#studentSemester").value;
    try {
      const data = await api(`/results/${encodeURIComponent(rollNumber)}?semester=${encodeURIComponent(semester)}&examType=Final`, {
        fallback: () => ({ subjects: searchResult(rollNumber, semester, "Final"), rollNumber, semester }),
      });
      renderResult(data.subjects || [], data.rollNumber || rollNumber, data.semester || semester);
      showToast((data.subjects || []).length ? "Report loaded." : "No report found.", !(data.subjects || []).length);
    } catch (error) {
      showToast(error.message, true);
    }
  });

  qs("#printMarksheet").addEventListener("click", () => {
    if (!seedState.currentResult) {
      showToast("View a report before installing or printing it.", true);
      return;
    }
    window.print();
  });

  qs("#reevalForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(event.currentTarget));
    const requests = getReevalRequests();
    requests.push({ ...formData, status: "Pending", requestId: Date.now() });
    saveReevalRequests(requests);
    event.currentTarget.reset();
    renderReevalRequests();
    renderAnalysis();
    showToast("Reevaluation request submitted.");
  });

  qs("#registrationForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(event.currentTarget));
    await api("/students", {
      method: "POST",
      body: JSON.stringify(formData),
      fallback: () => {
        const students = getLocalStudents();
        const exists = students.some((student) => student.rollNumber.toLowerCase() === formData.rollNumber.toLowerCase());
        if (exists) throw new Error("A student with this roll number already exists.");
        students.push({ ...formData, studentId: Date.now() });
        saveLocalStudents(students);
        return { ok: true };
      },
    });
    event.currentTarget.reset();
    showToast("Student registered successfully.");
  });

  qs("#teacherLoginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(event.currentTarget));
    const teacher = seedState.teachers.find((item) => item.username === formData.username && item.password === formData.password);
    if (!teacher) {
      showToast("Invalid teacher credentials.", true);
      return;
    }
    revealDashboard(event.currentTarget, "#teacherDashboard", "teacher");
    renderClassResults("B.Tech CSE", "Semester 3");
  });

  qs("#classSearchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    renderClassResults(qs("#classQuery").value.trim(), qs("#classSemester").value);
    showToast("Class result loaded.");
  });

  qs("#teacherEditGradeForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(event.currentTarget));
    await api("/admin/results/update", {
      method: "POST",
      body: JSON.stringify(formData),
      fallback: () => {
        updateMarks(formData.rollNumber, formData.subjectName, formData.newMarks);
        return { ok: true };
      },
    });
    updateMarks(formData.rollNumber, formData.subjectName, formData.newMarks);
    renderClassResults(qs("#classQuery").value.trim(), qs("#classSemester").value);
    event.currentTarget.reset();
    showToast("Grade updated.");
  });

  qs("#adminLoginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(event.currentTarget));
    await api("/admin/login", {
      method: "POST",
      body: JSON.stringify(formData),
      fallback: () => {
        const admin = seedState.admins.find((item) => item.username === formData.username && item.password === formData.password);
        if (!admin) throw new Error("Invalid admin credentials.");
        return { ok: true };
      },
    });
    revealDashboard(event.currentTarget, "#adminDashboard", "admin");
    renderReevalRequests();
    renderAnalysis();
  });

  qs("#addResultForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(event.currentTarget));
    await api("/admin/results", {
      method: "POST",
      body: JSON.stringify(formData),
      fallback: () => {
        return { ok: true };
      },
    });
    addLocalResult(formData);
    event.currentTarget.reset();
    renderAnalysis();
    showToast("Result entered successfully.");
  });

  qs("#updateResultForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(event.currentTarget));
    await api("/admin/results/update", {
      method: "POST",
      body: JSON.stringify(formData),
      fallback: () => {
        updateMarks(formData.rollNumber, formData.subjectName, formData.newMarks);
        return { ok: true };
      },
    });
    updateMarks(formData.rollNumber, formData.subjectName, formData.newMarks);
    event.currentTarget.reset();
    renderAnalysis();
    showToast("Result edited successfully.");
  });
}

function boot() {
  setupTheme();
  setupModuleTabs();
  setupForms();
  renderResult(searchResult("2021CS001", "Semester 3", "Final"), "2021CS001", "Semester 3");
  renderReevalRequests();
  renderAnalysis();
}

boot();
