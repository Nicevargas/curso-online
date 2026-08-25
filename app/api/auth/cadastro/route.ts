import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'E-mail e senha são obrigatórios.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter no mínimo 6 caracteres.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (name || '').trim();

    let supabaseAdmin;
    try {
      supabaseAdmin = getSupabaseAdmin();
    } catch (e: any) {
      return NextResponse.json(
        { error: 'Configuração do Supabase Service Role não encontrada no servidor.' },
        { status: 500 }
      );
    }

    // 1. Create user with admin privilege (auto-confirms email so user can log in immediately)
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        name: cleanName,
      },
    });

    if (createError) {
      console.error('Erro ao criar usuário no Supabase Auth Admin:', createError);

      if (createError.message?.includes('already been registered') || createError.message?.includes('User already registered')) {
        return NextResponse.json(
          { error: 'Este e-mail já está cadastrado. Por favor, faça login.' },
          { status: 400 }
        );
      }

      if (createError.message?.includes('Database error saving new user')) {
        return NextResponse.json(
          { 
            error: 'Erro no banco de dados do Supabase (Database error saving new user). Isso ocorre quando há uma trigger corrompida ou restrição na tabela "profiles" no Supabase.',
            isDatabaseTriggerError: true
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: createError.message || 'Erro ao criar conta no banco de dados.' },
        { status: 500 }
      );
    }

    const userId = userData.user.id;

    // 2. Safely create or update profile
    const profilePayload: Record<string, any> = {
      id: userId,
      name: cleanName || cleanEmail.split('@')[0],
      email: cleanEmail,
      role: 'usuario',
      level: 1,
      status: 'Ativo',
      points: 0,
      streak: 0,
      plan: '7_days_free',
      is_paid: false,
    };

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' });

    if (profileError) {
      console.warn('Aviso ao criar registro na tabela profiles:', profileError);
      // Even if profiles table insert has non-critical warning, the auth user is created
    }

    return NextResponse.json({
      success: true,
      userId: userId,
      email: cleanEmail,
    });
  } catch (error: any) {
    console.error('Erro inesperado em /api/auth/cadastro:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno ao processar cadastro.' },
      { status: 500 }
    );
  }
}
