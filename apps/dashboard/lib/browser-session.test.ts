import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardSession } from "./api-data";
import { DashboardAuthRequiredError, logoutDashboardSession, refreshDashboardSession } from "./api-data";
import {
  DashboardSessionCoordinationError,
  clearMemoryDashboardSession,
  currentDashboardSession,
  initializeDashboardSessionChannel,
  logoutDashboardBrowserSession,
  refreshDashboardSessionAfterStaleToken,
  resetDashboardSessionForTests,
  restoreDashboardSession,
  setMemoryDashboardSession,
  subscribeDashboardSession,
  supportsDashboardSessionCoordination
} from "./browser-session";

vi.mock("./api-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api-data")>();
  return {
    ...actual,
    logoutDashboardSession: vi.fn(),
    refreshDashboardSession: vi.fn()
  };
});

describe("dashboard browser session coordinator", () => {
  afterEach(() => {
    resetDashboardSessionForTests();
    Reflect.deleteProperty(globalThis, "localStorage");
    FakeBroadcastChannel.channels = [];
    vi.mocked(refreshDashboardSession).mockReset();
    vi.mocked(logoutDashboardSession).mockReset();
  });

  it("fails closed when lock or broadcast coordination is unavailable", async () => {
    expect(supportsDashboardSessionCoordination({ navigator: {}, broadcastChannel: FakeBroadcastChannel })).toBe(false);
    await expect(restoreDashboardSession({ navigator: {}, broadcastChannel: FakeBroadcastChannel })).rejects.toBeInstanceOf(DashboardSessionCoordinationError);
    expect(supportsDashboardSessionCoordination({ navigator: { locks: { request: async (_name, callback) => callback() } }, broadcastChannel: FakeBroadcastChannel })).toBe(false);
    expect(refreshDashboardSession).not.toHaveBeenCalled();
  });

  it("restores through an exclusive lock and does not use persistent browser storage", async () => {
    const locks = new FakeLockManager();
    const storageGetter = vi.fn(() => {
      throw new Error("persistent storage must not be read");
    });
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get: storageGetter });
    vi.mocked(refreshDashboardSession).mockResolvedValueOnce(session("access-one"));

    await expect(restoreDashboardSession({ navigator: { locks }, broadcastChannel: FakeBroadcastChannel })).resolves.toMatchObject({
      accessToken: "access-one"
    });

    expect(locks.requests).toEqual(["availo.dashboard.refresh", "availo.dashboard.session-present"]);
    expect(refreshDashboardSession).toHaveBeenCalledTimes(1);
    expect(storageGetter).not.toHaveBeenCalled();
  });

  it("shares a refreshed session with same-tab callers instead of issuing duplicate refreshes", async () => {
    const locks = new FakeLockManager();
    vi.mocked(refreshDashboardSession).mockResolvedValueOnce(session("access-one"));
    const deps = { navigator: { locks }, broadcastChannel: FakeBroadcastChannel };

    const [first, second] = await Promise.all([restoreDashboardSession(deps), restoreDashboardSession(deps)]);

    expect(first.accessToken).toBe("access-one");
    expect(second.accessToken).toBe("access-one");
    expect(refreshDashboardSession).toHaveBeenCalledTimes(1);
  });

  it("asks peer tabs for a fresh session before rotating the refresh cookie", async () => {
    const locks = new FakeLockManager();
    const deps = { navigator: { locks }, broadcastChannel: FakeBroadcastChannel };
    initializeDashboardSessionChannel(deps);
    const peer = new FakeBroadcastChannel("availo.dashboard.session");
    peer.onmessage = (event) => {
      if (event.data?.type === "session-request") {
        peer.postMessage({ type: "session-response", requestId: event.data.requestId, session: session("peer-token") });
      }
    };

    await expect(restoreDashboardSession(deps)).resolves.toMatchObject({ accessToken: "peer-token" });

    expect(currentDashboardSession()?.accessToken).toBe("peer-token");
    expect(refreshDashboardSession).not.toHaveBeenCalled();
  });

  it("fails closed instead of refreshing when a peer session response is late", async () => {
    const locks = new FakeLockManager();
    const releasePresence = locks.hold("availo.dashboard.session-present");
    const deps = { navigator: { locks }, broadcastChannel: FakeBroadcastChannel };
    initializeDashboardSessionChannel(deps);
    const peer = new FakeBroadcastChannel("availo.dashboard.session");
    peer.onmessage = (event) => {
      if (event.data?.type === "session-request") {
        setTimeout(() => {
          peer.postMessage({ type: "session-response", requestId: event.data.requestId, session: session("late-peer-token") });
        }, 125);
      }
    };

    await expect(restoreDashboardSession(deps)).rejects.toBeInstanceOf(DashboardAuthRequiredError);

    expect(refreshDashboardSession).not.toHaveBeenCalled();
    releasePresence();
  });

  it("does not treat its own pending presence request as a peer session", async () => {
    const locks = new FakeLockManager();
    locks.queuePending("availo.dashboard.session-present");
    const deps = { navigator: { locks }, broadcastChannel: FakeBroadcastChannel };
    initializeDashboardSessionChannel(deps);
    setMemoryDashboardSession(session("stale-token"), deps);
    vi.mocked(refreshDashboardSession).mockResolvedValueOnce(session("fresh-token"));

    await expect(refreshDashboardSessionAfterStaleToken("stale-token", deps)).resolves.toMatchObject({ accessToken: "fresh-token" });

    expect(refreshDashboardSession).toHaveBeenCalledTimes(1);
  });

  it("uses broadcast handoff after a stale-token refresh", async () => {
    const locks = new FakeLockManager();
    const deps = { navigator: { locks }, broadcastChannel: FakeBroadcastChannel };
    initializeDashboardSessionChannel(deps);
    setMemoryDashboardSession(session("stale-token"));
    vi.mocked(refreshDashboardSession).mockResolvedValueOnce(session("fresh-token"));

    await expect(refreshDashboardSessionAfterStaleToken("stale-token", deps)).resolves.toMatchObject({ accessToken: "fresh-token" });
    expect(currentDashboardSession()?.accessToken).toBe("fresh-token");
  });

  it("broadcasts sign-out and clears memory after logout even when the network call fails", async () => {
    const locks = new FakeLockManager();
    const deps = { navigator: { locks }, broadcastChannel: FakeBroadcastChannel };
    initializeDashboardSessionChannel(deps);
    setMemoryDashboardSession(session("access-one"));
    vi.mocked(logoutDashboardSession).mockRejectedValueOnce(new Error("network down"));

    await expect(logoutDashboardBrowserSession(deps)).rejects.toThrow("network down");
    expect(currentDashboardSession()).toBeNull();
    expect(logoutDashboardSession).toHaveBeenCalledTimes(1);

    clearMemoryDashboardSession();
    expect(currentDashboardSession()).toBeNull();
  });

  it("notifies subscribers when session memory changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDashboardSession(listener);

    setMemoryDashboardSession(session("access-one"));
    clearMemoryDashboardSession();
    unsubscribe();
    setMemoryDashboardSession(session("access-two"));

    expect(listener).toHaveBeenNthCalledWith(1, expect.objectContaining({ accessToken: "access-one" }));
    expect(listener).toHaveBeenNthCalledWith(2, null);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  function session(accessToken: string): DashboardSession {
    return {
      accessToken,
      user: { id: "usr_test", email: "owner@example.com", businessId: "biz_test", role: "owner" }
    };
  }
});

class FakeLockManager {
  requests: string[] = [];
  private queues = new Map<string, Promise<unknown>>();
  private held = new Set<string>();
  private pending: string[] = [];

  async request<T>(name: string, callback: () => Promise<T>): Promise<T> {
    this.requests.push(name);
    const previous = this.queues.get(name) ?? Promise.resolve();
    this.pending.push(name);
    const run = previous.then(async () => {
      this.pending = this.pending.filter((item) => item !== name);
      this.held.add(name);
      try {
        return await callback();
      } finally {
        this.held.delete(name);
      }
    });
    this.queues.set(name, run.then(
      () => undefined,
      () => undefined
    ));
    return run;
  }

  async query() {
    return {
      held: [...this.held].map((name) => ({ name })),
      pending: this.pending.map((name) => ({ name }))
    };
  }

  hold(name: string) {
    this.held.add(name);
    return () => {
      this.held.delete(name);
    };
  }

  queuePending(name: string) {
    this.pending.push(name);
  }
}

class FakeBroadcastChannel {
  static channels: FakeBroadcastChannel[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(readonly name: string) {
    FakeBroadcastChannel.channels.push(this);
  }

  postMessage(message: unknown) {
    for (const channel of FakeBroadcastChannel.channels) {
      if (channel !== this && channel.name === this.name) {
        setTimeout(() => channel.onmessage?.({ data: message } as MessageEvent), 0);
      }
    }
  }

  close() {
    FakeBroadcastChannel.channels = FakeBroadcastChannel.channels.filter((channel) => channel !== this);
  }
}
