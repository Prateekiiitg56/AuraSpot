import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";

import { auth } from "./services/firebase";
import { ThemeProvider } from "./context/ThemeContext";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/home";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AddProperty from "./pages/AddProperty";
import Explore from "./pages/Explore";
import PropertyDetails from "./pages/PropertyDetails";
import { API } from "./services/api";
import Notifications from "./pages/Notifications";
import MyDeals from "./pages/MyDeals";
import Chat from "./pages/Chat";
import AIMatch from "./pages/AIMatch";
import RentManager from "./pages/RentManager";
import Maintenance from "./pages/Maintenance";
import Analytics from "./pages/Analytics";

function App() {
  const [user, setUser] = useState<User | null>(null);

useEffect(() => {
  const unsub = onAuthStateChanged(auth, async currentUser => {
    if (currentUser) {
      try {
        await fetch(`${API}/users/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firebaseUid: currentUser.uid,
            name: currentUser.displayName || currentUser.email?.split('@')[0],
            email: currentUser.email
          })
        });
      } catch (err) {
        // Silent fail - user sync is non-critical
      }
    }

    setUser(currentUser);
  });

  return () => unsub();
}, []);


  return (
    <ThemeProvider>
      <Router>
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          <Navbar user={user} />

          <div style={{ flex: 1 }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/add" element={<AddProperty />} />
              <Route path="/profile" element={<Profile user={user} />} />
              <Route path="/user/:email" element={<UserProfile />} />
              <Route path="/property/:id" element={<PropertyDetails />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/my-deals" element={<MyDeals />} />
              <Route path="/chat/:propertyId" element={<Chat />} />
              <Route path="/ai-match" element={<AIMatch />} />
              <Route path="/rent-manager" element={<RentManager />} />
              <Route path="/maintenance" element={<Maintenance />} />
              <Route path="/analytics" element={<Analytics />} />

              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
            </Routes>
          </div>

          <Footer />
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
