// LexisGaze — mock corpus of internal documents.
// Each document carries: id, title, folder, tags, content (for term-frequency
// relevance scoring), a checksum (unique ID for integrity checks), the upload
// order, and an array of cited document ids (edges of the citation graph).

export const SERVER_COUNT = 3;

// Simple deterministic checksum so the File Integrity Checker has something
// real to verify against (DJB2 hash).
export function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
  }
  // force unsigned 32-bit and render as hex
  return (h >>> 0).toString(16).padStart(8, "0");
}

const raw = [
  {
    id: "D01",
    title: "Data Retention Policy 2026",
    folder: "Compliance",
    tags: ["policy", "compliance", "retention"],
    content:
      "This policy defines data retention periods. Retention of records must follow the retention schedule. Compliance teams audit retention annually. Policy review is mandatory.",
    cites: ["D02", "D07"],
  },
  {
    id: "D02",
    title: "GDPR Compliance Checklist",
    folder: "Compliance",
    tags: ["compliance", "gdpr", "privacy"],
    content:
      "GDPR compliance requires lawful processing. Privacy by design is a core principle. Compliance officers track consent. GDPR penalties are significant for non-compliance.",
    cites: ["D03"],
  },
  {
    id: "D03",
    title: "Privacy Impact Assessment Template",
    folder: "Compliance",
    tags: ["privacy", "template", "assessment"],
    content:
      "A privacy impact assessment evaluates risk. The assessment template guides reviewers. Privacy risk scoring is documented. Assessment results feed the privacy register.",
    cites: ["D02"],
  },
  {
    id: "D04",
    title: "Onboarding Engineering Handbook",
    folder: "Engineering",
    tags: ["onboarding", "engineering", "handbook"],
    content:
      "New engineers read this engineering handbook. Onboarding covers tooling, code review, and deployment. The handbook links to the deployment runbook for engineering setup.",
    cites: ["D05", "D06"],
  },
  {
    id: "D05",
    title: "Deployment Runbook",
    folder: "Engineering",
    tags: ["deployment", "engineering", "runbook"],
    content:
      "The deployment runbook lists rollout steps. Deployment uses blue-green strategy. Rollback procedures are defined. Deployment monitoring alerts on errors during deployment.",
    cites: ["D06"],
  },
  {
    id: "D06",
    title: "Incident Response Plan",
    folder: "Engineering",
    tags: ["incident", "engineering", "security"],
    content:
      "The incident response plan defines severity levels. Incident commanders coordinate response. Security incidents escalate immediately. Post-incident review captures lessons.",
    cites: ["D07"],
  },
  {
    id: "D07",
    title: "Security Access Controls",
    folder: "Security",
    tags: ["security", "access", "policy"],
    content:
      "Access controls enforce least privilege. Security reviews access quarterly. Role based access control limits scope. Access logs are retained for security audits.",
    cites: ["D01"],
  },
  {
    id: "D08",
    title: "Q1 Sales Playbook",
    folder: "Sales",
    tags: ["sales", "playbook", "revenue"],
    content:
      "The sales playbook outlines the pitch. Sales reps qualify leads. Revenue targets are set quarterly. The playbook covers objection handling for sales calls.",
    cites: ["D09"],
  },
  {
    id: "D09",
    title: "Pricing Strategy Brief",
    folder: "Sales",
    tags: ["pricing", "sales", "strategy"],
    content:
      "Pricing strategy balances value and cost. Sales uses tiered pricing. The pricing brief defines discount limits. Strategy review aligns pricing with revenue goals.",
    cites: [],
  },
  {
    id: "D10",
    title: "Customer Support SLA",
    folder: "Support",
    tags: ["support", "sla", "customer"],
    content:
      "The support SLA defines response times. Customer support tiers escalate complex issues. SLA breaches trigger review. Support metrics track customer satisfaction.",
    cites: ["D06"],
  },
];

// Assign upload order (the order they "arrived" for the Background Indexer queue)
// and compute a checksum over the content for the Integrity Checker.
export const DOCUMENTS = raw.map((d, i) => ({
  ...d,
  uploadOrder: i + 1,
  checksum: djb2(d.id + d.content),
}));

export const DOC_MAP = Object.fromEntries(DOCUMENTS.map((d) => [d.id, d]));
