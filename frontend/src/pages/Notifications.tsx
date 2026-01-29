import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { API } from "../services/api";
import { auth } from "../services/firebase";

const Notifications = () => {
  const navigate = useNavigate();
  const [ownerNotes, setOwnerNotes] = useState<any[]>([]);
  const [userNotes, setUserNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    try {
      if (!auth.currentUser?.email) {
        setLoading(false);
        return;
      }

      // 🔍 Get Mongo user
      const userRes = await fetch(
        `${API}/users/email/${auth.currentUser.email}`
      );
      const mongoUser = await userRes.json();

      if (!mongoUser?._id) {
        setLoading(false);
        return;
      }

      // 📩 Load owner inbox (requests from users)
      const ownerRes = await fetch(
        `${API}/notifications/owner/${mongoUser._id}`
      );
      const ownerData = await ownerRes.json();
      setOwnerNotes(Array.isArray(ownerData) ? ownerData : []);

      // 📩 Load user notifications (acceptances from owners)
      const userNotifRes = await fetch(
        `${API}/notifications/user/${auth.currentUser.email}`
      );
      const userData = await userNotifRes.json();
      setUserNotes(Array.isArray(userData) ? userData : []);
    } catch (err) {
      console.error("Notification load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  /* ================= ACCEPT REQUEST ================= */

  const acceptRequest = async (propertyId: string) => {
    try {
      const res = await fetch(`${API}/properties/${propertyId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Approve failed");
      }

      alert("Deal accepted!");
      
      // Fetch fresh data
      await loadNotifications();
    } catch (err) {
      console.error("Accept error:", err);
      alert("Failed to accept deal");
    }
  };

  /* ================= DELETE NOTIFICATION ================= */

  const deleteNotification = async (notificationId: string) => {
    if (!window.confirm("Are you sure you want to delete this notification?")) return;

    try {
      const res = await fetch(`${API}/notifications/${notificationId}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Delete failed");
      }

      // Refresh notifications
      await loadNotifications();
    } catch (err) {
      console.error("Delete notification error:", err);
      alert("Failed to delete notification");
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
        <p style={{ color: "#94a3b8" }}>Loading notifications...</p>
      </div>
    );
  }

  // Separate notifications by type (filter out notifications with deleted properties)
  const acceptanceNotes = userNotes.filter(n => n.action === "ACCEPTED" && n.property);
  const messageNotes = userNotes.filter(n => n.action === "MESSAGE" && n.property);
  const requestNotes = ownerNotes.filter(n => n.action !== "ACCEPTED" && n.action !== "MESSAGE" && n.property);

  const totalNotes = acceptanceNotes.length + messageNotes.length + requestNotes.length;

  return (
    <div className="page">
      {/* Page Header */}
      <div style={{
        marginBottom: "48px",
        paddingBottom: "32px",
        borderBottom: "1px solid rgba(226, 232, 240, 0.1)"
      }}>
        <h1 style={{
          fontSize: "40px",
          marginBottom: "8px"
        }}>
          🔔 Notifications
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "16px" }}>
          {totalNotes === 0 ? "No notifications yet" : `${totalNotes} notification${totalNotes === 1 ? "" : "s"}`}
        </p>
      </div>

      {totalNotes === 0 && (
        <div style={{
          textAlign: "center",
          padding: "60px 40px",
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(45, 55, 72, 0.8) 100%)",
          border: "1px solid rgba(226, 232, 240, 0.1)",
          borderRadius: "16px"
        }}>
          <p style={{ color: "#94a3b8", fontSize: "18px" }}>📭 No notifications yet</p>
          <p style={{ color: "#64748b", fontSize: "14px" }}>Check back soon for updates on your properties and requests</p>
        </div>
      )}

      {/* MESSAGE NOTIFICATIONS */}
      {messageNotes.length > 0 && (
        <div style={{ marginBottom: "48px" }}>
          <h2 style={{ 
            fontSize: "22px",
            marginBottom: "20px",
            color: "#60a5fa",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            💬 New Messages ({messageNotes.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {messageNotes.map(note => (
              <div key={note._id} style={{
                padding: "20px",
                background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(45, 55, 72, 0.8) 100%)",
                border: "2px solid rgba(96, 165, 250, 0.3)",
                borderLeft: "4px solid #60a5fa",
                borderRadius: "12px",
                transition: "all 0.3s ease"
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = "linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(45, 55, 72, 0.95) 100%)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(96, 165, 250, 0.2)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = "linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(45, 55, 72, 0.8) 100%)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
              }}
              >
                <div style={{ marginBottom: "12px" }}>
                  <p style={{ margin: "0 0 4px 0", color: "#f1f5f9", fontWeight: "700" }}>
                    {note.from?.name || note.from?.email}
                  </p>
                  <p style={{ margin: "0 0 8px 0", color: "#94a3b8", fontSize: "14px" }}>
                    messaged you about a property
                  </p>
                </div>

                {note.property && (
                  <div style={{
                    padding: "12px",
                    background: "rgba(15, 23, 42, 0.6)",
                    borderLeft: "3px solid #667eea",
                    borderRadius: "6px",
                    marginBottom: "12px",
                    color: "#cbd5e1",
                    fontSize: "14px"
                  }}>
                    <b>{note.property.title}</b> — <span style={{ color: "#667eea", fontWeight: "700" }}>₹{note.property.price}</span>
                  </div>
                )}

                {note.message && (
                  <div style={{
                    padding: "12px",
                    background: "rgba(102, 126, 234, 0.1)",
                    borderRadius: "6px",
                    color: "#cbd5e1",
                    fontSize: "14px",
                    marginBottom: "12px",
                    fontStyle: "italic",
                    borderLeft: "3px solid #667eea"
                  }}>
                    "{note.message}"
                  </div>
                )}

                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: "12px",
                  borderTop: "1px solid rgba(226, 232, 240, 0.1)"
                }}>
                  <small style={{ color: "#64748b", fontSize: "12px" }}>
                    {new Date(note.createdAt).toLocaleString()}
                  </small>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Link
                      to={`/user/${note.from?.email}`}
                      style={{
                        padding: "8px 16px",
                        background: "rgba(168, 85, 247, 0.2)",
                        border: "1px solid rgba(168, 85, 247, 0.3)",
                        color: "#d8b4fe",
                        borderRadius: "6px",
                        textDecoration: "none",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                        transition: "all 0.3s ease"
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.background = "rgba(168, 85, 247, 0.3)";
                        (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(168, 85, 247, 0.5)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.background = "rgba(168, 85, 247, 0.2)";
                        (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(168, 85, 247, 0.3)";
                      }}
                    >
                      👤 Profile
                    </Link>
                    <button
                      onClick={() => {
                        // Handle both populated and non-populated property
                        let propId = null;
                        if (note.property) {
                          if (typeof note.property === 'string') {
                            propId = note.property;
                          } else if (note.property._id) {
                            propId = note.property._id;
                          }
                        }
                        
                        if (propId) {
                          navigate(`/chat/${propId}`);
                        } else {
                          alert("Property ID not available. The property may have been deleted.");
                        }
                      }}
                      style={{
                        padding: "8px 16px",
                        background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)",
                        border: "none",
                        color: "white",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                        transition: "all 0.3s ease"
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 12px rgba(96, 165, 250, 0.4)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                      }}
                    >
                      Reply
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* USER NOTIFICATIONS (Acceptances) */}
      {acceptanceNotes.length > 0 && (
        <div style={{ marginBottom: "48px" }}>
          <h2 style={{ 
            fontSize: "22px",
            marginBottom: "20px",
            color: "#4ade80",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            ✅ Accepted Requests ({acceptanceNotes.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {acceptanceNotes.map(note => (
              <div key={note._id} style={{
                padding: "20px",
                background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(45, 55, 72, 0.8) 100%)",
                border: "2px solid rgba(74, 222, 128, 0.3)",
                borderLeft: "4px solid #4ade80",
                borderRadius: "12px",
                transition: "all 0.3s ease"
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = "linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(45, 55, 72, 0.95) 100%)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(74, 222, 128, 0.2)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = "linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(45, 55, 72, 0.8) 100%)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
              }}
              >
                <div style={{ marginBottom: "12px" }}>
                  <p style={{ margin: "0 0 4px 0", color: "#f1f5f9", fontWeight: "700" }}>
                    {note.from?.name || note.from?.email}
                  </p>
                  <p style={{ margin: "0 0 8px 0", color: "#94a3b8", fontSize: "14px" }}>
                    accepted your request! 🎉
                  </p>
                </div>

                {note.property && (
                  <div style={{
                    padding: "12px",
                    background: "rgba(15, 23, 42, 0.6)",
                    borderLeft: "3px solid #667eea",
                    borderRadius: "6px",
                    marginBottom: "12px",
                    color: "#cbd5e1",
                    fontSize: "14px"
                  }}>
                    <b>{note.property.title}</b> — <span style={{ color: "#667eea", fontWeight: "700" }}>₹{note.property.price}</span>
                  </div>
                )}

                {note.message && (
                  <div style={{
                    padding: "12px",
                    background: "rgba(102, 126, 234, 0.1)",
                    borderRadius: "6px",
                    color: "#cbd5e1",
                    fontSize: "14px",
                    marginBottom: "12px",
                    fontStyle: "italic",
                    borderLeft: "3px solid #667eea"
                  }}>
                    "{note.message}"
                  </div>
                )}

                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: "12px",
                  borderTop: "1px solid rgba(226, 232, 240, 0.1)"
                }}>
                  <small style={{ color: "#64748b", fontSize: "12px" }}>
                    {new Date(note.createdAt).toLocaleString()}
                  </small>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Link
                      to={`/user/${note.from?.email}`}
                      style={{
                        display: "inline-block",
                        padding: "8px 16px",
                        background: "rgba(168, 85, 247, 0.2)",
                        border: "1px solid rgba(168, 85, 247, 0.3)",
                        color: "#d8b4fe",
                        borderRadius: "6px",
                        textDecoration: "none",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                        transition: "all 0.3s ease"
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.background = "rgba(168, 85, 247, 0.3)";
                        (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(168, 85, 247, 0.5)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.background = "rgba(168, 85, 247, 0.2)";
                        (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(168, 85, 247, 0.3)";
                      }}
                    >
                      👤 Profile
                    </Link>
                    <button
                      onClick={() => deleteNotification(note._id)}
                      style={{
                        padding: "8px 16px",
                        background: "rgba(239, 68, 68, 0.2)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        color: "#fca5a5",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                        transition: "all 0.3s ease"
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "rgba(239, 68, 68, 0.3)";
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239, 68, 68, 0.5)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "rgba(239, 68, 68, 0.2)";
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239, 68, 68, 0.3)";
                      }}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OWNER NOTIFICATIONS (Requests) */}
      {requestNotes.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <h2 style={{ 
            fontSize: "22px",
            marginBottom: "20px",
            color: "#f1f5f9",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            📩 Property Requests ({requestNotes.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {requestNotes.map(note => (
              <div key={note._id} style={{
                padding: "20px",
                background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(45, 55, 72, 0.8) 100%)",
                border: "2px solid rgba(102, 126, 234, 0.3)",
                borderLeft: "4px solid #667eea",
                borderRadius: "12px",
                transition: "all 0.3s ease"
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = "linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(45, 55, 72, 0.95) 100%)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(102, 126, 234, 0.2)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = "linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(45, 55, 72, 0.8) 100%)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
              }}
              >
                <div style={{ marginBottom: "12px" }}>
                  <p style={{ margin: "0 0 4px 0", color: "#f1f5f9", fontWeight: "700" }}>
                    {note.from?.name || note.from?.email}
                  </p>
                  <p style={{ margin: "0 0 8px 0", color: "#94a3b8", fontSize: "14px" }}>
                    wants to <b style={{ color: "#667eea" }}>{String(note.action).toLowerCase()}</b> your property
                  </p>
                </div>

                {note.property && (
                  <div style={{
                    padding: "12px",
                    background: "rgba(15, 23, 42, 0.6)",
                    borderLeft: "3px solid #667eea",
                    borderRadius: "6px",
                    marginBottom: "12px",
                    color: "#cbd5e1",
                    fontSize: "14px"
                  }}>
                    <b>{note.property.title}</b> — <span style={{ color: "#667eea", fontWeight: "700" }}>₹{note.property.price}</span>
                  </div>
                )}

                {note.message && (
                  <div style={{
                    padding: "12px",
                    background: "rgba(102, 126, 234, 0.1)",
                    borderRadius: "6px",
                    color: "#cbd5e1",
                    fontSize: "14px",
                    marginBottom: "12px",
                    fontStyle: "italic",
                    borderLeft: "3px solid #667eea"
                  }}>
                    "{note.message}"
                  </div>
                )}

                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: "12px",
                  borderTop: "1px solid rgba(226, 232, 240, 0.1)"
                }}>
                  <small style={{ color: "#64748b", fontSize: "12px" }}>
                    {new Date(note.createdAt).toLocaleString()}
                  </small>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <Link
                      to={`/user/${note.from?.email}`}
                      style={{
                        padding: "8px 16px",
                        background: "rgba(168, 85, 247, 0.2)",
                        border: "1px solid rgba(168, 85, 247, 0.3)",
                        color: "#d8b4fe",
                        borderRadius: "6px",
                        textDecoration: "none",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                        transition: "all 0.3s ease"
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.background = "rgba(168, 85, 247, 0.3)";
                        (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(168, 85, 247, 0.5)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.background = "rgba(168, 85, 247, 0.2)";
                        (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(168, 85, 247, 0.3)";
                      }}
                    >
                      👤 Profile
                    </Link>
                    <button
                      onClick={() => acceptRequest(note.property._id)}
                      style={{
                        padding: "8px 16px",
                        background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                        border: "none",
                        color: "white",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                        transition: "all 0.3s ease"
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 12px rgba(34, 197, 94, 0.4)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                      }}
                    >
                      ✓ Accept
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
