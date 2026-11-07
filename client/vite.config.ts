import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Liste récursive des fichiers de public/ (copiés tels quels dans dist/). */
function fichiersPublics(dossier: string, racine = dossier): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiersPublics(chemin, racine) : [relative(racine, chemin)];
  });
}

/**
 * Génère dist/sw.js à partir de pwa/sw.js : y injecte la liste des fichiers à
 * pré-cacher (sortie du build + public/) et une version = empreinte de leur
 * contenu. Chaque build qui change un fichier produit donc un nouveau service
 * worker, que le navigateur détecte comme une mise à jour.
 */
function pwaServiceWorker(): Plugin {
  return {
    name: 'routebenin-pwa',
    apply: 'build',
    generateBundle(_options, bundle) {
      const publics = fichiersPublics('public').map((f) => f.split('\\').join('/'));
      const fichiers = [
        ...new Set(['index.html', ...Object.keys(bundle).filter((f) => !f.endsWith('.map')), ...publics]),
      ];
      const empreinte = createHash('sha256').update(readFileSync('pwa/sw.js'));
      for (const f of Object.keys(bundle).sort()) {
        const item = bundle[f];
        empreinte.update(f).update(item.type === 'chunk' ? item.code : item.source);
      }
      for (const f of publics) empreinte.update(f).update(readFileSync(join('public', f)));
      const version = empreinte.digest('hex').slice(0, 12);
      const source = readFileSync('pwa/sw.js', 'utf8')
        .replace("const VERSION = '__VERSION__';", `const VERSION = '${version}';`)
        .replace('const PRECACHE = __PRECACHE__;', `const PRECACHE = ${JSON.stringify(fichiers, null, 2)};`);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// En développement, les appels à /api sont redirigés vers le serveur Express.
export default defineConfig({
  // Base configurable : '/' en dev, '/routebenin/' pour GitHub Pages (via VITE_BASE).
  base: process.env.VITE_BASE || '/',
  plugins: [react(), pwaServiceWorker()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
