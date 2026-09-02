'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { authHeaders } from './checkout';
import {
  BusinessSheetData,
  EMPTY_BUSINESS_SHEET,
  generatePromptBlock,
  getLocalBusinessSheet,
  saveLocalBusinessSheet,
} from './businessSheet';

const REQUIRED_FIELDS: (keyof BusinessSheetData)[] = [
  'business_name',
  'segment',
  'what_you_sell',
  'target_audience',
  'main_benefit',
  'tone_of_voice',
  'contact_channel',
];

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Estado e ações da Ficha do Negócio, compartilhados pela página e pelo modal
 * (antes os dois arquivos tinham a mesma lógica copiada, ~700 linhas duplicadas).
 */
export function useBusinessSheet(active: boolean) {
  const [formData, setFormData] = useState<BusinessSheetData>(EMPTY_BUSINESS_SHEET);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  // ---------- Carregar ----------
  useEffect(() => {
    if (!active) return;
    let isMounted = true;

    (async () => {
      setLoading(true);
      const local = getLocalBusinessSheet();
      if (isMounted) setFormData(local);

      try {
        const res = await fetch('/api/ficha', { headers: await authHeaders() });
        if (res.ok) {
          const { sheet } = await res.json();
          if (sheet && isMounted) {
            const merged: BusinessSheetData = {
              business_name: sheet.business_name || local.business_name || '',
              segment: sheet.segment || local.segment || '',
              what_you_sell: sheet.what_you_sell || local.what_you_sell || '',
              target_audience: sheet.target_audience || local.target_audience || '',
              main_benefit: sheet.main_benefit || local.main_benefit || '',
              tone_of_voice: sheet.tone_of_voice || local.tone_of_voice || 'Amigável',
              brand_colors:
                Array.isArray(sheet.brand_colors) && sheet.brand_colors.length > 0
                  ? sheet.brand_colors
                  : local.brand_colors || EMPTY_BUSINESS_SHEET.brand_colors,
              contact_channel: sheet.contact_channel || local.contact_channel || 'WhatsApp',
            };
            setFormData(merged);
            saveLocalBusinessSheet(merged);
          }
        }
      } catch (err) {
        console.warn('Não foi possível carregar a ficha do servidor:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [active]);

  // ---------- Salvar ----------
  const save = useCallback(
    async (data: BusinessSheetData = formData): Promise<boolean> => {
      setSaveState('saving');
      setError(null);
      saveLocalBusinessSheet(data);

      try {
        const res = await fetch('/api/ficha', {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({ data }),
        });

        // Antes o botão mostrava "Salvo com sucesso" mesmo quando o servidor devolvia erro.
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Falha ao salvar (${res.status})`);
        }

        dirty.current = false;
        setSaveState('saved');
        setSavedAt(new Date());
        setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 3000);
        return true;
      } catch (err: any) {
        console.error('Erro ao salvar a ficha:', err);
        setError(err?.message || 'Não foi possível salvar no servidor. Seus dados ficaram salvos neste navegador.');
        setSaveState('error');
        return false;
      }
    },
    [formData]
  );

  // ---------- Alterações + auto-save ----------
  const updateField = useCallback(
    (field: keyof BusinessSheetData, value: any) => {
      setFormData((prev) => {
        const updated = { ...prev, [field]: value };
        saveLocalBusinessSheet(updated);
        dirty.current = true;

        if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
        autosaveTimer.current = setTimeout(() => {
          if (dirty.current) save(updated);
        }, 1500);

        return updated;
      });
    },
    [save]
  );

  const updateColor = useCallback(
    (index: number, key: 'name' | 'hex', value: string) => {
      setFormData((prev) => {
        const colors = [...(prev.brand_colors || [])];
        if (!colors[index]) colors[index] = { name: '', hex: '#7311D4' };
        colors[index] = { ...colors[index], [key]: value };
        const updated = { ...prev, brand_colors: colors };
        saveLocalBusinessSheet(updated);
        dirty.current = true;

        if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
        autosaveTimer.current = setTimeout(() => {
          if (dirty.current) save(updated);
        }, 1500);

        return updated;
      });
    },
    [save]
  );

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  // ---------- Derivados ----------
  const filledCount = REQUIRED_FIELDS.filter((f) => String(formData[f] || '').trim().length > 0).length;
  const completeness = Math.round((filledCount / REQUIRED_FIELDS.length) * 100);

  const copyPrompt = useCallback(async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(generatePromptBlock(formData));
      return true;
    } catch {
      return false;
    }
  }, [formData]);

  return {
    formData,
    setFormData,
    loading,
    saveState,
    savedAt,
    error,
    save,
    updateField,
    updateColor,
    copyPrompt,
    completeness,
    filledCount,
    totalFields: REQUIRED_FIELDS.length,
  };
}
