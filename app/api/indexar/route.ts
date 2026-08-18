import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { extractText } from 'unpdf';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Chunking helper: ~1200 characters with ~200 overlap, breaking on punctuation
function chunkText(text: string, chunkSize = 1200, overlap = 200): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < clean.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex >= clean.length) {
      chunks.push(clean.slice(startIndex).trim());
      break;
    }

    const searchSlice = clean.slice(startIndex, endIndex);
    const lastPunctuation = Math.max(
      searchSlice.lastIndexOf('. '),
      searchSlice.lastIndexOf('! '),
      searchSlice.lastIndexOf('? '),
      searchSlice.lastIndexOf('.\n'),
      searchSlice.lastIndexOf('\n')
    );

    if (lastPunctuation > chunkSize * 0.6) {
      endIndex = startIndex + lastPunctuation + 1;
    }

    const chunk = clean.slice(startIndex, endIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    startIndex = Math.max(startIndex + 1, endIndex - overlap);
  }

  return chunks;
}

// Vector Normalization to Unit Length (L2 norm = 1)
function normalizeVector(vector: number[]): number[] {
  const sumSquares = vector.reduce((sum, val) => sum + val * val, 0);
  const norm = Math.sqrt(sumSquares);
  if (norm === 0) return vector;
  return vector.map(val => val / norm);
}

export async function POST(req: NextRequest) {
  try {
    const { arquivo, nome, link } = await req.json();

    if (!arquivo || !nome) {
      return NextResponse.json(
        { error: 'Parâmetros "arquivo" e "nome" são obrigatórios.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY não configurada no servidor. Por favor, adicione sua chave nos Secrets/Configurações.' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    // 1. Download PDF from Storage bucket "workshop"
    const { data: fileBlob, error: downloadError } = await supabase
      .storage
      .from('workshop')
      .download(arquivo);

    if (downloadError || !fileBlob) {
      console.error(`Erro ao baixar ${arquivo} do Storage:`, downloadError);
      return NextResponse.json(
        { error: `Falha ao baixar arquivo "${arquivo}" do Storage: ${downloadError?.message || 'Arquivo não encontrado'}` },
        { status: 404 }
      );
    }

    // Convert Blob to ArrayBuffer for unpdf
    const arrayBuffer = await fileBlob.arrayBuffer();

    // 2. Extract text with unpdf
    const pdfData = await extractText(new Uint8Array(arrayBuffer));
    const extractedText = Array.isArray(pdfData.text) ? pdfData.text.join('\n\n') : (pdfData.text || '');

    // 3. If no text found, return status: "vazio"
    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json({ status: 'vazio', message: 'Nenhum texto extraível encontrado (possível imagem escaneada)' });
    }

    // 4. Calculate SHA256 of extracted text
    const textHash = crypto.createHash('sha256').update(extractedText).digest('hex');

    // Check if document already exists with identical hash
    const { data: existingDoc } = await supabase
      .from('kb_documentos')
      .select('id, hash')
      .eq('origem_id', arquivo)
      .maybeSingle();

    if (existingDoc && existingDoc.hash === textHash) {
      return NextResponse.json({
        status: 'sem alteracao',
        message: 'O documento já está indexado e o conteúdo não foi alterado.',
      });
    }

    // 5. Upsert into kb_documentos (onConflict: origem_id)
    const { data: docRecord, error: upsertError } = await supabase
      .from('kb_documentos')
      .upsert(
        {
          origem_id: arquivo,
          nome: nome,
          tipo: 'pdf',
          link: link || null,
          hash: textHash,
          modificado_em: new Date().toISOString(),
        },
        { onConflict: 'origem_id' }
      )
      .select('id')
      .single();

    if (upsertError || !docRecord) {
      console.error('Erro no upsert em kb_documentos:', upsertError);
      return NextResponse.json(
        { error: `Erro ao gravar em kb_documentos: ${upsertError?.message}` },
        { status: 500 }
      );
    }

    const documentoId = docRecord.id;

    // 6. Delete old chunks for this document
    await supabase
      .from('kb_chunks')
      .delete()
      .eq('documento_id', documentoId);

    // 7. Split text into chunks (~1200 chars, ~200 overlap)
    const rawChunks = chunkText(extractedText, 1200, 200);

    if (rawChunks.length === 0) {
      return NextResponse.json({ status: 'vazio', message: 'Nenhum pedaço pôde ser gerado.' });
    }

    // 8. Generate embeddings with OpenAI text-embedding-3-small (dimensions: 1536)
    const batchSize = 50;
    const allChunksData: { documento_id: string; indice: number; conteudo: string; embedding: number[] }[] = [];

    for (let i = 0; i < rawChunks.length; i += batchSize) {
      const batch = rawChunks.slice(i, i + batchSize);

      const embedResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch,
        dimensions: 1536,
      });

      const embeddingsList = embedResponse.data || [];

      for (let j = 0; j < batch.length; j++) {
        const rawVector = embeddingsList[j]?.embedding || [];
        const normalizedVector = normalizeVector(rawVector);

        allChunksData.push({
          documento_id: documentoId,
          indice: i + j,
          conteudo: batch[j],
          embedding: normalizedVector,
        });
      }
    }

    // 9. Insert chunks into kb_chunks in batches of 100
    for (let i = 0; i < allChunksData.length; i += 100) {
      const insertBatch = allChunksData.slice(i, i + 100);
      const { error: insertError } = await supabase
        .from('kb_chunks')
        .insert(insertBatch);

      if (insertError) {
        console.error('Erro ao inserir chunks:', insertError);
        return NextResponse.json(
          { error: `Erro ao gravar chunks no banco: ${insertError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      status: 'ok',
      pedacos: allChunksData.length,
      arquivo,
      nome,
    });
  } catch (error: any) {
    console.error('Erro geral na rota /api/indexar:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno ao indexar documento.' },
      { status: 500 }
    );
  }
}
