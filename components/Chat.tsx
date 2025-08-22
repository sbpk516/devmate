'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ALLOWED_MODELS, ChatStats, ChatSession, ChatMessage } from '@/lib/types';
import CopyIcon from './CopyIcon';
import ChatHistory from './ChatHistory';
import { storage } from '@/lib/storage';

export default function Chat() {
  const [prompt, setPrompt] = useState('');
  const [system, setSystem] = useState('');
  const [model, setModel] = useState<'gpt-4o-mini' | 'gpt-4o'>('gpt-4o');
  const [stream, setStream] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [stats, setStats] = useState<ChatStats | null>(null);
  
  // Chat History State
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Load chat history on component mount
  useEffect(() => {
    try {
      const history = storage.loadHistory();
      setChatHistory(history);
      console.log('📚 Loaded chat history:', history);
      console.log('📚 Chat history length:', history.length);
    } catch (error) {
      console.error('Failed to load chat history:', error);
      // Show user-friendly error message
      setError('Failed to load chat history. Please refresh the page.');
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, []);

  // Log component render cycles
  console.log('🔄 Chat component render #', Date.now(), 'currentSessionId:', currentSessionId);

  // Auto-save helper function
  const autoSaveChat = useCallback((responseContent: string, promptText: string) => {
    console.log('🔍 === AUTO SAVE DEBUG ===');
    console.log('🔍 currentSessionId:', currentSessionId);
    console.log('🔍 chatHistory.length:', chatHistory.length);
    console.log('🔍 chatHistory IDs:', chatHistory.map(s => s.id));
    console.log('🔍 Response content length:', responseContent?.length);
            console.log('🔍 Prompt:', promptText?.substring(0, 50) + '...');
    
    if (responseContent && promptText) {
      try {
        const sessionId = currentSessionId || storage.generateId();
        console.log('🔍 Using sessionId:', sessionId);
        console.log('🔍 Is this a new session?', !currentSessionId);
        
        // Get existing session if continuing a chat
        const existingSession = currentSessionId ? chatHistory.find(s => s.id === currentSessionId) : null;
        console.log('🔍 Found existing session:', !!existingSession);
        if (existingSession) {
          console.log('🔍 Existing session title:', existingSession.title);
          console.log('🔍 Existing session messages count:', existingSession.messages.length);
        }
        if (existingSession) {
          console.log('🔍 Existing session messages count:', existingSession.messages.length);
          console.log('🔍 Existing session messages:', existingSession.messages.map(m => `${m.role}: ${m.content.substring(0, 30)}...`));
        }
        
        // Prepare messages - append to existing or create new
        let messages: ChatMessage[];
        if (existingSession) {
          // Continue existing conversation
          const oldMessages = [...existingSession.messages];
          const newMessages = [
            { role: 'user' as const, content: promptText },
            { role: 'assistant' as const, content: responseContent }
          ];
          messages = [...oldMessages, ...newMessages];
          console.log('📝 Continuing existing chat:');
          console.log('  - Old messages count:', oldMessages.length);
          console.log('  - Old messages:', oldMessages.map(m => `${m.role}: ${m.content.substring(0, 50)}...`));
          console.log('  - New messages count:', newMessages.length);
          console.log('  - New messages:', newMessages.map(m => `${m.role}: ${m.content.substring(0, 50)}...`));
          console.log('  - Total messages count:', messages.length);
          console.log('  - Combined messages:', messages.map(m => `${m.role}: ${m.content.substring(0, 50)}...`));
        } else {
          // Start new conversation
          messages = [
            { role: 'user' as const, content: promptText },
            { role: 'assistant' as const, content: responseContent }
          ];
          console.log('🆕 Starting new chat, total messages:', messages.length);
          console.log('🆕 New messages:', messages.map(m => `${m.role}: ${m.content.substring(0, 50)}...`));
        }
        
        const session: ChatSession = {
          id: sessionId,
          title: existingSession?.title || (promptText.substring(0, 50) + (promptText.length > 50 ? '...' : '')),
          timestamp: existingSession?.timestamp || Date.now(),
          messages,
          model,
          system: system || undefined
        };
        
        console.log('🔍 Session to save:', {
          id: session.id,
          title: session.title,
          messagesCount: session.messages.length,
          isNew: !currentSessionId
        });
        
        storage.saveSession(session);
        console.log('🔍 Before setCurrentSessionId:', currentSessionId);
        setCurrentSessionId(sessionId);
        console.log('🔍 After setCurrentSessionId call (async):', sessionId);
        
        setChatHistory(prev => {
          console.log('🔍 Updating chatHistory, previous length:', prev.length);
          const existingIndex = prev.findIndex(s => s.id === sessionId);
          console.log('🔍 Found existing index in chatHistory:', existingIndex);
          
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = session;
            console.log('🔍 Updated existing session at index:', existingIndex);
            return updated;
          } else {
            console.log('🔍 Adding new session to chatHistory');
            return [...prev, session];
          }
        });
        
        console.log('🔍 === END AUTO SAVE DEBUG ===');
      } catch (error) {
        console.error('Failed to auto-save chat session:', error);
        setError('Failed to save chat. Please try again.');
      }
    }
  }, [currentSessionId, model, system, chatHistory]); // Removed prompt from dependencies since we pass it as parameter

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsLoading(true);
    setError('');
    // Only clear output for new chats, preserve for continuing chats
    if (!currentSessionId) {
      setOutput('');
    }
    setStats(null);
    
    // Store the current prompt for submission
    const currentPrompt = prompt;
    
    // Auto-clear the prompt after submission
    setPrompt('');
    
    const startTime = performance.now();
    
    try {
      if (stream) {
        // Streaming request
        abortControllerRef.current = new AbortController();
        
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: currentPrompt, system, model, stream: true }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Request failed');
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let content = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                const latencyMs = Math.round(performance.now() - startTime);
                const approximateTokens = Math.ceil(content.length / 4); // Rough estimate
                setStats({ latencyMs, approximateTokens });
                
                console.log('🔄 Streaming response completed, content length:', content.length);
                // Auto-save the completed chat
                autoSaveChat(content, currentPrompt);
                return;
              }
              
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  content += parsed.content;
                  setOutput(content);
                  setTimeout(scrollToBottom, 0);
                }
              } catch (e) {
                // Ignore parsing errors for partial chunks
              }
            }
          }
        }
      } else {
        // Non-streaming request
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: currentPrompt, system, model, stream: false }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Request failed');
        }

        const data = await response.json();
        setOutput(data.content);
        
        const latencyMs = data.latencyMs || Math.round(performance.now() - startTime);
        const approximateTokens = data.usage?.total_tokens || Math.ceil(data.content.length / 4);
        setStats({ latencyMs, approximateTokens });
        
        console.log('🔄 Non-streaming response received, content length:', data.content.length);
        // Auto-save the completed chat
        autoSaveChat(data.content, currentPrompt);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setError('Request cancelled');
      } else {
        setError(error instanceof Error ? error.message : 'An error occurred');
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };



  const handleClear = () => {
    setPrompt('');
    setSystem('');
    setOutput('');
    setError('');
    setStats(null);
  };

  // Handle Enter key press in textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim() && !isLoading) {
        handleSubmit(e as any);
      }
    }
  };

  // Chat History Functions
  const handleSelectChat = (sessionId: string) => {
    try {
      const session = chatHistory.find(s => s.id === sessionId);
      if (session) {
        setCurrentSessionId(session.id);
        
        // Load the last user message and assistant response
        const userMessages = session.messages.filter(m => m.role === 'user');
        const assistantMessages = session.messages.filter(m => m.role === 'assistant');
        
        if (userMessages.length > 0) {
          setPrompt(userMessages[userMessages.length - 1].content);
        }
        
        if (assistantMessages.length > 0) {
          setOutput(assistantMessages[assistantMessages.length - 1].content);
        }
        
        setModel(session.model as 'gpt-4o' | 'gpt-4o-mini');
        setSystem(session.system || '');
        setError('');
        setStats(null);
        
        console.log('Loaded chat session:', session.title);
      }
    } catch (error) {
      console.error('Failed to load chat session:', error);
      setError('Failed to load chat session. Please try again.');
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setPrompt('');
    setSystem('');
    setOutput('');
    setError('');
    setStats(null);
    console.log('Started new chat');
  };

  const handleDeleteChat = (sessionId: string) => {
    try {
      // Add confirmation for delete operation
      const session = chatHistory.find(s => s.id === sessionId);
      const sessionTitle = session?.title || 'this chat';
      
      if (window.confirm(`Are you sure you want to delete "${sessionTitle}"? This action cannot be undone.`)) {
        storage.deleteSession(sessionId);
        setChatHistory(prev => prev.filter(s => s.id !== sessionId));
        
        // If we're deleting the current session, clear the form
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
          setPrompt('');
          setSystem('');
          setOutput('');
          setError('');
          setStats(null);
        }
        
        console.log('Deleted chat session:', sessionId);
      }
    } catch (error) {
      console.error('Failed to delete chat session:', error);
      setError('Failed to delete chat session. Please try again.');
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar - hidden on mobile, visible on desktop */}
      <div className={`${showSidebar ? 'block' : 'hidden'} md:block`}>
        <ChatHistory 
          sessions={chatHistory}
          currentSessionId={currentSessionId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onDeleteChat={handleDeleteChat}
        />
      </div>
      
      {/* Main content area */}
      <div className="flex-1 max-w-4xl mx-auto p-6 space-y-6">
        {/* Mobile sidebar toggle button */}
        <div className="md:hidden mb-4">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            {showSidebar ? 'Hide History' : 'Show History'}
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">DevMate</h1>
        
        {/* Always display conversation section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Conversation</h2>
            {(currentSessionId && chatHistory.find(s => s.id === currentSessionId)?.messages.length > 0) && (
              <CopyIcon 
                text={(chatHistory.find(s => s.id === currentSessionId)?.messages || []).map(m => `${m.role}: ${m.content}`).join('\n\n')} 
                size="md" 
              />
            )}
          </div>
          <div
            ref={outputRef}
            className="bg-gray-50 rounded-md p-4 max-h-96 overflow-y-auto"
          >
            {/* Show conversation messages if they exist */}
            {currentSessionId && chatHistory.find(s => s.id === currentSessionId)?.messages.length > 0 ? (
              <div className="space-y-4">
                {(chatHistory.find(s => s.id === currentSessionId)?.messages || []).map((message, index) => (
                  <div key={index} className={`p-3 rounded-lg ${
                    message.role === 'user' 
                      ? 'bg-blue-100 border border-blue-200 ml-8' 
                      : 'bg-gray-100 border border-gray-200 mr-8'
                  }`}>
                    <div className="font-semibold text-sm text-gray-700 mb-1">
                      {message.role === 'user' ? 'You' : 'Assistant'}
                    </div>
                    <div className="whitespace-pre-wrap text-gray-900">
                      {message.content}
                    </div>
                  </div>
                ))}
              </div>
            ) : output ? (
              /* Show single response for new chats */
              <div className="whitespace-pre-wrap text-gray-900">
                {output}
              </div>
            ) : (
              /* Show empty state */
              <div className="text-center py-12 text-gray-500">
                <div className="mb-4">
                  <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-gray-400">Start a conversation</p>
                <p className="text-sm mt-1">Type your message below and click Submit to begin</p>
              </div>
            )}
          </div>
          
          {stats && (
            <div className="mt-4 text-sm text-gray-600">
              <span className="mr-4">Latency: {stats.latencyMs}ms</span>
              <span>Approximate tokens: {stats.approximateTokens}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
              Prompt *
            </label>
            <div className="relative">
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={4}
                placeholder="Enter your prompt here... (Press Enter to submit, Shift+Enter for new line)"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !prompt.trim()}
                className="absolute right-2 top-2 p-2 text-gray-400 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  if (prompt.trim() && !isLoading) {
                    handleSubmit(e as any);
                  }
                }}
                title="Submit (Enter)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-2">
                Model
              </label>
              <select
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value as 'gpt-4o-mini' | 'gpt-4o')}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              >
                {ALLOWED_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center">
              <input
                id="stream"
                type="checkbox"
                checked={stream}
                onChange={(e) => setStream(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={isLoading}
              />
              <label htmlFor="stream" className="ml-2 block text-sm text-gray-900">
                Stream
              </label>
            </div>
          </div>

          {isLoading && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleStop}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Stop Generation
              </button>
            </div>
          )}
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}
    </div>
  </div>
  );
}
