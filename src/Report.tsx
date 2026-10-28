import type { CSSProperties } from "react";
import {
  formatDate,
  orderedActions,
  type Project,
  type Finding,
} from "./model";
export function Priority({ value }: { value: Finding["priority"] }) {
  return (
    <span className={`priority priority-${value.toLowerCase()}`}>
      <span aria-hidden="true" />
      {value}
    </span>
  );
}
export function BrandMark({ project }: { project: Project }) {
  return project.branding.logo ? (
    <img
      className="report-logo"
      src={project.branding.logo.dataUrl}
      alt={`${project.details.auditor || "Auditor"} logo`}
    />
  ) : (
    <div className="report-wordmark">
      <span className="wordmark-symbol" aria-hidden="true">
        /
      </span>
      {project.details.auditor || "Independent website audit"}
    </div>
  );
}
export function Report({ project }: { project: Project }) {
  const { details: d, findings } = project;
  const actions = orderedActions(project);
  return (
    <article
      className="report-document"
      style={{ "--report-accent": project.branding.accent } as CSSProperties}
      aria-label="Client audit report"
    >
      <header className="report-cover">
        <div className="report-cover-top">
          <BrandMark project={project} />
          <span className="report-confidential">
            PREPARED FOR {d.client || "YOUR CLIENT"}
          </span>
        </div>
        <div className="report-kicker">WEBSITE AUDIT REPORT</div>
        <h1>{d.title || "Website audit report"}</h1>
        <p className="report-client">{d.client || "Client name"}</p>
        {d.website && <p className="report-url">{d.website}</p>}
        <div className="report-meta">
          <div>
            <span>AUDIT DATE</span>
            <p>{formatDate(d.date)}</p>
          </div>
          <div>
            <span>PREPARED BY</span>
            <p>{d.auditor || "Auditor name"}</p>
          </div>
        </div>
      </header>
      {project.demo && (
        <aside className="report-demo">
          <strong>Fictional demonstration content.</strong> The business,
          observations, and illustrative screenshots are fictional. No live
          website was tested.
        </aside>
      )}
      <section className="report-section">
        <div className="report-section-label">01 / EXECUTIVE SUMMARY</div>
        <h2>Executive summary</h2>
        <p className="prose">
          {d.summary || "No executive summary has been added."}
        </p>
      </section>
      <section className="report-section">
        <div className="report-section-label">02 / SCOPE</div>
        <h2>Scope & limitations</h2>
        <p className="prose">
          {d.scope || "No audit scope has been specified."}
        </p>
        <p className="report-note">
          This report records manually authored observations within the scope
          above. It is not an automated crawl, a comprehensive security
          assessment, or a certification of accessibility or legal compliance.
          Recommendations and effort estimates require review in the context of
          the actual implementation.
        </p>
      </section>
      <section className="report-section">
        <div className="report-section-label">03 / OVERVIEW</div>
        <h2>
          Findings overview{" "}
          <span className="report-count">{findings.length}</span>
        </h2>
        <div className="report-priority-key">
          <span>
            <strong>High</strong> · Address first
          </span>
          <span>
            <strong>Medium</strong> · Schedule next
          </span>
          <span>
            <strong>Low</strong> · Refine when possible
          </span>
        </div>
        {findings.length ? (
          <table className="overview-table">
            <thead>
              <tr>
                <th scope="col">Finding</th>
                <th scope="col">Priority</th>
                <th scope="col">Effort</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f, i) => (
                <tr key={f.id}>
                  <td>
                    <span className="table-index">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>
                      {f.title || "Untitled finding"}
                      <small>{f.category}</small>
                    </span>
                  </td>
                  <td>
                    <Priority value={f.priority} />
                  </td>
                  <td>{f.effort}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="report-note">
            No findings have been documented for this report.
          </p>
        )}
      </section>
      {findings.length > 0 && (
        <section className="report-section">
          <div className="report-section-label">04 / FINDINGS</div>
          <h2>Detailed findings</h2>
          {findings.map((f, i) => (
            <section className="report-finding" key={f.id}>
              <div className="finding-report-heading">
                <span className="finding-report-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="report-category">{f.category}</p>
                  <h3>{f.title || "Untitled finding"}</h3>
                </div>
              </div>
              <div className="finding-report-meta">
                <Priority value={f.priority} />
                <span>{f.effort} effort</span>
                {f.page && <span>{f.page}</span>}
              </div>
              {(
                [
                  "observation",
                  "impact",
                  "recommendation",
                  "verification",
                ] as const
              ).map((key) => (
                <div className="report-field" key={key}>
                  <h4>
                    {
                      {
                        observation: "What we found",
                        impact: "Why it matters",
                        recommendation: "Recommended fix",
                        verification: "How to verify",
                      }[key]
                    }
                  </h4>
                  <p className="prose">{f[key] || "Not specified."}</p>
                </div>
              ))}
              {f.screenshots.map((shot, j) => (
                <figure className="report-screenshot" key={shot.id}>
                  <img
                    src={shot.dataUrl}
                    width={shot.width}
                    height={shot.height}
                    alt={
                      shot.caption ||
                      `Evidence for finding ${i + 1}, screenshot ${j + 1}`
                    }
                  />
                  <figcaption>
                    {shot.caption || `Finding ${i + 1} · Screenshot ${j + 1}`}
                  </figcaption>
                </figure>
              ))}
            </section>
          ))}
        </section>
      )}
      <section className="report-section report-action-section">
        <div className="report-section-label">
          {findings.length ? "05" : "04"} / ACTION PLAN
        </div>
        <h2>Recommended action plan</h2>
        <p className="report-note">
          Suggested sequence, chosen by the auditor. Effort is a relative
          estimate, not a time or cost commitment.
        </p>
        {actions.length ? (
          actions.map((f, i) => (
            <section className="report-action" key={f.id}>
              <div className="report-action-header">
                <span className="action-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3>{f.title || "Untitled finding"}</h3>
              </div>
              <div className="finding-report-meta">
                <Priority value={f.priority} />
                <span>{f.effort} effort</span>
              </div>
              <p className="prose">
                {f.recommendation || "No suggested fix specified."}
              </p>
            </section>
          ))
        ) : (
          <p className="report-note">No next steps have been selected.</p>
        )}
      </section>
      <footer className="report-footer">
        <div>
          <p className="report-section-label">AUDITOR CONTACT</p>
          <h2>{d.auditor || "Your auditor"}</h2>
          <p className="prose">{d.contact || "No contact details provided."}</p>
        </div>
        <span>
          Prepared with
          <br />
          <strong>Web Audit Kit</strong>
        </span>
      </footer>
    </article>
  );
}
export function CoverPreview({ project }: { project: Project }) {
  return (
    <div
      className="mini-report"
      style={{ "--report-accent": project.branding.accent } as CSSProperties}
    >
      <BrandMark project={project} />
      <div className="mini-rule" />
      <p className="report-kicker">WEBSITE AUDIT REPORT</p>
      <h3>{project.details.title || "Website audit report"}</h3>
      <p className="mini-client">
        {project.details.client || "Your client’s business"}
      </p>
      <p className="mini-url">
        {project.details.website || "their-website.com"}
      </p>
      <div className="mini-bottom">
        <span>
          PREPARED BY
          <strong>{project.details.auditor || "Your name / studio"}</strong>
        </span>
        <span>{formatDate(project.details.date)}</span>
      </div>
    </div>
  );
}
