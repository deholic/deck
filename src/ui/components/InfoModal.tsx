import type { InfoModalType } from "../types/info";
import { LicenseContent, OssContent, ShortcutsContent, TermsContent } from "../pages/InfoPages";
import { useTranslation } from "react-i18next";

const INFO_MODAL_TITLE_KEYS: Record<InfoModalType, string> = {
  terms: "infoPages.terms",
  license: "infoPages.license",
  oss: "infoPages.oss",
  shortcuts: "infoPages.shortcuts"
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
  const { t } = useTranslation();
  const title = t(INFO_MODAL_TITLE_KEYS[type]);
  return (
    <div className="info-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="info-modal-backdrop" onClick={onClose} />
      <div className="info-modal-content">
        <div className="info-modal-header">
          <h3 className="info-modal-title">{title}</h3>
          <button type="button" className="ghost" onClick={onClose} aria-label={t("infoModal.closeAria", { title })}>
            {t("actions.close")}
          </button>
        </div>
        <div className="info-modal-body">
          <InfoModalContent type={type} />
        </div>
      </div>
    </div>
  );
};
