import AppRouter from "./router/AppRouter";
import { LobbyProvider } from "./context/LobbyContext";
import { ErrorBoundary } from "./components/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
      <LobbyProvider>
        <AppRouter />
      </LobbyProvider>
    </ErrorBoundary>
  );
}

export default App;
