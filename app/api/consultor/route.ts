import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getUserFromRequest, rateLimit, clientKey } from '@/lib/apiAuth';

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
    // Autenticação + limite de uso: sem isso qualquer pessoa consome a cota da OpenAI.
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Faça login para conversar com a consultora.' }, { status: 401 });
    }

    const limit = rateLimit(clientKey(req, user.id), 20, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: `Muitas perguntas seguidas. Tente novamente em ${limit.retryAfter}s.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const wantsStream = body.stream === true || new URL(req.url).searchParams.get('stream') === '1';
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

    // 2. Prioridade: Usar OpenAI (OPENAI_API_KEY) para respostas conforme configurado
    if (openaiKey) {
      try {
        const openai = new OpenAI({ apiKey: openaiKey });
        
        // Montar histórico de mensagens para a OpenAI
        const incomingMessages: Array<{ role: string; text?: string; content?: string }> = Array.isArray(body.messages) ? body.messages : [];
        const openAiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: SYSTEM_INSTRUCTION }
        ];

        if (incomingMessages.length > 1) {
          for (let i = 0; i < incomingMessages.length - 1; i++) {
            const msg = incomingMessages[i];
            const textVal = msg.content || msg.text;
            if (textVal) {
              openAiMessages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: textVal
              });
            }
          }
        }

        const userMessage = contextText 
          ? `Trechos da base de conhecimento do curso:\n\n${contextText}\n\nPergunta do aluno:\n${pergunta.trim()}\n\n(Se utilizar informações dos trechos acima, cite as fontes entre colchetes como [1], [2]).`
          : pergunta.trim();

        openAiMessages.push({
          role: 'user',
          content: userMessage
        });

        const fontesHeader = Buffer.from(
          JSON.stringify(Array.from(fontesMap.values()))
        ).toString('base64');

        // Streaming: a resposta aparece palavra a palavra em vez de esperar 5-15s.
        if (wantsStream) {
          const stream = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.7,
            messages: openAiMessages,
            stream: true,
          });

          const encoder = new TextEncoder();
          const readable = new ReadableStream({
            async start(controller) {
              try {
                for await (const chunk of stream) {
                  const delta = chunk.choices?.[0]?.delta?.content;
                  if (delta) controller.enqueue(encoder.encode(delta));
                }
              } catch (streamErr) {
                console.error('Erro durante o streaming da OpenAI:', streamErr);
              } finally {
                controller.close();
              }
            },
          });

          return new Response(readable, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Cache-Control': 'no-cache, no-transform',
              'X-Fontes': fontesHeader,
            },
          });
        }

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.7,
          messages: openAiMessages,
        });

        const resposta = completion.choices?.[0]?.message?.content || 'Olá! Como posso te ajudar na criação dos seus designs no Canva hoje?';
        const fontes = Array.from(fontesMap.values());

        return NextResponse.json({
          resposta,
          text: resposta,
          fontes,
        });
      } catch (openAiErr: any) {
        console.error('Erro na chamada da OpenAI:', openAiErr);
        if (!geminiKey) {
          throw openAiErr;
        }
        console.log('Tentando fallback para Gemini...');
      }
    }

    // 3. Fallback para Gemini caso OpenAI não esteja configurada ou falhe
    if (geminiKey) {
      try {
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
          model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
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
      } catch (geminiErr: any) {
        console.error('Erro na chamada do Gemini:', geminiErr);
        throw geminiErr;
      }
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
