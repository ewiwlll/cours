import type {
  Subject,
  Course,
  ChapterDefinition,
  Review,
  Exam,
  Weakness,
  RevisionSession,
  RecallEvaluation,
  LearningPlan,
  LearningInsights,
  AutomationStatus,
  OcclusionMask,
  CoursePhoto,
  ReviewStatus,
  PriorityLevel,
} from './types';

const API_BASE = '';

async function safeFetch<T>(url: string, fallback: T, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${url}`, {
      headers: {
        Accept: 'application/json',
        ...(options?.headers || {}),
      },
      ...options,
    });
    if (!res.ok) {
      console.warn(`API request failed: ${url} (${res.status} ${res.statusText})`);
      return fallback;
    }
    const data = await res.json();
    return data as T;
  } catch (error) {
    console.error(`Fetch error on ${url}:`, error);
    return fallback;
  }
}

/**
 * Subject catalog (15 courses / subjects defined in courses.json)
 */
export async function getSubjects(): Promise<Subject[]> {
  const data = await safeFetch<{ courses?: Subject[] } | Subject[]>('/api/courses', []);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.courses)) return data.courses;
  return [];
}

/**
 * List of study courses created/imported
 */
export async function getStudyCourses(): Promise<Course[]> {
  return safeFetch<Course[]>('/api/study-courses', []);
}

/**
 * Create a new study course
 */
export async function createStudyCourse(payload: {
  subjectId: string;
  subjectTitle?: string;
  title: string;
  date: string;
  chapter?: string;
  chapterId?: string | null;
  partLabel?: string | null;
  notes?: string;
}): Promise<Course | null> {
  try {
    const res = await fetch(`${API_BASE}/api/study-courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erreur ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error('Error creating study course:', error);
    return null;
  }
}

/**
 * Update an existing course
 */
export async function updateStudyCourse(
  id: string,
  payload: Partial<Course>
): Promise<Course | null> {
  try {
    const res = await fetch(`${API_BASE}/api/study-courses/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erreur ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error(`Error updating course ${id}:`, error);
    return null;
  }
}

/**
 * Delete an existing study course
 */
export async function deleteStudyCourse(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/study-courses/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Unlock a course with active recall evaluation
 */
export async function unlockCourseRecall(
  courseId: string,
  recallText: string
): Promise<{ course: Course; evaluation: any } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/study-courses/${encodeURIComponent(courseId)}/unlock-recall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recallText }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error('Error unlocking course recall:', error);
    return null;
  }
}

/**
 * Create a new subject
 */
export async function createSubject(payload: {
  title: string;
  semester?: 'S1' | 'S2';
  category?: string;
  ects?: number;
  priority?: PriorityLevel;
}): Promise<Subject | null> {
  try {
    const res = await fetch(`${API_BASE}/api/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Generate official university curriculum with AI / grounding (or smart academic templates)
 */
export async function generateCurriculum(query: string): Promise<{
  program: string;
  university?: string;
  semester?: string;
  subjects: Array<{
    title: string;
    category?: string;
    ects: number;
    priority: PriorityLevel;
    semester?: 'S1' | 'S2';
    chapters?: string[];
  }>;
} | null> {
  const cleanQuery = (query || '').trim();
  if (!cleanQuery) return null;

  try {
    const res = await fetch(`${API_BASE}/api/curriculum/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: cleanQuery }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.subjects) && data.subjects.length > 0) {
        return data;
      }
    }
  } catch {
    // Fallback if running offline or on static web without local Node server
  }

  // Smart Academic Template Fallback
  const qLower = cleanQuery.toLowerCase();
  if (qLower.includes('droit') || qLower.includes('jurid')) {
    return {
      program: 'Licence 1 Droit',
      university: cleanQuery,
      semester: 'S1',
      subjects: [
        { title: 'Droit constitutionnel 1', category: 'Majeure', ects: 6, priority: 'A', semester: 'S1', chapters: ["Théorie de l'État et Souveraineté", 'La Constitution et le contrôle de constitutionnalité', 'Les régimes politiques comparés'] },
        { title: 'Droit civil : Les personnes et la famille', category: 'Majeure', ects: 6, priority: 'A', semester: 'S1', chapters: ['La personne physique et ses attributs', 'La filiation et autorité parentale', 'Le mariage et le divorce'] },
        { title: 'Histoire du droit et des institutions', category: 'Fondamentale', ects: 4, priority: 'B', semester: 'S1', chapters: ["L'héritage romain et médiéval", "La monarchie et l'émergence de l'État", 'La Révolution et le Code civil'] },
        { title: 'Institutions juridictionnelles', category: 'Fondamentale', ects: 4, priority: 'B', semester: 'S1', chapters: ["L'ordre judiciaire", "L'ordre administratif", 'Le droit à un procès équitable'] },
        { title: 'Relations internationales & Géopolitique', category: 'Complémentaire', ects: 4, priority: 'B', semester: 'S1', chapters: ['Les acteurs internationaux', "L'ONU et traités internationaux"] },
        { title: 'Méthodologie juridique & Analyse d\'arrêts', category: 'Transversal', ects: 3, priority: 'B', semester: 'S1', chapters: ["La fiche d'arrêt et le syllogisme", 'Le commentaire d\'article'] },
        { title: 'Anglais juridique', category: 'Langue', ects: 3, priority: 'C', semester: 'S1', chapters: ['The Common Law System', 'Legal Vocabulary and Court System'] },
      ],
    };
  }

  if (qLower.includes('pass') || qLower.includes('santé') || qLower.includes('medecine') || qLower.includes('médecine') || qLower.includes('las')) {
    return {
      program: 'Parcours Accès Santé Spécifique (PASS)',
      university: cleanQuery,
      semester: 'S1',
      subjects: [
        { title: 'Biologie cellulaire et moléculaire', category: 'Majeure', ects: 8, priority: 'A', semester: 'S1', chapters: ['Membranes biologiques et transports', 'Cycle cellulaire, mitose et apoptose', 'ADN, transcription et traduction'] },
        { title: 'Anatomie générale et morphologie', category: 'Majeure', ects: 6, priority: 'A', semester: 'S1', chapters: ['Ostéologie et appareil locomoteur', 'Système cardiovasculaire et cœur', 'Système nerveux central et périphérique'] },
        { title: 'Biochimie structurale et métabolique', category: 'Majeure', ects: 6, priority: 'A', semester: 'S1', chapters: ['Acides aminés et protéines', 'Glucides et métabolisme énergétique (Krebs)', 'Lipides et acides gras'] },
        { title: 'Biostatistiques et épidémiologie', category: 'Fondamentale', ects: 4, priority: 'B', semester: 'S1', chapters: ['Statistiques descriptives et probabilités', 'Tests d\'hypothèses et risques alpha/bêta', 'Études épidémiologiques'] },
        { title: 'Sciences humaines et sociales (SHS) en santé', category: 'Fondamentale', ects: 4, priority: 'B', semester: 'S1', chapters: ['Histoire de la médecine', 'Éthique médicale et bioéthique', 'Relation soignant-soigné'] },
        { title: 'Pharmacologie générale & Médicament', category: 'Complémentaire', ects: 2, priority: 'C', semester: 'S1', chapters: ['Pharmacocinétique (ADME)', 'Cibles et récepteurs des médicaments'] },
      ],
    };
  }

  if (qLower.includes('info') || qLower.includes('informatique') || qLower.includes('ordinateur') || qLower.includes('code')) {
    return {
      program: 'Licence 1 Informatique',
      university: cleanQuery,
      semester: 'S1',
      subjects: [
        { title: 'Algorithmique et Programmation 1', category: 'Majeure', ects: 6, priority: 'A', semester: 'S1', chapters: ['Variables, types et structures de contrôle', 'Fonctions, portée et récursivité', 'Tableaux, listes et complexité'] },
        { title: 'Mathématiques discrètes & Logique', category: 'Majeure', ects: 6, priority: 'A', semester: 'S1', chapters: ['Logique propositionnelle et prédicats', 'Ensembles, relations et bijections', 'Arithmétique modulaire et récurrence'] },
        { title: 'Architecture des ordinateurs', category: 'Fondamentale', ects: 6, priority: 'A', semester: 'S1', chapters: ['Représentation des données (binaire, flottants)', 'Circuits logiques et algèbre de Boole', 'Le processeur et modèle Von Neumann'] },
        { title: 'Systèmes d\'exploitation & Shell Linux', category: 'Fondamentale', ects: 5, priority: 'B', semester: 'S1', chapters: ['Commandes Unix et scripts Shell', 'Processus, mémoire et gestion des droits'] },
        { title: 'Analyse et Algèbre pour l\'informatique', category: 'Complémentaire', ects: 4, priority: 'B', semester: 'S1', chapters: ['Suites et fonctions usuelles', 'Espaces vectoriels et calcul matriciel'] },
        { title: 'Anglais pour l\'informatique', category: 'Langue', ects: 3, priority: 'C', semester: 'S1', chapters: ['Technical Computer Science Vocabulary', 'Technical Documentation and Presentations'] },
      ],
    };
  }

  if (qLower.includes('eco') || qLower.includes('économie') || qLower.includes('gestion') || qLower.includes('finance')) {
    return {
      program: 'Licence 1 Économie & Gestion',
      university: cleanQuery,
      semester: 'S1',
      subjects: [
        { title: 'Microéconomie 1 : Consommateur & Marchés', category: 'Majeure', ects: 6, priority: 'A', semester: 'S1', chapters: ['Théorie du consommateur et courbes d\'indifférence', 'Fonction de demande et élasticités', 'La concurrence pure et parfaite'] },
        { title: 'Macroéconomie 1 : Fondements et PIB', category: 'Majeure', ects: 6, priority: 'A', semester: 'S1', chapters: ['Le circuit macroéconomique et comptabilité nationale', 'Le modèle keynésien et multiplicateur', 'Monnaie, inflation et banque centrale'] },
        { title: 'Mathématiques pour l\'économie', category: 'Fondamentale', ects: 5, priority: 'B', semester: 'S1', chapters: ['Fonctions de plusieurs variables et dérivées partielles', 'Optimisation sous contrainte (Lagrange)'] },
        { title: 'Statistiques descriptives & Probabilités', category: 'Fondamentale', ects: 5, priority: 'B', semester: 'S1', chapters: ['Paramètres de position et dispersion', 'Régression linéaire simple', 'Calcul des probabilités'] },
        { title: 'Comptabilité générale d\'entreprise', category: 'Fondamentale', ects: 5, priority: 'B', semester: 'S1', chapters: ['Le bilan, le compte de résultat et la partie double', 'Les opérations d\'achats/ventes et TVA', 'Les écritures d\'inventaire'] },
        { title: 'Anglais des affaires et économie', category: 'Langue', ects: 3, priority: 'C', semester: 'S1', chapters: ['Business Trends and Global Economy', 'Financial Vocabulary and Graph Reading'] },
      ],
    };
  }

  if (qLower.includes('terminale') || qLower.includes('lycee') || qLower.includes('lycée') || qLower.includes('bac') || qLower.includes('premiere') || qLower.includes('première') || qLower.includes('seconde')) {
    if (qLower.includes('ses') || qLower.includes('eco') || qLower.includes('gestion')) {
      return {
        program: 'Terminale Générale (Spécialité SES)',
        university: 'Lycée / Baccalauréat',
        semester: 'S1',
        subjects: [
          { title: 'Sciences Économiques et Sociales (Spécialité)', category: 'Spécialité Bac (Coeff 16)', ects: 16, priority: 'A', semester: 'S1', chapters: ['Sources et défis de la croissance économique', 'Fondements du commerce international', 'Structure de la société française', 'Mutations du travail et de l\'emploi'] },
          { title: 'Philosophie', category: 'Épreuve Terminale (Coeff 8)', ects: 8, priority: 'A', semester: 'S1', chapters: ['La liberté, le devoir et le bonheur', 'La vérité, la science et la raison', 'L\'État, la justice et le droit'] },
          { title: 'Histoire-Géographie & EMC', category: 'Tronc commun (Coeff 6)', ects: 6, priority: 'B', semester: 'S1', chapters: ['L\'impact des crises de 1929 et de la Seconde Guerre mondiale', 'Guerre froide et nouveaux rapports de puissance', 'La France et la construction européenne'] },
          { title: 'Enseignement Scientifique', category: 'Tronc commun (Coeff 6)', ects: 6, priority: 'B', semester: 'S1', chapters: ['Science, climat et société', 'Une histoire de la matière et de l\'énergie'] },
          { title: 'Langue Vivante A (Anglais)', category: 'Tronc commun (Coeff 6)', ects: 6, priority: 'C', semester: 'S1', chapters: ['Art et pouvoir', 'Espaces et échanges mondiaux'] },
        ],
      };
    }

    if (qLower.includes('premiere') || qLower.includes('première') || qLower.includes('francais') || qLower.includes('français')) {
      return {
        program: 'Première Générale (Bac de Français)',
        university: 'Lycée / Baccalauréat',
        semester: 'S1',
        subjects: [
          { title: 'Français (Épreuves anticipées du Bac)', category: 'Bac de Français (Coeff 10)', ects: 10, priority: 'A', semester: 'S1', chapters: ['La poésie du XIXe au XXIe siècle (Baudelaire / Rimbaud)', 'La littérature d\'idées du XVIe au XVIIIe siècle (Lumières)', 'Le roman et le récit du Moyen Âge au XXIe siècle', 'Le théâtre du XVIIe au XXIe siècle (Molière / Racine)'] },
          { title: 'Spécialité 1 (Majeure)', category: 'Spécialité (Coeff 8)', ects: 8, priority: 'A', semester: 'S1', chapters: ['Chapitre 1 : Notions fondamentales', 'Chapitre 2 : Méthodes et résolution', 'Chapitre 3 : Études approfondies'] },
          { title: 'Spécialité 2', category: 'Spécialité (Coeff 8)', ects: 8, priority: 'A', semester: 'S1', chapters: ['Chapitre 1 : Notions clés', 'Chapitre 2 : Exercices d\'application'] },
          { title: 'Histoire-Géographie & EMC', category: 'Tronc commun (Coeff 6)', ects: 6, priority: 'B', semester: 'S1', chapters: ['Nations, empires et nationalités (1789-1914)', 'La métropolisation et dynamiques territoriales'] },
          { title: 'Enseignement Scientifique & Mathématiques', category: 'Tronc commun (Coeff 6)', ects: 6, priority: 'B', semester: 'S1', chapters: ['Une longue histoire de la matière', 'Le Soleil, notre source d\'énergie'] },
          { title: 'Langue Vivante A (Anglais)', category: 'Tronc commun (Coeff 6)', ects: 6, priority: 'C', semester: 'S1', chapters: ['Identités et échanges', 'Innovations scientifiques et responsabilité'] },
        ],
      };
    }

    // Default Terminale Spé Maths / Physique-Chimie / SVT
    return {
      program: 'Terminale Générale (Spécialités Scientifiques)',
      university: 'Lycée / Baccalauréat',
      semester: 'S1',
      subjects: [
        { title: 'Mathématiques (Spécialité)', category: 'Spécialité Bac (Coeff 16)', ects: 16, priority: 'A', semester: 'S1', chapters: ['Suites, limites et récurrence', 'Continuité, dérivation et fonction exponentielle/logarithme', 'Géométrie dans l\'espace et produit scalaire', 'Probabilités et variables aléatoires'] },
        { title: 'Physique-Chimie (Spécialité)', category: 'Spécialité Bac (Coeff 16)', ects: 16, priority: 'A', semester: 'S1', chapters: ['Ondes et signaux (Interférences, diffraction, effet Doppler)', 'Mouvement et interactions (Lois de Newton, Kepler)', 'Transformations acido-basiques et titrage avec suivi pH-métrique', 'Thermodynamique et transferts thermiques'] },
        { title: 'Philosophie', category: 'Épreuve Terminale (Coeff 8)', ects: 8, priority: 'A', semester: 'S1', chapters: ['La conscience, l\'inconscient et le sujet', 'La liberté, le devoir et la morale', 'La vérité, la science et la technique', 'La justice, l\'État et la politique'] },
        { title: 'Histoire-Géographie & EMC', category: 'Tronc commun (Coeff 6)', ects: 6, priority: 'B', semester: 'S1', chapters: ['Les régimes totalitaires au XXe siècle', 'La guerre froide et les nouveaux rapports de puissance', 'La France et la gouvernance européenne'] },
        { title: 'Enseignement Scientifique', category: 'Tronc commun (Coeff 6)', ects: 6, priority: 'B', semester: 'S1', chapters: ['Science, climat et société contemporaine', 'L\'énergie : choix de développement et avenir'] },
        { title: 'Langue Vivante A (Anglais)', category: 'Tronc commun (Coeff 6)', ects: 6, priority: 'C', semester: 'S1', chapters: ['Art et pouvoir dans le monde anglophone', 'Espaces et échanges internationaux'] },
      ],
    };
  }

  // Universal Fallback for any other academic query
  return {
    program: cleanQuery,
    university: 'Établissement',
    semester: 'S1',
    subjects: [
      { title: `Fondements & Concepts — ${cleanQuery}`, category: 'Majeure', ects: 6, priority: 'A', semester: 'S1', chapters: ['Chapitre 1 : Notions fondamentales et définitions', 'Chapitre 2 : Cadres théoriques et modèles d\'analyse', 'Chapitre 3 : Études de cas et applications'] },
      { title: `Théories Approfondies — ${cleanQuery}`, category: 'Majeure', ects: 6, priority: 'A', semester: 'S1', chapters: ['Chapitre 1 : Les grands auteurs et écoles de pensée', 'Chapitre 2 : Débats contemporains et enjeux actuels'] },
      { title: 'Méthodologie du travail universitaire', category: 'Fondamentale', ects: 5, priority: 'B', semester: 'S1', chapters: ['Recherche documentaire et esprit critique', 'Rédaction académique et argumentation'] },
      { title: 'Outils quantitatifs & Analyse de données', category: 'Complémentaire', ects: 5, priority: 'B', semester: 'S1', chapters: ['Statistiques descriptives', 'Interprétation des résultats et synthèses'] },
      { title: 'Expression, communication et synthèse', category: 'Transversal', ects: 4, priority: 'B', semester: 'S1', chapters: ['Synthèse de documents', 'Prise de parole en public et argumentation'] },
      { title: 'Anglais académique et professionnel', category: 'Langue', ects: 4, priority: 'C', semester: 'S1', chapters: ['Academic English Vocabulary', 'Oral Presentation and Debate'] },
    ],
  };
}

/**
 * Import a full curriculum into courses.json and chapter-definitions.json
 */
export async function importCurriculum(subjects: Array<{
  title: string;
  category?: string;
  ects: number;
  priority: PriorityLevel;
  semester?: 'S1' | 'S2';
  chapters?: string[];
}>): Promise<{
  success: boolean;
  importedSubjects: number;
  importedChapters: number;
} | null> {
  try {
    const res = await fetch(`${API_BASE}/api/curriculum/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjects }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // If backend unavailable, create subjects individually
  }

  // Fallback client-side subject creation
  let createdCount = 0;
  for (const subj of subjects) {
    const created = await createSubject({
      title: subj.title,
      ects: subj.ects,
      priority: subj.priority,
    });
    if (created) {
      createdCount++;
      if (subj.chapters) {
        for (const chapTitle of subj.chapters) {
          await createChapterDefinition({
            subjectId: created.id,
            title: chapTitle,
          });
        }
      }
    }
  }

  return {
    success: true,
    importedSubjects: createdCount,
    importedChapters: 0,
  };
}

/**
 * Delete a subject
 */
export async function deleteSubject(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/courses/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Propose transcript sections for a course
 */
export async function proposeTranscriptSections(courseId: string): Promise<any> {
  try {
    const res = await fetch(
      `${API_BASE}/api/study-courses/${encodeURIComponent(courseId)}/transcript-sections/propose`,
      { method: 'POST' }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch automation status & configuration
 */
export async function getAutomationStatus(): Promise<AutomationStatus | null> {
  return safeFetch<AutomationStatus | null>('/api/automation', null);
}

/**
 * Fetch chapter definitions
 */
export async function getChapterDefinitions(): Promise<ChapterDefinition[]> {
  return safeFetch<ChapterDefinition[]>('/api/chapter-definitions', []);
}

/**
 * Create a chapter definition
 */
export async function createChapterDefinition(payload: {
  subjectId: string;
  title: string;
}): Promise<ChapterDefinition | null> {
  try {
    const res = await fetch(`${API_BASE}/api/chapter-definitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Delete a chapter definition
 */
export async function deleteChapterDefinition(
  id: string,
  reassignToChapterId?: string | null
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/chapter-definitions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reassignToChapterId: reassignToChapterId || null }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch raw reviews list
 */
export async function getRawReviews(): Promise<Review[]> {
  const data = await safeFetch<any>('/api/reviews', []);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.reviews)) return data.reviews;
  return [];
}

/**
 * Fetch reviews list and status
 */
export async function getReviews(): Promise<ReviewStatus> {
  const data = await safeFetch<any>('/api/reviews', {
    dueCount: 0,
    totalCards: 0,
    todayReviewed: 0,
    dueCards: [],
  });

  if (Array.isArray(data)) {
    return {
      dueCount: data.length,
      totalCards: data.length,
      todayReviewed: 0,
      dueCards: data,
    };
  }

  return {
    dueCount: data.dueCount || (data.dueCards?.length ?? 0),
    totalCards: data.totalCards || 0,
    todayReviewed: data.todayReviewed || 0,
    accuracyPercent: data.accuracyPercent,
    dueCards: data.dueCards || [],
  };
}

/**
 * Submit an Anki / card review
 */
export async function submitCardReview(payload: {
  courseId?: string;
  lessonId?: string;
  cardId: string;
  rating: number | 'again' | 'hard' | 'good' | 'easy';
  answerLength?: number;
  answerSelection?: number;
  evaluation?: { score: number; label: string; missing?: string[] } | null;
  weakCardIds?: string[];
  weakConcepts?: any[];
}): Promise<Review | null> {
  try {
    const numericRating =
      typeof payload.rating === 'number'
        ? payload.rating
        : payload.rating === 'again'
        ? 1
        : payload.rating === 'hard'
        ? 2
        : payload.rating === 'good'
        ? 3
        : 4;

    const res = await fetch(`${API_BASE}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId: payload.courseId || payload.lessonId,
        lessonId: payload.lessonId || payload.courseId,
        cardId: payload.cardId,
        rating: numericRating,
        answerLength: payload.answerLength,
        answerSelection: payload.answerSelection,
        evaluation: payload.evaluation,
        weakCardIds: payload.weakCardIds,
        weakConcepts: payload.weakConcepts,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error('Error submitting review:', error);
    return null;
  }
}

/**
 * Fetch exams list with calculated plans
 */
export async function getExams(): Promise<Exam[]> {
  return safeFetch<Exam[]>('/api/exams', []);
}

/**
 * Create a new exam
 */
export async function createExam(exam: {
  title: string;
  date: string;
  subjectId?: string | null;
  subjectTitle?: string;
  chapterIds?: string[];
  minutesPerDay: number;
}): Promise<Exam | null> {
  try {
    const res = await fetch(`${API_BASE}/api/exams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exam),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Update an existing exam
 */
export async function updateExam(id: string, payload: Partial<Exam>): Promise<Exam | null> {
  try {
    const res = await fetch(`${API_BASE}/api/exams/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Delete an exam
 */
export async function deleteExam(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/exams/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Start an adaptive session
 */
export async function startAdaptiveSession(payload: {
  minutes: number;
  mode?: 'adaptive' | 'oral-exam' | string;
  subjectId?: string;
  chapterId?: string;
  chapterIds?: string[];
  courseIds?: string[];
  examId?: string;
}): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/adaptive-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch revision sessions history
 */
export async function getRevisionSessions(): Promise<RevisionSession[]> {
  return safeFetch<RevisionSession[]>('/api/revision-sessions', []);
}

/**
 * Save a revision session (e.g. course recall, oral session)
 */
export async function saveRevisionSession(
  session: Partial<RevisionSession>
): Promise<RevisionSession | null> {
  try {
    const payload = {
      ...session,
      createdAt: session.createdAt || new Date().toISOString(),
    };
    const res = await fetch(`${API_BASE}/api/revision-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch weaknesses and struggling concepts
 */
export async function getWeaknesses(params?: {
  courseId?: string;
  cardId?: string;
}): Promise<Weakness[]> {
  const query = new URLSearchParams();
  if (params?.courseId) query.set('courseId', params.courseId);
  if (params?.cardId) query.set('cardId', params.cardId);
  const qStr = query.toString();
  const res = await safeFetch<{ ok?: boolean; weaknesses?: Weakness[] } | Weakness[]>(
    `/api/weaknesses${qStr ? `?${qStr}` : ''}`,
    []
  );
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.weaknesses)) return res.weaknesses;
  return [];
}

/**
 * Fetch learning insights and error progression
 */
export async function getLearningInsights(courseId?: string): Promise<LearningInsights | null> {
  const query = courseId ? `?courseId=${encodeURIComponent(courseId)}` : '';
  return safeFetch<LearningInsights | null>(`/api/learning-insights${query}`, null);
}

/**
 * Fetch learning planning & due items
 */
export async function getPlanning(params?: {
  startDate?: string;
  days?: number;
  subjectId?: string;
}): Promise<LearningPlan | null> {
  const query = new URLSearchParams();
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.days) query.set('days', String(params.days));
  if (params?.subjectId) query.set('subjectId', params.subjectId);
  const qStr = query.toString();
  return safeFetch<LearningPlan | null>(`/api/planning${qStr ? `?${qStr}` : ''}`, null);
}

/**
 * Fetch revision calendar (with day-by-day stats)
 */
export async function getRevisionCalendar(
  params?:
    | {
        startDate?: string;
        days?: number;
        subjectId?: string;
      }
    | number
): Promise<any> {
  const query = new URLSearchParams();
  if (typeof params === 'number') {
    query.set('days', String(params));
  } else if (params) {
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.days) query.set('days', String(params.days));
    if (params.subjectId) query.set('subjectId', params.subjectId);
  }
  const qStr = query.toString();
  return safeFetch<any>(`/api/revision-calendar${qStr ? `?${qStr}` : ''}`, []);
}

/**
 * Evaluate active recall restitution via AI
 */
export async function correctRecall(payload: {
  courseId: string;
  answer: string;
  attempt?: number;
  previousCorrection?: any;
}): Promise<{ ok: boolean; evaluation?: RecallEvaluation; reason?: string; sourceWarnings?: string[] }> {
  try {
    const res = await fetch(`${API_BASE}/api/recall-correction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data;
  } catch (error) {
    return { ok: false, reason: (error as Error).message || 'Erreur de communication' };
  }
}

/**
 * Transcribe audio locally or via backend
 */
export async function transcribeAudio(payload: {
  audioBase64: string;
  mimeType?: string;
  kind?: 'recall' | 'exam' | 'recording';
  courseId?: string;
}): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/audio/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur transcription');
    }
    return await res.json();
  } catch (error) {
    console.error('Audio transcription error:', error);
    return null;
  }
}

/**
 * Get markdown text content for a course summary
 */
export async function getCourseSummaryContent(filename: string): Promise<string> {
  if (!filename) return '';
  try {
    const res = await fetch(`${API_BASE}/api/courses/content?file=${encodeURIComponent(filename)}`);
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

/**
 * Get text content for a transcription
 */
export async function getTranscriptionContent(filename: string): Promise<string> {
  if (!filename) return '';
  try {
    const res = await fetch(
      `${API_BASE}/api/transcriptions/content?file=${encodeURIComponent(filename)}`
    );
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

/**
 * Save manual course notes
 */
export async function saveCourseNotes(courseId: string, notes: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/courses/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, notes }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Upload a photo for a course
 */
export async function uploadCoursePhoto(payload: {
  courseId: string;
  dataBase64: string;
  filename?: string;
  mimeType?: string;
  offsetMs?: number;
  markerId?: string;
}): Promise<CoursePhoto | null> {
  try {
    const res = await fetch(`${API_BASE}/api/courses/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Save image occlusion masks on a course photo
 */
export async function saveOcclusionMasks(
  courseId: string,
  photoId: string,
  masks: OcclusionMask[]
): Promise<boolean> {
  try {
    const courses = await getStudyCourses();
    const course = courses.find((c) => c.id === courseId);
    if (!course || !course.photos) return false;

    const updatedPhotos = course.photos.map((p) => {
      if (p.id === photoId || p.filename === photoId) {
        return { ...p, masks, occlusions: masks };
      }
      return p;
    });

    const updated = await updateStudyCourse(courseId, { photos: updatedPhotos });
    return updated !== null;
  } catch {
    return false;
  }
}

/**
 * Get interleaved multi-subject training session
 */
export async function getInterleavedTraining(
  count: number = 15,
  subjects?: string[]
): Promise<any[]> {
  try {
    const params = new URLSearchParams({ count: String(count) });
    if (subjects && subjects.length > 0) {
      params.set('subjects', subjects.join(','));
    }
    const res = await fetch(`${API_BASE}/api/training/interleaved?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch (e) {
    console.warn('Failed to load interleaved training:', e);
    return [];
  }
}

/**
 * Get exam traps and failed cards
 */
export async function getExamTrapsAndErrors(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/api/training/traps`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch (e) {
    console.warn('Failed to load exam traps:', e);
    return [];
  }
}

/**
 * Evaluate Feynman 60s self-explanation
 */
export async function evaluateFeynman(
  courseId: string,
  cardId: string,
  explanationText: string
): Promise<{
  score: number;
  causalScore: number;
  level: string;
  feedback: string;
  masteredKeywords: string[];
  missingKeywords: string[];
  improvedFeynman: string;
} | null> {
  try {
    const res = await fetch(`${API_BASE}/api/training/feynman-evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, cardId, explanationText }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.evaluation || null;
  } catch (e) {
    console.warn('Feynman evaluation failed:', e);
    return null;
  }
}

/**
 * Offline Sync: flush locally queued reviews to backend
 */
export async function syncPendingReviews(): Promise<number> {
  try {
    const raw = localStorage.getItem('biomia_pending_reviews');
    if (!raw) return 0;
    const pending = JSON.parse(raw);
    if (!Array.isArray(pending) || pending.length === 0) return 0;

    const res = await fetch(`${API_BASE}/api/reviews/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviews: pending }),
    });

    if (res.ok) {
      localStorage.removeItem('biomia_pending_reviews');
      return pending.length;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Enqueue review offline-first
 */
export function enqueueOfflineReview(review: any) {
  try {
    const raw = localStorage.getItem('biomia_pending_reviews');
    const list = raw ? JSON.parse(raw) : [];
    list.push(review);
    localStorage.setItem('biomia_pending_reviews', JSON.stringify(list));
  } catch (e) {
    console.warn('Failed to enqueue review offline:', e);
  }
}

