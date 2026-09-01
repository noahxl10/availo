import {
  DashboardAuthRequiredError,
  logoutDashboardSession,
  refreshDashboardSession,
  type DashboardSession
} from "./api-data";

const LOCK_NAME = "availo.dashboard.refresh";
const PRESENCE_LOCK_NAME = "availo.dashboard.session-present";
const CHANNEL_NAME = "availo.dashboard.session";

type SessionMessage =
  | { type: "session"; session: DashboardSession }
  | { type: "session-request"; requestId: string; staleAccessToken?: string }
  | { type: "session-response"; requestId: string; session: DashboardSession }
  | { type: "signed-out" };

type SessionLockManager = {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
  query?: () => Promise<{ held?: Array<{ name?: string }>; pending?: Array<{ name?: string }> }>;
};

type SessionBroadcastChannel = {
  onmessage: ((event: MessageEvent<SessionMessage>) => void) | null;
  close(): void;
  postMessage(message: SessionMessage): void;
};

type BrowserSessionDependencies = {
  broadcastChannel?: new (name: string) => SessionBroadcastChannel;
  navigator?: { locks?: SessionLockManager };
};

let memorySession: DashboardSession | null = null;
let channel: SessionBroadcastChannel | null = null;
let channelCtor: (new (name: string) => SessionBroadcastChannel) | undefined;
let sameTabRefresh: Promise<DashboardSession> | null = null;
const listeners = new Set<(session: DashboardSession | null) => void>();
const pendingSessionRequests = new Map<string, (session: DashboardSession) => void>();
let presenceDesired = false;
let presenceHeld = false;
let presenceRelease: (() => void) | null = null;
let presenceAcquire: Promise<void> | null = null;

export class DashboardSessionCoordinationError extends Error {
  constructor() {
    super("Dashboard browser session coordination is unavailable");
  }
}

export function setMemoryDashboardSession(session: DashboardSession, dependencies: BrowserSessionDependencies = {}) {
  setMemoryDashboardSessionState(session, dependencies);
  postSessionMessage({ type: "session", session });
}

export function clearMemoryDashboardSession() {
  clearMemoryDashboardSessionState();
  postSessionMessage({ type: "signed-out" });
}

export function currentDashboardSession() {
  return memorySession;
}

export function subscribeDashboardSession(listener: (session: DashboardSession | null) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function initializeDashboardSessionChannel(dependencies: BrowserSessionDependencies = {}) {
  const nextChannelCtor = dependencies.broadcastChannel ?? globalThis.BroadcastChannel;
  if (!nextChannelCtor) return false;
  if (channel && channelCtor === nextChannelCtor) return true;

  channel?.close();
  channelCtor = nextChannelCtor;
  const nextChannel = new nextChannelCtor(CHANNEL_NAME);
  nextChannel.onmessage = (event) => {
    const message = event.data;
    if (message?.type === "session") {
      setMemoryDashboardSessionState(message.session);
    }
    if (message?.type === "session-request" && memorySession && memorySession.accessToken !== message.staleAccessToken) {
      postSessionMessage({ type: "session-response", requestId: message.requestId, session: memorySession });
    }
    if (message?.type === "session-response") {
      pendingSessionRequests.get(message.requestId)?.(message.session);
    }
    if (message?.type === "signed-out") {
      clearMemoryDashboardSessionState();
    }
  };
  channel = nextChannel;
  return true;
}

export function supportsDashboardSessionCoordination(dependencies: BrowserSessionDependencies = {}) {
  const locks = sessionLocks(dependencies);
  const channelAvailable = Boolean(dependencies.broadcastChannel ?? globalThis.BroadcastChannel);
  return Boolean(channelAvailable && typeof locks?.request === "function" && typeof locks.query === "function");
}

export async function restoreDashboardSession(dependencies: BrowserSessionDependencies = {}) {
  initializeDashboardSessionChannel(dependencies);
  return withSessionLock(async () => {
    if (memorySession) return memorySession;
    const hasPeerSession = await hasPeerDashboardSession(dependencies);
    const peerSession = await requestPeerDashboardSession();
    if (peerSession) return peerSession;
    if (hasPeerSession) throw new DashboardAuthRequiredError();
    return requestDashboardSessionRefresh(dependencies);
  }, dependencies);
}

export async function refreshDashboardSessionAfterStaleToken(staleAccessToken: string, dependencies: BrowserSessionDependencies = {}) {
  initializeDashboardSessionChannel(dependencies);
  return withSessionLock(async () => {
    if (memorySession && memorySession.accessToken !== staleAccessToken) return memorySession;
    const hasPeerSession = !presenceHeld && await hasPeerDashboardSession(dependencies);
    const peerSession = await requestPeerDashboardSession(staleAccessToken);
    if (peerSession) return peerSession;
    if (hasPeerSession) throw new DashboardAuthRequiredError();
    return requestDashboardSessionRefresh(dependencies);
  }, dependencies);
}

export async function logoutDashboardBrowserSession(dependencies: BrowserSessionDependencies = {}) {
  initializeDashboardSessionChannel(dependencies);
  try {
    await withSessionLock(() => logoutDashboardSession(), dependencies);
  } finally {
    clearMemoryDashboardSession();
  }
}

export function resetDashboardSessionForTests() {
  memorySession = null;
  sameTabRefresh = null;
  listeners.clear();
  pendingSessionRequests.clear();
  endDashboardSessionPresence();
  channel?.close();
  channel = null;
  channelCtor = undefined;
}

async function withSessionLock<T>(callback: () => Promise<T>, dependencies: BrowserSessionDependencies) {
  const locks = sessionLocks(dependencies);
  if (!supportsDashboardSessionCoordination(dependencies)) throw new DashboardSessionCoordinationError();
  return locks!.request(LOCK_NAME, callback);
}

function requestDashboardSessionRefresh(dependencies: BrowserSessionDependencies) {
  if (sameTabRefresh) return sameTabRefresh;

  sameTabRefresh = refreshDashboardSession()
    .then(async (session) => {
      setMemoryDashboardSession(session, dependencies);
      await beginDashboardSessionPresence(dependencies);
      return session;
    })
    .finally(() => {
      sameTabRefresh = null;
    });
  return sameTabRefresh;
}

function requestPeerDashboardSession(staleAccessToken?: string) {
  if (!channel) return Promise.resolve(null);
  const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return new Promise<DashboardSession | null>((resolve) => {
    const timeout = globalThis.setTimeout(() => {
      pendingSessionRequests.delete(requestId);
      resolve(null);
    }, 75);
    pendingSessionRequests.set(requestId, (session) => {
      globalThis.clearTimeout(timeout);
      pendingSessionRequests.delete(requestId);
      setMemoryDashboardSessionState(session);
      resolve(session);
    });
    postSessionMessage(staleAccessToken ? { type: "session-request", requestId, staleAccessToken } : { type: "session-request", requestId });
  });
}

function setMemoryDashboardSessionState(session: DashboardSession, dependencies: BrowserSessionDependencies = {}) {
  memorySession = session;
  void beginDashboardSessionPresence(dependencies);
  notifyDashboardSessionListeners();
}

function clearMemoryDashboardSessionState() {
  memorySession = null;
  endDashboardSessionPresence();
  notifyDashboardSessionListeners();
}

function beginDashboardSessionPresence(dependencies: BrowserSessionDependencies) {
  presenceDesired = true;
  if (presenceHeld) return Promise.resolve();
  if (presenceAcquire) return presenceAcquire;

  const locks = sessionLocks(dependencies);
  if (typeof locks?.request !== "function") return Promise.resolve();

  presenceAcquire = new Promise<void>((resolve) => {
    void locks.request(PRESENCE_LOCK_NAME, async () => {
      if (!presenceDesired || !memorySession) {
        presenceAcquire = null;
        resolve();
        return;
      }

      presenceHeld = true;
      resolve();
      await new Promise<void>((release) => {
        presenceRelease = release;
      });
      presenceHeld = false;
      presenceRelease = null;
      presenceAcquire = null;
    }).catch(() => {
      presenceHeld = false;
      presenceRelease = null;
      presenceAcquire = null;
      resolve();
    });
  });

  return presenceAcquire;
}

function endDashboardSessionPresence() {
  presenceDesired = false;
  presenceRelease?.();
  presenceRelease = null;
}

async function hasPeerDashboardSession(dependencies: BrowserSessionDependencies) {
  const locks = sessionLocks(dependencies);
  if (typeof locks?.query !== "function") return false;
  const state = await locks.query();
  return (state.held ?? []).some((lock) => lock.name === PRESENCE_LOCK_NAME);
}

function postSessionMessage(message: SessionMessage) {
  channel?.postMessage(message);
}

function sessionLocks(dependencies: BrowserSessionDependencies) {
  if ("navigator" in dependencies) return dependencies.navigator?.locks;
  return globalThis.navigator?.locks;
}

function notifyDashboardSessionListeners() {
  for (const listener of listeners) listener(memorySession);
}
