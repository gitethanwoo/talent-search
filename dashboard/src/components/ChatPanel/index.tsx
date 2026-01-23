import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { StreamEventView } from '../TaskPanel/StreamEventView'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  events?: ChatStreamEvent[]
}

interface ChatStreamEvent {
  type: 'text' | 'tool_call' | 'tool_result'
  tool?: string
  content: string
}

interface ChatSession {
  id: string
  messages: ChatMessage[]
  status: 'idle' | 'streaming' | 'error'
  currentResponse: string
  currentEvents: ChatStreamEvent[]
  createdAt: string
  updatedAt: string
}

interface ChatPanelProps {
  isOpen: boolean
  onToggle: () => void
}

export function ChatPanel({ isOpen, onToggle }: ChatPanelProps) {
  const [session, setSession] = useState<ChatSession | null>(null)
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session?.messages, session?.currentResponse])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // SSE connection for chat updates
  useEffect(() => {
    if (!isOpen) return

    const eventSource = new EventSource('/api/chat/stream')

    eventSource.addEventListener('init', (e) => {
      const data = JSON.parse(e.data)
      setSession(data)
      setConnected(true)
    })

    eventSource.onmessage = (e) => {
      const data = JSON.parse(e.data) as ChatSession
      setSession(data)
    }

    eventSource.onerror = () => {
      setConnected(false)
    }

    return () => eventSource.close()
  }, [isOpen])

  const sendMessage = async () => {
    if (!input.trim() || session?.status === 'streaming') return

    const message = input.trim()
    setInput('')

    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      })
    } catch (e) {
      console.error('Failed to send message:', e)
    }
  }

  const clearChat = async () => {
    try {
      await fetch('/api/chat/session', { method: 'DELETE' })
      setSession(null)
    } catch (e) {
      console.error('Failed to clear chat:', e)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Don't render anything if closed
  if (!isOpen) return null

  return (
    <div className="fixed top-0 right-0 bottom-0 w-[420px] bg-zinc-950 border-l border-zinc-800 z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 16 16" className="w-5 h-5 text-[#D97757]" fill="currentColor">
                <path d="m3.127 10.604 3.135-1.76.053-.153-.053-.085H6.11l-.525-.032-1.791-.048-1.554-.065-1.505-.08-.38-.081L0 7.832l.036-.234.32-.214.455.04 1.009.069 1.513.105 1.097.064 1.626.17h.259l.036-.105-.089-.065-.068-.064-1.566-1.062-1.695-1.121-.887-.646-.48-.327-.243-.306-.104-.67.435-.48.585.04.15.04.593.456 1.267.981 1.654 1.218.242.202.097-.068.012-.049-.109-.181-.9-1.626-.96-1.655-.428-.686-.113-.411a2 2 0 0 1-.068-.484l.496-.674L4.446 0l.662.089.279.242.411.94.666 1.48 1.033 2.014.302.597.162.553.06.17h.105v-.097l.085-1.134.157-1.392.154-1.792.052-.504.25-.605.497-.327.387.186.319.456-.045.294-.19 1.23-.37 1.93-.243 1.29h.142l.161-.16.654-.868 1.097-1.372.484-.545.565-.601.363-.287h.686l.505.751-.226.775-.707.895-.585.759-.839 1.13-.524.904.048.072.125-.012 1.897-.403 1.024-.186 1.223-.21.553.258.06.263-.218.536-1.307.323-1.533.307-2.284.54-.028.02.032.04 1.029.098.44.024h1.077l2.005.15.525.346.315.424-.053.323-.807.411-3.631-.863-.872-.218h-.12v.073l.726.71 1.331 1.202 1.667 1.55.084.383-.214.302-.226-.032-1.464-1.101-.565-.497-1.28-1.077h-.084v.113l.295.432 1.557 2.34.08.718-.112.234-.404.141-.444-.08-.911-1.28-.94-1.44-.759-1.291-.093.053-.448 4.821-.21.246-.484.186-.403-.307-.214-.496.214-.98.258-1.28.21-1.016.19-1.263.112-.42-.008-.028-.092.012-.953 1.307-1.448 1.957-1.146 1.227-.274.109-.477-.247.045-.44.266-.39 1.586-2.018.956-1.25.617-.723-.004-.105h-.036l-4.212 2.736-.75.096-.324-.302.04-.496.154-.162 1.267-.871z"/>
              </svg>
              <span className="font-semibold text-white">Claude</span>
            </div>
            {!connected && (
              <span className="text-[10px] text-red-400">(reconnecting...)</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {session && session.messages.length > 0 && (
              <button
                onClick={clearChat}
                className="p-2 hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-zinc-300"
                title="Clear chat"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            <button
              onClick={onToggle}
              className="p-2 hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-zinc-300"
              title="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {(!session || session.messages.length === 0) && !session?.currentResponse && (
            <div className="h-full flex flex-col items-center justify-center text-center px-8">
              <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-amber-400" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">How can I help?</h3>
              <p className="text-sm text-zinc-500 mb-6">
                Ask me anything about your prospects. I can help compare candidates, suggest who to prioritize, or answer questions about the pipeline.
              </p>
              <div className="space-y-2 w-full">
                <button
                  onClick={() => setInput('Who are the top 3 candidates I should reach out to first?')}
                  className="w-full text-left text-sm px-4 py-3 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all"
                >
                  Who are the top 3 candidates I should reach out to first?
                </button>
                <button
                  onClick={() => setInput('If you could only pick one prospect, who would it be and why?')}
                  className="w-full text-left text-sm px-4 py-3 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all"
                >
                  If you could only pick one prospect, who would it be?
                </button>
                <button
                  onClick={() => setInput('Summarize the current state of my pipeline')}
                  className="w-full text-left text-sm px-4 py-3 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all"
                >
                  Summarize the current state of my pipeline
                </button>
              </div>
            </div>
          )}

          {session?.messages.map((msg, i) => (
            <div key={i} className={`${msg.role === 'user' ? 'flex justify-end' : ''}`}>
              {msg.role === 'user' ? (
                <div className="max-w-[85%] bg-zinc-800 text-white px-4 py-3 text-sm">
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Tool events for completed messages */}
                  {msg.events?.map((event, j) => (
                    <StreamEventView key={j} event={event} />
                  ))}
                  {/* Text content */}
                  <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0 prose-headings:my-2 prose-strong:text-amber-400 text-zinc-200 text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Streaming response with tool events */}
          {session?.status === 'streaming' && (
            <div className="space-y-1">
              {/* Tool events using StreamEventView (filter out text - shown via currentResponse) */}
              {session.currentEvents.filter(e => e.type !== 'text').map((event, i) => (
                <StreamEventView key={i} event={event} />
              ))}

              {/* Text response (streaming) */}
              {session.currentResponse ? (
                <div>
                  <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0 prose-headings:my-2 prose-strong:text-amber-400 text-zinc-200 text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{session.currentResponse}</ReactMarkdown>
                  </div>
                  <span className="inline-block w-2 h-4 bg-amber-400/80 animate-pulse" />
                </div>
              ) : session.currentEvents.length === 0 ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  <span className="text-sm text-zinc-500">Thinking...</span>
                </div>
              ) : null}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-zinc-800 p-4">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your prospects..."
              disabled={session?.status === 'streaming'}
              className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 px-4 py-3 pr-12 text-sm resize-none focus:outline-none focus:border-zinc-600 disabled:opacity-50"
              rows={3}
              style={{ minHeight: '80px', maxHeight: '150px' }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || session?.status === 'streaming'}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-zinc-500 hover:text-amber-400 disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
              </svg>
            </button>
          </div>
        </div>
    </div>
  )
}
