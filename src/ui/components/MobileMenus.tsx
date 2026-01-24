import type { ReactNode } from "react";
import type { Account, Visibility } from "../../domain/types";
import type { MastodonApi } from "../../services/MastodonApi";
import type { OAuthClient } from "../../services/OAuthClient";
import { AccountAdd } from "./AccountAdd";
import { ComposeBox } from "./ComposeBox";

type MobileComposeMenuProps = {
  open: boolean;
  onClose: () => void;
  composeAccount: Account | null;
  composeAccountSelector: ReactNode;
  api: MastodonApi;
  onSubmit: (params: {
    text: string;
    visibility: Visibility;
    inReplyToId?: string;
    files: File[];
    spoilerText: string;
  }) => Promise<boolean>;
  replyingTo: { id: string; summary: string } | null;
  onCancelReply: () => void;
  mentionText: string | null;
};

export const MobileComposeMenu = ({
  open,
  onClose,
  composeAccount,
  composeAccountSelector,
  api,
  onSubmit,
  replyingTo,
  onCancelReply,
  mentionText
}: MobileComposeMenuProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="mobile-menu">
      <div className="mobile-menu-backdrop" onClick={onClose} />
      <div className="mobile-menu-panel panel">
        <div className="mobile-menu-header">
          <h3>글쓰기</h3>
          <button
            type="button"
            className="ghost"
            onClick={onClose}
            aria-label="글쓰기 닫기"
          >
            닫기
          </button>
        </div>
        {composeAccount ? (
          <ComposeBox
            accountSelector={composeAccountSelector}
            account={composeAccount}
            api={api}
            onSubmit={onSubmit}
            replyingTo={replyingTo}
            onCancelReply={onCancelReply}
            mentionText={mentionText}
          />
        ) : null}
      </div>
    </div>
  );
};

type MobileMenuProps = {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  oauth: OAuthClient;
};

export const MobileMenu = ({ open, onClose, onOpenSettings, oauth }: MobileMenuProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="mobile-menu">
      <div className="mobile-menu-backdrop" onClick={onClose} />
      <div className="mobile-menu-panel panel">
        <div className="mobile-menu-header">
          <h3>메뉴</h3>
          <button type="button" className="ghost" onClick={onClose} aria-label="메뉴 닫기">
            닫기
          </button>
        </div>
        <div className="mobile-menu-actions">
          <button
            type="button"
            className="button-with-icon"
            onClick={() => {
              onOpenSettings();
              onClose();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h16" />
              <circle cx="9" cy="6" r="2" />
              <path d="M4 12h16" />
              <circle cx="15" cy="12" r="2" />
              <path d="M4 18h16" />
              <circle cx="8" cy="18" r="2" />
            </svg>
            설정 열기
          </button>
        </div>
        <div className="mobile-menu-section">
          <AccountAdd oauth={oauth} />
        </div>
      </div>
    </div>
  );
};
