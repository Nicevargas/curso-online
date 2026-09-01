import { MercadoPagoConfig, Payment } from 'mercadopago';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin, getSupabaseServerClient } from '@/lib/supabaseServer';

export async function POST(request: Request) {
  try {
    const envKeys = Object.keys(process.env);
    const findKey = (target: string) => envKeys.find(k => k.trim().toUpperCase().replace(/[\s_]/g, '') === target);
    const mpTokenKey = findKey('MPACCESSTOKEN') || findKey('MERCADOPAGOACCESSTOKEN');
    const accessToken = mpTokenKey ? process.env[mpTokenKey] : undefined;

    if (!accessToken) {
      console.error('Webhook: Mercado Pago Access Token is missing');
      return NextResponse.json({ error: 'Configuração incompleta' }, { status: 500 });
    }

    let supabaseAdmin;
    try {
      supabaseAdmin = getSupabaseAdmin();
    } catch {
      supabaseAdmin = getSupabaseServerClient();
    }

    const client = new MercadoPagoConfig({ accessToken });
    const { searchParams } = new URL(request.url);
    const topic = searchParams.get('topic') || searchParams.get('type');
    const id = searchParams.get('id') || searchParams.get('data.id');

    console.log('Webhook received:', { topic, id });

    if (topic === 'payment' && id) {
      const payment = new Payment(client);
      const paymentData = await payment.get({ id });

      console.log('Payment data received:', { 
        status: paymentData.status, 
        external_reference: paymentData.external_reference 
      });

      if (paymentData.status === 'approved') {
        const userId = paymentData.external_reference;
        
        if (userId) {
          console.log('Updating profile for user:', userId);
          const { error } = await supabaseAdmin
            .from('profiles')
            .update({ 
              is_paid: true, 
              status: 'Pago',
              plan: 'custom'
            })
            .eq('id', userId);

          if (error) {
            console.error('Error updating profile after payment:', error);
          } else {
            console.log('Profile updated successfully for user:', userId);
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ 
      error: 'Webhook processing failed', 
      details: error.message 
    }, { status: 500 });
  }
}
