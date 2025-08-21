import fs from "fs";
import path from "path";
import { FIELD_MAPPINGS, PAYER_PLANS } from "@/constants/fields";

const PAYERS_FILE = path.join(process.cwd(), "data/payers.json");

export async function getPayerFields(payerName?: string) {
  if (!payerName) return [];

  // 1) Check dynamic payers
  if (fs.existsSync(PAYERS_FILE)) {
    const json = JSON.parse(fs.readFileSync(PAYERS_FILE, "utf-8"));
    const dynamicFields = json[payerName];
    if (dynamicFields) return dynamicFields;
  }

  // 2) Fallback to static FIELD_MAPPINGS
  if (PAYER_PLANS[payerName as keyof typeof PAYER_PLANS]) {
    return FIELD_MAPPINGS[payerName as keyof typeof PAYER_PLANS];
  }

  return [];
}
