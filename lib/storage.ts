import { ChatSession } from './types';

const STORAGE_KEY = 'devmate_chat_history';
const MAX_SESSIONS = 50; // Prevent localStorage overflow

// Generate unique ID for chat sessions
const generateId = (): string => {
  const id = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log('🆔 Generated session ID:', id);
  return id;
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
    console.log('💾 saveSession called with session ID:', session.id);
    console.log('💾 Session messages count:', session.messages.length);
    console.log('💾 Session messages:', session.messages.map(m => `${m.role}: ${m.content.substring(0, 30)}...`));
    
    const sessions = loadHistory();
    console.log('💾 Current sessions in localStorage:', sessions.length);
    console.log('💾 Looking for session ID:', session.id);
    console.log('💾 Existing sessions:', sessions.map(s => s.id));
    
    // Update existing session or add new one
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    console.log('💾 Found at index:', existingIndex);
    
    if (existingIndex >= 0) {
      console.log('💾 Updating existing session at index:', existingIndex);
      sessions[existingIndex] = session;
    } else {
      console.log('💾 Adding new session');
      sessions.push(session);
    }
    
    // Limit number of sessions to prevent localStorage overflow
    if (sessions.length > MAX_SESSIONS) {
      sessions.splice(0, sessions.length - MAX_SESSIONS);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    console.log('💾 Successfully saved session to localStorage. Total sessions:', sessions.length);
    console.log('💾 Final session IDs in localStorage:', sessions.map(s => s.id));
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
