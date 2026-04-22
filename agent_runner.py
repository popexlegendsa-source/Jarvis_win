import flask
from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import os
import platform
import shutil
import sys
import time

try:
    import winsound
except ImportError:
    winsound = None

# Пытаемся импортировать pyautogui для работы с клавиатурой
try:
    import pyautogui
    # Отключаем паузу для скорости, но оставляем fail-safe (отвод мыши в угол экрана остановит скрипт)
    pyautogui.PAUSE = 0.1
except ImportError:
    pyautogui = None

# --- LOW LEVEL KEYBOARD INJECTION (SendInput via User32) ---
import ctypes
from ctypes import wintypes
import time

user32 = ctypes.WinDLL('user32', use_last_error=True)

INPUT_KEYBOARD = 1
KEYEVENTF_EXTENDEDKEY = 0x0001
KEYEVENTF_KEYUP       = 0x0002
KEYEVENTF_UNICODE     = 0x0004
KEYEVENTF_SCANCODE    = 0x0008

class KEYBDINPUT(ctypes.Structure):
    _fields_ = (("wVk",         wintypes.WORD),
                ("wScan",       wintypes.WORD),
                ("dwFlags",     wintypes.DWORD),
                ("time",        wintypes.DWORD),
                ("dwExtraInfo", wintypes.ULONG))

class INPUT(ctypes.Structure):
    class _INPUT(ctypes.Union):
        _fields_ = (("ki", KEYBDINPUT),
                    ("mi", ctypes.c_int * 7), # Not using mouse yet
                    ("hi", ctypes.c_int * 4)) # Not using hardware yet
    _anonymous_ = ("_input",)
    _fields_ = (("type",   wintypes.DWORD),
                ("_input", _INPUT))

# Virtual Key Codes Mapping (Simplified for common commands)
VK_MAP = {
    'enter': 0x0D, 'esc': 0x1B, 'tab': 0x09, 'space': 0x20, 'backspace': 0x08,
    'up': 0x26, 'down': 0x28, 'left': 0x25, 'right': 0x27,
    'win': 0x5B, 'ctrl': 0x11, 'alt': 0x12, 'shift': 0x10,
    'a': 0x41, 'b': 0x42, 'c': 0x43, 'd': 0x44, 'e': 0x45, 'f': 0x46,
    'g': 0x47, 'h': 0x48, 'i': 0x49, 'j': 0x4A, 'k': 0x4B, 'l': 0x4C,
    'm': 0x4D, 'n': 0x4E, 'o': 0x4F, 'p': 0x50, 'q': 0x51, 'r': 0x52,
    's': 0x53, 't': 0x54, 'u': 0x55, 'v': 0x56, 'w': 0x57, 'x': 0x58,
    'y': 0x59, 'z': 0x5A, '0': 0x30, '1': 0x31, '2': 0x32, '3': 0x33,
    '4': 0x34, '5': 0x35, '6': 0x36, '7': 0x37, '8': 0x38, '9': 0x39
}

def send_key_native(vk_code, is_press=True):
    x = INPUT(type=INPUT_KEYBOARD,
              ki=KEYBDINPUT(wVk=vk_code,
                            wScan=0,
                            dwFlags=0 if is_press else KEYEVENTF_KEYUP,
                            time=0,
                            dwExtraInfo=0))
    user32.SendInput(1, ctypes.byref(x), ctypes.sizeof(x))

def send_unicode_char(char):
    # Sends actual text characters natively bypassing layout issues
    surrogate_pair = char.encode('utf-16-le')
    for code_point in map(lambda c: int.from_bytes(c, 'little'), [surrogate_pair[i:i+2] for i in range(0, len(surrogate_pair), 2)]):
        down = INPUT(type=INPUT_KEYBOARD, ki=KEYBDINPUT(wVk=0, wScan=code_point, dwFlags=KEYEVENTF_UNICODE, time=0, dwExtraInfo=0))
        up = INPUT(type=INPUT_KEYBOARD, ki=KEYBDINPUT(wVk=0, wScan=code_point, dwFlags=KEYEVENTF_UNICODE | KEYEVENTF_KEYUP, time=0, dwExtraInfo=0))
        user32.SendInput(1, ctypes.byref(down), ctypes.sizeof(down))
        user32.SendInput(1, ctypes.byref(up), ctypes.sizeof(up))
# -------------------------------------------------------------

app = Flask(__name__)
CORS(app)

# Чтение токена безопасности
SECURITY_TOKEN = None
for i, arg in enumerate(sys.argv):
    if arg == '--token' and i + 1 < len(sys.argv):
        SECURITY_TOKEN = sys.argv[i + 1]

def require_auth(req):
    if not SECURITY_TOKEN: return True # Fallback for old run_local.bat without token
    auth_header = req.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        return token == SECURITY_TOKEN
    return False

def countdown_warning(action_name):
    print(f"\n[!] WARNING: Auto-Typing triggered ({action_name}). Don't touch keyboard/mouse!")
    for i in range(3, 0, -1):
        print(f"... {i} ...")
        if winsound: winsound.Beep(1000, 200)
        time.sleep(1)
    if winsound: winsound.Beep(1500, 500)

@app.route('/ping', methods=['GET'])
def ping():
    return jsonify({"status": "connected", "version": "2.14.0", "secure": SECURITY_TOKEN is not None})

@app.route('/network/connections', methods=['GET'])
def network_connections():
    # --- PROOF OF AUTHENTICATION ---
    if SECURITY_TOKEN:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"status": "error", "msg": "Unauthorized. Missing Token."}), 401
        token = auth_header.split(" ")[1]
        if token != SECURITY_TOKEN:
            return jsonify({"status": "error", "msg": "Unauthorized. Invalid Token."}), 401

    try:
        import psutil
        import socket
        
        results = []
        proc_cache = {}
        
        conns = psutil.net_connections(kind='all')
        for c in conns:
            if not c.pid or c.pid == 0: continue
            pid = c.pid
            
            if pid not in proc_cache:
                try:
                    p = psutil.Process(pid)
                    proc_cache[pid] = {
                        "ProcessName": p.name(),
                        "Path": p.exe()
                    }
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    proc_cache[pid] = {"ProcessName": "System / Service", "Path": ""}
                    
            pinfo = proc_cache[pid]
            if pinfo["ProcessName"].lower() in ["idle", "system"]: continue
            
            protocol = "UDP" if c.type == socket.SOCK_DGRAM else f"TCP {c.status}"
            raddr = c.raddr.ip if c.raddr else "*"
            rport = c.raddr.port if c.raddr else "*"
            
            results.append({
                "ProcessName": pinfo["ProcessName"],
                "PID": pid,
                "Protocol": protocol,
                "RemoteAddress": raddr,
                "RemotePort": rport,
                "Path": pinfo["Path"]
            })
            
        # Deduplicate
        unique_results = {}
        for r in results:
            key = f"{r['ProcessName']}-{r['PID']}-{r['Protocol']}-{r['RemoteAddress']}-{r['RemotePort']}-{r['Path']}"
            unique_results[key] = r
            
        data = sorted(list(unique_results.values()), key=lambda x: x['ProcessName'])
        return jsonify({"status": "success", "connections": data})
        
    except Exception as e:
        # Fallback error mapping for Access Denied if it somehow fails globally
        if "access denied" in str(e).lower():
             return jsonify({"status": "error", "msg": "Access Denied. Please restart JARVIS as Administrator."}), 403
        return jsonify({"status": "error", "msg": str(e)}), 500

@app.route('/execute', methods=['POST'])
def execute():
    # --- PROOF OF AUTHENTICATION ---
    if not require_auth(request):
        print("[!] SECURITY ALERT: Unauthorized execution attempt.")
        return jsonify({"status": "error", "msg": "Unauthorized. Invalid Token."}), 401
        
    data = request.json
    action = data.get('action')
    params = data.get('params', {})
    
    print(f"[*] Command received: {action} with {params}")
    
    try:
        # --- Системные действия (через OS) ---
        if action == 'open_app':
            import ctypes
            # ShellExecuteW: hwnd, operation, file, parameters, directory, showCmd (1 = SW_SHOWNORMAL)
            result = ctypes.windll.shell32.ShellExecuteW(None, "open", params['name'], None, None, 1)
            if result <= 32:
                # Если ShellExecute не нашел программу, пробуем открыть чере cmd как fallback (для PWA и спец. алиасов)
                os.system(f"start {params['name']}")
            return jsonify({"status": "success", "msg": f"Opened {params['name']} natively."})
            
        elif action == 'open_url':
            import ctypes
            ctypes.windll.shell32.ShellExecuteW(None, "open", params['url'], None, None, 1)
            return jsonify({"status": "success", "msg": f"Opened URL natively."})
            
        elif action == 'run_command':
            cmd = params['cmd']
            try:
                import tempfile
                import uuid
                # Записываем команду в .ps1 файл, чтобы избежать любых проблем с экранированием кавычек
                script_path = os.path.join(tempfile.gettempdir(), f"jarvis_cmd_{uuid.uuid4().hex}.ps1")
                with open(script_path, "w", encoding="utf-8-sig") as f:
                    f.write(cmd + "\n")
                    f.write("if (!$?) { Write-Host '--- Error Executing Command ---' -ForegroundColor Red; Read-Host 'Press Enter to close' }\n")
                    f.write("else { Start-Sleep -Seconds 2 }")
                
                # NATIVE Windows popup console (bypasses CMD entirely, opens raw Powershell window)
                CREATE_NEW_CONSOLE = 0x00000010
                subprocess.Popen(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script_path], creationflags=CREATE_NEW_CONSOLE)
                
                return jsonify({"status": "success", "msg": "Command launched in a visible PowerShell window."})
            except Exception as e:
                return jsonify({"status": "error", "msg": str(e)})
            
        elif action == 'system_control':
            act = params['action']
            import ctypes
            if act == 'shutdown': 
                # ExitWindowsEx requires token privileges, using Advanced API is safer
                os.system("shutdown /s /t 60")
            elif act == 'restart': 
                os.system("shutdown /r /t 60")
            elif act == 'sleep': 
                # Native call to PowrProf.dll for sleep state
                ctypes.windll.PowrProf.SetSuspendState(0, 1, 0)
            elif act == 'toggle_desktop':
                # Minimize all windows locally using shell
                shell = ctypes.windll.ole32.CoInitialize(None)
                import win32com.client
                shell = win32com.client.Dispatch("Shell.Application")
                shell.ToggleDesktop()
            return jsonify({"status": "success", "msg": f"Executed native {act}"})

        # --- Действия с файлами ---
        elif action == 'file_operation':
            op = params.get('operation')
            path = params.get('path')
            content = params.get('content', '')
            
            if op == 'create':
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
                return jsonify({"status": "success", "msg": f"Created {path}"})
            elif op == 'delete':
                import glob
                expanded_path = os.path.expandvars(path)
                matches = glob.glob(expanded_path)
                
                if matches:
                    for match in matches:
                        try:
                            if os.path.isdir(match): shutil.rmtree(match)
                            else: os.remove(match)
                        except Exception as e:
                            print(f"[!] Failed to delete {match}: {e}")
                    return jsonify({"status": "success", "msg": f"Deleted {len(matches)} items matching {path}"})
                else:
                    return jsonify({"status": "success", "msg": "Target not found (already deleted or wrong path)."})
            elif op == 'read':
                if os.path.exists(path):
                    with open(path, 'r', encoding='utf-8') as f:
                        return jsonify({"status": "success", "content": f.read()})
                return jsonify({"status": "error", "msg": "File not found"}), 404

        elif action == 'network_filter':
            net_action = params.get('net_action')
            process_identifier = params.get('process_info', '') # Can be path or name
            
            if net_action == 'list_active':
                ps_script = "(Get-NetTCPConnection -State Established).OwningProcess | Select-Object -Unique | ForEach-Object { try { (Get-Process -Id $_ -ErrorAction Stop).Path } catch { } } | Where-Object { $_ -ne $null }"
                out = subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, text=True)
                return jsonify({"status": "success", "msg": "Active network processes:\n" + out.stdout.strip()})
                
            elif net_action == 'block':
                if not process_identifier:
                    return jsonify({"status": "error", "msg": "process_info is required for blocking"})
                    
                path = process_identifier
                # If it's just a name (e.g. chrome, chrome.exe), try to resolve it
                if "\\" not in path:
                    name = path.replace('.exe', '')
                    ps_script = f"(Get-Process -Name '{name}' -ErrorAction SilentlyContinue).Path | Select-Object -First 1"
                    out = subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, text=True)
                    resolved_path = out.stdout.strip()
                    if resolved_path: path = resolved_path
                
                if "\\" not in path:
                    return jsonify({"status": "error", "msg": f"Could not determine full path for {process_identifier}."})
                    
                import hashlib
                rule_hash = hashlib.md5(path.encode()).hexdigest()[:8]
                rule_name = f"JARVIS_BLOCK_{rule_hash}"
                # Needs Admin. Assuming run_local.bat requested Admin.
                ps_script = f"New-NetFirewallRule -DisplayName '{rule_name}' -Direction Outbound -Program '{path}' -Action Block; New-NetFirewallRule -DisplayName '{rule_name}' -Direction Inbound -Program '{path}' -Action Block"
                out = subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, text=True)
                
                if out.returncode == 0:
                    return jsonify({"status": "success", "msg": f"Success: Blocked internet access for {path}"})
                else:
                    return jsonify({"status": "error", "msg": f"Failed to block (Ensure JARVIS is running as Administrator): {out.stderr}"})
            
            elif net_action == 'unblock':
                if not process_identifier:
                    return jsonify({"status": "error", "msg": "process_info is required for unblocking"})
                
                import hashlib
                rule_hash = hashlib.md5(process_identifier.encode()).hexdigest()[:8]
                rule_name = f"JARVIS_BLOCK_{rule_hash}"
                ps_script = f"Remove-NetFirewallRule -DisplayName '{rule_name}' -ErrorAction Stop"
                out = subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, text=True)
                if out.returncode == 0:
                    return jsonify({"status": "success", "msg": f"Success: Unblocked internet access for {process_identifier}"})
                else:
                    return jsonify({"status": "error", "msg": f"Failed to unblock rule {rule_name}: {out.stderr}"})

        # --- Ввод (Клавиатура/Мышь) ---
        elif action == 'press_keys':
            countdown_warning("Native Press Keys")
            keys = params.get('keys', '').lower().split('+')
            # Нажимаем все клавиши (keydown)
            for k in keys:
                vk = VK_MAP.get(k)
                if vk: 
                    send_key_native(vk, is_press=True)
                    time.sleep(0.05) # Небольшая задержка для игр
            # Отпускаем в обратном порядке (keyup)
            for k in reversed(keys):
                vk = VK_MAP.get(k)
                if vk: 
                    send_key_native(vk, is_press=False)
                    time.sleep(0.01)
            return jsonify({"status": "success", "msg": "Executed low-level Native keypress"})

        elif action == 'type_text':
            countdown_warning("Native Type Text")
            text = params.get('text', '')
            for char in text:
                send_unicode_char(char)
                time.sleep(0.005) # Эмуляция скорости печати человека
            return jsonify({"status": "success", "msg": "Executed low-level Native Unicode typing"})

        return jsonify({"status": "error", "msg": "Unknown action"}), 400
        
    except Exception as e:
        print(f"[!] Error: {str(e)}")
        return jsonify({"status": "error", "msg": str(e)}), 500

if __name__ == '__main__':
    print("--- JARVIS Automation Runner v2.14.0 ---")
    if SECURITY_TOKEN:
        print("[SECURE MODE] Local runner locked with Access Token.")
    else:
        print("[WARNING] Local runner started WITHOUT token security. Vulnerable to RCE.")
        
    if not pyautogui:
        print("[!] WARNING: PyAutoGUI is missing. Keyboard/Mouse commands will NOT work.")
        print("[!] RUN: pip install pyautogui")
    
    print("Listening on http://127.0.0.1:5000")
    app.run(host='127.0.0.1', port=5000)
