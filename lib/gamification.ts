import { supabase } from './supabase';

/**
 * Atualiza os pontos e a sequência (streak) do usuário quando uma lição é concluída.
 */
export async function updateUserGamification(userId: string, isCompleted: boolean) {
  try {
    // 1. Buscar o perfil atual
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('points, streak')
      .eq('id', userId)
      .single();

    if (fetchError || !profile) {
      console.error('Erro ao buscar perfil para gamificação:', fetchError);
      return;
    }

    // 2. Buscar todo o progresso para calcular a sequência real
    const { data: progress } = await supabase
      .from('lesson_progress')
      .select('created_at')
      .eq('user_id', userId)
      .eq('completed', true)
      .order('created_at', { ascending: false });

    let newPoints = profile.points || 0;
    let newStreak = 0;

    if (isCompleted) {
      newPoints += 10;
    } else {
      newPoints = Math.max(0, newPoints - 10);
    }

    // Calcular sequência baseada nas datas de progresso
    if (progress && progress.length > 0) {
      const completionDates = progress.map(p => {
        const d = new Date(p.created_at);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      });

      // Remover duplicatas de datas (múltiplas lições no mesmo dia)
      const uniqueDates = Array.from(new Set(completionDates)).sort((a, b) => b - a);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (uniqueDates[0] === today.getTime() || uniqueDates[0] === yesterday.getTime()) {
        newStreak = 1;
        for (let i = 0; i < uniqueDates.length - 1; i++) {
          if (uniqueDates[i] - uniqueDates[i + 1] === 86400000) { // 1 dia em ms
            newStreak++;
          } else {
            break;
          }
        }
      }
    }

    // 3. Atualizar o perfil
    const updateData: any = {
      points: newPoints,
      streak: newStreak
    };

    // Tentamos atualizar a data de última conclusão se a coluna existir
    // (Isso ajuda a manter o registro simplificado no perfil)
    if (isCompleted) {
      updateData.last_completion_date = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (updateError) {
      // Se falhar por causa da coluna last_completion_date, tentamos sem ela
      if (updateError.message.includes('column "last_completion_date" does not exist')) {
        delete updateData.last_completion_date;
        await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', userId);
      } else {
        console.error('Erro ao atualizar gamificação:', updateError);
      }
    }
  } catch (err) {
    console.error('Erro na lógica de gamificação:', err);
  }
}
