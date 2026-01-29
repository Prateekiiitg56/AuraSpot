import { useTheme } from "../context/ThemeContext";

const Footer = () => {
  const { darkMode } = useTheme();

  return (
    <footer style={{
      padding: "24px 40px",
      background: darkMode 
        ? "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)"
        : "linear-gradient(135deg, rgba(241, 245, 249, 0.95) 0%, rgba(226, 232, 240, 0.95) 100%)",
      borderTop: `1px solid ${darkMode ? "rgba(102, 126, 234, 0.2)" : "rgba(0, 0, 0, 0.1)"}`,
      marginTop: "auto"
    }}>
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "16px"
      }}>
        {/* Left - Branding */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{
            fontSize: "20px",
            fontWeight: "700",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>
            AuraSpot
          </span>
          <span style={{ 
            color: darkMode ? "#64748b" : "#94a3b8",
            fontSize: "14px"
          }}>
            Smart Property Manager
          </span>
        </div>

        {/* Center - Developer Credit */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          color: darkMode ? "#94a3b8" : "#64748b",
          fontSize: "14px"
        }}>
          <span>Developed by</span>
          <a
            href="https://github.com/prateekiiitg56"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "#667eea",
              textDecoration: "none",
              fontWeight: "600",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = "#764ba2";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = "#667eea";
            }}
          >
            <svg
              height="18"
              width="18"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            Prateek
          </a>
        </div>

        {/* Right - Copyright */}
        <div style={{
          color: darkMode ? "#64748b" : "#94a3b8",
          fontSize: "13px"
        }}>
          © {new Date().getFullYear()} AuraSpot. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
