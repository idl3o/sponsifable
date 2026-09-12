import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startSync, type SyncEnv } from './store/sync';
import { useStore } from './store/useStore';
import './styles/app.css';

/** Coming back to the tab is when a seal made in the terminal should show up. */
function onReturn(callback: () => void): () => void {
  const visible = () => {
    if (document.visibilityState === 'visible') callback();
  };
  window.addEventListener('focus', callback);
  document.addEventListener('visibilitychange', visible);
  return () => {
    window.removeEventListener('focus', callback);
    document.removeEventListener('visibilitychange', visible);
  };
}

function browserStorage(): SyncEnv['storage'] {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

startSync(useStore, { fetch: window.fetch.bind(window), onReturn, storage: browserStorage() });

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><App /></StrictMode>);
