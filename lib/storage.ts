// LocalStorage persistence for session state and saved templates

const SESSION_KEY = 'cps-clauses-session';
const TEMPLATES_KEY = 'cps-clauses-templates';

export interface SessionState {
  selected: Record<string, { clauseId: string; fieldValues: Record<number, string> }>;
  globalDate: string;
  globalAmount: string;
  dateOverrides: string[];   // serialized Set keys
  amountOverrides: string[]; // serialized Set keys
}

export interface Template {
  id: string;
  name: string;
  clauseIds: string[];
  builtIn?: boolean;
}

// ── Session persistence ──────────────────────────────────────────

export function saveSession(state: SessionState): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch { /* quota exceeded — silently ignore */ }
}

export function loadSession(): SessionState | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionState;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
}

// ── Template persistence ─────────────────────────────────────────

export function loadTemplates(): Template[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Template[];
  } catch {
    return [];
  }
}

export function saveTemplate(template: Template): void {
  const templates = loadTemplates().filter(t => t.id !== template.id);
  templates.push(template);
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  } catch { /* ignore */ }
}

export function deleteTemplate(id: string): void {
  const templates = loadTemplates().filter(t => t.id !== id);
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  } catch { /* ignore */ }
}
