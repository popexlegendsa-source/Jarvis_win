# Changelog - JARVIS Agent

## [2.9.7] - 2026-04-18
### Changed
- **Restored Visible Command Execution**: Based on user feedback ("you used to at least run commands, but now it's absolute nothing"), the hidden background execution for PowerShell commands was reverted. However, to solve the original parsing bugs, the commands are now physically saved into a temporary `.ps1` (PowerShell script) file in the `%TEMP%` directory before execution. This completely eliminates all escaping/quoting hell from Python while restoring the satisfying visual feedback of a popping-up console window. The window will auto-close on success or deliberately pause if an error occurs so the user can read the output!

## [2.9.6] - 2026-04-18
### Changed
- **PowerShell Migration**: Users requested moving away from the archaic and buggy `cmd.exe`. In `agent_runner.py`, `run_command` has been entirely rebuilt to strictly use PowerShell native execution (`powershell -ExecutionPolicy Bypass -Command`). Along with this, the `App.tsx` AI System Prompt was explicitly updated so that JARVIS now natively speaks and executes standard PowerShell syntax instead of CMD syntax. This grants massive improvements for file operations, fetching system processes, and handling variables.

## [2.9.5] - 2026-04-18
### Added
- **Native Wildcard Deletion**: Rewrote `file_operation` -> `delete` to handle Windows environment variables (like `%USERPROFILE%`) and wildcard parsing (`*`) natively in Python. This bypasses the notoriously fragile syntax of the Windows CMD `for /d` loop entirely, making commands sent by JARVIS 100% resilient when cleaning up Downloads or temp directories.

## [2.9.4] - 2026-04-18
### Fixed
- **Subprocess CMD Stability**: Completely rewrote the `run_command` logic in `agent_runner.py`. Previously, it spawned visible `start cmd /k` popups which struggled with complex loop variable evaluation (like `%d`). Now, it leverages deep `subprocess.run(shell=True)` which executes entirely invisibly in the background. Features real-time output capturing natively returned back to JARVIS (timeout of 60s), meaning JARVIS now instantly sees execution success or failure of your console commands!

## [2.9.3] - 2026-04-18
### Fixed
- **CMD Syntax Escaping in Python**: Fixed a critical bug in `agent_runner.py`'s `run_command` logic where complex Windows CMD commands containing quotes and variables (like `for /d %d` loops) were failing. This was caused by Python's `subprocess` list-to-string conversion escaping inner double-quotes as `\"`, which CMD natively rejects. It now injects raw strings accurately to the Windows native shell.

## [2.9.2] - 2026-04-18
### Added
- **Multi-Model Dynamic Fallback**: Rewrote the AI generation loop for Gemini. If the main chosen model (e.g., `gemini-3.1-flash-lite-preview`) hits the free tier rate limit (`429 Quota Exceeded`), JARVIS will automatically and silently intercept the error and seamlessly fallback to other available models (like `gemini-2.5-flash-8b`, `gemini-2.5-flash`, etc.) in a cascade. This practically overrides individual model API quotas.
- **Enhanced Model Roster**: Added the newest high-throughput experimental models to the AI Settings dropdown, including `2.5 Flash-8B` which has the highest native API limits.

## [2.9.1] - 2026-04-18
### Changed
- **Private Git Workflow**: Re-wrote the local startup script's git pull logic. `run_local.bat` will now strictly attach to the user's private GitHub repository (`https://github.com/popexlegendsa-source/Jarvis_win.git`) and auto-pull the `main` branch. This natively triggers the Windows Git Credential Manager for secure authentication.

## [2.9.0] - 2026-04-18
### Added
- **Security & RCE Protection**: Implemented a mandatory **Local Bridge Token** mechanism. The Python remote execution endpoint (`/execute`) is now protected via `Authorization: Bearer` token validation.
- **Connection Indicator UI**: Added a real-time polling mechanism that displays whether the local Python server is online and secured directly in the UI sidebar.
- **Auto-Type Failsets**: Added a mandatory 3-second countdown and warning beeps before any PyAutoGUI `type_text` or `press_keys` commands to prevent accidental automated typing into personal chats or active windows.

## [2.8.3] - 2026-04-18
### Fixed
- **OTA URL Parsing**: Fixed a bug where a rogue trailing space in the pasted URL would cause a `curl: (3) URL rejected` error.

## [2.8.2] - 2026-04-18
### Fixed
- **OTA Sync Extraction**: Fixed a critical PowerShell extraction bug (`Expand-Archive`) caused by URL malformation and incorrect ZIP payload structure. Added `curl -f` failure handling and self-clearing of corrupted `.sync_url` files.

## [2.8.1] - 2026-04-18
### Fixed
- **UI Versioning**: Fixed the hardcoded "v2.6" string in the sidebar menu. The UI now dynamically reads its version from the core package configuration.

## [2.8.0] - 2026-04-18
### Added
- **Direct OTA Sync**: JARVIS now supports "Over-The-Air" updates. You can sync your local project directly with AI Studio context without using GitHub as an intermediate bridge.
- **Full-Stack Architecture**: Switched to Express/Vite backend to support file streaming and local synchronization.
- **Sync Module**: Added `/api/sync/bundle` for secure code extraction.

## [2.7.2] - 2026-04-18
### Fixed
- **Command Execution Issue**: Fixed a bug where keyboard shortcuts (like `press_keys`) and file operations were displayed in UI but not executed by the system.
- **Backend Expansion**: Added `pyautogui` support to the Python runner for keyboard/mouse simulation.
- **New Commands Support**: Fully implemented `press_keys`, `type_text`, `file_operation`, and `sleep`.

## [2.7.1] - 2026-04-18
### Added
- **Auto-Update on Start**: JARVIS now automatically performs a `git pull` every time you launch `run_local.bat`. This ensures you always have the latest fixes and features from the GitHub repository.

## [2.7.0] - 2026-04-18
### Added
- **Intelligent Auto-Installer**: `run_local.bat` now uses Windows Package Manager (`winget`) to automatically detect and install missing dependencies: Node.js, Git, and Python.
- **Workflow Improvement**: Added automated "Winget" fallback for smoother first-time setup on Windows 10/11.

## [2.6.3] - 2026-04-18
### Added
- **Release Automation**: Added `release.bat` to automate Git tagging and versioning.
- **Workflow Optimization**: Synchronized AI Studio exports with official GitHub Releases.

## [2.6.2] - 2026-04-18
### Fixed
- Fixed `ReferenceError: localApiKey is not defined` caused by renaming variables during the multi-model update.
- Corrected status indicator logic to properly reflect API key presence across all providers.

## [2.6.1] - 2026-04-18
### Fixed
- Added Git detection in `run_local.bat` to help users with missing Git command.
- Documentation update for Git installation.

## [2.6.0] - 2026-04-18
### Added
- **Application Renaming**: Project officially rebranded as **JARVIS** v2.6.
- **Multi-Model Support**: Integrated **OpenAI (GPT-4o/o1)** and **Anthropic (Claude 3.5)** support.
- **Provider Switcher**: New UI component to toggle between Gemini, OpenAI, and Anthropic.
- **API Key Management**: Independent key storage for each AI provider.
- **Upgraded System Prompt**: Updated JARVIS identity and professional tone.

## [2.5.0] - 2026-04-18
### Added
- **Neural AI Voices**: Integrated `gemini-3.1-flash-tts-preview` for human-like speech.
- **Voice Selection**: Added UI to choose between different AI personalities (Kore, Fenrir, Aoede, etc.).
- **PCM Audio Engine**: Custom playback engine for raw 24kHz audio data from Gemini.
- **Hybrid TTS**: Seamless fallback to system voices if AI voice is disabled or квота исчерпана.

## [2.4.4] - 2026-04-18
### Fixed
- Improved Speech Recognition stability and error handling.
- Added browser support validation for voice commands.
- Enhanced UI feedback when microphone access is denied.

## [2.4.3] - 2026-04-18
### Added
- **Voice Input (STT)**: Integrated Web Speech API for hands-free commanding. Added microphone button in input area.
- **Voice Response (TTS)**: The agent can now speak back to you using system voices.
- **Controls**: Added a Voice Mode toggle in the sidebar to enable/disable audio feedback.
- **Auto-Submit**: Voice input automatically triggers a request after a short pause.

## [2.4.2] - 2026-04-18
### Added
- Created a comprehensive `README.md` to ensure proper GitHub repository synchronization.
- Updated project documentation with security and architectural overview.

## [2.4.1] - 2026-04-18
### Added
- Created `CHANGELOG.md` for version tracking.
- Implemented automatic process cleanup in `run_local.bat` (Port 3000 & 5000).
- Added Model Selection UI in Settings.
- Added 127.0.0.1 binding for local security.

### Fixed
- Fixed 'process is not defined' error in local environments.
- Fixed loss of settings/memory handlers in App.tsx.
- Optimized Gemini API context formatting to reduce errors.
