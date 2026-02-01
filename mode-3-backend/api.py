"""
FastAPI server to control the Gemini Live streaming session.

Endpoints:
- POST /start - Start the Gemini Live session (with optional push_to_talk mode)
- POST /stop - Stop the running session
- GET /status - Check if a session is currently running
"""

import asyncio
import os
import signal
import sys
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import the GeminiLiveClient from the existing module
from gemini_live import GeminiLiveClient


class SessionState:
    """Holds the current session state."""
    def __init__(self):
        self.client: Optional[GeminiLiveClient] = None
        self.task: Optional[asyncio.Task] = None
        self.is_running: bool = False


state = SessionState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    yield
    # Cleanup on shutdown
    if state.is_running:
        await stop_session()


app = FastAPI(
    title="Gemini Live API",
    description="API to control Gemini Live screen + audio streaming sessions",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StartRequest(BaseModel):
    push_to_talk: bool = False


class StatusResponse(BaseModel):
    is_running: bool
    mode: Optional[str] = None


class MessageResponse(BaseModel):
    message: str
    is_running: bool


async def run_client(client: GeminiLiveClient):
    """Run the Gemini Live client."""
    try:
        await client.run()
    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"Client error: {e}")
    finally:
        state.is_running = False
        state.client = None
        state.task = None


async def stop_session():
    """Stop the current session gracefully."""
    if state.client:
        state.client.request_shutdown()

    if state.task and not state.task.done():
        state.task.cancel()
        try:
            await asyncio.wait_for(state.task, timeout=5.0)
        except (asyncio.CancelledError, asyncio.TimeoutError):
            pass

    state.is_running = False
    state.client = None
    state.task = None


@app.post("/start", response_model=MessageResponse)
async def start_session(request: StartRequest = StartRequest()):
    """
    Start a new Gemini Live session.

    - **push_to_talk**: If true, use Push-to-Talk mode (hold F9 to speak).
                        If false (default), use Toggle Mute mode (F9 to toggle).
    """
    if state.is_running:
        raise HTTPException(
            status_code=409,
            detail="A session is already running. Stop it first with POST /stop"
        )

    # Create and start the client
    state.client = GeminiLiveClient(push_to_talk_mode=request.push_to_talk)
    state.is_running = True
    state.task = asyncio.create_task(run_client(state.client))

    mode = "Push-to-Talk" if request.push_to_talk else "Toggle Mute"
    return MessageResponse(
        message=f"Session started in {mode} mode. Use F9 to control mic, F10 to quit.",
        is_running=True
    )


@app.post("/stop", response_model=MessageResponse)
async def stop_session_endpoint():
    """Stop the currently running Gemini Live session."""
    if not state.is_running:
        raise HTTPException(
            status_code=404,
            detail="No session is currently running"
        )

    await stop_session()

    return MessageResponse(
        message="Session stopped successfully",
        is_running=False
    )


@app.get("/status", response_model=StatusResponse)
async def get_status():
    """Get the current session status."""
    mode = None
    if state.is_running and state.client:
        mode = "Push-to-Talk" if state.client.push_to_talk_mode else "Toggle Mute"

    return StatusResponse(
        is_running=state.is_running,
        mode=mode
    )


@app.post("/toggle-mute", response_model=MessageResponse)
async def toggle_mute():
    """Toggle the mute state of the current session (only works in Toggle Mute mode)."""
    if not state.is_running or not state.client:
        raise HTTPException(
            status_code=404,
            detail="No session is currently running"
        )

    if state.client.push_to_talk_mode:
        raise HTTPException(
            status_code=400,
            detail="Cannot toggle mute in Push-to-Talk mode. Use the F9 hotkey instead."
        )

    state.client.toggle_mute()
    is_muted = state.client.muted

    return MessageResponse(
        message=f"Microphone {'muted' if is_muted else 'unmuted'}",
        is_running=True
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
