// Claude-Anbindung für die Begründung der Parameter-Wahl. Läuft direkt im
// Browser mit dem API-Key des Nutzers. Der Key bleibt im localStorage des
// Browsers und geht nur an api.anthropic.com, nie an einen camly-Server.

import Anthropic from '@anthropic-ai/sdk';
import { MASLOW } from './materials';
import type { ParamInput, ParamSuggestion } from './engine';

const KEY_STORAGE = 'camly.anthropic-key';

export function loadApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function saveApiKey(key: string): void {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    // localStorage kann in privaten Fenstern gesperrt sein, dann eben ohne Merken.
  }
}

function buildPrompt(input: ParamInput, s: ParamSuggestion): string {
  return [
    'Du bist CNC-Frästechniker. Prüfe und begründe diesen Fräsparameter-Vorschlag',
    'für eine Maslow 4 (Seilzug-CNC, geringe Steifigkeit) mit Makita RT0701C Oberfräse.',
    '',
    `Material: ${s.material.label} (${s.material.note})`,
    `Materialstärke: ${input.stockThickness} mm`,
    `Fräser: Ø ${input.toolDiameter} mm, ${input.flutes} Schneiden, Spiralnutfräser`,
    '',
    'Vorschlag der Lookup-Tabelle:',
    `- Drehzahl: ${s.rpm} U/min (Makita-Stellrad ${s.dial})`,
    `- Vorschub: ${s.feed} mm/min (Maschinenlimit ${MASLOW.maxFeed} mm/min)`,
    `- Eintauchvorschub: ${s.plunge} mm/min`,
    `- Zustellung: ${s.depthPerPass} mm pro Durchgang, ${s.passCount} Durchgänge`,
    `- Effektive Spanungsdicke: ${s.chipload} mm/Zahn (Zielbereich ${s.chiploadMin} bis ${s.chiploadMax})`,
    s.warnings.length ? `- Warnungen der Engine: ${s.warnings.join(' / ')}` : '',
    '',
    'Antworte auf Deutsch in 4 bis 6 Sätzen Fließtext ohne Überschriften:',
    'Sind die Werte plausibel? Was ist die wichtigste Stellschraube, falls das',
    'Ergebnis ausfranst oder brennt? Nenne konkrete Zahlen, wenn du etwas ändern würdest.',
  ]
    .filter((l) => l !== '')
    .join('\n');
}

export async function explainWithClaude(
  input: ParamInput,
  s: ParamSuggestion,
  apiKey: string,
): Promise<string> {
  const client = new Anthropic({
    apiKey,
    // camly ist eine reine Browser-App ohne Backend. Der Key gehört dem Nutzer
    // und geht direkt an die Anthropic-API, deshalb ist der Browser-Modus hier ok.
    dangerouslyAllowBrowser: true,
  });

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2000,
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: buildPrompt(input, s) }],
    });

    if (response.stop_reason === 'refusal') {
      throw new Error('Claude hat die Anfrage abgelehnt. Lokale Begründung bleibt gültig.');
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    if (!text) throw new Error('Leere Antwort von Claude erhalten.');
    return text;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      throw new Error('API-Key ungültig. Key prüfen (beginnt mit sk-ant-).');
    }
    if (e instanceof Anthropic.RateLimitError) {
      throw new Error('Rate-Limit erreicht. Kurz warten und nochmal versuchen.');
    }
    if (e instanceof Anthropic.APIConnectionError) {
      throw new Error('Keine Verbindung zur Anthropic-API. Netzwerk prüfen.');
    }
    if (e instanceof Anthropic.APIError) {
      throw new Error(`Anthropic-API-Fehler ${e.status ?? ''}: ${e.message}`);
    }
    throw e;
  }
}
