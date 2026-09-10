import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { useStore } from './store/useStore';

/**
 * Smoke tests: every tab mounts, and the numbers a creator acts on actually
 * appear. These do not assert on layout, only that nothing throws and the
 * derived values reach the screen.
 */

const TABS = ['Profile', 'Rate card', 'Media kit', 'Prospects', 'Outreach'];

beforeEach(() => {
  useStore.getState().resetToSample();
  useStore.getState().setTab('rate-card');
  // jsdom implements neither of these.
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  window.print = vi.fn();
});

afterEach(() => {
  cleanup();
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

  it('generates ids without randomness, so two adds are predictable', () => {
    const { addChannel } = useStore.getState();
    const seqBefore = useStore.getState().seq;
    addChannel('tiktok');
    addChannel('x');
    const ids = useStore.getState().profile.channels.slice(-2).map((c) => c.id);
    expect(ids).toEqual([`ch-${seqBefore + 1}`, `ch-${seqBefore + 2}`]);
  });
});
