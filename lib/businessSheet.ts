export interface ColorItem {
  name: string;
  hex: string;
}

export interface BusinessSheetData {
  business_name: string;
  segment: string;
  what_you_sell: string;
  target_audience: string;
  main_benefit: string;
  tone_of_voice: 'Amigável' | 'Profissional' | 'Motivador' | 'Educativo' | 'Divertido' | string;
  brand_colors: ColorItem[];
  contact_channel: string;
  updated_at?: string;
}

export const EMPTY_BUSINESS_SHEET: BusinessSheetData = {
  business_name: '',
  segment: '',
  what_you_sell: '',
  target_audience: '',
  main_benefit: '',
  tone_of_voice: 'Amigável',
  brand_colors: [
    { name: 'Cor Primária', hex: '#7311D4' },
    { name: 'Cor Secundária', hex: '#D4AF37' },
    { name: 'Cor Neutra / Fundo', hex: '#1E1B4B' },
  ],
  contact_channel: 'WhatsApp',
};

export const EXAMPLE_BUSINESS_SHEET: BusinessSheetData = {
  business_name: 'Confeitaria da Ana',
  segment: 'confeitaria',
  what_you_sell: 'bolos artesanais para festas e encomendas',
  target_audience: 'mulheres de 25 a 45 anos que organizam a festa em casa e querem algo bonito sem ter que dar conta de fazer',
  main_benefit: 'o bolo bonito da festa sem ela precisar cozinhar nem se preocupar',
  tone_of_voice: 'Amigável',
  brand_colors: [
    { name: 'Rosa queimado', hex: '#C48B8B' },
    { name: 'Creme', hex: '#FDF5E6' },
    { name: 'Marrom', hex: '#5C3A21' },
  ],
  contact_channel: 'WhatsApp',
};

export const MODULE_MAPPINGS = [
  {
    field: 'Nome do negócio',
    fieldNumber: '01',
    modules: '1 · 2 · 6 · 10',
    description: 'aparece em toda peça que você criar',
    tag: 'Identidade & Assinatura',
  },
  {
    field: 'Segmento',
    fieldNumber: '02',
    modules: '2',
    description: 'é o que você digita na busca de templates do Canva',
    tag: 'Busca de Templates',
  },
  {
    field: 'O que você vende',
    fieldNumber: '03',
    modules: '4 · 6 · 8',
    description: 'o assunto de todo texto gerado por IA (Magic Write, ChatGPT)',
    tag: 'Assunto do Conteúdo',
  },
  {
    field: 'Para quem',
    fieldNumber: '04',
    modules: '4 · 5',
    description: 'vira o bloco "público" do seu prompt',
    tag: 'Bloco Público (Prompt)',
  },
  {
    field: 'Principal benefício',
    fieldNumber: '05',
    modules: '8',
    description: 'é o "Desejo" da estrutura AIDA (Atenção, Interesse, Desejo, Ação)',
    tag: 'Desejo AIDA',
  },
  {
    field: 'Tom de voz',
    fieldNumber: '06',
    modules: '4',
    description: 'vira o bloco "tom" do seu prompt de redação e carrosséis',
    tag: 'Bloco Tom (Prompt)',
  },
  {
    field: 'Cores da marca',
    fieldNumber: '07',
    modules: '2 · 9 · 10',
    description: 'a identidade visual que amarra toda a campanha e o Brand Kit',
    tag: 'Brand Kit & Paleta',
  },
  {
    field: 'Como o cliente fala com você',
    fieldNumber: '08',
    modules: '6 · 8 · 10',
    description: 'é o CTA (Chamada para Ação) que fecha toda peça do curso',
    tag: 'CTA Final',
  },
];

export const TONE_OPTIONS = [
  { id: 'Amigável', label: 'Amigável', desc: 'Próximo, acolhedor, empático' },
  { id: 'Profissional', label: 'Profissional', desc: 'Técnico, seguro, corporativo' },
  { id: 'Motivador', label: 'Motivador', desc: 'Inspirador, energético, encorajador' },
  { id: 'Educativo', label: 'Educativo', desc: 'Didático, explicativo, instrutivo' },
  { id: 'Divertido', label: 'Divertido', desc: 'Descontraído, bem-humorado, leve' },
];

export function generatePromptBlock(sheet: BusinessSheetData): string {
  const colorsText = (sheet.brand_colors || [])
    .filter(c => c.name || c.hex)
    .map(c => `${c.name || 'Cor'} (${c.hex})`)
    .join(', ');

  return `[CONTEXTO DO MEU NEGÓCIO]
- Nome do Negócio: ${sheet.business_name || 'Não informado'}
- Segmento: ${sheet.segment || 'Não informado'}
- O Que Vendo: ${sheet.what_you_sell || 'Não informado'}
- Público-Alvo (Para quem): ${sheet.target_audience || 'Não informado'}
- Principal Benefício: ${sheet.main_benefit || 'Não informado'}
- Tom de Voz: ${sheet.tone_of_voice || 'Amigável'}
- Cores da Marca: ${colorsText || 'Não informado'}
- Chamada para Ação (CTA): ${sheet.contact_channel || 'WhatsApp'}`;
}

const STORAGE_KEY = 'mistika_ficha_negocio_data';

export function getLocalBusinessSheet(): BusinessSheetData {
  if (typeof window === 'undefined') return EMPTY_BUSINESS_SHEET;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_BUSINESS_SHEET;
    const parsed = JSON.parse(raw);
    return { ...EMPTY_BUSINESS_SHEET, ...parsed };
  } catch {
    return EMPTY_BUSINESS_SHEET;
  }
}

export function saveLocalBusinessSheet(data: BusinessSheetData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Erro ao salvar localmente a ficha do negócio:', e);
  }
}
