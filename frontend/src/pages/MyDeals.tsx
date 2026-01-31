import { useEffect, useState } from "react";
import { API, getImageUrl } from "../services/api";
import { auth } from "../services/firebase";
import { Link } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

type Property = {
  _id: string;
  title: string;
  price: number;
  city: string;
  area: string;
  image?: string;
  images?: string[];
  status: string;
  purpose: string;
  type: string;
  description?: string;
  amenities?: string[];
  bhk?: number;
  sqft?: number;
  furnishing?: string;
  latitude?: number;
  longitude?: number;
  assignedTo?: any;
  owner?: {
    _id: string;
    name: string;
    email: string;
  };
};

interface RatingState {
  [propertyId: string]: {
    hasRated: boolean;
    rating: number;
    review: string;
  };
}

interface EditForm {
  title: string;
  type: string;
  purpose: string;
  price: string;
  city: string;
  area: string;
  description: string;
  amenities: string;
  bhk: string;
  sqft: string;
  furnishing: string;
}

const MyDeals = () => {
  const { darkMode } = useTheme();
  const [listed, setListed] = useState<Property[]>([]);
  const [deals, setDeals] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Rating states
  const [ratingStates, setRatingStates] = useState<RatingState>({});
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Property | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);

  // Edit property states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    title: "",
    type: "FLAT",
    purpose: "RENT",
    price: "",
    city: "",
    area: "",
    description: "",
    amenities: "",
    bhk: "",
    sqft: "",
    furnishing: "Unfurnished"
  });
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    const loadDeals = async () => {
      if (!auth.currentUser?.email) {
        setLoading(false);
        return;
      }

      try {
        // 🔍 get Mongo user
        const userRes = await fetch(
          `${API}/users/email/${auth.currentUser.email}`
        );
        
        if (!userRes.ok) {
          console.error("Failed to fetch user:", userRes.status);
          setLoading(false);
          return;
        }
        
        const user = await userRes.json();

        if (!user?._id) {
          setLoading(false);
          return;
        }

        // 📌 My listed properties (all statuses)
        const listedRes = await fetch(
          `${API}/properties/owner/${user._id}`
        );
        const listedData = await listedRes.json();

        // 📦 All properties to find assigned deals
        const allRes = await fetch(`${API}/properties/all`);
        const all = await allRes.json();

        const myDeals = all.filter(
          (p: any) =>
            p.assignedTo &&
            (p.assignedTo === user._id || p.assignedTo?._id === user._id) &&
            (p.status === "BOOKED" || p.status === "SOLD")
        );

        setListed(listedData);
        setDeals(myDeals);

        // Check rating status for each deal
        for (const deal of myDeals) {
          if (deal.owner?.email) {
            checkRatingStatus(deal._id, deal.owner.email);
          }
        }
      } catch (err) {
        console.error("MyDeals load error", err);
      } finally {
        setLoading(false);
      }
    };

    loadDeals();
  }, []);

  const checkRatingStatus = async (propertyId: string, ownerEmail: string) => {
    if (!auth.currentUser?.email) return;
    
    try {
      const res = await fetch(
        `${API}/users/rating/check?raterEmail=${auth.currentUser.email}&rateeEmail=${ownerEmail}&propertyId=${propertyId}`
      );
      if (res.ok) {
        const data = await res.json();
        setRatingStates(prev => ({
          ...prev,
          [propertyId]: {
            hasRated: data.hasRated,
            rating: data.rating || 0,
            review: data.review || ""
          }
        }));
      }
    } catch (err) {
      console.error("Failed to check rating status:", err);
    }
  };

  const openRatingModal = (deal: Property) => {
    setSelectedDeal(deal);
    setRatingValue(0);
    setHoverRating(0);
    setReviewText("");
    setShowRatingModal(true);
  };

  const submitRating = async () => {
    if (!selectedDeal || !auth.currentUser?.email || ratingValue === 0) {
      alert("Please select a rating");
      return;
    }

    setSubmittingRating(true);
    try {
      const res = await fetch(`${API}/users/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rateeEmail: selectedDeal.owner?.email,
          raterEmail: auth.currentUser.email,
          rating: ratingValue,
          propertyId: selectedDeal._id,
          review: reviewText,
          ratingType: "TENANT_TO_OWNER"
        })
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Rating submitted successfully! ${selectedDeal.owner?.name}'s new rating: ${data.newRating}/5`);
        
        // Update local state
        setRatingStates(prev => ({
          ...prev,
          [selectedDeal._id]: {
            hasRated: true,
            rating: ratingValue,
            review: reviewText
          }
        }));
        
        setShowRatingModal(false);
      } else {
        const error = await res.json();
        alert(error.message || "Failed to submit rating");
      }
    } catch (err) {
      console.error("Rating submission error:", err);
      alert("Failed to submit rating");
    } finally {
      setSubmittingRating(false);
    }
  };

  // Edit property functions
  const openEditModal = (property: Property) => {
    setEditingProperty(property);
    setEditForm({
      title: property.title || "",
      type: property.type || "FLAT",
      purpose: property.purpose || "RENT",
      price: String(property.price || ""),
      city: property.city || "",
      area: property.area || "",
      description: property.description || "",
      amenities: property.amenities?.join(", ") || "",
      bhk: String(property.bhk || ""),
      sqft: String(property.sqft || ""),
      furnishing: property.furnishing || "Unfurnished"
    });
    setShowEditModal(true);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const savePropertyEdit = async () => {
    if (!editingProperty || !auth.currentUser?.email) return;

    if (!editForm.title.trim() || !editForm.price) {
      alert("Please fill in title and price");
      return;
    }

    setSavingEdit(true);
    try {
      const formData = new FormData();
      formData.append("title", editForm.title);
      formData.append("type", editForm.type);
      formData.append("purpose", editForm.purpose);
      formData.append("price", editForm.price);
      formData.append("city", editForm.city);
      formData.append("area", editForm.area);
      formData.append("description", editForm.description);
      formData.append("amenities", editForm.amenities.split(",").map(a => a.trim()).filter(Boolean).join(","));
      formData.append("bhk", editForm.bhk);
      formData.append("sqft", editForm.sqft);
      formData.append("furnishing", editForm.furnishing);
      formData.append("ownerEmail", auth.currentUser.email);

      const res = await fetch(`${API}/properties/${editingProperty._id}`, {
        method: "PUT",
        body: formData
      });

      if (res.ok) {
        const updated = await res.json();
        // Update listed array
        setListed(prev => prev.map(p => p._id === updated._id ? { ...p, ...updated } : p));
        setShowEditModal(false);
        alert("Property updated successfully!");
      } else {
        const error = await res.json();
        alert(error.message || "Failed to update property");
      }
    } catch (err) {
      console.error("Update error:", err);
      alert("Failed to update property");
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) return <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>Loading your deals...</div>;

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
          💼 My Deals
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "16px" }}>
          Manage your listings and active deals
        </p>
      </div>

      {/* ================= MY LISTINGS ================= */}

      <div style={{ marginBottom: "60px" }}>
        <h2 style={{ marginBottom: "8px" }}>My Listed Properties</h2>
        <p style={{ color: "#94a3b8", marginBottom: "28px", fontSize: "15px" }}>
          {listed.length} property {listed.length === 1 ? "listing" : "listings"}
        </p>

        {listed.length === 0 && (
          <div style={{
            padding: "60px 40px",
            textAlign: "center",
            background: "linear-gradient(135deg, #1e293b 0%, #2d3748 100%)",
            borderRadius: "16px",
            border: "1px solid rgba(226, 232, 240, 0.1)"
          }}>
            <p style={{ color: "#cbd5e1", marginBottom: "20px" }}>No listings yet</p>
            <Link to="/add" style={{
              display: "inline-block",
              padding: "12px 28px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              textDecoration: "none",
              borderRadius: "8px",
              fontWeight: "600"
            }}>
              Create Your First Listing
            </Link>
          </div>
        )}

        <div className="deal-grid">
          {listed.map(p => (
            <div key={p._id} style={{
              background: darkMode ? "linear-gradient(135deg, #1e293b 0%, #2d3748 100%)" : "white",
              borderRadius: "12px",
              overflow: "hidden",
              border: darkMode ? "1px solid rgba(226, 232, 240, 0.1)" : "1px solid #e5e7eb",
              transition: "all 0.3s ease"
            }}>
              <Link to={`/property/${p._id}`} style={{ textDecoration: "none", color: "inherit" }}>
                {p.image && (
                  <img
                    src={getImageUrl(p.image)}
                    alt={p.title}
                    style={{ width: "100%", height: "160px", objectFit: "cover" }}
                  />
                )}
                <div style={{ padding: "16px" }}>
                  <h3 style={{ fontSize: "16px", marginBottom: "6px", color: darkMode ? "#f1f5f9" : "#1f2937" }}>{p.title}</h3>
                  <p style={{ color: "#667eea", fontSize: "16px", fontWeight: "700", margin: "0 0 8px 0" }}>₹{p.price?.toLocaleString()}</p>
                  <span className={`status ${p.status.toLowerCase()}`}>
                    {p.status}
                  </span>
                </div>
              </Link>
              
              {/* Edit & Delete Actions */}}
              <div style={{
                padding: "12px 16px",
                borderTop: darkMode ? "1px solid rgba(226, 232, 240, 0.1)" : "1px solid #e5e7eb",
                background: darkMode ? "rgba(0,0,0,0.2)" : "#f9fafb",
                display: "flex",
                gap: "8px"
              }}>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    openEditModal(p);
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px"
                  }}
                >
                  ✏️ Edit
                </button>
                <Link
                  to={`/property/${p._id}`}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    background: darkMode ? "rgba(100,116,139,0.3)" : "#e5e7eb",
                    color: darkMode ? "#e2e8f0" : "#374151",
                    textDecoration: "none",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: "600",
                    textAlign: "center"
                  }}
                >
                  👁️ View
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ================= MY BOOKINGS ================= */}

      <div>
        <h2 style={{ marginBottom: "8px" }}>Booked / Bought By Me</h2>
        <p style={{ color: "#94a3b8", marginBottom: "28px", fontSize: "15px" }}>
          {deals.length} active {deals.length === 1 ? "deal" : "deals"}
        </p>

        {deals.length === 0 && (
          <div style={{
            padding: "60px 40px",
            textAlign: "center",
            background: darkMode ? "linear-gradient(135deg, #1e293b 0%, #2d3748 100%)" : "white",
            borderRadius: "16px",
            border: darkMode ? "1px solid rgba(226, 232, 240, 0.1)" : "1px solid #e5e7eb"
          }}>
            <p style={{ color: darkMode ? "#cbd5e1" : "#6b7280" }}>No active deals yet</p>
          </div>
        )}

        <div className="deal-grid">
          {deals.map(p => (
            <div key={p._id} style={{
              background: darkMode ? "linear-gradient(135deg, #1e293b 0%, #2d3748 100%)" : "white",
              borderRadius: "12px",
              overflow: "hidden",
              border: darkMode ? "1px solid rgba(226, 232, 240, 0.1)" : "1px solid #e5e7eb",
              transition: "all 0.3s ease"
            }}>
              <Link to={`/property/${p._id}`} style={{ textDecoration: "none", color: "inherit" }}>
                {p.image && (
                  <img
                    src={getImageUrl(p.image)}
                    alt={p.title}
                    style={{ width: "100%", height: "160px", objectFit: "cover" }}
                  />
                )}
                <div style={{ padding: "16px" }}>
                  <h3 style={{ fontSize: "16px", marginBottom: "6px", color: darkMode ? "#f1f5f9" : "#1f2937" }}>{p.title}</h3>
                  <p style={{ color: "#667eea", fontSize: "16px", fontWeight: "700", margin: "0 0 8px 0" }}>₹{p.price?.toLocaleString()}</p>
                  <span className={`status ${p.status.toLowerCase()}`}>
                    {p.status}
                  </span>
                </div>
              </Link>
              
              {/* Rating Section */}
              {p.owner && (
                <div style={{
                  padding: "12px 16px",
                  borderTop: darkMode ? "1px solid rgba(226, 232, 240, 0.1)" : "1px solid #e5e7eb",
                  background: darkMode ? "rgba(0,0,0,0.2)" : "#f9fafb"
                }}>
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "8px"
                  }}>
                    <span style={{ fontSize: "13px", color: darkMode ? "#9ca3af" : "#6b7280" }}>
                      Owner: {p.owner.name}
                    </span>
                    
                    {ratingStates[p._id]?.hasRated ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star} style={{ 
                            color: star <= (ratingStates[p._id]?.rating || 0) ? "#f59e0b" : "#374151",
                            fontSize: "14px"
                          }}>★</span>
                        ))}
                        <span style={{ fontSize: "12px", color: "#10b981", marginLeft: "4px" }}>Rated</span>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          openRatingModal(p);
                        }}
                        style={{
                          padding: "6px 12px",
                          background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "600",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        ⭐ Rate Owner
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Rating Modal */}
      {showRatingModal && selectedDeal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px"
        }}>
          <div style={{
            background: darkMode ? "#1e293b" : "white",
            borderRadius: "16px",
            padding: "32px",
            maxWidth: "450px",
            width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
          }}>
            <h3 style={{
              fontSize: "20px",
              fontWeight: "700",
              color: darkMode ? "#f1f5f9" : "#1f2937",
              marginBottom: "8px",
              textAlign: "center"
            }}>
              Rate Your Experience
            </h3>
            <p style={{
              fontSize: "14px",
              color: darkMode ? "#9ca3af" : "#6b7280",
              marginBottom: "24px",
              textAlign: "center"
            }}>
              How was your deal with {selectedDeal.owner?.name}?
            </p>

            {/* Property Info */}
            <div style={{
              padding: "12px",
              background: darkMode ? "rgba(0,0,0,0.3)" : "#f9fafb",
              borderRadius: "8px",
              marginBottom: "24px"
            }}>
              <p style={{ fontSize: "14px", color: darkMode ? "#f1f5f9" : "#1f2937", fontWeight: "600" }}>
                {selectedDeal.title}
              </p>
              <p style={{ fontSize: "13px", color: darkMode ? "#9ca3af" : "#6b7280" }}>
                {selectedDeal.city}{selectedDeal.area ? `, ${selectedDeal.area}` : ""}
              </p>
            </div>

            {/* Star Rating */}
            <div style={{
              display: "flex",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "24px"
            }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRatingValue(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px",
                    fontSize: "36px",
                    color: star <= (hoverRating || ratingValue) ? "#f59e0b" : (darkMode ? "#374151" : "#e5e7eb"),
                    transition: "all 0.2s ease",
                    transform: star <= (hoverRating || ratingValue) ? "scale(1.1)" : "scale(1)"
                  }}
                >
                  ★
                </button>
              ))}
            </div>

            {/* Rating Labels */}
            <p style={{
              textAlign: "center",
              fontSize: "14px",
              color: ratingValue > 0 ? "#f59e0b" : (darkMode ? "#6b7280" : "#9ca3af"),
              marginBottom: "20px",
              fontWeight: "600"
            }}>
              {ratingValue === 0 && "Click to rate"}
              {ratingValue === 1 && "Poor"}
              {ratingValue === 2 && "Fair"}
              {ratingValue === 3 && "Good"}
              {ratingValue === 4 && "Very Good"}
              {ratingValue === 5 && "Excellent"}
            </p>

            {/* Review Text */}
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Write a review (optional)..."
              maxLength={500}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: darkMode ? "1px solid #374151" : "1px solid #e5e7eb",
                background: darkMode ? "rgba(0,0,0,0.3)" : "#f9fafb",
                color: darkMode ? "#f1f5f9" : "#1f2937",
                fontSize: "14px",
                minHeight: "100px",
                resize: "vertical",
                marginBottom: "8px"
              }}
            />
            <p style={{ fontSize: "12px", color: darkMode ? "#6b7280" : "#9ca3af", marginBottom: "24px", textAlign: "right" }}>
              {reviewText.length}/500
            </p>

            {/* Actions */}
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setShowRatingModal(false)}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: darkMode ? "#374151" : "#e5e7eb",
                  color: darkMode ? "#f1f5f9" : "#1f2937",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitRating}
                disabled={ratingValue === 0 || submittingRating}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: ratingValue > 0 ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" : "#6b7280",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: ratingValue > 0 ? "pointer" : "not-allowed",
                  opacity: submittingRating ? 0.7 : 1
                }}
              >
                {submittingRating ? "Submitting..." : "Submit Rating"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= EDIT PROPERTY MODAL ================= */}
      {showEditModal && editingProperty && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px"
        }}>
          <div style={{
            background: darkMode ? "#1e293b" : "white",
            borderRadius: "16px",
            padding: "32px",
            maxWidth: "600px",
            width: "100%",
            maxHeight: "90vh",
            overflowY: "auto",
            border: darkMode ? "1px solid rgba(226, 232, 240, 0.1)" : "1px solid #e5e7eb"
          }}>
            <h2 style={{ 
              fontSize: "24px", 
              marginBottom: "24px",
              color: darkMode ? "#f1f5f9" : "#1f2937"
            }}>
              ✏️ Edit Property
            </h2>

            {/* Title */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontWeight: "500", color: darkMode ? "#e2e8f0" : "#374151" }}>
                Title *
              </label>
              <input
                type="text"
                name="title"
                value={editForm.title}
                onChange={handleEditChange}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: darkMode ? "1px solid rgba(226, 232, 240, 0.2)" : "1px solid #d1d5db",
                  background: darkMode ? "#0f172a" : "#f9fafb",
                  color: darkMode ? "#f1f5f9" : "#1f2937",
                  fontSize: "14px"
                }}
              />
            </div>

            {/* Type & Purpose */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "500", color: darkMode ? "#e2e8f0" : "#374151" }}>
                  Property Type
                </label>
                <select
                  name="type"
                  value={editForm.type}
                  onChange={handleEditChange}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    border: darkMode ? "1px solid rgba(226, 232, 240, 0.2)" : "1px solid #d1d5db",
                    background: darkMode ? "#0f172a" : "#f9fafb",
                    color: darkMode ? "#f1f5f9" : "#1f2937",
                    fontSize: "14px"
                  }}
                >
                  <option value="ROOM">Room</option>
                  <option value="PG">PG</option>
                  <option value="HOSTEL">Hostel</option>
                  <option value="FLAT">Flat</option>
                  <option value="HOME">Home</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "500", color: darkMode ? "#e2e8f0" : "#374151" }}>
                  Purpose
                </label>
                <select
                  name="purpose"
                  value={editForm.purpose}
                  onChange={handleEditChange}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    border: darkMode ? "1px solid rgba(226, 232, 240, 0.2)" : "1px solid #d1d5db",
                    background: darkMode ? "#0f172a" : "#f9fafb",
                    color: darkMode ? "#f1f5f9" : "#1f2937",
                    fontSize: "14px"
                  }}
                >
                  <option value="RENT">For Rent</option>
                  <option value="SALE">For Sale</option>
                </select>
              </div>
            </div>

            {/* Price & BHK */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "500", color: darkMode ? "#e2e8f0" : "#374151" }}>
                  Price (₹) *
                </label>
                <input
                  type="number"
                  name="price"
                  value={editForm.price}
                  onChange={handleEditChange}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    border: darkMode ? "1px solid rgba(226, 232, 240, 0.2)" : "1px solid #d1d5db",
                    background: darkMode ? "#0f172a" : "#f9fafb",
                    color: darkMode ? "#f1f5f9" : "#1f2937",
                    fontSize: "14px"
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "500", color: darkMode ? "#e2e8f0" : "#374151" }}>
                  BHK
                </label>
                <input
                  type="number"
                  name="bhk"
                  value={editForm.bhk}
                  onChange={handleEditChange}
                  placeholder="e.g., 2"
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    border: darkMode ? "1px solid rgba(226, 232, 240, 0.2)" : "1px solid #d1d5db",
                    background: darkMode ? "#0f172a" : "#f9fafb",
                    color: darkMode ? "#f1f5f9" : "#1f2937",
                    fontSize: "14px"
                  }}
                />
              </div>
            </div>

            {/* City & Area */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "500", color: darkMode ? "#e2e8f0" : "#374151" }}>
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  value={editForm.city}
                  onChange={handleEditChange}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    border: darkMode ? "1px solid rgba(226, 232, 240, 0.2)" : "1px solid #d1d5db",
                    background: darkMode ? "#0f172a" : "#f9fafb",
                    color: darkMode ? "#f1f5f9" : "#1f2937",
                    fontSize: "14px"
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "500", color: darkMode ? "#e2e8f0" : "#374151" }}>
                  Area/Locality
                </label>
                <input
                  type="text"
                  name="area"
                  value={editForm.area}
                  onChange={handleEditChange}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    border: darkMode ? "1px solid rgba(226, 232, 240, 0.2)" : "1px solid #d1d5db",
                    background: darkMode ? "#0f172a" : "#f9fafb",
                    color: darkMode ? "#f1f5f9" : "#1f2937",
                    fontSize: "14px"
                  }}
                />
              </div>
            </div>

            {/* Sqft & Furnishing */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "500", color: darkMode ? "#e2e8f0" : "#374151" }}>
                  Area (sq.ft)
                </label>
                <input
                  type="number"
                  name="sqft"
                  value={editForm.sqft}
                  onChange={handleEditChange}
                  placeholder="e.g., 1200"
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    border: darkMode ? "1px solid rgba(226, 232, 240, 0.2)" : "1px solid #d1d5db",
                    background: darkMode ? "#0f172a" : "#f9fafb",
                    color: darkMode ? "#f1f5f9" : "#1f2937",
                    fontSize: "14px"
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "500", color: darkMode ? "#e2e8f0" : "#374151" }}>
                  Furnishing
                </label>
                <select
                  name="furnishing"
                  value={editForm.furnishing}
                  onChange={handleEditChange}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    border: darkMode ? "1px solid rgba(226, 232, 240, 0.2)" : "1px solid #d1d5db",
                    background: darkMode ? "#0f172a" : "#f9fafb",
                    color: darkMode ? "#f1f5f9" : "#1f2937",
                    fontSize: "14px"
                  }}
                >
                  <option value="Unfurnished">Unfurnished</option>
                  <option value="Semi Furnished">Semi Furnished</option>
                  <option value="Fully Furnished">Fully Furnished</option>
                </select>
              </div>
            </div>

            {/* Amenities */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontWeight: "500", color: darkMode ? "#e2e8f0" : "#374151" }}>
                Amenities (comma separated)
              </label>
              <input
                type="text"
                name="amenities"
                value={editForm.amenities}
                onChange={handleEditChange}
                placeholder="AC, Parking, WiFi, Gym"
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: darkMode ? "1px solid rgba(226, 232, 240, 0.2)" : "1px solid #d1d5db",
                  background: darkMode ? "#0f172a" : "#f9fafb",
                  color: darkMode ? "#f1f5f9" : "#1f2937",
                  fontSize: "14px"
                }}
              />
            </div>

            {/* Description */}
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontWeight: "500", color: darkMode ? "#e2e8f0" : "#374151" }}>
                Description
              </label>
              <textarea
                name="description"
                value={editForm.description}
                onChange={handleEditChange}
                rows={4}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: darkMode ? "1px solid rgba(226, 232, 240, 0.2)" : "1px solid #d1d5db",
                  background: darkMode ? "#0f172a" : "#f9fafb",
                  color: darkMode ? "#f1f5f9" : "#1f2937",
                  fontSize: "14px",
                  resize: "vertical"
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setShowEditModal(false)}
                style={{
                  flex: 1,
                  padding: "14px",
                  background: darkMode ? "#374151" : "#e5e7eb",
                  color: darkMode ? "#f1f5f9" : "#1f2937",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={savePropertyEdit}
                disabled={savingEdit}
                style={{
                  flex: 1,
                  padding: "14px",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: savingEdit ? "not-allowed" : "pointer",
                  opacity: savingEdit ? 0.7 : 1
                }}
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyDeals;
