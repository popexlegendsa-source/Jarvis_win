import tkinter as tk
from tkinter import scrolledtext
import subprocess
import threading
import os
import sys
import ctypes
import webbrowser
import time
import random
import string
import shutil

CREATE_NO_WINDOW = 0x08000000

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

class LauncherApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("JARVIS Control Center")
        self.geometry("750x550")
        self.configure(bg="#121215")
        
        self.backend_proc = None
        self.frontend_proc = None
        
        self.token = self.get_token()
        self.build_ui()
        
    def get_token(self):
        if os.path.exists(".agent_token"):
            with open(".agent_token", "r") as f:
                t = f.read().strip()
            if t: return t
        tk_val = ''.join(random.choices(string.ascii_uppercase + string.digits, k=16))
        with open(".agent_token", "w") as f:
            f.write(tk_val)
        return tk_val

    def build_ui(self):
        header = tk.Frame(self, bg="#1e1e24", height=80)
        header.pack(fill=tk.X, side=tk.TOP)
        
        title = tk.Label(header, text="JARVIS UI & SERVER", bg="#1e1e24", fg="#ffffff", font=("Segoe UI", 16, "bold"))
        title.pack(side=tk.LEFT, padx=30, pady=25)
        
        if not is_admin():
            admin_btn = tk.Button(header, text="Restart as Admin (Network Features)", bg="#b02a2a", fg="white", font=("Segoe UI", 10, "bold"), relief=tk.FLAT, command=self.restart_admin)
            admin_btn.pack(side=tk.RIGHT, padx=30, pady=25, ipadx=10, ipady=4)
        else:
            admin_lbl = tk.Label(header, text="Running as Administrator", bg="#1e1e24", fg="#4CAF50", font=("Segoe UI", 11, "bold"))
            admin_lbl.pack(side=tk.RIGHT, padx=30, pady=25)

        controls = tk.Frame(self, bg="#121215", pady=10)
        controls.pack(fill=tk.X)
        
        buttons_frame = tk.Frame(controls, bg="#121215")
        buttons_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.start_btn = tk.Button(buttons_frame, text="▶ Start JARVIS", bg="#0066cc", fg="white", font=("Segoe UI", 11, "bold"), relief=tk.FLAT, command=self.start_all)
        self.start_btn.pack(side=tk.LEFT, padx=15, ipadx=10, ipady=5)
        
        self.stop_btn = tk.Button(buttons_frame, text="■ Stop All", bg="#444444", fg="white", font=("Segoe UI", 11, "bold"), relief=tk.FLAT, state=tk.DISABLED, command=self.stop_all)
        self.stop_btn.pack(side=tk.LEFT, padx=5, ipadx=10, ipady=5)

        self.update_btn = tk.Button(buttons_frame, text="🔄 Force Update & Rebuild", bg="#cc6600", fg="white", font=("Segoe UI", 10, "bold"), relief=tk.FLAT, command=self.force_update)
        self.update_btn.pack(side=tk.LEFT, padx=15, ipadx=10, ipady=5)
        
        self.browser_btn = tk.Button(buttons_frame, text="🌐 Dashboard", bg="#2b2b2b", fg="white", font=("Segoe UI", 11), relief=tk.FLAT, command=lambda: webbrowser.open("http://localhost:3000"))
        self.browser_btn.pack(side=tk.RIGHT, padx=15, ipadx=10, ipady=5)

        token_frame = tk.Frame(controls, bg="#1a1a20", pady=10)
        token_frame.pack(fill=tk.X, padx=30)
        
        token_lbl = tk.Label(token_frame, text="Local Bridge Token:", bg="#1a1a20", fg="#888888", font=("Segoe UI", 10, "bold"))
        token_lbl.pack(side=tk.LEFT, padx=(15, 5))
        
        token_entry = tk.Entry(token_frame, width=22, bg="#111111", fg="#00ff00", font=("Consolas", 12, "bold"), relief=tk.FLAT, justify="center")
        token_entry.insert(0, self.token)
        token_entry.config(state="readonly")
        token_entry.pack(side=tk.LEFT, padx=5, ipady=4)
        
        copy_btn = tk.Button(token_frame, text="📋 Copy", bg="#444444", fg="white", font=("Segoe UI", 9, "bold"), relief=tk.FLAT, command=self.copy_token)
        copy_btn.pack(side=tk.LEFT, padx=5, ipadx=8, ipady=2)

        log_frame = tk.Frame(self, bg="#121215")
        log_frame.pack(fill=tk.BOTH, expand=True, padx=30, pady=(0, 30))
        
        log_lbl = tk.Label(log_frame, text="System Logs (Agent & Dashboard)", bg="#121215", fg="#888888", font=("Segoe UI", 10))
        log_lbl.pack(anchor=tk.W, pady=(0, 8))

        self.log_area = scrolledtext.ScrolledText(log_frame, bg="#0a0a0c", fg="#00ff00", font=("Consolas", 10), relief=tk.FLAT, borderwidth=1, insertbackground="white")
        self.log_area.pack(fill=tk.BOTH, expand=True)
        
        self.log("[SYSTEM] Control Center ready.")
        self.log("[SYSTEM] Welcome to JARVIS. Waiting for user to press Start...")

    def copy_token(self):
        self.clipboard_clear()
        self.clipboard_append(self.token)
        self.log(f"[SYSTEM] Bridge Token copied to clipboard: {self.token}")

    def log(self, msg):
        self.log_area.insert(tk.END, msg + "\n")
        self.log_area.see(tk.END)
        
    def restart_admin(self):
        try:
            ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, " ".join(sys.argv), None, 1)
            sys.exit()
        except:
            pass

    def force_update(self):
        self.log("[UPDATE] Force syncing with GitHub (resetting local changes)...")
        self.update_btn.config(state=tk.DISABLED)
        threading.Thread(target=self._run_force_update, daemon=True).start()

    def _run_force_update(self):
        if not os.path.exists(".git"):
            self.after(0, self.log, "[ERROR] Not a Git repository. Cannot auto-update.")
            self.after(0, lambda: self.update_btn.config(state=tk.NORMAL))
            return
            
        try:
            self.after(0, self.log, "[UPDATE] 1/3 Fetching latest code...")
            subprocess.run(["git", "fetch", "--all"], capture_output=True, text=True, creationflags=CREATE_NO_WINDOW)
            
            self.after(0, self.log, "[UPDATE] 2/3 Hard resetting local project to origin/main...")
            reset_proc = subprocess.run(["git", "reset", "--hard", "origin/main"], capture_output=True, text=True, creationflags=CREATE_NO_WINDOW)
            self.after(0, self.log, reset_proc.stdout.strip())
            
            self.after(0, self.log, "[UPDATE] 3/3 Generating new assistant.exe in the background...")
            npm_path = shutil.which("npm.cmd") or shutil.which("npm") or "npm.cmd"
            subprocess.run([npm_path, "install"], creationflags=CREATE_NO_WINDOW)
            
            # Re-compile
            if os.path.exists("build_assistant_exe.bat"):
                subprocess.Popen(["cmd.exe", "/c", "start", "build_assistant_exe.bat"])
                self.after(0, self.log, "[SUCCESS] Update complete! The compiler window popped up to build the new EXE.")
                self.after(0, self.log, "[!] PLEASE CLOSE THIS WINDOW AND LAUNCH THE NEW assistant.exe ONCE IT IS DONE BUILDING.")
            else:
                self.after(0, self.log, "[SUCCESS] Update complete! Restart the script.")
                
        except Exception as e:
            self.after(0, self.log, f"[UPDATE ERROR] {e}")
        finally:
            self.after(0, lambda: self.update_btn.config(state=tk.NORMAL))

    def read_stream(self, pipe, prefix):
        try:
            for line in iter(pipe.readline, b''):
                decoded = line.decode('utf-8', errors='replace').strip()
                if decoded:
                    self.after(0, self.log, f"[{prefix}] {decoded}")
        except:
            pass

    def kill_ports(self):
        self.log("[SYSTEM] Releasing ports 3000 and 5000...")
        subprocess.run("for /f \"tokens=5\" %a in ('netstat -aon ^| findstr :3000') do taskkill /f /pid %a >nul 2>&1", shell=True, creationflags=CREATE_NO_WINDOW)
        subprocess.run("for /f \"tokens=5\" %a in ('netstat -aon ^| findstr :5000') do taskkill /f /pid %a >nul 2>&1", shell=True, creationflags=CREATE_NO_WINDOW)

    def start_all(self):
        self.start_btn.config(state=tk.DISABLED, bg="#444444")
        self.stop_btn.config(state=tk.NORMAL, bg="#cc0000")
        threading.Thread(target=self._run_processes, daemon=True).start()

    def _run_processes(self):
        self.kill_ports()
        
        # Git Auto-Pull
        if os.path.exists(".git") and shutil.which("git"):
            self.after(0, self.log, "[SYSTEM] Checking for JARVIS updates from GitHub...")
            pull_proc = subprocess.run(["git", "pull"], capture_output=True, text=True, creationflags=CREATE_NO_WINDOW)
            if pull_proc.stdout:
                for line in pull_proc.stdout.strip().split('\n'):
                    self.after(0, self.log, f"[GIT] {line}")
            if pull_proc.returncode != 0 and pull_proc.stderr:
                for line in pull_proc.stderr.strip().split('\n'):
                    self.after(0, self.log, f"[GIT ERROR] {line}")
                self.after(0, self.log, "[SYSTEM] Minor GIT issue detected. Update might have failed. Use 'Force Update' if UI seems broken.")
        
        npm_path = shutil.which("npm.cmd") or shutil.which("npm") or "npm.cmd"
        if not os.path.exists("node_modules"):
            self.after(0, self.log, "[SYSTEM] First run: Installing Node modules (this takes a minute)...")
            subprocess.run([npm_path, "install"], creationflags=CREATE_NO_WINDOW)
            
        python_path = shutil.which("python") or "python"
        self.after(0, self.log, "[SYSTEM] Validating Python dependencies...")
        subprocess.run([python_path, "-m", "pip", "install", "flask", "flask-cors", "pyautogui", "psutil", "--quiet"], creationflags=CREATE_NO_WINDOW)

        try:
            self.after(0, self.log, "[SYSTEM] Spawning Python AI Agent background process...")
            self.backend_proc = subprocess.Popen(
                [python_path, "agent_runner.py", "--token", self.token],
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                creationflags=CREATE_NO_WINDOW
            )
            threading.Thread(target=self.read_stream, args=(self.backend_proc.stdout, "BACKEND"), daemon=True).start()
            
            npx_path = shutil.which("npx.cmd") or shutil.which("npx") or "npx.cmd"
            self.after(0, self.log, "[SYSTEM] Spawning Vite DOM Dashboard process...")
            self.frontend_proc = subprocess.Popen(
                [npx_path, "vite", "--port=3000", "--host=127.0.0.1"],
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                creationflags=CREATE_NO_WINDOW
            )
            threading.Thread(target=self.read_stream, args=(self.frontend_proc.stdout, "DASHBOARD"), daemon=True).start()
            
            time.sleep(3)
            self.after(0, self.log, "[SYSTEM] Handshake complete. Launching browser...")
            webbrowser.open("http://localhost:3000")
            
        except Exception as e:
            self.after(0, self.log, f"[ERROR] Execution failed: {e}")
            self.after(0, self.stop_all)

    def stop_all(self):
        self.log("[SYSTEM] Powering down subsystems...")
        if self.backend_proc:
            try: self.backend_proc.terminate()
            except: pass
        if self.frontend_proc:
            try: subprocess.run(f"taskkill /f /t /pid {self.frontend_proc.pid} >nul 2>&1", shell=True, creationflags=CREATE_NO_WINDOW)
            except: pass
            
        self.kill_ports()
        self.start_btn.config(state=tk.NORMAL, bg="#0066cc")
        self.stop_btn.config(state=tk.DISABLED, bg="#444444")
        self.log("[SYSTEM] All servers offline.")

    def on_closing(self):
        self.stop_all()
        self.destroy()

if __name__ == "__main__":
    app = LauncherApp()
    app.protocol("WM_DELETE_WINDOW", app.on_closing)
    app.mainloop()
