import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import type { Account, Visibility } from "../../domain/types";
import type { MastodonApi } from "../../services/MastodonApi";
import type { OAuthClient } from "../../services/OAuthClient";
import type { ReplyingTo } from "../types/compose";
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
  replyingTo: ReplyingTo | null;
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
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="mobile-menu-panel panel" showCloseButton={false}>
        <div className="mobile-menu-header">
          <DialogHeader>
            <DialogTitle>글쓰기</DialogTitle>
            <DialogDescription>선택한 계정으로 새 글을 작성합니다.</DialogDescription>
          </DialogHeader>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="글쓰기 닫기"
          >
            닫기
          </Button>
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
      </DialogContent>
    </Dialog>
  );
};

type MobileMenuProps = {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  oauth: OAuthClient;
};

export const MobileMenu = ({ open, onClose, onOpenSettings, oauth }: MobileMenuProps) => {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="mobile-menu-panel panel" showCloseButton={false}>
        <div className="mobile-menu-header">
          <DialogHeader>
            <DialogTitle>메뉴</DialogTitle>
            <DialogDescription>계정과 앱 설정을 관리합니다.</DialogDescription>
          </DialogHeader>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="메뉴 닫기">
            닫기
          </Button>
        </div>
        <div className="mobile-menu-actions">
          <Button
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
          </Button>
        </div>
        <div className="mobile-menu-section">
          <AccountAdd oauth={oauth} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
