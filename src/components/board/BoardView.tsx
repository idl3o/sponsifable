import { useEffect, useMemo, useRef, useState } from 'react';
import { boardText, layoutBoard, qrMatrix, type Aspect, type Audience, type BoardLayout, type BoardText } from '../../domain/board';
import { checkBoard, type BoardCheck } from '../../domain/boardChecks';
import type { BoardSpec } from '../../domain/types';
import { useStore } from '../../store/useStore';
import { Button, Card, Pill, TextField } from '../ui/Primitives';
import { BoardEditor, Segmented } from './BoardEditor';
import { downloadCanvas, loadImage } from './files';
import { makeMeasure, renderBoard, type BoardImages } from './render';

/** An image decoded from a data URL, or null while loading or when there is none. */
function useImage(src: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let live = true;
    void loadImage(src).then((loaded) => live && setImage(loaded));
    return () => {
      live = false;
    };
  }, [src]);
  return image;
}

/** One preview canvas, redrawn whenever the board or its images change. */
function PreviewCanvas({ spec, text, aspect, images }: { spec: BoardSpec; text: BoardText; aspect: Aspect; images: BoardImages }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvas.current) renderBoard(canvas.current, spec, text, aspect, images, true);
  }, [spec, text, aspect, images]);
  return <canvas ref={canvas} className={`board-canvas ${aspect}`} aria-label={`${aspect === 'landscape' ? '16:9' : '9:16'} preview`} />;
}

/** Preview settings that are not part of the saved board. */
interface PreviewSettings {
  audience: 'public' | 'sponsor';
  sponsor: string;
  momentId: string;
}

/** Who the preview is for, which moment it points at, and an optional frame to try it on. */
function PreviewControls(props: { settings: PreviewSettings; onChange: (s: PreviewSettings) => void; onFrame: (src: string) => void; hasFrame: boolean }) {
  const { settings, onChange } = props;
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="grid cols-3" style={{ alignItems: 'end' }}>
      <Segmented label="Preview for" value={settings.audience}
        options={[{ value: 'public', label: 'Public shop' }, { value: 'sponsor', label: 'One sponsor' }]}
        onChange={(audience) => onChange({ ...settings, audience })} />
      {settings.audience === 'sponsor' ? (
        <TextField label="Sponsor" value={settings.sponsor} placeholder="Brand name" onChange={(sponsor) => onChange({ ...settings, sponsor })} />
      ) : (
        <TextField label="Moment id" value={settings.momentId} onChange={(momentId) => onChange({ ...settings, momentId })} />
      )}
      <div className="row" style={{ gap: 6 }}>
        <Button onClick={() => input.current?.click()}>Try on your own frame</Button>
        {props.hasFrame && <Button variant="ghost" onClick={() => props.onFrame('')}>Clear</Button>}
        <input ref={input} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) props.onFrame(URL.createObjectURL(f)); e.target.value = ''; }} />
      </div>
    </div>
  );
}

/** The editor's checks, problems first. */
function ChecksCard({ checks }: { checks: BoardCheck[] }) {
  return (
    <Card title="Checks" tight>
      {checks.map((c) => (
        <div key={c.id} className="board-check">
          <Pill tone={c.tone}>{c.label}</Pill>
          <span className="note">{c.note}</span>
        </div>
      ))}
    </Card>
  );
}

/** Save the board as transparent overlays, one per aspect. */
function ExportCard({ spec, text, mark, momentId }: { spec: BoardSpec; text: BoardText; mark: HTMLImageElement | null; momentId: string }) {
  const save = (aspect: Aspect) => {
    const canvas = document.createElement('canvas');
    if (renderBoard(canvas, spec, text, aspect, { mark, frame: null }, false)) {
      downloadCanvas(canvas, `board-${aspect}-${momentId || 'preview'}.png`);
    }
  };
  return (
    <Card title="Export" tight>
      <p className="note" style={{ marginTop: 0 }}>
        A transparent PNG holding the pattern and the board, at the preview's full size. Lay it over the clip in any
        editor, or add it to OBS as an image. Nothing leaves this machine.
      </p>
      <div className="row" style={{ gap: 6 }}>
        <Button variant="primary" onClick={() => save('landscape')}>Save 16:9 overlay</Button>
        <Button onClick={() => save('vertical')}>Save 9:16 overlay</Button>
      </div>
    </Card>
  );
}

/** Everything the board needs for the current preview settings: its words, layouts and checks. */
function useBoardModel(spec: BoardSpec, settings: PreviewSettings) {
  const profile = useStore((s) => s.profile);
  return useMemo(() => {
    const audience: Audience = settings.audience === 'sponsor' ? { kind: 'sponsor', sponsor: settings.sponsor } : { kind: 'public' };
    const text = boardText(spec, profile, audience, settings.momentId);
    const measure = makeMeasure();
    const layouts: Record<Aspect, BoardLayout> = {
      landscape: layoutBoard(spec, text, 'landscape', measure),
      vertical: layoutBoard(spec, text, 'vertical', measure),
    };
    const modules = text.link && spec.showQr ? qrMatrix(text.link).length : null;
    return { text, checks: checkBoard(spec, text, layouts, modules), fallbackHandle: profile.channels[0]?.handle ?? '' };
  }, [spec, profile, settings]);
}

/** The shop board: the creator's visible mark on clip previews, edited live on both frames. */
export function BoardView() {
  const board = useStore((s) => s.board);
  const [settings, setSettings] = useState<PreviewSettings>({ audience: 'public', sponsor: '', momentId: '1432' });
  const [frameSrc, setFrameSrc] = useState('');
  useEffect(() => () => void (frameSrc.startsWith('blob:') && URL.revokeObjectURL(frameSrc)), [frameSrc]);
  const mark = useImage(board.image);
  const frame = useImage(frameSrc);
  const images = useMemo(() => ({ mark, frame }), [mark, frame]);
  const { text, checks, fallbackHandle } = useBoardModel(board, settings);

  return (
    <>
      <h1>Shop board</h1>
      <p className="lede">
        The board every preview carries: it advertises your shop window and deters anyone lifting the clip. A licensed
        copy goes out clean, with only the invisible serial.
      </p>
      <div className="split">
        <div className="stack">
          <PreviewControls settings={settings} onChange={setSettings} onFrame={setFrameSrc} hasFrame={Boolean(frameSrc)} />
          <div className="board-previews">
            <PreviewCanvas spec={board} text={text} aspect="landscape" images={images} />
            <PreviewCanvas spec={board} text={text} aspect="vertical" images={images} />
          </div>
          <ExportCard spec={board} text={text} mark={mark} momentId={settings.momentId} />
        </div>
        <div className="stack">
          <BoardEditor board={board} fallbackHandle={fallbackHandle} />
          <ChecksCard checks={checks} />
        </div>
      </div>
    </>
  );
}
