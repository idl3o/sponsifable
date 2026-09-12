import { useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { BoardView } from './components/board/BoardView';
import { DealsView } from './components/DealsView';
import { MediaKitView } from './components/MediaKitView';
import { OutreachView } from './components/OutreachView';
import { ProfileView } from './components/ProfileView';
import { ProspectsView } from './components/ProspectsView';
import { RateCardView } from './components/RateCardView';
import { Button, Pill } from './components/ui/Primitives';
import { WORKSPACE_VERSION, parseWorkspace, type Workspace } from './domain/workspace';
import type { Tab } from './store/useStore';
import { useStore } from './store/useStore';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'profile', label: 'Profile' },
  { id: 'rate-card', label: 'Rate card' },
  { id: 'media-kit', label: 'Media kit' },
  { id: 'prospects', label: 'Prospects' },
  { id: 'outreach', label: 'Outreach' },
  { id: 'deals', label: 'Deals' },
  { id: 'board', label: 'Shop board' },
];

/** Today as an ISO date, read once so the domain layer stays pure. */
function useToday(): string {
  return useMemo(() => new Date().toISOString().slice(0, 10), []);
}

/** Offer data to the browser as a file download. */
function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** A workspace file, read and checked: the workspace, or the sentence saying why not. */
type Upload = { ok: true; workspace: Workspace } | { ok: false; message: string };

/**
 * Read and validate a workspace file. A file that fails validation is refused
 * whole, with the reason, rather than loaded in part.
 */
async function readWorkspaceFile(file: File): Promise<Upload> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return { ok: false, message: 'That file is not valid JSON.' };
  }
  const parsed = parseWorkspace(data);
  return parsed.ok ? parsed : { ok: false, message: `Not imported: ${parsed.error}.` };
}

/** Export and import the whole workspace as a JSON file. */
function DataControls() {
  const fileRef = useRef<HTMLInputElement>(null);
  const workspace = useStore(
    useShallow((s) => ({ profile: s.profile, terms: s.terms, prospects: s.prospects, deals: s.deals, board: s.board })),
  );
  const importAll = useStore((s) => s.importAll);
  const [problem, setProblem] = useState<string | null>(null);

  const upload = (file: File) =>
    void readWorkspaceFile(file).then((result) => {
      if (result.ok) importAll(result.workspace);
      setProblem(result.ok ? null : result.message);
    });

  return (
    <div className="row no-print" style={{ gap: 6 }}>
      {problem && <Pill tone="bad">{problem}</Pill>}
      <Button
        onClick={() => downloadJson('sponsorable.json', { version: WORKSPACE_VERSION, ...workspace })}
        title="Save everything to a file"
      >
        Export
      </Button>
      <Button onClick={() => fileRef.current?.click()}>Import</Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/** The whole application: the tab bar, the workspace controls and the open view. */
export function App() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const today = useToday();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          Sponsorable
          <span>price it, prove it, pitch it</span>
        </div>

        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              className="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <DataControls />
      </header>

      <main>
        {tab === 'profile' && <ProfileView />}
        {tab === 'rate-card' && <RateCardView />}
        {tab === 'media-kit' && <MediaKitView />}
        {tab === 'prospects' && <ProspectsView today={today} />}
        {tab === 'outreach' && <OutreachView today={today} />}
        {tab === 'deals' && <DealsView today={today} />}
        {tab === 'board' && <BoardView />}
      </main>
    </div>
  );
}
