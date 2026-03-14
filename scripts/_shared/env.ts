import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

const loadEnvFile = (fileName: string) => {
  const filePath = path.resolve(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) {
    return;
  }

  dotenv.config({ path: filePath });
};

loadEnvFile(".env");
loadEnvFile(".env.local");

if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}
