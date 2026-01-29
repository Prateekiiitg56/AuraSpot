import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import "../App.css";

interface AIScore {
  totalScore: number;
  breakdown: {
    location: number;
    budget: number;
    propertyType: number;
    amenities: number;
    profileMatch: number;
  };
  matchReason: string;
}

interface MatchedProperty {
  _id: string;
  title: string;
  price: number;
  city?: string;
  area?: string;
  type: string;
  purpose: string;
  image?: string;
  amenities?: string[];
  propertyScore?: number;
  aiScore: AIScore;
}

interface AISuggestions {
  topMatches: MatchedProperty[];
  budgetFriendly: MatchedProperty[];
  closest: MatchedProperty[];
}

const AMENITIES_LIST = [
  "WiFi", "AC", "Parking", "Gym", "Security", "Power Backup",
  "Furnished", "Laundry", "Kitchen", "Balcony", "Garden", "Pool",
  "Study Room", "Mess", "Water Supply", "CCTV"
];

const AIMatch: React.FC = () => {
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  
  // Form state
  const [preferredLocation, setPreferredLocation] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [purpose, setPurpose] = useState("RENT");
  const [propertyType, setPropertyType] = useState("");
  const [userProfile, setUserProfile] = useState("");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  
  // Results state
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestions | null>(null);
  const [allMatches, setAllMatches] = useState<MatchedProperty[]>([]);
  const [activeTab, setActiveTab] = useState<"top" | "budget" | "closest">("top");
  const [showResults, setShowResults] = useState(false);

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities(prev => 
      prev.includes(amenity) 
        ? prev.filter(a => a !== amenity)
        : [...prev, amenity]
    );
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!preferredLocation) {
      alert("Please enter a preferred location");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API}/properties/ai-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredLocation,
          budgetMin: budgetMin ? Number(budgetMin) : 0,
          budgetMax: budgetMax ? Number(budgetMax) : 10000000,
          purpose,
          propertyType,
          userProfile,
          requiredAmenities: selectedAmenities
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuggestions(data.suggestions);
        setAllMatches(data.allMatches);
        setShowResults(true);
      } else {
        alert("Failed to find matches");
      }
    } catch (error) {
      console.error("AI Match error:", error);
      alert("Failed to process matching");
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#10b981";
    if (score >= 60) return "#3b82f6";
    if (score >= 40) return "#f59e0b";
    return "#ef4444";
  };

  const renderPropertyCard = (property: MatchedProperty, showAIScore = true) => (
    <div
      key={property._id}
      onClick={() => navigate(`/property/${property._id}`)}
      style={{
        background: "linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(45, 55, 72, 0.9) 100%)",
        border: "1px solid rgba(102, 126, 234, 0.3)",
        borderRadius: "12px",
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 0.3s ease",
        position: "relative"
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 40px rgba(102, 126, 234, 0.3)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      {/* AI Match Score Badge */}
      {showAIScore && property.aiScore && (
        <div style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          background: getScoreColor(property.aiScore.totalScore),
          color: "white",
          padding: "8px 12px",
          borderRadius: "10px",
          fontSize: "16px",
          fontWeight: "700",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          zIndex: 10
        }}>
          <span>🤖</span>
          <span>{property.aiScore.totalScore}</span>
          <span style={{ fontSize: "11px", opacity: 0.8 }}>/100</span>
        </div>
      )}

      {/* Image */}
      <div style={{ height: "160px", overflow: "hidden" }}>
        <img
          src={property.image ? `http://localhost:5000/uploads/${property.image}` : "https://via.placeholder.com/300x200?text=No+Image"}
          alt={property.title}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {/* Content */}
      <div style={{ padding: "16px" }}>
        <h4 style={{ margin: "0 0 8px 0", color: "#f1f5f9", fontSize: "16px" }}>
          {property.title}
        </h4>
        <p style={{ margin: "0 0 4px 0", color: "#10b981", fontWeight: "700", fontSize: "18px" }}>
          ₹{property.price.toLocaleString()}
        </p>
        <p style={{ margin: "0 0 8px 0", color: "#94a3b8", fontSize: "13px" }}>
          📍 {property.city}{property.area ? `, ${property.area}` : ""}
        </p>
        
        {/* Match Reason */}
        {showAIScore && property.aiScore?.matchReason && (
          <p style={{
            margin: "8px 0 0 0",
            padding: "8px",
            background: "rgba(102, 126, 234, 0.15)",
            borderRadius: "6px",
            color: "#a5b4fc",
            fontSize: "12px",
            fontWeight: "500"
          }}>
            ✨ {property.aiScore.matchReason}
          </p>
        )}

        {/* Tags */}
        <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap" }}>
          <span style={{
            background: "rgba(102, 126, 234, 0.2)",
            color: "#a5b4fc",
            padding: "3px 8px",
            borderRadius: "4px",
            fontSize: "11px"
          }}>
            {property.type}
          </span>
          <span style={{
            background: "rgba(16, 185, 129, 0.2)",
            color: "#6ee7b7",
            padding: "3px 8px",
            borderRadius: "4px",
            fontSize: "11px"
          }}>
            {property.purpose}
          </span>
        </div>
      </div>
    </div>
  );

  const getCurrentTabData = () => {
    if (!suggestions) return [];
    switch (activeTab) {
      case "top": return suggestions.topMatches;
      case "budget": return suggestions.budgetFriendly;
      case "closest": return suggestions.closest;
      default: return suggestions.topMatches;
    }
  };

  return (
    <div className="page">
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h1 style={{ 
            fontSize: "42px", 
            marginBottom: "12px",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>
            🤖 AI Rental Match
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "18px" }}>
            Find your perfect property match using our Smart Property AI
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} style={{
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(45, 55, 72, 0.8) 100%)",
          border: "1px solid rgba(102, 126, 234, 0.2)",
          borderRadius: "16px",
          padding: "32px",
          marginBottom: "40px"
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px" }}>
            {/* Location */}
            <div>
              <label style={{ display: "block", marginBottom: "8px", color: "#cbd5e1", fontWeight: "500" }}>
                📍 Preferred Location *
              </label>
              <input
                type="text"
                value={preferredLocation}
                onChange={(e) => setPreferredLocation(e.target.value)}
                placeholder="e.g., Mumbai, Delhi, Bangalore"
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(102, 126, 234, 0.3)",
                  borderRadius: "8px",
                  color: "#f1f5f9",
                  fontSize: "14px"
                }}
                required
              />
            </div>

            {/* Budget Range */}
            <div>
              <label style={{ display: "block", marginBottom: "8px", color: "#cbd5e1", fontWeight: "500" }}>
                💰 Budget Range
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type="number"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                  placeholder="Min"
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(102, 126, 234, 0.3)",
                    borderRadius: "8px",
                    color: "#f1f5f9"
                  }}
                />
                <input
                  type="number"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  placeholder="Max"
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(102, 126, 234, 0.3)",
                    borderRadius: "8px",
                    color: "#f1f5f9"
                  }}
                />
              </div>
            </div>

            {/* Purpose */}
            <div>
              <label style={{ display: "block", marginBottom: "8px", color: "#cbd5e1", fontWeight: "500" }}>
                🎯 Purpose
              </label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(102, 126, 234, 0.3)",
                  borderRadius: "8px",
                  color: "#f1f5f9"
                }}
              >
                <option value="RENT">Rent</option>
                <option value="SALE">Buy</option>
              </select>
            </div>

            {/* Property Type */}
            <div>
              <label style={{ display: "block", marginBottom: "8px", color: "#cbd5e1", fontWeight: "500" }}>
                🏠 Property Type
              </label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(102, 126, 234, 0.3)",
                  borderRadius: "8px",
                  color: "#f1f5f9"
                }}
              >
                <option value="">Any Type</option>
                <option value="HOSTEL">Hostel</option>
                <option value="PG">PG</option>
                <option value="ROOM">Room</option>
                <option value="FLAT">Flat</option>
                <option value="HOME">Home</option>
              </select>
            </div>

            {/* User Profile */}
            <div>
              <label style={{ display: "block", marginBottom: "8px", color: "#cbd5e1", fontWeight: "500" }}>
                👤 Your Profile
              </label>
              <select
                value={userProfile}
                onChange={(e) => setUserProfile(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(102, 126, 234, 0.3)",
                  borderRadius: "8px",
                  color: "#f1f5f9"
                }}
              >
                <option value="">Select Profile</option>
                <option value="student">Student</option>
                <option value="worker">Working Professional</option>
                <option value="family">Family</option>
                <option value="couple">Couple</option>
              </select>
            </div>
          </div>

          {/* Amenities */}
          <div style={{ marginTop: "24px" }}>
            <label style={{ display: "block", marginBottom: "12px", color: "#cbd5e1", fontWeight: "500" }}>
              ✨ Required Amenities
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              {AMENITIES_LIST.map(amenity => (
                <button
                  key={amenity}
                  type="button"
                  onClick={() => toggleAmenity(amenity)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "20px",
                    border: selectedAmenities.includes(amenity) 
                      ? "2px solid #667eea" 
                      : "1px solid rgba(102, 126, 234, 0.3)",
                    background: selectedAmenities.includes(amenity) 
                      ? "rgba(102, 126, 234, 0.3)" 
                      : "transparent",
                    color: selectedAmenities.includes(amenity) ? "#a5b4fc" : "#94a3b8",
                    cursor: "pointer",
                    fontSize: "13px",
                    transition: "all 0.2s ease"
                  }}
                >
                  {amenity}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              marginTop: "28px",
              padding: "16px",
              background: loading 
                ? "rgba(102, 126, 234, 0.3)" 
                : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              border: "none",
              borderRadius: "10px",
              fontSize: "18px",
              fontWeight: "700",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.3s ease"
            }}
          >
            {loading ? "🔍 Finding Best Matches..." : "🤖 Find My Perfect Match"}
          </button>
        </form>

        {/* Results */}
        {showResults && suggestions && (
          <div>
            {/* Tabs */}
            <div style={{
              display: "flex",
              gap: "12px",
              marginBottom: "24px",
              borderBottom: "1px solid rgba(102, 126, 234, 0.2)",
              paddingBottom: "12px"
            }}>
              <button
                onClick={() => setActiveTab("top")}
                style={{
                  padding: "12px 24px",
                  background: activeTab === "top" 
                    ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" 
                    : "transparent",
                  color: activeTab === "top" ? "white" : "#94a3b8",
                  border: activeTab === "top" ? "none" : "1px solid rgba(102, 126, 234, 0.3)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "14px"
                }}
              >
                🏆 Top Matches ({suggestions.topMatches.length})
              </button>
              <button
                onClick={() => setActiveTab("budget")}
                style={{
                  padding: "12px 24px",
                  background: activeTab === "budget" 
                    ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" 
                    : "transparent",
                  color: activeTab === "budget" ? "white" : "#94a3b8",
                  border: activeTab === "budget" ? "none" : "1px solid rgba(102, 126, 234, 0.3)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "14px"
                }}
              >
                ⚠️ Budget-Friendly ({suggestions.budgetFriendly.length})
              </button>
              <button
                onClick={() => setActiveTab("closest")}
                style={{
                  padding: "12px 24px",
                  background: activeTab === "closest" 
                    ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" 
                    : "transparent",
                  color: activeTab === "closest" ? "white" : "#94a3b8",
                  border: activeTab === "closest" ? "none" : "1px solid rgba(102, 126, 234, 0.3)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "14px"
                }}
              >
                📍 Closest ({suggestions.closest.length})
              </button>
            </div>

            {/* Tab Content */}
            <div>
              <h3 style={{ color: "#f1f5f9", marginBottom: "20px" }}>
                {activeTab === "top" && "🏆 Top Matches For You"}
                {activeTab === "budget" && "⚠️ Budget-Friendly Alternatives"}
                {activeTab === "closest" && "📍 Closest Properties"}
              </h3>
              
              {getCurrentTabData().length === 0 ? (
                <div style={{ 
                  textAlign: "center", 
                  padding: "60px", 
                  color: "#94a3b8",
                  background: "rgba(30, 41, 59, 0.5)",
                  borderRadius: "12px"
                }}>
                  <p style={{ fontSize: "18px" }}>No matches found in this category</p>
                  <p style={{ fontSize: "14px", marginTop: "8px" }}>Try adjusting your preferences</p>
                </div>
              ) : (
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", 
                  gap: "20px" 
                }}>
                  {getCurrentTabData().map(property => renderPropertyCard(property))}
                </div>
              )}
            </div>

            {/* All Matches */}
            {allMatches.length > 5 && (
              <div style={{ marginTop: "48px" }}>
                <h3 style={{ color: "#f1f5f9", marginBottom: "20px" }}>
                  📊 All Matches ({allMatches.length} properties)
                </h3>
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", 
                  gap: "20px" 
                }}>
                  {allMatches.slice(0, 12).map(property => renderPropertyCard(property))}
                </div>
                {allMatches.length > 12 && (
                  <p style={{ textAlign: "center", color: "#94a3b8", marginTop: "20px" }}>
                    Showing top 12 of {allMatches.length} matches
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* No Results Yet */}
        {!showResults && (
          <div style={{ 
            textAlign: "center", 
            padding: "60px 20px",
            background: "linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(45, 55, 72, 0.5) 100%)",
            borderRadius: "16px",
            border: "1px dashed rgba(102, 126, 234, 0.3)"
          }}>
            <p style={{ fontSize: "48px", marginBottom: "16px" }}>🏠</p>
            <h3 style={{ color: "#f1f5f9", marginBottom: "8px" }}>Enter Your Preferences</h3>
            <p style={{ color: "#94a3b8" }}>
              Fill in the form above to get AI-powered property recommendations
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIMatch;
