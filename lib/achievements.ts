export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  emoji: string;
  /** Retorna true quando a conquista está desbloqueada. */
  check: (s: AchievementStats) => boolean;
  /** Progresso 0-1 para a barra da conquista ainda bloqueada. */
  progress?: (s: AchievementStats) => number;
}

export interface AchievementStats {
  lessonsCompleted: number;
  streak: number;
  points: number;
  level: number;
  coursesCompleted: number;
  posts: number;
  diaryEntries: number;
  sheetCompleted: boolean;
}

export const EMPTY_STATS: AchievementStats = {
  lessonsCompleted: 0,
  streak: 0,
  points: 0,
  level: 1,
  coursesCompleted: 0,
  posts: 0,
  diaryEntries: 0,
  sheetCompleted: false,
};

const ratio = (value: number, target: number) => Math.min(1, value / target);

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_lesson',
    title: 'Primeira aula',
    description: 'Você concluiu sua primeira aula.',
    emoji: '🎬',
    check: (s) => s.lessonsCompleted >= 1,
    progress: (s) => ratio(s.lessonsCompleted, 1),
  },
  {
    id: 'five_lessons',
    title: 'Pegando o ritmo',
    description: 'Cinco aulas concluídas.',
    emoji: '⚡',
    check: (s) => s.lessonsCompleted >= 5,
    progress: (s) => ratio(s.lessonsCompleted, 5),
  },
  {
    id: 'ten_lessons',
    title: 'Dez de dez',
    description: 'Dez aulas concluídas.',
    emoji: '🏅',
    check: (s) => s.lessonsCompleted >= 10,
    progress: (s) => ratio(s.lessonsCompleted, 10),
  },
  {
    id: 'streak_3',
    title: 'Três dias seguidos',
    description: 'Três dias seguidos estudando.',
    emoji: '🔥',
    check: (s) => s.streak >= 3,
    progress: (s) => ratio(s.streak, 3),
  },
  {
    id: 'streak_7',
    title: 'Semana completa',
    description: 'Sete dias seguidos estudando.',
    emoji: '🌟',
    check: (s) => s.streak >= 7,
    progress: (s) => ratio(s.streak, 7),
  },
  {
    id: 'course_done',
    title: 'Curso concluído',
    description: 'Você finalizou um curso inteiro.',
    emoji: '🎓',
    check: (s) => s.coursesCompleted >= 1,
    progress: (s) => ratio(s.coursesCompleted, 1),
  },
  {
    id: 'community',
    title: 'Voz na comunidade',
    description: 'Publicou na Mentoria & Comunidade.',
    emoji: '💬',
    check: (s) => s.posts >= 1,
    progress: (s) => ratio(s.posts, 1),
  },
  {
    id: 'diary',
    title: 'Diário em dia',
    description: 'Três registros no diário de evolução.',
    emoji: '📔',
    check: (s) => s.diaryEntries >= 3,
    progress: (s) => ratio(s.diaryEntries, 3),
  },
  {
    id: 'sheet',
    title: 'Marca definida',
    description: 'Preencheu a Ficha do Negócio.',
    emoji: '🎨',
    check: (s) => s.sheetCompleted,
    progress: (s) => (s.sheetCompleted ? 1 : 0),
  },
  {
    id: 'points_200',
    title: '200 pontos',
    description: 'Acumulou 200 pontos na plataforma.',
    emoji: '⭐',
    check: (s) => s.points >= 200,
    progress: (s) => ratio(s.points, 200),
  },
];

export function evaluateAchievements(stats: AchievementStats) {
  return ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: a.check(stats),
    progressValue: a.progress ? a.progress(stats) : a.check(stats) ? 1 : 0,
  }));
}

/** Nível a partir dos pontos: 100 pontos por nível, curva suave. */
export function levelFromPoints(points: number): { level: number; current: number; needed: number; percent: number } {
  const level = Math.max(1, Math.floor(points / 100) + 1);
  const current = points % 100;
  const needed = 100;
  return { level, current, needed, percent: Math.round((current / needed) * 100) };
}
