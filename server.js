// Online Result Publishing Website - Node.js Backend
// Submitted by: V S Lakshanika (241801131)
// Rajalakshmi Engineering College - Dept. of AI & Data Science
// Architecture: MVC-style with in-memory seed data + optional PostgreSQL

const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = __dirname;
let pool = null;

// ─── PostgreSQL connection (optional) ────────────────────────────────────────
if (process.env.DATABASE_URL) {
  try {
    const { Pool } = require("pg");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
    });
    console.log("Connected to PostgreSQL database.");
  } catch (error) {
    console.warn("PostgreSQL driver not found; using in-memory storage.");
  }
}

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
};

// ─── In-memory seed data ─────────────────────────────────────────────────────
// Matches the database schema described in the report:
//   admin(admin_id, username, password, email)
//   students(student_id, roll_number, name, class, section)
//   results(result_id, student_id, roll_number, subject_name,
//           marks_obtained, max_marks, grade, semester, exam_type)

const seed = {
  admins: [
    {
      adminId: 1,
      username: "admin",
      password: "admin123",   // In production: bcrypt hash
      email: "admin@school.com",
    },
  ],

  students: [
    { studentId: 1, rollNumber: "2021CS001", name: "Rahul Sharma",  class: "B.Tech CSE", section: "A", email: "rahul@example.com" },
    { studentId: 2, rollNumber: "2021CS002", name: "Priya Nair",    class: "B.Tech CSE", section: "B", email: "priya@example.com" },
  ],

  results: [
    { resultId: 1, studentId: 1, rollNumber: "2021CS001", studentName: "Rahul Sharma", class: "B.Tech CSE", subjectName: "Data Structures",       marksObtained: 88, maxMarks: 100, grade: "A",  semester: "Semester 3", examType: "Final" },
    { resultId: 2, studentId: 1, rollNumber: "2021CS001", studentName: "Rahul Sharma", class: "B.Tech CSE", subjectName: "Database Management",    marksObtained: 85, maxMarks: 100, grade: "A",  semester: "Semester 3", examType: "Final" },
    { resultId: 3, studentId: 1, rollNumber: "2021CS001", studentName: "Rahul Sharma", class: "B.Tech CSE", subjectName: "Discrete Mathematics",   marksObtained: 76, maxMarks: 100, grade: "B+", semester: "Semester 3", examType: "Final" },
    { resultId: 4, studentId: 1, rollNumber: "2021CS001", studentName: "Rahul Sharma", class: "B.Tech CSE", subjectName: "Digital Electronics",    marksObtained: 91, maxMarks: 100, grade: "A+", semester: "Semester 3", examType: "Final" },
    { resultId: 5, studentId: 2, rollNumber: "2021CS002", studentName: "Priya Nair",   class: "B.Tech CSE", subjectName: "Data Structures",        marksObtained: 92, maxMarks: 100, grade: "A+", semester: "Semester 3", examType: "Final" },
    { resultId: 6, studentId: 2, rollNumber: "2021CS002", studentName: "Priya Nair",   class: "B.Tech CSE", subjectName: "Database Management",    marksObtained: 78, maxMarks: 100, grade: "B+", semester: "Semester 3", examType: "Final" },
  ],

  sessions: new Set(), // active admin session tokens
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function normalizeRoll(value) {
  return String(value || "").trim().toUpperCase();
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString("utf8");
  return body ? JSON.parse(body) : {};
}

function validateRequired(payload, fields) {
  const missing = fields.filter((f) => !String(payload[f] || "").trim());
  if (missing.length) throw new Error(`Missing required fields: ${missing.join(", ")}`);
}

// ─── Grade calculation (mirrors pseudocode in the report) ─────────────────────

function calculateGrade(marks, maxMarks) {
  const pct = (marks / maxMarks) * 100;
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  return "F";
}

// ─── Data access (in-memory or PostgreSQL) ────────────────────────────────────

function findStudentByRoll(rollNumber) {
  return seed.students.find((s) => s.rollNumber === normalizeRoll(rollNumber));
}

async function getResultsByRoll(rollNumber, semester, examType) {
  if (!pool) {
    let results = seed.results.filter(
      (r) => r.rollNumber === normalizeRoll(rollNumber) && r.semester === semester,
    );
    if (examType && examType !== "All") {
      results = results.filter((r) => r.examType === examType);
    }
    return results;
  }

  const params = [normalizeRoll(rollNumber), semester];
  let query = `
    SELECT r.result_id AS "resultId", s.roll_number AS "rollNumber",
           s.name AS "studentName", s.class, r.subject_name AS "subjectName",
           r.marks_obtained AS "marksObtained", r.max_marks AS "maxMarks",
           r.grade, r.semester, r.exam_type AS "examType"
    FROM students s
    JOIN results r ON s.student_id = r.student_id
    WHERE s.roll_number = $1 AND r.semester = $2`;
  if (examType && examType !== "All") { query += ` AND r.exam_type = $3`; params.push(examType); }
  query += ` ORDER BY r.subject_name`;
  const { rows } = await pool.query(query, params);
  return rows;
}

async function createStudent(payload) {
  if (!pool) {
    const rollNumber = normalizeRoll(payload.rollNumber || payload.roll_number);
    if (findStudentByRoll(rollNumber)) return { conflict: true };
    const student = {
      studentId: Date.now(),
      rollNumber,
      name: payload.name,
      class: payload.class,
      section: payload.section || "",
      email: payload.email || "",
    };
    seed.students.push(student);
    return { studentId: student.studentId, rollNumber };
  }

  const { rows } = await pool.query(
    `INSERT INTO students (roll_number, name, class, section, email)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (roll_number) DO NOTHING
     RETURNING student_id AS "studentId", roll_number AS "rollNumber"`,
    [normalizeRoll(payload.rollNumber), payload.name, payload.class, payload.section, payload.email],
  );
  return rows[0] || { conflict: true };
}

async function addResult(payload) {
  const grade = calculateGrade(Number(payload.marksObtained), Number(payload.maxMarks));

  if (!pool) {
    const rollNumber = normalizeRoll(payload.rollNumber);
    const student = findStudentByRoll(rollNumber) || { studentId: null };
    const result = {
      resultId: Date.now(),
      studentId: student.studentId,
      rollNumber,
      studentName: payload.studentName,
      class: payload.class || "",
      subjectName: payload.subjectName,
      marksObtained: Number(payload.marksObtained),
      maxMarks: Number(payload.maxMarks),
      grade,
      semester: payload.semester,
      examType: payload.examType || "Final",
    };
    seed.results.push(result);
    return { resultId: result.resultId };
  }

  const { rows } = await pool.query(
    `INSERT INTO results (student_id, roll_number, subject_name, marks_obtained, max_marks, grade, semester, exam_type)
     SELECT student_id, roll_number, $2, $3, $4, $5, $6, $7
     FROM students WHERE roll_number = $1
     RETURNING result_id AS "resultId"`,
    [normalizeRoll(payload.rollNumber), payload.subjectName, Number(payload.marksObtained),
     Number(payload.maxMarks), grade, payload.semester, payload.examType || "Final"],
  );
  return rows[0];
}

async function updateResult(rollNumber, subjectName, newMarks) {
  if (!pool) {
    const result = seed.results.find(
      (r) => r.rollNumber === normalizeRoll(rollNumber) &&
             r.subjectName.toLowerCase() === subjectName.toLowerCase(),
    );
    if (!result) return false;
    result.marksObtained = Number(newMarks);
    result.grade = calculateGrade(Number(newMarks), result.maxMarks);
    return true;
  }

  const { rowCount } = await pool.query(
    `UPDATE results SET marks_obtained = $3, grade = $4
     WHERE roll_number = $1 AND LOWER(subject_name) = LOWER($2)`,
    [normalizeRoll(rollNumber), subjectName, Number(newMarks),
     calculateGrade(Number(newMarks), 100)],
  );
  return rowCount > 0;
}

async function deleteResult(rollNumber, subjectName) {
  if (!pool) {
    const idx = seed.results.findIndex(
      (r) => r.rollNumber === normalizeRoll(rollNumber) &&
             r.subjectName.toLowerCase() === subjectName.toLowerCase(),
    );
    if (idx === -1) return false;
    seed.results.splice(idx, 1);
    return true;
  }

  const { rowCount } = await pool.query(
    `DELETE FROM results WHERE roll_number = $1 AND LOWER(subject_name) = LOWER($2)`,
    [normalizeRoll(rollNumber), subjectName],
  );
  return rowCount > 0;
}

// ─── API Router ───────────────────────────────────────────────────────────────

async function handleApi(req, res, url) {

  // Health check
  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, storage: pool ? "postgres" : "memory" });
  }

  // Search results by roll number
  const resultMatch = url.pathname.match(/^\/api\/results\/([^/]+)$/);
  if (req.method === "GET" && resultMatch) {
    const rollNumber = decodeURIComponent(resultMatch[1]);
    const semester   = url.searchParams.get("semester") || "Semester 3";
    const examType   = url.searchParams.get("examType") || "Final";
    const subjects   = await getResultsByRoll(rollNumber, semester, examType);

    if (!subjects.length) {
      return sendJson(res, 404, { message: "No results found for this roll number." });
    }
    return sendJson(res, 200, { subjects, rollNumber, semester });
  }

  // Student registration
  if (req.method === "POST" && url.pathname === "/api/students") {
    const body = await readBody(req);
    validateRequired(body, ["rollNumber", "name", "class"]);
    const created = await createStudent(body);
    if (created.conflict) {
      return sendJson(res, 409, { message: "A student with this roll number already exists." });
    }
    return sendJson(res, 201, { ok: true, ...created });
  }

  // Admin login
  if (req.method === "POST" && url.pathname === "/api/admin/login") {
    const body = await readBody(req);
    validateRequired(body, ["username", "password"]);

    if (!pool) {
      const admin = seed.admins.find(
        (a) => a.username === body.username && a.password === body.password,
      );
      if (!admin) return sendJson(res, 401, { message: "Invalid admin credentials." });
      const token = crypto.randomUUID();
      seed.sessions.add(token);
      return sendJson(res, 200, { ok: true, token });
    }

    const { rows } = await pool.query(
      "SELECT admin_id FROM admin WHERE username = $1 AND password = $2",
      [body.username, body.password],
    );
    if (!rows.length) return sendJson(res, 401, { message: "Invalid admin credentials." });
    const token = crypto.randomUUID();
    seed.sessions.add(token);
    return sendJson(res, 200, { ok: true, token });
  }

  // Add result (admin)
  if (req.method === "POST" && url.pathname === "/api/admin/results") {
    const body = await readBody(req);
    validateRequired(body, ["rollNumber", "subjectName", "marksObtained", "maxMarks", "semester"]);
    const result = await addResult(body);
    return sendJson(res, 201, { ok: true, ...result });
  }

  // Update result (admin)
  if (req.method === "POST" && url.pathname === "/api/admin/results/update") {
    const body = await readBody(req);
    validateRequired(body, ["rollNumber", "subjectName", "newMarks"]);
    const updated = await updateResult(body.rollNumber, body.subjectName, body.newMarks);
    if (!updated) return sendJson(res, 404, { message: "Result entry not found." });
    return sendJson(res, 200, { ok: true });
  }

  // Delete result (admin)
  if (req.method === "POST" && url.pathname === "/api/admin/results/delete") {
    const body = await readBody(req);
    validateRequired(body, ["rollNumber", "subjectName"]);
    const deleted = await deleteResult(body.rollNumber, body.subjectName);
    if (!deleted) return sendJson(res, 404, { message: "Result entry not found." });
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { message: "API route not found." });
}

// ─── Static file server ───────────────────────────────────────────────────────

async function serveStatic(req, res, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path.normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }

  try {
    const file = await fs.readFile(filePath);
    const ext  = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=3600",
    });
    res.end(file);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
    } else {
      await serveStatic(req, res, url);
    }
  } catch (error) {
    sendJson(res, 500, { message: error.message || "Unexpected server error." });
  }
});

server.listen(PORT, () => {
  console.log(`Online Result Publishing Portal running at http://localhost:${PORT}`);
  console.log(`Storage: ${pool ? "PostgreSQL" : "in-memory (set DATABASE_URL to use PostgreSQL)"}`);
});