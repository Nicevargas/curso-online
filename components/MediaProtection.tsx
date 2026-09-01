'use client';

import { useEffect } from 'react';

/**
 * Componente de proteção de mídia contra inspeção e download direto:
 * - Desabilita botão direito / menu de contexto em vídeos e iframes
 * - Bloqueia atalhos de desenvolvedor conhecidos (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+S)
 * - Desabilita drag and drop de elementos de mídia
 */
export default function MediaProtection() {
  useEffect(() => {
    // Bloquear clique direito (menu de contexto) em vídeos, players e iframes
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Se for vídeo, iframe, canvas, imagem de player ou seletor de player
      if (
        target.tagName === 'VIDEO' ||
        target.tagName === 'IFRAME' ||
        target.closest('video') ||
        target.closest('iframe') ||
        target.closest('.aspect-video') ||
        target.closest('[data-protected-video]')
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // Bloquear atalhos comuns de inspeção (F12, Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+S)
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        return false;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl) {
        // Ctrl+Shift+I (Inspecionar)
        // Ctrl+Shift+J (Console)
        // Ctrl+Shift+C (Inspecionar elemento)
        if (e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
          e.preventDefault();
          return false;
        }

        // Ctrl+U (Ver código fonte)
        if (e.key === 'U' || e.key === 'u') {
          e.preventDefault();
          return false;
        }

        // Ctrl+S (Salvar página/arquivo)
        if (e.key === 'S' || e.key === 's') {
          e.preventDefault();
          return false;
        }
      }
    };

    // Prevenir arrastar imagens/vídeos
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'VIDEO' ||
          target.tagName === 'IFRAME' ||
          target.tagName === 'IMG' ||
          target.closest('.aspect-video'))
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('dragstart', handleDragStart, true);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('dragstart', handleDragStart, true);
    };
  }, []);

  return null;
}
