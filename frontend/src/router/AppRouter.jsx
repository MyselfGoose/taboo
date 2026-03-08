import { Navigate, Route, Routes } from "react-router-dom";

import GamePage from "../pages/GamePage";
import LandingPage from "../pages/LandingPage";
import LobbyPage from "../pages/LobbyPage";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/lobby/:code" element={<LobbyPage />} />
      <Route path="/game/:code" element={<GamePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
