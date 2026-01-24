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
    <div className="info-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="info-modal-backdrop" onClick={onClose} />
      <div className="info-modal-content">
        <div className="info-modal-header">
          <h3 className="info-modal-title">{title}</h3>
          <button type="button" className="ghost" onClick={onClose} aria-label={`${title} 닫기`}>
            닫기
          </button>
        </div>
        <div className="info-modal-body">
          <InfoModalContent type={type} />
        </div>
      </div>
    </div>
  );
};
