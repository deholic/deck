import type { Account } from "../domain/types";

export interface AccountStore {
  load(): Account[];
  save(accounts: Account[]): void;
}
