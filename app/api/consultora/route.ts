import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const SYSTEM_INSTRUCTION = `Você é a Conselheira e Consultora Especialista do curso "Canva com IA - O Desafio".
Sua missão é ser a mentora prática e consultora criativa dos alunos.

Suas especialidades incluem:
1. **Ferramentas do Canva**: Magic Media, Magic Edit, Magic Expand, Remoção de Fundo, Redimensionamento Mágico, Estilos, Camadas, Animações e Brand Kit.
2. **Prompts para Inteligência Artificial**: Como estruturar comandos eficientes (sujeito, estilo, iluminação, composição, enquadramento, atmosfera) para gerar imagens realistas, ilustrações 3D, retratos corporativos, mockups e texturas.
3. **Criação de Conteúdo Estratégico**: Ideias de postagens, carrosséis de alto engajamento, ganchos (headlines magnéticas), chamadas para ação (CTAs), roteiros para Reels/TikTok.
4. **Design e Identidade Visual**: Harmonização de paletas de cores, combinações tipográficas profissionais, hierarquia visual, espaçamento e contraste.
5. **Dúvidas sobre o Desafio**: Explicações práticas e encorajamento para os alunos aplicarem o que aprenderam nas aulas.

Tom de voz: Profissional, prestativa, didática, entusiasmada e encorajadora.
Use formatação limpa (tópicos com marcadores, destaques em negrito, exemplos práticos de prompts prontos para copiar). Responda sempre em português brasileiro de forma clara e objetiva.`;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { text: "A chave da API do Gemini não está configurada no servidor. Por favor, adicione GEMINI_API_KEY nas variáveis de ambiente." },
        { status: 200 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Convert messages format for Gemini
    const contents = messages.map((m: { role: string; text: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      }
    });

    const reply = response.text || "Desculpe, não consegui processar a resposta no momento. Tente novamente.";
    return NextResponse.json({ text: reply });
  } catch (error: any) {
    console.error("Erro na API da Consultora:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao consultar a assistente de IA." },
      { status: 500 }
    );
  }
}
