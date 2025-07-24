/**
 * Zustand store for global state management
 */
import { create } from 'zustand';

export const useStore = create((set, get) => ({
  // Session state
  session: null,
  sessionLoading: false,
  sessionError: null,
  
  // PRD state
  currentSection: 0,
  sections: {},
  responses: {},
  
  // UI state
  sidebarOpen: false,
  previewOpen: true,
  theme: 'light',
  
  // WebSocket state
  socket: null,
  connected: false,
  
  // Actions
  setSession: (session) => set({ session }),
  setSessionLoading: (loading) => set({ sessionLoading: loading }),
  setSessionError: (error) => set({ sessionError: error }),
  
  setCurrentSection: (section) => set({ currentSection: section }),
  setSections: (sections) => set({ sections }),
  updateSection: (sectionName, data) => set((state) => ({
    sections: {
      ...state.sections,
      [sectionName]: { ...state.sections[sectionName], ...data }
    }
  })),
  
  setResponses: (responses) => set({ responses }),
  updateResponse: (sectionName, response) => set((state) => ({
    responses: {
      ...state.responses,
      [sectionName]: response
    }
  })),
  
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  togglePreview: () => set((state) => ({ previewOpen: !state.previewOpen })),
  setTheme: (theme) => set({ theme }),
  
  setSocket: (socket) => set({ socket }),
  setConnected: (connected) => set({ connected }),
  
  // Reset state
  resetSession: () => set({
    session: null,
    sessionLoading: false,
    sessionError: null,
    currentSection: 0,
    sections: {},
    responses: {},
    socket: null,
    connected: false
  })
}));