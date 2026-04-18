# WinAutomate Agent v2.4.2

WinAutomate is a powerful, privacy-focused Windows automation assistant. It allows you to control your PC through natural language dialogue while ensuring all commands are executed locally and securely.

## 🚀 Key Features
- **Natural Language Commands**: Open apps, URLs, type text, and control system power.
- **Local Execution**: All system commands run via a private Python runner on `127.0.0.1`.
- **Persistent Memory**: The agent remembers your name, preferences, and workspace paths across sessions.
- **Privacy First**: Configured to run only on `localhost`, preventing external access.
- **Model Flexibility**: Choose between Gemini 1.5 Pro, Flash, or Flash-Lite based on your needs.

## 🛠 Installation & Setup
For detailed instructions, see [INSTALL_WINDOWS.md](./INSTALL_WINDOWS.md).

### Quick Start:
1. Ensure you have **Node.js** and **Python** installed.
2. Run `run_local.bat`.
3. Open `http://localhost:3000` in your browser.
4. Go to **Settings** and enter your **Gemini API Key**.

## 📂 Project Structure
- `/src`: Frontend React application.
- `agent_runner.py`: Secure Python backend for executing Windows commands.
- `run_local.bat`: One-click launcher for Windows.
- `CHANGELOG.md`: History of hotfixes and updates.

## 🔒 Security
This application is designed for **personal use only**. By default, it binds to `127.0.0.1`, meaning it is not accessible from the internet or other devices on your network.
