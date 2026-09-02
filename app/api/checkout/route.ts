import { MercadoPagoConfig, Preference } from 'mercadopago';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/apiAuth';

export const runtime = 'nodejs';

const COURSE_PRICE = Number(process.env.COURSE_PRICE || 29.9);
const COURSE_TITLE = process.env.COURSE_TITLE || 'Canva com IA - O Desafio (Acesso Completo)';

export async function POST(request: NextRequest) {
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;

    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const appUrl = process.env.APP_URL || `${protocol}://${host}`;

    if (!accessToken) {
      console.error('MP_ACCESS_TOKEN ausente no ambiente.');
      return NextResponse.json(
        { error: 'Pagamento indisponível no momento. Configure MP_ACCESS_TOKEN.' },
        { status: 500 }
      );
    }

    if (!appUrl || appUrl.includes('undefined')) {
      return NextResponse.json({ error: 'Configuração de redirecionamento incompleta.' }, { status: 500 });
    }

    // Autenticação via Authorization: Bearer <access_token> enviado pelo cliente
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Sessão expirada. Faça login novamente para assinar.' },
        { status: 401 }
      );
    }

    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            id: 'canva-com-ia-desafio',
            title: COURSE_TITLE,
            description: 'Acesso completo ao curso, desafios práticos e ferramentas de IA',
            quantity: 1,
            unit_price: COURSE_PRICE,
            currency_id: 'BRL',
          },
        ],
        back_urls: {
          success: `${appUrl}/perfil?status=success`,
          failure: `${appUrl}/perfil?status=failure`,
          pending: `${appUrl}/perfil?status=pending`,
        },
        auto_return: 'approved',
        external_reference: user.id,
        notification_url: `${appUrl}/api/webhooks/mercadopago`,
        payer: { email: user.email },
      },
    });

    if (!result.init_point) {
      console.error('Mercado Pago devolveu preferência sem init_point.');
      return NextResponse.json({ error: 'Erro na resposta do Mercado Pago.' }, { status: 500 });
    }

    return NextResponse.json({ id: result.id, init_point: result.init_point });
  } catch (error: any) {
    console.error('Erro ao criar preferência do Mercado Pago:', error?.message || error);
    return NextResponse.json(
      { error: 'Erro ao processar checkout', details: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
