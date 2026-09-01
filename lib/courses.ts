import { supabase } from './supabase';

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

/**
 * Retorna todos os cursos disponíveis na plataforma com o status de matrícula e progresso do aluno.
 */
export async function getCoursesWithUserAccess(userId: string): Promise<{
  allCourses: CourseWithAccess[];
  enrolledCourses: CourseWithAccess[];
  activeCourseId: string;
}> {
  try {
    // 1. Obter perfil do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('journey_id, role')
      .eq('id', userId)
      .maybeSingle();

    const activeCourseId = profile?.journey_id || DEFAULT_JOURNEY_ID;

    // 2. Buscar todas as jornadas/cursos disponíveis
    const { data: journeysData } = await supabase
      .from('journeys')
      .select('*')
      .order('title', { ascending: true });

    const journeys: Course[] = journeysData || [];

    // Se não houver jornadas cadastradas, retorna lista padrão
    if (journeys.length === 0) {
      const defaultCourse: Course = {
        id: DEFAULT_JOURNEY_ID,
        title: 'Canva com IA 2.0 - O Desafio',
        archetype: 'Jornada',
        image_url: 'https://curso.curtatche.com.br/logo_coaet.png',
        duration: '10 Módulos',
        steps: 10,
        description: 'Domine a criação de designs profissionais, prompts e carrosséis com as ferramentas de inteligência artificial do Canva.'
      };
      journeys.push(defaultCourse);
    }

    // 3. Buscar matrículas do usuário
    const enrolledJourneyIds = new Set<string>();
    
    // Sempre inclui o curso atribuído no perfil
    if (profile?.journey_id) {
      enrolledJourneyIds.add(profile.journey_id);
    } else {
      enrolledJourneyIds.add(DEFAULT_JOURNEY_ID);
    }

    try {
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('journey_id, status')
        .eq('user_id', userId);

      if (enrollments && enrollments.length > 0) {
        enrollments.forEach(e => {
          if (e.status === 'active' || !e.status) {
            enrolledJourneyIds.add(e.journey_id);
          }
        });
      }
    } catch {
      // Caso a tabela enrollments ainda não esteja criada no banco remoto, fallback suave
    }

    // Administradores têm acesso a todos os cursos
    const isAdmin = profile?.role === 'admin';

    // 4. Buscar progresso de aulas concluídas pelo aluno
    const { data: progressData } = await supabase
      .from('lesson_progress')
      .select('lesson_id')
      .eq('user_id', userId)
      .eq('completed', true);

    const completedLessonIds = new Set(progressData?.map(p => p.lesson_id) || []);

    // 5. Buscar todas as aulas para calcular progresso por curso
    const { data: allLessons } = await supabase
      .from('lessons')
      .select('id, journey_id');

    const { data: allContent } = await supabase
      .from('content')
      .select('id, archetype');

    // Mapear cada curso com seu status
    const allCourses: CourseWithAccess[] = journeys.map(journey => {
      const isEnrolled = isAdmin || enrolledJourneyIds.has(journey.id);
      
      // Contar aulas deste curso
      const courseLessons = (allLessons || []).filter(l => l.journey_id === journey.id);
      const courseContent = (allContent || []).filter(c => c.archetype === journey.archetype);
      
      const totalLessonsCount = courseLessons.length > 0 ? courseLessons.length : (courseContent.length > 0 ? courseContent.length : (journey.steps || 10));
      
      let completedLessonsCount = 0;
      if (courseLessons.length > 0) {
        completedLessonsCount = courseLessons.filter(l => completedLessonIds.has(l.id)).length;
      } else if (courseContent.length > 0) {
        completedLessonsCount = courseContent.filter(c => completedLessonIds.has(c.id)).length;
      } else {
        completedLessonsCount = Math.min(completedLessonIds.size, totalLessonsCount);
      }

      const progressPercent = totalLessonsCount > 0 ? Math.round((completedLessonsCount / totalLessonsCount) * 100) : 0;

      return {
        ...journey,
        isEnrolled,
        progressPercent: Math.min(100, progressPercent),
        completedLessonsCount,
        totalLessonsCount
      };
    });

    const enrolledCourses = allCourses.filter(c => c.isEnrolled);

    return {
      allCourses,
      enrolledCourses: enrolledCourses.length > 0 ? enrolledCourses : [allCourses[0]],
      activeCourseId
    };
  } catch (error) {
    console.error('Erro ao buscar cursos com acesso:', error);
    return {
      allCourses: [],
      enrolledCourses: [],
      activeCourseId: DEFAULT_JOURNEY_ID
    };
  }
}

/**
 * Altera o curso ativo atual do usuário no perfil e no localStorage
 */
export async function switchActiveCourse(userId: string, journeyId: string): Promise<boolean> {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('active_journey_id', journeyId);
    }

    const { error } = await supabase
      .from('profiles')
      .update({ journey_id: journeyId })
      .eq('id', userId);

    return !error;
  } catch (error) {
    console.error('Erro ao trocar curso ativo:', error);
    return false;
  }
}

/**
 * Matricula o usuário em um curso
 */
export async function enrollUser(userId: string, journeyId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('enrollments')
      .upsert({
        user_id: userId,
        journey_id: journeyId,
        status: 'active'
      }, { onConflict: 'user_id,journey_id' });

    return !error;
  } catch (error) {
    console.error('Erro ao matricular usuário:', error);
    return false;
  }
}
