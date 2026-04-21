import { CURRENT_VERSION, VERSION_URL } from "../constants";

export class VersionManager {
  static async check(): Promise<{ available: boolean, version: string, downloadUrl?: string }> {
    try {
      const res = await fetch(VERSION_URL);
      const data = await res.json();
      return { 
        available: data.version !== CURRENT_VERSION, 
        version: data.version,
        downloadUrl: data.downloadUrl
      };
    } catch (e) {
      console.error("Failed to check for updates", e);
      return { available: false, version: CURRENT_VERSION };
    }
  }

  static async triggerUpdate(downloadUrl: string): Promise<boolean> {
    try {
      const resp = await fetch('http://127.0.0.1:5000/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: downloadUrl })
      });
      return resp.ok;
    } catch (e) {
      console.error("Local runner update endpoint error", e);
      return false;
    }
  }
}
