// src/utils/stringUtils.ts

export const sanitizeFilename = (name: string): string => {
  return (name || "").replace(/[^a-z0-9]/gi, "_").toLowerCase();
};