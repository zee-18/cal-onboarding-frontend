import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import './App.css'

interface Message {
  role: 'user' | 'assistant'
  content: string
  id?: string
  error?: boolean
  original?: string // original user message for retries
}

const STARTER_QUESTIONS = [
  'What is Cal.com and what can I do with it?',
  'How do I set my availability?',
  'What is an event type?',
]

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false) // waiting for API response
  const [churnDisplay, setChurnDisplay] = useState(0)
  const [streamingText, setStreamingText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastSentMessageRef = useRef<string | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingText])

  // Count-up animation for churn stat (40%) on mount
  useEffect(() => {
    let start = 0
    const end = 40
    const duration = 1500
    const stepTime = Math.max(Math.floor(duration / end), 20)
    const timer = setInterval(() => {
      start += 1
      setChurnDisplay(start)
      if (start >= end) clearInterval(timer)
    }, stepTime)
    return () => clearInterval(timer)
  }, [])

  const sendMessage = async (message: string) => {
    if (!message.trim() || isStreaming || isWaiting) return

    // Add user message to UI
    const msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const userMessage: Message = { role: 'user', content: message, id: msgId }
    setMessages((prev) => [...prev, userMessage])
    setInput('')

    // Keep track of last sent message for retry
    lastSentMessageRef.current = message

    // Show loading dots bubble
    setIsWaiting(true)

    // Build history including the newly added user message (do not include any in-progress assistant message)
    const history = [...messages, userMessage]

    // Set up fetch with timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error('Non-200 response')
      }

      const data = await response.json()
      const answer = data.answer

      // Hide waiting dots and start streaming
      setIsWaiting(false)
      setIsStreaming(true)
      setStreamingText('')

      const words = answer.split(' ')
      for (let i = 0; i < words.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 30))
        setStreamingText((prev) => {
          const newText = prev ? `${prev} ${words[i]}` : words[i]
          return newText
        })
      }

      // Add final assistant message
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: answer },
      ])
      setStreamingText('')
      setIsStreaming(false)
    } catch (error) {
      clearTimeout(timeout)
      console.error('Error:', error)

      // Hide waiting dots and any streaming state
      setIsWaiting(false)
      setIsStreaming(false)
      setStreamingText('')

      // Insert an assistant error bubble with retry metadata
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          error: true,
          original: message,
        },
      ])
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleRetry = (failedMessage: Message) => {
    // Remove the failed error bubble
    setMessages((prev) => prev.filter((m) => m !== failedMessage))
    // Re-send the original user message if available
    const original = failedMessage.original || lastSentMessageRef.current
    if (original) {
      // small timeout to allow UI to update
      setTimeout(() => sendMessage(original), 50)
    }
  }

  const handleStarterQuestion = (question: string) => {
    sendMessage(question)
  }

  return (
    <div className="chat-container">
      {/* Left gutter strip - User Journey Timeline */}
      <div
        className={`gutter-strip gutter-left ${messages.length === 0 ? 'visible' : 'hidden'}`}
        aria-hidden
      >
        <div className="gutter-heading">USER JOURNEY</div>
        <div className="timeline">
          <div className="timeline-node">
            <span className="node-circle" style={{ background: '#4CAF50', animationDelay: '0s' }} />
            <div className="node-label">User signs up</div>
          </div>
          <div className="timeline-connector" />

          <div className="timeline-node">
            <span className="node-circle" style={{ background: '#FFC107', animationDelay: '0.4s' }} />
            <div className="node-label">Hits a wall</div>
          </div>
          <div className="timeline-connector" />

          <div className="timeline-node">
            <span className="node-circle" style={{ background: '#FF5722', animationDelay: '0.8s' }} />
            <div className="node-label">No answer</div>
          </div>
          <div className="timeline-connector" />

          <div className="timeline-node">
            <span className="node-circle" style={{ background: '#F44336', animationDelay: '1.2s' }} />
            <div className="node-label">Churns silently</div>
          </div>
        </div>
      </div>

      {/* Right gutter strip - The Solution */}
      <div
        className={`gutter-strip gutter-right ${messages.length === 0 ? 'visible' : 'hidden'}`}
        aria-hidden
      >
        <div className="gutter-heading">AI SUCCESS METRICS</div>
        <div className="stat-card">
          <div className="stat-label">CHURN BEFORE FIRST VALUE</div>
          <div className="stat-value">{churnDisplay}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">USERS WHO BOUNCE AT 2AM</div>
          <div className="stat-value">No answer</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">COST PER AI ANSWER</div>
          <div className="stat-value">$0</div>
        </div>
      </div>
      {/* Left Panel */}
      <div className="left-panel">
        <div className="logo-section">
          <h1 className="logo-text">Cal.com</h1>
          <p className="tagline">AI Onboarding Assistant</p>
        </div>

        <div className="description">
          <p>Ask anything about getting started with Cal.com</p>
        </div>

        <div className="starter-questions">
          {STARTER_QUESTIONS.map((question, index) => (
            <button
              key={index}
              className="starter-btn"
              onClick={() => handleStarterQuestion(question)}
              disabled={isStreaming}
            >
              {question}
            </button>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div className="right-panel">
        {/* Mobile-only starter questions (shown when no messages) */}
        {messages.length === 0 && (
          <div className="mobile-starters">
            {STARTER_QUESTIONS.map((question, idx) => (
              <button
                key={idx}
                className="starter-btn mobile-starter-btn"
                onClick={() => handleStarterQuestion(question)}
                disabled={isStreaming}
              >
                {question}
              </button>
            ))}
          </div>
        )}
        <div className="messages-container">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`message message-${msg.role} ${msg.error ? 'error' : ''}`}
            >
              <div className="message-content">
                {msg.role === 'assistant' ? (
                  msg.error ? (
                    <>
                      <span>{msg.content}</span>
                      <button
                        className="error-retry"
                        aria-label="Retry"
                        onClick={() => handleRetry(msg)}
                      >
                        ↺
                      </button>
                    </>
                  ) : (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  )
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {/* Waiting loader (dots) shown only while waiting for API response */}
          {isWaiting && (
            <div className="message message-assistant">
              <div className="message-content">
                <span className="loading-dots" aria-hidden>
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </span>
              </div>
            </div>
          )}

          {isStreaming && (
            <div className="message message-assistant">
              <div className="message-content">
                <ReactMarkdown>{streamingText}</ReactMarkdown>
                <span className="cursor">▋</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="input-bar">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Ask me anything..."
            disabled={isStreaming}
            rows={1}
            className="input-textarea"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="send-btn"
          >
            Send
          </button>
        </div>
      </div>

      {/* Powered By Badge */}
      <a
        href="https://zaeemakhter.com"
        target="_blank"
        rel="noopener noreferrer"
        className="powered-by"
      >
        Built by Zaeem Akhter
      </a>
    </div>
  )
}

export default App
