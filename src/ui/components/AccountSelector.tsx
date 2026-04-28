import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Account } from "../../domain/types";
import type { Ref } from "react";
import { formatHandle } from "../utils/account";
import { useClickOutside } from "../hooks/useClickOutside";
import { AccountLabel } from "./AccountLabel";

export const AccountSelector = ({
  accounts,
  activeAccountId,
  setActiveAccount,
  onSelectionDone,
  summaryRef,
  summaryTitle,
  variant = "panel"
}: {
  accounts: Account[];
  activeAccountId: string | null;
  setActiveAccount: (id: string) => void;
  onSelectionDone?: () => void;
  summaryRef?: Ref<HTMLElement>;
  summaryTitle?: string;
  variant?: "panel" | "inline";
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedAccountId, setHighlightedAccountId] = useState<string | null>(null);
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const selectionChangeRef = useRef(false);

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
    if (!dropdownOpen && selectionChangeRef.current) {
      selectionChangeRef.current = false;
      onSelectionDone?.();
    }
  }, [dropdownOpen, onSelectionDone]);

  useEffect(() => {
    if (!dropdownOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!dropdownOpen) {
        return;
      }
      if (document.querySelector('[data-emoji-picker-open="true"]')) {
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
          selectionChangeRef.current = true;
          setActiveAccount(nextAccount.id);
        }
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (highlightedAccountId) {
          selectionChangeRef.current = true;
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
          <summary
            ref={summaryRef}
            className="account-selector-summary"
            title={summaryTitle ?? "계정 선택 (Ctrl+Shift+A)"}
          >
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
                const classNames = [] as string[];
                if (account.id === highlightedAccountId) {
                  classNames.push("is-highlighted");
                }
                if (isActiveAccount) {
                  classNames.push("active");
                }
                return (
                  <li
                    key={account.id}
                    className={classNames.join(" ")}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        selectionChangeRef.current = true;
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
                    </Button>
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
