import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { auth } from "../services/firebase";
import { API } from "../services/api";
import "../App.css";

interface Message {
  _id: string;
  sender: {
    _id: string;
    name: string;
    email: string;
  };
  receiver: {
    _id: string;
    name: string;
    email: string;
  };
  property: {
    _id: string;
    title: string;
    location: string;
    price: number;
  };
  message: string;
  read: boolean;
  createdAt: string;
}

interface ChatThread {
  user: {
    _id: string;
    name: string;
    email: string;
  };
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messageCount: number;
}

const Chat: React.FC = () => {
  const { propertyId } = useParams<{ propertyId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherUserEmail, setOtherUserEmail] = useState("");
  const [propertyInfo, setPropertyInfo] = useState<any>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUserEmail = auth.currentUser?.email || "";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!auth.currentUser) {
      navigate("/login");
      return;
    }
    
    // Check if there's a user param in URL (for direct chat)
    const userParam = searchParams.get("user") || searchParams.get("with");
    if (userParam) {
      setSelectedThread(userParam);
      setOtherUserEmail(userParam);
    }
    
    loadPropertyAndMessages();
  }, [propertyId, searchParams]);

  // Set up polling when we have a selected conversation
  useEffect(() => {
    if (selectedThread && otherUserEmail) {
      const interval = setInterval(() => loadMessagesForThread(otherUserEmail), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedThread, otherUserEmail]);

  const loadPropertyAndMessages = async () => {
    try {
      // Load property details
      const propRes = await fetch(`${API}/properties/${propertyId}`);
      if (!propRes.ok) {
        throw new Error(`Failed to load property: ${propRes.status}`);
      }
      const propData = await propRes.json();
      setPropertyInfo(propData);
      
      const ownerCheck = propData.owner?.email === currentUserEmail;
      setIsOwner(ownerCheck);
      
      if (ownerCheck) {
        // Owner: Load all conversation threads
        await loadThreads();
        
        // If user param exists, load that specific thread
        const userParam = searchParams.get("user");
        if (userParam) {
          setSelectedThread(userParam);
          setOtherUserEmail(userParam);
          await loadMessagesForThread(userParam);
        }
      } else {
        // Non-owner: Always chat with property owner
        const ownerEmail = propData.owner?.email || "";
        setOtherUserEmail(ownerEmail);
        setSelectedThread(ownerEmail);
        await loadMessagesForThread(ownerEmail);
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Failed to load property:", error);
      setLoading(false);
    }
  };

  const loadThreads = async () => {
    try {
      const res = await fetch(`${API}/chat/threads/${propertyId}?ownerEmail=${encodeURIComponent(currentUserEmail)}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setThreads(data);
      }
    } catch (error) {
      console.error("Failed to load threads:", error);
    }
  };

  const loadMessagesForThread = async (otherEmail: string) => {
    try {
      const response = await fetch(
        `${API}/chat/property/${propertyId}?userEmail=${encodeURIComponent(currentUserEmail)}&otherUserEmail=${encodeURIComponent(otherEmail)}`
      );
      const data = await response.json();
      if (Array.isArray(data)) {
        setMessages(data);
      }
      // Mark as read
      markAsRead();
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  const selectThread = (userEmail: string) => {
    setSelectedThread(userEmail);
    setOtherUserEmail(userEmail);
    setSearchParams({ user: userEmail });
    loadMessagesForThread(userEmail);
  };

  const markAsRead = async () => {
    try {
      await fetch(`${API}/chat/read/${propertyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: currentUserEmail })
      });
    } catch (error) {
      console.error("Failed to mark messages as read:", error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !otherUserEmail) {
      alert("No one to chat with yet");
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          senderEmail: currentUserEmail,
          receiverEmail: otherUserEmail,
          message: newMessage.trim()
        })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to send message");
      }
      
      setNewMessage("");
      await loadMessagesForThread(otherUserEmail);
      if (isOwner) {
        await loadThreads(); // Refresh threads list
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      alert(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        Loading chat...
      </div>
    );
  }

  // If no property loaded
  if (!propertyInfo) {
    return (
      <div className="page">
        <div style={{ 
          maxWidth: "600px",
          margin: "60px auto",
          padding: "40px",
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(45, 55, 72, 0.8) 100%)",
          border: "1px solid rgba(102, 126, 234, 0.2)",
          borderRadius: "16px",
          textAlign: "center",
          backdropFilter: "blur(8px)"
        }}>
          <h2 style={{ color: "#cbd5e1", marginBottom: "16px" }}>🔍 Property Not Found</h2>
          <p style={{ color: "#94a3b8", marginBottom: "28px", lineHeight: "1.6" }}>
            The property you're trying to chat about could not be found.
          </p>
          <button 
            onClick={() => navigate(-1)} 
            style={{ 
              padding: "12px 28px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600"
            }}
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  // Owner view with thread list
  if (isOwner && threads.length === 0 && !selectedThread) {
    return (
      <div className="page">
        <div style={{ 
          maxWidth: "600px",
          margin: "60px auto",
          padding: "40px",
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(45, 55, 72, 0.8) 100%)",
          border: "1px solid rgba(102, 126, 234, 0.2)",
          borderRadius: "16px",
          textAlign: "center",
          backdropFilter: "blur(8px)"
        }}>
          <h2 style={{ color: "#cbd5e1", marginBottom: "16px" }}>💬 No Messages Yet</h2>
          <p style={{ color: "#94a3b8", marginBottom: "28px", lineHeight: "1.6" }}>
            No one has messaged you about this property yet.
          </p>
          <button 
            onClick={() => navigate(-1)} 
            style={{ 
              padding: "12px 28px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600"
            }}
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  // Non-owner with no owner to chat
  if (!isOwner && !otherUserEmail) {
    return (
      <div className="page">
        <div style={{ 
          maxWidth: "600px",
          margin: "60px auto",
          padding: "40px",
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(45, 55, 72, 0.8) 100%)",
          border: "1px solid rgba(102, 126, 234, 0.2)",
          borderRadius: "16px",
          textAlign: "center"
        }}>
          <h2 style={{ color: "#cbd5e1", marginBottom: "16px" }}>⚠️ Owner Not Found</h2>
          <p style={{ color: "#94a3b8", marginBottom: "28px" }}>
            Unable to find the property owner to chat with.
          </p>
          <button onClick={() => navigate(-1)} style={{ 
            padding: "12px 28px",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "600"
          }}>
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ padding: "0" }}>
      <div style={{ 
        maxWidth: "1000px",
        margin: "20px auto",
        height: "calc(100vh - 140px)",
        display: "flex",
        background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(45, 55, 72, 0.8) 100%)",
        border: "1px solid rgba(102, 126, 234, 0.2)",
        borderRadius: "16px",
        overflow: "hidden"
      }}>
        
        {/* Thread List Sidebar (Owner only) */}
        {isOwner && threads.length > 0 && (
          <div style={{
            width: "280px",
            borderRight: "1px solid rgba(102, 126, 234, 0.2)",
            display: "flex",
            flexDirection: "column",
            background: "rgba(15, 23, 42, 0.5)"
          }}>
            <div style={{
              padding: "16px",
              borderBottom: "1px solid rgba(102, 126, 234, 0.2)",
              background: "rgba(20, 30, 48, 0.8)"
            }}>
              <h3 style={{ margin: 0, color: "#f1f5f9", fontSize: "16px" }}>
                💬 Conversations ({threads.length})
              </h3>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {threads.map((thread) => (
                <div
                  key={thread.user.email}
                  onClick={() => selectThread(thread.user.email)}
                  style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid rgba(102, 126, 234, 0.1)",
                    cursor: "pointer",
                    background: selectedThread === thread.user.email 
                      ? "rgba(102, 126, 234, 0.2)" 
                      : "transparent",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    if (selectedThread !== thread.user.email) {
                      (e.currentTarget as HTMLDivElement).style.background = "rgba(102, 126, 234, 0.1)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedThread !== thread.user.email) {
                      (e.currentTarget as HTMLDivElement).style.background = "transparent";
                    }
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ 
                          color: "#f1f5f9", 
                          fontWeight: "600", 
                          fontSize: "14px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}>
                          {thread.user.name || thread.user.email.split("@")[0]}
                        </span>
                        {thread.unreadCount > 0 && (
                          <span style={{
                            background: "#ef4444",
                            color: "white",
                            fontSize: "10px",
                            padding: "2px 6px",
                            borderRadius: "10px",
                            fontWeight: "700"
                          }}>
                            {thread.unreadCount}
                          </span>
                        )}
                      </div>
                      <p style={{ 
                        margin: 0, 
                        color: "#94a3b8", 
                        fontSize: "12px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}>
                        {thread.lastMessage}
                      </p>
                    </div>
                  </div>
                  <small style={{ color: "#64748b", fontSize: "10px" }}>
                    {new Date(thread.lastMessageTime).toLocaleDateString()}
                  </small>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Chat Header */}
          <div style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(102, 126, 234, 0.2)",
            background: "linear-gradient(135deg, rgba(20, 30, 48, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", color: "#f1f5f9", fontSize: "16px" }}>
                  {propertyInfo?.title}
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8" }}>
                  {isOwner ? (
                    selectedThread ? `Chatting with: ${selectedThread}` : "Select a conversation"
                  ) : (
                    `Chatting with owner: ${otherUserEmail}`
                  )}
                </p>
              </div>
              <button 
                onClick={() => navigate(-1)} 
                style={{ 
                  padding: "8px 16px",
                  background: "rgba(102, 126, 234, 0.2)",
                  color: "#667eea",
                  border: "1px solid rgba(102, 126, 234, 0.3)",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "600"
                }}
              >
                ← Back
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
            {!selectedThread && isOwner ? (
              <div style={{ 
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#94a3b8",
                textAlign: "center"
              }}>
                <div>
                  <p style={{ fontSize: "18px", marginBottom: "8px" }}>👈 Select a conversation</p>
                  <p style={{ fontSize: "14px", color: "#64748b" }}>Choose a user from the left to view messages</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div style={{ 
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#94a3b8",
                textAlign: "center"
              }}>
                <div>
                  <p style={{ fontSize: "18px", marginBottom: "8px" }}>💬 No messages yet</p>
                  <p style={{ fontSize: "14px", color: "#64748b" }}>Start a conversation!</p>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg._id}
                  style={{
                    display: "flex",
                    justifyContent: msg.sender.email === currentUserEmail ? "flex-end" : "flex-start"
                  }}
                >
                  <div
                    style={{
                      maxWidth: "70%",
                      padding: "12px 16px",
                      borderRadius: "12px",
                      background: msg.sender.email === currentUserEmail 
                        ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                        : "rgba(71, 85, 105, 0.5)",
                      color: msg.sender.email === currentUserEmail ? "#f1f5f9" : "#cbd5e1",
                      border: msg.sender.email === currentUserEmail 
                        ? "1px solid rgba(102, 126, 234, 0.4)"
                        : "1px solid rgba(71, 85, 105, 0.4)",
                      wordWrap: "break-word"
                    }}
                  >
                    {/* Show sender name for received messages */}
                    {msg.sender.email !== currentUserEmail && (
                      <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "#a5b4fc", fontWeight: "600" }}>
                        {msg.sender.name || msg.sender.email}
                      </p>
                    )}
                    <p style={{ margin: "0 0 6px 0", lineHeight: "1.4" }}>{msg.message}</p>
                    <small style={{ 
                      fontSize: "11px", 
                      opacity: 0.7,
                      color: msg.sender.email === currentUserEmail ? "#f1f5f9" : "#94a3b8"
                    }}>
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </small>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          {(selectedThread || !isOwner) && (
            <form 
              onSubmit={sendMessage}
              style={{
                padding: "16px 20px",
                borderTop: "1px solid rgba(102, 126, 234, 0.2)",
                background: "linear-gradient(135deg, rgba(20, 30, 48, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)",
                display: "flex",
                gap: "12px"
              }}
            >
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(102, 126, 234, 0.3)",
                  borderRadius: "8px",
                  color: "#f1f5f9",
                  outline: "none",
                  fontSize: "14px"
                }}
                disabled={sending || !otherUserEmail}
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim() || !otherUserEmail}
                style={{
                  padding: "12px 28px",
                  background: sending || !newMessage.trim() 
                    ? "rgba(102, 126, 234, 0.3)"
                    : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "#f1f5f9",
                  border: "1px solid rgba(102, 126, 234, 0.3)",
                  borderRadius: "8px",
                  cursor: sending || !newMessage.trim() ? "not-allowed" : "pointer",
                  fontWeight: "600"
                }}
              >
                {sending ? "..." : "Send"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
