import { signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "../services/firebase";
import { useState, useEffect } from "react";
import { API, getImageUrl } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { Link } from "react-router-dom";

interface UserProfile {
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
  isGoogleLogin?: boolean;
  emailVerified?: boolean;
  phoneVerified?: boolean;
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

interface RentalHistory {
  _id: string;
  property: {
    _id: string;
    title: string;
    type: string;
    city: string;
    area?: string;
    price: number;
    image?: string;
    images?: string[];
  };
  owner: {
    _id: string;
    name: string;
    email: string;
  };
  tenant: {
    _id: string;
    name: string;
    email: string;
  };
  rentAmount: number;
  rentalStartDate: string;
  rentalEndDate: string;
  status: string;
  userRole: "OWNER" | "TENANT";
  durationMonths?: number;
  totalPayments?: number;
  totalAmountPaid?: number;
}

const Profile = ({ user }: { user: User | null }) => {
  const { darkMode } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    location: "",
    bio: "",
    socials: {
      facebook: "",
      twitter: "",
      linkedin: "",
      instagram: "",
      youtube: ""
    }
  });

  // Phone OTP verification state
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  // Document verification state
  const [showVerification, setShowVerification] = useState(false);
  const [documentType, setDocumentType] = useState("AADHAR");
  const [documentNumber, setDocumentNumber] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Rental history state
  const [activeTab, setActiveTab] = useState<"profile" | "history">("profile");
  const [rentalHistory, setRentalHistory] = useState<RentalHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [user]);

  useEffect(() => {
    if (activeTab === "history" && user?.email) {
      loadRentalHistory();
    }
  }, [activeTab, user]);

  const loadRentalHistory = async () => {
    if (!user?.email) return;
    
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API}/rent/history/${user.email}`);
      if (res.ok) {
        const data = await res.json();
        setRentalHistory(data);
      }
    } catch (err) {
      console.error("Failed to load rental history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const sendPhoneOTP = async () => {
    if (!user?.email || !editForm.phone.trim()) {
      alert("Please enter a valid phone number");
      return;
    }

    try {
      const res = await fetch(`${API}/users/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          phone: editForm.phone
        })
      });

      if (res.ok) {
        const data = await res.json();
        setOtpSent(true);
        alert(`OTP sent! For testing: ${data.otp}`);
      } else {
        alert("Failed to send OTP");
      }
    } catch (err) {
      console.error("Failed to send OTP:", err);
      alert("Failed to send OTP");
    }
  };

  const verifyPhoneOTP = async () => {
    if (!user?.email || !editForm.phone.trim() || !otp.trim()) {
      alert("Please enter phone and OTP");
      return;
    }

    try {
      const res = await fetch(`${API}/users/verify-phone-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          phone: editForm.phone,
          otp: otp
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setProfile(updated.user);
        setEditForm({ ...editForm, phone: updated.user.phone });
        setOtp("");
        setOtpSent(false);
        alert("Phone verified and updated successfully!");
      } else {
        const error = await res.json();
        alert(error.message || "Failed to verify OTP");
      }
    } catch (err) {
      console.error("Failed to verify OTP:", err);
      alert("Failed to verify OTP");
    }
  };

  const submitVerification = async () => {
    if (!user?.email || !documentNumber.trim()) {
      alert("Please enter a document number");
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch(`${API}/users/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          documentType: documentType,
          documentNumber: documentNumber
        })
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data.user);
        setShowVerification(false);
        setDocumentNumber("");
        alert("Verification submitted successfully! Your verification is pending review.");
      } else {
        const error = await res.json();
        alert(error.message || "Failed to submit verification");
      }
    } catch (err) {
      console.error("Failed to submit verification:", err);
      alert("Failed to submit verification");
    } finally {
      setVerifying(false);
    }
  };

  const loadProfile = async () => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API}/users/email/${user.email}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setEditForm({
          name: data.name || "",
          phone: data.phone || "",
          location: data.location || "",
          bio: data.bio || "",
          socials: data.socials || {
            facebook: "",
            twitter: "",
            linkedin: "",
            instagram: "",
            youtube: ""
          }
        });
        
        // Fetch user stats
        if (data._id) {
          const statsRes = await fetch(`${API}/users/stats/${data._id}`);
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            setUserStats(statsData);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!user?.email) return;

    try {
      const res = await fetch(`${API}/users/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          name: editForm.name,
          phone: editForm.phone,
          location: editForm.location,
          bio: editForm.bio,
          socials: editForm.socials
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        setIsEditing(false);
        alert("Profile updated successfully!");
      } else {
        const error = await res.text();
        alert(error || "Failed to save profile");
      }
    } catch (err) {
      console.error("Failed to save profile:", err);
      alert("Failed to save profile");
    }
  };

  if (!user) {
    return (
      <div className="page">
        <h2>You are not logged in</h2>
        <p>Please login to view profile.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="page">Loading profile...</div>;
  }

  return (
    <div style={{
      maxWidth: "1400px",
      margin: "0 auto",
      background: "var(--bg-primary)",
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
              {profile?.verified && (
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
            {profile?.name || "User Name"}
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
              {profile?.verified && <span style={{ color: "#10b981" }}>✓</span>}
              {profile?.role === "ADMIN" ? "Admin" : profile?.persona === "BUYER" ? "Buyer" : profile?.persona === "SELLER" ? "Seller" : "User"}
              {profile?.verified && " · Verified"}
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
            Member since {profile?.createdAt ? new Date(profile.createdAt).getFullYear() : "2024"}
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
                {profile?.email}
              </div>
            </div>

            {profile?.phone && (
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
                  {profile.phone}
                </div>
              </div>
            )}

            {profile?.location && (
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
                  {profile.location}
                </div>
              </div>
            )}
          </div>

          {/* Social Links */}
          {(profile?.socials?.facebook || profile?.socials?.twitter || profile?.socials?.linkedin || profile?.socials?.instagram || profile?.socials?.youtube) && (
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
                {profile?.socials?.facebook && (
                  <a
                    href={profile.socials.facebook.startsWith("http") ? profile.socials.facebook : `https://facebook.com/${profile.socials.facebook}`}
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
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = darkMode ? "#333" : "#e5e7eb";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = darkMode ? "#252540" : "#f3f4f6";
                    }}
                  >f</a>
                )}
                {profile?.socials?.twitter && (
                  <a
                    href={profile.socials.twitter.startsWith("http") ? profile.socials.twitter : `https://twitter.com/${profile.socials.twitter}`}
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
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = darkMode ? "#333" : "#e5e7eb";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = darkMode ? "#252540" : "#f3f4f6";
                    }}
                  >𝕏</a>
                )}
                {profile?.socials?.linkedin && (
                  <a
                    href={profile.socials.linkedin.startsWith("http") ? profile.socials.linkedin : `https://linkedin.com/in/${profile.socials.linkedin}`}
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
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = darkMode ? "#333" : "#e5e7eb";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = darkMode ? "#252540" : "#f3f4f6";
                    }}
                  >in</a>
                )}
                {profile?.socials?.instagram && (
                  <a
                    href={profile.socials.instagram.startsWith("http") ? profile.socials.instagram : `https://instagram.com/${profile.socials.instagram}`}
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
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = darkMode ? "#333" : "#e5e7eb";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = darkMode ? "#252540" : "#f3f4f6";
                    }}
                  >@</a>
                )}
                {profile?.socials?.youtube && (
                  <a
                    href={profile.socials.youtube.startsWith("http") ? profile.socials.youtube : `https://youtube.com/@${profile.socials.youtube}`}
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
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = darkMode ? "#333" : "#e5e7eb";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = darkMode ? "#252540" : "#f3f4f6";
                    }}
                  >▶</a>
                )}
              </div>
            </div>
          )}

          {/* Edit Profile Button */}
          <button
            onClick={() => setIsEditing(!isEditing)}
            style={{
              width: "100%",
              padding: "12px",
              marginTop: "24px",
              background: darkMode ? "#667eea" : "#4f46e5",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = darkMode ? "#764ba2" : "#4338ca";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = darkMode ? "#667eea" : "#4f46e5";
            }}
          >
            {isEditing ? "Cancel" : "Edit Profile"}
          </button>

          {/* Logout Button */}
          <button
            onClick={() => {
              signOut(auth);
              window.location.reload();
            }}
            style={{
              width: "100%",
              padding: "12px",
              marginTop: "12px",
              background: "transparent",
              color: "#ef4444",
              border: "1px solid " + (darkMode ? "#333" : "#e5e7eb"),
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = darkMode ? "#252540" : "#fef2f2";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Logout
          </button>
        </div>

        {/* RIGHT CONTENT AREA */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px"
        }}>
          {/* Tab Navigation */}
          <div style={{
            display: "flex",
            gap: "8px",
            background: darkMode ? "#1a1a2e" : "white",
            borderRadius: "12px",
            padding: "8px",
            border: "1px solid " + (darkMode ? "#252540" : "#e5e7eb")
          }}>
            <button
              onClick={() => setActiveTab("profile")}
              style={{
                flex: 1,
                padding: "12px 20px",
                background: activeTab === "profile" 
                  ? (darkMode ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "#4f46e5")
                  : "transparent",
                color: activeTab === "profile" ? "white" : (darkMode ? "#9ca3af" : "#6b7280"),
                border: "none",
                borderRadius: "8px",
                fontWeight: "600",
                fontSize: "14px",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              👤 Profile
            </button>
            <button
              onClick={() => setActiveTab("history")}
              style={{
                flex: 1,
                padding: "12px 20px",
                background: activeTab === "history" 
                  ? (darkMode ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "#4f46e5")
                  : "transparent",
                color: activeTab === "history" ? "white" : (darkMode ? "#9ca3af" : "#6b7280"),
                border: "none",
                borderRadius: "8px",
                fontWeight: "600",
                fontSize: "14px",
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px"
              }}
            >
              📜 Rental History
              {rentalHistory.length > 0 && (
                <span style={{
                  background: activeTab === "history" ? "rgba(255,255,255,0.2)" : (darkMode ? "#667eea" : "#4f46e5"),
                  color: "white",
                  padding: "2px 8px",
                  borderRadius: "10px",
                  fontSize: "12px"
                }}>
                  {rentalHistory.length}
                </span>
              )}
            </button>
          </div>

          {/* Profile Tab Content */}
          {activeTab === "profile" && (
            <>
          {/* Professional Bio Section */}
          <div style={{
            background: darkMode ? "#1a1a2e" : "white",
            borderRadius: "12px",
            padding: "24px",
            border: "1px solid " + (darkMode ? "#252540" : "#e5e7eb")
          }}>
            <h3 style={{
              fontSize: "18px",
              fontWeight: "600",
              color: darkMode ? "white" : "#000",
              marginBottom: "16px"
            }}>
              Professional Bio
            </h3>

            {isEditing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: darkMode ? "#9ca3af" : "#6b7280",
                    marginBottom: "8px",
                    textTransform: "uppercase"
                  }}>
                    Name
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "12px",
                      background: darkMode ? "#252540" : "#f9fafb",
                      color: darkMode ? "white" : "#000",
                      border: "1px solid " + (darkMode ? "#333" : "#e5e7eb"),
                      borderRadius: "8px",
                      fontSize: "14px"
                    }}
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: darkMode ? "#9ca3af" : "#6b7280",
                    marginBottom: "8px",
                    textTransform: "uppercase"
                  }}>
                    Location
                  </label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "12px",
                      background: darkMode ? "#252540" : "#f9fafb",
                      color: darkMode ? "white" : "#000",
                      border: "1px solid " + (darkMode ? "#333" : "#e5e7eb"),
                      borderRadius: "8px",
                      fontSize: "14px"
                    }}
                    placeholder="City, Country"
                  />
                </div>

                <div>
                  <label style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: darkMode ? "#9ca3af" : "#6b7280",
                    marginBottom: "8px",
                    textTransform: "uppercase"
                  }}>
                    Bio
                  </label>
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    rows={4}
                    style={{
                      width: "100%",
                      padding: "12px",
                      background: darkMode ? "#252540" : "#f9fafb",
                      color: darkMode ? "white" : "#000",
                      border: "1px solid " + (darkMode ? "#333" : "#e5e7eb"),
                      borderRadius: "8px",
                      fontSize: "14px",
                      resize: "vertical"
                    }}
                    placeholder="Tell us about yourself..."
                  />
                </div>

                <div>
                  <label style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: darkMode ? "#9ca3af" : "#6b7280",
                    marginBottom: "8px",
                    textTransform: "uppercase"
                  }}>
                    Phone Number
                  </label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      style={{
                        flex: 1,
                        padding: "12px",
                        background: darkMode ? "#252540" : "#f9fafb",
                        color: darkMode ? "white" : "#000",
                        border: "1px solid " + (darkMode ? "#333" : "#e5e7eb"),
                        borderRadius: "8px",
                        fontSize: "14px"
                      }}
                      placeholder="+1234567890"
                    />
                    <button
                      onClick={sendPhoneOTP}
                      disabled={!editForm.phone || otpSent}
                      style={{
                        padding: "12px 20px",
                        background: darkMode ? "#667eea" : "#4f46e5",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: "600",
                        fontSize: "14px",
                        cursor: editForm.phone && !otpSent ? "pointer" : "not-allowed",
                        opacity: editForm.phone && !otpSent ? 1 : 0.5,
                        whiteSpace: "nowrap"
                      }}
                    >
                      {otpSent ? "Sent" : "Send OTP"}
                    </button>
                  </div>
                </div>

                {otpSent && (
                  <div>
                    <label style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: darkMode ? "#9ca3af" : "#6b7280",
                      marginBottom: "8px",
                      textTransform: "uppercase"
                    }}>
                      Enter OTP
                    </label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        style={{
                          flex: 1,
                          padding: "12px",
                          background: darkMode ? "#252540" : "#f9fafb",
                          color: darkMode ? "white" : "#000",
                          border: "1px solid " + (darkMode ? "#333" : "#e5e7eb"),
                          borderRadius: "8px",
                          fontSize: "14px"
                        }}
                        placeholder="Enter 6-digit OTP"
                      />
                      <button
                        onClick={verifyPhoneOTP}
                        disabled={!otp}
                        style={{
                          padding: "12px 20px",
                          background: "#10b981",
                          color: "white",
                          border: "none",
                          borderRadius: "8px",
                          fontWeight: "600",
                          fontSize: "14px",
                          cursor: otp ? "pointer" : "not-allowed",
                          opacity: otp ? 1 : 0.5
                        }}
                      >
                        Verify
                      </button>
                    </div>
                  </div>
                )}

                {/* Social Media Links */}
                <div>
                  <h4 style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: darkMode ? "white" : "#000",
                    marginBottom: "12px"
                  }}>
                    Social Media Links
                  </h4>

                  {["facebook", "twitter", "linkedin", "instagram", "youtube"].map((platform) => (
                    <div key={platform} style={{ marginBottom: "12px" }}>
                      <label style={{
                        display: "block",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: darkMode ? "#9ca3af" : "#6b7280",
                        marginBottom: "6px",
                        textTransform: "capitalize"
                      }}>
                        {platform}
                      </label>
                      <input
                        type="text"
                        value={(editForm.socials as any)[platform] || ""}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          socials: {
                            ...editForm.socials,
                            [platform as keyof typeof editForm.socials]: e.target.value
                          }
                        })}
                        style={{
                          width: "100%",
                          padding: "10px",
                          background: darkMode ? "#252540" : "#f9fafb",
                          color: darkMode ? "white" : "#000",
                          border: "1px solid " + (darkMode ? "#333" : "#e5e7eb"),
                          borderRadius: "6px",
                          fontSize: "13px"
                        }}
                        placeholder={`Your ${platform} username or URL`}
                      />
                    </div>
                  ))}
                </div>

                {/* Save Changes Button */}
                <button
                  onClick={saveProfile}
                  style={{
                    padding: "14px",
                    background: darkMode ? "#667eea" : "#4f46e5",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "600",
                    fontSize: "14px",
                    cursor: "pointer",
                    marginTop: "8px"
                  }}
                >
                  Save Changes
                </button>
              </div>
            ) : (
              <div>
                <p style={{
                  fontSize: "14px",
                  lineHeight: "1.6",
                  color: darkMode ? "#d1d5db" : "#4b5563",
                  marginBottom: "16px"
                }}>
                  {profile?.bio || "No bio added yet. Click 'Edit Profile' to add your professional bio."}
                </p>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "16px",
                  marginTop: "16px"
                }}>
                  <div>
                    <div style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      color: darkMode ? "#9ca3af" : "#6b7280",
                      marginBottom: "4px",
                      textTransform: "uppercase"
                    }}>
                      Member Since
                    </div>
                    <div style={{
                      fontSize: "14px",
                      color: darkMode ? "white" : "#000"
                    }}>
                      2024
                    </div>
                  </div>

                  <div>
                    <div style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      color: darkMode ? "#9ca3af" : "#6b7280",
                      marginBottom: "4px",
                      textTransform: "uppercase"
                    }}>
                      Phone
                    </div>
                    <div style={{
                      fontSize: "14px",
                      color: darkMode ? "white" : "#000"
                    }}>
                      {profile?.phone || "Not provided"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* My Core Skills Section */}
          <div style={{
            background: darkMode ? "#1a1a2e" : "white",
            borderRadius: "12px",
            padding: "24px",
            border: "1px solid " + (darkMode ? "#252540" : "#e5e7eb")
          }}>
            <h3 style={{
              fontSize: "18px",
              fontWeight: "600",
              color: darkMode ? "white" : "#000",
              marginBottom: "16px"
            }}>
              My Core Skills
            </h3>

            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px"
            }}>
              {["Property Analysis", "Negotiation", "Market Research", "Client Relations", "Investment Strategy"].map((skill, index) => (
                <div
                  key={index}
                  style={{
                    padding: "8px 16px",
                    background: index === 0 ? (darkMode ? "#667eea" : "#4f46e5") : (darkMode ? "#252540" : "#f3f4f6"),
                    color: index === 0 ? "white" : (darkMode ? "#d1d5db" : "#4b5563"),
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "500",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  {skill}
                  {index === 0 && <span>⭐</span>}
                </div>
              ))}
            </div>
          </div>

          {/* My Achievements Section */}
          <div style={{
            background: darkMode ? "#1a1a2e" : "white",
            borderRadius: "12px",
            padding: "24px",
            border: "1px solid " + (darkMode ? "#252540" : "#e5e7eb")
          }}>
            <h3 style={{
              fontSize: "18px",
              fontWeight: "600",
              color: darkMode ? "white" : "#000",
              marginBottom: "16px"
            }}>
              My Achievements
            </h3>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: "16px"
            }}>
              {[
                { icon: "🏆", label: "Top Seller", color: "#f59e0b" },
                { icon: "⭐", label: "5-Star Rated", color: "#10b981" },
                { icon: "💼", label: "Deal Maker", color: "#3b82f6" },
                { icon: "👑", label: "Premium User", color: "#8b5cf6" }
              ].map((achievement, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                    padding: "16px",
                    background: darkMode ? "#252540" : "#f9fafb",
                    borderRadius: "12px",
                    textAlign: "center"
                  }}
                >
                  <div style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: achievement.color + "20",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px"
                  }}>
                    {achievement.icon}
                  </div>
                  <div style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: darkMode ? "white" : "#000"
                  }}>
                    {achievement.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Get Verified Section */}
          {!profile?.verified && !isEditing && !showVerification && (
            <div style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: "12px",
              padding: "24px",
              textAlign: "center"
            }}>
              <div style={{
                fontSize: "32px",
                marginBottom: "12px"
              }}>
                ✓
              </div>
              <h3 style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "white",
                marginBottom: "8px"
              }}>
                Get Verified
              </h3>
              <p style={{
                fontSize: "14px",
                color: "rgba(255,255,255,0.9)",
                marginBottom: "16px"
              }}>
                Increase your credibility and get more deals
              </p>
              <button
                onClick={() => setShowVerification(true)}
                style={{
                  padding: "10px 24px",
                  background: "white",
                  color: "#667eea",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "600",
                  fontSize: "14px",
                  cursor: "pointer"
                }}
              >
                Start Verification
              </button>
            </div>
          )}

          {/* Verification Modal */}
          {showVerification && !isEditing && (
            <div style={{
              background: darkMode ? "#2a2a2a" : "#f5f5f5",
              borderRadius: "12px",
              padding: "24px",
              border: darkMode ? "1px solid #444" : "1px solid #ddd"
            }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px"
              }}>
                <h3 style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: darkMode ? "white" : "#333",
                  margin: 0
                }}>
                  Document Verification
                </h3>
                <button
                  onClick={() => {
                    setShowVerification(false);
                    setDocumentNumber("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "24px",
                    cursor: "pointer",
                    color: darkMode ? "#aaa" : "#666"
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: darkMode ? "#bbb" : "#666",
                  marginBottom: "8px"
                }}>
                  Document Type
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  disabled={verifying}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: darkMode ? "1px solid #444" : "1px solid #ddd",
                    borderRadius: "8px",
                    fontSize: "14px",
                    background: darkMode ? "#333" : "white",
                    color: darkMode ? "white" : "#333",
                    cursor: verifying ? "not-allowed" : "pointer"
                  }}
                >
                  <option value="AADHAR">Aadhar (National ID)</option>
                  <option value="PAN">PAN Card</option>
                  <option value="DRIVING_LICENSE">Driving License</option>
                  <option value="PASSPORT">Passport</option>
                </select>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: darkMode ? "#bbb" : "#666",
                  marginBottom: "8px"
                }}>
                  Document Number
                </label>
                <input
                  type="text"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  disabled={verifying}
                  placeholder={`Enter your ${documentType.toLowerCase().replace("_", " ")} number`}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: darkMode ? "1px solid #444" : "1px solid #ddd",
                    borderRadius: "8px",
                    fontSize: "14px",
                    background: darkMode ? "#333" : "white",
                    color: darkMode ? "white" : "#333",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  onClick={() => {
                    setShowVerification(false);
                    setDocumentNumber("");
                  }}
                  disabled={verifying}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    border: darkMode ? "1px solid #444" : "1px solid #ddd",
                    background: darkMode ? "#333" : "#f5f5f5",
                    color: darkMode ? "#bbb" : "#666",
                    borderRadius: "8px",
                    fontWeight: "600",
                    fontSize: "14px",
                    cursor: verifying ? "not-allowed" : "pointer",
                    opacity: verifying ? 0.6 : 1
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={submitVerification}
                  disabled={verifying || !documentNumber.trim()}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    background: "#667eea",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "600",
                    fontSize: "14px",
                    cursor: verifying || !documentNumber.trim() ? "not-allowed" : "pointer",
                    opacity: verifying || !documentNumber.trim() ? 0.6 : 1
                  }}
                >
                  {verifying ? "Verifying..." : "Submit Verification"}
                </button>
              </div>

              <p style={{
                fontSize: "12px",
                color: darkMode ? "#888" : "#999",
                marginTop: "12px",
                marginBottom: 0
              }}>
                Your document will be reviewed within 24 hours.
              </p>
            </div>
          )}
            </>
          )}

          {/* History Tab Content */}
          {activeTab === "history" && (
            <div style={{
              background: darkMode ? "#1a1a2e" : "white",
              borderRadius: "12px",
              padding: "24px",
              border: "1px solid " + (darkMode ? "#252540" : "#e5e7eb")
            }}>
              <h3 style={{
                fontSize: "20px",
                fontWeight: "600",
                color: darkMode ? "white" : "#000",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "10px"
              }}>
                📜 Rental History
                <span style={{
                  fontSize: "14px",
                  color: darkMode ? "#9ca3af" : "#6b7280",
                  fontWeight: "400"
                }}>
                  ({rentalHistory.length} completed agreements)
                </span>
              </h3>

              {historyLoading ? (
                <div style={{
                  textAlign: "center",
                  padding: "40px",
                  color: darkMode ? "#9ca3af" : "#6b7280"
                }}>
                  Loading history...
                </div>
              ) : rentalHistory.length === 0 ? (
                <div style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  color: darkMode ? "#9ca3af" : "#6b7280"
                }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
                  <p style={{ marginBottom: "8px" }}>No rental history yet</p>
                  <p style={{ fontSize: "14px" }}>
                    Completed or terminated rent agreements will appear here
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {rentalHistory.filter(h => h.property !== null).map((history) => (
                    <div
                      key={history._id}
                      style={{
                        background: darkMode ? "#252540" : "#f9fafb",
                        borderRadius: "12px",
                        padding: "20px",
                        border: "1px solid " + (darkMode ? "#333" : "#e5e7eb")
                      }}
                    >
                      {/* Header with property info */}
                      <div style={{
                        display: "flex",
                        gap: "16px",
                        marginBottom: "16px"
                      }}>
                        {/* Property Image */}
                        <div style={{
                          width: "100px",
                          height: "80px",
                          borderRadius: "8px",
                          overflow: "hidden",
                          flexShrink: 0,
                          background: darkMode ? "#1a1a2e" : "#e5e7eb"
                        }}>
                          {history.property?.image || history.property?.images?.[0] ? (
                            <img
                              src={getImageUrl(history.property.image || history.property.images?.[0])}
                              alt={history.property.title}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover"
                              }}
                            />
                          ) : (
                            <div style={{
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "24px"
                            }}>
                              🏠
                            </div>
                          )}
                        </div>

                        {/* Property Details */}
                        <div style={{ flex: 1 }}>
                          <Link 
                            to={`/property/${history.property?._id || ''}`}
                            style={{
                              fontSize: "16px",
                              fontWeight: "600",
                              color: darkMode ? "white" : "#111827",
                              textDecoration: "none",
                              marginBottom: "4px",
                              display: "block"
                            }}
                          >
                            {history.property?.title || "Property"}
                          </Link>
                          <p style={{
                            fontSize: "14px",
                            color: darkMode ? "#9ca3af" : "#6b7280",
                            margin: "4px 0"
                          }}>
                            📍 {history.property?.area ? `${history.property.area}, ` : ""}{history.property?.city}
                          </p>
                          <div style={{
                            display: "flex",
                            gap: "12px",
                            flexWrap: "wrap",
                            marginTop: "8px"
                          }}>
                            <span style={{
                              padding: "4px 10px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "600",
                              background: history.userRole === "OWNER" 
                                ? "rgba(16, 185, 129, 0.1)" 
                                : "rgba(59, 130, 246, 0.1)",
                              color: history.userRole === "OWNER" ? "#10b981" : "#3b82f6"
                            }}>
                              {history.userRole === "OWNER" ? "👑 As Owner" : "🏠 As Tenant"}
                            </span>
                            <span style={{
                              padding: "4px 10px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "600",
                              background: history.status === "TERMINATED" 
                                ? "rgba(239, 68, 68, 0.1)" 
                                : "rgba(16, 185, 129, 0.1)",
                              color: history.status === "TERMINATED" ? "#ef4444" : "#10b981"
                            }}>
                              {history.status === "TERMINATED" ? "🔴 Terminated" : "✅ Completed"}
                            </span>
                          </div>
                        </div>

                        {/* Rent Amount */}
                        <div style={{ textAlign: "right" }}>
                          <div style={{
                            fontSize: "18px",
                            fontWeight: "700",
                            color: "#667eea"
                          }}>
                            ₹{history.rentAmount?.toLocaleString()}
                          </div>
                          <div style={{
                            fontSize: "12px",
                            color: darkMode ? "#9ca3af" : "#6b7280"
                          }}>
                            per month
                          </div>
                        </div>
                      </div>

                      {/* Agreement Details */}
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                        gap: "12px",
                        paddingTop: "16px",
                        borderTop: "1px solid " + (darkMode ? "#333" : "#e5e7eb")
                      }}>
                        <div>
                          <div style={{
                            fontSize: "12px",
                            color: darkMode ? "#6b7280" : "#9ca3af",
                            marginBottom: "4px"
                          }}>
                            {history.userRole === "OWNER" ? "Tenant" : "Owner"}
                          </div>
                          <div style={{
                            fontSize: "14px",
                            color: darkMode ? "white" : "#111827",
                            fontWeight: "500"
                          }}>
                            {history.userRole === "OWNER" 
                              ? history.tenant?.name 
                              : history.owner?.name}
                          </div>
                        </div>

                        <div>
                          <div style={{
                            fontSize: "12px",
                            color: darkMode ? "#6b7280" : "#9ca3af",
                            marginBottom: "4px"
                          }}>
                            Duration
                          </div>
                          <div style={{
                            fontSize: "14px",
                            color: darkMode ? "white" : "#111827",
                            fontWeight: "500"
                          }}>
                            {history.durationMonths || 0} months
                          </div>
                        </div>

                        <div>
                          <div style={{
                            fontSize: "12px",
                            color: darkMode ? "#6b7280" : "#9ca3af",
                            marginBottom: "4px"
                          }}>
                            Period
                          </div>
                          <div style={{
                            fontSize: "14px",
                            color: darkMode ? "white" : "#111827",
                            fontWeight: "500"
                          }}>
                            {new Date(history.rentalStartDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })} - {new Date(history.rentalEndDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                          </div>
                        </div>

                        <div>
                          <div style={{
                            fontSize: "12px",
                            color: darkMode ? "#6b7280" : "#9ca3af",
                            marginBottom: "4px"
                          }}>
                            Total Paid
                          </div>
                          <div style={{
                            fontSize: "14px",
                            color: "#10b981",
                            fontWeight: "600"
                          }}>
                            ₹{(history.totalAmountPaid || 0).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
