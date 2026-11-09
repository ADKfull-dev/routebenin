import { describe, expect, it } from 'vitest';
import { sansMotsGeneriques } from './nominatim.js';

describe('sansMotsGeneriques (second essai Nominatim)', () => {
  it('retire « carrefour », « marché », etc. en gardant les accents', () => {
    expect(sansMotsGeneriques('Carrefour Étoile Rouge')).toBe('Étoile Rouge');
    expect(sansMotsGeneriques('Pharmacie de Cadjèhoun')).toBe('Cadjèhoun');
    expect(sansMotsGeneriques('marché Ganhi')).toBe('Ganhi');
  });
  it('ne change rien quand il n’y a rien à retirer, ou qu’il ne resterait rien', () => {
    expect(sansMotsGeneriques('Godomey Togoudo')).toBeNull();
    expect(sansMotsGeneriques('Carrefour')).toBeNull();
  });
});
