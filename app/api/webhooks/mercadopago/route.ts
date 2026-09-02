import { MercadoPagoConfig, Payment } from 'mercadopago';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseAdmin, getSupabaseServerClient } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

/**
 * Valida o header `x-signature` do Mercado Pago (HMAC SHA256).
 * Sem isso, qualquer POST com um id de pagamento aprovado libera acesso.
 * Configure MP_WEBHOOK_SECRET (Notificações > Webhooks > "Assinatura secreta" no painel MP).
 */
function isValidSignature(req: NextRequest, dataId: string | null): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    // Sem segredo configurado não há como validar. Recusa em produção, permite em dev.
    console.warn('MP_WEBHOOK_SECRET não configurado — webhook não validado.');
    return process.env.NODE_ENV !== 'production';
  }

  const signature = req.headers.get('x-signature');
  const requestId = req.headers.get('x-request-id');
  if (!signature) return false;

  const parts = Object.fromEntries(
    signature.split(',').map((p) => {
      const [k, v] = p.split('=');
      return [k?.trim(), v?.trim()];
    })
  ) as Record<string, string>;

  const ts = parts.ts;
  const hash = parts.v1;
  if (!ts || !hash) return false;

  // Template oficial: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
  let manifest = '';
  if (dataId) manifest += `id:${dataId.toLowerCase()};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;

  const computed = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      console.error('Webhook: MP_ACCESS_TOKEN ausente.');
      return NextResponse.json({ error: 'Configuração incompleta' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const topic = searchParams.get('topic') || searchParams.get('type');
    const id = searchParams.get('id') || searchParams.get('data.id');

    if (!isValidSignature(request, id)) {
      console.warn('Webhook com assinatura inválida foi recusado.');
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 });
    }

    if (topic !== 'payment' || !id) {
      return NextResponse.json({ received: true, ignored: true });
    }

    let supabaseAdmin;
    try {
      supabaseAdmin = getSupabaseAdmin();
    } catch {
      supabaseAdmin = getSupabaseServerClient();
    }

    const client = new MercadoPagoConfig({ accessToken });
    const paymentData = await new Payment(client).get({ id });
    const userId = paymentData.external_reference;
    const status = paymentData.status;

    if (!userId) {
      return NextResponse.json({ received: true, ignored: 'sem external_reference' });
    }

    // Aprovado libera; estorno/contestação/cancelamento revoga o acesso.
    const APPROVED = ['approved'];
    const REVOKED = ['refunded', 'charged_back', 'cancelled'];

    if (APPROVED.includes(status || '')) {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ is_paid: true, status: 'Pago', plan: 'custom' })
        .eq('id', userId);
      if (error) console.error('Erro ao liberar acesso após pagamento:', error.message);
    } else if (REVOKED.includes(status || '')) {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ is_paid: false, status: 'Ativo' })
        .eq('id', userId);
      if (error) console.error('Erro ao revogar acesso após estorno:', error.message);
    }

    return NextResponse.json({ received: true, status });
  } catch (error: any) {
    console.error('Erro no webhook do Mercado Pago:', error?.message || error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
