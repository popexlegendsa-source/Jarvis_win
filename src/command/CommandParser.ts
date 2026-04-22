import { ParsedCommand } from "../types";

export class CommandParser {
  static parse(jsonText: string): { message: string, command?: ParsedCommand } {
    try {
      const parsed = JSON.parse(jsonText);
      if (parsed.command && typeof parsed.command.params === 'string') {
          // If params is a string instead of expected object, try to make it an object
          parsed.command.params = { url: parsed.command.params };
      }
      return parsed;
    } catch (e) {
      throw new Error("Invalid command format");
    }
  }
}
