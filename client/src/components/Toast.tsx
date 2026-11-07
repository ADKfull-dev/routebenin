/**
 * Système de notifications discrètes (toasts).
 * Usage : const toast = useToast(); toast.succes('...'), toast.erreur('...').
 */
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type TypeToast = 'succes' | 'erreur' | 'info';
interface Toast {
  id: number;
  type: TypeToast;
  message: string;
}

interface ContexteToast {
  succes: (m: string) => void;
  erreur: (m: string) => void;
  info: (m: string) => void;
}

const Contexte = createContext<ContexteToast | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const retirer = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const ajouter = useCallback(
    (type: TypeToast, message: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, type, message }]);
      setTimeout(() => retirer(id), 4500);
    },
    [retirer],
  );

  const valeur: ContexteToast = {
    succes: (m) => ajouter('succes', m),
    erreur: (m) => ajouter('erreur', m),
    info: (m) => ajouter('info', m),
  };

  return (
    <Contexte.Provider value={valeur}>
      {children}
      <div
        className="fixed inset-x-4 top-[60px] z-[1000] flex flex-col gap-2 md:inset-x-auto md:bottom-5 md:right-5 md:top-auto md:w-[22rem]"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => retirer(t.id)} />
        ))}
      </div>
    </Contexte.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const styles: Record<TypeToast, string> = {
    succes: 'text-[#5FD3A4]',
    erreur: 'text-[#FF8A80]',
    info: 'text-zem',
  };
  const Icone = toast.type === 'succes' ? CheckCircle2 : toast.type === 'erreur' ? AlertCircle : Info;
  return (
    <div
      className="flex items-start gap-3 rounded-md bg-encre px-4 py-3 text-white shadow-pop"
      role="status"
    >
      <Icone className={`mt-0.5 h-5 w-5 shrink-0 ${styles[toast.type]}`} />
      <p className="flex-1 text-[0.9375rem]">{toast.message}</p>
      <button onClick={onClose} aria-label="Fermer" className="text-white/50 hover:text-white">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function useToast(): ContexteToast {
  const ctx = useContext(Contexte);
  if (!ctx) throw new Error('useToast doit être utilisé dans un ToastProvider.');
  return ctx;
}
