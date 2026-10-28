import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({
  path: [".env.production", ".env.local", ".env"],
});

const runMigrate = async () => {
  if (!process.env.POSTGRES_URL) {
    console.log("POSTGRES_URL not defined, skipping migrations");
    process.exit(0);
  }

  const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(connection);

  console.log("Running migrations...");

  const start = Date.now();
  await migrate(db, { migrationsFolder: "./lib/db/migrations" });
  const end = Date.now();

  console.log("Migrations completed in", end - start, "ms");
  process.exit(0);
};

runMigrate().catch((err) => {
  console.warn("Migration notice/warning (database may be unreachable during build phase):", err?.message || err);
  // Do not crash the production build if DB is sleeping or unreachable at build-time
  process.exit(0);
});
