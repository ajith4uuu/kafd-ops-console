import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Card, DataTable, Kpi, num, sar } from '../components/ui';
import {
  ROUTE,
  SEED_PROPERTIES,
  SLOT_LABEL,
  canList,
  classifyPhoto,
  listingIssues,
  orderPhotos,
  walkthroughPlan,
  type ManagedProperty,
  type PropertyPhoto,
  type RouteSlot,
  type WalkthroughScene,
} from '../data/portfolio';

const STORE_KEY = 'kafd-portfolio-v1';

function loadPortfolio(): ManagedProperty[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as ManagedProperty[];
  } catch {
    // corrupt store falls back to seeds
  }
  return SEED_PROPERTIES.map((p) => ({ ...p, photos: [...p.photos], amenities: [...p.amenities] }));
}

/** Downscale an upload to ≤1280px JPEG so the whole portfolio stays in localStorage. */
function downscale(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => reject(new Error('decode failed'));
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ------------------------------------------------------------ walkthrough engine

interface PlayerController {
  stop: () => void;
}

/**
 * Draw the scene list onto a canvas with slow push-in/pan motion and
 * crossfades — the "slow and steady" camera language of property video.
 * Shared verbatim by the live preview and the WebM compiler.
 */
function runWalkthrough(
  canvas: HTMLCanvasElement,
  scenes: WalkthroughScene[],
  images: HTMLImageElement[],
  opts: { narrate: boolean; tick?: 'raf' | 'interval'; onFrame?: () => void; onScene?: (i: number) => void; onDone?: () => void },
): PlayerController {
  const ctx = canvas.getContext('2d')!;
  const FADE = 0.7;
  let raf = 0;
  let stopped = false;
  const t0 = performance.now();
  const starts: number[] = [];
  let acc = 0;
  for (const s of scenes) {
    starts.push(acc);
    acc += s.seconds;
  }
  const total = acc;
  let lastScene = -1;

  function drawScene(i: number, progress: number, alpha: number) {
    const img = images[i];
    if (!img) return;
    const zoom = 1.06 + 0.12 * progress;
    const panX = (i % 2 === 0 ? 1 : -1) * 0.04 * progress;
    const w = canvas.width * zoom;
    const h = canvas.height * zoom;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (canvas.width - w) / 2 + panX * canvas.width, (canvas.height - h) / 2, w, h);
    ctx.globalAlpha = 1;
  }

  function frame(now: number) {
    if (stopped) return;
    const t = (now - t0) / 1000;
    if (t >= total) {
      opts.onDone?.();
      return;
    }
    let i = scenes.length - 1;
    while (i > 0 && starts[i] > t) i -= 1;
    const local = t - starts[i];
    const progress = Math.min(1, local / scenes[i].seconds);
    if (i !== lastScene) {
      lastScene = i;
      opts.onScene?.(i);
      if (opts.narrate && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(scenes[i].narration);
        u.rate = 1.02;
        speechSynthesis.speak(u);
      }
    }
    ctx.fillStyle = '#10182b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawScene(i, progress, 1);
    if (local < FADE && i > 0) drawScene(i - 1, 1, 1 - local / FADE);
    // lower-third caption
    ctx.fillStyle = 'rgba(16,24,43,0.72)';
    ctx.fillRect(0, canvas.height - 54, canvas.width, 54);
    ctx.fillStyle = '#e8b463';
    ctx.font = '600 13px Arial';
    ctx.fillText(SLOT_LABEL[scenes[i].slot].toUpperCase(), 18, canvas.height - 32);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '14px Georgia';
    ctx.fillText(scenes[i].narration.slice(0, 92), 18, canvas.height - 12);
    opts.onFrame?.();
    schedule();
  }
  // rAF pauses in hidden tabs, which would stall a recording forever — the
  // compiler drives itself on wall-clock timeouts instead (t is wall-clock
  // either way, so a throttled background tab just records at a lower fps).
  let timer = 0;
  function schedule() {
    if (stopped) return;
    if (opts.tick === 'interval') timer = window.setTimeout(() => frame(performance.now()), 33);
    else raf = requestAnimationFrame(frame);
  }
  schedule();
  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      if (opts.narrate && 'speechSynthesis' in window) speechSynthesis.cancel();
    },
  };
}

function loadImages(scenes: WalkthroughScene[]): Promise<HTMLImageElement[]> {
  return Promise.all(
    scenes.map(
      (s) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('image load failed'));
          img.src = s.photo.src;
        }),
    ),
  );
}

// ------------------------------------------------------------ page

export function PortfolioPage() {
  const [properties, setProperties] = useState<ManagedProperty[]>(loadPortfolio);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sceneIdx, setSceneIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<PlayerController | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(properties));
    } catch {
      // photo payload exceeded quota — keep the session copy in memory
    }
  }, [properties]);

  useEffect(() => () => controllerRef.current?.stop(), []);

  const selected = properties.find((p) => p.id === selectedId) ?? null;
  const plan = useMemo(
    () => (selected ? walkthroughPlan(selected.photos, selected) : []),
    [selected],
  );

  const patch = (id: string, updater: (p: ManagedProperty) => ManagedProperty) =>
    setProperties((prev) => prev.map((p) => (p.id === id ? updater(p) : p)));

  const createProperty = () => {
    const id = `prop-new-${Date.now()}`;
    const fresh: ManagedProperty = {
      id,
      title: 'New unit',
      building: 'Vue East',
      unitNo: '',
      type: 'residential',
      bedrooms: 1,
      bathrooms: 1,
      sqm: 80,
      priceSar: 100000,
      depositSar: 5000,
      brokerageSar: 2500,
      regaAdLicense: '',
      falLicense: '1200018493',
      amenities: [],
      description: '',
      status: 'draft',
      photos: [],
      walkthroughReady: false,
    };
    setProperties((prev) => [fresh, ...prev]);
    setSelectedId(id);
  };

  const uploadPhotos = async (files: FileList | null) => {
    if (!files || !selected) return;
    const additions: PropertyPhoto[] = [];
    for (const file of Array.from(files)) {
      try {
        const src = await downscale(file);
        additions.push({
          id: `${selected.id}-up-${Date.now()}-${additions.length}`,
          src,
          filename: file.name,
          slot: classifyPhoto(file.name),
          slotSource: 'auto',
        });
      } catch {
        // skip unreadable file
      }
    }
    patch(selected.id, (p) => ({ ...p, photos: orderPhotos([...p.photos, ...additions]), walkthroughReady: false }));
  };

  const stopPlayback = () => {
    controllerRef.current?.stop();
    controllerRef.current = null;
    setPlaying(false);
    setSceneIdx(-1);
  };

  const preview = async () => {
    if (!canvasRef.current || plan.length === 0) return;
    stopPlayback();
    const images = await loadImages(plan);
    setPlaying(true);
    controllerRef.current = runWalkthrough(canvasRef.current, plan, images, {
      narrate: true,
      onScene: setSceneIdx,
      onDone: stopPlayback,
    });
  };

  const compile = async () => {
    if (!canvasRef.current || plan.length === 0 || !selected) return;
    stopPlayback();
    setCompiling(true);
    setVideoUrl(null);
    try {
      const images = await loadImages(plan);
      const canvas = canvasRef.current;
      const stream = canvas.captureStream(0);
      const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      const done = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
      });
      recorder.start(250);
      await new Promise<void>((resolve) => {
        controllerRef.current = runWalkthrough(canvas, plan, images, {
          narrate: false,
          tick: 'interval',
          onFrame: () => track.requestFrame?.(),
          onScene: setSceneIdx,
          onDone: resolve,
        });
      });
      recorder.stop();
      const blob = await done;
      setVideoUrl(URL.createObjectURL(blob));
      patch(selected.id, (p) => ({ ...p, walkthroughReady: true }));
    } finally {
      setCompiling(false);
      setSceneIdx(-1);
    }
  };

  const kpiListed = properties.filter((p) => p.status === 'listed').length;
  const kpiPhotos = properties.reduce((s, p) => s + p.photos.length, 0);

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Units under management" value={num(properties.length)} />
        <Kpi label="Listed" value={String(kpiListed)} />
        <Kpi label="Drafts" value={String(properties.filter((p) => p.status === 'draft').length)} />
        <Kpi label="Leased" value={String(properties.filter((p) => p.status === 'leased').length)} />
        <Kpi label="Photos in library" value={num(kpiPhotos)} />
        <Kpi label="Walkthroughs compiled" value={String(properties.filter((p) => p.walkthroughReady).length)} />
      </div>

      <Card
        title="Property inventory"
        foot="Listing is gated on compliance: REGA advertisement licence, FAL number, the 5% deposit and 2.5% brokerage caps, a tourism licence for short stays, and at least four route-classified photos."
        data-testid="inventory-card"
      >
        <div style={{ marginBottom: 10 }}>
          <button className="btn primary" onClick={createProperty}>+ New property</button>
        </div>
        <DataTable<ManagedProperty>
          rowKey={(p) => p.id}
          columns={[
            { key: 'title', label: 'Property', render: (p) => p.title },
            { key: 'type', label: 'Type', render: (p) => p.type.replace('_', ' ') },
            { key: 'price', label: 'Price', render: (p) => `${sar(p.priceSar)}${p.type === 'short_stay' ? '/night' : '/yr'}` },
            { key: 'photos', label: 'Photos', render: (p) => String(p.photos.length) },
            { key: 'wt', label: 'Walkthrough', render: (p) => <Badge tone={p.walkthroughReady ? 'green' : 'peri'}>{p.walkthroughReady ? 'Compiled' : '—'}</Badge> },
            {
              key: 'status',
              label: 'Status',
              render: (p) => (
                <Badge tone={p.status === 'listed' ? 'green' : p.status === 'draft' ? 'amber' : p.status === 'leased' ? 'peri' : 'red'}>{p.status}</Badge>
              ),
            },
            {
              key: 'actions',
              label: '',
              render: (p) => (
                <span style={{ display: 'inline-flex', gap: 6 }}>
                  <button className="btn" onClick={() => { setSelectedId(p.id); setVideoUrl(null); stopPlayback(); }}>Manage</button>
                  {p.status === 'draft' && (
                    <button className="btn primary" disabled={!canList(p)} title={listingIssues(p).join('; ')} onClick={() => patch(p.id, (x) => ({ ...x, status: 'listed' }))}>
                      List
                    </button>
                  )}
                  {p.status === 'listed' && (
                    <button className="btn" onClick={() => patch(p.id, (x) => ({ ...x, status: 'draft' }))}>Unlist</button>
                  )}
                </span>
              ),
            },
          ]}
          rows={properties}
        />
      </Card>

      {selected && (
        <>
          <div className="grid cols-2">
            <Card title={`Details — ${selected.title}`} data-testid="editor-card">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label className="fld">Title
                  <input value={selected.title} onChange={(e) => patch(selected.id, (p) => ({ ...p, title: e.target.value }))} />
                </label>
                <label className="fld">Building
                  <input value={selected.building} onChange={(e) => patch(selected.id, (p) => ({ ...p, building: e.target.value }))} />
                </label>
                <label className="fld">Unit no.
                  <input value={selected.unitNo} onChange={(e) => patch(selected.id, (p) => ({ ...p, unitNo: e.target.value }))} />
                </label>
                <label className="fld">Type
                  <select value={selected.type} onChange={(e) => patch(selected.id, (p) => ({ ...p, type: e.target.value as ManagedProperty['type'] }))}>
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                    <option value="short_stay">Short stay</option>
                  </select>
                </label>
                <label className="fld">{selected.type === 'short_stay' ? 'Nightly rate (SAR)' : 'Annual rent (SAR)'}
                  <input type="number" value={selected.priceSar} onChange={(e) => patch(selected.id, (p) => ({ ...p, priceSar: Number(e.target.value) }))} />
                </label>
                <label className="fld">Deposit (SAR)
                  <input type="number" value={selected.depositSar} onChange={(e) => patch(selected.id, (p) => ({ ...p, depositSar: Number(e.target.value) }))} />
                </label>
                <label className="fld">Brokerage (SAR)
                  <input type="number" value={selected.brokerageSar} onChange={(e) => patch(selected.id, (p) => ({ ...p, brokerageSar: Number(e.target.value) }))} />
                </label>
                <label className="fld">Bedrooms
                  <input type="number" value={selected.bedrooms} onChange={(e) => patch(selected.id, (p) => ({ ...p, bedrooms: Number(e.target.value) }))} />
                </label>
                <label className="fld">REGA ad licence
                  <input value={selected.regaAdLicense} onChange={(e) => patch(selected.id, (p) => ({ ...p, regaAdLicense: e.target.value }))} />
                </label>
                <label className="fld">FAL licence
                  <input value={selected.falLicense} onChange={(e) => patch(selected.id, (p) => ({ ...p, falLicense: e.target.value }))} />
                </label>
                {selected.type === 'short_stay' && (
                  <label className="fld">Tourism licence
                    <input value={selected.tourismLicense ?? ''} onChange={(e) => patch(selected.id, (p) => ({ ...p, tourismLicense: e.target.value }))} />
                  </label>
                )}
              </div>
              <label className="fld" style={{ marginTop: 10, display: 'block' }}>Description
                <textarea rows={2} value={selected.description} onChange={(e) => patch(selected.id, (p) => ({ ...p, description: e.target.value }))} />
              </label>
              {listingIssues(selected).length > 0 ? (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {listingIssues(selected).map((issue) => (
                    <div key={issue} style={{ fontSize: 12.5, color: '#ff8da1' }}>✕ {issue}</div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: 10, fontSize: 12.5, color: '#7ecb93' }}>✓ Compliant — ready to list</div>
              )}
            </Card>

            <Card
              title={`Photos — route-ordered (${selected.photos.length})`}
              foot="Uploads classify by filename (longest keyword wins) and store already ordered along the tour route; pin a slot to override. The gallery, the narration and the video all read this one sequence."
              data-testid="photos-card"
            >
              <input
                type="file"
                accept="image/*"
                multiple
                data-testid="photo-upload"
                onChange={(e) => { void uploadPhotos(e.target.files); e.target.value = ''; }}
                style={{ marginBottom: 10 }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                {selected.photos.map((photo) => (
                  <div key={photo.id} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden' }}>
                    <img src={photo.src} alt={photo.filename} style={{ width: '100%', height: 78, objectFit: 'cover', display: 'block' }} />
                    <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <select
                        value={photo.slot ?? ''}
                        onChange={(e) =>
                          patch(selected.id, (p) => ({
                            ...p,
                            photos: orderPhotos(
                              p.photos.map((x) =>
                                x.id === photo.id
                                  ? { ...x, slot: (e.target.value || null) as RouteSlot | null, slotSource: 'pinned' as const }
                                  : x,
                              ),
                            ),
                            walkthroughReady: false,
                          }))
                        }
                        style={{ fontSize: 11 }}
                      >
                        <option value="">unclassified</option>
                        {ROUTE.map((r) => (
                          <option key={r.slot} value={r.slot}>{SLOT_LABEL[r.slot]}</option>
                        ))}
                      </select>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, opacity: 0.6 }}>{photo.slotSource}</span>
                        <button
                          className="btn"
                          style={{ fontSize: 10, padding: '2px 8px' }}
                          onClick={() => patch(selected.id, (p) => ({ ...p, photos: p.photos.filter((x) => x.id !== photo.id), walkthroughReady: false }))}
                        >
                          remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card
            title={`AI walkthrough studio — ${plan.length} scenes`}
            foot="Preview narrates each stop over slow push-in camera moves; Compile records the same render into a downloadable WebM entirely in the browser — no external service touches the photos."
            data-testid="studio-card"
          >
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <button className="btn primary" onClick={() => void preview()} disabled={plan.length === 0 || compiling}>▶ Preview with narration</button>
              {playing && <button className="btn" onClick={stopPlayback}>Stop</button>}
              <button className="btn primary" onClick={() => void compile()} disabled={plan.length === 0 || compiling}>
                {compiling ? 'Compiling…' : '⬇ Compile video (WebM)'}
              </button>
              {sceneIdx >= 0 && plan[sceneIdx] && (
                <Badge tone="amber">{SLOT_LABEL[plan[sceneIdx].slot]} — {plan[sceneIdx].camera}</Badge>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: videoUrl ? '1fr 1fr' : '1fr', gap: 12 }}>
              <canvas ref={canvasRef} width={960} height={540} style={{ width: '100%', borderRadius: 10, background: '#10182b', border: '1px solid rgba(255,255,255,0.1)' }} />
              {videoUrl && (
                <div>
                  <video src={videoUrl} controls autoPlay muted style={{ width: '100%', borderRadius: 10 }} data-testid="compiled-video" />
                  <a className="btn" href={videoUrl} download={`${selected.id}-walkthrough.webm`} style={{ display: 'inline-block', marginTop: 8 }}>
                    Download {selected.id}-walkthrough.webm
                  </a>
                </div>
              )}
            </div>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {plan.map((s, i) => (
                <div key={s.photo.id} style={{ fontSize: 12.5, color: i === sceneIdx ? '#e8b463' : 'rgba(255,255,255,0.6)' }}>
                  {String(i + 1).padStart(2, '0')} · {SLOT_LABEL[s.slot]} — “{s.narration}”
                </div>
              ))}
              {plan.length === 0 && <span style={{ fontSize: 12.5, opacity: 0.6 }}>Upload at least one photo to build a tour.</span>}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
