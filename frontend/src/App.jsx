import "./App.css";
import AppRouter from "./router/AppRouter";
import { LobbyProvider } from "./context/LobbyContext";

function App() {
  return (
    <LobbyProvider>
      <AppRouter />
    </LobbyProvider>
  );
}

export default App;
