import { Badge } from "@/components/ui/badge";
import { sanitizeHtml } from "../utils/htmlSanitizer";
import { renderMarkdown } from "../utils/markdown";
import { shortcutSections } from "../content/shortcuts";
import licenseText from "../../../LICENSE?raw";
import ossMarkdown from "../content/oss.md?raw";
import termsMarkdown from "../content/terms.md?raw";

const termsHtml = sanitizeHtml(renderMarkdown(termsMarkdown));
const ossHtml = sanitizeHtml(renderMarkdown(ossMarkdown));

export const PageHeader = ({ title }: { title: string }) => (
  <div className="page-header">
    <a href="#/" className="back-link">
      <span className="back-icon" aria-hidden="true">
        ←
      </span>
      타임라인으로 돌아가기
    </a>
    <h2>{title}</h2>
  </div>
);

export const TermsContent = () => (
  <div className="info-markdown" dangerouslySetInnerHTML={{ __html: termsHtml }} />
);

export const LicenseContent = () => <pre className="license">{licenseText}</pre>;

export const OssContent = () => (
  <div className="info-markdown" dangerouslySetInnerHTML={{ __html: ossHtml }} />
);

export const ShortcutsContent = () => (
  <div className="shortcut-sections">
    {shortcutSections.map((section) => (
      <div key={section.title} className="shortcut-section">
        <h4 className="shortcut-title">{section.title}</h4>
        {section.note ? <p className="shortcut-note">{section.note}</p> : null}
        <ul className="shortcut-list">
          {section.items.map((item) => (
            <li key={`${section.title}-${item.keys}`} className="shortcut-item">
              <Badge className="shortcut-key" variant="outline">
                {item.keys}
              </Badge>
              <span className="shortcut-desc">{item.description}</span>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
);

export const TermsPage = () => (
  <section className="panel info-panel">
    <PageHeader title="이용약관" />
    <TermsContent />
  </section>
);

export const LicensePage = () => (
  <section className="panel info-panel">
    <PageHeader title="라이선스" />
    <LicenseContent />
  </section>
);

export const OssPage = () => (
  <section className="panel info-panel">
    <PageHeader title="오픈소스 목록" />
    <OssContent />
  </section>
);

export const ShortcutsPage = () => (
  <section className="panel info-panel">
    <PageHeader title="단축키" />
    <ShortcutsContent />
  </section>
);
