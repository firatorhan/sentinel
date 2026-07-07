export type TabInfo = {
  tabId: string;
  url: string;
  title: string;
  connectedAt: number;
  lastActiveAt?: number;
};

// Bağlı sekmelerin kaydı. tab_id verilmeyen tool çağrıları son aktif
// sekmeye gider; hiç aktiflik sinyali gelmediyse ilk bağlanan sekme aktiftir.
export class TabRegistry {
  private tabs = new Map<string, TabInfo>();
  private activeTabId: string | null = null;

  register(info: { tabId: string; url: string; title: string }): void {
    this.tabs.set(info.tabId, { ...info, connectedAt: Date.now() });
    if (!this.activeTabId) this.activeTabId = info.tabId;
  }

  markActive(tabId: string): void {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    this.activeTabId = tabId;
    tab.lastActiveAt = Date.now();
  }

  remove(tabId: string): void {
    this.tabs.delete(tabId);
    if (this.activeTabId === tabId) {
      this.activeTabId = this.tabs.keys().next().value ?? null;
    }
  }

  resolve(tabId?: string): TabInfo | undefined {
    if (tabId) return this.tabs.get(tabId);
    return this.activeTabId ? this.tabs.get(this.activeTabId) : undefined;
  }

  list(): (TabInfo & { active: boolean })[] {
    return Array.from(this.tabs.values()).map((tab) => ({
      ...tab,
      active: tab.tabId === this.activeTabId,
    }));
  }
}
