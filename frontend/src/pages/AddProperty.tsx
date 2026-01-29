import { useState } from "react";
import { API } from "../services/api";
import { auth } from "../services/firebase";
import { useNavigate } from "react-router-dom";
import MapPicker from "../components/MapPicker";

const AddProperty = () => {
  const navigate = useNavigate();

  // Shared input styling
  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    background: "#1a1a1a",
    border: "1px solid #404040",
    borderRadius: "8px",
    color: "#ffffff",
    fontSize: "14px",
    outline: "none",
    transition: "all 0.2s ease",
    boxSizing: "border-box" as const,
    fontFamily: "inherit"
  };

  const [form, setForm] = useState({
    title: "",
    type: "",
    purpose: "",
    price: "",
    city: "",
    area: "",
    latitude: "",
    longitude: "",
    amenities: "",
    description: ""
  });

  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length + images.length > 5) {
      alert("You can upload maximum 5 images");
      return;
    }
    
    const newImages = [...images, ...files].slice(0, 5);
    setImages(newImages);
    
    // Create preview URLs
    const previews = newImages.map(file => URL.createObjectURL(file));
    setImagePreviews(previews);
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    
    // Revoke old URL and create new previews
    URL.revokeObjectURL(imagePreviews[index]);
    const previews = newImages.map(file => URL.createObjectURL(file));
    setImagePreviews(previews);
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const submit = async () => {
    if (!auth.currentUser) {
      alert("Please login first");
      return;
    }

    if (!form.type || !form.purpose) {
      alert("Select property type and purpose");
      return;
    }

    if (!form.title.trim()) {
      alert("Please enter property title");
      return;
    }

    if (!form.city.trim() || !form.area.trim()) {
      alert("Please enter city and area");
      return;
    }

    if (!form.latitude || !form.longitude) {
      alert("Please select location on the map");
      return;
    }

    if (!form.price) {
      alert("Please enter property price");
      return;
    }

    if (images.length === 0) {
      alert("Upload at least one image");
      return;
    }

    setLoading(true);

    const formData = new FormData();

    // Append form fields except amenities (handled separately)
    Object.entries(form).forEach(([key, value]) => {
      if (key !== "amenities") {
        formData.append(key, value);
      }
    });

    // Clean amenities - send as comma-separated string
    const cleanAmenities = form.amenities
      .split(",")
      .map(a => a.trim())
      .filter(Boolean)
      .join(",");
    formData.append("amenities", cleanAmenities);

    // attach owner uid
    formData.append("ownerEmail", auth.currentUser.email!);
    
    // Append all images
    images.forEach(img => {
      formData.append("images", img);
    });

    try {
      const res = await fetch(`${API}/properties`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) throw new Error("Failed");

      alert("Property added successfully!");
      navigate("/explore");
    } catch (err) {
      alert("Failed to add property");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{
      minHeight: "100vh",
      padding: "40px 20px",
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start"
    }}>
      <div style={{
        width: "100%",
        maxWidth: "700px"
      }}>
        {/* Page Header */}
        <div style={{
          marginBottom: "40px",
          paddingBottom: "24px",
          borderBottom: "2px solid rgba(99, 102, 241, 0.3)"
        }}>
          <h1 style={{
            fontSize: "32px",
            marginBottom: "8px",
            fontWeight: "700",
            color: "#ffffff"
          }}>
            🏠 Add Property
          </h1>
          <p style={{ color: "#888888", fontSize: "14px", margin: "0" }}>
            List your property and reach potential buyers or renters
          </p>
        </div>

        {/* Form Container */}
        <div style={{
          background: "linear-gradient(135deg, #2a2a2a 0%, #1f1f1f 100%)",
          border: "1px solid rgba(99, 102, 241, 0.3)",
          borderRadius: "12px",
          padding: "40px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)"
        }}>
        {/* Title */}
        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", marginBottom: "8px", color: "#cbd5e1", fontWeight: "600", fontSize: "13px" }}>
            Title
          </label>
          <input 
            name="title" 
            value={form.title}
            placeholder="e.g., Modern 2BHK in Downtown" 
            onChange={handleChange}
            style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.background = "#0a0a0a"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#404040"; e.currentTarget.style.background = "#1a1a1a"; }}
          />
        </div>

        {/* Type and Purpose */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "8px", color: "#cbd5e1", fontWeight: "600", fontSize: "13px" }}>
              Property Type
            </label>
            <select name="type" value={form.type} onChange={handleChange} style={{...inputStyle, cursor: "pointer"}}>
              <option value="">Select Type</option>
              <option value="ROOM">Room</option>
              <option value="PG">PG</option>
              <option value="HOSTEL">Hostel</option>
              <option value="FLAT">Flat</option>
              <option value="HOME">Home</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", color: "#cbd5e1", fontWeight: "600", fontSize: "13px" }}>
              Purpose
            </label>
            <select name="purpose" value={form.purpose} onChange={handleChange} style={{...inputStyle, cursor: "pointer"}}>
              <option value="">Select Purpose</option>
              <option value="RENT">Rent</option>
              <option value="SALE">Buy</option>
            </select>
          </div>
        </div>

        {/* Price */}
        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", marginBottom: "8px", color: "#cbd5e1", fontWeight: "600", fontSize: "13px" }}>
            Price (₹)
          </label>
          <input 
            name="price" 
            value={form.price}
            placeholder="e.g., 50000" 
            type="number" 
            onChange={handleChange}
            style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.background = "#0a0a0a"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#404040"; e.currentTarget.style.background = "#1a1a1a"; }}
          />
        </div>

        {/* Location with Map Picker */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "8px", color: "#cbd5e1", fontWeight: "600", fontSize: "13px" }}>
              City
            </label>
            <input 
              name="city" 
              value={form.city}
              placeholder="e.g., Mumbai" 
              onChange={handleChange}
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.background = "#0a0a0a"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#404040"; e.currentTarget.style.background = "#1a1a1a"; }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "8px", color: "#cbd5e1", fontWeight: "600", fontSize: "13px" }}>
              Area
            </label>
            <input 
              name="area" 
              value={form.area}
              placeholder="e.g., Bandra" 
              onChange={handleChange}
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.background = "#0a0a0a"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#404040"; e.currentTarget.style.background = "#1a1a1a"; }}
            />
          </div>
        </div>

        {/* Map Picker for Location */}
        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", marginBottom: "12px", color: "#cbd5e1", fontWeight: "600", fontSize: "13px" }}>
            📍 Set Exact Property Location
          </label>
          <MapPicker
            latitude={form.latitude}
            longitude={form.longitude}
            onLocationChange={(lat, lon) => {
              setForm({ ...form, latitude: lat.toString(), longitude: lon.toString() });
            }}
          />
          {form.latitude && form.longitude && (
            <p style={{ marginTop: "10px", fontSize: "12px", color: "#888", textAlign: "center" }}>
              ✓ Coordinates: {Number(form.latitude).toFixed(4)}, {Number(form.longitude).toFixed(4)}
            </p>
          )}
        </div>

        {/* Amenities */}
        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", marginBottom: "8px", color: "#cbd5e1", fontWeight: "600", fontSize: "13px" }}>
            Amenities
          </label>
          <input
            name="amenities"
            value={form.amenities}
            placeholder="e.g., wifi, parking, food (comma-separated)"
            onChange={handleChange}
            style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.background = "#0a0a0a"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#404040"; e.currentTarget.style.background = "#1a1a1a"; }}
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", marginBottom: "8px", color: "#cbd5e1", fontWeight: "600", fontSize: "13px" }}>
            Description
          </label>
          <textarea
            name="description"
            value={form.description}
            placeholder="Describe your property in detail..."
            onChange={handleChange}
            style={{ 
              ...inputStyle,
              minHeight: "120px",
              resize: "vertical"
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.background = "#0a0a0a"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#404040"; e.currentTarget.style.background = "#1a1a1a"; }}
          />
        </div>

        {/* Image Upload */}
        <div style={{ marginBottom: "32px" }}>
          <label style={{ display: "block", marginBottom: "8px", color: "#cbd5e1", fontWeight: "600", fontSize: "13px" }}>
            Property Images ({images.length}/5)
          </label>
          
          {/* Image Previews Grid */}
          {imagePreviews.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
              gap: "12px",
              marginBottom: "16px"
            }}>
              {imagePreviews.map((preview, index) => (
                <div 
                  key={index}
                  style={{
                    position: "relative",
                    aspectRatio: "1",
                    borderRadius: "8px",
                    overflow: "hidden",
                    border: index === 0 ? "2px solid #6366f1" : "1px solid #404040"
                  }}
                >
                  <img 
                    src={preview} 
                    alt={`Preview ${index + 1}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover"
                    }}
                  />
                  {index === 0 && (
                    <span style={{
                      position: "absolute",
                      top: "4px",
                      left: "4px",
                      background: "#6366f1",
                      color: "white",
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontWeight: "600"
                    }}>
                      Main
                    </span>
                  )}
                  <button
                    onClick={() => removeImage(index)}
                    style={{
                      position: "absolute",
                      top: "4px",
                      right: "4px",
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: "rgba(239, 68, 68, 0.9)",
                      color: "white",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      lineHeight: 1
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Upload Button */}
          {images.length < 5 && (
            <label style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
              background: "#1a1a1a",
              border: "2px dashed #404040",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.background = "#0a0a0a"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#404040"; e.currentTarget.style.background = "#1a1a1a"; }}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                style={{ display: "none" }}
              />
              <span style={{ fontSize: "32px", marginBottom: "8px" }}>📷</span>
              <span style={{ color: "#cbd5e1", fontSize: "14px", fontWeight: "500" }}>
                Click to upload images
              </span>
              <span style={{ color: "#888", fontSize: "12px", marginTop: "4px" }}>
                {images.length === 0 ? "Add up to 5 images" : `Add ${5 - images.length} more image${5 - images.length !== 1 ? 's' : ''}`}
              </span>
            </label>
          )}
        </div>

        {/* Submit Button */}
        <button 
          onClick={submit} 
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px 20px",
            background: loading ? "#555555" : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontWeight: "700",
            fontSize: "15px",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.3s ease",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            opacity: loading ? 0.7 : 1
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 8px 16px rgba(99, 102, 241, 0.4)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          {loading ? "Saving Property..." : "🚀 Save Property"}
        </button>
      </div>
    </div>
    </div>
  );
};

export default AddProperty;
