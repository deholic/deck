import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Account } from "../../domain/types";
import type { AccountStore } from "../../services/AccountStore";
import type { MastodonApi } from "../../services/MastodonApi";
import type { OAuthClient } from "../../services/OAuthClient";
import type { StreamingClient } from "../../services/StreamingClient";
import { formatHandle, parseAccountLabel } from "../utils/account";

export type AppServices = {
  api: MastodonApi;
  streaming: StreamingClient;
  accountStore: AccountStore;
  oauth: OAuthClient;
};

export type AccountsState = {
  accounts: Account[];
  activeAccountId: string | null;
  addAccount: (account: Account) => void;
  removeAccount: (accountId: string) => void;
  setActiveAccount: (accountId: string) => void;
};

const AppContext = createContext<{ services: AppServices; accountsState: AccountsState } | null>(null);

export const AppProvider = ({ services, children }: { services: AppServices; children: React.ReactNode }) => {
  const [accounts, setAccounts] = useState<Account[]>(() => {
    const loaded = services.accountStore.load();
    const normalized = loaded.map((account) => {
      if (account.displayName && account.handle) {
        const fullHandle = formatHandle(account.handle, account.instanceUrl);
        return { ...account, handle: fullHandle };
      }
      const parsed = account.name ? parseAccountLabel(account.name) : null;
      const displayName = parsed?.displayName || account.name || account.instanceUrl;
      const handle = formatHandle(parsed?.handle || "", account.instanceUrl);
      return {
        ...account,
        displayName,
        handle,
        url: account.url ?? null,
        avatarUrl: account.avatarUrl ?? null
      };
    });
    services.accountStore.save(normalized);
    return normalized;
  });
  const [activeAccountId, setActiveAccountId] = useState<string | null>(
    accounts[0]?.id ?? null
  );

  useEffect(() => {
    if (accounts.length > 0) {
      services.accountStore.save(accounts);
    }
  }, [accounts, services.accountStore]);

  const persist = useCallback(
    (next: Account[]) => {
      setAccounts(next);
      services.accountStore.save(next);
    },
    [services.accountStore]
  );

  const addAccount = useCallback(
    (account: Account) => {
      persist([...accounts, account]);
      setActiveAccountId(account.id);
    },
    [accounts, persist]
  );

  const removeAccount = useCallback(
    (accountId: string) => {
      const next = accounts.filter((item) => item.id !== accountId);
      persist(next);
      if (activeAccountId === accountId) {
        setActiveAccountId(next[0]?.id ?? null);
      }
    },
    [accounts, activeAccountId, persist]
  );

  const setActiveAccount = useCallback((accountId: string) => {
    setActiveAccountId(accountId);
  }, []);

  const accountsState = useMemo(
    () => ({ accounts, activeAccountId, addAccount, removeAccount, setActiveAccount }),
    [accounts, activeAccountId, addAccount, removeAccount, setActiveAccount]
  );

  return (
    <AppContext.Provider value={{ services, accountsState }}>{children}</AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("AppContext provider가 필요합니다.");
  }
  return context;
};
