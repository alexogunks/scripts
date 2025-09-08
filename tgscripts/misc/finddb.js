// db-list.mjs
import pg from "pg";
import { Connector } from "@google-cloud/cloud-sql-connector";
import { reqs } from "./dbreq.js";
const { Pool } = pg;

const instanceConnectionName = process.env.CLOUDSQL_INSTANCE || reqs.instance; // e.g. "pei:europe-west4:pei-rds-production"
const database = process.env.PGDATABASE || "postgres";
const user = process.env.PGUSER || reqs.user;          // For IAM: user email (or SA name w/o ".gserviceaccount.com")
const password = process.env.PGPASSWORD || reqs.pwd;  // Omit when using IAM auth
const ipType = process.env.CLOUDSQL_IP_TYPE || "PUBLIC"; // PUBLIC | PRIVATE | PSC
const authType = process.env.CLOUDSQL_AUTH || "PASSWORD"; // PASSWORD | IAM

async function main() {
  if (!instanceConnectionName || !user) {
    throw new Error("Set CLOUDSQL_INSTANCE and PGUSER env vars first.");
  }

  const connector = new Connector();
  const clientOpts = await connector.getOptions({
    instanceConnectionName,
    ipType,
    ...(authType === "IAM" ? { authType: "IAM" } : {})
  });

  const pool = new Pool({
    ...clientOpts,
    user,
    ...(authType === "IAM" ? {} : { password }),
    database,
    max: 5,
  });

  const { rows } = await pool.query(`
    SELECT datname
    FROM pg_database
    WHERE datistemplate = false
    ORDER BY datname;
  `);
  console.log(rows);

  await pool.end();
  connector.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
