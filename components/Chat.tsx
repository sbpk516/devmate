'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ALLOWED_MODELS, ChatStats, ChatSession } from '@/lib/types';
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
      console.log('Loaded chat history:', history);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsLoading(true);
    setError('');
    setOutput('');
    setStats(null);
    
    const startTime = performance.now();
    
    try {
      if (stream) {
        // Streaming request
        abortControllerRef.current = new AbortController();
        
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, system, model, stream: true }),
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
          body: JSON.stringify({ prompt, system, model, stream: false }),
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
      
      // Auto-save chat session if we have output
      if (output && prompt) {
        try {
          const sessionId = currentSessionId || storage.generateId();
          const session: ChatSession = {
            id: sessionId,
            title: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
            timestamp: Date.now(),
            messages: [
              { role: 'user', content: prompt },
              { role: 'assistant', content: output }
            ],
            model,
            system: system || undefined
          };
          
          storage.saveSession(session);
          setCurrentSessionId(sessionId);
          setChatHistory(prev => {
            const existingIndex = prev.findIndex(s => s.id === sessionId);
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = session;
              return updated;
            } else {
              return [...prev, session];
            }
          });
          
          console.log('Auto-saved chat session:', session.title);
          // Show success message (optional - can be replaced with toast notification)
          if (!currentSessionId) {
            console.log('✅ Chat saved successfully!');
          }
        } catch (error) {
          console.error('Failed to auto-save chat session:', error);
          setError('Failed to save chat. Please try again.');
        }
      }
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
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
              Prompt *
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={4}
              placeholder="Enter your prompt here..."
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="system" className="block text-sm font-medium text-gray-700 mb-2">
              System Message (Optional)
            </label>
            <textarea
              id="system"
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              placeholder="Enter system message..."
              disabled={isLoading}
            />
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

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Generating...' : 'Submit'}
            </button>
            
            {isLoading && (
              <button
                type="button"
                onClick={handleStop}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Stop
              </button>
            )}
            
            {output && (
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {output && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Response</h2>
            <CopyIcon text={output} size="md" />
          </div>
          <div
            ref={outputRef}
            className="bg-gray-50 rounded-md p-4 max-h-96 overflow-y-auto whitespace-pre-wrap text-gray-900"
          >
            {output}
          </div>
          
          {stats && (
            <div className="mt-4 text-sm text-gray-600">
              <span className="mr-4">Latency: {stats.latencyMs}ms</span>
              <span>Approximate tokens: {stats.approximateTokens}</span>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
