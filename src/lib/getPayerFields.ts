// src/lib/getPayerFields.ts
import { FIELD_MAPPINGS } from "../constants/fields";

// Reads dynamic payers from localStorage + merges with static ones
export function getFieldsForPayer(payerName?: string): string[] {
  if (!payerName) return [];

  // Check localStorage dynamic payers first
  try {
    const stored = localStorage.getItem("dynamicPayers");
    const dynamicPayers = stored ? JSON.parse(stored) : {};

    if (dynamicPayers[payerName]) {
      return dynamicPayers[payerName];
    }
  } catch (err) {
    console.error("Error reading dynamic payers:", err);
  }

  // Fallback → static FIELD_MAPPINGS
  if (FIELD_MAPPINGS[payerName]) return FIELD_MAPPINGS[payerName];

  return [];
}

// Merge static + dynamic (optional utility)
export function getAllPayers(): Record<string, string[]> {
  let dynamicPayers: Record<string, string[]> = {};
  try {
    const stored = localStorage.getItem("dynamicPayers");
    dynamicPayers = stored ? JSON.parse(stored) : {};
  } catch {}

  return {
    ...FIELD_MAPPINGS,
    ...dynamicPayers,
  };
}
