# Mode 2 Reply Button Design

## Overview

Add a reply button to the Mode 2 overlay that allows users to continue conversations with Gemini while maintaining context from previous responses.

## Problem

Currently, when a user clicks the purple button again after receiving a response, the context is completely reset. Gemini has no knowledge of the previous interaction, forcing users to re-explain context for follow-up questions.

## Solution

Add an iOS-style Reply button inside the overlay window. When clicked:
1. Starts screen+audio recording for follow-up
2. Sends the new recording to Gemini along with the previous response text as context
3. Displays the new response in the same overlay
4. Allows further replies in the same conversation

## Context Management

**Data structure:**
```javascript
let conversationContext = {
  lastResponse: null  // String: Gemini's last response text
};
```

**Lifecycle:**
- Initial Ask AI: context empty
- Response received: store in `lastResponse`
- Reply sent: include `lastResponse` in prompt
- New response: update `lastResponse`
- Overlay closed: clear context

**Context is text-only** - previous videos are not retained, only Gemini's responses.

## Modified Gemini Prompt (Reply Mode)

```
[Original prompt from prompt.txt]

Previous AI response for context:
"""
{lastResponse}
"""

The user is now following up with additional questions or requests.
Answer based on both the previous context and their new input.
```

## UI/UX

**Reply Button:**
- iOS-style rounded button at bottom of overlay
- Purple gradient matching app theme
- Microphone icon + "Reply" text

**Button States:**
- Idle: Purple, shows "Reply"
- Recording: Red, pulsing animation, shows "Stop"
- Loading: Disabled, shows "Processing..."

**Overlay Behavior:**
- Response stays visible while recording
- Footer hidden during initial loading
- Button re-enabled after new response

## Files Modified

| File | Changes |
|------|---------|
| `src/gemini.js` | Added `transcribeWithContext()` function |
| `src/main.js` | Context storage, IPC handlers for reply |
| `src/preload.js` | Added reply IPC channels |
| `src/overlay-preload.js` | Exposed reply APIs to overlay |
| `src/renderer/renderer.js` | Reply recording functions |
| `src/renderer/overlay.html` | Reply button HTML |
| `src/renderer/overlay.css` | iOS-style button styling |
| `src/renderer/overlay.js` | Reply button interaction handling |

## IPC Flow

```
Overlay (click Reply)
  -> main.js (start-reply)
    -> renderer.js (startReply)
      -> Start recording
      -> Notify overlay (reply-state-change: recording)

Overlay (click Stop)
  -> main.js (stop-reply)
    -> renderer.js (stopReply)
      -> Stop recording
      -> Notify overlay (reply-state-change: loading)
      -> transcribeWithContext()
      -> showOverlay(response)
      -> Notify overlay (reply-state-change: complete)
```
