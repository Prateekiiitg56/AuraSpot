import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { API } from "../services/api";
import { useTheme } from "../context/ThemeContext";

interface UserData {
  _id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  verified: boolean;
  role: string;
  persona?: string;
  bio?: string;
  rating?: number;
  totalRatings?: number;
  successfulDeals?: number;
  trustBadge?: string;
  createdAt?: string;
  socials?: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
    youtube?: string;
  };
  verificationDocuments?: Array<{
    type: string;
    documentNumber: string;
    uploadedAt: string;
  }>;
}

interface UserStats {
  propertiesListed: number;
  activeDeals: number;
  completedDeals: number;
  totalDeals: number;
  rating: number;
  totalRatings: number;
  successfulDeals: number;
  trustBadge: string;
  badgeInfo: {
    emoji: string;
    label: string;
    color: string;
  };
}

const UserProfile = () => {
  const { email } = useParams<{ email: string }>();
  const { darkMode } = useTheme();
  const [user, setUser] = useState<UserData | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserProfile();
  }, [email]);

  const loadUserProfile = async () => {
    if (!email) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API}/users/email/${email}`);
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        
        // Fetch user stats
        if (data._id) {
          const statsRes = await fetch(`${API}/users/stats/${data._id}`);
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            setUserStats(statsData);
          }
        }
      } else {
        console.error("User not found");
      }
    } catch (err) {
      console.error("Failed to load user profile:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: darkMode ? "linear-gradient(135deg, #0f172a 0%, #1a1f3a 100%)" : "#f8fafc"
      }}>
        <div style={{
          padding: "40px",
          background: darkMode ? "#1a1a2e" : "white",
          borderRadius: "12px",
          textAlign: "center",
          color: darkMode ? "#fff" : "#111827"
        }}>
          Loading profile...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: darkMode ? "linear-gradient(135deg, #0f172a 0%, #1a1f3a 100%)" : "#f8fafc"
      }}>
        <div style={{
          padding: "40px",
          background: darkMode ? "#1a1a2e" : "white",
          borderRadius: "12px",
          textAlign: "center"
        }}>
          <h2 style={{ color: darkMode ? "#fff" : "#111827", marginBottom: "12px" }}>User Not Found</h2>
          <p style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}>This user's profile doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: "1400px",
      margin: "0 auto",
      background: darkMode ? "linear-gradient(135deg, #0f172a 0%, #1a1f3a 100%)" : "#f8fafc",
      minHeight: "100vh",
      padding: "20px",
      transition: "background 0.3s"
    }}>

      {/* Main Content Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "320px 1fr",
        gap: "20px"
      }}>
        {/* LEFT SIDEBAR - Profile Card */}
        <div style={{
          background: darkMode ? "#1a1a2e" : "white",
          borderRadius: "12px",
          padding: "30px",
          boxShadow: darkMode ? "0 2px 8px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.08)",
          height: "fit-content"
        }}>
          {/* Profile Image */}
          <div style={{
            textAlign: "center",
            marginBottom: "20px"
          }}>
            <div style={{
              width: "100px",
              height: "100px",
              borderRadius: "50%",
              background: darkMode ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "#e0e7ff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "48px",
              border: "3px solid " + (darkMode ? "#252540" : "#f3f4f6"),
              position: "relative"
            }}>
              👤
              {user.verified && (
                <div style={{
                  position: "absolute",
                  bottom: "-5px",
                  right: "-5px",
                  background: "#10b981",
                  color: "white",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                  fontWeight: "700",
                  border: "3px solid " + (darkMode ? "#1a1a2e" : "white")
                }}>
                  ✓
                </div>
              )}
            </div>
          </div>

          {/* Name */}
          <h2 style={{
            fontSize: "22px",
            fontWeight: "600",
            color: darkMode ? "#fff" : "#111827",
            marginBottom: "4px",
            textAlign: "center"
          }}>
            {user.name || "User Name"}
          </h2>

          {/* Role Badge */}
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              background: darkMode ? "#252540" : "#f3f4f6",
              color: darkMode ? "#a0a0b8" : "#6b7280",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: "500"
            }}>
              {user.verified && <span style={{ color: "#10b981" }}>✓</span>}
              {user.role === "OWNER" ? "🏠 Owner" : user.persona === "BUYER" ? "Buyer" : user.persona === "SELLER" ? "Seller" : "User"}
              {user.verified && " · Verified"}
            </span>
          </div>

          {/* Trust Badge */}
          {userStats?.badgeInfo && (
            <div style={{ textAlign: "center", marginBottom: "16px" }}>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                background: `${userStats.badgeInfo.color}20`,
                color: userStats.badgeInfo.color,
                borderRadius: "20px",
                fontSize: "13px",
                fontWeight: "600",
                border: `1px solid ${userStats.badgeInfo.color}40`
              }}>
                {userStats.badgeInfo.emoji} {userStats.badgeInfo.label}
              </span>
            </div>
          )}

          {/* Rating Display */}
          {userStats && userStats.totalRatings > 0 && (
            <div style={{ textAlign: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} style={{ color: star <= Math.round(userStats.rating) ? "#f59e0b" : (darkMode ? "#374151" : "#e5e7eb"), fontSize: "18px" }}>
                    ★
                  </span>
                ))}
                <span style={{ marginLeft: "8px", color: darkMode ? "#9ca3af" : "#6b7280", fontSize: "14px" }}>
                  {userStats.rating.toFixed(1)} ({userStats.totalRatings} reviews)
                </span>
              </div>
            </div>
          )}

          {/* Member Since */}
          <div style={{
            textAlign: "center",
            color: darkMode ? "#6b7280" : "#9ca3af",
            fontSize: "13px",
            marginBottom: "24px",
            fontWeight: "500"
          }}>
            Member since {user.createdAt ? new Date(user.createdAt).getFullYear() : "2024"}
          </div>

          {/* Stats */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            marginBottom: "24px",
            paddingBottom: "24px",
            borderBottom: "1px solid " + (darkMode ? "#252540" : "#f3f4f6")
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{
                fontSize: "24px",
                fontWeight: "600",
                color: darkMode ? "#fff" : "#111827",
                marginBottom: "4px"
              }}>{userStats?.propertiesListed || 0}</div>
              <div style={{
                fontSize: "12px",
                color: darkMode ? "#6b7280" : "#9ca3af",
                fontWeight: "500"
              }}>Properties</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{
                fontSize: "24px",
                fontWeight: "600",
                color: darkMode ? "#fff" : "#111827",
                marginBottom: "4px"
              }}>{userStats?.activeDeals || 0}</div>
              <div style={{
                fontSize: "12px",
                color: darkMode ? "#6b7280" : "#9ca3af",
                fontWeight: "500"
              }}>Active Deals</div>
            </div>
          </div>

          {/* Additional Stats Row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            marginBottom: "24px",
            paddingBottom: "24px",
            borderBottom: "1px solid " + (darkMode ? "#252540" : "#f3f4f6")
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{
                fontSize: "24px",
                fontWeight: "600",
                color: "#10b981",
                marginBottom: "4px"
              }}>{userStats?.successfulDeals || 0}</div>
              <div style={{
                fontSize: "12px",
                color: darkMode ? "#6b7280" : "#9ca3af",
                fontWeight: "500"
              }}>Completed</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{
                fontSize: "24px",
                fontWeight: "600",
                color: "#f59e0b",
                marginBottom: "4px"
              }}>{userStats?.rating ? userStats.rating.toFixed(1) : "N/A"}</div>
              <div style={{
                fontSize: "12px",
                color: darkMode ? "#6b7280" : "#9ca3af",
                fontWeight: "500"
              }}>Rating</div>
            </div>
          </div>

          {/* Contact Info */}
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{
              fontSize: "14px",
              fontWeight: "600",
              color: darkMode ? "#fff" : "#111827",
              marginBottom: "12px"
            }}>Contact Information</h3>

            <div style={{ marginBottom: "12px" }}>
              <div style={{
                fontSize: "11px",
                color: darkMode ? "#6b7280" : "#9ca3af",
                marginBottom: "4px",
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>Email</div>
              <div style={{
                fontSize: "13px",
                color: darkMode ? "#d1d5db" : "#4b5563",
                wordBreak: "break-all"
              }}>
                {user.email}
              </div>
            </div>

            {user.phone && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{
                  fontSize: "11px",
                  color: darkMode ? "#6b7280" : "#9ca3af",
                  marginBottom: "4px",
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>Phone</div>
                <div style={{
                  fontSize: "13px",
                  color: darkMode ? "#d1d5db" : "#4b5563"
                }}>
                  {user.phone}
                </div>
              </div>
            )}

            {user.location && (
              <div>
                <div style={{
                  fontSize: "11px",
                  color: darkMode ? "#6b7280" : "#9ca3af",
                  marginBottom: "4px",
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>Location</div>
                <div style={{
                  fontSize: "13px",
                  color: darkMode ? "#d1d5db" : "#4b5563"
                }}>
                  {user.location}
                </div>
              </div>
            )}
          </div>

          {/* Social Links */}
          {(user.socials?.facebook || user.socials?.twitter || user.socials?.linkedin || user.socials?.instagram || user.socials?.youtube) && (
            <div style={{
              paddingTop: "20px",
              borderTop: "1px solid " + (darkMode ? "#252540" : "#f3f4f6")
            }}>
              <h3 style={{
                fontSize: "14px",
                fontWeight: "600",
                color: darkMode ? "#fff" : "#111827",
                marginBottom: "12px"
              }}>Social Media</h3>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {user.socials?.facebook && (
                  <a
                    href={user.socials.facebook.startsWith("http") ? user.socials.facebook : `https://facebook.com/${user.socials.facebook}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: darkMode ? "#252540" : "#f3f4f6",
                      border: "1px solid " + (darkMode ? "#333" : "#e5e7eb"),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: darkMode ? "#d1d5db" : "#6b7280",
                      fontSize: "16px",
                      cursor: "pointer",
                      textDecoration: "none",
                      transition: "all 0.2s"
                    }}
                  >f</a>
                )}
                {user.socials?.twitter && (
                  <a
                    href={user.socials.twitter.startsWith("http") ? user.socials.twitter : `https://twitter.com/${user.socials.twitter}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: darkMode ? "#252540" : "#f3f4f6",
                      border: "1px solid " + (darkMode ? "#333" : "#e5e7eb"),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: darkMode ? "#d1d5db" : "#6b7280",
                      fontSize: "16px",
                      cursor: "pointer",
                      textDecoration: "none",
                      transition: "all 0.2s"
                    }}
                  >𝕏</a>
                )}
                {user.socials?.linkedin && (
                  <a
                    href={user.socials.linkedin.startsWith("http") ? user.socials.linkedin : `https://linkedin.com/in/${user.socials.linkedin}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: darkMode ? "#252540" : "#f3f4f6",
                      border: "1px solid " + (darkMode ? "#333" : "#e5e7eb"),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: darkMode ? "#d1d5db" : "#6b7280",
                      fontSize: "16px",
                      cursor: "pointer",
                      textDecoration: "none",
                      transition: "all 0.2s"
                    }}
                  >in</a>
                )}
                {user.socials?.instagram && (
                  <a
                    href={user.socials.instagram.startsWith("http") ? user.socials.instagram : `https://instagram.com/${user.socials.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: darkMode ? "#252540" : "#f3f4f6",
                      border: "1px solid " + (darkMode ? "#333" : "#e5e7eb"),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: darkMode ? "#d1d5db" : "#6b7280",
                      fontSize: "16px",
                      cursor: "pointer",
                      textDecoration: "none",
                      transition: "all 0.2s"
                    }}
                  >@</a>
                )}
                {user.socials?.youtube && (
                  <a
                    href={user.socials.youtube.startsWith("http") ? user.socials.youtube : `https://youtube.com/@${user.socials.youtube}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: darkMode ? "#252540" : "#f3f4f6",
                      border: "1px solid " + (darkMode ? "#333" : "#e5e7eb"),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: darkMode ? "#d1d5db" : "#6b7280",
                      fontSize: "16px",
                      cursor: "pointer",
                      textDecoration: "none",
                      transition: "all 0.2s"
                    }}
                  >▶</a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT CONTENT - Main Area */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Bio Section */}
          <div style={{
            background: darkMode ? "#1a1a2e" : "white",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: darkMode ? "0 2px 8px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.08)"
          }}>
            <h3 style={{
              fontSize: "16px",
              fontWeight: "600",
              color: darkMode ? "#fff" : "#111827",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              📝 About {user.name || "This User"}
            </h3>
            <p style={{
              fontSize: "14px",
              color: darkMode ? "#9ca3af" : "#6b7280",
              lineHeight: "1.7",
              margin: 0
            }}>
              {user.bio || "This user hasn't added a bio yet."}
            </p>
          </div>

          {/* Verification Status */}
          {user.verified && (
            <div style={{
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)"
            }}>
              <h3 style={{
                fontSize: "16px",
                fontWeight: "600",
                color: "white",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}>
                ✓ Verified Profile
              </h3>
              <p style={{
                fontSize: "14px",
                color: "rgba(255,255,255,0.9)",
                margin: 0,
                lineHeight: "1.6"
              }}>
                This user has been verified through identity documents and is a trusted member of the AuraSpot community.
              </p>
            </div>
          )}

          {/* Activity Summary */}
          <div style={{
            background: darkMode ? "#1a1a2e" : "white",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: darkMode ? "0 2px 8px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.08)"
          }}>
            <h3 style={{
              fontSize: "16px",
              fontWeight: "600",
              color: darkMode ? "#fff" : "#111827",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              📊 Activity Summary
            </h3>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "16px"
            }}>
              <div style={{
                background: darkMode ? "#252540" : "#f8fafc",
                borderRadius: "10px",
                padding: "20px",
                textAlign: "center",
                border: "1px solid " + (darkMode ? "#333" : "#e5e7eb")
              }}>
                <div style={{
                  fontSize: "28px",
                  fontWeight: "700",
                  color: "#667eea",
                  marginBottom: "4px"
                }}>{userStats?.propertiesListed || 0}</div>
                <div style={{
                  fontSize: "12px",
                  color: darkMode ? "#9ca3af" : "#6b7280",
                  fontWeight: "500"
                }}>Properties Listed</div>
              </div>
              <div style={{
                background: darkMode ? "#252540" : "#f8fafc",
                borderRadius: "10px",
                padding: "20px",
                textAlign: "center",
                border: "1px solid " + (darkMode ? "#333" : "#e5e7eb")
              }}>
                <div style={{
                  fontSize: "28px",
                  fontWeight: "700",
                  color: "#f59e0b",
                  marginBottom: "4px"
                }}>{userStats?.activeDeals || 0}</div>
                <div style={{
                  fontSize: "12px",
                  color: darkMode ? "#9ca3af" : "#6b7280",
                  fontWeight: "500"
                }}>Active Deals</div>
              </div>
              <div style={{
                background: darkMode ? "#252540" : "#f8fafc",
                borderRadius: "10px",
                padding: "20px",
                textAlign: "center",
                border: "1px solid " + (darkMode ? "#333" : "#e5e7eb")
              }}>
                <div style={{
                  fontSize: "28px",
                  fontWeight: "700",
                  color: "#10b981",
                  marginBottom: "4px"
                }}>{userStats?.successfulDeals || 0}</div>
                <div style={{
                  fontSize: "12px",
                  color: darkMode ? "#9ca3af" : "#6b7280",
                  fontWeight: "500"
                }}>Completed Deals</div>
              </div>
              <div style={{
                background: darkMode ? "#252540" : "#f8fafc",
                borderRadius: "10px",
                padding: "20px",
                textAlign: "center",
                border: "1px solid " + (darkMode ? "#333" : "#e5e7eb")
              }}>
                <div style={{
                  fontSize: "28px",
                  fontWeight: "700",
                  color: "#ef4444",
                  marginBottom: "4px"
                }}>{userStats?.totalDeals || 0}</div>
                <div style={{
                  fontSize: "12px",
                  color: darkMode ? "#9ca3af" : "#6b7280",
                  fontWeight: "500"
                }}>Total Deals</div>
              </div>
            </div>
          </div>

          {/* Trust & Safety */}
          <div style={{
            background: darkMode ? "#1a1a2e" : "white",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: darkMode ? "0 2px 8px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.08)"
          }}>
            <h3 style={{
              fontSize: "16px",
              fontWeight: "600",
              color: darkMode ? "#fff" : "#111827",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              🛡️ Trust & Safety
            </h3>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "16px"
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "16px",
                background: darkMode ? "#252540" : "#f8fafc",
                borderRadius: "10px",
                border: "1px solid " + (darkMode ? "#333" : "#e5e7eb")
              }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: user.verified ? "#10b98120" : (darkMode ? "#374151" : "#e5e7eb"),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px"
                }}>
                  {user.verified ? "✓" : "○"}
                </div>
                <div>
                  <div style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: user.verified ? "#10b981" : (darkMode ? "#9ca3af" : "#6b7280")
                  }}>
                    {user.verified ? "ID Verified" : "Not Verified"}
                  </div>
                  <div style={{
                    fontSize: "11px",
                    color: darkMode ? "#6b7280" : "#9ca3af"
                  }}>Identity Check</div>
                </div>
              </div>
              
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "16px",
                background: darkMode ? "#252540" : "#f8fafc",
                borderRadius: "10px",
                border: "1px solid " + (darkMode ? "#333" : "#e5e7eb")
              }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: user.phone ? "#10b98120" : (darkMode ? "#374151" : "#e5e7eb"),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px"
                }}>
                  {user.phone ? "📱" : "○"}
                </div>
                <div>
                  <div style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: user.phone ? "#10b981" : (darkMode ? "#9ca3af" : "#6b7280")
                  }}>
                    {user.phone ? "Phone Added" : "No Phone"}
                  </div>
                  <div style={{
                    fontSize: "11px",
                    color: darkMode ? "#6b7280" : "#9ca3af"
                  }}>Contact Info</div>
                </div>
              </div>

              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "16px",
                background: darkMode ? "#252540" : "#f8fafc",
                borderRadius: "10px",
                border: "1px solid " + (darkMode ? "#333" : "#e5e7eb")
              }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: userStats?.badgeInfo ? `${userStats.badgeInfo.color}20` : (darkMode ? "#374151" : "#e5e7eb"),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px"
                }}>
                  {userStats?.badgeInfo?.emoji || "🏅"}
                </div>
                <div>
                  <div style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: userStats?.badgeInfo?.color || (darkMode ? "#9ca3af" : "#6b7280")
                  }}>
                    {userStats?.badgeInfo?.label || "New User"}
                  </div>
                  <div style={{
                    fontSize: "11px",
                    color: darkMode ? "#6b7280" : "#9ca3af"
                  }}>Trust Level</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
