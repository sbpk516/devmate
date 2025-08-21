import { ChatSession } from './types';

const STORAGE_KEY = 'devmate_chat_history';
const MAX_SESSIONS = 50; // Prevent localStorage overflow

// Generate unique ID for chat sessions
const generateId = (): string => {
  return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Get chat history from localStorage
export const loadHistory = (): ChatSession[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const sessions = JSON.parse(stored) as ChatSession[];
    return Array.isArray(sessions) ? sessions : [];
  } catch (error) {
    console.error('Failed to load chat history:', error);
    return [];
  }
};

// Save a chat session to localStorage
export const saveSession = (session: ChatSession): void => {
  try {
    const sessions = loadHistory();
    
    // Update existing session or add new one
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }
    
    // Limit number of sessions to prevent localStorage overflow
    if (sessions.length > MAX_SESSIONS) {
      sessions.splice(0, sessions.length - MAX_SESSIONS);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('Failed to save chat session:', error);
  }
};

// Delete a chat session from localStorage
export const deleteSession = (sessionId: string): void => {
  try {
    const sessions = loadHistory();
    const filteredSessions = sessions.filter(s => s.id !== sessionId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredSessions));
  } catch (error) {
    console.error('Failed to delete chat session:', error);
  }
};

// Update an existing chat session
export const updateSession = (session: ChatSession): void => {
  saveSession(session); // saveSession handles both create and update
};

// Clear all chat history
export const clearHistory = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear chat history:', error);
  }
};

// Get a specific chat session by ID
export const getSession = (sessionId: string): ChatSession | null => {
  try {
    const sessions = loadHistory();
    return sessions.find(s => s.id === sessionId) || null;
  } catch (error) {
    console.error('Failed to get chat session:', error);
    return null;
  }
};

// Export all functions as a storage object
export const storage = {
  loadHistory,
  saveSession,
  deleteSession,
  updateSession,
  clearHistory,
  getSession,
  generateId
};
