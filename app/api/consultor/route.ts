import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
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
    // Support both { pergunta: string } and { prompt: string } or legacy { messages: [...] }
    const pergunta = body.pergunta || body.prompt || (Array.isArray(body.messages) ? body.messages[body.messages.length - 1]?.content : '');

    if (!pergunta || typeof pergunta !== 'string' || !pergunta.trim()) {
      return NextResponse.json(
        { error: 'A pergunta é obrigatória.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY não configurada no servidor.' },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdmin();
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // 2. Generate question embedding with gemini-embedding-001 (RETRIEVAL_QUERY)
    const embedResponse = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: pergunta.trim(),
      config: {
        outputDimensionality: 1536,
        taskType: 'RETRIEVAL_QUERY',
      },
    });

    const rawEmbedding = embedResponse.embeddings?.[0]?.values || (embedResponse as any).embedding?.values || [];
    if (rawEmbedding.length === 0) {
      return NextResponse.json(
        { error: 'Não foi possível gerar o embedding da consulta.' },
        { status: 500 }
      );
    }

    // 3. Normalize vector to unit length
    const normalizedEmbedding = normalizeVector(rawEmbedding);

    // 4. Call supabase.rpc("kb_buscar_chunks", { consulta: vetor, qtd: 8, limiar: 0.15 })
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

    // If no chunks returned, explicitly state that the topic is not in the material
    if (!chunks || chunks.length === 0) {
      return NextResponse.json({
        resposta: 'Este assunto não foi encontrado no material do workshop Canva com IA. Para obter informações precisas, consulte os tópicos abordados nos módulos ou refaça a pergunta com outros termos.',
        text: 'Este assunto não foi encontrado no material do workshop Canva com IA. Para obter informações precisas, consulte os tópicos abordados nos módulos ou refaça a pergunta com outros termos.',
        fontes: [],
      });
    }

    // 5. Assemble context numbering excerpts as [1], [2], ... with file name
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

    // 6. Call generateContent with strict system instruction
    const systemInstruction = `Você é a consultora do workshop Canva com IA. Responda usando apenas os trechos do material fornecidos. Cite a fonte entre colchetes, como [1], a cada afirmação. Se os trechos não contiverem a resposta, diga isso com todas as letras em vez de deduzir ou inventar. Fale em português do Brasil, direto e sem enrolação.`;

    const userPrompt = `Trechos do material do workshop:\n\n${contextText}\n\nPergunta do aluno: ${pergunta.trim()}`;

    const generateResponse = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.2,
      },
    });

    const resposta = generateResponse.text || 'Não foi possível gerar a resposta.';
    const fontes = Array.from(fontesMap.values());

    return NextResponse.json({
      resposta,
      text: resposta, // Compatibility with previous chat client
      fontes,
    });
  } catch (error: any) {
    console.error('Erro na rota /api/consultor:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao processar consulta com o material do workshop.' },
      { status: 500 }
    );
  }
}
