/**
 * cache.ts — Cache mémoire simple (TTL) + file d'attente pour limiter le débit.
 *
 * Utilisé pour respecter la politique de Nominatim (1 requête/seconde max) et
 * pour éviter les appels réseau répétés (mêmes adresses).
 */

interface Entree<T> {
  valeur: T;
  expire: number;
}

/** Cache clé→valeur avec expiration. */
export class CacheTTL<T> {
  private readonly store = new Map<string, Entree<T>>();
  constructor(private readonly ttlMs: number) {}

  get(cle: string): T | undefined {
    const e = this.store.get(cle);
    if (!e) return undefined;
    if (Date.now() > e.expire) {
      this.store.delete(cle);
      return undefined;
    }
    return e.valeur;
  }

  set(cle: string, valeur: T): void {
    this.store.set(cle, { valeur, expire: Date.now() + this.ttlMs });
  }
}

/**
 * Limiteur de débit : garantit un intervalle minimal entre deux exécutions.
 * Les appels sont sérialisés (mis en file) pour ne jamais dépasser la cadence.
 */
export class LimiteurDebit {
  private dernier = 0;
  private chaine: Promise<unknown> = Promise.resolve();

  constructor(private readonly intervalleMs: number) {}

  /** Exécute `tache` en respectant l'intervalle minimal depuis le dernier appel. */
  planifier<T>(tache: () => Promise<T>): Promise<T> {
    const resultat = this.chaine.then(async () => {
      const attente = this.intervalleMs - (Date.now() - this.dernier);
      if (attente > 0) await new Promise((r) => setTimeout(r, attente));
      this.dernier = Date.now();
      return tache();
    });
    // La chaîne continue même si une tâche échoue.
    this.chaine = resultat.catch(() => undefined);
    return resultat;
  }
}
