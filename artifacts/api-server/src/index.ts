import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { attachWebSocketServer } from "./lib/wsHandler";
import { pool } from "@workspace/db";
import crypto from "crypto";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const VERIFIED_EMAILS = [
  "dadvv034@gmail.com",
  "923ewujidsja@gmail.com",
  "kuba7827@gmail.com",
  "viteeeek091@gmail.com",
  "fenya9332@gmail.com",
  "kn8509381@gmail.com",
  "t3ilor0@mail.ru",
  "knstepanyan@mail.ru",
  "vovagejdana@gmail.com",
  "fhgfhhcvcnfnnfjf@gmail.com",
  "sudasdaun543@gmail.com",
  "antisocialgod@mail.ru",
  "stoffaplace@mail.ru",
  "nikingg@gmail.com",
  "dqrtex@gmail.com",
  "okay24360@gmail.com",
  "vatafaxx@gmail.com",
  "mchalay1@gmail.com",
  "vadavpotoke@gmail.com",
  "ahmetgaleevadel607@gmail.com",
  "saucyboyzclique@gmail.com",
  "samp19.02.2021@gmail.com",
  "thugerxxx@gmail.com",
  "kardinal@gmail.com",
  "higo64310@gmail.com",
];

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS operators (
        id TEXT PRIMARY KEY,
        email TEXT,
        name TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'operator',
        verified BOOLEAN NOT NULL DEFAULT false,
        password_hash TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY,
        login TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'coach',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        operator_id TEXT,
        archetype TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        closed_at TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS feedback (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        score INTEGER,
        strengths TEXT,
        mistakes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS learning_examples (
        id TEXT PRIMARY KEY,
        archetype TEXT NOT NULL,
        conversation TEXT NOT NULL,
        score INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    logger.info("Database migrations applied");

    for (const email of VERIFIED_EMAILS) {
      const normalized = email.trim().toLowerCase();
      const existing = await client.query(
        "SELECT id FROM operators WHERE email = $1",
        [normalized],
      );
      if (existing.rows.length > 0) {
        await client.query(
          "UPDATE operators SET verified = true WHERE email = $1",
          [normalized],
        );
      } else {
        const id = crypto.randomUUID();
        const name = normalized.split("@")[0];
        await client.query(
          `INSERT INTO operators (id, email, name, role, verified)
           VALUES ($1, $2, $3, 'operator', true)
           ON CONFLICT (id) DO NOTHING`,
          [id, normalized, name],
        );
      }
    }
    logger.info("Operator verification seed applied");

    function hashPw(pw: string) {
      return crypto.createHash("sha256").update(pw).digest("hex");
    }

    const ADMINS = [
      { login: "coach1", password: "T7bcjGEgww", role: "coach" },
      { login: "coach2", password: "KnTxdnwTVc", role: "coach" },
      { login: "coach3", password: "NsnHKxZen3", role: "coach" },
      { login: "coach4", password: "4EdVyaz548", role: "coach" },
      { login: "coach5", password: "upjPft7a5z", role: "coach" },
      { login: "dev1",   password: "fDrHfDNQgH", role: "dev"   },
      { login: "dev2",   password: "gXzNpDr24p", role: "dev"   },
    ];

    for (const admin of ADMINS) {
      await client.query(
        `INSERT INTO admins (id, login, password_hash, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (login) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
        [crypto.randomUUID(), admin.login, hashPw(admin.password), admin.role],
      );
    }
    logger.info("Admin accounts seeded");
  } finally {
    client.release();
  }
}

const server = http.createServer(app);
attachWebSocketServer(server);

runMigrations()
  .then(() => {
    server.listen(port, (err?: Error) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Migration failed, aborting startup");
    process.exit(1);
  });
