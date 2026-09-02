'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X, Sparkles } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info' | 'reward';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  detail?: string;
}

interface ToastApi {
  toast: (message: string, options?: { kind?: ToastKind; detail?: string; duration?: number }) => void;
  success: (message: string, detail?: string) => void;
  error: (message: string, detail?: string) => void;
  reward: (message: string, detail?: string) => void;
  /** Chuva de confete para celebrar conclusões. */
  celebrate: (intensity?: 'normal' | 'big') => void;
}

const ToastContext = createContext<ToastApi>({
  toast: () => {},
  success: () => {},
  error: () => {},
  reward: () => {},
  celebrate: () => {},
});

const STYLES: Record<ToastKind, { icon: typeof CheckCircle2; className: string }> = {
  success: { icon: CheckCircle2, className: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' },
  error: { icon: AlertCircle, className: 'bg-red-500/15 border-red-500/30 text-red-400' },
  info: { icon: Info, className: 'bg-primary/15 border-primary/30 text-primary' },
  reward: { icon: Sparkles, className: 'bg-accent-gold/15 border-accent-gold/30 text-accent-gold' },
};

const CONFETTI_COLORS = ['#7311d4', '#a855f7', '#d4af37', '#10b981', '#f97316', '#ec4899'];

interface Confetti {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  rotate: number;
  size: number;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confetti, setConfetti] = useState<Confetti[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastApi['toast']>(
    (message, options) => {
      const id = Date.now() + Math.random();
      const duration = options?.duration ?? 4000;
      setToasts((prev) => [...prev.slice(-2), { id, kind: options?.kind || 'info', message, detail: options?.detail }]);
      setTimeout(() => remove(id), duration);
    },
    [remove]
  );

  const celebrate = useCallback((intensity: 'normal' | 'big' = 'normal') => {
    if (typeof window === 'undefined') return;
    // Respeita quem prefere menos animação.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;

    const count = intensity === 'big' ? 90 : 40;
    const pieces: Confetti[] = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      duration: 1.8 + Math.random() * 1.4,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotate: Math.random() * 720 - 360,
      size: 6 + Math.random() * 8,
    }));
    setConfetti(pieces);
    setTimeout(() => setConfetti([]), 3600);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (message, detail) => toast(message, { kind: 'success', detail }),
      error: (message, detail) => toast(message, { kind: 'error', detail, duration: 6000 }),
      reward: (message, detail) => toast(message, { kind: 'reward', detail }),
      celebrate,
    }),
    [toast, celebrate]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Toasts */}
      <div className="fixed bottom-24 sm:bottom-6 right-4 left-4 sm:left-auto z-[200] flex flex-col items-end gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => {
            const { icon: Icon, className } = STYLES[t.kind];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className={`pointer-events-auto w-full sm:w-auto sm:min-w-[280px] sm:max-w-sm backdrop-blur-xl border rounded-2xl px-4 py-3 shadow-2xl flex items-start gap-3 ${className}`}
              >
                <Icon className="size-5 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold leading-snug">{t.message}</p>
                  {t.detail && <p className="text-xs opacity-80 mt-0.5 leading-snug">{t.detail}</p>}
                </div>
                <button
                  onClick={() => remove(t.id)}
                  className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                  aria-label="Fechar aviso"
                >
                  <X className="size-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Confete */}
      {confetti.length > 0 && (
        <div className="fixed inset-0 z-[300] pointer-events-none overflow-hidden" aria-hidden="true">
          {confetti.map((c) => (
            <motion.span
              key={c.id}
              initial={{ y: -40, opacity: 1, rotate: 0 }}
              animate={{ y: '105vh', opacity: [1, 1, 0], rotate: c.rotate }}
              transition={{ duration: c.duration, delay: c.delay, ease: 'easeIn' }}
              style={{
                position: 'absolute',
                left: `${c.left}%`,
                width: c.size,
                height: c.size * 1.6,
                backgroundColor: c.color,
                borderRadius: 2,
              }}
            />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
