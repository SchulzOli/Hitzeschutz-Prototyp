import { defineConfig } from 'vite';

// Relative Pfade, damit die Seite unter https://<user>.github.io/Hitzeschutz-Prototyp/
// genauso läuft wie lokal oder auf einem kommunalen Webserver.
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  test: { environment: 'node' },
});
