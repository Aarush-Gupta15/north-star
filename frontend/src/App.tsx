import { useState } from "react";
import { useAuth } from "./context/AuthContext";
import { Layout, type View } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { ScanPage } from "./pages/ScanPage";
import { DashboardPage } from "./pages/DashboardPage";
import { IncidentsPage } from "./pages/IncidentsPage";

/**
 * Root component. Unauthenticated → login. Authenticated → an app shell with
 * lightweight in-app navigation between the Dashboard and the Scan workspace.
 * Kept as local view state (not a router) since the skeleton has two views;
 * swapping to react-router is a drop-in when deep links / more pages arrive.
 */
export default function App() {
  const { isAuthenticated } = useAuth();
  const [view, setView] = useState<View>("dashboard");

  if (!isAuthenticated) return <LoginPage />;

  return (
    <Layout view={view} onChange={setView}>
      {view === "dashboard" ? (
        <DashboardPage onNewScan={() => setView("scan")} />
      ) : view === "incidents" ? (
        <IncidentsPage />
      ) : (
        <ScanPage />
      )}
    </Layout>
  );
}
