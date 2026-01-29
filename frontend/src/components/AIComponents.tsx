import React, { useState, useEffect, useRef } from "react";

interface AIScoreBadgeProps {
  score: number | null;
  size?: "small" | "medium" | "large";
}

export const AIScoreBadge: React.FC<AIScoreBadgeProps> = ({ score, size = "medium" }) => {
  if (score === null || score === undefined) return null;

  const getScoreColor = (s: number) => {
    if (s >= 80) return "#10b981"; // green
    if (s >= 60) return "#3b82f6"; // blue
    if (s >= 40) return "#f59e0b"; // yellow
    return "#ef4444"; // red
  };

  const getScoreLabel = (s: number) => {
    if (s >= 80) return "Excellent";
    if (s >= 60) return "Good";
    if (s >= 40) return "Fair";
    return "Below Average";
  };

  const sizes = {
    small: { width: 48, fontSize: 14, labelSize: 10 },
    medium: { width: 64, fontSize: 18, labelSize: 11 },
    large: { width: 80, fontSize: 24, labelSize: 13 }
  };

  const { width, fontSize, labelSize } = sizes[size];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
      <div
        style={{
          width,
          height: width,
          borderRadius: "50%",
          background: `conic-gradient(${getScoreColor(score)} ${score * 3.6}deg, rgba(100, 116, 139, 0.3) 0deg)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative"
        }}
      >
        <div
          style={{
            width: width - 8,
            height: width - 8,
            borderRadius: "50%",
            background: "rgba(15, 23, 42, 0.95)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column"
          }}
        >
          <span style={{ fontSize, fontWeight: "700", color: getScoreColor(score) }}>
            {score}
          </span>
        </div>
      </div>
      <span style={{ fontSize: labelSize, color: getScoreColor(score), fontWeight: "600" }}>
        {getScoreLabel(score)}
      </span>
    </div>
  );
};

interface TypewriterTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

export const TypewriterText: React.FC<TypewriterTextProps> = ({ text, speed = 20, onComplete }) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!text) return;
    
    setDisplayedText("");
    setIsComplete(false);
    let index = 0;

    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
        setIsComplete(true);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <span>
      {displayedText}
      {!isComplete && <span className="typing-cursor">|</span>}
    </span>
  );
};

interface AIInsightsPanelProps {
  propertyId: string;
  onLoad?: (insights: any) => void;
}

export const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({ propertyId, onLoad }) => {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:5000/ai/score/${propertyId}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch");
      }
      const data = await res.json();
      if (data.score || data.summary) {
        setInsights(data);
        onLoad?.(data);
      } else {
        throw new Error("Invalid AI response");
      }
    } catch (err: any) {
      console.error("AI Insights error:", err);
      setError(err.message || "Unable to load AI insights");
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [propertyId]);

  const handleRetry = () => {
    setRetrying(true);
    fetchInsights();
  };

  if (loading) {
    return (
      <div style={{
        background: "linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)",
        border: "1px solid rgba(102, 126, 234, 0.2)",
        borderRadius: "12px",
        padding: "32px 20px",
        textAlign: "center"
      }}>
        <div className="ai-loading-spinner" style={{ margin: "0 auto 16px" }} />
        <p style={{ color: "#a5b4fc", margin: "0 0 8px 0", fontWeight: "600" }}>🤖 AI Analyzing Property...</p>
        <p style={{ color: "#64748b", margin: 0, fontSize: "13px" }}>This may take a few seconds</p>
      </div>
    );
  }

  if (error || !insights) {
    return (
      <div style={{
        background: "linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)",
        border: "1px solid rgba(102, 126, 234, 0.2)",
        borderRadius: "12px",
        padding: "24px 20px",
        textAlign: "center"
      }}>
        <p style={{ fontSize: "32px", margin: "0 0 12px 0" }}>🤖</p>
        <p style={{ color: "#f1f5f9", margin: "0 0 8px 0", fontWeight: "600" }}>AI Analysis Unavailable</p>
        <p style={{ color: "#94a3b8", margin: "0 0 16px 0", fontSize: "13px" }}>
          {error || "Could not generate insights for this property"}
        </p>
        <button
          onClick={handleRetry}
          disabled={retrying}
          style={{
            padding: "10px 24px",
            background: retrying ? "rgba(102, 126, 234, 0.3)" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: retrying ? "not-allowed" : "pointer",
            fontWeight: "600",
            fontSize: "14px"
          }}
        >
          {retrying ? "Retrying..." : "🔄 Try Again"}
        </button>
      </div>
    );
  }

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)",
      border: "1px solid rgba(102, 126, 234, 0.2)",
      borderRadius: "16px",
      overflow: "hidden"
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid rgba(102, 126, 234, 0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "20px" }}>🤖</span>
          <span style={{ color: "#f1f5f9", fontWeight: "600" }}>AI Property Analysis</span>
          {insights.cached && (
            <span style={{
              fontSize: "10px",
              background: "rgba(148, 163, 184, 0.2)",
              color: "#94a3b8",
              padding: "2px 6px",
              borderRadius: "4px"
            }}>
              Cached
            </span>
          )}
        </div>
        <AIScoreBadge score={insights.score} size="medium" />
      </div>

      {/* Summary */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(102, 126, 234, 0.1)" }}>
        <p style={{ color: "#cbd5e1", margin: 0, lineHeight: "1.6", fontSize: "14px" }}>
          <TypewriterText text={insights.summary || "Analysis complete."} speed={15} />
        </p>
      </div>

      {/* Quick Stats */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "1px",
        background: "rgba(102, 126, 234, 0.1)"
      }}>
        <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "14px 16px" }}>
          <p style={{ color: "#64748b", fontSize: "11px", margin: "0 0 4px 0" }}>PRICE RATING</p>
          <p style={{
            color: insights.priceRating === "EXCELLENT" ? "#10b981" :
                   insights.priceRating === "GOOD" ? "#3b82f6" :
                   insights.priceRating === "FAIR" ? "#f59e0b" : "#ef4444",
            margin: 0,
            fontWeight: "600",
            fontSize: "15px"
          }}>
            {insights.priceRating || "N/A"}
          </p>
        </div>
        <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "14px 16px" }}>
          <p style={{ color: "#64748b", fontSize: "11px", margin: "0 0 4px 0" }}>LOCATION</p>
          <p style={{
            color: insights.locationQuality === "PRIME" ? "#10b981" :
                   insights.locationQuality === "GOOD" ? "#3b82f6" :
                   insights.locationQuality === "AVERAGE" ? "#f59e0b" : "#94a3b8",
            margin: 0,
            fontWeight: "600",
            fontSize: "15px"
          }}>
            {insights.locationQuality || "N/A"}
          </p>
        </div>
      </div>

      {/* Highlights & Concerns */}
      {(insights.highlights?.length > 0 || insights.concerns?.length > 0) && (
        <div style={{ padding: "16px 20px" }}>
          {insights.highlights?.length > 0 && (
            <div style={{ marginBottom: "12px" }}>
              <p style={{ color: "#64748b", fontSize: "11px", margin: "0 0 8px 0" }}>HIGHLIGHTS</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {insights.highlights.map((h: string, i: number) => (
                  <span key={i} style={{
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "#34d399",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "12px"
                  }}>
                    ✓ {h}
                  </span>
                ))}
              </div>
            </div>
          )}
          {insights.concerns?.length > 0 && (
            <div>
              <p style={{ color: "#64748b", fontSize: "11px", margin: "0 0 8px 0" }}>CONCERNS</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {insights.concerns.map((c: string, i: number) => (
                  <span key={i} style={{
                    background: "rgba(245, 158, 11, 0.15)",
                    color: "#fbbf24",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "12px"
                  }}>
                    ⚠ {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface FraudRiskBadgeProps {
  propertyId: string;
}

export const FraudRiskBadge: React.FC<FraudRiskBadgeProps> = ({ propertyId }) => {
  const [risk, setRisk] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRisk = async () => {
      try {
        const res = await fetch(`http://localhost:5000/ai/fraud-check/${propertyId}`);
        if (res.ok) {
          const data = await res.json();
          setRisk(data);
        }
      } catch (err) {
        console.error("Fraud check error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRisk();
  }, [propertyId]);

  if (loading || !risk) return null;

  const colors = {
    LOW: { bg: "rgba(16, 185, 129, 0.15)", color: "#34d399", icon: "✓" },
    MEDIUM: { bg: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", icon: "⚠" },
    HIGH: { bg: "rgba(239, 68, 68, 0.15)", color: "#f87171", icon: "🚨" }
  };

  const style = colors[risk.riskLevel as keyof typeof colors] || colors.MEDIUM;

  return (
    <div style={{
      background: style.bg,
      color: style.color,
      padding: "8px 12px",
      borderRadius: "8px",
      fontSize: "13px",
      display: "flex",
      alignItems: "center",
      gap: "6px"
    }}>
      <span>{style.icon}</span>
      <span>Fraud Risk: {risk.riskLevel}</span>
      {risk.verified && <span style={{ color: "#10b981" }}>✓ Verified</span>}
    </div>
  );
};

interface AIChatBoxProps {
  propertyId: string;
  propertyTitle: string;
}

// Helper function to format AI response text
const formatAIResponse = (text: string): React.ReactNode => {
  if (!text) return text;
  
  // Remove <think>...</think> tags
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  
  // Split into paragraphs
  const paragraphs = cleaned.split(/\n\n+/);
  
  return paragraphs.map((para, idx) => {
    // Handle bullet points
    if (para.includes("- ") || para.includes("• ")) {
      const lines = para.split("\n").filter(l => l.trim());
      return (
        <div key={idx} style={{ marginBottom: "12px" }}>
          {lines.map((line, i) => {
            const isBullet = line.trim().startsWith("-") || line.trim().startsWith("•");
            const content = line.replace(/^[-•]\s*/, "").trim();
            
            // Handle bold text **text**
            const formattedContent = content.split(/\*\*(.*?)\*\*/g).map((part, j) => 
              j % 2 === 1 ? <strong key={j} style={{ color: "#a5b4fc" }}>{part}</strong> : part
            );
            
            return (
              <div key={i} style={{ 
                paddingLeft: isBullet ? "16px" : "0",
                marginBottom: "6px",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px"
              }}>
                {isBullet && <span style={{ color: "#667eea" }}>•</span>}
                <span>{formattedContent}</span>
              </div>
            );
          })}
        </div>
      );
    }
    
    // Handle numbered lists
    if (/^\d+\./.test(para.trim())) {
      const lines = para.split("\n").filter(l => l.trim());
      return (
        <div key={idx} style={{ marginBottom: "12px" }}>
          {lines.map((line, i) => {
            const match = line.match(/^(\d+)\.\s*(.*)/);
            if (match) {
              const content = match[2].split(/\*\*(.*?)\*\*/g).map((part, j) => 
                j % 2 === 1 ? <strong key={j} style={{ color: "#a5b4fc" }}>{part}</strong> : part
              );
              return (
                <div key={i} style={{ 
                  marginBottom: "8px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px"
                }}>
                  <span style={{ color: "#667eea", fontWeight: "600", minWidth: "20px" }}>{match[1]}.</span>
                  <span>{content}</span>
                </div>
              );
            }
            return <div key={i}>{line}</div>;
          })}
        </div>
      );
    }
    
    // Handle headers with emoji
    if (para.startsWith("**") && para.includes("**:")) {
      const headerMatch = para.match(/\*\*(.*?)\*\*:\s*(.*)/s);
      if (headerMatch) {
        return (
          <div key={idx} style={{ marginBottom: "12px" }}>
            <div style={{ 
              color: "#a5b4fc", 
              fontWeight: "600", 
              marginBottom: "6px",
              fontSize: "15px"
            }}>
              {headerMatch[1]}
            </div>
            <div>{headerMatch[2]}</div>
          </div>
        );
      }
    }
    
    // Regular paragraph with bold handling
    const formattedPara = para.split(/\*\*(.*?)\*\*/g).map((part, j) => 
      j % 2 === 1 ? <strong key={j} style={{ color: "#a5b4fc" }}>{part}</strong> : part
    );
    
    return <p key={idx} style={{ marginBottom: "12px" }}>{formattedPara}</p>;
  });
};

export const AIChatBox: React.FC<AIChatBoxProps> = ({ propertyId }) => {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`http://localhost:5000/ai/chat/${propertyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: input,
          chatHistory: messages
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't process your question." }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(45, 55, 72, 0.9) 100%)",
      border: "1px solid rgba(102, 126, 234, 0.2)",
      borderRadius: "16px",
      overflow: "hidden"
    }}>
      <div style={{
        padding: "14px 20px",
        borderBottom: "1px solid rgba(102, 126, 234, 0.15)",
        display: "flex",
        alignItems: "center",
        gap: "10px"
      }}>
        <span style={{ fontSize: "18px" }}>💬</span>
        <span style={{ color: "#f1f5f9", fontWeight: "600", fontSize: "15px" }}>Ask AI about this property</span>
      </div>

      {/* Messages */}
      <div style={{
        height: "280px",
        overflowY: "auto",
        padding: "16px"
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <p style={{ fontSize: "32px", marginBottom: "12px" }}>🤖</p>
            <p style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "8px" }}>
              Ask anything about this property
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
              {["Is this a good deal?", "What's nearby?", "Is the price fair?"].map((q, i) => (
                <button
                  key={i}
                  onClick={() => setInput(q)}
                  style={{
                    padding: "6px 12px",
                    background: "rgba(102, 126, 234, 0.15)",
                    border: "1px solid rgba(102, 126, 234, 0.3)",
                    borderRadius: "16px",
                    color: "#a5b4fc",
                    fontSize: "12px",
                    cursor: "pointer"
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              marginBottom: "16px",
              textAlign: msg.role === "user" ? "right" : "left"
            }}
          >
            {msg.role === "assistant" && (
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "6px", 
                marginBottom: "6px" 
              }}>
                <span style={{ fontSize: "14px" }}>🤖</span>
                <span style={{ color: "#94a3b8", fontSize: "11px" }}>AI Assistant</span>
              </div>
            )}
            <div style={{
              display: "inline-block",
              maxWidth: msg.role === "user" ? "80%" : "95%",
              padding: msg.role === "user" ? "10px 14px" : "14px 16px",
              borderRadius: msg.role === "user" ? "12px" : "12px",
              background: msg.role === "user"
                ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                : "rgba(15, 23, 42, 0.8)",
              border: msg.role === "user" ? "none" : "1px solid rgba(102, 126, 234, 0.15)",
              color: "#f1f5f9",
              fontSize: "14px",
              lineHeight: "1.6",
              textAlign: "left"
            }}>
              {msg.role === "user" ? msg.content : formatAIResponse(msg.content)}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ textAlign: "left" }}>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "6px", 
              marginBottom: "6px" 
            }}>
              <span style={{ fontSize: "14px" }}>🤖</span>
              <span style={{ color: "#94a3b8", fontSize: "11px" }}>AI Assistant</span>
            </div>
            <div style={{
              display: "inline-block",
              padding: "14px 16px",
              borderRadius: "12px",
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(102, 126, 234, 0.15)",
              color: "#a5b4fc"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div className="ai-loading-spinner" style={{ width: "16px", height: "16px", borderWidth: "2px" }} />
                <span>Analyzing...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "12px 16px",
        borderTop: "1px solid rgba(102, 126, 234, 0.15)",
        display: "flex",
        gap: "10px"
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Is this a good deal? What's nearby?"
          disabled={loading}
          style={{
            flex: 1,
            padding: "10px 14px",
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(102, 126, 234, 0.2)",
            borderRadius: "8px",
            color: "#f1f5f9",
            fontSize: "14px",
            outline: "none"
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            padding: "10px 20px",
            background: loading || !input.trim()
              ? "rgba(102, 126, 234, 0.3)"
              : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            fontWeight: "600",
            fontSize: "14px"
          }}
        >
          {loading ? "..." : "Ask"}
        </button>
      </div>
    </div>
  );
};

// CSS for animations (add to App.css or use styled-components)
export const AIComponentStyles = `
  .typing-cursor {
    animation: blink 0.8s infinite;
    color: #a5b4fc;
  }
  
  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }
  
  .ai-loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(102, 126, 234, 0.2);
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .typing-dots::after {
    content: '';
    animation: dots 1.5s infinite;
  }
  
  @keyframes dots {
    0%, 20% { content: '.'; }
    40% { content: '..'; }
    60%, 100% { content: '...'; }
  }
`;
