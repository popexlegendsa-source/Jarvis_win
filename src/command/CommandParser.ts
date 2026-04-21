import { ParsedCommand } from "../types";

export class CommandParser {
  static parse(jsonText: string): { message: string, command?: ParsedCommand } {
    try {
      return JSON.parse(jsonText);
    } catch (e) {
      throw new Error("Invalid command format");
    }
  }
}
