<script lang="ts">
  import { tick } from 'svelte';
  import { parseDxf } from './lib/dxf/loadDxf';
  import { renderDxf } from './lib/render/renderDxf';
  import { fitTransform } from './lib/render/viewTransform';
  import { hitTest } from './lib/render/hitTest';
  import { classifyDoc, cycleRole, type Role } from './lib/cam/classify';
  import { buildToolPaths } from './lib/cam/toolPath';
  import { analyzeJob } from './lib/analyze/jobInfo';
  import { MATERIALS } from './lib/params/materials';
  import { suggestParams, localExplanation } from './lib/params/engine';
  import { explainWithClaude, loadApiKey, saveApiKey } from './lib/params/explain';
  import { insertDogbones } from './lib/cam/dogbone';
  import { DEFAULT_TABS } from './lib/cam/tabs';
  import { generateGcode, tabMarkersFor } from './lib/cam/gcode';
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

  // Schritt 4: Parameter
  let materialId = 'birke-multiplex';
  let flutes = 2;
  let apiKey = loadApiKey();
  let kiText = '';
  let kiError = '';
  let kiLoading = false;

  // Schritt 5: CAM
  let tabsEnabled = true;
  let tabWidth = 8;
  let tabHeight = 3;
  let dogbonesEnabled = true;

  const STEPS = [
    { n: 1, label: 'Upload' },
    { n: 2, label: 'Prüfen' },
    { n: 3, label: 'Klassifizieren' },
    { n: 4, label: 'Parameter' },
    { n: 5, label: 'CAM' },
    { n: 6, label: 'Export' },
  ];
  const BUILT_UP_TO = 6; // bis hierhin ist echte Funktion da

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
    const paths = step >= 5 && camPaths ? camPaths : toolPaths?.paths;
    renderDxf(
      canvas,
      doc,
      step >= 3 ? roles : undefined,
      step >= 3 ? paths : undefined,
      step >= 5 ? tabMarkers : undefined,
    );
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

  // Schritt 4: Parameter-Vorschlag aus der Lookup-Tabelle.
  $: paramInput = { materialId, toolDiameter, flutes, stockThickness };
  $: suggestion = suggestParams(paramInput);
  // Bei geänderten Eingaben ist eine alte KI-Begründung nicht mehr gültig.
  $: if (suggestion) { kiText = ''; kiError = ''; }

  // Schritt 5: CAM-Pfade mit Dogbones, Tab-Marker für die Vorschau.
  $: tabCfg = { ...DEFAULT_TABS, enabled: tabsEnabled, width: tabWidth, height: tabHeight };
  $: camPaths =
    doc && step >= 5 && toolPaths
      ? dogbonesEnabled
        ? insertDogbones(doc.entities, toolPaths.paths, toolDiameter / 2)
        : toolPaths.paths
      : null;
  $: tabMarkers = camPaths ? tabMarkersFor(camPaths, tabCfg, toolDiameter) : [];
  $: if (doc && step >= 5 && (camPaths || tabMarkers)) draw();

  // Schritt 6: G-Code.
  $: gcode =
    doc && step >= 6 && camPaths
      ? generateGcode({
          paths: camPaths,
          params: {
            feed: suggestion.feed,
            plunge: suggestion.plunge,
            rpm: suggestion.rpm,
            depthPerPass: suggestion.depthPerPass,
          },
          stockThickness,
          toolDiameter,
          tabs: tabCfg,
        })
      : null;

  function downloadGcode() {
    if (!gcode) return;
    const blob = new Blob([gcode.text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (fileName.replace(/\.dxf$/i, '') || 'camly') + '.nc';
    a.click();
    URL.revokeObjectURL(url);
  }

  function fmtMinutes(min: number): string {
    if (min < 1) return 'unter 1 min';
    if (min < 60) return `${Math.round(min)} min`;
    return `${Math.floor(min / 60)} h ${Math.round(min % 60)} min`;
  }

  async function askClaude() {
    kiError = '';
    kiLoading = true;
    saveApiKey(apiKey);
    try {
      kiText = await explainWithClaude(paramInput, suggestion, apiKey.trim());
    } catch (e) {
      kiError = (e as Error).message;
    } finally {
      kiLoading = false;
    }
  }
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
      <button class="btn next" on:click={() => goTo(4)}>Weiter zu Parameter →</button>
    </div>

  {:else if step === 4 && doc}
    <p class="hint2">
      Fräsparameter aus der Lookup-Tabelle für die <strong>Maslow 4 mit Makita RT0701C</strong>.
      Material wählen, Werte prüfen, optional von Claude begründen lassen.
    </p>

    <div class="setup">
      <label class="field">
        <span>Material</span>
        <select bind:value={materialId}>
          {#each MATERIALS as m}
            <option value={m.id}>{m.label}</option>
          {/each}
        </select>
      </label>
      <label class="field">
        <span>Schneiden</span>
        <select bind:value={flutes}>
          <option value={1}>1 (Einschneider)</option>
          <option value={2}>2 (Zweischneider)</option>
        </select>
      </label>
      <label class="field">
        <span>Fräser-Ø</span>
        <span class="inwrap"><input type="number" min="0.5" step="0.5" bind:value={toolDiameter} /> mm</span>
      </label>
      <label class="field">
        <span>Materialstärke</span>
        <span class="inwrap"><input type="number" min="1" step="1" bind:value={stockThickness} /> mm</span>
      </label>
    </div>

    <div class="job">
      <div class="job-item"><span class="job-k">Drehzahl</span><span class="job-v">{suggestion.rpm.toLocaleString('de-DE')} U/min</span></div>
      <div class="job-item"><span class="job-k">Makita-Stellrad</span><span class="job-v">{suggestion.dial}</span></div>
      <div class="job-item"><span class="job-k">Vorschub</span><span class="job-v">{suggestion.feed} mm/min</span></div>
      <div class="job-item"><span class="job-k">Eintauchen</span><span class="job-v">{suggestion.plunge} mm/min</span></div>
      <div class="job-item"><span class="job-k">Zustellung</span><span class="job-v">{suggestion.depthPerPass} mm</span></div>
      <div class="job-item"><span class="job-k">Durchgänge</span><span class="job-v">{suggestion.passCount}</span></div>
      <div class="job-item"><span class="job-k">Spanungsdicke</span><span class="job-v">{suggestion.chipload} mm/Zahn</span></div>
    </div>

    {#each suggestion.warnings as w}
      <p class="conflict">{w}</p>
    {/each}

    <div class="explain">
      <div class="explain-head">Begründung</div>
      <p class="explain-text">{kiText || localExplanation(paramInput, suggestion)}</p>
      {#if kiText}
        <p class="explain-source">Begründet von Claude (claude-opus-4-8).</p>
      {/if}

      <div class="ki-row">
        <input
          class="key-input"
          type="password"
          placeholder="Anthropic API-Key (sk-ant-…)"
          bind:value={apiKey}
        />
        <button class="btn" on:click={askClaude} disabled={kiLoading || !apiKey.trim()}>
          {kiLoading ? 'Claude denkt nach…' : 'Von Claude begründen lassen'}
        </button>
      </div>
      {#if kiError}<p class="error">{kiError}</p>{/if}
      <p class="ki-note">
        Ohne Key steht oben die regelbasierte Begründung der Tabelle. Der Key bleibt in diesem
        Browser (localStorage) und geht direkt an api.anthropic.com, camly hat keinen Server.
      </p>
    </div>

    <div class="actions">
      <button class="btn ghost" on:click={() => goTo(3)}>← Zurück</button>
      <button class="btn next" on:click={() => goTo(5)}>Weiter zu CAM →</button>
    </div>

  {:else if step === 5 && doc}
    <p class="hint2">
      CAM-Vorbereitung: <strong>Haltestege</strong> (grüne Quadrate) halten die Teile in der Platte,
      <strong>Dogbones</strong> räumen die Ecken der Ausschnitte frei, damit eckige Teile passen.
    </p>

    <div class="setup">
      <label class="field check">
        <span>Haltestege</span>
        <span class="inwrap"><input type="checkbox" bind:checked={tabsEnabled} /> aktiv</span>
      </label>
      {#if tabsEnabled}
        <label class="field">
          <span>Steg-Breite</span>
          <span class="inwrap"><input type="number" min="3" step="1" bind:value={tabWidth} /> mm</span>
        </label>
        <label class="field">
          <span>Steg-Höhe</span>
          <span class="inwrap"><input type="number" min="1" step="0.5" bind:value={tabHeight} /> mm</span>
        </label>
      {/if}
      <label class="field check">
        <span>Dogbones</span>
        <span class="inwrap"><input type="checkbox" bind:checked={dogbonesEnabled} /> aktiv</span>
      </label>
    </div>

    {#if toolPaths && toolPaths.conflicts > 0}
      <p class="conflict">
        {toolPaths.conflicts} {toolPaths.conflicts === 1 ? 'Kontur wird' : 'Konturen werden'} wegen
        Fräser-Konflikt übersprungen (siehe Schritt 3).
      </p>
    {/if}

    <div class="canvas-wrap"><canvas bind:this={canvas}></canvas></div>

    <div class="actions">
      <button class="btn ghost" on:click={() => goTo(4)}>← Zurück</button>
      <button class="btn next" on:click={() => goTo(6)}>Weiter zu Export →</button>
    </div>

  {:else if step === 6 && doc && gcode}
    <p class="hint2">
      GRBL-G-Code für die <strong>Maslow 4</strong>. Nullpunkt: XY wie im DXF,
      Z0 auf der Materialoberseite. Reihenfolge: Bohrungen, Ausschnitte, Außenschnitte.
    </p>

    <div class="job">
      <div class="job-item"><span class="job-k">Konturen</span><span class="job-v">{gcode.stats.pathCount}</span></div>
      <div class="job-item"><span class="job-k">Durchgänge</span><span class="job-v">{gcode.stats.passCount}</span></div>
      <div class="job-item"><span class="job-k">Haltestege</span><span class="job-v">{gcode.stats.tabCount}</span></div>
      <div class="job-item"><span class="job-k">Fräsweg</span><span class="job-v">{fmt(gcode.stats.cutLength / 1000)} m</span></div>
      <div class="job-item"><span class="job-k">Dauer (geschätzt)</span><span class="job-v">{fmtMinutes(gcode.stats.estMinutes)}</span></div>
      <div class="job-item"><span class="job-k">Zeilen</span><span class="job-v">{gcode.stats.lineCount}</span></div>
    </div>

    {#if gcode.stats.skippedConflict > 0 || gcode.stats.skippedOpen > 0}
      <p class="conflict">
        Übersprungen: {gcode.stats.skippedConflict} mit Fräser-Konflikt,
        {gcode.stats.skippedOpen} offene Konturen. Offene Konturen bekommen erst später eine Gravur-Strategie.
      </p>
    {/if}

    <pre class="gcode-preview">{gcode.text.split('\n').slice(0, 26).join('\n')}
{gcode.stats.lineCount > 26 ? `… ${gcode.stats.lineCount - 26} weitere Zeilen` : ''}</pre>

    <div class="actions">
      <button class="btn ghost" on:click={() => goTo(5)}>← Zurück</button>
      <button class="btn next" on:click={downloadGcode}>G-Code herunterladen (.nc)</button>
    </div>
  {/if}
</main>
