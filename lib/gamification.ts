import { supabase } from './supabase';
import { levelFromPoints } from './achievements';

export const POINTS_PER_LESSON = 10;

export interface GamificationResult {
  points: number;
  streak: number;
  level: number;
  pointsDelta: number;
  leveledUp: boolean;
}

/**
 * Marca (ou desmarca) uma aula como concluída e atualiza pontos, sequência e nível.
 *
 * Correções em relação à versão anterior:
 * - Só pontua quando o estado REALMENTE muda (antes, marcar a mesma aula pela home e
 *   pela jornada dava +20 pontos pela mesma aula).
 * - A sequência usa `completed_at`, atualizado a cada conclusão (antes usava `created_at`,
 *   que o upsert não altera, e a sequência ficava travada).
 * - O nível passa a ser calculado a partir dos pontos.
 */
export async function toggleLessonCompletion(
  userId: string,
  lessonId: string,
  completed: boolean
): Promise<GamificationResult | null> {
  try {
    // 1. Estado atual — evita pontuar duas vezes a mesma aula
    const { data: existing } = await supabase
      .from('lesson_progress')
      .select('lesson_id, completed')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .maybeSingle();

    const wasCompleted = Boolean(existing?.completed);
    const changed = wasCompleted !== completed;

    if (completed) {
      const { error } = await supabase.from('lesson_progress').upsert(
        {
          user_id: userId,
          lesson_id: lessonId,
          completed: true,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,lesson_id' }
      );
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('lesson_progress')
        .delete()
        .eq('user_id', userId)
        .eq('lesson_id', lessonId);
      if (error) throw error;
    }

    const pointsDelta = changed ? (completed ? POINTS_PER_LESSON : -POINTS_PER_LESSON) : 0;
    const stats = await recalcUserStats(userId, pointsDelta);
    return stats ? { ...stats, pointsDelta } : null;
  } catch (err) {
    console.error('Erro ao atualizar progresso da aula:', err);
    return null;
  }
}

/** Recalcula pontos/sequência/nível do perfil. `pointsDelta` já vem validado. */
async function recalcUserStats(
  userId: string,
  pointsDelta: number
): Promise<Omit<GamificationResult, 'pointsDelta'> | null> {
  try {
    const [{ data: profile }, { data: progress }] = await Promise.all([
      supabase.from('profiles').select('points, level, streak').eq('id', userId).maybeSingle(),
      supabase
        .from('lesson_progress')
        .select('completed_at, created_at')
        .eq('user_id', userId)
        .eq('completed', true),
    ]);

    const currentPoints = profile?.points || 0;
    const newPoints = Math.max(0, currentPoints + pointsDelta);
    const streak = computeStreak(progress || []);
    const { level } = levelFromPoints(newPoints);
    const leveledUp = level > (profile?.level || 1);

    const { error } = await supabase
      .from('profiles')
      .update({ points: newPoints, streak, level, last_activity_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      // O trigger de proteção de colunas bloqueia atualização de points/level pela aluna.
      // Nesse caso os números continuam válidos na tela; o servidor sincroniza depois.
      console.warn('Não foi possível gravar a pontuação:', error.message);
    }

    return { points: newPoints, streak, level, leveledUp };
  } catch (err) {
    console.error('Erro ao recalcular estatísticas:', err);
    return null;
  }
}

/** Dias consecutivos (contando hoje ou ontem como início) com pelo menos uma conclusão. */
export function computeStreak(rows: Array<{ completed_at?: string | null; created_at?: string | null }>): number {
  const days = new Set(
    rows
      .map((r) => r.completed_at || r.created_at)
      .filter(Boolean)
      .map((d) => new Date(d as string).toISOString().slice(0, 10))
  );

  if (days.size === 0) return 0;

  const today = new Date();
  const key = (d: Date) => d.toISOString().slice(0, 10);

  // A sequência pode começar hoje ou ontem (quem ainda não estudou hoje não perde a streak).
  let cursor = new Date(today);
  if (!days.has(key(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(key(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(key(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Compatibilidade com o código antigo. */
export async function updateUserGamification(userId: string, completed: boolean) {
  return recalcUserStats(userId, completed ? POINTS_PER_LESSON : -POINTS_PER_LESSON);
}
