export const normalizeInstanceUrl = (input: string): string => {
  const trimmed = input.trim().replace(/\/$/, "");
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

export const createAccountId = (): string => crypto.randomUUID();

export const formatHandle = (handle: string, instanceUrl: string): string => {
  if (!handle) {
    return "";
  }
  if (handle.includes("@")) {
    return handle;
  }
  try {
    const host = new URL(instanceUrl).hostname;
    return `${handle}@${host}`;
  } catch {
    return handle;
  }
};

export const parseAccountLabel = (
  label: string
): { displayName: string; handle: string } | null => {
  const match = label.match(/^(.*)\\s+@([^\\s]+)$/);
  if (!match) {
    return null;
  }
  return { displayName: match[1].trim(), handle: match[2].trim() };
};
