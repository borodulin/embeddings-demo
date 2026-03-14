import postgres from "postgres";

import { config } from "@/lib/config";

export const sql = postgres(config.databaseUrl, {
  max: 10,
});
