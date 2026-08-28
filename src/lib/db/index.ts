import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

// Keep module evaluation safe during Next.js build-time route analysis; queries still require a real runtime URL.
const connectionString =
  process.env.POSTGRES_URL ?? "postgresql://build:build@localhost:5432/build";
const sql = neon(connectionString);
export const db = drizzle(sql, { schema });