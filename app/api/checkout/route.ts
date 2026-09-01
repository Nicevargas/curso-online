import { MercadoPagoConfig, Preference } from 'mercadopago';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    // Debug environment variables
    const envKeys = Object.keys(process.env);
    const mpKeys = envKeys.filter(k => k.toUpperCase().includes('MP') || k.toUpperCase().includes('MERCADO'));
    console.log('Available MP-related env keys:', mpKeys);
    
    // Try to find the token even if there are slight naming variations
    const findKey = (target: string) => envKeys.find(k => k.trim().toUpperCase().replace(/[\s_]/g, '') === target);
    
    const mpTokenKey = findKey('MPACCESSTOKEN') || findKey('MERCADOPAGOACCESSTOKEN');
    const accessToken = mpTokenKey ? process.env[mpTokenKey] : undefined;

    console.log('Detected accessToken (first 4 chars):', accessToken ? accessToken.substring(0, 4) + '...' : 'NONE');
    
    // Get host from headers to ensure correct redirect URL
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const appUrl = process.env.APP_URL || `${protocol}://${host}`;

    if (!accessToken) {
      console.error('Mercado Pago Access Token is missing. Checked keys:', mpKeys);
      return NextResponse.json({ 
        error: 'Configuração de pagamento incompleta (Token ausente)',
        details: `Chaves encontradas: ${mpKeys.join(', ') || 'Nenhuma'}. Certifique-se de que MP_ACCESS_TOKEN está configurado.`
      }, { status: 500 });
    }

    const client = new MercadoPagoConfig({ accessToken });

    if (!appUrl || appUrl.includes('undefined')) {
      console.error('APP_URL is missing or invalid:', appUrl);
      return NextResponse.json({ error: 'Configuração de redirecionamento incompleta (URL ausente)' }, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const preference = new Preference(client);
    
    console.log('Creating Mercado Pago preference for user:', user.id, 'Email:', user.email);
    
    const preferenceData = {
      body: {
        items: [
          {
            id: 'canva-com-ia-desafio',
            title: 'Canva com IA - O Desafio (Acesso Completo)',
            description: 'Acesso completo ao curso, desafios práticos e ferramentas de IA',
            quantity: 1,
            unit_price: 29.90,
            currency_id: 'BRL',
          }
        ],
        back_urls: {
          success: `${appUrl}/perfil?status=success`,
          failure: `${appUrl}/perfil?status=failure`,
          pending: `${appUrl}/perfil?status=pending`,
        },
        auto_return: 'approved',
        external_reference: user.id,
        notification_url: `${appUrl}/api/webhooks/mercadopago`,
        payer: {
          email: user.email,
        }
      }
    };

    console.log('Preference data:', JSON.stringify(preferenceData, null, 2));

    const result = await preference.create(preferenceData);

    console.log('Preference created successfully. ID:', result.id);
    
    if (!result.init_point) {
      console.error('Mercado Pago returned result without init_point:', result);
      return NextResponse.json({ 
        error: 'Erro na resposta do Mercado Pago', 
        details: 'init_point ausente na resposta da API' 
      }, { status: 500 });
    }

    return NextResponse.json({ id: result.id, init_point: result.init_point });
  } catch (error: any) {
    console.error('Error creating MP preference:', error);
    
    // Extract detailed error from MP SDK if possible
    let errorMessage = 'Erro ao processar checkout';
    let errorDetails = error.message || 'Erro interno';

    if (error.response) {
      console.error('MP API Error Response:', error.response);
      errorDetails = `MP API Error: ${JSON.stringify(error.response)}`;
    }
    
    return NextResponse.json({ 
      error: errorMessage, 
      details: errorDetails 
    }, { status: 500 });
  }
}
