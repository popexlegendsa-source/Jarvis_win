import { ParsedCommand } from "../command/CommandParser";

export class ActionExecutor {
  private bridgeToken: string;

  constructor(bridgeToken: string) {
    this.bridgeToken = bridgeToken;
  }

  async execute(command: ParsedCommand): Promise<string> {
    if (command.action === 'update_memory') {
      return "Memory updated";
    }

    try {
      const runnerRes = await fetch('http://127.0.0.1:5000/execute', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.bridgeToken}`
        },
        body: JSON.stringify(command)
      });
      const runnerData = await runnerRes.json();
      
      if (runnerData.status === 'error') {
          return `\n\n[SYSTEM ERROR]: ${runnerData.msg}`;
      } else if (runnerData.msg) {
          return `\n\n[SYSTEM SUCCESS]: ${runnerData.msg}`;
      }
      return "";
    } catch (e) {
      console.log("Local runner not responding", e);
      return `\n\n[SYSTEM ERROR]: Local runner not responding. Please make sure run_local.bat is running.`;
    }
  }
}
