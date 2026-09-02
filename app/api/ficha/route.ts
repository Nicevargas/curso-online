import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getUserFromRequest } from '@/lib/apiAuth';

export const runtime = 'nodejs';

/**
 * A ficha é sempre lida/gravada para o usuário DO TOKEN, nunca para um `userId`
 * enviado no corpo — antes qualquer pessoa podia sobrescrever a ficha de outra aluna.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    let supabaseAdmin;
    try {
      supabaseAdmin = getSupabaseAdmin();
    } catch {
      return NextResponse.json({ sheet: null, notice: 'Supabase admin não configurado' });
    }

    let { data } = await supabaseAdmin
      .from('canva_business_sheets')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!data) {
      const fallback = await supabaseAdmin
        .from('business_sheets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (fallback.data) data = fallback.data;
    }

    return NextResponse.json({ sheet: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const data = body?.data;
    if (!data) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    let supabaseAdmin;
    try {
      supabaseAdmin = getSupabaseAdmin();
    } catch {
      return NextResponse.json({ error: 'Armazenamento indisponível no servidor.' }, { status: 500 });
    }

    const payload = {
      user_id: user.id,
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

    const { error: canvaErr } = await supabaseAdmin
      .from('canva_business_sheets')
      .upsert(payload, { onConflict: 'user_id' });

    const { error: legacyErr } = await supabaseAdmin
      .from('business_sheets')
      .upsert(payload, { onConflict: 'user_id' });

    if (canvaErr && legacyErr) {
      console.error('Erro ao salvar ficha:', canvaErr.message);
      return NextResponse.json({ error: canvaErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: payload });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao salvar' }, { status: 500 });
  }
}
