/**
 * useSession Hook - PRD Session Management
 * 
 * Comprehensive session management for PRD creation with real-time sync,
 * offline support, conflict resolution, and automatic backup capabilities.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { debounce } from 'lodash';

// Constants
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const WS_BASE_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';
const SYNC_DEBOUNCE_DELAY = 2000; // 2 seconds
const CONFLICT_RESOLUTION_TIMEOUT = 30000; // 30 seconds
const AUTO_SAVE_INTERVAL = 10000; // 10 seconds
const MAX_SYNC_RETRIES = 5;
const OFFLINE_STORAGE_KEY = 'prd_sessions_offline';
const SESSION_VERSION_KEY = 'session_versions';

// Session states
const SESSION_STATES = {
  DRAFT: 'draft',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ARCHIVED: 'archived'
};

// Sync states
const SYNC_STATES = {
  SYNCED: 'synced',
  LOCAL_CHANGES: 'local_changes',
  SYNCING: 'syncing',
  CONFLICT: 'conflict',
  ERROR: 'error',
  OFFLINE: 'offline'
};

// Section completion states
const SECTION_COMPLETION = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  NEEDS_REVIEW: 'needs_review',
  COMPLETED: 'completed'
};

// Conflict resolution strategies
const CONFLICT_STRATEGIES = {
  LOCAL_WINS: 'local_wins',
  REMOTE_WINS: 'remote_wins',
  MERGE: 'merge',
  MANUAL: 'manual'
};

/**
 * Custom hook for PRD session management
 * @param {string} sessionId - Unique session identifier
 * @param {Object} options - Configuration options
 */
export const useSession = (sessionId = null, options = {}) => {
  const {
    autoSync = true,
    enableOfflineMode = true,
    conflictStrategy = CONFLICT_STRATEGIES.MANUAL,
    maxRetries = MAX_SYNC_RETRIES,
    autoSaveInterval = AUTO_SAVE_INTERVAL,
    enableCompression = true,
    enableVersioning = true
  } = options;

  // Global state
  const { 
    sessions, 
    setSessions,
    updateSession: updateGlobalSession,
    networkStatus,
    user 
  } = useStore();

  // Local state
  const [state, setState] = useState({
    currentSession: null,
    syncStatus: SYNC_STATES.SYNCED,
    lastSyncTime: null,
    conflictData: null,
    isExporting: false,
    exportProgress: 0,
    pendingChanges: {},
    offlineQueue: [],
    syncErrors: []
  });

  // Refs for cleanup and persistence
  const websocketRef = useRef(null);
  const syncTimeoutRef = useRef(null);
  const autoSaveIntervalRef = useRef(null);
  const conflictResolutionTimeoutRef = useRef(null);
  const pendingOperationsRef = useRef(new Set());
  const versionTrackerRef = useRef(new Map());

  // Network status
  const isOnline = useMemo(() => {
    return networkStatus?.online !== false && navigator.onLine;
  }, [networkStatus]);

  // Current session data
  const session = useMemo(() => {
    if (!sessionId) return null;
    return sessions[sessionId] || state.currentSession;
  }, [sessionId, sessions, state.currentSession]);

  // Session progress calculation
  const sessionProgress = useMemo(() => {
    if (!session?.sections) return 0;
    
    const sections = Object.values(session.sections);
    const completedSections = sections.filter(
      section => section.completionStatus === SECTION_COMPLETION.COMPLETED
    );
    
    return sections.length > 0 ? (completedSections.length / sections.length) * 100 : 0;
  }, [session]);

  /**
   * Initialize WebSocket connection for real-time sync
   */
  const initializeWebSocket = useCallback(() => {
    if (!autoSync || !isOnline || websocketRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(`${WS_BASE_URL}/sessions/${sessionId}`);
      websocketRef.current = ws;

      ws.onopen = () => {
        console.log('Session WebSocket connected');
        setState(prev => ({ ...prev, syncStatus: SYNC_STATES.SYNCED }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleRealTimeUpdate(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('Session WebSocket disconnected');
        websocketRef.current = null;
        
        // Attempt reconnection after delay
        setTimeout(() => {
          if (isOnline && sessionId) {
            initializeWebSocket();
          }
        }, 5000);
      };

      ws.onerror = (error) => {
        console.error('Session WebSocket error:', error);
        setState(prev => ({ 
          ...prev, 
          syncStatus: SYNC_STATES.ERROR,
          syncErrors: [...prev.syncErrors, { 
            message: 'WebSocket connection failed',
            timestamp: new Date().toISOString()
          }]
        }));
      };

    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  }, [autoSync, isOnline, sessionId]);

  /**
   * Handle real-time updates from WebSocket
   */
  const handleRealTimeUpdate = useCallback((data) => {
    const { type, payload, version, userId } = data;

    // Ignore updates from current user
    if (userId === user?.id) return;

    switch (type) {
      case 'session_updated':
        handleRemoteSessionUpdate(payload, version);
        break;
      case 'section_updated':
        handleRemoteSectionUpdate(payload, version);
        break;
      case 'conflict_detected':
        handleConflictDetected(payload);
        break;
      case 'user_joined':
        handleUserJoined(payload);
        break;
      case 'user_left':
        handleUserLeft(payload);
        break;
      default:
        console.warn('Unknown real-time update type:', type);
    }
  }, [user]);

  /**
   * Handle remote session updates with conflict detection
   */
  const handleRemoteSessionUpdate = useCallback((remoteSession, remoteVersion) => {
    const currentVersion = versionTrackerRef.current.get(sessionId);
    
    if (!currentVersion || remoteVersion > currentVersion) {
      // No conflict, apply remote changes
      updateGlobalSession(sessionId, remoteSession);
      versionTrackerRef.current.set(sessionId, remoteVersion);
      setState(prev => ({ ...prev, lastSyncTime: new Date().toISOString() }));
    } else if (remoteVersion < currentVersion) {
      // Remote is behind, ignore
      return;
    } else {
      // Same version but different content - conflict detected
      detectAndHandleConflict(remoteSession, session);
    }
  }, [sessionId, session, updateGlobalSession]);

  /**
   * Detect and handle merge conflicts
   */
  const detectAndHandleConflict = useCallback((remoteData, localData) => {
    const conflicts = [];

    // Compare sections for conflicts
    if (localData?.sections && remoteData?.sections) {
      Object.keys(localData.sections).forEach(sectionId => {
        const localSection = localData.sections[sectionId];
        const remoteSection = remoteData.sections[sectionId];

        if (remoteSection && localSection.content !== remoteSection.content) {
          conflicts.push({
            type: 'section_content',
            sectionId,
            local: localSection,
            remote: remoteSection
          });
        }
      });
    }

    if (conflicts.length > 0) {
      setState(prev => ({
        ...prev,
        syncStatus: SYNC_STATES.CONFLICT,
        conflictData: {
          conflicts,
          local: localData,
          remote: remoteData,
          timestamp: new Date().toISOString()
        }
      }));

      // Auto-resolve based on strategy or timeout
      if (conflictStrategy !== CONFLICT_STRATEGIES.MANUAL) {
        setTimeout(() => {
          resolveConflict(conflictStrategy);
        }, 1000);
      } else {
        // Set timeout for manual resolution
        conflictResolutionTimeoutRef.current = setTimeout(() => {
          resolveConflict(CONFLICT_STRATEGIES.LOCAL_WINS);
        }, CONFLICT_RESOLUTION_TIMEOUT);
      }
    }
  }, [conflictStrategy]);

  /**
   * Resolve conflicts based on strategy
   */
  const resolveConflict = useCallback((strategy = conflictStrategy) => {
    const { conflictData } = state;
    if (!conflictData) return;

    let resolvedSession;

    switch (strategy) {
      case CONFLICT_STRATEGIES.LOCAL_WINS:
        resolvedSession = conflictData.local;
        break;
      case CONFLICT_STRATEGIES.REMOTE_WINS:
        resolvedSession = conflictData.remote;
        break;
      case CONFLICT_STRATEGIES.MERGE:
        resolvedSession = mergeConflictedData(conflictData.local, conflictData.remote);
        break;
      default:
        console.warn('Unknown conflict resolution strategy:', strategy);
        resolvedSession = conflictData.local;
    }

    // Apply resolved changes
    updateGlobalSession(sessionId, resolvedSession);
    
    // Sync to backend
    syncSessionToBackend(resolvedSession, true);

    // Clear conflict state
    setState(prev => ({
      ...prev,
      syncStatus: SYNC_STATES.SYNCED,
      conflictData: null
    }));

    if (conflictResolutionTimeoutRef.current) {
      clearTimeout(conflictResolutionTimeoutRef.current);
    }
  }, [state.conflictData, conflictStrategy, sessionId, updateGlobalSession]);

  /**
   * Intelligent merge of conflicted data
   */
  const mergeConflictedData = useCallback((local, remote) => {
    const merged = { ...local };

    // Merge sections intelligently
    if (remote.sections) {
      Object.keys(remote.sections).forEach(sectionId => {
        const localSection = local.sections?.[sectionId];
        const remoteSection = remote.sections[sectionId];

        if (!localSection) {
          // New section from remote
          merged.sections[sectionId] = remoteSection;
        } else if (remoteSection.updatedAt > localSection.updatedAt) {
          // Remote is newer
          merged.sections[sectionId] = remoteSection;
        }
        // Keep local if local is newer or same timestamp
      });
    }

    // Merge metadata with remote precedence for administrative fields
    merged.lastModifiedBy = remote.lastModifiedBy || local.lastModifiedBy;
    merged.collaborators = [...new Set([
      ...(local.collaborators || []),
      ...(remote.collaborators || [])
    ])];

    return merged;
  }, []);

  /**
   * Debounced sync function
   */
  const debouncedSync = useMemo(
    () => debounce((sessionData) => {
      if (isOnline && autoSync) {
        syncSessionToBackend(sessionData, false);
      } else {
        addToOfflineQueue('sync_session', sessionData);
      }
    }, SYNC_DEBOUNCE_DELAY),
    [isOnline, autoSync]
  );

  /**
   * Sync session to backend
   */
  const syncSessionToBackend = useCallback(async (sessionData, immediate = false) => {
    if (!sessionData || !sessionId) return;

    const operationId = `sync_${Date.now()}`;
    pendingOperationsRef.current.add(operationId);

    setState(prev => ({ 
      ...prev, 
      syncStatus: SYNC_STATES.SYNCING 
    }));

    try {
      const payload = enableCompression ? 
        await compressSessionData(sessionData) : 
        sessionData;

      const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/sync`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': user?.id,
          'X-Session-Version': versionTrackerRef.current.get(sessionId) || 0
        },
        body: JSON.stringify({
          session: payload,
          compressed: enableCompression,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Sync failed: ${response.status}`);
      }

      const result = await response.json();
      
      // Update version tracker
      if (result.version) {
        versionTrackerRef.current.set(sessionId, result.version);
      }

      setState(prev => ({
        ...prev,
        syncStatus: SYNC_STATES.SYNCED,
        lastSyncTime: new Date().toISOString(),
        syncErrors: prev.syncErrors.filter(error => 
          Date.now() - new Date(error.timestamp).getTime() > 300000 // Remove errors older than 5 minutes
        )
      }));

      // Process any offline queue
      if (state.offlineQueue.length > 0) {
        await processOfflineQueue();
      }

    } catch (error) {
      console.error('Session sync failed:', error);
      
      setState(prev => ({
        ...prev,
        syncStatus: isOnline ? SYNC_STATES.ERROR : SYNC_STATES.OFFLINE,
        syncErrors: [...prev.syncErrors, {
          message: error.message,
          timestamp: new Date().toISOString(),
          operation: 'sync_session'
        }]
      }));

      // Add to offline queue if offline
      if (!isOnline) {
        addToOfflineQueue('sync_session', sessionData);
      }
    } finally {
      pendingOperationsRef.current.delete(operationId);
    }
  }, [sessionId, user, enableCompression, isOnline, state.offlineQueue]);

  /**
   * Create new PRD session
   */
  const createSession = useCallback(async (sessionData = {}) => {
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const defaultSession = {
      id: newSessionId,
      title: sessionData.title || 'Untitled PRD',
      description: sessionData.description || '',
      status: SESSION_STATES.DRAFT,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user?.id,
      collaborators: [user?.id],
      sections: {
        introduction: { completionStatus: SECTION_COMPLETION.NOT_STARTED, content: '', responses: [] },
        goals: { completionStatus: SECTION_COMPLETION.NOT_STARTED, content: '', responses: [] },
        audience: { completionStatus: SECTION_COMPLETION.NOT_STARTED, content: '', responses: [] },
        userStories: { completionStatus: SECTION_COMPLETION.NOT_STARTED, content: '', responses: [] },
        functionalRequirements: { completionStatus: SECTION_COMPLETION.NOT_STARTED, content: '', responses: [] },
        successMetrics: { completionStatus: SECTION_COMPLETION.NOT_STARTED, content: '', responses: [] },
        openQuestions: { completionStatus: SECTION_COMPLETION.NOT_STARTED, content: '', responses: [] }
      },
      metadata: {
        version: '1.0.0',
        tags: sessionData.tags || [],
        priority: sessionData.priority || 'medium',
        estimatedCompletion: sessionData.estimatedCompletion || null
      },
      ...sessionData
    };

    // Update global state
    updateGlobalSession(newSessionId, defaultSession);
    
    // Set as current session
    setState(prev => ({ 
      ...prev, 
      currentSession: defaultSession,
      syncStatus: SYNC_STATES.LOCAL_CHANGES
    }));

    // Initialize version tracking
    versionTrackerRef.current.set(newSessionId, 1);

    // Save to backend if online
    if (isOnline) {
      try {
        await syncSessionToBackend(defaultSession, true);
      } catch (error) {
        console.warn('Failed to create session on backend, saved locally:', error);
      }
    } else {
      addToOfflineQueue('create_session', defaultSession);
    }

    // Initialize WebSocket connection
    if (autoSync) {
      setTimeout(() => initializeWebSocket(), 1000);
    }

    return newSessionId;
  }, [user, updateGlobalSession, isOnline, autoSync, initializeWebSocket, syncSessionToBackend]);

  /**
   * Update session data
   */
  const updateSession = useCallback((updates, immediate = false) => {
    if (!sessionId || !session) return;

    const updatedSession = {
      ...session,
      ...updates,
      updatedAt: new Date().toISOString(),
      lastModifiedBy: user?.id
    };

    // Update global state
    updateGlobalSession(sessionId, updatedSession);

    // Update local state
    setState(prev => ({ 
      ...prev, 
      currentSession: updatedSession,
      syncStatus: SYNC_STATES.LOCAL_CHANGES,
      pendingChanges: { ...prev.pendingChanges, session: updates }
    }));

    // Sync to backend
    if (immediate) {
      syncSessionToBackend(updatedSession, true);
    } else {
      debouncedSync(updatedSession);
    }
  }, [sessionId, session, user, updateGlobalSession, syncSessionToBackend, debouncedSync]);

  /**
   * Save section data with auto-sync
   */
  const saveSection = useCallback((sectionId, sectionData, immediate = false) => {
    if (!sessionId || !session) return;

    const updatedSection = {
      ...session.sections[sectionId],
      ...sectionData,
      updatedAt: new Date().toISOString(),
      lastModifiedBy: user?.id
    };

    const updatedSession = {
      ...session,
      sections: {
        ...session.sections,
        [sectionId]: updatedSection
      },
      updatedAt: new Date().toISOString(),
      lastModifiedBy: user?.id
    };

    // Update global state
    updateGlobalSession(sessionId, updatedSession);

    // Update local state
    setState(prev => ({ 
      ...prev, 
      currentSession: updatedSession,
      syncStatus: SYNC_STATES.LOCAL_CHANGES,
      pendingChanges: { 
        ...prev.pendingChanges, 
        sections: { 
          ...prev.pendingChanges.sections, 
          [sectionId]: sectionData 
        }
      }
    }));

    // Sync to backend
    if (immediate) {
      syncSessionToBackend(updatedSession, true);
    } else {
      debouncedSync(updatedSession);
    }

    // Send real-time update via WebSocket
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({
        type: 'section_updated',
        payload: { sectionId, sectionData: updatedSection },
        sessionId,
        userId: user?.id,
        timestamp: new Date().toISOString()
      }));
    }
  }, [sessionId, session, user, updateGlobalSession, syncSessionToBackend, debouncedSync]);

  /**
   * Export PRD in various formats
   */
  const exportPRD = useCallback(async (format = 'markdown', options = {}) => {
    if (!session) throw new Error('No session to export');

    setState(prev => ({ 
      ...prev, 
      isExporting: true, 
      exportProgress: 0 
    }));

    try {
      const exportData = {
        session,
        format,
        options: {
          includeMetadata: true,
          includeComments: false,
          template: 'standard',
          ...options
        }
      };

      setState(prev => ({ ...prev, exportProgress: 25 }));

      const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': user?.id
        },
        body: JSON.stringify(exportData)
      });

      setState(prev => ({ ...prev, exportProgress: 75 }));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Export failed');
      }

      const result = await response.json();

      setState(prev => ({ ...prev, exportProgress: 100 }));

      // Download file if URL provided
      if (result.downloadUrl) {
        const link = document.createElement('a');
        link.href = result.downloadUrl;
        link.download = result.filename || `${session.title}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      return result;

    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    } finally {
      setState(prev => ({ 
        ...prev, 
        isExporting: false, 
        exportProgress: 0 
      }));
    }
  }, [session, sessionId, user]);

  /**
   * Load session from backend
   */
  const loadSession = useCallback(async (targetSessionId) => {
    if (!targetSessionId) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/sessions/${targetSessionId}`, {
        headers: {
          'X-User-ID': user?.id
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Try loading from local storage
          return loadSessionFromLocal(targetSessionId);
        }
        throw new Error(`Failed to load session: ${response.status}`);
      }

      const sessionData = await response.json();
      
      // Update global state
      updateGlobalSession(targetSessionId, sessionData);
      
      // Update version tracker
      versionTrackerRef.current.set(targetSessionId, sessionData.version || 1);

      setState(prev => ({
        ...prev,
        currentSession: sessionData,
        syncStatus: SYNC_STATES.SYNCED,
        lastSyncTime: new Date().toISOString()
      }));

      // Initialize WebSocket for real-time updates
      if (autoSync) {
        initializeWebSocket();
      }

      return sessionData;

    } catch (error) {
      console.error('Failed to load session:', error);
      
      // Try loading from local storage as fallback
      const localSession = loadSessionFromLocal(targetSessionId);
      if (localSession) {
        setState(prev => ({ 
          ...prev, 
          syncStatus: SYNC_STATES.OFFLINE 
        }));
        return localSession;
      }
      
      throw error;
    }
  }, [user, updateGlobalSession, autoSync, initializeWebSocket]);

  /**
   * Load session from local storage
   */
  const loadSessionFromLocal = useCallback((targetSessionId) => {
    try {
      const localData = localStorage.getItem(`session_${targetSessionId}`);
      if (localData) {
        const sessionData = JSON.parse(localData);
        updateGlobalSession(targetSessionId, sessionData);
        setState(prev => ({ 
          ...prev, 
          currentSession: sessionData,
          syncStatus: SYNC_STATES.OFFLINE
        }));
        return sessionData;
      }
    } catch (error) {
      console.error('Failed to load session from local storage:', error);
    }
    return null;
  }, [updateGlobalSession]);

  /**
   * Add operation to offline queue
   */
  const addToOfflineQueue = useCallback((operation, data) => {
    if (!enableOfflineMode) return;

    const queueItem = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      operation,
      data,
      timestamp: new Date().toISOString(),
      retries: 0
    };

    setState(prev => ({
      ...prev,
      offlineQueue: [...prev.offlineQueue, queueItem],
      syncStatus: SYNC_STATES.OFFLINE
    }));

    // Save to local storage
    saveOfflineQueue([...state.offlineQueue, queueItem]);
  }, [enableOfflineMode, state.offlineQueue]);

  /**
   * Process offline queue when back online
   */
  const processOfflineQueue = useCallback(async () => {
    if (!isOnline || state.offlineQueue.length === 0) return;

    const queueCopy = [...state.offlineQueue];
    setState(prev => ({ ...prev, offlineQueue: [] }));

    for (const item of queueCopy) {
      try {
        switch (item.operation) {
          case 'create_session':
            await syncSessionToBackend(item.data, true);
            break;
          case 'sync_session':
            await syncSessionToBackend(item.data, true);
            break;
          case 'update_section':
            // Handle section updates
            break;
          default:
            console.warn('Unknown offline operation:', item.operation);
        }
      } catch (error) {
        console.error('Failed to process offline item:', error);
        
        // Re-add to queue if retries available
        if (item.retries < maxRetries) {
          setState(prev => ({
            ...prev,
            offlineQueue: [...prev.offlineQueue, { ...item, retries: item.retries + 1 }]
          }));
        }
      }
    }

    // Clear offline storage
    localStorage.removeItem(OFFLINE_STORAGE_KEY);
  }, [isOnline, state.offlineQueue, maxRetries, syncSessionToBackend]);

  /**
   * Save offline queue to local storage
   */
  const saveOfflineQueue = useCallback((queue) => {
    try {
      localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }, []);

  /**
   * Compress session data for efficient sync
   */
  const compressSessionData = useCallback(async (sessionData) => {
    // Simple compression by removing unnecessary fields and compacting data
    const compressed = {
      ...sessionData,
      sections: Object.fromEntries(
        Object.entries(sessionData.sections || {}).map(([key, section]) => [
          key,
          {
            completionStatus: section.completionStatus,
            content: section.content,
            updatedAt: section.updatedAt,
            // Remove verbose response data for sync
            responses: section.responses?.length || 0
          }
        ])
      )
    };

    return compressed;
  }, []);

  /**
   * Get comprehensive sync status
   */
  const getSyncStatus = useCallback(() => {
    return {
      status: state.syncStatus,
      lastSync: state.lastSyncTime,
      pendingChanges: Object.keys(state.pendingChanges).length > 0,
      offlineQueue: state.offlineQueue.length,
      hasConflicts: state.conflictData !== null,
      isOnline,
      errors: state.syncErrors
    };
  }, [state, isOnline]);

  // Auto-save functionality
  useEffect(() => {
    if (!session || !autoSync) return;

    autoSaveIntervalRef.current = setInterval(() => {
      if (state.syncStatus === SYNC_STATES.LOCAL_CHANGES) {
        debouncedSync(session);
      }
      
      // Save to local storage as backup
      try {
        localStorage.setItem(`session_${sessionId}`, JSON.stringify(session));
      } catch (error) {
        console.error('Failed to save session to local storage:', error);
      }
    }, autoSaveInterval);

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, [session, sessionId, autoSync, autoSaveInterval, state.syncStatus, debouncedSync]);

  // Process offline queue when coming back online
  useEffect(() => {
    if (isOnline && state.offlineQueue.length > 0) {
      processOfflineQueue();
    }
  }, [isOnline, processOfflineQueue]);

  // Load offline queue on mount
  useEffect(() => {
    if (enableOfflineMode) {
      try {
        const savedQueue = localStorage.getItem(OFFLINE_STORAGE_KEY);
        if (savedQueue) {
          const queue = JSON.parse(savedQueue);
          setState(prev => ({ ...prev, offlineQueue: queue }));
        }
      } catch (error) {
        console.error('Failed to load offline queue:', error);
      }
    }
  }, [enableOfflineMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
      if (conflictResolutionTimeoutRef.current) {
        clearTimeout(conflictResolutionTimeoutRef.current);
      }
      
      // Cancel debounced sync
      debouncedSync.cancel();
    };
  }, [debouncedSync]);

  // Return hook interface
  return {
    // Core session data
    session,
    sessionProgress,
    
    // Session management
    createSession,
    updateSession,
    saveSection,
    loadSession,
    
    // Export functionality
    exportPRD,
    isExporting: state.isExporting,
    exportProgress: state.exportProgress,
    
    // Sync status
    syncStatus: getSyncStatus(),
    
    // Conflict resolution
    hasConflicts: state.conflictData !== null,
    conflictData: state.conflictData,
    resolveConflict,
    
    // Offline support
    isOnline,
    offlineQueue: state.offlineQueue,
    
    // Utilities
    getSyncStatus,
    
    // Configuration
    config: {
      autoSync,
      enableOfflineMode,
      conflictStrategy,
      enableCompression,
      enableVersioning
    }
  };
};

// Export constants for use in components
export {
  SESSION_STATES,
  SYNC_STATES,
  SECTION_COMPLETION,
  CONFLICT_STRATEGIES
};

// Default export
export default useSession;