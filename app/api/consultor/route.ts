import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

const SYSTEM_INSTRUCTION = `Você é a Conselheira e Consultora Especialista do curso "Canva com IA 2.0 - O Desafio".
Sua missão é ser a mentora prática, conselheira criativa e estrategista de design e inteligência artificial para os alunos.

Suas especialidades fundamentais:
1. **Ferramentas de IA do Canva**: Magic Media (geração de imagens e vídeos), Magic Edit (substituição mágica de elementos), Magic Expand (expansão generativa de cenários), Removedor de Fundo, Redimensionamento Mágico (Magic Switch), Estilos & Paletas, Camadas, Brand Kit e Mockups.
2. **Engenharia de Prompts para o Canva**: Como estruturar comandos profissionais com (sujeito, estilo, iluminação, composição, ângulo de câmera, cores e atmosfera) para imagens realistas, ilustrações 3D, retratos corporativos e texturas.
3. **Criação de Carrosséis e Posts Magnéticos**: Estruturas de 5 a 10 slides com ganchos de alta retenção (headlines magnéticas), storytelling, contraste visual e chamadas para ação (CTAs) de alta conversão.
4. **Aplicação com a Ficha do Negócio**: Como utilizar os dados da marca do aluno (segmento, público, proposta de valor, tom de voz, cores da marca e WhatsApp) para gerar criativos e campanhas altamente personalizados.
5. **Orientação nos Módulos do Curso**: Explicações didáticas, passo a passo descomplicado, encorajamento e dicas práticas.

Diretrizes de resposta:
- Responda sempre em português do Brasil, com tom entusiasmado, didático, profissional e acolhedor.
- Use formatação clara em Markdown (tópicos com marcadores, destaques em negrito e blocos de código ou exemplos de prompts prontos para copiar).
- Se materiais de apoio forem fornecidos no contexto, cite-os referenciando [1], [2], etc.`;

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
    const pergunta = body.pergunta || body.prompt || (Array.isArray(body.messages) ? body.messages[body.messages.length - 1]?.content || body.messages[body.messages.length - 1]?.text : '');

    if (!pergunta || typeof pergunta !== 'string' || !pergunta.trim()) {
      return NextResponse.json(
        { error: 'A pergunta é obrigatória.' },
        { status: 400 }
      );
    }

    const geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    let contextText = '';
    const fontesMap = new Map<number, { numero: number; nome: string; link: string | null; similaridade: number }>();

    // 1. Tentar busca semântica na base de conhecimento (RAG) se houver Supabase configurado
    try {
      const supabase = getSupabaseAdmin();
      if (supabase && openaiKey) {
        const openai = new OpenAI({ apiKey: openaiKey });
        const embedResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: pergunta.trim(),
          dimensions: 1536,
        });

        const rawEmbedding = embedResponse.data?.[0]?.embedding || [];
        if (rawEmbedding.length > 0) {
          const normalizedEmbedding = normalizeVector(rawEmbedding);
          const { data: chunks } = await supabase.rpc('kb_buscar_chunks', {
            consulta: normalizedEmbedding,
            qtd: 6,
            limiar: 0.12,
          });

          if (chunks && chunks.length > 0) {
            const contextLines: string[] = [];
            chunks.forEach((chunk: any, index: number) => {
              const sourceNum = index + 1;
              const docName = chunk.documento_nome || chunk.nome || 'Material do Curso';
              const docLink = chunk.documento_link || chunk.link || null;
              const similarity = chunk.similaridade ? Number(chunk.similaridade) : 0;

              fontesMap.set(sourceNum, {
                numero: sourceNum,
                nome: docName,
                link: docLink,
                similaridade: similarity,
              });

              contextLines.push(`[${sourceNum}] Documento: ${docName}\nTrecho: ${chunk.conteudo}\n`);
            });
            contextText = contextLines.join('\n---\n\n');
          }
        }
      }
    } catch (ragErr) {
      console.warn('Busca vetorial na base de conhecimento não retornou dados:', ragErr);
    }

    // 2. Se Gemini estiver disponível (padrão nativo do Google AI Studio)
    if (geminiKey) {
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Montar histórico de mensagens se fornecido
      const incomingMessages: Array<{ role: string; text?: string; content?: string }> = Array.isArray(body.messages) ? body.messages : [];
      const formattedContents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

      if (incomingMessages.length > 1) {
        for (let i = 0; i < incomingMessages.length - 1; i++) {
          const msg = incomingMessages[i];
          const textVal = msg.text || msg.content;
          if (textVal) {
            formattedContents.push({
              role: msg.role === 'user' ? 'user' : 'model',
              parts: [{ text: textVal }]
            });
          }
        }
      }

      let currentPrompt = pergunta.trim();
      if (contextText) {
        currentPrompt = `Trechos da base de conhecimento do curso Canva com IA:\n\n${contextText}\n\nPergunta do aluno:\n${currentPrompt}\n\n(Se utilizar informações dos trechos acima, cite as fontes entre colchetes como [1], [2]).`;
      }

      formattedContents.push({
        role: 'user',
        parts: [{ text: currentPrompt }]
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: formattedContents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.7,
        }
      });

      const resposta = response.text || 'Olá! Como posso te ajudar na criação dos seus designs no Canva hoje?';
      const fontes = Array.from(fontesMap.values());

      return NextResponse.json({
        resposta,
        text: resposta,
        fontes,
      });
    }

    // 3. Fallback para OpenAI se Gemini não estiver presente
    if (openaiKey) {
      const openai = new OpenAI({ apiKey: openaiKey });
      const userMessage = contextText 
        ? `Trechos do material do workshop:\n\n${contextText}\n\nPergunta do aluno: ${pergunta.trim()}`
        : pergunta.trim();

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
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
    }

    return NextResponse.json({
      resposta: "Olá! Sou sua Conselheira de Canva com IA. Para ativar as respostas em tempo real, configure a chave de API (GEMINI_API_KEY ou OPENAI_API_KEY) nas variáveis de ambiente.",
      text: "Olá! Sou sua Conselheira de Canva com IA. Para ativar as respostas em tempo real, configure a chave de API (GEMINI_API_KEY ou OPENAI_API_KEY) nas variáveis de ambiente.",
      fontes: []
    });

  } catch (error: any) {
    console.error('Erro na rota /api/consultor:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro ao processar consulta com a IA.' },
      { status: 500 }
    );
  }
}
