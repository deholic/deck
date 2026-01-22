import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Account } from "../../domain/types";
import { formatHandle } from "../utils/account";
import { useClickOutside } from "../hooks/useClickOutside";
import { AccountLabel } from "./AccountLabel";

export const AccountSelector = ({
  accounts,
  activeAccountId,
  setActiveAccount,
  variant = "panel"
}: {
  accounts: Account[];
  activeAccountId: string | null;
  setActiveAccount: (id: string) => void;
  variant?: "panel" | "inline";
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedAccountId, setHighlightedAccountId] = useState<string | null>(null);
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useClickOutside(dropdownRef, dropdownOpen, () => setDropdownOpen(false));

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === activeAccountId) ?? null,
    [accounts, activeAccountId]
  );

  useEffect(() => {
    if (!dropdownOpen) {
      setHighlightedAccountId(null);
      return;
    }
    setHighlightedAccountId(activeAccountId ?? accounts[0]?.id ?? null);
  }, [activeAccountId, accounts, dropdownOpen]);

  useEffect(() => {
    if (!dropdownOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!dropdownOpen) {
        return;
      }
      if (!detailsRef.current?.contains(document.activeElement)) {
        return;
      }
      if (accounts.length === 0) {
        return;
      }

      const currentIndex = Math.max(
        0,
        accounts.findIndex((account) => account.id === (highlightedAccountId ?? activeAccountId))
      );

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const offset = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex = (currentIndex + offset + accounts.length) % accounts.length;
        const nextAccount = accounts[nextIndex];
        if (nextAccount) {
          setHighlightedAccountId(nextAccount.id);
          setActiveAccount(nextAccount.id);
        }
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (highlightedAccountId) {
          setActiveAccount(highlightedAccountId);
        }
        setDropdownOpen(false);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setDropdownOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [accounts, activeAccountId, dropdownOpen, highlightedAccountId, setActiveAccount]);

  const wrapperClassName =
    variant === "panel" ? "panel account-selector-panel" : "account-selector-inline";
  const Wrapper = variant === "panel" ? "section" : "div";

  return (
    <Wrapper className={wrapperClassName}>
      <div className="account-selector-header">
        <details
          ref={detailsRef}
          className="account-selector"
          open={dropdownOpen}
          onToggle={(event) => setDropdownOpen(event.currentTarget.open)}
        >
          <summary className="account-selector-summary" title="계정 선택 (Ctrl+Shift+A)">
            {activeAccount ? (
              <AccountLabel
                avatarUrl={activeAccount.avatarUrl}
                displayName={activeAccount.displayName}
                name={activeAccount.name}
                handle={activeAccount.handle ? formatHandle(activeAccount.handle, activeAccount.instanceUrl) : undefined}
                instanceUrl={activeAccount.instanceUrl}
                customEmojis={activeAccount.emojis}
              />
            ) : (
              <span className="account-selector-placeholder">계정을 선택하세요.</span>
            )}
            <span className="account-selector-caret" aria-hidden="true">
              ▾
            </span>
          </summary>
          {dropdownOpen ? <div className="overlay-backdrop" aria-hidden="true" /> : null}
          <div ref={dropdownRef} className="account-selector-dropdown">
            <ul className="account-list">
              {accounts.map((account) => {
                const isActiveAccount = account.id === activeAccountId;
                return (
                  <li
                    key={account.id}
                    className={
                      isActiveAccount
                        ? "active"
                        : account.id === highlightedAccountId
                          ? "is-highlighted"
                          : ""
                    }
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveAccount(account.id);
                        setDropdownOpen(false);
                      }}
                    >
                      <AccountLabel
                        avatarUrl={account.avatarUrl}
                        displayName={account.displayName}
                        name={account.name}
                        handle={account.handle ? formatHandle(account.handle, account.instanceUrl) : undefined}
                        instanceUrl={account.instanceUrl}
                        customEmojis={account.emojis}
                      />
                    </button>
                  </li>
                );
              })}
              {accounts.length === 0 ? <li className="empty">등록된 계정이 없습니다.</li> : null}
            </ul>
          </div>
        </details>
      </div>
    </Wrapper>
  );
};
