/**
 * Converte links do Google Drive para links diretos de download/visualização
 * que podem ser usados como src em tags de imagem.
 */
export function getDirectDriveLink(url: string | null | undefined): string {
  if (!url) return '';
  
  // Se não for um link do Google Drive, retorna a URL original
  if (!url.includes('drive.google.com')) return url;

  try {
    // Tenta extrair o ID do arquivo de diferentes formatos de link do Drive
    // Formato 1: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    // Formato 2: https://drive.google.com/uc?id=FILE_ID
    // Formato 3: https://drive.google.com/open?id=FILE_ID
    
    let fileId = '';
    
    if (url.includes('/file/d/')) {
      fileId = url.split('/file/d/')[1].split('/')[0].split('?')[0];
    } else if (url.includes('id=')) {
      const urlParams = new URLSearchParams(url.split('?')[1]);
      fileId = urlParams.get('id') || '';
    }

    if (fileId) {
      // Retorna o link de visualização direta (thumbnail/uc)
      return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }
  } catch (e) {
    console.error('Erro ao converter link do Google Drive:', e);
  }

  return url;
}

/**
 * Converte URLs de vídeo comuns para formatos de incorporação (embed)
 */
export function getEmbedVideoUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const videoUrl = new URL(url);

    // YouTube
    if (videoUrl.hostname.includes('youtube.com') || videoUrl.hostname.includes('youtu.be')) {
      let videoId = '';
      if (videoUrl.hostname.includes('youtu.be')) {
        videoId = videoUrl.pathname.slice(1);
      } else {
        videoId = videoUrl.searchParams.get('v') || '';
      }
      if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    }

    // Vimeo
    if (videoUrl.hostname.includes('vimeo.com')) {
      const videoId = videoUrl.pathname.split('/').pop();
      if (videoId) return `https://player.vimeo.com/video/${videoId}?autoplay=1`;
    }

    // Google Drive Video
    if (videoUrl.hostname.includes('drive.google.com')) {
      let fileId = '';
      if (url.includes('/file/d/')) {
        fileId = url.split('/file/d/')[1].split('/')[0];
      } else if (url.includes('id=')) {
        fileId = videoUrl.searchParams.get('id') || '';
      }
      if (fileId) return `https://drive.google.com/file/d/${fileId}/preview`;
    }
  } catch (e) {
    // Se não for uma URL válida, retorna a original
    return url;
  }

  return url;
}
