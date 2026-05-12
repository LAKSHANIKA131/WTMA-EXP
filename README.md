# Result Publishing Portal

A consolidated Online Result Publishing web app built from the WTMA lab exercises.

## Features

- Student login and registration
- Result catalogue
- Semester result lookup with subject-wise marks and grades
- Printable/downloadable mark sheet
- Revaluation request form
- Student record summary
- Campus gallery and examination cell media
- University map section
- Node API with in-memory development data and PostgreSQL support

## Run Locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

Demo login:

```text
Register Number: 2026CS101
Password: student123
```

## PostgreSQL Setup

Create a database, run the schema, then start the app with `DATABASE_URL`.

```bash
psql "$DATABASE_URL" -f database.sql
DATABASE_URL="postgres://user:password@localhost:5432/result_portal" npm start
```

If `DATABASE_URL` is not set, the server uses seeded in-memory data so the app still works for development and demos.
