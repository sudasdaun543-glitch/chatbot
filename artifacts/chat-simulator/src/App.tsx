import { useState, useCallback } from "react";
import type { AuthResponse, SessionInfo } from "./types";
import LoginScreen from "./components/LoginScreen";
import UIDRevealScreen from "./components/UIDRevealScreen";
import SessionStarter from "./components/SessionStarter";
import ChatWindow from "./components/ChatWindow";
import CoachPanel from "./components/CoachPanel";
import DevPanel from "./components/DevPanel";

type AppView = "login" | "uid" | "starter" | "chat" | "coach" | "dev";

export default function App() {
  const [view, setView] = useState<AppView>("login");
  const [auth, setAuth] = useState<AuthResponse | null>(null);
  const [currentSession, setCurrentSession] = useState<SessionInfo | null>(null);

  const handleLogin = useCallback((a: AuthResponse) => {
    setAuth(a);
    sessionStorage.setItem("operator_uid", a.uid);
    if (a.isNew) {
      setView("uid");
    } else {
      setView("starter");
    }
  }, []);

  const handleUIDContinue = useCallback(() => {
    setView("starter");
  }, []);

  const handleStartSession = useCallback((session: SessionInfo) => {
    setCurrentSession(session);
    setView("chat");
  }, []);

  const handleNewSession = useCallback(() => {
    setCurrentSession(null);
    setView("starter");
  }, []);

  const handleCoachPanel = useCallback(() => {
    setView("coach");
  }, []);

  const handleCoachBack = useCallback(() => {
    setView("login");
  }, []);

  const handleDevPanel = useCallback(() => {
    setView("dev");
  }, []);

  const handleDevBack = useCallback(() => {
    setView("coach");
  }, []);

  return (
    <>
      {view === "login" && (
        <LoginScreen onLogin={handleLogin} onCoachPanel={handleCoachPanel} />
      )}
      {view === "uid" && auth && (
        <UIDRevealScreen
          auth={auth}
          onContinue={handleUIDContinue}
        />
      )}
      {view === "starter" && auth && (
        <SessionStarter
          operatorId={auth.uid}
          onStartSession={handleStartSession}
        />
      )}
      {view === "chat" && currentSession && (
        <ChatWindow session={currentSession} onNewSession={handleNewSession} />
      )}
      {view === "coach" && (
        <CoachPanel onBack={handleCoachBack} onDevPanel={handleDevPanel} />
      )}
      {view === "dev" && <DevPanel onBack={handleDevBack} />}
    </>
  );
}
