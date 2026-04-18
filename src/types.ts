export type CommandAction = 
  | "open_app" 
  | "open_url" 
  | "type_text" 
  | "press_keys" 
  | "run_command" 
  | "system_control" 
  | "file_operation"
  | "update_memory"
  | "رفض";

export interface UserMemory {
  [key: string]: any;
}

export interface CommandResponse {
  message: string;
  command?: {
    action: CommandAction;
    params?: any;
    reason?: string;
  };
}

export interface HistoryItem {
  id: string;
  role: 'user' | 'model';
  content: string;
  metadata?: CommandResponse;
  timestamp: string;
}
