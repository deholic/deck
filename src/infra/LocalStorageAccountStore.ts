import type { Account } from "../domain/types";
import type { AccountStore } from "../services/AccountStore";

const STORAGE_KEY = "textodon.accounts";
const LAST_USED_KEY = "textodon.accounts.lastUsedAt";
const EXPIRY_MS = 1000 * 60 * 60 * 24 * 7;

export class LocalStorageAccountStore implements AccountStore {
  load(): Account[] {
    try {
      const lastUsedRaw = localStorage.getItem(LAST_USED_KEY);
      const lastUsedAt = lastUsedRaw ? Number(lastUsedRaw) : 0;
      if (lastUsedAt && Date.now() - lastUsedAt > EXPIRY_MS) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LAST_USED_KEY);
        return [];
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const data = JSON.parse(raw) as Account[];
      if (Array.isArray(data) && data.length > 0) {
        localStorage.setItem(LAST_USED_KEY, String(Date.now()));
        return data;
      }
      return [];
    } catch {
      return [];
    }
  }

  save(accounts: Account[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    localStorage.setItem(LAST_USED_KEY, String(Date.now()));
  }
}
