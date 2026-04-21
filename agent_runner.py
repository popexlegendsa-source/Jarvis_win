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
    return jsonify({"status": "connected", "version": "2.11.2", "secure": SECURITY_TOKEN is not None})

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

    ps_script = """
    $tcp = Get-NetTCPConnection -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Established' -or $_.State -eq 'Listen' }
    $udp = Get-NetUDPEndpoint -ErrorAction SilentlyContinue
    $results = @()
    
    foreach ($c in $tcp) {
        $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
        $results += [PSCustomObject]@{
            ProcessName = if ($proc) { $proc.ProcessName } else { "Unknown" }
            PID = $c.OwningProcess
            Protocol = "TCP " + $c.State
            RemoteAddress = $c.RemoteAddress
            RemotePort = $c.RemotePort
            Path = if ($proc) { $proc.Path } else { "" }
        }
    }
    
    foreach ($c in $udp) {
        $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
        $results += [PSCustomObject]@{
            ProcessName = if ($proc) { $proc.ProcessName } else { "Unknown" }
            PID = $c.OwningProcess
            Protocol = "UDP"
            RemoteAddress = "*"
            RemotePort = "*"
            Path = if ($proc) { $proc.Path } else { "" }
        }
    }
    
    $results | Where-Object { $_.ProcessName -ne 'Unknown' -and $_.ProcessName -ne 'Idle' } | Select-Object -Unique ProcessName, PID, Protocol, RemoteAddress, RemotePort, Path | Sort-Object ProcessName | ConvertTo-Json -Compress
    """
    try:
        out = subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, text=True)
        import json
        data = json.loads(out.stdout) if out.stdout.strip() else []
        if not isinstance(data, list):
            data = [data]
        return jsonify({"status": "success", "connections": data})
    except Exception as e:
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
            os.system(f"start {params['name']}")
            return jsonify({"status": "success"})
            
        elif action == 'open_url':
            os.system(f"start {params['url']}")
            return jsonify({"status": "success"})
            
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
            if act == 'shutdown': os.system("shutdown /s /t 60")
            elif act == 'restart': os.system("shutdown /r /t 60")
            elif act == 'sleep': os.system("rundll32.exe powrprof.dll,SetSuspendState 0,1,0")
            return jsonify({"status": "success"})

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
                    
                rule_name = f"JARVIS_BLOCK_{os.path.basename(path)}"
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
                
                base_name = os.path.basename(process_identifier)
                rule_name = f"JARVIS_BLOCK_{base_name}"
                ps_script = f"Remove-NetFirewallRule -DisplayName '{rule_name}' -ErrorAction SilentlyContinue"
                subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, text=True)
                return jsonify({"status": "success", "msg": f"Success: Unblocked internet access for JARVIS_BLOCK_{base_name}"})

        # --- Ввод (Клавиатура/Мышь) ---
        elif action == 'press_keys':
            if not pyautogui: return jsonify({"status": "error", "msg": "PyAutoGUI not installed"}), 500
            countdown_warning("Press Keys")
            keys = params.get('keys', '').lower().split('+')
            pyautogui.hotkey(*keys)
            return jsonify({"status": "success"})

        elif action == 'type_text':
            if not pyautogui: return jsonify({"status": "error", "msg": "PyAutoGUI not installed"}), 500
            countdown_warning("Type Text")
            text = params.get('text', '')
            pyautogui.write(text, interval=0.01)
            return jsonify({"status": "success"})

        return jsonify({"status": "error", "msg": "Unknown action"}), 400
        
    except Exception as e:
        print(f"[!] Error: {str(e)}")
        return jsonify({"status": "error", "msg": str(e)}), 500

if __name__ == '__main__':
    print("--- JARVIS Automation Runner v2.11.2 ---")
    if SECURITY_TOKEN:
        print("[SECURE MODE] Local runner locked with Access Token.")
    else:
        print("[WARNING] Local runner started WITHOUT token security. Vulnerable to RCE.")
        
    if not pyautogui:
        print("[!] WARNING: PyAutoGUI is missing. Keyboard/Mouse commands will NOT work.")
        print("[!] RUN: pip install pyautogui")
    
    print("Listening on http://127.0.0.1:5000")
    app.run(host='127.0.0.1', port=5000)
