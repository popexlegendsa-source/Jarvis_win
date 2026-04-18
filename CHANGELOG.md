# Changelog - WinAutomate Agent

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
