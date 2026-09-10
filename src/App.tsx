import { useMemo, useRef, useState } from 'react';
import { DealsView } from './components/DealsView';
import { MediaKitView } from './components/MediaKitView';
import { OutreachView } from './components/OutreachView';
import { ProfileView } from './components/ProfileView';
import { ProspectsView } from './components/ProspectsView';
import { RateCardView } from './components/RateCardView';
import { Button, Pill } from './components/ui/Primitives';
import { WORKSPACE_VERSION, parseWorkspace } from './domain/workspace';
import type { Tab } from './store/useStore';
import { useStore } from './store/useStore';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'profile', label: 'Profile' },
  { id: 'rate-card', label: 'Rate card' },
  { id: 'media-kit', label: 'Media kit' },
  { id: 'prospects', label: 'Prospects' },
  { id: 'outreach', label: 'Outreach' },
  { id: 'deals', label: 'Deals' },
];

/** Today as an ISO date, read once so the domain layer stays pure. */
function useToday(): string {
  return useMemo(() => new Date().toISOString().slice(0, 10), []);
}

/** Export and import the whole workspace as a JSON file. */
function DataControls() {
  const fileRef = useRef<HTMLInputElement>(null);
  const profile = useStore((s) => s.profile);
  const terms = useStore((s) => s.terms);
  const prospects = useStore((s) => s.prospects);
  const deals = useStore((s) => s.deals);
  const importAll = useStore((s) => s.importAll);
  const [problem, setProblem] = useState<string | null>(null);

  const download = () => {
    const workspace = { version: WORKSPACE_VERSION, profile, terms, prospects, deals };
    const blob = new Blob([JSON.stringify(workspace, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'sponsorable.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  // A file that fails validation leaves the current workspace untouched and
  // says why, rather than loading half of it.
  const upload = (file: File) => {
    void file.text().then((text) => {
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        setProblem('That file is not valid JSON.');
        return;
      }
      const parsed = parseWorkspace(data);
      if (parsed.ok) {
        importAll(parsed.workspace);
        setProblem(null);
      } else {
        setProblem(`Not imported: ${parsed.error}.`);
      }
    });
  };

  return (
    <div className="row no-print" style={{ gap: 6 }}>
      {problem && <Pill tone="bad">{problem}</Pill>}
      <Button onClick={download} title="Save everything to a file">
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
      </main>
    </div>
  );
}
