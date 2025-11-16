// db-list-fixed.mjs
import fs from "fs";
import pg from "pg";
import { Connector } from "@google-cloud/cloud-sql-connector";
import { reqs } from "./dbreq.js";
const { Pool } = pg;

const instanceConnectionName = process.env.CLOUDSQL_INSTANCE || reqs.instance;
const database = process.env.PGDATABASE || "postgres";
const user = process.env.PGUSER || reqs.user;
const password = process.env.PGPASSWORD || reqs.pwd;
const ipType = process.env.CLOUDSQL_IP_TYPE || "PUBLIC"; // PUBLIC | PRIVATE | PSC
const authType = process.env.CLOUDSQL_AUTH || "PASSWORD"; // PASSWORD | IAM

if (!instanceConnectionName || !user) {
  console.error("Required env vars: CLOUDSQL_INSTANCE and PGUSER (or check reqs in dbreq.js)");
  process.exit(1);
}

async function main() {
  const connector = new Connector(); // will use ADC (GOOGLE_APPLICATION_CREDENTIALS or ADC)
  let pool;

  try {
    // Use IAM authType only if you have instance configured for IAM DB auth
    const connectorOptions = {
      instanceConnectionName,
      ipType,
      ...(authType === "IAM" ? { authType: "IAM" } : {}),
    };

    console.log("Connector options:", connectorOptions);

    const clientOpts = await connector.getOptions(connectorOptions);

    console.log("Connector returned client options. Creating PG pool...");

    pool = new Pool({
      ...clientOpts,
      user,
      ...(authType === "IAM" ? {} : { password }),
      database,
      max: 5,
    });

    // quick test query
    const { rows } = await pool.query(`
      SELECT datname
      FROM pg_database
      WHERE datistemplate = false
      ORDER BY datname;
    `);
    console.log("Databases:", rows.map(r => r.datname));
  } catch (err) {
    // give a helpful error message
    console.error("ERROR: failed to connect or query Cloud SQL.");
    if (err && err.message) console.error("Message:", err.message);
    console.error("Full error:", err);
    process.exitCode = 1;
  } finally {
    try {
      if (pool) {
        await pool.end();
        console.log("Pool ended.");
      }
    } catch (e) {
      console.warn("Error ending pool:", e?.message || e);
    }
    try {
      await connector.close();
      console.log("Connector closed.");
    } catch (e) {
      console.warn("Error closing connector:", e?.message || e);
    }
  }
}

main();