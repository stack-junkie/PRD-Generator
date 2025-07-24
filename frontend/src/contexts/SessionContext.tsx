'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession, SESSION_STATES, SECTION_COMPLETION } from '../hooks/useSession';

// Define types for our context
type Session = {
  id: string;
  title: string;
  description: string;
  status: string;
  sections: Record<string, {
    completionStatus: string;
    content: string;
    responses: any[];
  }>;
  createdAt: string;
  updatedAt: string;
  metadata?: any;
};

type SessionContextType = {
  currentSession: Session | null;
  isLoading: boolean;
  error: Error | null;
  sessionProgress: number;
  completedSections: Array<{ id: string; validationScore?: number; needsRevision?: boolean }>;
  currentSectionIndex: number;
  setCurrentSectionIndex: (index: number) => void;
  createNewSession: (initialData?: Partial<Session>) => Promise<string>;
  loadSession: (sessionId: string) => Promise<Session | null>;
  updateSession: (updates: Partial<Session>, immediate?: boolean) => void;
  saveSection: (sectionId: string, data: any, immediate?: boolean) => void;
  exportPRD: (format: string, options?: any) => Promise<any>;
  syncStatus: {
    status: string;
    lastSync: string | null;
    isOnline: boolean;
    pendingChanges: boolean;
  };
  recentSessions: Session[];
};

// Create the context with default values
const SessionContext = createContext<SessionContextType>({
  currentSession: null,
  isLoading: false,
  error: null,
  sessionProgress: 0,
  completedSections: [],
  currentSectionIndex: 0,
  setCurrentSectionIndex: () => {},
  createNewSession: async () => '',
  loadSession: async () => null,
  updateSession: () => {},
  saveSection: () => {},
  exportPRD: async () => ({}),
  syncStatus: {
    status: 'synced',
    lastSync: null,
    isOnline: true,
    pendingChanges: false
  },
  recentSessions: []
});

// Props for the SessionProvider component
interface SessionProviderProps {
  children: ReactNode;
}

export const SessionProvider = ({ children }: SessionProviderProps) => {
  // States
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number>(0);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);

  // Use the session hook for the current session
  const {
    session,
    sessionProgress,
    createSession,
    updateSession: updateSessionHook,
    saveSection: saveSectionHook,
    loadSession: loadSessionHook,
    exportPRD: exportPRDHook,
    syncStatus,
    isOnline
  } = useSession(currentSessionId || undefined);

  // Calculate completed sections
  const completedSections = React.useMemo(() => {
    if (!session?.sections) return [];
    
    return Object.entries(session.sections)
      .filter(([, section]) => section.completionStatus === SECTION_COMPLETION.COMPLETED)
      .map(([id, section]) => ({
        id,
        validationScore: section.metadata?.validationScore,
        needsRevision: section.metadata?.needsRevision
      }));
  }, [session]);

  // Load recent sessions on mount
  useEffect(() => {
    const loadRecentSessions = async () => {
      try {
        const response = await fetch('/api/sessions/recent');
        if (response.ok) {
          const data = await response.json();
          setRecentSessions(data.sessions || []);
        }
      } catch (error) {
        console.error('Failed to load recent sessions:', error);
      }
    };

    loadRecentSessions();
  }, []);

  // Function to create a new session
  const createNewSession = async (initialData: Partial<Session> = {}) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const sessionId = await createSession(initialData);
      setCurrentSessionId(sessionId);
      
      // Add to recent sessions
      if (session) {
        setRecentSessions(prev => [session, ...prev.slice(0, 9)]);
      }
      
      return sessionId;
    } catch (error: any) {
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Function to load a session
  const loadSession = async (sessionId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const loadedSession = await loadSessionHook(sessionId);
      setCurrentSessionId(sessionId);
      
      // Update recent sessions list
      if (loadedSession) {
        setRecentSessions(prev => 
          [loadedSession, ...prev.filter(s => s.id !== sessionId).slice(0, 9)]
        );
      }
      
      return loadedSession;
    } catch (error: any) {
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Wrap updateSession from the hook
  const updateSession = (updates: Partial<Session>, immediate = false) => {
    try {
      updateSessionHook(updates, immediate);
    } catch (error: any) {
      setError(error);
    }
  };

  // Wrap saveSection from the hook
  const saveSection = (sectionId: string, data: any, immediate = false) => {
    try {
      saveSectionHook(sectionId, data, immediate);
    } catch (error: any) {
      setError(error);
    }
  };

  // Wrap exportPRD from the hook
  const exportPRD = async (format: string, options = {}) => {
    setIsLoading(true);
    
    try {
      return await exportPRDHook(format, options);
    } catch (error: any) {
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Context value
  const contextValue: SessionContextType = {
    currentSession: session,
    isLoading,
    error,
    sessionProgress,
    completedSections,
    currentSectionIndex,
    setCurrentSectionIndex,
    createNewSession,
    loadSession,
    updateSession,
    saveSection,
    exportPRD,
    syncStatus: {
      status: syncStatus.status,
      lastSync: syncStatus.lastSync,
      isOnline: syncStatus.isOnline,
      pendingChanges: syncStatus.pendingChanges
    },
    recentSessions
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
};

// Hook to use the session context
export const useSessionContext = () => useContext(SessionContext);

export default SessionContext;