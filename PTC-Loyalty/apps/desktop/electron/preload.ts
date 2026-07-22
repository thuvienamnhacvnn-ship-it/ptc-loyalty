import { contextBridge, ipcRenderer } from "electron";

// The renderer never touches tokens or the network directly. Everything goes
// through this minimal, typed IPC bridge (see shared.d.ts for the Window.pos
// type). Event listeners are wrapped so the renderer cannot access ipcRenderer.
const bridge = {
  status: () => ipcRenderer.invoke("pos:status"),
  ping: () => ipcRenderer.invoke("pos:ping"),

  login: (email: string, password: string, deviceLabel: string) =>
    ipcRenderer.invoke("pos:login", email, password, deviceLabel),
  logout: () => ipcRenderer.invoke("pos:logout"),
  me: () => ipcRenderer.invoke("pos:me"),

  search: (q: string) => ipcRenderer.invoke("pos:search", q),
  resolveQr: (token: string) => ipcRenderer.invoke("pos:resolveQr", token),
  customerDetail: (id: string) => ipcRenderer.invoke("pos:customerDetail", id),
  createCustomer: (input: unknown) => ipcRenderer.invoke("pos:createCustomer", input),
  customerQr: (id: string) => ipcRenderer.invoke("pos:customerQr", id),
  whatsappMessages: (limit?: number) => ipcRenderer.invoke("pos:whatsappMessages", limit),
  whatsappSend: (input: unknown) => ipcRenderer.invoke("pos:whatsappSend", input),
  preview: (customerId: string, amount: number) =>
    ipcRenderer.invoke("pos:preview", customerId, amount),

  earn: (input: unknown) => ipcRenderer.invoke("pos:earn", input),
  redeem: (input: unknown) => ipcRenderer.invoke("pos:redeem", input),
  voucherRedeem: (code: string) => ipcRenderer.invoke("pos:voucherRedeem", code),
  rewards: () => ipcRenderer.invoke("pos:rewards"),

  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (patch: unknown) => ipcRenderer.invoke("settings:set", patch),
  listPrinters: () => ipcRenderer.invoke("settings:printers"),

  queueList: () => ipcRenderer.invoke("queue:list"),
  queueCount: () => ipcRenderer.invoke("queue:count"),
  queueEnqueue: (item: unknown) => ipcRenderer.invoke("queue:enqueue", item),
  queueSync: () => ipcRenderer.invoke("queue:sync"),

  printReceipt: (data: unknown) => ipcRenderer.invoke("print:receipt", data),

  toggleFullscreen: () => ipcRenderer.invoke("window:toggleFullscreen"),
  setKiosk: (on: boolean) => ipcRenderer.invoke("window:setKiosk", on),

  installUpdate: () => ipcRenderer.invoke("update:install"),
  onUpdate: (cb: (channel: string, payload: unknown) => void) => {
    const channels = [
      "update:available",
      "update:progress",
      "update:ready",
      "update:error",
    ];
    const listeners = channels.map((ch) => {
      const l = (_e: unknown, payload: unknown) => cb(ch, payload);
      ipcRenderer.on(ch, l);
      return { ch, l };
    });
    return () => listeners.forEach(({ ch, l }) => ipcRenderer.removeListener(ch, l));
  },
};

contextBridge.exposeInMainWorld("pos", bridge);
