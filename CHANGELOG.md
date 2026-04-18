# Changelog - JARVIS Agent

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
