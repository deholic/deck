import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import type { InfoModalType } from "../types/info";
import { LicenseContent, OssContent, ShortcutsContent, TermsContent } from "../pages/InfoPages";

const getInfoModalTitle = (type: InfoModalType) => {
  switch (type) {
    case "terms":
      return "이용약관";
    case "license":
      return "라이선스";
    case "oss":
      return "오픈소스 목록";
    case "shortcuts":
      return "단축키";
    default:
      return "";
  }
};

const InfoModalContent = ({ type }: { type: InfoModalType }) => {
  switch (type) {
    case "terms":
      return <TermsContent />;
    case "license":
      return <LicenseContent />;
    case "oss":
      return <OssContent />;
    case "shortcuts":
      return <ShortcutsContent />;
    default:
      return null;
  }
};

export const InfoModal = ({ type, onClose }: { type: InfoModalType; onClose: () => void }) => {
  const title = getInfoModalTitle(type);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="info-modal-content" showCloseButton={false}>
        <div className="info-modal-header">
          <DialogHeader>
            <DialogTitle className="info-modal-title">{title}</DialogTitle>
          </DialogHeader>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label={`${title} 닫기`}>
            닫기
          </Button>
        </div>
        <div className="info-modal-body">
          <InfoModalContent type={type} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
