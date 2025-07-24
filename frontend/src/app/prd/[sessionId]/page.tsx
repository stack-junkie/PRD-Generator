'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSessionContext } from '../../../contexts/SessionContext';
import ChatInterface from '../../../components/ChatInterface';
import PreviewPanel from '../../../components/PreviewPanel';
import ProgressTracker from '../../../components/ProgressTracker';
import { cn } from '../../../lib/utils';

// PRD section definitions
const PRD_SECTIONS = [
  { id: 'introduction', name: 'Introduction' },
  { id: 'goals', name: 'Goals & Objectives' },
  { id: 'audience', name: 'Target Audience' },
  { id: 'userStories', name: 'User Stories' },
  { id: 'requirements', name: 'Requirements' },
  { id: 'metrics', name: 'Success Metrics' },
  { id: 'questions', name: 'Open Questions' }
];

export default function PRDEditorPage() {
  // Get the session ID from the URL
  const params = useParams();
  const sessionId = params.sessionId as string;

  // Session context
  const {
    currentSession,
    isLoading,
    error,
    loadSession,
    saveSection,
    updateSession,
    sessionProgress,
    completedSections,
    currentSectionIndex,
    setCurrentSectionIndex
  } = useSessionContext();

  // Local state
  const [activeSection, setActiveSection] = useState(PRD_SECTIONS[0].id);
  const [previewVisible, setPreviewVisible] = useState(true);
  const [mobileView, setMobileView] = useState<'chat' | 'preview' | 'progress'>('chat');
  const [isMobile, setIsMobile] = useState(false);

  // Load session when component mounts
  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId).catch(error => {
        console.error('Failed to load session:', error);
      });
    }
  }, [sessionId, loadSession]);

  // Set up responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle section change
  const handleSectionChange = (sectionId: string, index: number) => {
    setActiveSection(sectionId);
    setCurrentSectionIndex(index);
  };

  // Handle section completion
  const handleSectionComplete = (sectionId: string, data: any) => {
    if (!currentSession) return;

    // Update the section with completion status
    saveSection(sectionId, {
      ...data,
      completionStatus: 'completed',
      updatedAt: new Date().toISOString()
    }, true);
    
    // Move to next section if available
    const currentIndex = PRD_SECTIONS.findIndex(s => s.id === sectionId);
    if (currentIndex < PRD_SECTIONS.length - 1) {
      const nextSection = PRD_SECTIONS[currentIndex + 1];
      setActiveSection(nextSection.id);
      setCurrentSectionIndex(currentIndex + 1);
    }
  };

  // Handle content update in preview
  const handlePreviewEdit = (content: string) => {
    if (!currentSession) return;
    
    saveSection(activeSection, {
      content,
      updatedAt: new Date().toISOString()
    });
  };

  // Handle title update
  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentSession) return;
    
    updateSession({
      title: event.target.value,
    });
  };

  // If loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="loading-dots mb-4">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <p>Loading PRD...</p>
        </div>
      </div>
    );
  }

  // If error
  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="alert alert-error">
          <h2 className="text-xl font-bold mb-2">Error Loading PRD</h2>
          <p>{error.message}</p>
          <button 
            onClick={() => loadSession(sessionId)}
            className="mt-4 btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // If no session found
  if (!currentSession) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="alert alert-warning">
          <h2 className="text-xl font-bold mb-2">PRD Not Found</h2>
          <p>The requested PRD could not be found or has been deleted.</p>
          <a href="/" className="mt-4 btn-primary inline-block">
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  // Get current section content
  const getCurrentSectionContent = () => {
    if (!currentSession?.sections || !activeSection) return '';
    const section = currentSession.sections[activeSection];
    return section?.content || '';
  };

  // Mobile view selector
  const renderMobileNav = () => (
    <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
      <button
        onClick={() => setMobileView('chat')}
        className={cn(
          'flex-1 py-3 text-center',
          mobileView === 'chat' 
            ? 'border-b-2 border-blue-500 font-medium' 
            : 'text-gray-500'
        )}
      >
        Chat
      </button>
      <button
        onClick={() => setMobileView('preview')}
        className={cn(
          'flex-1 py-3 text-center',
          mobileView === 'preview' 
            ? 'border-b-2 border-blue-500 font-medium' 
            : 'text-gray-500'
        )}
      >
        Preview
      </button>
      <button
        onClick={() => setMobileView('progress')}
        className={cn(
          'flex-1 py-3 text-center',
          mobileView === 'progress' 
            ? 'border-b-2 border-blue-500 font-medium' 
            : 'text-gray-500'
        )}
      >
        Progress
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with title */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={currentSession.title || ''}
              onChange={handleTitleChange}
              className="text-xl font-bold w-full bg-transparent border-0 focus:outline-none focus:ring-0"
              placeholder="Untitled PRD"
            />
          </div>
          
          {/* Desktop view controls */}
          {!isMobile && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPreviewVisible(!previewVisible)}
                className={cn(
                  'py-1 px-3 text-sm rounded',
                  previewVisible 
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                )}
              >
                {previewVisible ? 'Hide Preview' : 'Show Preview'}
              </button>
              
              <a 
                href="/"
                className="py-1 px-3 text-sm rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              >
                Exit
              </a>
            </div>
          )}
        </div>
      </header>

      {/* Mobile navigation */}
      {isMobile && renderMobileNav()}

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Progress tracker - desktop only or mobile when selected */}
        {(!isMobile || mobileView === 'progress') && (
          <div className={cn(
            'bg-white dark:bg-gray-800 overflow-y-auto border-r border-gray-200 dark:border-gray-700',
            isMobile ? 'w-full' : 'w-64 min-w-[16rem]'
          )}>
            <div className="p-4">
              <ProgressTracker 
                sections={PRD_SECTIONS}
                currentSection={currentSectionIndex}
                completedSections={completedSections}
                onSectionClick={handleSectionChange}
              />
            </div>
          </div>
        )}

        {/* Main workspace */}
        <div className={cn(
          'flex-1 flex',
          isMobile ? 'flex-col' : 'flex-row'
        )}>
          {/* Chat interface - desktop or mobile when selected */}
          {(!isMobile || mobileView === 'chat') && (
            <div className={cn(
              'flex-1 flex flex-col overflow-hidden',
              !isMobile && previewVisible ? 'w-1/2' : 'w-full'
            )}>
              <ChatInterface 
                section={activeSection}
                onSectionComplete={handleSectionComplete}
                context={{
                  conversationHistory: currentSession.sections[activeSection]?.responses || [],
                  progress: {
                    percentComplete: sessionProgress,
                    currentSection: activeSection,
                    completedSections: completedSections.length,
                    totalSections: PRD_SECTIONS.length
                  },
                  sessionMetadata: currentSession.metadata,
                  previousSections: currentSession.sections
                }}
              />
            </div>
          )}

          {/* Preview panel - desktop or mobile when selected */}
          {((!isMobile && previewVisible) || (isMobile && mobileView === 'preview')) && (
            <div className={cn(
              'flex-1 overflow-hidden bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700',
              !isMobile && previewVisible ? 'w-1/2' : 'w-full'
            )}>
              <PreviewPanel 
                content={getCurrentSectionContent()}
                onEdit={handlePreviewEdit}
                sessionId={sessionId}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}