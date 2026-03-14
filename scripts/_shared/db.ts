import postgres from "postgres";

import { config } from "../../lib/config";

export const createScriptDb = (max = 1) =>
  postgres(config.databaseUrl, {
    max,
  });
