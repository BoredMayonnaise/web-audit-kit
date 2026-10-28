import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ReactElement,
} from "react";
import {
  CATEGORIES,
  EFFORTS,
  PRIORITIES,
  PRIORITY_HELP,
  MAX_PROJECT_BYTES,
  MAX_FINDINGS,
  MAX_SCREENSHOTS,
  deleteFinding,
  duplicateFinding,
  move,
  newFinding,
  newProject,
  orderedActions,
  parseProject,
  serializeProject,
  validateProject,
  type Finding,
  type Project,
  type AuditImage,
} from "./model";
import { processImage, verifyProjectImages } from "./images";
import { exampleProject } from "./example";
import { Icon } from "./Icon";
import { CoverPreview, Priority, Report } from "./Report";
const SECTIONS = [
  "Project",
  "Branding",
  "Findings",
  "Action Plan",
  "Preview",
] as const;
type Section = (typeof SECTIONS)[number];
const GUIDE_TEXT = {
  Project: {
    title: "Introduce the client and the review",
    text: "Fill in the names and contact details below. Then write a short summary of your findings and state which pages you reviewed.",
    example:
      "Example summary: The quote form needs clearer labels. Start there, then improve the navigation. Example scope: Homepage and contact page reviewed on a laptop and phone; checkout was not tested.",
  },
  Branding: {
    title: "Choose how the report looks",
    text: "Upload a logo from your computer, or leave it blank to use your auditor name. Choose an accent color and check the cover preview.",
    example:
      "A logo is optional. Use Replace logo to change it or Remove logo to leave it out.",
  },
  Findings: {
    title: "Add your first finding",
    text: "Choose Add finding. Give it a title, describe what you observed, explain the impact, and recommend a fix. Verification tells the client how to check the change.",
    example:
      "Example title: Quote form has no visible labels. Use Add images for supporting screenshots and write a caption. Add another finding when you finish. Use the arrows to change report order; on smaller screens, use Select a finding to switch.",
  },
  "Action Plan": {
    title: "Choose the recommended next steps",
    text: "Tick the findings you want your client to address. Use the up and down arrows to set the order. Editing a finding also updates its next step.",
    example:
      "You can leave findings out of the action plan. Removing a next step keeps the original finding in the report.",
  },
  Preview: {
    title: "Keep a backup, then export the client copy",
    text: "Save editable project downloads a backup containing your text and images. Export client PDF opens browser printing: choose Save as PDF, match A4 or US Letter, use 100% scale, and turn off headers and footers.",
    example:
      "To continue later, open this HTML app and choose Open a saved project, then select your .audit.json backup. A PDF cannot restore the editable project.",
  },
};
const STORAGE_KEY = "web-audit-kit-draft-v1";
type Notice = { text: string; error?: boolean } | null;
function initialState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const project = parseProject(JSON.stringify(saved.project));
      return {
        project,
        dirty: saved.dirty !== false,
        recovered: true,
        message:
          "Local draft recovered. Download a project file to keep a reliable copy.",
      };
    }
  } catch {
    return {
      project: exampleProject(),
      dirty: false,
      recovered: false,
      message:
        "Browser recovery is unavailable or the previous draft is unreadable. Download project files to keep your work.",
    };
  }
  return {
    project: exampleProject(),
    dirty: false,
    recovered: false,
    message: "",
  };
}
function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactElement<{ id?: string; "aria-describedby"?: string }>;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {cloneElement(children, {
        id,
        "aria-describedby": hint ? `${id}-hint` : undefined,
      })}
      {hint && (
        <span className="field-hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
    </div>
  );
}
function Reorder({
  index,
  total,
  onMove,
  label,
}: {
  index: number;
  total: number;
  onMove: (direction: -1 | 1) => void;
  label: string;
}) {
  return (
    <div className="reorder">
      <button
        type="button"
        className="icon-button"
        disabled={index === 0}
        onClick={() => onMove(-1)}
        aria-label={`Move ${label} up`}
        title="Move up"
      >
        <Icon name="up" size={16} />
      </button>
      <button
        type="button"
        className="icon-button"
        disabled={index === total - 1}
        onClick={() => onMove(1)}
        aria-label={`Move ${label} down`}
        title="Move down"
      >
        <Icon name="down" size={16} />
      </button>
    </div>
  );
}
export default function App() {
  const [initial] = useState(initialState);
  const [project, setProject] = useState<Project>(initial.project);
  const [dirty, setDirty] = useState(initial.dirty);
  const [section, setSection] = useState<Section>("Project");
  const [selected, setSelected] = useState<string | null>(
    initial.project.findings[0]?.id ?? null,
  );
  const [notice, setNotice] = useState<Notice>(
    initial.message ? { text: initial.message } : null,
  );
  const [draftStatus, setDraftStatus] = useState("Checking local recovery…");
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const [welcome, setWelcome] = useState(!initial.recovered);
  const [guided, setGuided] = useState(true);
  const [downloadedName, setDownloadedName] = useState<string | null>(null);
  const openInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const guideHeading = useRef<HTMLHeadingElement>(null);
  const stateRef = useRef({ project, dirty, welcome });
  stateRef.current = { project, dirty, welcome };
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  function commit(next: Project) {
    setProject(next);
    setDirty(true);
  }
  function amendDetails(key: keyof Project["details"], value: string) {
    commit({ ...project, details: { ...project.details, [key]: value } });
  }
  function amendFinding(id: string, changes: Partial<Finding>) {
    const current = stateRef.current.project;
    commit({
      ...current,
      findings: current.findings.map((f) =>
        f.id === id ? { ...f, ...changes } : f,
      ),
    });
  }
  function navigate(next: Section) {
    setSection(next);
    requestAnimationFrame(() => {
      (guideHeading.current ?? heading.current)?.focus();
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }
  function canReplace() {
    return (
      !stateRef.current.dirty ||
      window.confirm(
        "Replace this project? You have unsaved changes. Download your project first if you want to keep them.",
      )
    );
  }
  function replaceProject(next: Project, downloaded: boolean) {
    setWelcome(false);
    setGuided(true);
    setDownloadedName(null);
    setProject(next);
    setDirty(!downloaded);
    setSelected(next.findings[0]?.id ?? null);
    navigate("Project");
  }
  function blankProject() {
    if (canReplace()) {
      replaceProject(newProject(), true);
      setNotice({
        text: "New project ready. Add your client details to get started.",
      });
    }
  }
  function loadExample() {
    if (canReplace()) {
      replaceProject(exampleProject(), true);
      setNotice({
        text: "Fictional example opened. You can edit the findings and screenshots.",
      });
    }
  }
  function downloadProject() {
    try {
      const json = serializeProject(validateProject(project)),
        blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `${
        (project.details.client || "website-audit")
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 70) || "website-audit"
      }.audit.json`;
      document.body.append(a);
      a.click();
      setDownloadedName(a.download);
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setDirty(false);
      setNotice({
        text: `Project download started: ${a.download}. Check your Downloads folder. This editable JSON file includes your images.`,
      });
    } catch (error) {
      setNotice({ text: errorMessage(error), error: true });
    }
  }
  async function openProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > MAX_PROJECT_BYTES)
        throw Error(
          "Project exceeds 25 MB. Choose a smaller Web Audit Kit JSON file.",
        );
      const next = parseProject(await file.text());
      await verifyProjectImages(next);
      if (!canReplace()) return;
      replaceProject(next, true);
      setNotice({
        text: `Opened ${file.name}. All project fields, branding, and images have been restored.`,
      });
    } catch (error) {
      setNotice({
        text: `${errorMessage(error)} Your current project is unchanged.`,
        error: true,
      });
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function upload(
    event: ChangeEvent<HTMLInputElement>,
    findingId?: string,
  ) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    const projectId = project.id;
    setBusy(true);
    try {
      if (findingId) {
        const target = project.findings.find((f) => f.id === findingId);
        if (!target) return;
        if (target.screenshots.length + files.length > 8)
          throw Error(
            "Each finding can have up to 8 screenshots. Remove one before adding more.",
          );
        if (
          project.findings.reduce((n, f) => n + f.screenshots.length, 0) +
            files.length >
          MAX_SCREENSHOTS
        )
          throw Error(
            `A project can contain up to ${MAX_SCREENSHOTS} screenshots.`,
          );
      }
      const images: AuditImage[] = [];
      for (const file of files)
        images.push(await processImage(file, !findingId));
      const current = stateRef.current.project;
      if (current.id !== projectId)
        throw Error(
          "Project changed while the image was processing. Upload it again.",
        );
      let next: Project;
      if (findingId) {
        if (!current.findings.some((f) => f.id === findingId))
          throw Error("That finding was removed. Images were not added.");
        next = {
          ...current,
          findings: current.findings.map((f) =>
            f.id === findingId
              ? { ...f, screenshots: [...f.screenshots, ...images] }
              : f,
          ),
        };
      } else
        next = {
          ...current,
          branding: { ...current.branding, logo: images[0] },
        };
      commit(validateProject(next));
      setNotice({
        text: findingId
          ? `${images.length} screenshot${images.length === 1 ? "" : "s"} added. Images are stored inside your project.`
          : "Logo updated. Your report preview is ready.",
      });
    } catch (error) {
      setNotice({ text: errorMessage(error), error: true });
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function exportPDF() {
    setBusy(true);
    setSection("Preview");
    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      await document.fonts.ready;
      await Promise.all(
        Array.from(
          document.querySelectorAll<HTMLImageElement>(".report-document img"),
        ).map((image) => image.decode()),
      );
      setNotice({
        text: `Choose “Save as PDF”, ${project.paperSize === "A4" ? "A4" : "US Letter"}, 100% scale, and turn off browser headers and footers. Your editable project is saved separately.`,
      });
      window.print();
    } catch {
      setNotice({
        text: "Printing could not start. Make sure images have loaded and your browser allows printing, then try again.",
        error: true,
      });
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (welcome) return;
    function writeDraft() {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            project: stateRef.current.project,
            dirty: stateRef.current.dirty,
            updatedAt: new Date().toISOString(),
          }),
        );
        setDraftStatus("Local recovery ready");
      } catch {
        setDraftStatus("Local recovery unavailable");
      }
    }
    const timer = setTimeout(writeDraft, 650);
    return () => clearTimeout(timer);
  }, [project, dirty, welcome]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (stateRef.current.welcome) return;
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            project: stateRef.current.project,
            dirty: stateRef.current.dirty,
            updatedAt: new Date().toISOString(),
          }),
        );
      } catch {
        /* Downloaded files remain the reliable backup when browser storage is unavailable. */
      }
      if (stateRef.current.dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const visibility = () => {
      if (!stateRef.current.welcome && document.visibilityState === "hidden") {
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              project: stateRef.current.project,
              dirty: stateRef.current.dirty,
            }),
          );
        } catch {
          /* Best-effort draft only. */
        }
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  const finding = project.findings.find((f) => f.id === selected);
  const highCount = project.findings.filter(
    (f) => f.priority === "High",
  ).length;
  const detailsComplete = !!(
    project.details.client &&
    project.details.summary &&
    project.details.scope &&
    project.details.auditor
  );
  const pageHeadings = {
    Project: [
      "01 / PROJECT",
      "Project details",
      "Add the client details, summary, and scope for this audit.",
    ],
    Branding: [
      "02 / BRANDING",
      "Report branding",
      "Choose a logo and accent color for your client report.",
    ],
    Findings: [
      "03 / FINDINGS",
      "Findings",
      "Record the evidence and explain how your client can address each issue.",
    ],
    "Action Plan": [
      "04 / ACTION PLAN",
      "Action plan",
      "Select findings and order the work you recommend.",
    ],
    Preview: [
      "05 / PREVIEW",
      "Report preview",
      "Review your report and choose a paper size before exporting a PDF.",
    ],
  }[section];
  if (welcome)
    return (
      <div className="app-shell welcome-shell">
        <main className="welcome-screen">
          <p className="eyebrow">WEB AUDIT KIT / FOR FREELANCERS</p>
          <h1>Create a report for your client.</h1>
          <p>
            Enter your website findings, add your branding, and export a PDF.
            You can use this app offline without installing anything.
          </p>
          <p>
            You supply the observations. This app does not scan or test
            websites.
          </p>
          <div className="welcome-actions">
            <button
              className="button button-dark"
              onClick={blankProject}
              disabled={busy}
            >
              Create a report <Icon name="arrow" size={18} />
            </button>
            <button
              className="button button-white"
              onClick={loadExample}
              disabled={busy}
            >
              Explore the example
            </button>
            <button
              className="button button-white"
              onClick={() => openInput.current?.click()}
              disabled={busy}
            >
              Open a saved project
            </button>
          </div>
          <input
            ref={openInput}
            type="file"
            accept=".json,application/json"
            aria-label="Open project file"
            className="visually-hidden"
            tabIndex={-1}
            onChange={openProject}
            disabled={busy}
          />
          {notice && (
            <div
              className={`notice ${notice.error ? "notice-error" : ""}`}
              role={notice.error ? "alert" : "status"}
            >
              {notice.text}
              <button
                className="icon-button"
                onClick={() => setNotice(null)}
                aria-label="Dismiss message"
              >
                <Icon name="close" />
              </button>
            </div>
          )}
          <details className="opening-help">
            <summary>Opening files and continuing later</summary>
            <p>
              Windows or Linux: right-click the HTML file and choose Open with,
              then your browser. macOS: Control-click and choose Open With. You
              can also use the browser’s Open File command (Ctrl+O on
              Windows/Linux, Command+O on macOS).
            </p>
            <p>
              To restore a backup, choose Open a saved project above and select
              your .audit.json file. Do not open the JSON file as the
              application. Use Help → Restart guide after opening a report if
              you need the steps again.
            </p>
          </details>
          <div className="welcome-files">
            <h2>Keep these three files separate</h2>
            <dl>
              <dt>Application · .html</dt>
              <dd>Open this file in your browser whenever you want to work.</dd>
              <dt>Editable project · .audit.json</dt>
              <dd>
                Download a backup with Save project. Restore it using Open a
                saved project inside this app.
              </dd>
              <dt>Client report · .pdf</dt>
              <dd>
                Export this copy to send to your client. Keep the editable
                project for future changes.
              </dd>
            </dl>
          </div>
          <p className="field-hint">
            Run start.sh to open the application. On Windows, use WSL or Git
            Bash; on Linux and macOS, use Bash. Browser recovery is best effort;
            download your project to keep a backup.
          </p>
        </main>
      </div>
    );
  return (
    <div className={`app-shell ${guided ? "guided-mode" : ""}`}>
      <style>{`@page { size: ${project.paperSize === "A4" ? "A4" : "letter"}; margin: 16mm 16mm 17mm; }`}</style>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Workspace navigation">
        <a
          className="app-brand"
          href="#project"
          onClick={(e) => {
            e.preventDefault();
            navigate("Project");
          }}
        >
          <span className="brand-icon" aria-hidden="true">
            w/a
          </span>
          <span>
            Web Audit Kit<small>FOR FREELANCERS</small>
          </span>
        </a>
        <div className="sidebar-project">
          <span className="tiny-label">YOUR WORKSPACE</span>
          <strong>{project.details.client || "Untitled project"}</strong>
          <span>Website audit report</span>
        </div>
        <nav aria-label="Report sections">
          {SECTIONS.map((item, i) => (
            <button
              key={item}
              aria-label={item}
              className={`nav-item ${section === item ? "active" : ""}`}
              onClick={() => navigate(item)}
              aria-current={section === item ? "page" : undefined}
            >
              <Icon name={["project", "brand", "findings", "plan", "eye"][i]} />
              <span>{item}</span>
              {item === "Findings" ? (
                <span className="nav-count">{project.findings.length}</span>
              ) : item === "Action Plan" ? (
                <span className="nav-count">{project.actionPlan.length}</span>
              ) : item === "Project" && detailsComplete ? (
                <Icon name="check" size={15} />
              ) : item === "Preview" ? (
                <Icon name="chevron" size={14} />
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-file-actions">
          <button onClick={blankProject} disabled={busy}>
            <Icon name="plus" size={18} />
            New project
          </button>
          <button onClick={() => openInput.current?.click()} disabled={busy}>
            <Icon name="folder" size={18} />
            Open project
          </button>
        </div>
        <div className="sidebar-bottom">
          <button className="help-button" onClick={() => setHelp(true)}>
            <Icon name="help" size={17} />
            Help
          </button>
          <span className="sidebar-version">
            WEB AUDIT KIT <span>v1.0</span>
          </span>
        </div>
      </aside>
      <div className="workspace" aria-busy={busy}>
        <header className="app-header">
          <div className="workspace-location">
            <span className="connection-dot" />
            Offline workspace<span className="header-divider">/</span>
            <span className="header-section">{section}</span>
          </div>
          <div className="header-actions">
            <span className={`save-state ${dirty ? "unsaved" : ""}`}>
              <span />
              {dirty ? "Unsaved changes" : "No unsaved changes"}
            </span>
            <button
              className="button button-white"
              title="Download an editable JSON project, including images"
              onClick={downloadProject}
              disabled={busy}
            >
              <Icon name="save" size={17} />
              <span>Save project</span>
            </button>
            <button
              className="button button-dark"
              title="Print your report or save it as a PDF"
              onClick={exportPDF}
              disabled={busy}
            >
              <Icon name="download" size={17} />
              <span>{busy ? "Please wait…" : "Export PDF"}</span>
            </button>
          </div>
        </header>
        <input
          ref={openInput}
          type="file"
          accept=".json,application/json"
          aria-label="Open project file"
          className="visually-hidden"
          tabIndex={-1}
          onChange={openProject}
          disabled={busy}
        />
        {notice && (
          <div
            className={`notice ${notice.error ? "notice-error" : ""}`}
            role={notice.error ? "alert" : "status"}
          >
            <Icon name={notice.error ? "info" : "check"} size={18} />
            <span>{notice.text}</span>
            <button
              className="icon-button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss message"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
        <main
          id="main-content"
          tabIndex={-1}
          className={`main-content ${section === "Preview" ? "preview-mode" : ""}`}
        >
          <div className="editor-content">
            {guided && (
              <section
                className="guide-panel"
                aria-label="Report creation guide"
              >
                <div className="guide-top">
                  <span className="eyebrow">
                    STEP {SECTIONS.indexOf(section) + 1} OF 5 · {section}
                  </span>
                  <button
                    className="text-button"
                    onClick={() => setGuided(false)}
                  >
                    Exit guide
                  </button>
                </div>
                <h2 ref={guideHeading} tabIndex={-1}>
                  {GUIDE_TEXT[section].title}
                </h2>
                <p>{GUIDE_TEXT[section].text}</p>
                <p className="guide-example">{GUIDE_TEXT[section].example}</p>
                <div className="guide-navigation">
                  <button
                    className="button button-white"
                    disabled={section === "Project"}
                    onClick={() =>
                      navigate(SECTIONS[SECTIONS.indexOf(section) - 1])
                    }
                  >
                    <Icon name="back" size={16} />
                    Back
                  </button>
                  {section !== "Preview" && (
                    <button
                      className="button button-dark"
                      onClick={() =>
                        navigate(SECTIONS[SECTIONS.indexOf(section) + 1])
                      }
                    >
                      Next: {SECTIONS[SECTIONS.indexOf(section) + 1]}
                      <Icon name="arrow" size={16} />
                    </button>
                  )}
                </div>
                {section === "Preview" && (
                  <div className="guide-review">
                    <h3>Before you send the report</h3>
                    <ul>
                      {(!project.details.client ||
                        !project.details.auditor) && (
                        <li>Add the client and auditor names in Project.</li>
                      )}
                      {!project.details.summary && (
                        <li>Add an executive summary in Project.</li>
                      )}
                      {!project.details.scope && (
                        <li>Describe the scope and limitations in Project.</li>
                      )}
                      {project.findings.length === 0 && (
                        <li>
                          This report has no findings. You can export it as a
                          draft or add findings first.
                        </li>
                      )}
                      {project.actionPlan.length === 0 && (
                        <li>
                          No next steps selected. Choose findings in Action Plan
                          if you want recommendations.
                        </li>
                      )}
                      <li>
                        {downloadedName && !dirty
                          ? `Backup download started: ${downloadedName}. Check your Downloads folder.`
                          : "Save an editable project backup before closing. Browser recovery may be unavailable."}
                      </li>
                      <li>
                        Review the client report and match the paper size in the
                        print dialog.
                      </li>
                    </ul>
                    <div className="welcome-actions">
                      <button
                        className="button button-white"
                        onClick={downloadProject}
                        disabled={busy}
                      >
                        Save editable project
                      </button>
                      <button
                        className="button button-dark"
                        onClick={exportPDF}
                        disabled={busy}
                      >
                        Export client PDF
                      </button>
                    </div>
                    <p className="field-hint">
                      These reminders do not prevent saving or exporting an
                      unfinished report.
                    </p>
                  </div>
                )}
              </section>
            )}

            {project.demo && (
              <div className="demo-strip">
                <span className="demo-label">EXAMPLE PROJECT</span>
                <span>
                  Fictional content. Edit this example or start a new project.
                </span>
                <button onClick={blankProject} disabled={busy}>
                  Start a blank project <Icon name="arrow" size={15} />
                </button>
              </div>
            )}
            <div className="page-heading">
              <div>
                <p className="eyebrow">{pageHeadings[0]}</p>
                <h1 ref={heading} tabIndex={-1}>
                  {pageHeadings[1]}
                </h1>
                <p>{pageHeadings[2]}</p>
              </div>
              {section !== "Preview" && (
                <button
                  className="button button-white preview-shortcut"
                  onClick={() => navigate("Preview")}
                >
                  <Icon name="eye" size={17} />
                  Preview report
                </button>
              )}
            </div>
            {section === "Project" && (
              <>
                <div className="project-layout">
                  <div className="form-stack">
                    <section className="panel">
                      <div className="panel-heading">
                        <span className="section-icon">
                          <Icon name="project" />
                        </span>
                        <div>
                          <h2>Client & auditor</h2>
                          <p>
                            Add the names and contact details for this report.
                          </p>
                        </div>
                        <span className="section-step">01</span>
                      </div>
                      <div className="panel-body">
                        <div className="field-grid">
                          <Field label="Client / business name">
                            <input
                              value={project.details.client}
                              maxLength={500}
                              onChange={(e) =>
                                amendDetails("client", e.target.value)
                              }
                              placeholder="e.g. Brightside Cleaning"
                            />
                          </Field>
                          <Field label="Website URL">
                            <input
                              type="text"
                              inputMode="url"
                              value={project.details.website}
                              maxLength={500}
                              onChange={(e) =>
                                amendDetails("website", e.target.value)
                              }
                              placeholder="https://your-client.com"
                            />
                          </Field>
                          <Field label="Report title" className="span-full">
                            <input
                              value={project.details.title}
                              maxLength={500}
                              onChange={(e) =>
                                amendDetails("title", e.target.value)
                              }
                              placeholder="Website audit report"
                            />
                          </Field>
                          <Field label="Audit date">
                            <input
                              type="date"
                              min="0001-01-01"
                              max="9999-12-31"
                              value={project.details.date}
                              onChange={(e) =>
                                amendDetails("date", e.target.value)
                              }
                            />
                          </Field>
                          <Field label="Auditor / studio name">
                            <input
                              value={project.details.auditor}
                              maxLength={500}
                              onChange={(e) =>
                                amendDetails("auditor", e.target.value)
                              }
                              placeholder="Your name or studio"
                            />
                          </Field>
                          <Field
                            label="Auditor contact details"
                            className="span-full"
                            hint="Email, website, or phone. These appear at the end of your report."
                          >
                            <textarea
                              rows={2}
                              value={project.details.contact}
                              maxLength={2000}
                              onChange={(e) =>
                                amendDetails("contact", e.target.value)
                              }
                              placeholder="hello@yourstudio.com"
                            />
                          </Field>
                        </div>
                      </div>
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <span className="section-icon">
                          <Icon name="findings" />
                        </span>
                        <div>
                          <h2>Summary & scope</h2>
                          <p>
                            Explain the main findings and the limits of your
                            review.
                          </p>
                        </div>
                        <span className="section-step">02</span>
                      </div>
                      <div className="panel-body">
                        <Field
                          label="Executive summary"
                          hint="Summarize the key issues and your recommended starting point."
                        >
                          <textarea
                            rows={7}
                            maxLength={12000}
                            value={project.details.summary}
                            onChange={(e) =>
                              amendDetails("summary", e.target.value)
                            }
                            placeholder="Summarize the findings and recommend where to start."
                          />
                        </Field>
                        <Field
                          label="Audit scope & limitations"
                          hint="List the pages and devices you reviewed, plus areas you did not test."
                        >
                          <textarea
                            rows={6}
                            maxLength={12000}
                            value={project.details.scope}
                            onChange={(e) =>
                              amendDetails("scope", e.target.value)
                            }
                            placeholder="Pages reviewed, devices considered, and limits of this audit…"
                          />
                        </Field>
                      </div>
                    </section>
                  </div>
                  <aside className="project-aside">
                    <div className="aside-caption">
                      <span className="tiny-label">REPORT COVER</span>
                      <span className="live-tag">
                        <span />
                        Live preview
                      </span>
                    </div>
                    <div className="cover-preview-wrap">
                      <CoverPreview project={project} />
                    </div>
                    <div className="preview-caption">
                      <Icon name="brand" size={15} />
                      <span>Your report cover updates as you edit.</span>
                    </div>
                    <section className="glance-card">
                      <h3>Report contents</h3>
                      <div>
                        <span>Documented findings</span>
                        <strong>{project.findings.length}</strong>
                      </div>
                      <div>
                        <span>High-priority items</span>
                        <strong className={highCount ? "text-rust" : ""}>
                          {highCount}
                        </strong>
                      </div>
                      <div>
                        <span>Recommended next steps</span>
                        <strong>{project.actionPlan.length}</strong>
                      </div>
                      <p>
                        Choose next steps in Action Plan. Use Preview to review
                        the complete report.
                      </p>
                    </section>
                  </aside>
                </div>
                <div className="page-bottom">
                  <span>Your details update the report as you type.</span>
                  <button
                    className="button button-dark"
                    onClick={() => navigate("Branding")}
                  >
                    Next: Branding <Icon name="arrow" size={17} />
                  </button>
                </div>
              </>
            )}
            {section === "Branding" && (
              <div className="project-layout">
                <div className="form-stack">
                  <section className="panel">
                    <div className="panel-heading">
                      <span className="section-icon">
                        <Icon name="brand" />
                      </span>
                      <div>
                        <h2>Logo & color</h2>
                        <p>Preview your choices on the report cover.</p>
                      </div>
                    </div>
                    <div className="panel-body">
                      <span className="field-label">Your logo</span>
                      <div className="logo-upload">
                        {project.branding.logo ? (
                          <img
                            src={project.branding.logo.dataUrl}
                            alt="Your uploaded logo"
                          />
                        ) : (
                          <>
                            <span className="upload-icon">
                              <Icon name="image" size={28} />
                            </span>
                            <h3>Add your logo</h3>
                            <p>Choose a PNG, JPEG, or WebP from your device.</p>
                          </>
                        )}
                        <label
                          className={`button button-white file-button ${busy ? "disabled" : ""}`}
                        >
                          <Icon name="upload" size={17} />
                          {project.branding.logo
                            ? "Replace logo"
                            : "Upload logo"}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            aria-label="Upload logo"
                            onChange={(e) => upload(e)}
                            disabled={busy}
                          />
                        </label>
                        {project.branding.logo && (
                          <button
                            className="text-button danger-text"
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Remove this logo from the report?",
                                )
                              )
                                commit({
                                  ...project,
                                  branding: { ...project.branding, logo: null },
                                });
                            }}
                          >
                            Remove logo
                          </button>
                        )}
                        <small>
                          PNG, JPEG, or WebP · Up to 10 MB · Resized to 800 px
                        </small>
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor="brand-accent">
                          Report accent color
                        </label>
                        <div className="color-picker">
                          <input
                            id="brand-accent"
                            aria-describedby="brand-accent-hint"
                            type="color"
                            value={project.branding.accent}
                            onChange={(e) =>
                              commit({
                                ...project,
                                branding: {
                                  ...project.branding,
                                  accent: e.target.value,
                                },
                              })
                            }
                            aria-label="Choose accent color"
                          />
                          <span>{project.branding.accent.toUpperCase()}</span>
                          <div className="swatches">
                            {[
                              "#526b50",
                              "#334b65",
                              "#8b4d3d",
                              "#675379",
                              "#282e2a",
                            ].map((color) => (
                              <button
                                key={color}
                                aria-label={`Use ${color} accent`}
                                aria-pressed={project.branding.accent === color}
                                style={{ background: color }}
                                onClick={() =>
                                  commit({
                                    ...project,
                                    branding: {
                                      ...project.branding,
                                      accent: color,
                                    },
                                  })
                                }
                              >
                                {project.branding.accent === color && (
                                  <Icon name="check" size={14} />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                        <span className="field-hint" id="brand-accent-hint">
                          Used for fine lines, section markers, and subtle
                          document details.
                        </span>
                      </div>
                      <p className="inline-tip">
                        <Icon name="check" size={16} />
                        Your report uses your auditor or studio name when you
                        leave the logo blank.
                      </p>
                    </div>
                  </section>
                  <button
                    className="button button-dark align-right"
                    onClick={() => navigate("Findings")}
                  >
                    Next: Findings <Icon name="arrow" size={17} />
                  </button>
                </div>
                <aside className="project-aside">
                  <div className="aside-caption">
                    <span className="tiny-label">REPORT COVER</span>
                    <span className="live-tag">
                      <span />
                      Live preview
                    </span>
                  </div>
                  <div className="cover-preview-wrap">
                    <CoverPreview project={project} />
                  </div>
                  <div className="small-tip">
                    <Icon name="info" size={18} />
                    <p>
                      Your logo stays inside the project file. Nothing is
                      uploaded to a server.
                    </p>
                  </div>
                </aside>
              </div>
            )}
            {section === "Findings" && (
              <>
                <details className="priority-reference">
                  <summary>
                    <Icon name="info" size={18} /> Priority guide
                  </summary>
                  <div
                    className="priority-guide"
                    aria-label="Priority definitions"
                  >
                    {PRIORITIES.map((p) => (
                      <div key={p}>
                        <Priority value={p} />
                        <p>{PRIORITY_HELP[p]}</p>
                      </div>
                    ))}
                  </div>
                </details>
                <div className="findings-workspace">
                  <section className="finding-list-panel">
                    <div className="finding-list-header">
                      <h2>
                        Findings <span>{project.findings.length}</span>
                      </h2>
                      <button
                        className="button button-dark button-small"
                        onClick={() => {
                          if (project.findings.length >= MAX_FINDINGS) {
                            setNotice({
                              text: "A project can contain up to 100 findings.",
                              error: true,
                            });
                            return;
                          }
                          const f = newFinding();
                          commit({
                            ...project,
                            findings: [...project.findings, f],
                          });
                          setSelected(f.id);
                        }}
                      >
                        <Icon name="plus" size={15} />
                        Add finding
                      </button>
                    </div>
                    {project.findings.length > 0 && (
                      <div className="mobile-finding-picker">
                        <Field label="Select a finding">
                          <select
                            value={selected ?? ""}
                            onChange={(e) => setSelected(e.target.value)}
                          >
                            {project.findings.map((f, i) => (
                              <option key={f.id} value={f.id}>
                                {i + 1}. {f.title || "Untitled finding"} (
                                {f.priority})
                              </option>
                            ))}
                          </select>
                        </Field>
                        {finding && (
                          <div className="mobile-finding-order">
                            <span>Report order</span>
                            <Reorder
                              index={project.findings.findIndex(
                                (f) => f.id === finding.id,
                              )}
                              total={project.findings.length}
                              label="selected finding"
                              onMove={(direction) =>
                                commit({
                                  ...project,
                                  findings: move(
                                    project.findings,
                                    project.findings.findIndex(
                                      (f) => f.id === finding.id,
                                    ),
                                    direction,
                                  ),
                                })
                              }
                            />
                          </div>
                        )}
                      </div>
                    )}
                    {project.findings.length ? (
                      <ol className="finding-list">
                        {project.findings.map((f, i) => (
                          <li
                            key={f.id}
                            className={selected === f.id ? "selected" : ""}
                          >
                            <button
                              className="finding-select"
                              onClick={() => setSelected(f.id)}
                              aria-pressed={selected === f.id}
                            >
                              <span className="finding-list-index">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              <span>
                                <strong>{f.title || "Untitled finding"}</strong>
                                <span className="finding-list-meta">
                                  <Priority value={f.priority} />
                                  <small>{f.category}</small>
                                </span>
                              </span>
                            </button>
                            <Reorder
                              index={i}
                              total={project.findings.length}
                              label={`finding ${i + 1}`}
                              onMove={(direction) =>
                                commit({
                                  ...project,
                                  findings: move(
                                    project.findings,
                                    i,
                                    direction,
                                  ),
                                })
                              }
                            />
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div className="empty-state">
                        <Icon name="findings" size={32} />
                        <h3>No findings yet</h3>
                        <p>
                          Add your first finding. Explain the issue, its impact,
                          and a practical fix.
                        </p>
                      </div>
                    )}
                  </section>
                  {finding ? (
                    <section className="panel finding-editor" key={finding.id}>
                      <div className="panel-heading">
                        <div>
                          <p className="eyebrow">
                            FINDING{" "}
                            {String(
                              project.findings.findIndex(
                                (f) => f.id === finding.id,
                              ) + 1,
                            ).padStart(2, "0")}
                          </p>
                          <h2>Finding details</h2>
                        </div>
                        <div className="finding-tools">
                          <button
                            className="icon-button"
                            aria-label="Duplicate finding"
                            title="Duplicate finding"
                            onClick={() => {
                              if (
                                project.findings.length >= 100 ||
                                project.findings.reduce(
                                  (n, f) => n + f.screenshots.length,
                                  0,
                                ) +
                                  finding.screenshots.length >
                                  MAX_SCREENSHOTS
                              ) {
                                setNotice({
                                  text: "Cannot duplicate: the project limit is 100 findings and 50 screenshots.",
                                  error: true,
                                });
                                return;
                              }
                              try {
                                const copy = duplicateFinding(finding);
                                const index = project.findings.findIndex(
                                  (f) => f.id === finding.id,
                                );
                                const next = {
                                  ...project,
                                  findings: [
                                    ...project.findings.slice(0, index + 1),
                                    copy,
                                    ...project.findings.slice(index + 1),
                                  ],
                                };
                                serializeProject(next);
                                commit(next);
                                setSelected(copy.id);
                                setNotice({
                                  text: "Finding duplicated. Add the copy to your action plan if needed.",
                                });
                              } catch (error) {
                                setNotice({
                                  text: errorMessage(error),
                                  error: true,
                                });
                              }
                            }}
                          >
                            <Icon name="copy" size={18} />
                          </button>
                          <button
                            className="icon-button danger-text"
                            aria-label="Delete finding"
                            title="Delete finding"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete “${finding.title || "Untitled finding"}” and its screenshots? It will also be removed from the action plan.`,
                                )
                              ) {
                                const next = deleteFinding(project, finding.id);
                                commit(next);
                                setSelected(next.findings[0]?.id ?? null);
                              }
                            }}
                          >
                            <Icon name="trash" size={18} />
                          </button>
                        </div>
                      </div>
                      <div className="panel-body">
                        <Field label="Finding title">
                          <input
                            autoFocus
                            maxLength={500}
                            value={finding.title}
                            onChange={(e) =>
                              amendFinding(finding.id, {
                                title: e.target.value,
                              })
                            }
                            placeholder="Describe the issue in one clear sentence"
                          />
                        </Field>
                        <div className="field-grid">
                          <Field label="Category">
                            <select
                              value={finding.category}
                              onChange={(e) =>
                                amendFinding(finding.id, {
                                  category: e.target
                                    .value as Finding["category"],
                                })
                              }
                            >
                              {CATEGORIES.map((c) => (
                                <option key={c}>{c}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Affected page / URL">
                            <input
                              maxLength={500}
                              value={finding.page}
                              onChange={(e) =>
                                amendFinding(finding.id, {
                                  page: e.target.value,
                                })
                              }
                              placeholder="e.g. Homepage or /contact"
                            />
                          </Field>
                        </div>
                        <div className="field-grid">
                          <Field
                            label="Priority"
                            hint={PRIORITY_HELP[finding.priority]}
                          >
                            <select
                              value={finding.priority}
                              onChange={(e) =>
                                amendFinding(finding.id, {
                                  priority: e.target
                                    .value as Finding["priority"],
                                })
                              }
                            >
                              {PRIORITIES.map((p) => (
                                <option key={p}>{p}</option>
                              ))}
                            </select>
                          </Field>
                          <Field
                            label="Estimated effort"
                            hint="Estimate the size of the work. Use Unknown if you need more context."
                          >
                            <select
                              value={finding.effort}
                              onChange={(e) =>
                                amendFinding(finding.id, {
                                  effort: e.target.value as Finding["effort"],
                                })
                              }
                            >
                              {EFFORTS.map((e) => (
                                <option key={e}>{e}</option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        {(
                          [
                            "observation",
                            "impact",
                            "recommendation",
                            "verification",
                          ] as const
                        ).map((key) => (
                          <Field
                            key={key}
                            label={
                              {
                                observation: "Observation",
                                impact: "Business / user impact",
                                recommendation: "Recommended fix",
                                verification: "How to verify the fix",
                              }[key]
                            }
                            hint={
                              key === "observation"
                                ? "Describe the issue you observed. Note any assumptions."
                                : undefined
                            }
                          >
                            <textarea
                              rows={3}
                              maxLength={12000}
                              value={finding[key]}
                              onChange={(e) =>
                                amendFinding(finding.id, {
                                  [key]: e.target.value,
                                })
                              }
                              placeholder={
                                {
                                  observation:
                                    "Describe the behavior and where you saw it.",
                                  impact:
                                    "Explain how the issue affects visitors or the business.",
                                  recommendation:
                                    "Describe the change you recommend.",
                                  verification:
                                    "Describe the checks needed to confirm the fix.",
                                }[key]
                              }
                            />
                          </Field>
                        ))}
                        <div className="screenshot-section">
                          <div className="screenshot-heading">
                            <div>
                              <h3>
                                Supporting screenshots{" "}
                                <span>{finding.screenshots.length}/8</span>
                              </h3>
                              <p>
                                Add images that show the issue. Captions appear
                                in the report.
                              </p>
                            </div>
                            <label
                              className={`button button-white button-small file-button ${busy ? "disabled" : ""}`}
                            >
                              <Icon name="plus" size={16} />
                              Add images
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                multiple
                                aria-label="Add screenshots"
                                onChange={(e) => upload(e, finding.id)}
                                disabled={busy}
                              />
                            </label>
                          </div>
                          <p className="field-hint">
                            PNG, JPEG, WebP · 10 MB per image · Resized to 2048
                            px · 50 screenshots per project
                          </p>
                          {finding.screenshots.length ? (
                            <div className="screenshot-grid">
                              {finding.screenshots.map((shot, i) => (
                                <div className="screenshot-card" key={shot.id}>
                                  <div className="screenshot-image">
                                    <img
                                      src={shot.dataUrl}
                                      width={shot.width}
                                      height={shot.height}
                                      alt={
                                        shot.caption || `Screenshot ${i + 1}`
                                      }
                                    />
                                    <button
                                      className="icon-button"
                                      aria-label={`Remove screenshot ${i + 1}`}
                                      onClick={() => {
                                        if (
                                          window.confirm(
                                            "Remove this screenshot and its caption?",
                                          )
                                        )
                                          amendFinding(finding.id, {
                                            screenshots:
                                              finding.screenshots.filter(
                                                (s) => s.id !== shot.id,
                                              ),
                                          });
                                      }}
                                    >
                                      <Icon name="close" size={16} />
                                    </button>
                                  </div>
                                  <Field label={`Screenshot ${i + 1} caption`}>
                                    <textarea
                                      rows={2}
                                      value={shot.caption}
                                      maxLength={1000}
                                      placeholder="Explain what the image shows"
                                      onChange={(e) =>
                                        amendFinding(finding.id, {
                                          screenshots: finding.screenshots.map(
                                            (s) =>
                                              s.id === shot.id
                                                ? {
                                                    ...s,
                                                    caption: e.target.value,
                                                  }
                                                : s,
                                          ),
                                        })
                                      }
                                    />
                                  </Field>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="screenshot-empty">
                              <Icon name="image" size={23} />
                              <span>
                                No screenshots yet. Add evidence when it helps
                                tell the story.
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  ) : (
                    <div className="finding-editor-placeholder">
                      <span>
                        <Icon name="project" size={38} />
                      </span>
                      <h2>Select a finding to edit</h2>
                      <p>
                        Choose a finding from the list or add one.
                        <br />
                        Add evidence and a recommended fix for each issue.
                      </p>
                    </div>
                  )}
                </div>
                <div className="page-bottom">
                  <span>Finding order is reflected in the report.</span>
                  <button
                    className="button button-dark"
                    onClick={() => navigate("Action Plan")}
                  >
                    Next: Action Plan <Icon name="arrow" size={17} />
                  </button>
                </div>
              </>
            )}
            {section === "Action Plan" && (
              <div className="action-layout">
                <section className="panel">
                  <div className="panel-heading">
                    <span className="section-icon">
                      <Icon name="plan" />
                    </span>
                    <div>
                      <h2>Recommended next steps</h2>
                      <p>
                        {project.actionPlan.length} selected · Use arrows to set
                        the order.
                      </p>
                    </div>
                  </div>
                  <div className="panel-body">
                    <div className="inline-callout">
                      <Icon name="info" size={19} />
                      <span>
                        Choose findings below. Titles, fixes, priorities, and
                        effort stay in sync as you edit.
                      </span>
                    </div>
                    {project.actionPlan.length ? (
                      <ol className="action-list">
                        {orderedActions(project).map((f, i) => (
                          <li key={f.id}>
                            <div className="action-item-top">
                              <span className="action-number">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              <h3>{f.title || "Untitled finding"}</h3>
                              <Reorder
                                index={i}
                                total={project.actionPlan.length}
                                label={`action ${i + 1}`}
                                onMove={(direction) =>
                                  commit({
                                    ...project,
                                    actionPlan: move(
                                      project.actionPlan,
                                      i,
                                      direction,
                                    ),
                                  })
                                }
                              />
                              <button
                                className="icon-button"
                                aria-label={`Remove action ${i + 1}`}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      "Remove this next step? The finding will remain in your report.",
                                    )
                                  )
                                    commit({
                                      ...project,
                                      actionPlan: project.actionPlan.filter(
                                        (id) => id !== f.id,
                                      ),
                                    });
                                }}
                              >
                                <Icon name="close" size={16} />
                              </button>
                            </div>
                            <div className="action-meta">
                              <Priority value={f.priority} />
                              <span>{f.effort} effort</span>
                            </div>
                            <p>
                              {f.recommendation ||
                                "Add a recommended fix in the finding editor."}
                            </p>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div className="empty-state">
                        <Icon name="plan" size={32} />
                        <h3>No next steps selected</h3>
                        <p>
                          Select findings below to build a focused action plan.
                        </p>
                      </div>
                    )}
                    <div className="available-findings">
                      <h3>Choose findings for the action plan</h3>
                      {project.findings.length ? (
                        project.findings.map((f, i) => (
                          <label className="finding-checkbox" key={f.id}>
                            <input
                              type="checkbox"
                              checked={project.actionPlan.includes(f.id)}
                              onChange={(e) =>
                                commit({
                                  ...project,
                                  actionPlan: e.target.checked
                                    ? [...project.actionPlan, f.id]
                                    : project.actionPlan.filter(
                                        (id) => id !== f.id,
                                      ),
                                })
                              }
                            />
                            <span>
                              <strong>
                                {f.title || `Untitled finding ${i + 1}`}
                              </strong>
                              <small>
                                {f.category} · {f.effort} effort
                              </small>
                            </span>
                            <Priority value={f.priority} />
                          </label>
                        ))
                      ) : (
                        <p className="muted">
                          Add findings first, then choose the work you
                          recommend.
                        </p>
                      )}
                    </div>
                  </div>
                </section>
                <aside className="action-aside">
                  <div className="advice-card">
                    <span className="section-icon">
                      <Icon name="leaf" size={24} />
                    </span>
                    <p className="eyebrow">ORDERING TIPS</p>
                    <h2>Choose the work to do first</h2>
                    <p>
                      Put blockers first. Consider effort and dependencies when
                      you order the remaining work.
                    </p>
                    <p>
                      Your selection order becomes the action plan in the
                      report.
                    </p>
                  </div>
                  <button
                    className="button button-dark"
                    onClick={() => navigate("Preview")}
                  >
                    Preview report <Icon name="arrow" size={17} />
                  </button>
                </aside>
              </div>
            )}
          </div>
          <div
            className={`report-area ${section === "Preview" ? "is-visible" : ""}`}
          >
            <div className="preview-toolbar">
              <div>
                <span className="preview-dot" />
                <strong>Report preview</strong>
                <span>
                  {project.findings.length} findings ·{" "}
                  {project.actionPlan.length} next steps
                </span>
              </div>
              <label>
                Paper size{" "}
                <select
                  aria-label="Paper size"
                  value={project.paperSize}
                  onChange={(e) =>
                    commit({
                      ...project,
                      paperSize: e.target.value as Project["paperSize"],
                    })
                  }
                >
                  <option value="A4">A4</option>
                  <option value="Letter">US Letter</option>
                </select>
              </label>
            </div>
            <Report project={project} />
            <div className="print-guidance">
              <Icon name="print" size={22} />
              <div>
                <strong>Save a PDF copy</strong>
                <p>
                  Export PDF opens your browser’s print dialog. Choose Save as
                  PDF, {project.paperSize === "A4" ? "A4" : "US Letter"}, 100%
                  scale, and disable headers and footers. Page breaks appear in
                  print preview.
                </p>
                <p>
                  Download the project JSON separately to keep an editable copy.
                </p>
              </div>
              <button
                className="button button-dark"
                onClick={exportPDF}
                disabled={busy}
              >
                <Icon name="download" size={17} />
                Export PDF
              </button>
            </div>
          </div>
          <footer className="workspace-footer">
            <span>
              <Icon name="shield" size={14} />
              {draftStatus}
              <span className="footer-dot">·</span>Download a project file for a
              reliable backup.
            </span>
            <button
              className="text-button"
              onClick={loadExample}
              disabled={busy}
            >
              Open example project <Icon name="arrow" size={14} />
            </button>
          </footer>
        </main>
      </div>
      {help && (
        <Help
          onClose={() => setHelp(false)}
          onRestart={() => {
            setHelp(false);
            setGuided(true);
            navigate("Project");
          }}
        />
      )}
    </div>
  );
}
function Help({
  onClose,
  onRestart,
}: {
  onClose: () => void;
  onRestart: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="help-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="help-title"
    >
      <div className="help-dialog-inner">
        <div className="help-dialog-heading">
          <span className="eyebrow">USING WEB AUDIT KIT</span>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close help"
          >
            <Icon name="close" />
          </button>
        </div>
        <h2 id="help-title">Create and save a client report</h2>
        <ol>
          <li>
            <strong>Set up the report.</strong> Add project details, write a
            summary, and set your branding.
          </li>
          <li>
            <strong>Document the evidence.</strong> Add findings, optional
            screenshots, and a specific way to verify each fix.
          </li>
          <li>
            <strong>Choose what comes next.</strong> Select and order the
            findings in your action plan.
          </li>
          <li>
            <strong>Save your project.</strong> Save project downloads a JSON
            file with every field and image. Open project restores it. Choose
            the backup inside this app rather than double-clicking the JSON
            file.
          </li>
          <li>
            <strong>Export the report.</strong> Export PDF opens browser
            printing. Select Save as PDF, the matching paper size, 100% scale,
            and turn off headers and footers. Background graphics are optional.
          </li>
        </ol>
        <div className="inline-callout">
          <Icon name="shield" />
          <p>
            Everything stays in your browser. Local recovery is best effort and
            can be unavailable with file://, private browsing, or large
            projects. It never replaces downloading your project.
          </p>
        </div>
        <button className="button button-white" onClick={onRestart}>
          Restart guide
        </button>
        <button className="button button-dark" onClick={onClose}>
          Close help <Icon name="arrow" size={17} />
        </button>
      </div>
    </dialog>
  );
}
function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
