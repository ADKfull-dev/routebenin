/**
 * ExportActions — partage de la feuille de route :
 * WhatsApp, copie du texte, feuille imprimable (PDF) et navigation Google Maps.
 */
import { useEffect, useState } from 'react';
import { Copy, FileText, MessageCircle, Navigation, Check } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from './Toast';
import type { ResultatOptimisation } from '../types';
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
        <a
          href={lienWhatsApp(texteFeuille(infos))}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primaire flex-1 justify-center bg-[#128C4B] px-2 py-1.5 text-xs hover:bg-[#0f7a41]"
        >
          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
        </a>
        <button type="button" onClick={ouvrirFeuille} className="btn-secondaire flex-1 justify-center px-2 py-1.5 text-xs">
          <FileText className="h-3.5 w-3.5" /> PDF
        </button>
        <button type="button" onClick={copier} className="btn-secondaire justify-center px-2 py-1.5 text-xs" aria-label="Copier le texte">
          {copie ? <Check className="h-3.5 w-3.5 text-succes" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    );
  }

  return (
    <section className="carte p-4">
      <p className="mb-3 text-sm font-semibold text-nuit">Envoyer au livreur</p>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={lienWhatsApp(texteFeuille(infos))}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primaire justify-center bg-[#128C4B] hover:bg-[#0f7a41]"
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
        <button type="button" onClick={ouvrirFeuille} className="btn-secondaire justify-center">
          <FileText className="h-4 w-4" /> Feuille PDF
        </button>
        <button type="button" onClick={copier} className="btn-secondaire justify-center">
          {copie ? <Check className="h-4 w-4 text-succes" /> : <Copy className="h-4 w-4" />} Copier le texte
        </button>
        <a
          href={troncons[0]?.lien}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondaire justify-center"
        >
          <Navigation className="h-4 w-4" /> Google Maps{troncons.length > 1 ? ` 1/${troncons.length}` : ''}
        </a>
      </div>
      {troncons.length > 1 && (
        <p className="mt-2 text-xs text-nuit/50">
          Google Maps limite le nombre d’étapes par lien sur mobile : la tournée est découpée en{' '}
          {troncons.length} tronçons (tous inclus dans le message WhatsApp et la feuille PDF).
        </p>
      )}
    </section>
  );
}
