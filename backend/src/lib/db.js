import dotenv from "dotenv";
dotenv.config();

import pkg from "pg";
const { Pool } = pkg;

if (!process.env.PII_ENCRYPTION_KEY) {
  throw new Error(
    "PII_ENCRYPTION_KEY is not set. It is required to encrypt/decrypt bank and PAN fields.",
  );
}

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  database: process.env.DB_NAME || process.env.DB_DATABASE,
  port: process.env.DB_PORT,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Every pooled connection needs the PII key available as a session GUC so
// pgp_sym_encrypt/pgp_sym_decrypt calls in queries can read it via
// current_setting('app.pii_key'), regardless of which connection handles the query.
pool.on("connect", (client) => {
  client.query("SELECT set_config('app.pii_key', $1, false)", [
    process.env.PII_ENCRYPTION_KEY,
  ]);
});

const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log("PostgreSQL connected successfully");
    client.release();
  } catch (error) {
    console.error("PostgreSQL connection failed:", error);
    process.exit(1);
  }
};

export { pool, testConnection };
