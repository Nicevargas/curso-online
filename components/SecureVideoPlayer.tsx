'use client';

import { useMemo } from 'react';
import { getEmbedVideoUrl } from '@/lib/utils';

interface SecureVideoPlayerProps {
  url?: string | null;
  title?: string;
  className?: string;
  /**
   * Camada extra: isola o player (bloqueia popups e downloads iniciados por ele).
   * Desligado por padrão porque o player do Google Drive pode deixar de tocar em
   * alguns navegadores quando isolado — ligue só depois de testar com uma aula real.
   */
  isolate?: boolean;
}

/**
 * Player das aulas.
 *
 * A aula é assistida dentro da plataforma: o botão "abrir em nova guia" que o Google
 * Drive desenha no canto superior direito fica coberto (a área não recebe mais o
 * clique), e o menu de contexto e o arrastar estão bloqueados sobre o vídeo.
 *
 * IMPORTANTE: nenhuma dessas medidas impede o download de verdade — quem souber
 * abrir as ferramentas do navegador ainda alcança o arquivo. A trava real é no
 * próprio Google Drive: no compartilhamento de cada vídeo, clique na engrenagem e
 * DESMARQUE "Os leitores podem baixar, imprimir e copiar".
 */
export default function SecureVideoPlayer({
  url,
  title,
  className = '',
  isolate = false,
}: SecureVideoPlayerProps) {
  const embedUrl = useMemo(() => getEmbedVideoUrl(url), [url]);
  const isDrive = useMemo(() => Boolean(url && url.includes('drive.google.com')), [url]);

  if (!embedUrl) {
    return (
      <div className={`w-full h-full bg-black flex items-center justify-center ${className}`}>
        <p className="text-sm text-slate-400">Vídeo indisponível para esta aula.</p>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full h-full bg-black overflow-hidden select-none ${className}`}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <iframe
        src={embedUrl}
        title={title || 'Aula'}
        className="w-full h-full border-0"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        {...(isolate ? { sandbox: 'allow-scripts allow-same-origin allow-presentation' } : {})}
        allowFullScreen
      />

      {/*
        Tapa o canto superior direito, onde o Drive desenha o botão de abrir fora.
        Fica acima do iframe, então o clique não chega ao botão.
      */}
      {isDrive && (
        <div
          aria-hidden="true"
          className="absolute top-0 right-0 h-14 w-16 sm:h-16 sm:w-20 bg-black"
          style={{ pointerEvents: 'auto' }}
        />
      )}
    </div>
  );
}
