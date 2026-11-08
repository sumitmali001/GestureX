import sys
import asyncio
import json
import time
import re
import importlib
from pathlib import Path
from typing import Dict, Any, List, Set, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Ensure root directory is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import v4_predictor
from backend.serial_manager import SerialManager
from backend.calibration_service import CalibrationService
from backend.prediction_service import PredictionService

# Initialize single instance managers
serial_manager = SerialManager(port="COM3", baud_rate=115200)
calibration_service = CalibrationService(serial_manager)
prediction_service = PredictionService(serial_manager)

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def set_loop(self, loop: asyncio.AbstractEventLoop):
        self._loop = loop

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        print(f"[WebSocket] Client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        print(f"[WebSocket] Client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast_async(self, message: str):
        disconnected = set()
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                disconnected.add(connection)
        for conn in disconnected:
            self.active_connections.discard(conn)

    def broadcast_sync(self, event_type: str, payload: Dict[str, Any]):
        """Thread-safe broadcast called from background threads."""
        msg = json.dumps({
            "type": event_type,
            "payload": payload,
            "timestamp": time.time()
        })
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(self.broadcast_async(msg), self._loop)

ws_manager = ConnectionManager()

# Hook event dispatchers
def global_event_dispatcher(event_type: str, payload: Dict[str, Any]):
    ws_manager.broadcast_sync(event_type, payload)

serial_manager.set_event_dispatcher(global_event_dispatcher)
calibration_service.set_event_dispatcher(global_event_dispatcher)
prediction_service.set_event_dispatcher(global_event_dispatcher)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup asyncio event loop reference
    ws_manager.set_loop(asyncio.get_running_loop())
    
    # Auto-attempt connection to COM3 on startup
    print("[Main] Startup: Attempting connection to ESP32 on COM3...")
    connected = serial_manager.connect()
    if not connected:
        print("[Main] Note: ESP32 not connected on COM3 at startup. User can connect via UI or enable Simulation mode.")

    yield

    # Clean shutdown
    print("[Main] Shutdown: Cleaning up serial connection and services...")
    calibration_service.cancel_capture()
    prediction_service.stop_reading()
    serial_manager.disconnect()

app = FastAPI(
    title="Hand Gesture Vocaliser API",
    description="Backend API for real-time ESP32 gesture recognition and calibration",
    version="4.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Request Models -----------------

class ConnectRequest(BaseModel):
    port: Optional[str] = "COM3"
    baud_rate: Optional[int] = 115200

class SimulationRequest(BaseModel):
    enabled: bool = True

class CalibrationCaptureRequest(BaseModel):
    stage: str # "S", "B", "U", "D"

class ReadingStartRequest(BaseModel):
    continuous: bool = False

class GestureMappingItem(BaseModel):
    sequence: str
    orientation: Optional[str] = "UP"
    raw_orientation: Optional[str] = None
    gesture: str

class UpdateGestureMapRequest(BaseModel):
    mappings: List[GestureMappingItem]


# ----------------- REST Endpoints -----------------

@app.get("/api/status")
def get_system_status():
    """Return consolidated status of serial connection, services, and predictor."""
    return {
        "serial": serial_manager.get_status(),
        "calibration": calibration_service.get_status(),
        "prediction": prediction_service.get_status(),
        "predictor_info": {
            "INDEX_THRESHOLD": getattr(v4_predictor, "INDEX_THRESHOLD", 920),
            "MIDDLE_THRESHOLD": getattr(v4_predictor, "MIDDLE_THRESHOLD", 825),
            "RING_THRESHOLD": getattr(v4_predictor, "RING_THRESHOLD", 895),
            "LITTLE_THRESHOLD": getattr(v4_predictor, "LITTLE_THRESHOLD", 840),
            "ACCEL_AXIS": getattr(v4_predictor, "ACCEL_AXIS", [0.0, 1.0, 0.0]),
            "ACCEL_THRESHOLD": getattr(v4_predictor, "ACCEL_THRESHOLD", 0.0),
            "gesture_count": len(v4_predictor.GESTURE_MAP)
        }
    }

@app.get("/api/serial/ports")
def get_serial_ports():
    """List available COM ports."""
    return {"ports": serial_manager.list_ports()}

@app.post("/api/serial/connect")
def connect_serial(req: ConnectRequest):
    """Connect to serial port."""
    success = serial_manager.connect(port=req.port, baud_rate=req.baud_rate)
    return {
        "success": success,
        "is_connected": serial_manager.is_connected,
        "port": serial_manager.port,
        "error": serial_manager.last_error
    }

@app.post("/api/serial/disconnect")
def disconnect_serial():
    """Disconnect from serial port."""
    serial_manager.disconnect()
    return {"success": True, "is_connected": False}

@app.post("/api/serial/simulation")
def toggle_simulation(req: SimulationRequest):
    """Enable or disable hardware simulation."""
    serial_manager.enable_simulation(req.enabled)
    return {
        "success": True,
        "is_simulated": serial_manager.is_simulated,
        "is_connected": serial_manager.is_connected
    }

# Calibration endpoints
@app.get("/api/calibration/status")
def get_calibration_status():
    return calibration_service.get_status()

@app.post("/api/calibration/start")
def start_calibration_session():
    calibration_service.reset()
    return {"success": True, "message": "Calibration session initialized."}

@app.post("/api/calibration/capture")
def capture_calibration_stage(req: CalibrationCaptureRequest):
    try:
        res = calibration_service.start_stage_capture(req.stage)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/calibration/cancel")
def cancel_calibration_capture():
    calibration_service.cancel_capture()
    return {"success": True, "message": "Calibration capture cancelled."}

@app.post("/api/calibration/finish")
def finalize_calibration():
    try:
        res = calibration_service.finalize_calibration()
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Gesture Reading endpoints
@app.get("/api/reading/status")
def get_reading_status():
    return prediction_service.get_status()

@app.post("/api/reading/start")
def start_reading(req: ReadingStartRequest):
    try:
        res = prediction_service.start_reading(continuous=req.continuous)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/reading/stop")
def stop_reading():
    res = prediction_service.stop_reading()
    return res

@app.get("/api/predictor/info")
def get_predictor_info():
    """Return current thresholds and all 26 dictionary mappings."""
    formatted_map = []
    for (seq, ori), gesture in v4_predictor.GESTURE_MAP.items():
        formatted_map.append({
            "sequence": seq,
            "orientation": "UP" if ori == "U" else "DOWN",
            "raw_orientation": ori,
            "gesture": gesture
        })

    return {
        "thresholds": {
            "INDEX_THRESHOLD": getattr(v4_predictor, "INDEX_THRESHOLD", 920),
            "MIDDLE_THRESHOLD": getattr(v4_predictor, "MIDDLE_THRESHOLD", 825),
            "RING_THRESHOLD": getattr(v4_predictor, "RING_THRESHOLD", 895),
            "LITTLE_THRESHOLD": getattr(v4_predictor, "LITTLE_THRESHOLD", 840),
            "ACCEL_AXIS": getattr(v4_predictor, "ACCEL_AXIS", [0.0, 1.0, 0.0]),
            "ACCEL_THRESHOLD": getattr(v4_predictor, "ACCEL_THRESHOLD", 0.0)
        },
        "gesture_map": formatted_map
    }

@app.post("/api/predictor/gesture-map")
def update_gesture_map(req: UpdateGestureMapRequest):
    """
    Update the GESTURE_MAP dictionary in v4_predictor.py preserving all other code,
    reload the module in memory, and broadcast the update to all clients.
    """
    if not req.mappings:
        raise HTTPException(status_code=400, detail="Gesture map cannot be empty.")

    cleaned_mappings = []
    seen_keys = set()

    for idx, item in enumerate(req.mappings):
        seq = item.sequence.strip().upper()
        if len(seq) != 5 or not all(c in ("S", "B") for c in seq):
            raise HTTPException(
                status_code=400,
                detail=f"Item #{idx + 1}: Invalid sequence '{item.sequence}'. Must be exactly 5 characters of 'S' and 'B'."
            )
        
        # Normalize orientation
        raw_ori = (item.raw_orientation or item.orientation or "U").strip().upper()
        if raw_ori in ("UP", "U"):
            raw_ori = "U"
        elif raw_ori in ("DOWN", "D"):
            raw_ori = "D"
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Item #{idx + 1}: Invalid orientation '{item.orientation}'. Must be UP or DOWN."
            )

        gesture_text = item.gesture.strip()
        if not gesture_text:
            raise HTTPException(
                status_code=400,
                detail=f"Item #{idx + 1}: Gesture description cannot be empty."
            )

        key = (seq, raw_ori)
        if key in seen_keys:
            raise HTTPException(
                status_code=400,
                detail=f"Duplicate mapping detected for Sequence '{seq}' and Orientation '{'UP' if raw_ori == 'U' else 'DOWN'}'."
            )
        seen_keys.add(key)

        cleaned_mappings.append({
            "sequence": seq,
            "raw_orientation": raw_ori,
            "orientation": "UP" if raw_ori == "U" else "DOWN",
            "gesture": gesture_text
        })

    predictor_file = ROOT_DIR / "v4_predictor.py"
    if not predictor_file.exists():
        raise HTTPException(status_code=500, detail="v4_predictor.py file not found.")

    code = predictor_file.read_text(encoding="utf-8")

    # Generate new dictionary code block
    up_items = [m for m in cleaned_mappings if m["raw_orientation"] == "U"]
    down_items = [m for m in cleaned_mappings if m["raw_orientation"] == "D"]

    lines = ["# === GESTURE MAP START ===\n\nGESTURE_MAP = {\n"]
    if up_items:
        lines.append("    # ---------------- HAND UP (U) ----------------\n\n")
        for it in up_items:
            escaped = it["gesture"].replace('"', '\\"')
            lines.append(f'    ("{it["sequence"]}", "U"): "{escaped}",\n')
    if down_items:
        lines.append("\n    # ---------------- HAND DOWN (D) ----------------\n\n")
        for it in down_items:
            escaped = it["gesture"].replace('"', '\\"')
            lines.append(f'    ("{it["sequence"]}", "D"): "{escaped}",\n')
    lines.append("}\n\n# === GESTURE MAP END ===")
    new_block = "".join(lines)

    start_marker = "# === GESTURE MAP START ==="
    end_marker = "# === GESTURE MAP END ==="

    if start_marker in code and end_marker in code:
        pattern = re.escape(start_marker) + r".*?" + re.escape(end_marker)
        updated_code, replacements = re.subn(pattern, lambda match: new_block, code, count=1, flags=re.DOTALL)
    else:
        # Fallback to replacing GESTURE_MAP = { ... }
        pattern = r"GESTURE_MAP\s*=\s*\{.*?\n\}"
        updated_code, replacements = re.subn(pattern, lambda match: new_block, code, count=1, flags=re.DOTALL)

    if replacements != 1:
        raise HTTPException(status_code=500, detail="Could not locate GESTURE_MAP block in v4_predictor.py.")

    predictor_file.write_text(updated_code, encoding="utf-8")

    # Reload v4_predictor module in memory
    global v4_predictor
    v4_predictor = importlib.reload(v4_predictor)

    # Broadcast update event to all connected WebSocket clients
    ws_manager.broadcast_sync("GESTURE_MAP_UPDATED", {"gesture_map": cleaned_mappings})

    return {
        "success": True,
        "message": f"Successfully updated gesture map with {len(cleaned_mappings)} mappings in v4_predictor.py",
        "gesture_map": cleaned_mappings
    }


# ----------------- WebSocket Endpoint -----------------

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    # Send initial snapshot immediately upon connection
    initial_snapshot = {
        "type": "INITIAL_STATE",
        "payload": {
            "serial": serial_manager.get_status(),
            "calibration": calibration_service.get_status(),
            "prediction": prediction_service.get_status()
        },
        "timestamp": time.time()
    }
    await websocket.send_text(json.dumps(initial_snapshot))

    try:
        while True:
            # Client can send ping or commands
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                cmd = msg.get("command")
                if cmd == "PING":
                    await websocket.send_text(json.dumps({"type": "PONG", "timestamp": time.time()}))
            except Exception:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        print(f"[WebSocket] Connection closed with error: {e}")
        ws_manager.disconnect(websocket)


# ----------------- Serve Built Frontend -----------------
DIST_DIR = ROOT_DIR / "frontend" / "dist"
if DIST_DIR.exists():
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse

    if (DIST_DIR / "assets").exists():
        app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend_spa(full_path: str):
        # Allow API and WS routes to pass through
        if full_path.startswith("api/") or full_path == "api" or full_path == "ws":
            raise HTTPException(status_code=404, detail="API route not found")
        
        target = DIST_DIR / full_path
        if target.exists() and target.is_file():
            return FileResponse(target)
        return FileResponse(DIST_DIR / "index.html")
