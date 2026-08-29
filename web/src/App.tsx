import React from 'react';
import { useStore } from './lib/store';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { DashboardView } from './views/DashboardView';
import { SubjectsView } from './views/SubjectsView';
import { TrainingView } from './views/TrainingView';
import { PlanningView } from './views/PlanningView';
import { CourseDetailView } from './views/CourseDetailView';
import {
  AudioRecorderModal,
  ImageOcclusionStudioModal,
  CourseEditorModal,
  ChapterEditorModal,
  SubjectEditorModal,
} from './components/modals';
import { HowItWorksModal } from './components/modals/HowItWorksModal';
import { SettingsModal } from './components/modals/SettingsModal';
import {
  createStudyCourse,
  createChapterDefinition,
} from './lib/api';

export function App() {
  const {
    view,
    setView,
    selectedSubjectId,
    setSelectedSubjectId,
    openCourseId,
    setOpenCourseId,
    modals,
    openModal,
    closeModal,
    catalog,
    chapterDefinitions,
    studyCourses,
    refreshData,
  } = useStore();

  const handleSaveRecording = async (data: {
    title: string;
    subjectId: string;
    chapterId?: string;
    kind: string;
    durationMs: number;
    markers: any[];
    liveTranscript: string;
  }) => {
    try {
      const subject = catalog.find((s) => s.id === data.subjectId);
      const newCourse = await createStudyCourse({
        title: data.title || 'Cours enregistré',
        subjectId: data.subjectId,
        subjectTitle: subject?.title || '',
        date: new Date().toISOString().slice(0, 10),
        chapterId: data.chapterId || null,
        notes: data.liveTranscript || '',
      });

      if (newCourse) {
        await refreshData();
        closeModal('recording');
        setOpenCourseId(newCourse.id);
      }
    } catch (err) {
      console.error('Failed to save recorded course:', err);
    }
  };

  const handleSaveCourse = async (data: any) => {
    try {
      const subject = catalog.find((s) => s.id === data.subjectId);
      const newCourse = await createStudyCourse({
        title: data.title,
        subjectId: data.subjectId,
        subjectTitle: subject?.title || '',
        date: data.date || new Date().toISOString().slice(0, 10),
        chapterId: data.chapterId || null,
        chapter: data.chapter || '',
        notes: data.notes || '',
      });

      if (newCourse) {
        await refreshData();
        closeModal('courseEditor');
        setOpenCourseId(newCourse.id);
      }
    } catch (err) {
      console.error('Failed to save course:', err);
    }
  };

  const handleSaveChapter = async (data: any) => {
    try {
      if (!data.subjectId || !data.title) return;
      await createChapterDefinition({
        subjectId: data.subjectId,
        title: data.title,
      });
      await refreshData();
      closeModal('chapterManager');
    } catch (err) {
      console.error('Failed to save chapter:', err);
    }
  };

  return (
    <div className="min-h-screen bg-background text-zinc-100 flex flex-col selection:bg-blue-600/30">
      {/* Top Header Navigation */}
      <TopBar />

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Dynamic Center Content View */}
        <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 md:p-8 lg:p-10 pb-28 md:pb-10">
          <div className="max-w-6xl mx-auto w-full">
            {openCourseId ? (
              <CourseDetailView
                courseId={openCourseId}
                onBack={() => setOpenCourseId(null)}
                onStartSession={(minutes, mode, subjectId) => {
                  if (subjectId) setSelectedSubjectId(subjectId);
                  setView('anki');
                  setOpenCourseId(null);
                }}
                onSelectSubject={(subjectId) => {
                  setSelectedSubjectId(subjectId);
                  setView('subjects');
                  setOpenCourseId(null);
                }}
              />
            ) : view === 'accueil' ? (
              <DashboardView
                onNavigate={(navView, payload) => {
                  if (payload?.subjectId) setSelectedSubjectId(payload.subjectId);
                  if (navView === 'subjects' || navView === 'anki' || navView === 'planning') {
                    setView(navView);
                  }
                }}
                onOpenCourse={(courseId) => setOpenCourseId(courseId)}
                onStartSession={(minutes, mode, subjectId) => {
                  if (subjectId) setSelectedSubjectId(subjectId);
                  setView('anki');
                }}
              />
            ) : view === 'subjects' ? (
              <SubjectsView
                initialSubjectId={selectedSubjectId || undefined}
                onOpenCourse={(courseId) => setOpenCourseId(courseId)}
                onAddCourse={(subjectId) => {
                  setSelectedSubjectId(subjectId);
                  openModal('courseEditor', subjectId);
                }}
                onStartSession={(minutes, mode, subjectId) => {
                  if (subjectId) setSelectedSubjectId(subjectId);
                  setView('anki');
                }}
              />
            ) : view === 'anki' ? (
              <TrainingView
                initialSubjectId={selectedSubjectId || undefined}
                onOpenCourse={(courseId) => setOpenCourseId(courseId)}
              />
            ) : view === 'planning' ? (
              <PlanningView
                onOpenCourse={(courseId) => setOpenCourseId(courseId)}
                onSelectSubject={(subjectId) => {
                  setSelectedSubjectId(subjectId);
                  setView('subjects');
                }}
              />
            ) : null}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav />

      {/* Global Modals */}
      {/* 1. Audio Recording Modal */}
      <AudioRecorderModal
        isOpen={modals.recording}
        onClose={() => closeModal('recording')}
        subjects={catalog}
        chapters={chapterDefinitions}
        onSaveRecording={handleSaveRecording}
      />

      {/* 2. Image Occlusion Studio Modal */}
      <ImageOcclusionStudioModal
        isOpen={modals.occlusionStudio}
        onClose={() => closeModal('occlusionStudio')}
        onExportAnki={() => {
          refreshData();
        }}
      />

      {/* 3. Subject Editor Modal */}
      <SubjectEditorModal
        isOpen={modals.subjectEditor}
        onClose={() => closeModal('subjectEditor')}
      />

      {/* 4. Course Editor Modal */}
      <CourseEditorModal
        isOpen={modals.courseEditor}
        onClose={() => closeModal('courseEditor')}
        subjects={catalog}
        chapters={chapterDefinitions}
        onSave={handleSaveCourse}
      />

      {/* 5. Chapter Manager Modal */}
      <ChapterEditorModal
        isOpen={modals.chapterManager}
        onClose={() => closeModal('chapterManager')}
        subjects={catalog}
        onSave={handleSaveChapter}
      />

      {/* 6. How It Works Guide Modal */}
      <HowItWorksModal
        isOpen={modals.howItWorks}
        onClose={() => closeModal('howItWorks')}
        onAction={(action) => {
          if (action === 'record') openModal('recording');
        }}
      />

      {/* 7. Settings Modal */}
      <SettingsModal />
    </div>
  );
}

export default App;
