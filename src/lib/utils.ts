import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
// Copy extracted JSON to clipboard
export const copyToClipboard = async (data: object) => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    alert("Copied to clipboard!");
  } catch (err) {
    console.error("Failed to copy", err);
  }
};

// Download extracted JSON as file
export const downloadJSON = (data: object, filename = "extracted-data.json") => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
};

