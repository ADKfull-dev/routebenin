/**
 * ExportActions — partage de la feuille de route :
 * WhatsApp, copie du texte, feuille imprimable (PDF) et navigation Google Maps.
 */
import { useEffect, useState } from 'react';
import { Copy, FileText, MessageCircle, Navigation, Check } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from './Toast';
import type { ResultatOptimisation } from '../types';
import { SECTION } from './ui';
import { htmlFeuille, liensGoogleMaps, lienWhatsApp, texteFeuille, type InfosFeuille } from '../lib/feuilleRoute';

interface Props {
  resultat: ResultatOptimisation;
  boucle: boolean;
  nom?: string | null;
  /** Version compacte (WhatsApp + PDF), utilisée par livreur. */
  compact?: boolean;
}

export function ExportActions({ resultat, boucle, nom, compact = false }: Props) {
  const toast = useToast();
  const [entreprise, setEntreprise] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    let annule = false;
    api
      .obtenirProfil()
      .then((p) => !annule && setEntreprise(p.nomEntreprise))
      .catch(() => undefined);
    return () => {
      annule = true;
    };
  }, []);

  const infos: InfosFeuille = { resultat, boucle, nom, entreprise };
  const troncons = liensGoogleMaps(infos);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texteFeuille(infos));
      setCopie(true);
      toast.succes('Feuille de route copiée.');
      setTimeout(() => setCopie(false), 2000);
    } catch {
      toast.erreur('Copie impossible sur ce navigateur.');
    }
  };

  const ouvrirFeuille = () => {
    const html = htmlFeuille(infos);
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const w = window.open(url, '_blank');
    if (!w) toast.erreur('Autorisez les fenêtres pop-up pour ouvrir la feuille de route.');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  if (compact) {
    return (
      <div className="flex gap-2">
        <a href={lienWhatsApp(texteFeuille(infos))} target="_blank" rel="noopener noreferrer" className="btn-whatsapp flex-1 px-2 py-2 text-sm">
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
        <button type="button" onClick={ouvrirFeuille} className="btn-secondaire flex-1 px-2 py-2 text-sm">
          <FileText className="h-4 w-4" /> PDF
        </button>
        <button type="button" onClick={copier} className="btn-secondaire px-3 py-2 text-sm" aria-label="Copier le texte">
          {copie ? <Check className="h-4 w-4 text-gain" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    );
  }

  return (
    <section className={SECTION}>
      <h2 className="mb-3 text-lg font-semibold">Envoyer au livreur</h2>
      <a href={lienWhatsApp(texteFeuille(infos))} target="_blank" rel="noopener noreferrer" className="btn-whatsapp w-full py-3">
        <MessageCircle className="h-5 w-5" /> Envoyer sur WhatsApp
      </a>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button type="button" onClick={ouvrirFeuille} className="btn-secondaire px-2 text-sm">
          <FileText className="h-4 w-4" /> PDF
        </button>
        <button type="button" onClick={copier} className="btn-secondaire px-2 text-sm">
          {copie ? <Check className="h-4 w-4 text-gain" /> : <Copy className="h-4 w-4" />} {copie ? 'Copié' : 'Copier'}
        </button>
        <a href={troncons[0]?.lien} target="_blank" rel="noopener noreferrer" className="btn-secondaire px-2 text-sm">
          <Navigation className="h-4 w-4" /> Maps{troncons.length > 1 ? ` 1/${troncons.length}` : ''}
        </a>
      </div>
      {troncons.length > 1 && (
        <p className="aide mt-2">
          Google Maps accepte peu d’étapes par lien : la tournée est découpée en {troncons.length} parties. Le message
          WhatsApp et le PDF contiennent tous les liens.
        </p>
      )}
    </section>
  );
}
