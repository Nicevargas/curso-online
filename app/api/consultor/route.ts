import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

// Vector Normalization to Unit Length (L2 norm = 1)
function normalizeVector(vector: number[]): number[] {
  const sumSquares = vector.reduce((sum, val) => sum + val * val, 0);
  const norm = Math.sqrt(sumSquares);
  if (norm === 0) return vector;
  return vector.map(val => val / norm);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pergunta = body.pergunta || body.prompt || (Array.isArray(body.messages) ? body.messages[body.messages.length - 1]?.content : '');

    if (!pergunta || typeof pergunta !== 'string' || !pergunta.trim()) {
      return NextResponse.json(
        { error: 'A pergunta é obrigatória.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY não configurada no servidor. Por favor, adicione sua chave nas configurações.' },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdmin();
    const openai = new OpenAI({ apiKey });

    // 1. Generate query embedding with OpenAI text-embedding-3-small (1536 dims)
    const embedResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: pergunta.trim(),
      dimensions: 1536,
    });

    const rawEmbedding = embedResponse.data?.[0]?.embedding || [];
    if (rawEmbedding.length === 0) {
      return NextResponse.json(
        { error: 'Não foi possível gerar o embedding da consulta com a OpenAI.' },
        { status: 500 }
      );
    }

    // 2. Normalize vector to unit length
    const normalizedEmbedding = normalizeVector(rawEmbedding);

    // 3. Call supabase.rpc("kb_buscar_chunks", { consulta: vetor, qtd: 8, limiar: 0.15 })
    const { data: chunks, error: rpcError } = await supabase.rpc('kb_buscar_chunks', {
      consulta: normalizedEmbedding,
      qtd: 8,
      limiar: 0.15,
    });

    if (rpcError) {
      console.error('Erro na RPC kb_buscar_chunks:', rpcError);
      return NextResponse.json(
        { error: `Erro na busca vetorial da base de conhecimento: ${rpcError.message}` },
        { status: 500 }
      );
    }

    // If no chunks found in the database
    if (!chunks || chunks.length === 0) {
      return NextResponse.json({
        resposta: 'Este assunto não foi encontrado no material do workshop Canva com IA. Para obter informações precisas, consulte os tópicos abordados nos módulos ou refaça a pergunta com outros termos.',
        text: 'Este assunto não foi encontrado no material do workshop Canva com IA. Para obter informações precisas, consulte os tópicos abordados nos módulos ou refaça a pergunta com outros termos.',
        fontes: [],
      });
    }

    // 4. Assemble context with [1], [2] numbering and file references
    const fontesMap = new Map<number, { numero: number; nome: string; link: string | null; similaridade: number }>();
    const contextLines: string[] = [];

    chunks.forEach((chunk: any, index: number) => {
      const sourceNum = index + 1;
      const docName = chunk.documento_nome || chunk.nome || 'Material do Workshop';
      const docLink = chunk.documento_link || chunk.link || null;
      const similarity = chunk.similaridade ? Number(chunk.similaridade) : 0;

      fontesMap.set(sourceNum, {
        numero: sourceNum,
        nome: docName,
        link: docLink,
        similaridade: similarity,
      });

      contextLines.push(`[${sourceNum}] Fonte: ${docName}\nConteúdo: ${chunk.conteudo}\n`);
    });

    const contextText = contextLines.join('\n---\n\n');

    // 5. Generate response using OpenAI gpt-4o-mini
    const systemMessage = `Você é a consultora do workshop Canva com IA. Responda usando apenas os trechos do material fornecidos. Cite a fonte entre colchetes, como [1], a cada afirmação. Se os trechos não contiverem a resposta, diga isso com todas as letras em vez de deduzir ou inventar. Fale em português do Brasil, direto e sem enrolação.`;

    const userMessage = `Trechos do material do workshop:\n\n${contextText}\n\nPergunta do aluno: ${pergunta.trim()}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
    });

    const resposta = completion.choices?.[0]?.message?.content || 'Não foi possível gerar a resposta.';
    const fontes = Array.from(fontesMap.values());

    return NextResponse.json({
      resposta,
      text: resposta,
      fontes,
    });
  } catch (error: any) {
    console.error('Erro na rota /api/consultor:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro ao processar consulta com a OpenAI.' },
      { status: 500 }
    );
  }
}
