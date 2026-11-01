import { useEffect, useMemo, useState } from 'react';
import { saveFinishPhoto } from '../materials/finishLibrary';
import { type FinishPhoto, processPhotoFile } from '../materials/importPhoto';
import type { Finish } from '../specs/finishes';
import { useDoc } from '../state/docStore';
import { Field, LengthInput, Segmented } from './controls';

/**
 * Import a photo of a physical Naturi sample: crop the centre square, make it tile seamlessly,
 * derive relief/roughness maps, and use it for this finish on this device.
 */
export function PhotoImportDialog({ finish, onClose }: { finish: Finish; onClose: () => void }) {
  const units = useDoc().units;
  const [file, setFile] = useState<File | null>(null);
  const [sampleWidth, setSampleWidth] = useState(0.3);
  const [size, setSize] = useState<'2048' | '4096'>('4096');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinishPhoto | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  const srcUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const outUrl = useMemo(() => (result ? URL.createObjectURL(result.albedo) : null), [result]);
  useEffect(() => () => void (srcUrl && URL.revokeObjectURL(srcUrl)), [srcUrl]);
  useEffect(() => () => void (outUrl && URL.revokeObjectURL(outUrl)), [outUrl]);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await processPhotoFile(file, finish.id, { size: Number(size), sampleWidth }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!result) return;
    await saveFinishPhoto(result);
    onClose();
  };

  const side = dims ? Math.min(dims.w, dims.h) : 0;
  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal" style={{ width: 'min(860px, 100%)' }} role="dialog" aria-modal="true" aria-label="Import sample photo">
        <div className="modal-head">
          <div>
            <h2>Sample photo · {finish.name}</h2>
            <p>Photograph a physical sample square-on in even, diffuse light. The centre square of the photo becomes a seamless tile.</p>
          </div>
          <button className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
        <div className="modal-body photo-import">
          <div className="photo-cols">
            <div>
              <label className="btn" style={{ marginBottom: 10 }}>
                Choose photo…
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  data-testid="photo-file"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setResult(null);
                  }}
                />
              </label>
              {srcUrl && (
                <div className="photo-frame">
                  <img src={srcUrl} alt="Selected sample" onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
                  {dims && (
                    <div
                      className="photo-crop"
                      style={{
                        width: `${(side / dims.w) * 100}%`,
                        height: `${(side / dims.h) * 100}%`,
                        left: `${((dims.w - side) / 2 / dims.w) * 100}%`,
                        top: `${((dims.h - side) / 2 / dims.h) * 100}%`,
                      }}
                    />
                  )}
                </div>
              )}
              {dims && (
                <p className="tiny">
                  {dims.w} × {dims.h} px{side < Number(size) ? ` — smaller than ${size} px, so the tile will be ${2 ** Math.floor(Math.log2(side))} px` : ''}
                </p>
              )}
              <Field label="Width of the framed square">
                <LengthInput units={units} value={sampleWidth} min={0.05} max={3} onChange={setSampleWidth} />
              </Field>
              <Field label="Tile resolution">
                <Segmented
                  label="Tile resolution"
                  value={size}
                  onChange={setSize}
                  options={[
                    { value: '2048', label: '2K' },
                    { value: '4096', label: '4K' },
                  ]}
                />
              </Field>
              <p className="tiny">Measure across the part of the sample inside the dashed square; it sets the grain scale in 3D.</p>
              <button className="btn primary" disabled={!file || busy} onClick={run} data-testid="photo-process">
                {busy ? 'Processing…' : result ? 'Re-process' : 'Process photo'}
              </button>
              {error && <p className="tiny" style={{ color: 'var(--crit)' }}>{error}</p>}
            </div>
            <div>
              <div className="section-title">Seamless tile · 2 × 2 preview</div>
              <div className="tile-preview" style={outUrl ? { backgroundImage: `url(${outUrl})` } : undefined}>
                {!outUrl && <span className="tiny">Processed tile appears here</span>}
              </div>
              {result && (
                <p className="tiny">
                  {result.size} px tile covering {sampleWidth.toFixed(2)} m · mean color <span style={{ color: result.mean }}>■</span> {result.mean}
                </p>
              )}
              <button className="btn primary" disabled={!result || busy} onClick={apply} data-testid="photo-apply">
                Use for {finish.name}
              </button>
              <p className="tiny" style={{ marginTop: 8 }}>
                Stored on this device. To ship it to every designer and client, use “Download maps” and add the files to
                <code> public/materials/</code>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
