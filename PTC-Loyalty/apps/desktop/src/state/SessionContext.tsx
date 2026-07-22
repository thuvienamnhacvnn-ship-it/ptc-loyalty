import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PosSessionInfo } from "@shared/contract";

export type Phase = "loading" | "login" | "branch" | "pos" | "settings" | "whatsapp";

interface SessionState {
  phase: Phase;
  session: PosSessionInfo | null;
  branchId: string | null; // operating branch (null = all / not chosen)
  online: boolean;
  queueCount: number;
  baseUrl: string;
  setPhase: (p: Phase) => void;
  setBranch: (id: string | null) => void;
  refreshConnectivity: () => Promise<void>;
  refreshQueue: () => Promise<void>;
  onLoggedIn: (session: PosSessionInfo) => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<SessionState | null>(null);

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside provider");
  return v;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<PosSessionInfo | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [baseUrl, setBaseUrl] = useState("");
  const pingTimer = useRef<number | null>(null);

  const refreshConnectivity = useCallback(async () => {
    const ok = await window.pos.ping();
    setOnline(ok);
  }, []);

  const refreshQueue = useCallback(async () => {
    setQueueCount(await window.pos.queueCount());
  }, []);

  const resolveBranch = useCallback((s: PosSessionInfo) => {
    if (s.fixedBranchId) return s.fixedBranchId;
    if (s.branches.length <= 1) return s.branches[0]?.id ?? null;
    return null; // must choose
  }, []);

  const onLoggedIn = useCallback(
    (s: PosSessionInfo) => {
      setSession(s);
      const b = resolveBranch(s);
      setBranchId(b);
      // Owners/managers with several branches must pick one first.
      setPhase(!s.fixedBranchId && s.branches.length > 1 ? "branch" : "pos");
    },
    [resolveBranch],
  );

  const logout = useCallback(async () => {
    await window.pos.logout();
    setSession(null);
    setBranchId(null);
    setPhase("login");
  }, []);

  // Startup: restore session, base url, queue, connectivity.
  useEffect(() => {
    (async () => {
      const status = await window.pos.status();
      setBaseUrl(status.baseUrl);
      setOnline(status.online);
      await refreshQueue();
      if (status.authenticated) {
        const me = await window.pos.me();
        if (me.ok) {
          onLoggedIn(me.session);
          return;
        }
      }
      setPhase("login");
    })();
  }, [onLoggedIn, refreshQueue]);

  // Poll connectivity every 20s while signed in.
  useEffect(() => {
    if (phase === "loading" || phase === "login") return;
    pingTimer.current = window.setInterval(refreshConnectivity, 20000);
    return () => {
      if (pingTimer.current) window.clearInterval(pingTimer.current);
    };
  }, [phase, refreshConnectivity]);

  const value = useMemo<SessionState>(
    () => ({
      phase,
      session,
      branchId,
      online,
      queueCount,
      baseUrl,
      setPhase,
      setBranch: setBranchId,
      refreshConnectivity,
      refreshQueue,
      onLoggedIn,
      logout,
    }),
    [
      phase,
      session,
      branchId,
      online,
      queueCount,
      baseUrl,
      refreshConnectivity,
      refreshQueue,
      onLoggedIn,
      logout,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
