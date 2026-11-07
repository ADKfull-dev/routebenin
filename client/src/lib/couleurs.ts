/**
 * Couleurs des livreurs (mode multi-livreurs) : palette catégorielle validée
 * (ordre fixe, jamais recyclé). Un livreur garde toujours la même couleur.
 */
export const COULEURS_LIVREURS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'] as const;

export const couleurLivreur = (i: number) => COULEURS_LIVREURS[i % COULEURS_LIVREURS.length];

export const NOMBRE_MAX_LIVREURS = COULEURS_LIVREURS.length;

/** Couleur de texte lisible sur un fond donné (blanc ou encre selon la luminance). */
export function encreSur(hex: string): string {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  // Contraste avec blanc vs avec encre (#171B3F, L ≈ 0.011)
  return (1.05 / (L + 0.05) >= (L + 0.05) / 0.061) ? '#ffffff' : '#171B3F';
}
