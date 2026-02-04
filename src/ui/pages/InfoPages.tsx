import { sanitizeHtml } from "../utils/htmlSanitizer";
import { renderMarkdown } from "../utils/markdown";
import { getShortcutSections } from "../content/shortcuts";
import licenseText from "../../../LICENSE?raw";
import ossMarkdown from "../content/oss.md?raw";
import ossMarkdownEn from "../content/oss.en.md?raw";
import termsMarkdown from "../content/terms.md?raw";
import termsMarkdownEn from "../content/terms.en.md?raw";
import { useTranslation } from "react-i18next";

const resolveMarkdownByLocale = (locale: string, koMarkdown: string, enMarkdown: string) =>
  locale.startsWith("en") ? enMarkdown : koMarkdown;

export const PageHeader = ({ title }: { title: string }) => {
  const { t } = useTranslation();
  return (
    <div className="page-header">
      <a href="#/" className="back-link">
        <span className="back-icon" aria-hidden="true">
          ←
        </span>
        {t("infoPages.backToTimeline")}
      </a>
      <h2>{title}</h2>
    </div>
  );
};

export const TermsContent = () => {
  const { i18n } = useTranslation();
  const resolvedLocale = i18n.resolvedLanguage ?? i18n.language;
  const markdown = resolveMarkdownByLocale(resolvedLocale, termsMarkdown, termsMarkdownEn);
  const html = sanitizeHtml(renderMarkdown(markdown));
  return <div className="info-markdown" dangerouslySetInnerHTML={{ __html: html }} />;
};

export const LicenseContent = () => <pre className="license">{licenseText}</pre>;

export const OssContent = () => {
  const { i18n } = useTranslation();
  const resolvedLocale = i18n.resolvedLanguage ?? i18n.language;
  const markdown = resolveMarkdownByLocale(resolvedLocale, ossMarkdown, ossMarkdownEn);
  const html = sanitizeHtml(renderMarkdown(markdown));
  return <div className="info-markdown" dangerouslySetInnerHTML={{ __html: html }} />;
};

export const ShortcutsContent = () => {
  const { t } = useTranslation();
  const shortcutSections = getShortcutSections(t);
  return (
    <div className="shortcut-sections">
      {shortcutSections.map((section) => (
        <div key={section.title} className="shortcut-section">
          <h4 className="shortcut-title">{section.title}</h4>
          {section.note ? <p className="shortcut-note">{section.note}</p> : null}
          <ul className="shortcut-list">
            {section.items.map((item) => (
              <li key={`${section.title}-${item.keys}`} className="shortcut-item">
                <span className="shortcut-key">{item.keys}</span>
                <span className="shortcut-desc">{item.description}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export const TermsPage = () => {
  const { t } = useTranslation();
  return (
    <section className="panel info-panel">
      <PageHeader title={t("infoPages.terms")} />
      <TermsContent />
    </section>
  );
};

export const LicensePage = () => {
  const { t } = useTranslation();
  return (
    <section className="panel info-panel">
      <PageHeader title={t("infoPages.license")} />
      <LicenseContent />
    </section>
  );
};

export const OssPage = () => {
  const { t } = useTranslation();
  return (
    <section className="panel info-panel">
      <PageHeader title={t("infoPages.oss")} />
      <OssContent />
    </section>
  );
};

export const ShortcutsPage = () => {
  const { t } = useTranslation();
  return (
    <section className="panel info-panel">
      <PageHeader title={t("infoPages.shortcuts")} />
      <ShortcutsContent />
    </section>
  );
};
