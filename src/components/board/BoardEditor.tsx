import { useRef, useState } from 'react';
import { ACCENT_OPTIONS, CTA_OPTIONS, PATTERN_RANGE } from '../../domain/board';
import type { BoardSpec, LandscapePosition, MarkMode, VerticalPosition } from '../../domain/types';
import { useStore } from '../../store/useStore';
import { Button, Card, Pill, SelectField, TextField } from '../ui/Primitives';
import { readBoardImage } from './files';

const MARKS: Array<{ value: MarkMode; label: string }> = [
  { value: 'monogram', label: 'Monogram' },
  { value: 'logo', label: 'Your image' },
  { value: 'board-image', label: 'Whole board' },
];

const LANDSCAPE: Array<{ value: LandscapePosition; label: string }> = [
  { value: 'lower-left', label: 'Lower left' },
  { value: 'upper-left', label: 'Upper left' },
  { value: 'lower-right', label: 'Lower right' },
];

const VERTICAL: Array<{ value: VerticalPosition; label: string }> = [
  { value: 'middle-left', label: 'Above the buttons' },
  { value: 'upper-left', label: 'Under the top bar' },
  { value: 'bottom', label: 'Bottom (under the caption)' },
];

/** A row of mutually exclusive choices. */
export function Segmented<T extends string>(props: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return (
    <div className="field">
      <span className="lbl">{props.label}</span>
      <div className="segmented" role="group" aria-label={props.label}>
        {props.options.map((o) => (
          <button key={o.value} type="button" aria-pressed={o.value === props.value} onClick={() => props.onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Upload, replace or remove the creator's image. It is downscaled and kept in the workspace. */
function ImageUpload({ board }: { board: BoardSpec }) {
  const setBoard = useStore((s) => s.setBoard);
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState('');
  const upload = (file: File) =>
    void readBoardImage(file, board.mark === 'board-image' ? 1000 : 480).then((result) => {
      if (result.ok) setBoard({ image: result.image, imageAspect: result.aspect });
      setProblem(result.ok ? '' : result.message);
    });
  return (
    <div className="upload">
      <div className="row" style={{ gap: 6 }}>
        <Button onClick={() => input.current?.click()}>{board.image ? 'Replace image' : 'Upload image'}</Button>
        {board.image && (
          <Button variant="ghost" onClick={() => setBoard({ image: '', imageAspect: 0 })}>
            Remove image
          </Button>
        )}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
      <span className="hint">
        PNG, JPEG, WebP or SVG. A transparent background sits best. It sits beside the preview label and the link, and
        cannot replace them.
      </span>
      {problem && <Pill tone="bad">{problem}</Pill>}
    </div>
  );
}

/** The mark: a monogram, or the creator's own image. */
function MarkFields({ board }: { board: BoardSpec }) {
  const setBoard = useStore((s) => s.setBoard);
  return (
    <>
      <Segmented label="Visible mark" value={board.mark} options={MARKS} onChange={(mark) => setBoard({ mark })} />
      {board.mark === 'monogram' ? (
        <TextField label="Monogram" value={board.monogram} placeholder="Your initials"
          onChange={(monogram) => setBoard({ monogram: monogram.slice(0, 3) })} hint="Up to three characters. Blank uses your name's initials." />
      ) : (
        <ImageUpload board={board} />
      )}
    </>
  );
}

/** What the board says, and where it points. */
function WordingFields({ board, fallbackHandle }: { board: BoardSpec; fallbackHandle: string }) {
  const setBoard = useStore((s) => s.setBoard);
  return (
    <>
      <TextField label="Handle" value={board.handle} placeholder={fallbackHandle || '@yourhandle'} onChange={(handle) => setBoard({ handle })} />
      <SelectField label="Call to action" value={board.cta} options={CTA_OPTIONS.map((c) => ({ value: c, label: c }))} onChange={(cta) => setBoard({ cta })} />
      <TextField label="Link to the listing" value={board.linkBase} placeholder="yoursite.com/m/" onChange={(linkBase) => setBoard({ linkBase })}
        hint="Your own domain. Each moment's id is added to the end. The link is baked into the pixels, so it has to outlive any host you might leave." />
      <label className="check">
        <input type="checkbox" checked={board.showQr} onChange={(e) => setBoard({ showQr: e.target.checked })} />
        <span>Add a QR code for the link</span>
      </label>
    </>
  );
}

/** Where the board sits, its accent, and the strength of the pattern. */
function LookFields({ board }: { board: BoardSpec }) {
  const setBoard = useStore((s) => s.setBoard);
  return (
    <>
      <Segmented label="Position on 16:9" value={board.landscape} options={LANDSCAPE} onChange={(landscape) => setBoard({ landscape })} />
      <SelectField label="Position on 9:16" value={board.vertical} options={VERTICAL} onChange={(vertical) => setBoard({ vertical })} />
      <div className="field">
        <span className="lbl">Accent</span>
        <div className="row" style={{ gap: 8 }}>
          {ACCENT_OPTIONS.map((c) => (
            <button key={c} type="button" className="swatch" aria-label={`Accent ${c}`} aria-pressed={board.accent === c}
              style={{ background: c }} onClick={() => setBoard({ accent: c })} />
          ))}
          <input type="color" aria-label="Custom accent" value={board.accent} onChange={(e) => setBoard({ accent: e.target.value })} className="swatch-custom" />
        </div>
      </div>
      <label className="field">
        <span className="lbl">Pattern strength</span>
        <input type="range" min={PATTERN_RANGE.min} max={PATTERN_RANGE.max} step={0.02} value={board.pattern}
          onChange={(e) => setBoard({ pattern: Number(e.target.value) })} />
        <span className="hint">It deters lifting the preview. It cannot prevent it, and it never goes to zero.</span>
      </label>
    </>
  );
}

/** The board's settings, laid out as on the design canvas. */
export function BoardEditor({ board, fallbackHandle }: { board: BoardSpec; fallbackHandle: string }) {
  return (
    <Card title="Shop board" subtitle="The visible mark on every preview. The design is yours; on public previews the tool always adds the preview label and the link.">
      <MarkFields board={board} />
      <WordingFields board={board} fallbackHandle={fallbackHandle} />
      <LookFields board={board} />
    </Card>
  );
}
