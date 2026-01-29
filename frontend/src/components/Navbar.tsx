import { Link } from "react-router-dom";
import type { User } from "firebase/auth";
import { useTheme } from "../context/ThemeContext";

const Navbar = ({ user }: { user: User | null }) => {
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <nav className={`navbar ${darkMode ? "" : "navbar-light"}`}>
      <div className="nav-container">
        <div className="logo">
          <span className="logo-main">AuraSpot</span>
          <span className="logo-tagline">Smart Property Manager</span>
        </div>

        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/explore">Explore</Link>
          <Link to="/ai-match">AI Match</Link>
          {user && <Link to="/rent-manager">Rent Manager</Link>}
          {user && <Link to="/maintenance">Maintenance</Link>}
          {user && <Link to="/analytics">Analytics</Link>}
          <Link to="/notifications">Notifications</Link>
          {user && <Link to="/my-deals">My Deals</Link>}
          {user && <Link to="/profile">Profile</Link>}
          {!user && <Link to="/login">Login</Link>}
          
          {/* Theme Toggle Button */}
          <button
            onClick={toggleDarkMode}
            className="theme-toggle"
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
