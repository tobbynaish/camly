<script lang="ts">
  import { tick } from 'svelte';
  import { parseDxf } from './lib/dxf/loadDxf';
  import { renderDxf } from './lib/render/renderDxf';
  import { fitTransform } from './lib/render/viewTransform';
  import { hitTest } from './lib/render/hitTest';
  import { classifyDoc, cycleRole, type Role } from './lib/cam/classify';
  import { buildToolPaths } from './lib/cam/toolPath';
  import { analyzeJob } from './lib/analyze/jobInfo';
  import type { DxfDoc } from './lib/dxf/types';

  let canvas: HTMLCanvasElement;
  let doc: DxfDoc | null = null;
  let fileName = '';
  let error = '';
  let dragOver = false;

  let step = 1;
  let roles: Role[] = [];

  // Setup-Eingaben
  let toolDiameter = 3;
  let stockThickness = 9;
  let margin = 15;

  const STEPS = [
    { n: 1, label: 'Upload' },
    { n: 2, label: 'Prüfen' },
    { n: 3, label: 'Klassifizieren' },
    { n: 4, label: 'Parameter' },
    { n: 5, label: 'CAM' },
    { n: 6, label: 'Export' },
  ];
  const BUILT_UP_TO = 3; // bis hierhin ist echte Funktion da

  const TYPE_LABEL: Record<string, string> = {
    line: 'Linien', polyline: 'Polylinien', circle: 'Kreise', arc: 'Bögen',
  };

  async function loadFile(file: File) {
    error = '';
    try {
      const text = await file.text();
      const parsed = parseDxf(text);
      if (parsed.entities.length === 0) {
        doc = null;
        error = 'Keine zeichenbaren Konturen gefunden (Linien, Polylinien, Kreise, Bögen).';
        return;
      }
      doc = parsed;
      fileName = file.name;
      roles = classifyDoc(parsed.entities);
      step = 2;
      await tick();
      draw();
    } catch (e) {
      doc = null;
      error = 'DXF konnte nicht gelesen werden: ' + (e as Error).message;
    }
  }

  function draw() {
    if (!canvas || !doc) return;
    renderDxf(canvas, doc, step >= 3 ? roles : undefined, step >= 3 ? toolPaths?.paths : undefined);
  }

  function goTo(n: number) {
    if (n < 1 || n > BUILT_UP_TO) return;
    if (n > 1 && !doc) return;
    step = n;
    tick().then(draw);
  }

  function onCanvasClick(ev: MouseEvent) {
    if (step !== 3 || !doc) return;
    const rect = canvas.getBoundingClientRect();
    const t = fitTransform(doc.bbox, rect.width, rect.height, 28);
    const world = t.toWorld(ev.clientX - rect.left, ev.clientY - rect.top);
    const idx = hitTest(doc, world);
    if (idx >= 0) {
      roles[idx] = cycleRole(roles[idx]);
      roles = roles;
      draw();
    }
  }

  function onInput(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (f) loadFile(f);
  }
  function onDrop(ev: DragEvent) {
    ev.preventDefault();
    dragOver = false;
    const f = ev.dataTransfer?.files?.[0];
    if (f) loadFile(f);
  }
  function onResize() { draw(); }

  function fmt(n: number): string {
    return n.toLocaleString('de-DE', { maximumFractionDigits: 1 });
  }

  function roleSummary(rs: Role[]) {
    const c = { outer: 0, inner: 0, hole: 0, open: 0 };
    for (const r of rs) c[r]++;
    return c;
  }

  $: width = doc ? doc.bbox.maxX - doc.bbox.minX : 0;
  $: height = doc ? doc.bbox.maxY - doc.bbox.minY : 0;
  $: job = doc ? analyzeJob(doc, { toolDiameter, stockThickness, margin }) : null;
  $: rc = roleSummary(roles);
  $: toolPaths =
    doc && step >= 3 ? buildToolPaths(doc.entities, roles, toolDiameter) : null;

  // Neu zeichnen, wenn Fräser-Ø oder Rollen sich ändern.
  $: if (doc && step >= 3 && (toolDiameter || roles || toolPaths)) draw();
</script>

<svelte:window on:resize={onResize} />

<main>
  <header>
    <div class="eyebrow">camly · Welle 1</div>
    <h1>camly</h1>
    <p class="lead">DXF zu fräsfertigem G-Code. Sechs Schritte von der Zeichnung zum Frässpan.</p>
  </header>

  <nav class="stepper">
    {#each STEPS as s}
      <button
        class="step-pill"
        class:active={step === s.n}
        class:done={s.n < step}
        class:soon={s.n > BUILT_UP_TO}
        disabled={s.n > BUILT_UP_TO || (s.n > 1 && !doc)}
        on:click={() => goTo(s.n)}
      >
        <span class="step-n">{s.n < step ? '✓' : s.n}</span>
        <span>{s.label}</span>
        {#if s.n > BUILT_UP_TO}<span class="step-soon">bald</span>{/if}
      </button>
    {/each}
  </nav>

  {#if step === 1}
    <section
      class="drop"
      class:over={dragOver}
      on:dragover|preventDefault={() => (dragOver = true)}
      on:dragleave={() => (dragOver = false)}
      on:drop={onDrop}
      role="button"
      tabindex="0"
    >
      <p>DXF hierher ziehen oder</p>
      <label class="btn">
        Datei wählen
        <input type="file" accept=".dxf" on:change={onInput} />
      </label>
      <p class="hint">Tipp: <code>samples/demo-rechteck.dxf</code> aus dem Repo zum Ausprobieren.</p>
    </section>
    {#if error}<p class="error">{error}</p>{/if}

  {:else if step === 2 && doc}
    <div class="info">
      <span class="chip"><strong>{fileName}</strong></span>
      <span class="chip">{doc.entities.length} Konturen</span>
      {#each Object.entries(doc.counts) as [type, n]}
        <span class="chip">{n} {TYPE_LABEL[type] ?? type}</span>
      {/each}
    </div>

    <div class="setup">
      <label class="field">
        <span>Fräser-Ø</span>
        <span class="inwrap"><input type="number" min="0.5" step="0.5" bind:value={toolDiameter} /> mm</span>
      </label>
      <label class="field">
        <span>Materialstärke</span>
        <span class="inwrap"><input type="number" min="1" step="1" bind:value={stockThickness} /> mm</span>
      </label>
      <label class="field">
        <span>Rand um die Teile</span>
        <span class="inwrap"><input type="number" min="0" step="1" bind:value={margin} /> mm</span>
      </label>
    </div>

    {#if job}
      <div class="job">
        <div class="job-item"><span class="job-k">Bauteil-Maße</span><span class="job-v">{fmt(width)} × {fmt(height)} mm</span></div>
        <div class="job-item"><span class="job-k">Benötigte Platte</span><span class="job-v">{fmt(job.plateW)} × {fmt(job.plateH)} mm</span></div>
        <div class="job-item"><span class="job-k">Passt auf die Maslow</span><span class="job-v" class:ok={job.fitsMaslow} class:bad={!job.fitsMaslow}>{job.fitsMaslow ? 'ja' : 'nein, aufteilen'}</span></div>
        <div class="job-item"><span class="job-k">Bohrungen</span><span class="job-v">{job.holeCount}</span></div>
        <div class="job-item"><span class="job-k">Schnittweg, 1 Lage</span><span class="job-v">{fmt(job.cutLength / 1000)} m</span></div>
      </div>
    {/if}

    <div class="canvas-wrap"><canvas bind:this={canvas}></canvas></div>
    {#if doc.skipped.length}
      <p class="skipped">Noch nicht gezeichnet: {doc.skipped.join(', ')}.</p>
    {/if}

    <div class="actions">
      <button class="btn next" on:click={() => goTo(3)}>Weiter zu Klassifizieren →</button>
    </div>

  {:else if step === 3 && doc}
    <p class="hint2">Automatisch vorklassifiziert. <strong>Klick auf eine Kontur</strong>, um die Rolle zu wechseln (Außenschnitt → Ausschnitt → Bohrung → offen).</p>

    <div class="legend">
      <span class="lg outer">{rc.outer} Außenschnitte</span>
      <span class="lg inner">{rc.inner} Ausschnitte</span>
      <span class="lg hole">{rc.hole} Bohrungen</span>
      {#if rc.open}<span class="lg open">{rc.open} offen</span>{/if}
    </div>

    {#if toolPaths && toolPaths.conflicts > 0}
      <p class="conflict">
        {toolPaths.conflicts} {toolPaths.conflicts === 1 ? 'Kontur' : 'Konturen'} nicht fräsbar mit Fräser Ø {toolDiameter} mm.
        Kleinerer Fräser wählen, Kontur als Tasche fräsen oder Vorbohren.
      </p>
    {:else if toolPaths}
      <p class="tool-note">Fräser-Zentrumpfad gestrichelt eingeblendet. Fräser Ø {toolDiameter} mm greift in die Geometrie ein.</p>
    {/if}

    <div class="canvas-wrap">
      <canvas bind:this={canvas} class="clickable" on:click={onCanvasClick}></canvas>
    </div>

    <div class="actions">
      <button class="btn ghost" on:click={() => goTo(2)}>← Zurück</button>
      <button class="btn next" disabled title="Schritt 4 ist im Bau">Weiter zu Parameter →</button>
      <span class="actions-note">Schritt 4 bis 6 sind als Nächstes dran.</span>
    </div>
  {/if}
</main>
