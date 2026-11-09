/**
 * Equipe — mode comptes : membres de l'entreprise (l'administrateur en ajoute
 * et en retire) et changement de son propre mot de passe.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, Trash2, UserPlus } from 'lucide-react';
import { api, ApiError, type Membre } from '../lib/api';
import { useSession } from '../lib/session';
import { useToast } from './Toast';
import { SECTION, Spinner } from './ui';

export function Equipe() {
  const { etat } = useSession();
  const toast = useToast();
  const moi = etat?.utilisateur;
  const admin = moi?.role === 'admin';
  const [membres, setMembres] = useState<Membre[] | null>(null);
  const [nouveau, setNouveau] = useState({ nom: '', email: '', motDePasse: '', role: 'membre' as 'admin' | 'membre' });
  const [envoi, setEnvoi] = useState(false);
  const [mdp, setMdp] = useState({ actuel: '', nouveau: '' });

  useEffect(() => {
    if (!moi) return;
    api.listerEquipe().then(setMembres, () => setMembres([]));
  }, [moi]);

  if (!etat?.comptes || !moi) return null;

  const erreur = (e: unknown, defaut: string) => toast.erreur(e instanceof ApiError ? e.message : defaut);

  const ajouter = async (e: FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    try {
      const m = await api.ajouterMembre(nouveau);
      setMembres((l) => [...(l ?? []), m]);
      toast.succes(`${m.nom} peut se connecter avec ${m.email} et le mot de passe choisi.`);
      setNouveau({ nom: '', email: '', motDePasse: '', role: 'membre' });
    } catch (err) {
      erreur(err, 'Ajout impossible.');
    } finally {
      setEnvoi(false);
    }
  };

  const retirer = async (m: Membre) => {
    try {
      await api.retirerMembre(m.id);
      setMembres((l) => (l ?? []).filter((x) => x.id !== m.id));
      toast.succes(`${m.nom} n’a plus accès à RouteBénin.`);
    } catch (err) {
      erreur(err, 'Retrait impossible.');
    }
  };

  const changerMdp = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.changerMotDePasse(mdp.actuel, mdp.nouveau);
      setMdp({ actuel: '', nouveau: '' });
      toast.succes('Mot de passe changé. Vos autres appareils sont déconnectés.');
    } catch (err) {
      erreur(err, 'Changement impossible.');
    }
  };

  return (
    <>
      <section className={SECTION}>
        <h2 className="text-lg font-semibold">Équipe — {etat.entreprise?.nom}</h2>
        <p className="aide mt-0.5">Tous les membres voient et enregistrent les tournées de l’entreprise.</p>
        {membres === null ? (
          <Spinner className="mt-4 h-5 w-5" />
        ) : (
          <ul className="mt-3 divide-y divide-ligne rounded-md border border-ligne">
            {membres.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.nom}
                    {m.id === moi.id && <span className="text-encre/50"> (vous)</span>}
                  </p>
                  <p className="truncate text-sm text-encre/55">{m.email}</p>
                </div>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${m.role === 'admin' ? 'bg-encre text-white' : 'bg-sol text-encre'}`}>
                  {m.role === 'admin' ? 'Admin' : 'Membre'}
                </span>
                {admin && m.id !== moi.id && (
                  <button type="button" onClick={() => retirer(m)} aria-label={`Retirer ${m.nom}`} className="flex h-8 w-8 items-center justify-center rounded-md text-encre/40 hover:bg-alerte-50 hover:text-alerte">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {admin && (
          <form onSubmit={ajouter} className="mt-4 grid gap-2 sm:grid-cols-2">
            <input className="champ" placeholder="Nom" aria-label="Nom du membre" value={nouveau.nom} onChange={(e) => setNouveau({ ...nouveau, nom: e.target.value })} required />
            <input className="champ" type="email" placeholder="E-mail" aria-label="E-mail du membre" value={nouveau.email} onChange={(e) => setNouveau({ ...nouveau, email: e.target.value })} required />
            <input className="champ" type="text" placeholder="Mot de passe (8 caractères min.)" aria-label="Mot de passe du membre" autoComplete="off" value={nouveau.motDePasse} onChange={(e) => setNouveau({ ...nouveau, motDePasse: e.target.value })} minLength={8} required />
            <select className="champ" aria-label="Rôle" value={nouveau.role} onChange={(e) => setNouveau({ ...nouveau, role: e.target.value as 'admin' | 'membre' })}>
              <option value="membre">Membre</option>
              <option value="admin">Administrateur</option>
            </select>
            <button type="submit" disabled={envoi} className="btn-encre sm:col-span-2">
              {envoi ? <Spinner /> : <UserPlus className="h-5 w-5" />} Ajouter à l’équipe
            </button>
            <p className="aide sm:col-span-2">Transmettez-lui l’e-mail et le mot de passe ; il pourra le changer ici.</p>
          </form>
        )}
      </section>

      <section className={SECTION}>
        <h2 className="mb-3 text-lg font-semibold">Mon mot de passe</h2>
        <form onSubmit={changerMdp} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input className="champ" type="password" placeholder="Actuel" aria-label="Mot de passe actuel" autoComplete="current-password" value={mdp.actuel} onChange={(e) => setMdp({ ...mdp, actuel: e.target.value })} required />
          <input className="champ" type="password" placeholder="Nouveau (8 caractères min.)" aria-label="Nouveau mot de passe" autoComplete="new-password" minLength={8} value={mdp.nouveau} onChange={(e) => setMdp({ ...mdp, nouveau: e.target.value })} required />
          <button type="submit" className="btn-secondaire">
            <KeyRound className="h-5 w-5" /> Changer
          </button>
        </form>
      </section>
    </>
  );
}
