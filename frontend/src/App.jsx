import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  BookOpenText,
  BrainCircuit,
  Code2,
  Compass,
  FileText,
  FolderOpen,
  Layers3,
  MessageSquarePlus,
  Mic,
  MoonStar,
  Search,
  SendHorizontal,
  Sparkles,
  SunMedium,
  Upload,
  Wand2,
} from 'lucide-react';

const suggestionPrompts = [
  'Explain artificial intelligence in simple words.',
  'What is the difference between machine learning and deep learning?',
  'Help me debug a Python program.',
  'Explain cloud computing with a real-world example.',
  'Prepare notes for my upcoming examination.',
];

const quickActions = [
  {
    title: 'Study Companion',
    description: 'Simplify difficult academic concepts.',
    icon: BookOpenText,
    accent: 'violet',
  },
  {
    title: 'Code Assistant',
    description: 'Debug, explain and generate programming solutions.',
    icon: Code2,
    accent: 'blue',
  },
  {
    title: 'Research Assistant',
    description: 'Explore technical topics and discover useful resources.',
    icon: Compass,
    accent: 'indigo',
  },
  {
    title: 'Knowledge Explorer',
    description: 'Learn about science, technology and general knowledge.',
    icon: BrainCircuit,
    accent: 'cyan',
  },
  {
    title: 'Creative Studio',
    description: 'Brainstorm ideas and create meaningful content.',
    icon: Wand2,
    accent: 'pink',
  },
  {
    title: 'Document Assistant',
    description: 'Upload and interact with your study materials.',
    icon: FileText,
    accent: 'green',
  },
];

const modeOptions = ['Study Buddy', 'Cozy Explainer', 'Creative Muse'];
const answerLengths = ['Short', 'Medium', 'Long'];

const learningChartData = [
  { name: 'Mon', questions: 2, focus: 38 },
  { name: 'Tue', questions: 4, focus: 52 },
  { name: 'Wed', questions: 6, focus: 66 },
  { name: 'Thu', questions: 5, focus: 62 },
  { name: 'Fri', questions: 8, focus: 74 },
  { name: 'Sat', questions: 9, focus: 88 },
];

function buildFileContext(documents) {
  return documents
    .filter((file) => file && file.content)
    .map((file) => ({
      filename: file.filename,
      content: file.content,
    }));
}

export default function App() {
  const [theme, setTheme] = useState('dark');
  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const [quickPrompt, setQuickPrompt] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const [mode, setMode] = useState('Study Buddy');
  const [answerLength, setAnswerLength] = useState('Medium');
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [appError, setAppError] = useState('');

  const chatPreview = useMemo(
    () => selectedChat?.messages ?? [],
    [selectedChat],
  );

  async function fetchChats() {
    try {
      const res = await fetch('http://localhost:8000/api/chats');
      if (!res.ok) {
        throw new Error('Failed to load chats');
      }
      const data = await res.json();
      setChats(data);
      if (data.length && !selectedChatId) {
        setSelectedChatId(data[0].id);
      }
    } catch (error) {
      console.error(error);
      setAppError('Could not connect to the MindSpace API.');
    }
  }

  async function fetchDocuments() {
    try {
      const res = await fetch('http://localhost:8000/api/documents');
      if (!res.ok) {
        throw new Error('Unable to load documents');
      }
      const data = await res.json();
      setDocuments(data);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadChat(chatId) {
    try {
      const reply = await fetch(`http://localhost:8000/api/chats/${chatId}`);
      if (!reply.ok) {
        throw new Error('Chat not found');
      }
      const chat = await reply.json();
      setSelectedChat(chat);
      setSelectedChatId(chat.id);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    fetchChats();
    fetchDocuments();
  }, []);

  useEffect(() => {
    if (!selectedChatId) {
      setSelectedChat(null);
      return;
    }
    loadChat(selectedChatId);
  }, [selectedChatId]);

  async function createChat() {
    try {
      const res = await fetch('http://localhost:8000/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        throw new Error('Could not create a new chat');
      }
      const nextChat = await res.json();
      setChats((current) => [nextChat, ...current]);
      setSelectedChatId(nextChat.id);
      setSelectedChat(nextChat);
      return nextChat;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    setAppError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('http://localhost:8000/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.detail || 'Upload failed');
      }
      const uploaded = await res.json();
      setDocuments((current) => [uploaded, ...current]);
    } catch (error) {
      console.error(error);
      setAppError(error.message || 'Document upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();
    const prompt = messageDraft.trim();
    if (!prompt) {
      return;
    }

    let activeChatId = selectedChatId;
    if (!activeChatId) {
      const chat = await createChat();
      if (!chat) {
        setAppError('Could not create a conversation.');
        return;
      }
      activeChatId = chat.id;
    }

    const currentContext = buildFileContext(documents);

    setSending(true);
    setAppError('');
    try {
      const res = await fetch(`http://localhost:8000/api/chats/${activeChatId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: prompt,
          mode,
          answer_length: answerLength,
          document_context: currentContext,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.detail || 'Message did not send');
      }

      const payload = await res.json();
      const userMessage = { id: `user-${Date.now()}`, role: 'user', content: prompt };
      const assistantMessage = { id: `assistant-${Date.now()}`, role: 'assistant', content: payload.reply };

      setSelectedChat((current) => {
        const nextMessages = [...(current?.messages ?? []), userMessage, assistantMessage];
        return {
          ...current,
          messages: nextMessages,
        };
      });

      setChats((current) =>
        current.map((chat) =>
          chat.id === activeChatId
            ? {
                ...chat,
                preview: prompt,
                updated_at: new Date().toISOString(),
              }
            : chat,
        ),
      );
      setMessageDraft('');
    } catch (error) {
      console.error(error);
      setAppError(error.message || 'Could not send your message.');
    } finally {
      setSending(false);
    }
  }

  const saveTitle = async (chatId, title) => {
    if (!title.trim()) {
      return;
    }
    try {
      const res = await fetch(`http://localhost:8000/api/chats/${chatId}/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        throw new Error('Could not rename chat');
      }
      const renamed = await res.json();
      setChats((current) =>
        current.map((chat) => (chat.id === chatId ? { ...chat, title: renamed.title } : chat)),
      );
      if (selectedChatId === chatId) {
        setSelectedChat(renamed);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const deleteChat = async (chatId) => {
    try {
      const res = await fetch(`http://localhost:8000/api/chats/${chatId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Could not delete chat');
      }
      setChats((current) => current.filter((chat) => chat.id !== chatId));
      if (selectedChatId === chatId) {
        setSelectedChatId(null);
        setSelectedChat(null);
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className={`app-shell ${theme === 'dark' ? 'dark' : 'light'}`}>
      {appError && (
        <div className="app-error" role="alert">
          <span>{appError}</span>
          <button type="button" aria-label="Dismiss error" onClick={() => setAppError('')}>×</button>
        </div>
      )}
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">
            <BrainCircuit size={18} />
          </div>
          <div>
            <div className="brand-name">MINDSPACE</div>
            <div className="brand-tag">Your Intelligent Workspace.</div>
          </div>
        </div>

        <nav className="main-nav">
          <a href="#home">Home</a>
          <a href="#explore">Explore</a>
          <a href="#features">Features</a>
          <a href="#about">About</a>
        </nav>

        <div className="nav-actions">
          <button className="ghost-button" type="button">
            Sign in
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="Toggle theme"
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? <SunMedium size={18} /> : <MoonStar size={18} />}
          </button>
        </div>
      </header>

      {!selectedChat ? (
        <main className="landing-page">
          <section className="hero-panel">
            <div className="hero-copy">
              <span className="eyebrow">Think. Ask. Discover.</span>
              <h1>Your Mind. Your Questions. Your Space.</h1>
              <p>
                Meet your intelligent AI companion. Learn faster, explore deeper and turn your
                curiosity into knowledge.
              </p>

              <div className="search-box">
                <Search size={18} />
                <input
                  value={quickPrompt}
                  onChange={(event) => setQuickPrompt(event.target.value)}
                  placeholder="Ask anything. Your next discovery starts here..."
                />
                <button
                  type="button"
                  onClick={async () => {
                    const next = await createChat();
                    if (next) {
                      setSelectedChatId(next.id);
                      setMessageDraft(quickPrompt);
                    }
                  }}
                  className="primary-button"
                >
                  <SendHorizontal size={16} />
                  Send
                </button>
              </div>

              <div className="quick-actions-row">
                <button type="button" className="secondary-button">
                  <Mic size={16} />
                  Voice
                </button>
                <label className="secondary-button file-label" htmlFor="document-upload">
                  <Upload size={16} />
                  Attach
                </label>
                <input id="document-upload" type="file" onChange={handleUpload} hidden />
              </div>
            </div>

            <motion.div
              className="hero-visual"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="orb orb-one" />
              <div className="orb orb-two" />
              <div className="network-card">
                <div className="network-header">
                  <Sparkles size={18} />
                  AI Insights
                </div>
                <div className="node-grid">
                  {[...Array(12)].map((_, index) => (
                    <span key={index} className="node" style={{ '--delay': `${index * 0.1}s` }} />
                  ))}
                </div>
                <div className="mini-metrics">
                  <div>
                    <strong>94%</strong>
                    <span>clarity</span>
                  </div>
                  <div>
                    <strong>12k</strong>
                    <span>knowledge links</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </section>

          <section className="card-grid" id="features">
            {quickActions.map(({ title, description, icon: Icon, accent }) => (
              <motion.button
                whileHover={{ y: -4 }}
                type="button"
                key={title}
                className={`feature-card ${accent}`}
                onClick={() => setQuickPrompt(`${title}: ${description}`)}
              >
                <div className="card-icon">
                  <Icon size={22} />
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
              </motion.button>
            ))}
          </section>

          <section className="suggestions-row">
            <div className="section-heading">
              <span>Suggested questions</span>
            </div>
            <div className="suggestion-list">
              {suggestionPrompts.map((prompt) => (
                <button key={prompt} type="button" onClick={() => setQuickPrompt(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </section>

          <section className="dashboard-lower">
            <div className="activity-card">
              <div className="section-heading compact">
                <span>Recent activity</span>
              </div>
              <ul>
                {chats.slice(0, 4).map((chat) => (
                  <li key={chat.id}>
                    <div>
                      <strong>{chat.title}</strong>
                      <span>{chat.preview ?? 'New conversation'}</span>
                    </div>
                    <time>{new Date(chat.updated_at).toLocaleDateString()}</time>
                  </li>
                ))}
              </ul>
            </div>

            <div className="insights-card">
              <div className="section-heading compact">
                <span>Learning flow</span>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={learningChartData}>
                    <defs>
                      <linearGradient id="focusFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#635BDB" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#635BDB" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(146,152,170,0.18)" />
                    <XAxis dataKey="name" stroke="#9298AA" />
                    <YAxis stroke="#9298AA" />
                    <Tooltip />
                    <Area type="monotone" dataKey="focus" stroke="#635BDB" fill="url(#focusFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </main>
      ) : (
        <main className="workspace-layout">
          <aside className="sidebar">
            <div className="sidebar-header">
              <div className="brand-mark small">
                <BrainCircuit size={16} />
              </div>
              <span>MINDSPACE</span>
            </div>

            <button className="sidebar-primary" type="button" onClick={createChat}>
              <MessageSquarePlus size={16} />
              New Chat
            </button>

            <div className="sidebar-section">
              <div className="sidebar-label">Recent conversations</div>
              <div className="chat-list">
                {chats.map((chat) => (
                  <div
                    key={chat.id}
                    className={`chat-item ${selectedChatId === chat.id ? 'active' : ''}`}
                    onClick={() => setSelectedChatId(chat.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        setSelectedChatId(chat.id);
                      }
                    }}
                  >
                    <div className="chat-item-copy">
                      <strong>{chat.title}</strong>
                      <span>{chat.preview || 'Start a new idea'}</span>
                    </div>
                    <button
                      type="button"
                      className="mini-icon-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        saveTitle(chat.id, prompt('Rename chat', chat.title) || chat.title);
                      }}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="mini-icon-button danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteChat(chat.id);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="sidebar-section tool-panel">
              <div className="sidebar-label">Explore tools</div>
              <div className="tool-list">
                <div><Layers3 size={16} /> Knowledge Explorer</div>
                <div><FolderOpen size={16} /> Document Assistant</div>
                <div><Sparkles size={16} /> Smart suggestions</div>
              </div>
            </div>
          </aside>

          <section className="chat-panel">
            <div className="chat-header">
              <div>
                <span className="eyebrow muted">Workspace</span>
                <h2>{selectedChat?.title || 'Your conversation'}</h2>
              </div>
              <div className="header-tools">
                <select value={mode} onChange={(event) => setMode(event.target.value)}>
                  {modeOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select value={answerLength} onChange={(event) => setAnswerLength(event.target.value)}>
                  {answerLengths.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="messages-panel">
              {chatPreview.length === 0 ? (
                <div className="empty-state">
                  <BrainCircuit size={42} />
                  <h3>Start with a question</h3>
                  <p>Upload files, ask for explanation, or brainstorm new ideas.</p>
                </div>
              ) : (
                chatPreview.map((message) => (
                  <div key={message.id} className={`message-row ${message.role}`}>
                    <div className="avatar">{message.role === 'user' ? 'You' : 'AI'}</div>
                    <div className="message-card">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="composer-panel">
              {documents.length > 0 && (
                <div className="document-strip">
                  {documents.map((doc) => (
                    <span key={doc.id}>{doc.filename}</span>
                  ))}
                </div>
              )}
              <form className="composer" onSubmit={handleSendMessage}>
                <label className="composer-attachment" htmlFor="document-upload-workspace">
                  <Upload size={16} />
                  <span>Attach</span>
                </label>
                <input id="document-upload-workspace" type="file" onChange={handleUpload} hidden />
                <textarea
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  placeholder="Message MindSpace..."
                  rows={3}
                />
                <button className="primary-button" type="submit" disabled={sending}>
                  {sending ? 'Thinking...' : <><SendHorizontal size={16} /> Send</>}
                </button>
              </form>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
