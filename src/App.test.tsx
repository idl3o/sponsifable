import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { useStore } from './store/useStore';

/**
 * Smoke tests: every tab mounts, and the numbers a creator acts on actually
 * appear. These do not assert on layout, only that nothing throws and the
 * derived values reach the screen.
 */

const TABS = ['Profile', 'Rate card', 'Media kit', 'Prospects', 'Outreach', 'Deals', 'Shop board'];

beforeEach(() => {
  useStore.getState().resetToSample();
  useStore.getState().setTab('rate-card');
  // jsdom implements neither of these.
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  window.print = vi.fn();
  // jsdom has no 2D canvas; the board falls back to estimated text widths and skips drawing.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('mounts every tab without throwing', () => {
    render(<App />);
    for (const label of TABS) {
      fireEvent.click(screen.getByRole('tab', { name: label }));
      expect(screen.getByRole('tab', { name: label })).toHaveProperty('ariaSelected', 'true');
    }
  });

  it('shows a priced placement on the rate card', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Rate card' }));
    expect(screen.getByText('Top placement')).toBeTruthy();
    expect(screen.getAllByText(/^£[\d,]+$/).length).toBeGreaterThan(0);
  });

  it('reprices every line when usage rights change', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Rate card' }));
    const before = screen.getByText('Top placement').parentElement?.textContent ?? '';

    const select = screen.getByLabelText(/Usage rights/i);
    fireEvent.change(select, { target: { value: 'full-buyout' } });

    const after = screen.getByText('Top placement').parentElement?.textContent ?? '';
    expect(after).not.toEqual(before);
  });

  it('ranks prospects and puts the weakest last', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Prospects' }));
    const names = screen.getAllByText(/Linear|Hetzner|Glossier/).map((n) => n.textContent);
    expect(names[names.length - 1]).toBe('Glossier');
  });

  it('composes a pitch naming the brand and a price', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Outreach' }));
    const email = document.querySelector('.email');
    expect(email?.textContent).toContain('£');
    expect(email?.textContent).toContain('Ada Trelawny');
  });

  it('warns about a profile with no recorded results', () => {
    useStore.getState().updateProfile({ proofPoints: [] });
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Media kit' }));
    expect(screen.getByText(/No past results recorded/i)).toBeTruthy();
  });

  it('adds and removes a channel from the profile', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Profile' }));
    const before = useStore.getState().profile.channels.length;

    fireEvent.click(screen.getByRole('button', { name: 'TikTok' }));
    expect(useStore.getState().profile.channels).toHaveLength(before + 1);

    const removes = screen.getAllByRole('button', { name: 'Remove' });
    const last = removes[removes.length - 1];
    if (last) fireEvent.click(last);
    expect(useStore.getState().profile.channels).toHaveLength(before);
  });

  it('records a won deal and closes its prospect', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Deals' }));
    fireEvent.change(screen.getByLabelText(/Agreed, GBP/i), { target: { value: '2400' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record' }));

    const [deal] = useStore.getState().deals;
    expect(deal?.agreed).toBe(2400);
    const prospect = useStore.getState().prospects.find((p) => p.id === deal?.prospectId);
    expect(prospect?.stage).toBe('won');
    expect(screen.getByText(/agreed a median of/i)).toBeTruthy();
  });

  it('edits the shop board and checks it live', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Shop board' }));
    expect(screen.getByText('No link yet')).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Link to the listing/i), { target: { value: 'kernow.build/m/' } });
    expect(useStore.getState().board.linkBase).toBe('kernow.build/m/');
    expect(screen.getByText('Your own domain')).toBeTruthy();

    expect(screen.getByText('Clear of vertical app UI')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Position on 9:16/i), { target: { value: 'bottom' } });
    expect(screen.getByText("Under the app's UI in 9:16")).toBeTruthy();
  });

  it('switches the mark to an uploaded image and says it cannot judge it', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Shop board' }));
    fireEvent.click(screen.getByRole('button', { name: 'Your image' }));
    expect(useStore.getState().board.mark).toBe('logo');
    expect(screen.getByRole('button', { name: 'Upload image' })).toBeTruthy();
    expect(screen.getByText('No image uploaded')).toBeTruthy();
  });

  it('refuses an invalid import, says why, and keeps the workspace', async () => {
    render(<App />);
    const before = useStore.getState().profile;
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([JSON.stringify({ profile: { niche: 'astrology' }, prospects: [] })], 'bad.json');
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/Not imported: profile.niche/)).toBeTruthy();
    expect(useStore.getState().profile).toBe(before);
  });

  it('upgrades a first-release save without losing it', async () => {
    const { profile, terms, prospects } = useStore.getState();
    const old = { ...profile, name: 'Saved Before Deals Existed' };
    localStorage.setItem(
      'sponsorable-v1',
      JSON.stringify({ state: { profile: old, terms, prospects, seq: 140 }, version: 0 }),
    );
    await useStore.persist.rehydrate();

    expect(useStore.getState().profile.name).toBe('Saved Before Deals Existed');
    expect(useStore.getState().deals).toEqual([]);
    expect(useStore.getState().seq).toBe(140);
  });

  it('sets an unreadable save aside instead of discarding it', async () => {
    const corrupt = { state: { profile: { niche: 'astrology' }, prospects: [] }, version: 0 };
    localStorage.setItem('sponsorable-v1', JSON.stringify(corrupt));
    await useStore.persist.rehydrate();

    expect(localStorage.getItem('sponsorable-unreadable-v0')).toContain('astrology');
    expect(useStore.getState().profile.niche).not.toBe('astrology');
  });

  it('generates ids without randomness, so two adds are predictable', () => {
    const { addChannel } = useStore.getState();
    const seqBefore = useStore.getState().seq;
    addChannel('tiktok');
    addChannel('x');
    const ids = useStore.getState().profile.channels.slice(-2).map((c) => c.id);
    expect(ids).toEqual([`ch-${seqBefore + 1}`, `ch-${seqBefore + 2}`]);
  });
});
