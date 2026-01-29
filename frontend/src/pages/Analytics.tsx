import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API } from "../services/api";
import { auth } from "../services/firebase";
import { useTheme } from "../context/ThemeContext";

type AnalyticsData = {
  rent: {
    monthlyCollected: number;
    monthlyExpected: number;
    totalCollected: number;
    pendingPayments: number;
    activeAgreements: number;
    monthlyData: Array<{ month: string; amount: number }>;
  };
  maintenance: {
    pending: number;
    approved: number;
    inProgress: number;
    resolved: number;
    total: number;
    avgResolutionDays: number;
  };
  occupancy: {
    total: number;
    occupied: number;
    available: number;
    requested: number;
    rate: number;
  };
  response: {
    avgResponseHours: number;
    pendingRequests: number;
    totalResponded: number;
  };
  propertyTypes: Record<string, number>;
};

const Analytics = () => {
  const { darkMode } = useTheme();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const currentUser = auth.currentUser;
  const isDark = darkMode;

  useEffect(() => {
    const loadAnalytics = async () => {
      if (!currentUser?.email) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API}/analytics/owner/${currentUser.email}`);
        if (res.ok) {
          const data = await res.json();
          setAnalytics(data);
        }
      } catch (err) {
        console.error("Failed to load analytics", err);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="page" style={{ textAlign: "center", padding: "60px 20px" }}>
        <h2 style={{ color: isDark ? "#f1f5f9" : "#1e293b" }}>Please login to view analytics</h2>
        <Link to="/login" style={{ color: "#667eea" }}>Go to Login</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page" style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        minHeight: "80vh" 
      }}>
        <p style={{ color: isDark ? "#94a3b8" : "#64748b" }}>Loading analytics...</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="page" style={{ textAlign: "center", padding: "60px 20px" }}>
        <h2 style={{ color: isDark ? "#f1f5f9" : "#1e293b" }}>No analytics data available</h2>
        <p style={{ color: isDark ? "#94a3b8" : "#64748b" }}>Add properties and rent agreements to see your analytics</p>
      </div>
    );
  }

  const cardStyle = {
    padding: "24px",
    background: isDark 
      ? "linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(45, 55, 72, 0.8) 100%)"
      : "linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(241, 245, 249, 0.9) 100%)",
    border: `1px solid ${isDark ? "rgba(102, 126, 234, 0.2)" : "rgba(0, 0, 0, 0.1)"}`,
    borderRadius: "16px",
    transition: "all 0.3s ease"
  };

  const statCardStyle = (color: string) => ({
    ...cardStyle,
    borderLeft: `4px solid ${color}`
  });

  const maxRent = Math.max(...analytics.rent.monthlyData.map(d => d.amount), 1);

  return (
    <div className="page" style={{ padding: "40px 20px", minHeight: "100vh" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "40px" }}>
          <h1 style={{
            fontSize: "32px",
            margin: "0 0 8px 0",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>
            📊 Analytics Dashboard
          </h1>
          <p style={{ color: isDark ? "#94a3b8" : "#64748b", margin: 0 }}>
            Track your property performance and rental income
          </p>
        </div>

        {/* Quick Stats Row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "20px",
          marginBottom: "32px"
        }}>
          {/* Monthly Rent Collected */}
          <div style={statCardStyle("#10b981")}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "rgba(16, 185, 129, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px"
              }}>
                💰
              </div>
              <div>
                <p style={{ margin: 0, color: isDark ? "#94a3b8" : "#64748b", fontSize: "13px" }}>
                  Monthly Rent Collected
                </p>
                <h2 style={{ margin: 0, color: isDark ? "#f1f5f9" : "#1e293b", fontSize: "28px" }}>
                  ₹{analytics.rent.monthlyCollected.toLocaleString()}
                </h2>
              </div>
            </div>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between",
              paddingTop: "12px",
              borderTop: `1px solid ${isDark ? "rgba(102, 126, 234, 0.2)" : "rgba(0, 0, 0, 0.1)"}`
            }}>
              <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: "12px" }}>
                Expected: ₹{analytics.rent.monthlyExpected.toLocaleString()}
              </span>
              <span style={{ 
                color: analytics.rent.monthlyExpected > 0 
                  ? (analytics.rent.monthlyCollected >= analytics.rent.monthlyExpected ? "#10b981" : "#f59e0b")
                  : isDark ? "#94a3b8" : "#64748b",
                fontSize: "12px",
                fontWeight: "600"
              }}>
                {analytics.rent.monthlyExpected > 0 
                  ? `${Math.round((analytics.rent.monthlyCollected / analytics.rent.monthlyExpected) * 100)}%`
                  : "N/A"}
              </span>
            </div>
          </div>

          {/* Pending Maintenance */}
          <div style={statCardStyle("#f59e0b")}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "rgba(245, 158, 11, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px"
              }}>
                🔧
              </div>
              <div>
                <p style={{ margin: 0, color: isDark ? "#94a3b8" : "#64748b", fontSize: "13px" }}>
                  Pending Maintenance
                </p>
                <h2 style={{ margin: 0, color: isDark ? "#f1f5f9" : "#1e293b", fontSize: "28px" }}>
                  {analytics.maintenance.pending + analytics.maintenance.approved + analytics.maintenance.inProgress}
                </h2>
              </div>
            </div>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between",
              paddingTop: "12px",
              borderTop: `1px solid ${isDark ? "rgba(102, 126, 234, 0.2)" : "rgba(0, 0, 0, 0.1)"}`
            }}>
              <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: "12px" }}>
                Resolved: {analytics.maintenance.resolved}
              </span>
              <Link to="/maintenance" style={{ color: "#667eea", fontSize: "12px", textDecoration: "none" }}>
                View All →
              </Link>
            </div>
          </div>

          {/* Occupancy Rate */}
          <div style={statCardStyle("#3b82f6")}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "rgba(59, 130, 246, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px"
              }}>
                🏠
              </div>
              <div>
                <p style={{ margin: 0, color: isDark ? "#94a3b8" : "#64748b", fontSize: "13px" }}>
                  Occupancy Rate
                </p>
                <h2 style={{ margin: 0, color: isDark ? "#f1f5f9" : "#1e293b", fontSize: "28px" }}>
                  {analytics.occupancy.rate}%
                </h2>
              </div>
            </div>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between",
              paddingTop: "12px",
              borderTop: `1px solid ${isDark ? "rgba(102, 126, 234, 0.2)" : "rgba(0, 0, 0, 0.1)"}`
            }}>
              <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: "12px" }}>
                {analytics.occupancy.occupied}/{analytics.occupancy.total} properties
              </span>
              <span style={{ color: "#10b981", fontSize: "12px" }}>
                {analytics.occupancy.available} available
              </span>
            </div>
          </div>

          {/* Response Time */}
          <div style={statCardStyle("#8b5cf6")}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "rgba(139, 92, 246, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px"
              }}>
                ⚡
              </div>
              <div>
                <p style={{ margin: 0, color: isDark ? "#94a3b8" : "#64748b", fontSize: "13px" }}>
                  Avg Response Time
                </p>
                <h2 style={{ margin: 0, color: isDark ? "#f1f5f9" : "#1e293b", fontSize: "28px" }}>
                  {analytics.response.avgResponseHours > 0 
                    ? `${analytics.response.avgResponseHours}h`
                    : "N/A"}
                </h2>
              </div>
            </div>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between",
              paddingTop: "12px",
              borderTop: `1px solid ${isDark ? "rgba(102, 126, 234, 0.2)" : "rgba(0, 0, 0, 0.1)"}`
            }}>
              <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: "12px" }}>
                Pending: {analytics.response.pendingRequests}
              </span>
              <span style={{ color: "#10b981", fontSize: "12px" }}>
                {analytics.response.totalResponded} responded
              </span>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
          gap: "24px",
          marginBottom: "32px"
        }}>
          {/* Rent Chart */}
          <div style={cardStyle}>
            <h3 style={{ 
              margin: "0 0 20px 0", 
              color: isDark ? "#f1f5f9" : "#1e293b",
              fontSize: "18px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              📈 Rent Collection (Last 6 Months)
            </h3>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", height: "180px" }}>
              {analytics.rent.monthlyData.map((data, index) => (
                <div key={index} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                  <div style={{
                    width: "100%",
                    height: `${maxRent > 0 ? (data.amount / maxRent) * 150 : 0}px`,
                    minHeight: "4px",
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    borderRadius: "4px 4px 0 0",
                    transition: "height 0.3s ease"
                  }} />
                  <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: "11px" }}>
                    {data.month}
                  </span>
                </div>
              ))}
            </div>
            <div style={{
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: `1px solid ${isDark ? "rgba(102, 126, 234, 0.2)" : "rgba(0, 0, 0, 0.1)"}`,
              display: "flex",
              justifyContent: "space-between"
            }}>
              <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: "13px" }}>
                Total Collected: <strong style={{ color: "#10b981" }}>₹{analytics.rent.totalCollected.toLocaleString()}</strong>
              </span>
              <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: "13px" }}>
                Active Agreements: <strong style={{ color: "#667eea" }}>{analytics.rent.activeAgreements}</strong>
              </span>
            </div>
          </div>

          {/* Maintenance Breakdown */}
          <div style={cardStyle}>
            <h3 style={{ 
              margin: "0 0 20px 0", 
              color: isDark ? "#f1f5f9" : "#1e293b",
              fontSize: "18px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              🔧 Maintenance Status
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                { label: "Pending", value: analytics.maintenance.pending, color: "#f59e0b" },
                { label: "Approved", value: analytics.maintenance.approved, color: "#3b82f6" },
                { label: "In Progress", value: analytics.maintenance.inProgress, color: "#8b5cf6" },
                { label: "Resolved", value: analytics.maintenance.resolved, color: "#10b981" }
              ].map((item) => (
                <div key={item.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ color: isDark ? "#cbd5e1" : "#475569", fontSize: "13px" }}>{item.label}</span>
                    <span style={{ color: item.color, fontWeight: "600", fontSize: "13px" }}>{item.value}</span>
                  </div>
                  <div style={{
                    height: "8px",
                    background: isDark ? "rgba(30, 41, 59, 0.8)" : "rgba(241, 245, 249, 0.8)",
                    borderRadius: "4px",
                    overflow: "hidden"
                  }}>
                    <div style={{
                      height: "100%",
                      width: `${analytics.maintenance.total > 0 ? (item.value / analytics.maintenance.total) * 100 : 0}%`,
                      background: item.color,
                      borderRadius: "4px",
                      transition: "width 0.3s ease"
                    }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: `1px solid ${isDark ? "rgba(102, 126, 234, 0.2)" : "rgba(0, 0, 0, 0.1)"}`,
              display: "flex",
              justifyContent: "space-between"
            }}>
              <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: "13px" }}>
                Total: <strong>{analytics.maintenance.total}</strong>
              </span>
              <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: "13px" }}>
                Avg Resolution: <strong style={{ color: "#10b981" }}>{analytics.maintenance.avgResolutionDays} days</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "24px"
        }}>
          {/* Property Status */}
          <div style={cardStyle}>
            <h3 style={{ 
              margin: "0 0 20px 0", 
              color: isDark ? "#f1f5f9" : "#1e293b",
              fontSize: "18px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              🏘️ Property Status
            </h3>
            <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center" }}>
              <div>
                <div style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "rgba(16, 185, 129, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 8px",
                  fontSize: "24px",
                  color: "#10b981",
                  fontWeight: "700"
                }}>
                  {analytics.occupancy.available}
                </div>
                <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: "12px" }}>Available</span>
              </div>
              <div>
                <div style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "rgba(245, 158, 11, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 8px",
                  fontSize: "24px",
                  color: "#f59e0b",
                  fontWeight: "700"
                }}>
                  {analytics.occupancy.requested}
                </div>
                <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: "12px" }}>Requested</span>
              </div>
              <div>
                <div style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "rgba(59, 130, 246, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 8px",
                  fontSize: "24px",
                  color: "#3b82f6",
                  fontWeight: "700"
                }}>
                  {analytics.occupancy.occupied}
                </div>
                <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: "12px" }}>Occupied</span>
              </div>
            </div>
          </div>

          {/* Property Types */}
          <div style={cardStyle}>
            <h3 style={{ 
              margin: "0 0 20px 0", 
              color: isDark ? "#f1f5f9" : "#1e293b",
              fontSize: "18px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              🏷️ Property Types
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {Object.entries(analytics.propertyTypes).map(([type, count]) => (
                <div
                  key={type}
                  style={{
                    padding: "12px 20px",
                    background: "linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)",
                    border: "1px solid rgba(102, 126, 234, 0.2)",
                    borderRadius: "20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}
                >
                  <span style={{ color: isDark ? "#f1f5f9" : "#1e293b", fontWeight: "600" }}>{type}</span>
                  <span style={{
                    background: "#667eea",
                    color: "white",
                    padding: "2px 8px",
                    borderRadius: "10px",
                    fontSize: "12px",
                    fontWeight: "600"
                  }}>
                    {count}
                  </span>
                </div>
              ))}
              {Object.keys(analytics.propertyTypes).length === 0 && (
                <p style={{ color: isDark ? "#94a3b8" : "#64748b", margin: 0 }}>No properties yet</p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div style={cardStyle}>
            <h3 style={{ 
              margin: "0 0 20px 0", 
              color: isDark ? "#f1f5f9" : "#1e293b",
              fontSize: "18px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              ⚡ Quick Actions
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <Link
                to="/add"
                style={{
                  padding: "14px 20px",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                  borderRadius: "8px",
                  textDecoration: "none",
                  fontWeight: "600",
                  fontSize: "14px",
                  textAlign: "center",
                  transition: "all 0.3s ease"
                }}
              >
                ➕ Add New Property
              </Link>
              <Link
                to="/maintenance"
                style={{
                  padding: "14px 20px",
                  background: isDark ? "rgba(30, 41, 59, 0.8)" : "rgba(241, 245, 249, 0.8)",
                  border: "1px solid rgba(102, 126, 234, 0.3)",
                  color: isDark ? "#f1f5f9" : "#1e293b",
                  borderRadius: "8px",
                  textDecoration: "none",
                  fontWeight: "600",
                  fontSize: "14px",
                  textAlign: "center",
                  transition: "all 0.3s ease"
                }}
              >
                🔧 Manage Maintenance
              </Link>
              <Link
                to="/rent-manager"
                style={{
                  padding: "14px 20px",
                  background: isDark ? "rgba(30, 41, 59, 0.8)" : "rgba(241, 245, 249, 0.8)",
                  border: "1px solid rgba(102, 126, 234, 0.3)",
                  color: isDark ? "#f1f5f9" : "#1e293b",
                  borderRadius: "8px",
                  textDecoration: "none",
                  fontWeight: "600",
                  fontSize: "14px",
                  textAlign: "center",
                  transition: "all 0.3s ease"
                }}
              >
                💳 Rent Manager
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
