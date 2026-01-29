import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../services/firebase";
import { API } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import "../App.css";

interface RentAgreement {
  _id: string;
  property: {
    _id: string;
    title: string;
    city?: string;
    area?: string;
    type: string;
    image?: string;
    price: number;
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
  nextPaymentDate: string;
  paymentStatus: "PAID" | "PENDING" | "OVERDUE";
  status: "ACTIVE" | "COMPLETED" | "TERMINATED";
  paymentHistory: Array<{
    amount: number;
    paidDate: string;
    paymentMonth: string;
    status: string;
  }>;
  paymentRequests?: Array<{
    amount: number;
    paymentMonth: string;
    requestedAt: string;
    status: "PENDING" | "VERIFIED" | "REJECTED";
    paymentMethod?: string;
    transactionId?: string;
    notes?: string;
    verifiedAt?: string;
    rejectionReason?: string;
  }>;
}

interface PendingProperty {
  _id: string;
  title: string;
  city?: string;
  area?: string;
  type: string;
  image?: string;
  price: number;
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
  };
}

const RentManager: React.FC = () => {
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [ownerAgreements, setOwnerAgreements] = useState<RentAgreement[]>([]);
  const [tenantAgreements, setTenantAgreements] = useState<RentAgreement[]>([]);
  const [pendingProperties, setPendingProperties] = useState<PendingProperty[]>([]);
  const [activeTab, setActiveTab] = useState<"owner" | "tenant">("owner");
  const [selectedAgreement, setSelectedAgreement] = useState<RentAgreement | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PendingProperty | null>(null);
  const [rentAmount, setRentAmount] = useState("");
  const [addingAgreement, setAddingAgreement] = useState(false);
  
  // Payment request states (tenant sends request, owner verifies)
  const [showPaymentRequestModal, setShowPaymentRequestModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [transactionId, setTransactionId] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);
  
  const currentUserEmail = auth.currentUser?.email || "";

  useEffect(() => {
    if (!auth.currentUser) {
      navigate("/login");
      return;
    }
    loadAgreements();
  }, []);

  const loadAgreements = async () => {
    setLoading(true);
    try {
      // Load owner agreements
      const ownerRes = await fetch(`${API}/rent/owner/${encodeURIComponent(currentUserEmail)}`);
      const ownerData = await ownerRes.json();
      if (Array.isArray(ownerData)) {
        setOwnerAgreements(ownerData);
      }

      // Load tenant agreements
      const tenantRes = await fetch(`${API}/rent/tenant/${encodeURIComponent(currentUserEmail)}`);
      const tenantData = await tenantRes.json();
      if (Array.isArray(tenantData)) {
        setTenantAgreements(tenantData);
      }

      // Load pending properties (booked but no agreement yet)
      const pendingRes = await fetch(`${API}/rent/pending-properties/${encodeURIComponent(currentUserEmail)}`);
      const pendingData = await pendingRes.json();
      if (Array.isArray(pendingData)) {
        setPendingProperties(pendingData);
      }

      // Set active tab based on which has data
      if (ownerData.length === 0 && tenantData.length > 0) {
        setActiveTab("tenant");
      }
    } catch (error) {
      console.error("Failed to load agreements:", error);
    } finally {
      setLoading(false);
    }
  };

  const addRentAgreement = async () => {
    if (!selectedProperty || !selectedProperty.assignedTo) {
      alert("No tenant assigned to this property");
      return;
    }

    setAddingAgreement(true);
    try {
      const res = await fetch(`${API}/rent/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: selectedProperty._id,
          ownerEmail: currentUserEmail,
          tenantEmail: selectedProperty.assignedTo.email,
          rentAmount: rentAmount ? Number(rentAmount) : selectedProperty.price,
          rentalStartDate: new Date().toISOString()
        })
      });

      if (res.ok) {
        alert("Rent agreement created successfully!");
        setShowAddModal(false);
        setSelectedProperty(null);
        setRentAmount("");
        loadAgreements();
      } else {
        const error = await res.json();
        alert(error.message || "Failed to create agreement");
      }
    } catch (error) {
      console.error("Add agreement error:", error);
      alert("Failed to create agreement");
    } finally {
      setAddingAgreement(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PAID": return "#10b981";
      case "PENDING": return "#f59e0b";
      case "OVERDUE": return "#ef4444";
      default: return "#94a3b8";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PAID": return "✅";
      case "PENDING": return "⏳";
      case "OVERDUE": return "🚨";
      default: return "📋";
    }
  };

  const getDaysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const markAsPaid = async (agreement: RentAgreement) => {
    try {
      const res = await fetch(`${API}/rent/${agreement._id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: agreement.rentAmount,
          ownerEmail: currentUserEmail,
          notes: `Payment confirmed on ${new Date().toLocaleDateString()}`
        })
      });

      if (res.ok) {
        alert("Payment marked as received!");
        loadAgreements();
        setShowPaymentModal(false);
        setSelectedAgreement(null);
      } else {
        const error = await res.json();
        alert(error.message || "Failed to mark payment");
      }
    } catch (error) {
      console.error("Mark payment error:", error);
      alert("Failed to mark payment");
    }
  };

  const terminateAgreement = async (agreement: RentAgreement) => {
    if (!confirm("Are you sure you want to terminate this rent agreement? This will make the property available again.")) {
      return;
    }

    try {
      const res = await fetch(`${API}/rent/${agreement._id}/terminate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerEmail: currentUserEmail,
          reason: "Agreement terminated by owner"
        })
      });

      if (res.ok) {
        alert("Agreement terminated. Property is now available.");
        loadAgreements();
      } else {
        const error = await res.json();
        alert(error.message || "Failed to terminate agreement");
      }
    } catch (error) {
      console.error("Terminate error:", error);
      alert("Failed to terminate agreement");
    }
  };

  // Tenant requests payment verification
  const requestPaymentVerification = async () => {
    if (!selectedAgreement) return;
    
    setSubmittingRequest(true);
    try {
      const nextPayment = new Date(selectedAgreement.nextPaymentDate);
      const paymentMonth = nextPayment.toLocaleString('default', { month: 'long', year: 'numeric' });

      const res = await fetch(`${API}/rent/${selectedAgreement._id}/request-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantEmail: currentUserEmail,
          amount: selectedAgreement.rentAmount,
          paymentMonth,
          paymentMethod,
          transactionId,
          notes: paymentNotes
        })
      });

      if (res.ok) {
        alert("Payment verification request sent to owner! They will verify and confirm your payment.");
        setShowPaymentRequestModal(false);
        setSelectedAgreement(null);
        setPaymentMethod("Cash");
        setTransactionId("");
        setPaymentNotes("");
        loadAgreements();
      } else {
        const error = await res.json();
        alert(error.message || "Failed to send payment request");
      }
    } catch (error) {
      console.error("Request payment error:", error);
      alert("Failed to send payment request");
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Owner verifies or rejects payment request
  const handleVerifyPayment = async (requestIndex: number, action: "VERIFY" | "REJECT", rejectionReason?: string) => {
    if (!selectedAgreement) return;

    try {
      const res = await fetch(`${API}/rent/${selectedAgreement._id}/verify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerEmail: currentUserEmail,
          requestIndex,
          action,
          rejectionReason
        })
      });

      if (res.ok) {
        alert(action === "VERIFY" ? "Payment verified successfully!" : "Payment request rejected.");
        setShowVerifyModal(false);
        setSelectedAgreement(null);
        loadAgreements();
      } else {
        const error = await res.json();
        alert(error.message || "Failed to process request");
      }
    } catch (error) {
      console.error("Verify payment error:", error);
      alert("Failed to process request");
    }
  };

  // Get pending payment requests count for an agreement
  const getPendingRequestsCount = (agreement: RentAgreement) => {
    return agreement.paymentRequests?.filter(r => r.status === "PENDING").length || 0;
  };

  const renderAgreementCard = (agreement: RentAgreement, isOwner: boolean) => {
    const daysUntilDue = getDaysUntilDue(agreement.nextPaymentDate);
    const isActive = agreement.status === "ACTIVE";

    return (
      <div
        key={agreement._id}
        style={{
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(45, 55, 72, 0.9) 100%)",
          border: `1px solid ${isActive ? "rgba(102, 126, 234, 0.3)" : "rgba(148, 163, 184, 0.2)"}`,
          borderRadius: "16px",
          overflow: "hidden",
          opacity: isActive ? 1 : 0.7
        }}
      >
        {/* Property Header */}
        <div style={{ display: "flex", gap: "16px", padding: "20px" }}>
          <img
            src={agreement.property?.image 
              ? `http://localhost:5000/uploads/${agreement.property.image}` 
              : "https://via.placeholder.com/120x80?text=No+Image"}
            alt={agreement.property?.title}
            style={{
              width: "120px",
              height: "80px",
              objectFit: "cover",
              borderRadius: "8px"
            }}
          />
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: "0 0 4px 0", color: "#f1f5f9", fontSize: "18px" }}>
              {agreement.property?.title || "Property"}
            </h3>
            <p style={{ margin: "0 0 8px 0", color: "#94a3b8", fontSize: "13px" }}>
              📍 {agreement.property?.city}{agreement.property?.area ? `, ${agreement.property.area}` : ""}
            </p>
            <p style={{ margin: 0, color: "#10b981", fontWeight: "700", fontSize: "20px" }}>
              ₹{agreement.rentAmount.toLocaleString()}/month
            </p>
          </div>
          
          {/* Status Badge */}
          {isActive && (
            <div style={{
              background: getStatusColor(agreement.paymentStatus),
              color: "white",
              padding: "8px 16px",
              borderRadius: "20px",
              fontSize: "14px",
              fontWeight: "600",
              height: "fit-content",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              {getStatusIcon(agreement.paymentStatus)}
              {agreement.paymentStatus}
            </div>
          )}
          
          {!isActive && (
            <div style={{
              background: "rgba(148, 163, 184, 0.3)",
              color: "#94a3b8",
              padding: "8px 16px",
              borderRadius: "20px",
              fontSize: "14px",
              fontWeight: "600",
              height: "fit-content"
            }}>
              {agreement.status}
            </div>
          )}
        </div>

        {/* Details Section */}
        <div style={{
          padding: "16px 20px",
          background: "rgba(15, 23, 42, 0.4)",
          borderTop: "1px solid rgba(102, 126, 234, 0.1)"
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "16px" }}>
            {/* Party Info */}
            <div>
              <p style={{ margin: "0 0 4px 0", color: "#64748b", fontSize: "12px" }}>
                {isOwner ? "👤 Tenant" : "🏠 Owner"}
              </p>
              <p 
                style={{ 
                  margin: 0, 
                  color: "#a5b4fc", 
                  fontWeight: "600", 
                  cursor: "pointer",
                  fontSize: "14px"
                }}
                onClick={() => navigate(`/user/${isOwner ? agreement.tenant.email : agreement.owner.email}`)}
              >
                {isOwner ? agreement.tenant?.name : agreement.owner?.name}
              </p>
            </div>

            {/* Start Date */}
            <div>
              <p style={{ margin: "0 0 4px 0", color: "#64748b", fontSize: "12px" }}>📅 Start Date</p>
              <p style={{ margin: 0, color: "#cbd5e1", fontSize: "14px" }}>
                {new Date(agreement.rentalStartDate).toLocaleDateString()}
              </p>
            </div>

            {/* Next Due */}
            {isActive && (
              <div>
                <p style={{ margin: "0 0 4px 0", color: "#64748b", fontSize: "12px" }}>⏰ Next Payment</p>
                <p style={{ 
                  margin: 0, 
                  color: daysUntilDue < 0 ? "#ef4444" : daysUntilDue <= 5 ? "#f59e0b" : "#cbd5e1",
                  fontWeight: daysUntilDue <= 5 ? "600" : "400",
                  fontSize: "14px"
                }}>
                  {new Date(agreement.nextPaymentDate).toLocaleDateString()}
                  <span style={{ fontSize: "12px", marginLeft: "6px" }}>
                    ({daysUntilDue < 0 
                      ? `${Math.abs(daysUntilDue)} days overdue` 
                      : daysUntilDue === 0 
                        ? "Due today!" 
                        : `${daysUntilDue} days left`})
                  </span>
                </p>
              </div>
            )}

            {/* Payments Made */}
            <div>
              <p style={{ margin: "0 0 4px 0", color: "#64748b", fontSize: "12px" }}>💰 Payments Made</p>
              <p style={{ margin: 0, color: "#10b981", fontSize: "14px" }}>
                {agreement.paymentHistory?.length || 0} payments
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        {isActive && (
          <div style={{
            padding: "16px 20px",
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            borderTop: "1px solid rgba(102, 126, 234, 0.1)"
          }}>
            {/* Chat Button */}
            <button
              onClick={() => navigate(`/chat/${agreement.property._id}`)}
              style={{
                padding: "10px 20px",
                background: "rgba(102, 126, 234, 0.2)",
                color: "#a5b4fc",
                border: "1px solid rgba(102, 126, 234, 0.3)",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              💬 Chat
            </button>

            {/* Owner-only actions */}
            {isOwner && (
              <>
                {agreement.paymentStatus !== "PAID" && (
                  <button
                    onClick={() => {
                      setSelectedAgreement(agreement);
                      setShowPaymentModal(true);
                    }}
                    style={{
                      padding: "10px 20px",
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: "600",
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    ✅ Mark as Paid
                  </button>
                )}
                
                <button
                  onClick={() => terminateAgreement(agreement)}
                  style={{
                    padding: "10px 20px",
                    background: "rgba(239, 68, 68, 0.2)",
                    color: "#f87171",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "14px"
                  }}
                >
                  End Agreement
                </button>

                {/* Verify Payment Requests button for owner */}
                {getPendingRequestsCount(agreement) > 0 && (
                  <button
                    onClick={() => {
                      setSelectedAgreement(agreement);
                      setShowVerifyModal(true);
                    }}
                    style={{
                      padding: "10px 20px",
                      background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: "600",
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      position: "relative"
                    }}
                  >
                    🔔 Verify Requests
                    <span style={{
                      background: "#ef4444",
                      color: "white",
                      borderRadius: "50%",
                      width: "20px",
                      height: "20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: "700"
                    }}>
                      {getPendingRequestsCount(agreement)}
                    </span>
                  </button>
                )}
              </>
            )}

            {/* Tenant-only actions */}
            {!isOwner && agreement.paymentStatus !== "PAID" && (
              <>
                {/* I Paid Button - Tenant sends request for owner to verify */}
                <button
                  onClick={() => {
                    setSelectedAgreement(agreement);
                    setShowPaymentRequestModal(true);
                  }}
                  style={{
                    padding: "10px 20px",
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  ✅ I Paid - Request Verification
                </button>

                {/* Pay Now Button - Future payment gateway */}
                <button
                  onClick={() => alert("🚀 Payment Gateway Coming Soon!\n\nWe're working on integrating secure payment options like UPI, Cards, and Net Banking. Stay tuned!")}
                  style={{
                    padding: "10px 20px",
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  💳 Pay Now (Coming Soon)
                </button>
              </>
            )}

            {/* View Property */}
            <button
              onClick={() => navigate(`/property/${agreement.property._id}`)}
              style={{
                padding: "10px 20px",
                background: "transparent",
                color: "#94a3b8",
                border: "1px solid rgba(148, 163, 184, 0.3)",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "14px"
              }}
            >
              View Property
            </button>
          </div>
        )}

        {/* Payment History (collapsed) */}
        {agreement.paymentHistory && agreement.paymentHistory.length > 0 && (
          <details style={{ 
            padding: "0 20px 16px 20px",
            borderTop: "1px solid rgba(102, 126, 234, 0.1)"
          }}>
            <summary style={{ 
              color: "#94a3b8", 
              cursor: "pointer", 
              padding: "12px 0",
              fontSize: "14px"
            }}>
              📜 Payment History ({agreement.paymentHistory.length})
            </summary>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
              {agreement.paymentHistory.map((payment, idx) => (
                <div 
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "rgba(15, 23, 42, 0.5)",
                    borderRadius: "8px",
                    fontSize: "13px"
                  }}
                >
                  <span style={{ color: "#cbd5e1" }}>{payment.paymentMonth}</span>
                  <span style={{ color: "#10b981", fontWeight: "600" }}>
                    ₹{payment.amount.toLocaleString()} ✓
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        Loading rent agreements...
      </div>
    );
  }

  const hasOwnerData = ownerAgreements.length > 0 || pendingProperties.length > 0;
  const hasTenantData = tenantAgreements.length > 0;

  return (
    <div className="page">
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h1 style={{ 
            fontSize: "42px", 
            marginBottom: "12px",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>
            🏠 Rent Manager
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "18px" }}>
            Manage your rental properties and payments
          </p>
        </div>

        {/* Tabs */}
        {(hasOwnerData || hasTenantData) && (
          <div style={{
            display: "flex",
            gap: "12px",
            marginBottom: "32px",
            borderBottom: "1px solid rgba(102, 126, 234, 0.2)",
            paddingBottom: "12px"
          }}>
            <button
              onClick={() => setActiveTab("owner")}
              style={{
                padding: "12px 28px",
                background: activeTab === "owner" 
                  ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" 
                  : "transparent",
                color: activeTab === "owner" ? "white" : "#94a3b8",
                border: activeTab === "owner" ? "none" : "1px solid rgba(102, 126, 234, 0.3)",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "15px"
              }}
            >
              👨‍💼 As Owner ({ownerAgreements.filter(a => a.status === "ACTIVE").length}){pendingProperties.length > 0 && <span style={{ color: "#f59e0b", marginLeft: "4px" }}>+{pendingProperties.length}</span>}
            </button>
            <button
              onClick={() => setActiveTab("tenant")}
              style={{
                padding: "12px 28px",
                background: activeTab === "tenant" 
                  ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" 
                  : "transparent",
                color: activeTab === "tenant" ? "white" : "#94a3b8",
                border: activeTab === "tenant" ? "none" : "1px solid rgba(102, 126, 234, 0.3)",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "15px"
              }}
            >
              👤 As Tenant ({tenantAgreements.filter(a => a.status === "ACTIVE").length})
            </button>
          </div>
        )}

        {/* Content */}
        {activeTab === "owner" && (
          <div>
            <h2 style={{ color: "#f1f5f9", marginBottom: "20px", fontSize: "24px" }}>
              👨‍💼 Rent Collection Panel
            </h2>
            {ownerAgreements.length === 0 && pendingProperties.length === 0 ? (
              <div style={{
                textAlign: "center",
                padding: "60px 20px",
                background: "linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(45, 55, 72, 0.5) 100%)",
                borderRadius: "16px",
                border: "1px dashed rgba(102, 126, 234, 0.3)"
              }}>
                <p style={{ fontSize: "48px", marginBottom: "16px" }}>🏠</p>
                <h3 style={{ color: "#f1f5f9", marginBottom: "8px" }}>No Rented Properties</h3>
                <p style={{ color: "#94a3b8", marginBottom: "20px" }}>
                  When you rent out a property, it will appear here
                </p>
                <button
                  onClick={() => navigate("/add")}
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
                  + Add Property
                </button>
              </div>
            ) : (
              <>
                {/* Active Agreements */}
                {ownerAgreements.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    {ownerAgreements.map(agreement => renderAgreementCard(agreement, true))}
                  </div>
                )}
              </>
            )}

            {/* Pending Properties Section */}
            {pendingProperties.length > 0 && (
              <div style={{ marginTop: ownerAgreements.length > 0 ? "40px" : "0" }}>
                <h3 style={{ color: "#f59e0b", marginBottom: "16px", fontSize: "20px" }}>
                  ⏳ Pending - Add to Rent Manager ({pendingProperties.length})
                </h3>
                <p style={{ color: "#94a3b8", marginBottom: "16px", fontSize: "14px" }}>
                  These properties are booked but don't have rent agreements yet. Click to add them.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
                  {pendingProperties.map(property => (
                    <div
                      key={property._id}
                      onClick={() => {
                        setSelectedProperty(property);
                        setRentAmount(property.price.toString());
                        setShowAddModal(true);
                      }}
                      style={{
                        background: "linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(30, 41, 59, 0.9) 100%)",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        borderRadius: "12px",
                        padding: "16px",
                        cursor: "pointer",
                        transition: "all 0.3s ease"
                      }}
                    >
                      <div style={{ display: "flex", gap: "12px" }}>
                        <img
                          src={property.image 
                            ? `http://localhost:5000/uploads/${property.image}` 
                            : "https://via.placeholder.com/80x60?text=No+Image"}
                          alt={property.title}
                          style={{
                            width: "80px",
                            height: "60px",
                            objectFit: "cover",
                            borderRadius: "6px"
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: "0 0 4px 0", color: "#f1f5f9", fontSize: "15px" }}>
                            {property.title}
                          </h4>
                          <p style={{ margin: "0 0 4px 0", color: "#94a3b8", fontSize: "12px" }}>
                            📍 {property.city}
                          </p>
                          <p style={{ margin: 0, color: "#10b981", fontWeight: "600", fontSize: "14px" }}>
                            ₹{property.price.toLocaleString()}/month
                          </p>
                        </div>
                      </div>
                      {property.assignedTo && (
                        <div style={{
                          marginTop: "10px",
                          padding: "8px",
                          background: "rgba(15, 23, 42, 0.5)",
                          borderRadius: "6px",
                          fontSize: "12px"
                        }}>
                          <span style={{ color: "#64748b" }}>Tenant: </span>
                          <span style={{ color: "#a5b4fc" }}>{property.assignedTo.name}</span>
                        </div>
                      )}
                      <button
                        style={{
                          width: "100%",
                          marginTop: "12px",
                          padding: "10px",
                          background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontWeight: "600",
                          fontSize: "13px"
                        }}
                      >
                        + Add to Rent Manager
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "tenant" && (
          <div>
            <h2 style={{ color: "#f1f5f9", marginBottom: "20px", fontSize: "24px" }}>
              👤 My Rentals
            </h2>
            {tenantAgreements.length === 0 ? (
              <div style={{
                textAlign: "center",
                padding: "60px 20px",
                background: "linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(45, 55, 72, 0.5) 100%)",
                borderRadius: "16px",
                border: "1px dashed rgba(102, 126, 234, 0.3)"
              }}>
                <p style={{ fontSize: "48px", marginBottom: "16px" }}>🔍</p>
                <h3 style={{ color: "#f1f5f9", marginBottom: "8px" }}>No Active Rentals</h3>
                <p style={{ color: "#94a3b8", marginBottom: "20px" }}>
                  Find your perfect property and start renting
                </p>
                <button
                  onClick={() => navigate("/explore")}
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
                  Explore Properties
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {tenantAgreements.map(agreement => renderAgreementCard(agreement, false))}
              </div>
            )}
          </div>
        )}

        {/* No Data at all */}
        {!hasOwnerData && !hasTenantData && (
          <div style={{
            textAlign: "center",
            padding: "80px 20px",
            background: "linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(45, 55, 72, 0.5) 100%)",
            borderRadius: "16px",
            border: "1px dashed rgba(102, 126, 234, 0.3)"
          }}>
            <p style={{ fontSize: "64px", marginBottom: "20px" }}>🏠</p>
            <h2 style={{ color: "#f1f5f9", marginBottom: "12px" }}>No Rent Agreements Yet</h2>
            <p style={{ color: "#94a3b8", marginBottom: "28px", maxWidth: "500px", margin: "0 auto 28px" }}>
              When you rent a property or rent out your property to someone, 
              your agreements will appear here for easy management.
            </p>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
              <button
                onClick={() => navigate("/explore")}
                style={{
                  padding: "14px 32px",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "15px"
                }}
              >
                Find Properties
              </button>
              <button
                onClick={() => navigate("/add")}
                style={{
                  padding: "14px 32px",
                  background: "transparent",
                  color: "#a5b4fc",
                  border: "1px solid rgba(102, 126, 234, 0.5)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "15px"
                }}
              >
                List Property
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payment Confirmation Modal */}
      {showPaymentModal && selectedAgreement && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "linear-gradient(135deg, rgba(30, 41, 59, 0.98) 0%, rgba(45, 55, 72, 0.98) 100%)",
            border: "1px solid rgba(102, 126, 234, 0.3)",
            borderRadius: "16px",
            padding: "32px",
            maxWidth: "450px",
            width: "90%"
          }}>
            <h3 style={{ color: "#f1f5f9", marginBottom: "20px", fontSize: "22px" }}>
              ✅ Confirm Payment Received
            </h3>
            
            <div style={{
              background: "rgba(15, 23, 42, 0.5)",
              padding: "16px",
              borderRadius: "10px",
              marginBottom: "24px"
            }}>
              <p style={{ margin: "0 0 8px 0", color: "#94a3b8", fontSize: "14px" }}>
                Property: <span style={{ color: "#f1f5f9" }}>{selectedAgreement.property?.title}</span>
              </p>
              <p style={{ margin: "0 0 8px 0", color: "#94a3b8", fontSize: "14px" }}>
                Tenant: <span style={{ color: "#f1f5f9" }}>{selectedAgreement.tenant?.name}</span>
              </p>
              <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>
                Amount: <span style={{ color: "#10b981", fontWeight: "700", fontSize: "18px" }}>
                  ₹{selectedAgreement.rentAmount.toLocaleString()}
                </span>
              </p>
            </div>

            <p style={{ color: "#94a3b8", marginBottom: "24px", fontSize: "14px" }}>
              Marking this payment will update the next due date and notify the tenant.
            </p>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedAgreement(null);
                }}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "transparent",
                  color: "#94a3b8",
                  border: "1px solid rgba(148, 163, 184, 0.3)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600"
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => markAsPaid(selectedAgreement)}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600"
                }}
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Rent Agreement Modal */}
      {showAddModal && selectedProperty && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "linear-gradient(135deg, rgba(30, 41, 59, 0.98) 0%, rgba(45, 55, 72, 0.98) 100%)",
            border: "1px solid rgba(102, 126, 234, 0.3)",
            borderRadius: "16px",
            padding: "32px",
            maxWidth: "500px",
            width: "90%"
          }}>
            <h3 style={{ color: "#f1f5f9", marginBottom: "20px", fontSize: "22px" }}>
              ➕ Add Rent Agreement
            </h3>
            
            {/* Property Info */}
            <div style={{
              background: "rgba(15, 23, 42, 0.5)",
              padding: "16px",
              borderRadius: "10px",
              marginBottom: "20px",
              display: "flex",
              gap: "12px"
            }}>
              <img
                src={selectedProperty.image 
                  ? `http://localhost:5000/uploads/${selectedProperty.image}` 
                  : "https://via.placeholder.com/80x60?text=No+Image"}
                alt={selectedProperty.title}
                style={{
                  width: "80px",
                  height: "60px",
                  objectFit: "cover",
                  borderRadius: "6px"
                }}
              />
              <div>
                <p style={{ margin: "0 0 4px 0", color: "#f1f5f9", fontWeight: "600" }}>
                  {selectedProperty.title}
                </p>
                <p style={{ margin: "0 0 4px 0", color: "#94a3b8", fontSize: "13px" }}>
                  📍 {selectedProperty.city}{selectedProperty.area ? `, ${selectedProperty.area}` : ""}
                </p>
                <p style={{ margin: 0, color: "#94a3b8", fontSize: "13px" }}>
                  Tenant: <span style={{ color: "#a5b4fc" }}>{selectedProperty.assignedTo?.name || "Unknown"}</span>
                </p>
              </div>
            </div>

            {/* Rent Amount Input */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px", color: "#cbd5e1", fontWeight: "500" }}>
                Monthly Rent Amount (₹)
              </label>
              <input
                type="number"
                value={rentAmount}
                onChange={(e) => setRentAmount(e.target.value)}
                placeholder="Enter rent amount"
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(102, 126, 234, 0.3)",
                  borderRadius: "8px",
                  color: "#f1f5f9",
                  fontSize: "16px"
                }}
              />
            </div>

            <p style={{ color: "#94a3b8", marginBottom: "20px", fontSize: "14px" }}>
              This will create a rent agreement starting today. The first payment will be due in 30 days.
            </p>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedProperty(null);
                  setRentAmount("");
                }}
                disabled={addingAgreement}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "transparent",
                  color: "#94a3b8",
                  border: "1px solid rgba(148, 163, 184, 0.3)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600"
                }}
              >
                Cancel
              </button>
              <button
                onClick={addRentAgreement}
                disabled={addingAgreement || !rentAmount}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: addingAgreement || !rentAmount 
                    ? "rgba(102, 126, 234, 0.3)"
                    : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: addingAgreement || !rentAmount ? "not-allowed" : "pointer",
                  fontWeight: "600"
                }}
              >
                {addingAgreement ? "Creating..." : "Create Agreement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Request Modal (Tenant sends request for owner to verify) */}
      {showPaymentRequestModal && selectedAgreement && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "linear-gradient(135deg, rgba(30, 41, 59, 0.98) 0%, rgba(45, 55, 72, 0.98) 100%)",
            border: "1px solid rgba(102, 126, 234, 0.3)",
            borderRadius: "16px",
            padding: "32px",
            maxWidth: "500px",
            width: "90%"
          }}>
            <h3 style={{ color: "#f1f5f9", marginBottom: "20px", fontSize: "22px" }}>
              💰 Request Payment Verification
            </h3>
            
            <div style={{
              background: "rgba(15, 23, 42, 0.5)",
              padding: "16px",
              borderRadius: "10px",
              marginBottom: "20px"
            }}>
              <p style={{ margin: "0 0 8px 0", color: "#94a3b8", fontSize: "14px" }}>
                Property: <span style={{ color: "#f1f5f9" }}>{selectedAgreement.property?.title}</span>
              </p>
              <p style={{ margin: "0 0 8px 0", color: "#94a3b8", fontSize: "14px" }}>
                Owner: <span style={{ color: "#f1f5f9" }}>{selectedAgreement.owner?.name}</span>
              </p>
              <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>
                Amount: <span style={{ color: "#10b981", fontWeight: "700", fontSize: "18px" }}>
                  ₹{selectedAgreement.rentAmount.toLocaleString()}
                </span>
              </p>
            </div>

            {/* Payment Method */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", color: "#cbd5e1", fontWeight: "500" }}>
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(102, 126, 234, 0.3)",
                  borderRadius: "8px",
                  color: "#f1f5f9",
                  fontSize: "15px"
                }}
              >
                <option value="Cash">💵 Cash</option>
                <option value="UPI">📱 UPI</option>
                <option value="Bank Transfer">🏦 Bank Transfer</option>
                <option value="Cheque">📝 Cheque</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Transaction ID (optional) */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", color: "#cbd5e1", fontWeight: "500" }}>
                Transaction ID / Reference (Optional)
              </label>
              <input
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="e.g., UPI123456789"
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(102, 126, 234, 0.3)",
                  borderRadius: "8px",
                  color: "#f1f5f9",
                  fontSize: "15px"
                }}
              />
            </div>

            {/* Notes */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px", color: "#cbd5e1", fontWeight: "500" }}>
                Notes (Optional)
              </label>
              <textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Any additional details..."
                rows={2}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(102, 126, 234, 0.3)",
                  borderRadius: "8px",
                  color: "#f1f5f9",
                  fontSize: "15px",
                  resize: "vertical"
                }}
              />
            </div>

            <p style={{ color: "#f59e0b", marginBottom: "20px", fontSize: "13px", background: "rgba(245, 158, 11, 0.1)", padding: "12px", borderRadius: "8px" }}>
              ⚠️ By clicking "Send Request", you confirm that you have made this payment. The owner will verify and confirm.
            </p>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => {
                  setShowPaymentRequestModal(false);
                  setSelectedAgreement(null);
                  setPaymentMethod("Cash");
                  setTransactionId("");
                  setPaymentNotes("");
                }}
                disabled={submittingRequest}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "transparent",
                  color: "#94a3b8",
                  border: "1px solid rgba(148, 163, 184, 0.3)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600"
                }}
              >
                Cancel
              </button>
              <button
                onClick={requestPaymentVerification}
                disabled={submittingRequest}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: submittingRequest 
                    ? "rgba(16, 185, 129, 0.3)"
                    : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: submittingRequest ? "not-allowed" : "pointer",
                  fontWeight: "600"
                }}
              >
                {submittingRequest ? "Sending..." : "✅ Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verify Payment Modal (Owner verifies tenant's request) */}
      {showVerifyModal && selectedAgreement && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          overflowY: "auto",
          padding: "20px"
        }}>
          <div style={{
            background: "linear-gradient(135deg, rgba(30, 41, 59, 0.98) 0%, rgba(45, 55, 72, 0.98) 100%)",
            border: "1px solid rgba(102, 126, 234, 0.3)",
            borderRadius: "16px",
            padding: "32px",
            maxWidth: "550px",
            width: "90%",
            maxHeight: "85vh",
            overflowY: "auto"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ color: "#f1f5f9", margin: 0, fontSize: "22px" }}>
                🔔 Verify Payment Requests
              </h3>
              <button
                onClick={() => {
                  setShowVerifyModal(false);
                  setSelectedAgreement(null);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "24px",
                  cursor: "pointer"
                }}
              >
                ×
              </button>
            </div>

            <div style={{
              background: "rgba(15, 23, 42, 0.5)",
              padding: "12px 16px",
              borderRadius: "10px",
              marginBottom: "20px"
            }}>
              <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>
                Property: <span style={{ color: "#f1f5f9" }}>{selectedAgreement.property?.title}</span>
                {" • "}
                Tenant: <span style={{ color: "#a5b4fc" }}>{selectedAgreement.tenant?.name}</span>
              </p>
            </div>

            {/* Pending Requests */}
            {selectedAgreement.paymentRequests?.filter(r => r.status === "PENDING").length === 0 ? (
              <p style={{ color: "#94a3b8", textAlign: "center", padding: "40px 0" }}>
                No pending payment requests
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {selectedAgreement.paymentRequests
                  ?.map((request, index) => ({ request, index }))
                  .filter(({ request }) => request.status === "PENDING")
                  .map(({ request, index }) => (
                    <div
                      key={index}
                      style={{
                        background: "rgba(15, 23, 42, 0.5)",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        borderRadius: "12px",
                        padding: "20px"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                        <span style={{ color: "#f1f5f9", fontWeight: "600" }}>
                          {request.paymentMonth}
                        </span>
                        <span style={{ color: "#10b981", fontWeight: "700", fontSize: "18px" }}>
                          ₹{request.amount?.toLocaleString()}
                        </span>
                      </div>
                      
                      <div style={{ marginBottom: "16px", fontSize: "13px" }}>
                        <p style={{ margin: "0 0 4px 0", color: "#94a3b8" }}>
                          💳 Method: <span style={{ color: "#cbd5e1" }}>{request.paymentMethod || "Cash"}</span>
                        </p>
                        {request.transactionId && (
                          <p style={{ margin: "0 0 4px 0", color: "#94a3b8" }}>
                            🔢 Txn ID: <span style={{ color: "#cbd5e1" }}>{request.transactionId}</span>
                          </p>
                        )}
                        {request.notes && (
                          <p style={{ margin: "0 0 4px 0", color: "#94a3b8" }}>
                            📝 Notes: <span style={{ color: "#cbd5e1" }}>{request.notes}</span>
                          </p>
                        )}
                        <p style={{ margin: 0, color: "#64748b" }}>
                          📅 Requested: {new Date(request.requestedAt).toLocaleString()}
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          onClick={() => handleVerifyPayment(index, "VERIFY")}
                          style={{
                            flex: 1,
                            padding: "10px 16px",
                            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontWeight: "600",
                            fontSize: "14px"
                          }}
                        >
                          ✅ Verify
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt("Reason for rejection (optional):");
                            handleVerifyPayment(index, "REJECT", reason || undefined);
                          }}
                          style={{
                            flex: 1,
                            padding: "10px 16px",
                            background: "rgba(239, 68, 68, 0.2)",
                            color: "#f87171",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontWeight: "600",
                            fontSize: "14px"
                          }}
                        >
                          ❌ Reject
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RentManager;
