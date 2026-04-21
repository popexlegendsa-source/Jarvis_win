import { CURRENT_VERSION } from "../constants";

export class VersionManager {
  // Developer Workflow: Instead of checking versions on GitHub,
  // we trigger a synchronization command on your local machine.
  static async syncCode(): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000); // 2-second timeout

    try {
      const resp = await fetch('http://127.0.0.1:5000/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'git_pull' }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      return resp.ok;
    } catch (e) {
      clearTimeout(timeout);
      console.error("Failed to trigger git sync", e);
      return false;
    }
  }
}
