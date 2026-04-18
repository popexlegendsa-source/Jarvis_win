import flask
from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import os
import platform
import shutil

# Пытаемся импортировать pyautogui для работы с клавиатурой
try:
    import pyautogui
    # Отключаем паузу для скорости, но оставляем fail-safe (отвод мыши в угол экрана остановит скрипт)
    pyautogui.PAUSE = 0.1
except ImportError:
    pyautogui = None

app = Flask(__name__)
CORS(app)

@app.route('/execute', methods=['POST'])
def execute():
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
            subprocess.Popen(['cmd', '/c', 'start', 'cmd', '/k', cmd], shell=True)
            return jsonify({"status": "success"})
            
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
                if os.path.exists(path):
                    if os.path.isdir(path): shutil.rmtree(path)
                    else: os.remove(path)
                return jsonify({"status": "success"})
            elif op == 'read':
                if os.path.exists(path):
                    with open(path, 'r', encoding='utf-8') as f:
                        return jsonify({"status": "success", "content": f.read()})
                return jsonify({"status": "error", "msg": "File not found"}), 404

        # --- Ввод (Клавиатура/Мышь) ---
        elif action == 'press_keys':
            if not pyautogui: return jsonify({"status": "error", "msg": "PyAutoGUI not installed"}), 500
            keys = params.get('keys', '').lower().split('+')
            # Пример: 'ctrl+shift+w' -> ['ctrl', 'shift', 'w']
            pyautogui.hotkey(*keys)
            return jsonify({"status": "success"})

        elif action == 'type_text':
            if not pyautogui: return jsonify({"status": "error", "msg": "PyAutoGUI not installed"}), 500
            text = params.get('text', '')
            pyautogui.write(text, interval=0.01)
            return jsonify({"status": "success"})

        return jsonify({"status": "error", "msg": "Unknown action"}), 400
        
    except Exception as e:
        print(f"[!] Error: {str(e)}")
        return jsonify({"status": "error", "msg": str(e)}), 500

if __name__ == '__main__':
    print("--- JARVIS Automation Runner v2.7.2 ---")
    if not pyautogui:
        print("[!] WARNING: PyAutoGUI is missing. Keyboard/Mouse commands will NOT work.")
        print("[!] RUN: pip install pyautogui")
    
    print("Listening on http://127.0.0.1:5000")
    app.run(host='127.0.0.1', port=5000)
