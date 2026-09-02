import { supabase } from './supabase';
import { isAdminRole } from './roles';

export interface Course {
  id: string;
  title: string;
  archetype: string;
  image_url: string | null;
  duration: string;
  steps: number;
  description?: string | null;
  participants?: number;
  user_id?: string;
}

export interface CourseWithAccess extends Course {
  isEnrolled: boolean;
  progressPercent: number;
  completedLessonsCount: number;
  totalLessonsCount: number;
}

export const DEFAULT_JOURNEY_ID = 'fa512a52-9742-410f-a71b-0bd4013bec8d';

const DEFAULT_COURSE: Course = {
  id: DEFAULT_JOURNEY_ID,
  title: 'Canva com IA 2.0 - O Desafio',
  archetype: 'Jornada',
  image_url: null,
  duration: '10 Módulos',
  steps: 10,
  description:
    'Domine a criação de designs profissionais, prompts e carrosséis com as ferramentas de inteligência artificial do Canva.',
};

/**
 * Cursos disponíveis com matrícula e progresso do aluno.
 *
 * As consultas rodam em paralelo (antes eram 6 idas ao servidor em sequência) e o
 * progresso de cada curso é contado apenas com as aulas daquele curso — antes, quando
 * um curso não tinha aulas cadastradas, o cálculo usava o progresso global e inflava
 * o percentual.
 */
export async function getCoursesWithUserAccess(userId: string): Promise<{
  allCourses: CourseWithAccess[];
  enrolledCourses: CourseWithAccess[];
  activeCourseId: string;
}> {
  try {
    const [profileRes, journeysRes, enrollmentsRes, progressRes, lessonsRes, contentRes] = await Promise.all([
      supabase.from('profiles').select('journey_id, role').eq('id', userId).maybeSingle(),
      supabase.from('journeys').select('*').order('title', { ascending: true }),
      supabase.from('enrollments').select('journey_id, status').eq('user_id', userId),
      supabase.from('lesson_progress').select('lesson_id').eq('user_id', userId).eq('completed', true),
      supabase.from('lessons').select('id, journey_id'),
      supabase.from('content').select('id, archetype'),
    ]);

    const profile = profileRes.data;
    const activeCourseId = profile?.journey_id || DEFAULT_JOURNEY_ID;
    const isAdmin = isAdminRole(profile?.role);

    const journeys: Course[] = journeysRes.data?.length ? journeysRes.data : [DEFAULT_COURSE];

    // Matrículas
    const enrolledJourneyIds = new Set<string>([profile?.journey_id || DEFAULT_JOURNEY_ID]);
    (enrollmentsRes.data || []).forEach((e: any) => {
      if (!e.status || e.status === 'active') enrolledJourneyIds.add(e.journey_id);
    });

    const completedLessonIds = new Set((progressRes.data || []).map((p: any) => p.lesson_id));
    const allLessons = lessonsRes.data || [];
    const allContent = contentRes.data || [];

    const allCourses: CourseWithAccess[] = journeys.map((journey) => {
      const isEnrolled = isAdmin || enrolledJourneyIds.has(journey.id);

      const courseLessons = allLessons.filter((l: any) => l.journey_id === journey.id);
      const courseContent = allContent.filter((c: any) => c.archetype === journey.archetype);

      let totalLessonsCount = 0;
      let completedLessonsCount = 0;

      if (courseLessons.length > 0) {
        totalLessonsCount = courseLessons.length;
        completedLessonsCount = courseLessons.filter((l: any) => completedLessonIds.has(l.id)).length;
      } else if (courseContent.length > 0) {
        totalLessonsCount = courseContent.length;
        completedLessonsCount = courseContent.filter((c: any) => completedLessonIds.has(c.id)).length;
      } else {
        // Sem aulas cadastradas: mostra o total previsto e progresso zero
        totalLessonsCount = journey.steps || 10;
        completedLessonsCount = 0;
      }

      const progressPercent =
        totalLessonsCount > 0 ? Math.min(100, Math.round((completedLessonsCount / totalLessonsCount) * 100)) : 0;

      return { ...journey, isEnrolled, progressPercent, completedLessonsCount, totalLessonsCount };
    });

    const enrolled = allCourses.filter((c) => c.isEnrolled);

    return {
      allCourses,
      enrolledCourses: enrolled.length > 0 ? enrolled : allCourses.slice(0, 1),
      activeCourseId,
    };
  } catch (error) {
    console.error('Erro ao buscar cursos com acesso:', error);
    return { allCourses: [], enrolledCourses: [], activeCourseId: DEFAULT_JOURNEY_ID };
  }
}

/** Altera o curso ativo atual do usuário (perfil + localStorage). */
export async function switchActiveCourse(userId: string, journeyId: string): Promise<boolean> {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('active_journey_id', journeyId);
    }
    const { error } = await supabase.from('profiles').update({ journey_id: journeyId }).eq('id', userId);
    return !error;
  } catch (error) {
    console.error('Erro ao trocar curso ativo:', error);
    return false;
  }
}

/**
 * Matrícula. Só admins conseguem gravar (política RLS) — a aluna comum recebe acesso
 * pelo pagamento (webhook) ou por liberação do admin.
 */
export async function enrollUser(userId: string, journeyId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('enrollments')
      .upsert({ user_id: userId, journey_id: journeyId, status: 'active' }, { onConflict: 'user_id,journey_id' });
    if (error) console.warn('Não foi possível matricular:', error.message);
    return !error;
  } catch (error) {
    console.error('Erro ao matricular usuário:', error);
    return false;
  }
}

/** Aulas de um curso, já ordenadas. Usado pela jornada e pela home. */
export async function getCourseLessons(course: { id: string; archetype?: string }) {
  const { data: lessons } = await supabase
    .from('lessons')
    .select('*')
    .eq('journey_id', course.id)
    .order('dia', { ascending: true })
    .order('created_at', { ascending: true });

  if (lessons && lessons.length > 0) {
    return lessons.map((l: any) => ({
      id: l.id,
      title: l.titulo || l.title || 'Aula',
      description: l.descricao || l.description || '',
      thumbnail_url: l.capa_url || l.thumbnail_url || null,
      media_url: l.video_url || l.media_url || null,
      url: l.video_url || l.url || null,
      pdf_url: l.pdf_url || null,
      duracao: l.duracao || null,
      dia: l.dia ?? null,
      created_at: l.created_at || new Date().toISOString(),
    }));
  }

  const { data: content } = await supabase
    .from('content')
    .select('id, title, thumbnail_url, description, media_url, url, created_at')
    .eq('archetype', course.archetype || 'Jornada')
    .order('created_at', { ascending: true });

  return (content || []).map((c: any) => ({
    id: c.id,
    title: c.title || 'Aula',
    description: c.description || '',
    thumbnail_url: c.thumbnail_url || null,
    media_url: c.media_url || null,
    url: c.url || null,
    pdf_url: null,
    duracao: null,
    dia: null,
    created_at: c.created_at,
  }));
}

export type CourseLesson = Awaited<ReturnType<typeof getCourseLessons>>[number];
