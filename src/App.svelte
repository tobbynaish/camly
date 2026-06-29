<script lang="ts">
  import { tick } from 'svelte';
  import { parseDxf } from './lib/dxf/loadDxf';
  import { renderDxf } from './lib/render/renderDxf';
  import type { DxfDoc } from './lib/dxf/types';
  import { analyzeJob } from './lib/analyze/jobInfo';

  let canvas: HTMLCanvasElement;
  let doc: DxfDoc | null = null;
  let fileName = '';
  let error = '';
  let dragOver = false;

  // Setup-Eingaben, die nach dem Upload erscheinen
  let toolDiameter = 3;
  let stockThickness = 9;
  let margin = 15;

  const TYPE_LABEL: Record<string, string> = {
    line: 'Linien',
    polyline: 'Polylinien',
    circle: 'Kreise',
    arc: 'Bögen',
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
      await tick();
      if (canvas) renderDxf(canvas, doc);
    } catch (e) {
      doc = null;
      error = 'DXF konnte nicht gelesen werden: ' + (e as Error).message;
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
  function onResize() {
    if (canvas && doc) renderDxf(canvas, doc);
  }

  function fmt(n: number): string {
    return n.toLocaleString('de-DE', { maximumFractionDigits: 1 });
  }

  $: width = doc ? doc.bbox.maxX - doc.bbox.minX : 0;
  $: height = doc ? doc.bbox.maxY - doc.bbox.minY : 0;
  $: job = doc ? analyzeJob(doc, { toolDiameter, stockThickness, margin }) : null;
</script>

<svelte:window on:resize={onResize} />

<main>
  <header>
    <div class="eyebrow">Welle 1 · Schritt 2</div>
    <h1>camly</h1>
    <p class="lead">DXF einlesen, Konturen prüfen. Der erste Schritt der Pipeline von der Zeichnung zum Frässpan.</p>
  </header>

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

  {#if error}
    <p class="error">{error}</p>
  {/if}

  {#if doc}
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
        <div class="job-item">
          <span class="job-k">Bauteil-Maße</span>
          <span class="job-v">{fmt(width)} × {fmt(height)} mm</span>
        </div>
        <div class="job-item">
          <span class="job-k">Benötigte Platte</span>
          <span class="job-v">{fmt(job.plateW)} × {fmt(job.plateH)} mm</span>
        </div>
        <div class="job-item">
          <span class="job-k">Passt auf die Maslow</span>
          <span class="job-v" class:ok={job.fitsMaslow} class:bad={!job.fitsMaslow}>{job.fitsMaslow ? 'ja' : 'nein, aufteilen'}</span>
        </div>
        <div class="job-item">
          <span class="job-k">Bohrungen</span>
          <span class="job-v">{job.holeCount}</span>
        </div>
        <div class="job-item">
          <span class="job-k">Schnittweg, 1 Lage</span>
          <span class="job-v">{fmt(job.cutLength / 1000)} m</span>
        </div>
      </div>
    {/if}

    <div class="canvas-wrap">
      <canvas bind:this={canvas}></canvas>
    </div>

    {#if doc.skipped.length}
      <p class="skipped">Noch nicht gezeichnet: {doc.skipped.join(', ')}. Kommt in einem Folgeschritt (etwa Splines).</p>
    {/if}
  {/if}
</main>
