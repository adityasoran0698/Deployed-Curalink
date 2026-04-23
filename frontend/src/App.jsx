import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500&family=Exo+2:wght@300;400;600;700&display=swap');

  :root {
    --bg-void: #020817;
    --bg-panel: #080e1f;
    --bg-glass: rgba(0, 245, 212, 0.04);
    --bg-glass-amber: rgba(255, 159, 28, 0.08);
    --cyan: #00f5d4;
    --cyan-dim: rgba(0, 245, 212, 0.15);
    --cyan-border: rgba(0, 245, 212, 0.3);
    --violet: #8b5cf6;
    --violet-dim: rgba(139, 92, 246, 0.15);
    --amber: #ff9f1c;
    --amber-dim: rgba(255, 159, 28, 0.2);
    --green-neo: #10ffb1;
    --text-primary: #e2f4f0;
    --text-muted: rgba(180, 220, 215, 0.55);
    --text-dim: rgba(130, 180, 175, 0.35);
    --border-subtle: rgba(0, 245, 212, 0.1);
    --border-mid: rgba(0, 245, 212, 0.22);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg-void);
    font-family: 'Exo 2', sans-serif;
    color: var(--text-primary);
    overflow: hidden;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--cyan-border); border-radius: 4px; }

  /* Grid background */
  .chat-bg {
    background-color: var(--bg-void);
    background-image:
      linear-gradient(rgba(0, 245, 212, 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 245, 212, 0.04) 1px, transparent 1px);
    background-size: 40px 40px;
    position: relative;
  }
  .chat-bg::before {
    content: '';
    position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0, 245, 212, 0.06) 0%, transparent 70%),
                radial-gradient(ellipse 60% 40% at 80% 100%, rgba(139, 92, 246, 0.06) 0%, transparent 70%);
  }

  /* Sidebar glow line */
  .sidebar { position: relative; }
  .sidebar::after {
    content: '';
    position: absolute; top: 0; right: 0; bottom: 0; width: 1px;
    background: linear-gradient(to bottom, transparent 0%, var(--cyan) 40%, var(--violet) 70%, transparent 100%);
    opacity: 0.4;
  }

  /* Neon glow on AI bubble */
  .ai-bubble {
    background: var(--bg-glass);
    border: 1px solid var(--border-mid);
    box-shadow: 0 0 20px rgba(0, 245, 212, 0.06), inset 0 0 30px rgba(0, 245, 212, 0.03);
    border-radius: 0px 18px 18px 18px;
    position: relative;
    backdrop-filter: blur(12px);
  }
  .ai-bubble::before {
    content: '';
    position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
    background: linear-gradient(135deg, rgba(0,245,212,0.05) 0%, transparent 50%);
  }

  /* User bubble */
  .user-bubble {
    background: linear-gradient(135deg, rgba(255,159,28,0.25) 0%, rgba(255,100,50,0.15) 100%);
    border: 1px solid rgba(255, 159, 28, 0.35);
    box-shadow: 0 0 16px rgba(255, 159, 28, 0.1);
    border-radius: 18px 0px 18px 18px;
  }

  /* Markdown inside AI bubble */
  .ai-content h2 {
    font-family: 'Rajdhani', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--cyan);
    text-shadow: 0 0 12px rgba(0, 245, 212, 0.6);
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 6px;
    margin: 20px 0 10px;
  }
  .ai-content h2:first-child { margin-top: 4px; }

  .ai-content h3 {
    font-family: 'Rajdhani', sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--violet);
    margin: 14px 0 6px;
  }

  .ai-content p {
    font-size: 13px;
    line-height: 1.75;
    color: var(--text-primary);
    margin-bottom: 8px;
    font-weight: 300;
  }

  .ai-content strong {
    color: #fff;
    font-weight: 600;
    text-shadow: 0 0 8px rgba(255,255,255,0.2);
  }

  .ai-content ul, .ai-content ol {
    padding-left: 18px;
    margin-bottom: 8px;
  }
  .ai-content li {
    font-size: 13px;
    color: var(--text-primary);
    line-height: 1.7;
    margin-bottom: 3px;
    font-weight: 300;
  }

  .ai-content blockquote {
    border-left: 2px solid var(--cyan);
    padding: 10px 14px;
    margin: 10px 0;
    background: rgba(0, 245, 212, 0.05);
    border-radius: 0 8px 8px 0;
    box-shadow: inset 2px 0 12px rgba(0,245,212,0.05);
  }
  .ai-content blockquote p {
    margin: 0;
    color: rgba(200, 240, 235, 0.85);
    font-size: 12.5px;
  }

  .ai-content table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 12px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border-subtle);
  }
  .ai-content thead {
    background: linear-gradient(90deg, rgba(0,245,212,0.12), rgba(139,92,246,0.12));
  }
  .ai-content th {
    padding: 8px 12px;
    text-align: left;
    color: var(--cyan);
    font-family: 'Rajdhani', sans-serif;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 11px;
    border-bottom: 1px solid var(--border-mid);
  }
  .ai-content td {
    padding: 7px 12px;
    color: var(--text-primary);
    border-bottom: 1px solid var(--border-subtle);
    font-weight: 300;
    font-size: 12.5px;
  }
  .ai-content tr:last-child td { border-bottom: none; }
  .ai-content tr:hover td { background: rgba(0,245,212,0.04); }

  .ai-content a {
    color: var(--cyan);
    text-decoration: underline;
    text-decoration-color: rgba(0, 245, 212, 0.4);
    text-underline-offset: 3px;
    transition: text-shadow 0.2s;
  }
  .ai-content a:hover { text-shadow: 0 0 10px var(--cyan); }

  .ai-content hr {
    border: none;
    border-top: 1px solid var(--border-subtle);
    margin: 14px 0;
  }

  .ai-content code {
    background: rgba(0, 245, 212, 0.08);
    color: var(--cyan);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    border: 1px solid rgba(0, 245, 212, 0.15);
  }

  .ai-content pre {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    padding: 12px;
    overflow-x: auto;
    margin: 10px 0;
  }
  .ai-content pre code {
    background: none;
    border: none;
    padding: 0;
    font-size: 11px;
  }

  /* Quick query button */
  .quick-btn {
    width: 100%;
    text-align: left;
    padding: 9px 12px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-muted);
    font-family: 'Exo 2', sans-serif;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex; align-items: center; gap: 8px;
  }
  .quick-btn:hover {
    background: rgba(0, 245, 212, 0.06);
    border-color: var(--border-subtle);
    color: var(--cyan);
    box-shadow: 0 0 10px rgba(0,245,212,0.05);
  }
  .quick-btn-arrow {
    color: var(--violet);
    font-size: 14px;
    transition: transform 0.2s;
  }
  .quick-btn:hover .quick-btn-arrow { transform: translateX(3px); color: var(--cyan); }

  /* Send button */
  .send-btn {
    width: 38px; height: 38px;
    border-radius: 10px;
    border: none;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
    background: linear-gradient(135deg, var(--cyan) 0%, #00c2a8 100%);
    box-shadow: 0 0 16px rgba(0, 245, 212, 0.35);
  }
  .send-btn:hover { box-shadow: 0 0 24px rgba(0, 245, 212, 0.55); transform: scale(1.05); }
  .send-btn:active { transform: scale(0.96); }
  .send-btn:disabled { background: rgba(0,245,212,0.15); box-shadow: none; cursor: not-allowed; }

  /* Textarea */
  .chat-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-family: 'Exo 2', sans-serif;
    font-size: 13px;
    font-weight: 300;
    resize: none;
    max-height: 120px;
    line-height: 1.6;
    caret-color: var(--cyan);
  }
  .chat-input::placeholder { color: var(--text-dim); }

  /* Input wrapper */
  .input-wrapper {
    display: flex; align-items: flex-end; gap: 12px;
    background: rgba(8, 14, 31, 0.9);
    border: 1px solid var(--border-mid);
    border-radius: 14px;
    padding: 12px 14px;
    transition: border-color 0.2s, box-shadow 0.2s;
    backdrop-filter: blur(10px);
  }
  .input-wrapper:focus-within {
    border-color: rgba(0, 245, 212, 0.5);
    box-shadow: 0 0 20px rgba(0, 245, 212, 0.1), 0 0 0 1px rgba(0,245,212,0.08);
  }

  /* Online badge */
  .online-badge {
    display: flex; align-items: center; gap: 7px;
    padding: 5px 12px;
    border-radius: 20px;
    border: 1px solid rgba(16, 255, 177, 0.25);
    background: rgba(16, 255, 177, 0.06);
  }
  .online-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--green-neo);
    box-shadow: 0 0 8px var(--green-neo);
    animation: pulse-green 2s ease infinite;
  }
  @keyframes pulse-green {
    0%, 100% { opacity: 1; box-shadow: 0 0 8px var(--green-neo); }
    50% { opacity: 0.6; box-shadow: 0 0 4px var(--green-neo); }
  }

  /* Loading dots */
  @keyframes bounce-neo {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
    40% { transform: translateY(-6px); opacity: 1; }
  }
  .dot-1 { animation: bounce-neo 1.4s ease-in-out infinite 0ms; }
  .dot-2 { animation: bounce-neo 1.4s ease-in-out infinite 160ms; }
  .dot-3 { animation: bounce-neo 1.4s ease-in-out infinite 320ms; }

  /* Scanner line in loading */
  @keyframes scan {
    0% { transform: translateY(0); opacity: 0; }
    20% { opacity: 1; }
    80% { opacity: 1; }
    100% { transform: translateY(28px); opacity: 0; }
  }

  /* Logo pulse */
  @keyframes logo-pulse {
    0%, 100% { box-shadow: 0 0 12px rgba(0,245,212,0.4); }
    50% { box-shadow: 0 0 24px rgba(0,245,212,0.7), 0 0 48px rgba(0,245,212,0.2); }
  }
  .logo-icon { animation: logo-pulse 3s ease-in-out infinite; }

  /* Source tags */
  .source-tag {
    font-size: 10px;
    font-family: 'IBM Plex Mono', monospace;
    padding: 3px 8px;
    border-radius: 5px;
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    background: rgba(0, 245, 212, 0.04);
    letter-spacing: 0.04em;
  }

  /* Avatar */
  .avatar-ai {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, rgba(0,245,212,0.15), rgba(139,92,246,0.15));
    border: 1px solid var(--border-mid);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Rajdhani', sans-serif;
    font-size: 11px;
    font-weight: 700;
    color: var(--cyan);
    letter-spacing: 0.05em;
    flex-shrink: 0;
    box-shadow: 0 0 12px rgba(0,245,212,0.1);
  }
  .avatar-user {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, rgba(255,159,28,0.3), rgba(255,80,50,0.2));
    border: 1px solid rgba(255,159,28,0.4);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Rajdhani', sans-serif;
    font-size: 11px;
    font-weight: 700;
    color: var(--amber);
    flex-shrink: 0;
  }

  /* Section divider in sidebar */
  .sidebar-divider {
    height: 1px;
    background: linear-gradient(to right, transparent, var(--border-mid), transparent);
    margin: 12px 0;
  }
`;



const mdComponents = {
  h2: ({ children }) => <h2>{children}</h2>,
  h3: ({ children }) => <h3>{children}</h3>,
  p: ({ children }) => <p>{children}</p>,
  strong: ({ children }) => <strong>{children}</strong>,
  ul: ({ children }) => <ul>{children}</ul>,
  ol: ({ children }) => <ol>{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  blockquote: ({ children }) => <blockquote>{children}</blockquote>,
  table: ({ children }) => (
    <div style={{ overflowX: "auto", margin: "12px 0" }}>
      <table>{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  th: ({ children }) => <th>{children}</th>,
  td: ({ children }) => <td>{children}</td>,
  tr: ({ children }) => <tr>{children}</tr>,
  a: ({ href, children }) => {
    const safe = href && href.startsWith("http") ? href : "#";
    return (
      <a href={safe} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  hr: () => <hr />,
  code: ({ inline, children }) =>
    inline ? (
      <code>{children}</code>
    ) : (
      <pre>
        <code>{children}</code>
      </pre>
    ),
};

function ChatMessage({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        marginBottom: "22px",
        flexDirection: isUser ? "row-reverse" : "row",
      }}
    >
      {isUser ? (
        <div className="avatar-user">YOU</div>
      ) : (
        <div className="avatar-ai">CL</div>
      )}

      <div style={{ maxWidth: "78%", position: "relative" }}>
        {isUser ? (
          <div className="user-bubble" style={{ padding: "11px 16px" }}>
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                fontWeight: 300,
                lineHeight: 1.65,
                color: "rgba(255, 220, 180, 0.95)",
              }}
            >
              {msg.text}
            </p>
          </div>
        ) : (
          <div className="ai-bubble" style={{ padding: "14px 16px" }}>
            <div className="ai-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={mdComponents}
              >
                {msg.text}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingBubble({ phrase }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        marginBottom: "22px",
      }}
    >
      <div className="avatar-ai">CL</div>
      <div
        className="ai-bubble"
        style={{ padding: "14px 18px", minWidth: "160px" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginBottom: phrase ? "8px" : "0",
          }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`dot-${i + 1}`}
              style={{
                display: "inline-block",
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background:
                  i === 0
                    ? "var(--cyan)"
                    : i === 1
                      ? "var(--violet)"
                      : "var(--cyan)",
                boxShadow:
                  i === 1 ? "0 0 8px var(--violet)" : "0 0 8px var(--cyan)",
              }}
            />
          ))}
        </div>
        {phrase && (
          <p
            style={{
              fontSize: "11px",
              fontFamily: "'IBM Plex Mono', monospace",
              color: "var(--cyan)",
              opacity: 0.7,
              letterSpacing: "0.04em",
              animation: "fadeInOut 2s ease infinite",
            }}
          >
            {phrase}
          </p>
        )}
      </div>
    </div>
  );
}

const LOADING_PHRASES = [
  "Scanning medical databases...",
  "Reading research publications...",
  "Analyzing clinical trials...",
  "Checking treatment options...",
  "Gathering hospital data...",
  "Synthesizing evidence...",
  "Consulting medical literature...",
  "Almost ready with your results...",
];

const QUICK_QUERIES = [
  "Lung cancer treatments",
  "Diabetes clinical trials",
  "Parkinson's symptoms",
  "COVID-19 drugs",
];

const DATA_SOURCES = ["PubMed", "OpenAlex", "ClinicalTrials"];

export default function App() {
  const firstMessage = {
    role: "ai",
    text: "Hello! I'm **CuraLink**, your AI medical research assistant.\n\nAsk me about diseases, treatments, clinical trials, or symptoms — and I'll fetch the latest research for you.",
  };

  const [messages, setMessages] = useState([firstMessage]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [showPhrases, setShowPhrases] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  const bottomRef = useRef(null);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isLoading) {
      setShowPhrases(false);
      timeoutRef.current = setTimeout(() => {
        setShowPhrases(true);
        intervalRef.current = setInterval(() => {
          setPhraseIndex((p) => (p + 1) % LOADING_PHRASES.length);
        }, 2000);
      }, 3000);
    } else {
      clearTimeout(timeoutRef.current);
      clearInterval(intervalRef.current);
      setPhraseIndex(0);
      setShowPhrases(false);
    }
    return () => {
      clearTimeout(timeoutRef.current);
      clearInterval(intervalRef.current);
    };
  }, [isLoading]);

  async function sendMessage(query) {
    const userMessage = query.trim();
    if (!userMessage || isLoading) return;

    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setInputText("");
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMessage, session_id: sessionId }),
      });
      const data = await response.json();
      if (data.session_id) setSessionId(data.session_id);
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: data.response || "Sorry, I could not find a response.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Could not connect to the server. Please make sure the backend is running.",
        },
      ]);
    }
    setIsLoading(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  }

  return (
    <>
      <style>{GLOBAL_STYLES}</style>

      <div
        style={{
          display: "flex",
          width: "100vw",
          height: "100vh",
          background: "var(--bg-void)",
          overflow: "hidden",
          fontFamily: "'Exo 2', sans-serif",
        }}
      >
        {/* ── SIDEBAR ── */}
        <div
          className="sidebar"
          style={{
            width: "220px",
            background: "linear-gradient(180deg, #060c1e 0%, #040a18 100%)",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
          }}
        >
          {/* Logo */}
          <div
            style={{
              padding: "20px 16px 16px",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                className="logo-icon"
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "12px",
                  background:
                    "linear-gradient(135deg, rgba(0,245,212,0.2) 0%, rgba(139,92,246,0.2) 100%)",
                  border: "1px solid var(--border-mid)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  boxShadow: "0 0 20px rgba(0,245,212,0.3)",
                }}
              >
                ✚
              </div>
              <div>
                <p
                  style={{
                    fontFamily: "'Rajdhani', sans-serif",
                    fontWeight: 700,
                    fontSize: "15px",
                    color: "var(--cyan)",
                    letterSpacing: "0.05em",
                    textShadow: "0 0 12px rgba(0,245,212,0.5)",
                  }}
                >
                  CuraLink
                </p>
                <p
                  style={{
                    fontSize: "10px",
                    color: "var(--text-dim)",
                    fontFamily: "'IBM Plex Mono', monospace",
                    letterSpacing: "0.06em",
                    marginTop: "1px",
                  }}
                >
                  MEDICAL AI
                </p>
              </div>
            </div>
          </div>

          {/* Quick search */}
          <div style={{ padding: "16px 12px", flex: 1, overflowY: "auto" }}>
            <p
              style={{
                fontSize: "9px",
                fontFamily: "'IBM Plex Mono', monospace",
                color: "var(--text-dim)",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                marginBottom: "10px",
                paddingLeft: "4px",
              }}
            >
              Quick Search
            </p>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "3px" }}
            >
              {QUICK_QUERIES.map((q, i) => (
                <button
                  key={i}
                  className="quick-btn"
                  onClick={() => sendMessage(q)}
                >
                  <span className="quick-btn-arrow">›</span>
                  {q}
                </button>
              ))}
            </div>

            <div className="sidebar-divider" style={{ marginTop: "20px" }} />

            {/* Stats decoration */}
            <div style={{ padding: "4px" }}>
              {[
                { label: "Publications", val: "32M+", color: "var(--cyan)" },
                {
                  label: "Active Trials",
                  val: "480K+",
                  color: "var(--violet)",
                },
                { label: "Updated", val: "Live", color: "var(--green-neo)" },
              ].map(({ label, val, color }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "10px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      color: "var(--text-muted)",
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      fontFamily: "'Rajdhani', sans-serif",
                      fontWeight: 700,
                      color,
                      textShadow: `0 0 8px ${color}`,
                    }}
                  >
                    {val}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Data sources */}
          <div
            style={{
              padding: "14px 16px",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            <p
              style={{
                fontSize: "9px",
                fontFamily: "'IBM Plex Mono', monospace",
                color: "var(--text-dim)",
                letterSpacing: "0.12em",
                marginBottom: "8px",
              }}
            >
              DATA SOURCES
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {DATA_SOURCES.map((s) => (
                <span key={s} className="source-tag">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── MAIN PANEL ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 24px",
              background: "rgba(4, 10, 24, 0.95)",
              borderBottom: "1px solid var(--border-subtle)",
              backdropFilter: "blur(12px)",
              flexShrink: 0,
            }}
          >
            <div>
              <h1
                style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  fontWeight: 700,
                  fontSize: "14px",
                  color: "var(--text-primary)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                Medical Research Terminal
              </h1>
              <p
                style={{
                  fontSize: "10px",
                  color: "var(--text-dim)",
                  fontFamily: "'IBM Plex Mono', monospace",
                  marginTop: "2px",
                  letterSpacing: "0.04em",
                }}
              >
                Research-backed answers · Evidence synthesis · Clinical trials
              </p>
            </div>

            <div className="online-badge">
              <span className="online-dot" />
              <span
                style={{
                  fontSize: "10px",
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: "var(--green-neo)",
                  letterSpacing: "0.06em",
                }}
              >
                ONLINE
              </span>
            </div>
          </div>

          {/* Messages */}
          <div
            className="chat-bg"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "24px 28px",
              position: "relative",
            }}
          >
            {messages.map((msg, i) => (
              <ChatMessage key={i} msg={msg} />
            ))}
            {isLoading && (
              <LoadingBubble
                phrase={showPhrases ? LOADING_PHRASES[phraseIndex] : ""}
              />
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: "16px 24px 18px",
              borderTop: "1px solid var(--border-subtle)",
              background: "rgba(4, 10, 24, 0.98)",
              flexShrink: 0,
            }}
          >
            <div className="input-wrapper">
              <textarea
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about a disease, treatment, or clinical trial..."
                className="chat-input"
              />
              <button
                onClick={() => sendMessage(inputText)}
                disabled={isLoading}
                className="send-btn"
              >
                {isLoading ? (
                  <span
                    style={{
                      width: "14px",
                      height: "14px",
                      border: "2px solid rgba(2,8,23,0.4)",
                      borderTopColor: "var(--bg-void)",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin 0.7s linear infinite",
                    }}
                  />
                ) : (
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="#020817"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                )}
              </button>
            </div>
            <p
              style={{
                textAlign: "center",
                fontSize: "10px",
                fontFamily: "'IBM Plex Mono', monospace",
                color: "var(--text-dim)",
                marginTop: "10px",
                letterSpacing: "0.04em",
              }}
            >
              Not medical advice · Always consult a qualified healthcare
              professional
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInOut { 0%,100%{opacity:0.5} 50%{opacity:1} }
      `}</style>
    </>
  );
}
