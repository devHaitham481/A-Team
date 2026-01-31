# dip

## What This Is

A Mac app that lets you show AI what's on your screen instead of explaining it. Press a hotkey to start recording, press again to stop. The recording (screen + voice) gets sent to a video-capable AI model that extracts a narrative breakdown, which is automatically copied to your clipboard. Paste into Claude, ChatGPT, or any AI chat.

## Core Value

Eliminate the friction of explaining visual context to AI — just show it.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Floating pill UI always visible on screen (ready/recording/processing states)
- [ ] Global hotkey to start/stop recording
- [ ] Screen recording capture
- [ ] Microphone audio capture (voice narration)
- [ ] Send recording to video-capable AI model
- [ ] AI extracts narrative breakdown of what happened on screen
- [ ] Auto-copy result to clipboard
- [ ] Notification when complete

### Out of Scope

- Streaming video to AI in real-time — complexity not worth it for MVP, save-then-send is sufficient
- Video editing or preview — auto-copy flow, no review step
- Multiple AI provider options — pick one that works, ship it
- Settings UI — hardcode sensible defaults
- System audio capture — microphone only for MVP

## Context

**Hackathon project** — 48 hours to working demo. Prioritize impressive demo over edge case handling.

**Technical uncertainty:** Need to research video-capable AI models (Gemini, others) for:
- File upload vs streaming capabilities
- Supported formats and size limits
- Latency and pricing
- Best model for extracting structured narratives from screen recordings

**Use cases to demo:**
- Debugging a complex tool (show the broken state)
- Capturing visual inspiration (show images you like)
- General context capture (show any workflow)

## Constraints

- **Platform**: macOS only (Swift/SwiftUI native)
- **Timeline**: 48-hour hackathon — MVP only
- **Demo-first**: Optimize for impressive demo, not production robustness

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Save-then-send vs streaming | Streaming adds complexity; save-then-send is reliable and sufficient for demo | — Pending |
| Video AI model (Gemini vs alternatives) | Need to research current capabilities | — Pending |
| Swift/SwiftUI native | Best macOS integration for screen recording, floating windows, hotkeys | — Pending |

---
*Last updated: 2025-01-31 after initialization*
