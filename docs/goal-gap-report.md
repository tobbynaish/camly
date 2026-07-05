# G-001 GitHub öffentlich freigeben — Gap-Report

## Done-Bedingung (Checkliste)

- [ ] Repo als `github.com/tobbynaish/camly` gepusht
- [ ] README sauber
- [ ] MIT-Lizenz sauber
- [ ] Release-Tag v0.1 gesetzt
- [ ] Repo auf GitHub sichtbar
- [ ] README rendert auf GitHub
- [ ] Tag v0.1 existiert auf GitHub

## Soll-Ist-Abgleich

### Schon gebaut / vorhanden
- README.md vorhanden, deutsch, klar, Stack und Pipeline beschrieben, MIT-Hinweis. Statuszeile hinkt aber hinter dem Commit-Log her (sagt „Schritt 2", Commits zeigen Schritt 3).
- LICENSE vorhanden, MIT, Copyright 2026 Tobias Herold, korrekter Volltext.
- .gitignore sauber (node_modules, dist, Editor-Dateien, Logs).
- Lokaler Stand auf `main`, working tree clean, 3 Commits.
- `gh` CLI authentifiziert als `tobbynaish`, Scope `repo` und `workflow` vorhanden.
- Git user.name und user.email korrekt gesetzt.

### Fehlt
- Kein Git-Remote gesetzt (`git remote -v` leer).
- GitHub-Repo `tobbynaish/camly` existiert noch nicht.
- Release-Tag `v0.1` existiert lokal und remote nicht.

### Abweichungen
- README-Statuszeile nennt Schritt 2, Commit `e40540c` enthält aber Schritt 3 (Konturklassifikation). Sollte vor der Freigabe aktualisiert werden, damit das öffentliche Repo nicht falsch aussagt.

### Risiken
- Keine Secrets in Commits gefunden (keine .env, keine Keys im Tree). `.gitignore` schließt `*.local` aus.
- `dist/` ist aktuell nicht ignored? Doch, `.gitignore` enthält `dist`. Wurde aber committed (im Tree sichtbar). Prüfen ob `dist/` im Tracking ist.

## Plan (Priorität)

1. Prüfen ob `dist/` oder andere build-Artefakte im Tracking sind, ggf. aus Git entfernen.
2. README-Statuszeile auf Schritt 3 aktualisieren.
3. Remote `origin` auf `https://github.com/tobbynaish/camly.git` setzen.
4. Repo auf GitHub anlegen (`gh repo create tobbynaish/camly --public --source=.` oder passender Aufruf).
5. `git push -u origin main`.
6. Tag `v0.1` anlegen, `git push origin v0.1`.
7. GitHub-Release mit `gh release create v0.1` anlegen (optional, aber sauber für Freigabe).
8. Verifikation: `gh repo view tobbynaish/camly`, README-Render via API prüfen, Tag prüfen.

## Aufwand
Klein. Alles Vorhandene ist sauber, nur Remote, Tag und README-Status fehlen.

## Offen nach Abschluss
- Deploy/Hosting ist nicht Teil des Goals.
- Keine Secrets zu setzen.