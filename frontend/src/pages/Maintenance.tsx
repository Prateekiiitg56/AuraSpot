import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API } from "../services/api";
import { auth } from "../services/firebase";
import { useTheme } from "../context/ThemeContext";

type MaintenanceRequest = {
  _id: string;
  property: {
    _id: string;
    title: string;
    city: string;
    area: string;
    image: string;
  };
  tenant: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  owner: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  category: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  assignedWorker?: {
    name: string;
    phone: string;
    specialty: string;
  };
  estimatedCost?: number;
  actualCost?: number;
  scheduledDate?: string;
  resolvedDate?: string;
  updates: Array<{
    message: string;
    by: { name: string; email: string };
    role: string;
    createdAt: string;
  }>;
  rating?: number;
  ratingFeedback?: string;
  createdAt: string;
};

const MAINTENANCE_CATEGORIES = [
  { value: "PLUMBING", label: "🚿 Plumbing", icon: "🚿" },
  { value: "ELECTRICAL", label: "💡 Electrical", icon: "💡" },
  { value: "APPLIANCE", label: "🔧 Appliance", icon: "🔧" },
  { value: "HVAC", label: "❄️ HVAC/AC", icon: "❄️" },
  { value: "STRUCTURAL", label: "🏗️ Structural", icon: "🏗️" },
  { value: "PEST_CONTROL", label: "🐛 Pest Control", icon: "🐛" },
  { value: "CLEANING", label: "🧹 Cleaning", icon: "🧹" },
  { value: "OTHER", label: "📋 Other", icon: "📋" }
];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low", color: "#10b981" },
  { value: "MEDIUM", label: "Medium", color: "#f59e0b" },
  { value: "HIGH", label: "High", color: "#ef4444" },
  { value: "URGENT", label: "Urgent", color: "#dc2626" }
];

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending", color: "#f59e0b" },
  { value: "APPROVED", label: "Approved", color: "#3b82f6" },
  { value: "IN_PROGRESS", label: "In Progress", color: "#8b5cf6" },
  { value: "RESOLVED", label: "Resolved", color: "#10b981" },
  { value: "REJECTED", label: "Rejected", color: "#ef4444" }
];

const Maintenance = () => {
  const { darkMode } = useTheme();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"tenant" | "owner">("tenant");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    workerName: "",
    workerPhone: "",
    workerSpecialty: "",
    scheduledDate: "",
    estimatedCost: ""
  });
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const currentUser = auth.currentUser;
  const isDark = darkMode;

  const loadRequests = async () => {
    if (!currentUser?.email) return;

    setLoading(true);
    try {
      const endpoint = activeTab === "tenant" 
        ? `${API}/maintenance/tenant/${currentUser.email}`
        : `${API}/maintenance/owner/${currentUser.email}`;
      
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error("Failed loading maintenance requests", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [currentUser, activeTab]);

  const getStatusColor = (status: string) => {
    return STATUS_OPTIONS.find(s => s.value === status)?.color || "#6b7280";
  };

  const getPriorityColor = (priority: string) => {
    return PRIORITY_OPTIONS.find(p => p.value === priority)?.color || "#6b7280";
  };

  const getCategoryIcon = (category: string) => {
    return MAINTENANCE_CATEGORIES.find(c => c.value === category)?.icon || "📋";
  };

  const filteredRequests = (statusFilter === "ALL" 
    ? requests 
    : requests.filter(r => r.status === statusFilter))
    .filter(r => r.property !== null); // Filter out requests with deleted properties

  const updateStatus = async (requestId: string, newStatus: string) => {
    if (!currentUser?.email) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/maintenance/${requestId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          ownerEmail: currentUser.email
        })
      });

      if (res.ok) {
        await loadRequests();
        if (selectedRequest?._id === requestId) {
          const updated = await res.json();
          setSelectedRequest(updated);
        }
      }
    } catch (err) {
      console.error("Failed to update status", err);
      alert("Failed to update status");
    } finally {
      setSubmitting(false);
    }
  };

  const assignWorker = async () => {
    if (!currentUser?.email || !selectedRequest) return;

    if (!assignForm.workerName || !assignForm.workerPhone) {
      alert("Please fill in worker name and phone");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/maintenance/${selectedRequest._id}/assign-worker`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerEmail: currentUser.email,
          workerName: assignForm.workerName,
          workerPhone: assignForm.workerPhone,
          workerSpecialty: assignForm.workerSpecialty,
          scheduledDate: assignForm.scheduledDate || undefined,
          estimatedCost: assignForm.estimatedCost ? parseFloat(assignForm.estimatedCost) : undefined
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setSelectedRequest(updated);
        setShowAssignModal(false);
        setAssignForm({
          workerName: "",
          workerPhone: "",
          workerSpecialty: "",
          scheduledDate: "",
          estimatedCost: ""
        });
        await loadRequests();
        alert("Worker assigned successfully!");
      }
    } catch (err) {
      console.error("Failed to assign worker", err);
      alert("Failed to assign worker");
    } finally {
      setSubmitting(false);
    }
  };

  const addComment = async () => {
    if (!currentUser?.email || !selectedRequest || !comment.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/maintenance/${selectedRequest._id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: currentUser.email,
          message: comment,
          role: activeTab === "owner" ? "OWNER" : "TENANT"
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setSelectedRequest(updated);
        setComment("");
      }
    } catch (err) {
      console.error("Failed to add comment", err);
      alert("Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="page" style={{ textAlign: "center", padding: "60px 20px" }}>
        <h2 style={{ color: isDark ? "#f1f5f9" : "#1e293b" }}>Please login to view maintenance requests</h2>
        <Link to="/login" style={{ color: "#667eea" }}>Go to Login</Link>
      </div>
    );
  }

  return (
    <div className="page" style={{ padding: "40px 20px", minHeight: "100vh" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{
            fontSize: "32px",
            margin: "0 0 8px 0",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>
            🔧 Maintenance Requests
          </h1>
          <p style={{ color: isDark ? "#94a3b8" : "#64748b", margin: 0 }}>
            Track and manage property maintenance issues
          </p>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex",
          gap: "8px",
          marginBottom: "24px",
          borderBottom: `1px solid ${isDark ? "rgba(102, 126, 234, 0.2)" : "rgba(0,0,0,0.1)"}`
        }}>
          <button
            onClick={() => setActiveTab("tenant")}
            style={{
              padding: "12px 24px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "tenant" ? "2px solid #667eea" : "2px solid transparent",
              color: activeTab === "tenant" ? "#667eea" : isDark ? "#94a3b8" : "#64748b",
              fontWeight: "600",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            My Requests (Tenant)
          </button>
          <button
            onClick={() => setActiveTab("owner")}
            style={{
              padding: "12px 24px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "owner" ? "2px solid #667eea" : "2px solid transparent",
              color: activeTab === "owner" ? "#667eea" : isDark ? "#94a3b8" : "#64748b",
              fontWeight: "600",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            Property Requests (Owner)
          </button>
        </div>

        {/* Status Filters */}
        <div style={{
          display: "flex",
          gap: "8px",
          marginBottom: "24px",
          flexWrap: "wrap"
        }}>
          <button
            onClick={() => setStatusFilter("ALL")}
            style={{
              padding: "8px 16px",
              background: statusFilter === "ALL" 
                ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                : isDark ? "rgba(30, 41, 59, 0.8)" : "rgba(241, 245, 249, 0.8)",
              border: statusFilter === "ALL" ? "none" : `1px solid ${isDark ? "rgba(102, 126, 234, 0.2)" : "rgba(0,0,0,0.1)"}`,
              borderRadius: "20px",
              color: statusFilter === "ALL" ? "white" : isDark ? "#cbd5e1" : "#475569",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "500"
            }}
          >
            All
          </button>
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status.value}
              onClick={() => setStatusFilter(status.value)}
              style={{
                padding: "8px 16px",
                background: statusFilter === status.value 
                  ? `${status.color}30`
                  : isDark ? "rgba(30, 41, 59, 0.8)" : "rgba(241, 245, 249, 0.8)",
                border: statusFilter === status.value 
                  ? `1px solid ${status.color}`
                  : `1px solid ${isDark ? "rgba(102, 126, 234, 0.2)" : "rgba(0,0,0,0.1)"}`,
                borderRadius: "20px",
                color: statusFilter === status.value ? status.color : isDark ? "#cbd5e1" : "#475569",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: "500"
              }}
            >
              {status.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: isDark ? "#94a3b8" : "#64748b" }}>
            Loading maintenance requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            background: isDark ? "rgba(30, 41, 59, 0.5)" : "rgba(241, 245, 249, 0.5)",
            borderRadius: "16px",
            border: `1px solid ${isDark ? "rgba(102, 126, 234, 0.2)" : "rgba(0,0,0,0.1)"}`
          }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔧</div>
            <h3 style={{ color: isDark ? "#f1f5f9" : "#1e293b", marginBottom: "8px" }}>
              No maintenance requests
            </h3>
            <p style={{ color: isDark ? "#94a3b8" : "#64748b", margin: 0 }}>
              {activeTab === "tenant" 
                ? "You haven't submitted any maintenance requests yet"
                : "No maintenance requests for your properties"}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
            {/* Request List */}
            <div style={{ flex: "1", minWidth: "300px", maxWidth: selectedRequest ? "400px" : "100%" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {filteredRequests.map((req) => (
                  <div
                    key={req._id}
                    onClick={() => setSelectedRequest(req)}
                    style={{
                      padding: "20px",
                      background: selectedRequest?._id === req._id
                        ? "linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)"
                        : isDark ? "rgba(30, 41, 59, 0.8)" : "rgba(255, 255, 255, 0.9)",
                      border: selectedRequest?._id === req._id
                        ? "1px solid #667eea"
                        : `1px solid ${isDark ? "rgba(102, 126, 234, 0.2)" : "rgba(0,0,0,0.1)"}`,
                      borderRadius: "12px",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "24px" }}>{getCategoryIcon(req.category)}</span>
                        <div>
                          <h3 style={{ margin: 0, fontSize: "16px", color: isDark ? "#f1f5f9" : "#1e293b" }}>
                            {req.title}
                          </h3>
                          <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b" }}>
                            {req.property?.title || "Property"} • {req.property?.city || "Unknown"}
                          </p>
                        </div>
                      </div>
                      <span style={{
                        padding: "4px 10px",
                        background: `${getStatusColor(req.status)}20`,
                        color: getStatusColor(req.status),
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: "600"
                      }}>
                        {req.status.replace("_", " ")}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{
                        padding: "4px 10px",
                        background: `${getPriorityColor(req.priority)}20`,
                        color: getPriorityColor(req.priority),
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: "600"
                      }}>
                        {req.priority}
                      </span>
                      <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: "12px" }}>
                        {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                      {activeTab === "owner" && req.tenant && (
                        <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: "12px" }}>
                          By: {req.tenant.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Request Details */}
            {selectedRequest && (
              <div style={{
                flex: "1",
                minWidth: "400px",
                padding: "24px",
                background: isDark ? "rgba(30, 41, 59, 0.8)" : "rgba(255, 255, 255, 0.9)",
                border: `1px solid ${isDark ? "rgba(102, 126, 234, 0.2)" : "rgba(0,0,0,0.1)"}`,
                borderRadius: "16px",
                position: "sticky",
                top: "20px",
                maxHeight: "calc(100vh - 200px)",
                overflowY: "auto"
              }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <span style={{ fontSize: "28px" }}>{getCategoryIcon(selectedRequest.category)}</span>
                      <h2 style={{ margin: 0, fontSize: "20px", color: isDark ? "#f1f5f9" : "#1e293b" }}>
                        {selectedRequest.title}
                      </h2>
                    </div>
                    {selectedRequest.property && (
                      <Link 
                        to={`/property/${selectedRequest.property._id}`}
                        style={{ color: "#667eea", fontSize: "14px", textDecoration: "none" }}
                      >
                        {selectedRequest.property.title} →
                      </Link>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedRequest(null)}
                    style={{
                      background: "none",
                      border: "none",
                      color: isDark ? "#94a3b8" : "#64748b",
                      fontSize: "20px",
                      cursor: "pointer"
                    }}
                  >
                    ×
                  </button>
                </div>

                {/* Status & Priority */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
                  <span style={{
                    padding: "6px 14px",
                    background: `${getStatusColor(selectedRequest.status)}20`,
                    color: getStatusColor(selectedRequest.status),
                    borderRadius: "20px",
                    fontSize: "13px",
                    fontWeight: "600"
                  }}>
                    {selectedRequest.status.replace("_", " ")}
                  </span>
                  <span style={{
                    padding: "6px 14px",
                    background: `${getPriorityColor(selectedRequest.priority)}20`,
                    color: getPriorityColor(selectedRequest.priority),
                    borderRadius: "20px",
                    fontSize: "13px",
                    fontWeight: "600"
                  }}>
                    {selectedRequest.priority} Priority
                  </span>
                  <span style={{
                    padding: "6px 14px",
                    background: isDark ? "rgba(102, 126, 234, 0.1)" : "rgba(102, 126, 234, 0.1)",
                    color: "#667eea",
                    borderRadius: "20px",
                    fontSize: "13px"
                  }}>
                    {selectedRequest.category.replace("_", " ")}
                  </span>
                </div>

                {/* Description */}
                <div style={{ marginBottom: "20px" }}>
                  <h4 style={{ color: isDark ? "#cbd5e1" : "#475569", fontSize: "13px", marginBottom: "8px" }}>Description</h4>
                  <p style={{ color: isDark ? "#f1f5f9" : "#1e293b", margin: 0, lineHeight: "1.6" }}>
                    {selectedRequest.description}
                  </p>
                </div>

                {/* Contact Info */}
                <div style={{
                  padding: "16px",
                  background: isDark ? "rgba(15, 23, 42, 0.5)" : "rgba(241, 245, 249, 0.5)",
                  borderRadius: "8px",
                  marginBottom: "20px"
                }}>
                  <h4 style={{ color: isDark ? "#cbd5e1" : "#475569", fontSize: "13px", marginBottom: "12px" }}>
                    {activeTab === "owner" ? "Tenant" : "Owner"} Contact
                  </h4>
                  <div style={{ color: isDark ? "#f1f5f9" : "#1e293b", fontSize: "14px" }}>
                    <p style={{ margin: "0 0 4px 0" }}>
                      <strong>{activeTab === "owner" ? selectedRequest.tenant?.name || "Unknown" : selectedRequest.owner?.name || "Unknown"}</strong>
                    </p>
                    <p style={{ margin: "0", color: isDark ? "#94a3b8" : "#64748b" }}>
                      {activeTab === "owner" ? selectedRequest.tenant?.email || "N/A" : selectedRequest.owner?.email || "N/A"}
                    </p>
                    {(activeTab === "owner" ? selectedRequest.tenant?.phone : selectedRequest.owner?.phone) && (
                      <p style={{ margin: "4px 0 0 0", color: isDark ? "#94a3b8" : "#64748b" }}>
                        📞 {activeTab === "owner" ? selectedRequest.tenant?.phone : selectedRequest.owner?.phone}
                      </p>
                    )}
                  </div>
                </div>

                {/* Assigned Worker */}
                {selectedRequest.assignedWorker?.name && (
                  <div style={{
                    padding: "16px",
                    background: "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    borderRadius: "8px",
                    marginBottom: "20px"
                  }}>
                    <h4 style={{ color: "#10b981", fontSize: "13px", marginBottom: "12px" }}>👷 Assigned Worker</h4>
                    <div style={{ color: isDark ? "#f1f5f9" : "#1e293b", fontSize: "14px" }}>
                      <p style={{ margin: "0 0 4px 0" }}>
                        <strong>{selectedRequest.assignedWorker.name}</strong>
                        {selectedRequest.assignedWorker.specialty && (
                          <span style={{ color: isDark ? "#94a3b8" : "#64748b" }}> • {selectedRequest.assignedWorker.specialty}</span>
                        )}
                      </p>
                      <p style={{ margin: "0", color: isDark ? "#94a3b8" : "#64748b" }}>
                        📞 {selectedRequest.assignedWorker.phone}
                      </p>
                      {selectedRequest.scheduledDate && (
                        <p style={{ margin: "8px 0 0 0", color: "#667eea" }}>
                          📅 Scheduled: {new Date(selectedRequest.scheduledDate).toLocaleDateString()}
                        </p>
                      )}
                      {selectedRequest.estimatedCost && (
                        <p style={{ margin: "4px 0 0 0", color: isDark ? "#94a3b8" : "#64748b" }}>
                          💰 Estimated Cost: ₹{selectedRequest.estimatedCost}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Owner Actions */}
                {activeTab === "owner" && selectedRequest.status !== "RESOLVED" && selectedRequest.status !== "REJECTED" && (
                  <div style={{ marginBottom: "20px" }}>
                    <h4 style={{ color: isDark ? "#cbd5e1" : "#475569", fontSize: "13px", marginBottom: "12px" }}>Actions</h4>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {selectedRequest.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => updateStatus(selectedRequest._id, "APPROVED")}
                            disabled={submitting}
                            style={{
                              padding: "10px 16px",
                              background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                              border: "none",
                              borderRadius: "8px",
                              color: "white",
                              cursor: "pointer",
                              fontSize: "13px",
                              fontWeight: "600"
                            }}
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => updateStatus(selectedRequest._id, "REJECTED")}
                            disabled={submitting}
                            style={{
                              padding: "10px 16px",
                              background: "rgba(239, 68, 68, 0.2)",
                              border: "1px solid #ef4444",
                              borderRadius: "8px",
                              color: "#ef4444",
                              cursor: "pointer",
                              fontSize: "13px",
                              fontWeight: "600"
                            }}
                          >
                            ✗ Reject
                          </button>
                        </>
                      )}
                      {(selectedRequest.status === "APPROVED" || selectedRequest.status === "PENDING") && (
                        <button
                          onClick={() => setShowAssignModal(true)}
                          style={{
                            padding: "10px 16px",
                            background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                            border: "none",
                            borderRadius: "8px",
                            color: "white",
                            cursor: "pointer",
                            fontSize: "13px",
                            fontWeight: "600"
                          }}
                        >
                          👷 Assign Worker
                        </button>
                      )}
                      {selectedRequest.status === "IN_PROGRESS" && (
                        <button
                          onClick={() => updateStatus(selectedRequest._id, "RESOLVED")}
                          disabled={submitting}
                          style={{
                            padding: "10px 16px",
                            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                            border: "none",
                            borderRadius: "8px",
                            color: "white",
                            cursor: "pointer",
                            fontSize: "13px",
                            fontWeight: "600"
                          }}
                        >
                          ✓ Mark Resolved
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Updates Timeline */}
                {selectedRequest.updates && selectedRequest.updates.length > 0 && (
                  <div style={{ marginBottom: "20px" }}>
                    <h4 style={{ color: isDark ? "#cbd5e1" : "#475569", fontSize: "13px", marginBottom: "12px" }}>Updates</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {selectedRequest.updates.map((update, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: "12px",
                            background: isDark ? "rgba(15, 23, 42, 0.5)" : "rgba(241, 245, 249, 0.5)",
                            borderRadius: "8px",
                            borderLeft: `3px solid ${update.role === "OWNER" ? "#667eea" : "#10b981"}`
                          }}
                        >
                          <p style={{ margin: "0 0 4px 0", color: isDark ? "#f1f5f9" : "#1e293b", fontSize: "14px" }}>
                            {update.message}
                          </p>
                          <div style={{ display: "flex", gap: "8px", color: isDark ? "#94a3b8" : "#64748b", fontSize: "12px" }}>
                            <span>{update.by?.name || update.role}</span>
                            <span>•</span>
                            <span>{new Date(update.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Comment */}
                {selectedRequest.status !== "RESOLVED" && selectedRequest.status !== "REJECTED" && (
                  <div>
                    <h4 style={{ color: isDark ? "#cbd5e1" : "#475569", fontSize: "13px", marginBottom: "8px" }}>Add Comment</h4>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        placeholder="Type a comment..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        style={{
                          flex: 1,
                          padding: "12px",
                          background: isDark ? "rgba(15, 23, 42, 0.6)" : "rgba(241, 245, 249, 0.6)",
                          border: `1px solid ${isDark ? "rgba(102, 126, 234, 0.3)" : "rgba(0,0,0,0.1)"}`,
                          borderRadius: "8px",
                          color: isDark ? "#f1f5f9" : "#1e293b",
                          outline: "none",
                          fontSize: "14px"
                        }}
                      />
                      <button
                        onClick={addComment}
                        disabled={submitting || !comment.trim()}
                        style={{
                          padding: "12px 20px",
                          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                          border: "none",
                          borderRadius: "8px",
                          color: "white",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: "600"
                        }}
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Assign Worker Modal */}
      {showAssignModal && (
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
          padding: "20px"
        }}>
          <div style={{
            background: isDark ? "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)" : "white",
            borderRadius: "16px",
            padding: "32px",
            maxWidth: "450px",
            width: "100%",
            border: `1px solid ${isDark ? "rgba(102, 126, 234, 0.2)" : "rgba(0,0,0,0.1)"}`
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h3 style={{ margin: 0, color: isDark ? "#f1f5f9" : "#1e293b", fontSize: "20px" }}>👷 Assign Worker</h3>
              <button
                onClick={() => setShowAssignModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: isDark ? "#94a3b8" : "#64748b",
                  fontSize: "24px",
                  cursor: "pointer"
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "6px", color: isDark ? "#cbd5e1" : "#475569", fontSize: "14px" }}>
                  Worker Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g., John Smith"
                  value={assignForm.workerName}
                  onChange={(e) => setAssignForm(prev => ({ ...prev, workerName: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: isDark ? "rgba(15, 23, 42, 0.6)" : "rgba(241, 245, 249, 0.6)",
                    border: `1px solid ${isDark ? "rgba(102, 126, 234, 0.3)" : "rgba(0,0,0,0.1)"}`,
                    borderRadius: "8px",
                    color: isDark ? "#f1f5f9" : "#1e293b",
                    outline: "none",
                    fontSize: "14px"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "6px", color: isDark ? "#cbd5e1" : "#475569", fontSize: "14px" }}>
                  Phone Number *
                </label>
                <input
                  type="tel"
                  placeholder="e.g., +91 9876543210"
                  value={assignForm.workerPhone}
                  onChange={(e) => setAssignForm(prev => ({ ...prev, workerPhone: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: isDark ? "rgba(15, 23, 42, 0.6)" : "rgba(241, 245, 249, 0.6)",
                    border: `1px solid ${isDark ? "rgba(102, 126, 234, 0.3)" : "rgba(0,0,0,0.1)"}`,
                    borderRadius: "8px",
                    color: isDark ? "#f1f5f9" : "#1e293b",
                    outline: "none",
                    fontSize: "14px"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "6px", color: isDark ? "#cbd5e1" : "#475569", fontSize: "14px" }}>
                  Specialty
                </label>
                <input
                  type="text"
                  placeholder="e.g., Plumber, Electrician"
                  value={assignForm.workerSpecialty}
                  onChange={(e) => setAssignForm(prev => ({ ...prev, workerSpecialty: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: isDark ? "rgba(15, 23, 42, 0.6)" : "rgba(241, 245, 249, 0.6)",
                    border: `1px solid ${isDark ? "rgba(102, 126, 234, 0.3)" : "rgba(0,0,0,0.1)"}`,
                    borderRadius: "8px",
                    color: isDark ? "#f1f5f9" : "#1e293b",
                    outline: "none",
                    fontSize: "14px"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "6px", color: isDark ? "#cbd5e1" : "#475569", fontSize: "14px" }}>
                  Scheduled Date
                </label>
                <input
                  type="date"
                  value={assignForm.scheduledDate}
                  onChange={(e) => setAssignForm(prev => ({ ...prev, scheduledDate: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: isDark ? "rgba(15, 23, 42, 0.6)" : "rgba(241, 245, 249, 0.6)",
                    border: `1px solid ${isDark ? "rgba(102, 126, 234, 0.3)" : "rgba(0,0,0,0.1)"}`,
                    borderRadius: "8px",
                    color: isDark ? "#f1f5f9" : "#1e293b",
                    outline: "none",
                    fontSize: "14px"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "6px", color: isDark ? "#cbd5e1" : "#475569", fontSize: "14px" }}>
                  Estimated Cost (₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g., 500"
                  value={assignForm.estimatedCost}
                  onChange={(e) => setAssignForm(prev => ({ ...prev, estimatedCost: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: isDark ? "rgba(15, 23, 42, 0.6)" : "rgba(241, 245, 249, 0.6)",
                    border: `1px solid ${isDark ? "rgba(102, 126, 234, 0.3)" : "rgba(0,0,0,0.1)"}`,
                    borderRadius: "8px",
                    color: isDark ? "#f1f5f9" : "#1e293b",
                    outline: "none",
                    fontSize: "14px"
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button
                onClick={() => setShowAssignModal(false)}
                style={{
                  flex: 1,
                  padding: "14px",
                  background: isDark ? "rgba(30, 41, 59, 0.8)" : "rgba(241, 245, 249, 0.8)",
                  border: `1px solid ${isDark ? "rgba(102, 126, 234, 0.3)" : "rgba(0,0,0,0.1)"}`,
                  borderRadius: "8px",
                  color: isDark ? "#cbd5e1" : "#475569",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600"
                }}
              >
                Cancel
              </button>
              <button
                onClick={assignWorker}
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: "14px",
                  background: submitting
                    ? "rgba(245, 158, 11, 0.5)"
                    : "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  border: "none",
                  borderRadius: "8px",
                  color: "white",
                  cursor: submitting ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: "600"
                }}
              >
                {submitting ? "Assigning..." : "Assign Worker"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Maintenance;
