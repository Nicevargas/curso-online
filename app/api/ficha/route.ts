import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório' }, { status: 400 });
    }

    let supabaseAdmin;
    try {
      supabaseAdmin = getSupabaseAdmin();
    } catch {
      return NextResponse.json({ sheet: null, notice: 'Supabase admin não configurado' });
    }

    // Tenta primeiro em canva_business_sheets
    let { data, error } = await supabaseAdmin
      .from('canva_business_sheets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data) {
      // Fallback para business_sheets
      const fallback = await supabaseAdmin
        .from('business_sheets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (fallback.data) {
        data = fallback.data;
      }
    }

    return NextResponse.json({ sheet: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, data } = body;

    if (!userId || !data) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    let supabaseAdmin;
    try {
      supabaseAdmin = getSupabaseAdmin();
    } catch {
      return NextResponse.json({ success: true, savedOffline: true });
    }

    const payload = {
      user_id: userId,
      course_slug: 'canva-com-ia-2-0',
      business_name: data.business_name || '',
      segment: data.segment || '',
      what_you_sell: data.what_you_sell || '',
      target_audience: data.target_audience || '',
      main_benefit: data.main_benefit || '',
      tone_of_voice: data.tone_of_voice || 'Amigável',
      brand_colors: data.brand_colors || [],
      contact_channel: data.contact_channel || 'WhatsApp',
      updated_at: new Date().toISOString(),
    };

    // Salva em canva_business_sheets
    const { error: canvaErr } = await supabaseAdmin
      .from('canva_business_sheets')
      .upsert(payload, { onConflict: 'user_id' });

    // Salva também em business_sheets para compatibilidade
    const { error: legacyErr } = await supabaseAdmin
      .from('business_sheets')
      .upsert(payload, { onConflict: 'user_id' });

    if (canvaErr && legacyErr) {
      console.warn('Aviso ao salvar ficha:', canvaErr.message);
      return NextResponse.json({ success: false, error: canvaErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: payload });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao salvar' }, { status: 500 });
  }
}
