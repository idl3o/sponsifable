import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Overlay } from './Overlay';
import './overlay.css';

const dealId = new URLSearchParams(window.location.search).get('deal') ?? '';
const root = document.getElementById('overlay');
if (root && dealId) {
  createRoot(root).render(
    <StrictMode>
      <Overlay dealId={dealId} fetcher={window.fetch.bind(window)} />
    </StrictMode>,
  );
}
