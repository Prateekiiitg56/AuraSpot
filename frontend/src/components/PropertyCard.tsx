import { useNavigate } from "react-router-dom";
import { getImageUrl } from "../services/api";

interface PropertyCardProps {
  property: {
    _id: string;
    title: string;
    price: number;
    city?: string;
    area?: string;
    type: string;
    purpose: string;
    image?: string;
    images?: string[];
    propertyScore?: number;
    scoreDescription?: string;
    scoreBreakdown?: {
      location: number;
      priceFairness: number;
      amenities: number;
      demand: number;
      ownerCredibility: number;
    };
    owner?: {
      trustBadge?: string;
    };
    // AI Insights
    aiInsights?: {
      score?: number;
      priceRating?: string;
      locationQuality?: string;
      fraudRisk?: string;
      summary?: string;
    };
  };
}

// Get score color based on value
const getScoreColor = (score: number) => {
  if (score >= 80) return "#10b981"; // Green - Excellent
  if (score >= 60) return "#3b82f6"; // Blue - Good
  if (score >= 40) return "#f59e0b"; // Yellow - Fair
  return "#ef4444"; // Red - Poor
};

// Get score label
const getScoreLabel = (score: number) => {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Basic";
};

const PropertyCard = ({ property }: PropertyCardProps) => {
  const navigate = useNavigate();
  // Prefer AI score over manual score
  const score = property.aiInsights?.score || property.propertyScore || 0;
  const scoreColor = getScoreColor(score);
  const isAIScore = !!property.aiInsights?.score;
  
  // Get the first image from images array or fallback to single image
  const displayImage = (property.images && property.images.length > 0) 
    ? property.images[0] 
    : property.image;
  const imageCount = property.images?.length || (property.image ? 1 : 0);

  return (
    <div
      className="property-card"
      onClick={() => navigate(`/property/${property._id}`)}
      style={{ cursor: "pointer", position: "relative" }}
    >
      {/* Smart Property Score Badge */}
      {score > 0 && (
        <div style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          background: scoreColor,
          color: "white",
          padding: "6px 10px",
          borderRadius: "8px",
          fontSize: "14px",
          fontWeight: "700",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          zIndex: 10
        }}>
          <span style={{ fontSize: "16px" }}>{isAIScore ? "🤖" : "⭐"}</span>
          <span>{score}</span>
          <span style={{ fontSize: "10px", opacity: 0.9 }}>/100</span>
        </div>
      )}

      {/* Score Label Badge */}
      {score > 0 && (
        <div style={{
          position: "absolute",
          top: "52px",
          right: "12px",
          background: "rgba(0,0,0,0.7)",
          color: "white",
          padding: "3px 8px",
          borderRadius: "4px",
          fontSize: "10px",
          fontWeight: "500",
          zIndex: 10
        }}>
          {isAIScore ? "AI Score" : getScoreLabel(score)}
        </div>
      )}

      {/* AI Price Rating Badge */}
      {property.aiInsights?.priceRating && (
        <div style={{
          position: "absolute",
          top: "12px",
          left: "12px",
          background: property.aiInsights.priceRating === "EXCELLENT" ? "rgba(16, 185, 129, 0.9)" :
                     property.aiInsights.priceRating === "GOOD" ? "rgba(59, 130, 246, 0.9)" :
                     property.aiInsights.priceRating === "FAIR" ? "rgba(245, 158, 11, 0.9)" : "rgba(239, 68, 68, 0.9)",
          color: "white",
          padding: "4px 8px",
          borderRadius: "6px",
          fontSize: "10px",
          fontWeight: "600",
          zIndex: 10
        }}>
          💰 {property.aiInsights.priceRating}
        </div>
      )}

      <img
        src={getImageUrl(displayImage)}
        className="property-img"
      />
      
      {/* Image Count Badge */}
      {imageCount > 1 && (
        <div style={{
          position: "absolute",
          bottom: "120px",
          left: "12px",
          background: "rgba(0,0,0,0.7)",
          color: "white",
          padding: "4px 10px",
          borderRadius: "12px",
          fontSize: "12px",
          fontWeight: "500",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          zIndex: 10
        }}>
          📷 {imageCount}
        </div>
      )}

      <div className="card-body">
        <h3>{property.title}</h3>
        <p className="price">₹{property.price.toLocaleString()}</p>
        <p className="location">
          {property.city}{property.area ? `, ${property.area}` : ""}
        </p>
        
        {/* Score Description */}
        {property.scoreDescription && (
          <p style={{
            fontSize: "11px",
            color: scoreColor,
            marginTop: "6px",
            fontWeight: "500",
            textTransform: "capitalize"
          }}>
            {property.scoreDescription}
          </p>
        )}
        
        <span className="tag">
          {property.type} • {property.purpose}
        </span>
      </div>
    </div>
  );
};

export default PropertyCard;
