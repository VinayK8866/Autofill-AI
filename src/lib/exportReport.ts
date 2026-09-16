export interface TestRunField {
  id: string;
  label: string;
  name?: string;
  type: string;
  value: string | boolean;
}

export interface TestRunReportData {
  url: string;
  title: string;
  timestamp: string;
  persona: string;
  provider: string;
  qaFlavor?: string;
  fields: TestRunField[];
}

/**
 * Generates a clean, GitHub/Jira/Linear-ready Markdown bug report.
 */
export function generateReportMarkdown(data: TestRunReportData): string {
  const fieldsTable = data.fields
    .map((f, i) => {
      const cleanVal = typeof f.value === 'string' 
        ? f.value.replace(/\|/g, '\\|').replace(/\n/g, ' ') 
        : String(f.value);
      const cleanLabel = (f.label || f.name || f.id).replace(/\|/g, '\\|');
      const cleanName = (f.name || f.id).replace(/\|/g, '\\|');
      return `| ${i + 1} | ${cleanLabel} | \`${cleanName}\` | \`${f.type}\` | \`${cleanVal.slice(0, 100)}${cleanVal.length > 100 ? '...' : ''}\` |`;
    })
    .join('\n');

  return `### 🧪 Filli AI Test Run & Form Data Report

- **Page URL:** ${data.url}
- **Page Title:** ${data.title || 'N/A'}
- **Run Timestamp:** ${data.timestamp}
- **Persona:** \`${data.persona}\`${data.qaFlavor ? ` (QA Mode: \`${data.qaFlavor}\`)` : ''}
- **Engine Provider:** \`${data.provider}\`
- **Total Injected Fields:** ${data.fields.length}

| # | Field Label | Identifier | Type | Injected Value |
|---|-------------|------------|------|----------------|
${fieldsTable}

> *Generated automatically with [Filli AI Form Filler & SDET QA Generator](https://chromewebstore.google.com/detail/filli-ai-ai-form-filler-q/hgegjecojocbaajhpphckaphclpdkbhl)*
`;
}

/**
 * Generates CSV string for spreadsheets (Excel / Google Sheets).
 */
export function generateReportCSV(data: TestRunReportData): string {
  const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;
  
  const headers = ['Index', 'Field Label', 'Field Identifier', 'Field Type', 'Injected Value'];
  const rows = data.fields.map((f, i) => [
    String(i + 1),
    escapeCsv(f.label || f.name || f.id),
    escapeCsv(f.name || f.id),
    escapeCsv(f.type),
    escapeCsv(String(f.value))
  ].join(','));

  return [
    `# Filli AI Test Run Report - ${data.timestamp}`,
    `# URL: ${data.url}`,
    headers.join(','),
    ...rows
  ].join('\n');
}

/**
 * Generates formatted JSON data for programmatic pipelines.
 */
export function generateReportJSON(data: TestRunReportData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Downloads a test run report file to the user's computer.
 */
export function downloadReportFile(content: string, filename: string, mimeType = 'text/markdown;charset=utf-8;'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Copies markdown report to system clipboard.
 */
export async function copyReportToClipboard(markdown: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(markdown);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Failed to copy report to clipboard:', err);
    return false;
  }
}
