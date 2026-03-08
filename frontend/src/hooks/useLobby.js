import { useContext } from "react";

import { LobbyContext } from "../context/LobbyContext";

export function useLobby() {
  const context = useContext(LobbyContext);

  if (!context) {
    throw new Error("useLobby must be used within LobbyProvider");
  }

  return context;
}
