import sys
import time
import threading
import importlib
from pathlib import Path
from collections import Counter
from typing import Dict, Any, List, Optional, Callable

# Ensure root directory is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import v4_predictor
from backend.serial_manager import SerialManager

CAPTURE_SECONDS = 5.0
MIN_READINGS = 10
FINGERS = ["Thumb", "Index", "Middle", "Ring", "Little"]

class PredictionService:
    """
    Coordinates 5-second sensor capture, executes v4_predictor algorithms,
    majority voting, tie breaking, orientation detection, and dictionary mapping.
    """

    def __init__(self, serial_manager: SerialManager):
        self.serial_manager = serial_manager
        self.is_reading = False
        self.continuous_mode = False
        self.current_progress: Optional[Dict[str, Any]] = None
        self._cancel_requested = False
        self._thread: Optional[threading.Thread] = None
        self._event_dispatcher: Optional[Callable[[str, Dict[str, Any]], None]] = None
        
        self.last_prediction: Optional[Dict[str, Any]] = None
        self.last_error: Optional[str] = None
        self.prediction_history: List[Dict[str, Any]] = []

    def set_event_dispatcher(self, dispatcher: Callable[[str, Dict[str, Any]], None]):
        self._event_dispatcher = dispatcher

    def _emit(self, event_type: str, payload: Dict[str, Any]):
        if self._event_dispatcher:
            try:
                self._event_dispatcher(event_type, payload)
            except Exception as e:
                print(f"[PredictionService] Event dispatch error: {e}")

    def get_status(self) -> Dict[str, Any]:
        return {
            "is_reading": self.is_reading,
            "continuous_mode": self.continuous_mode,
            "current_progress": self.current_progress,
            "last_prediction": self.last_prediction,
            "last_error": self.last_error,
            "history_count": len(self.prediction_history)
        }

    def start_reading(self, continuous: bool = False) -> Dict[str, Any]:
        """Start reading gesture (single 5s session or continuous)."""
        if self.is_reading:
            return {"success": True, "message": "Gesture reading already active."}

        if not self.serial_manager.is_connected:
            raise RuntimeError("ESP32 is not connected on serial port. Please connect hardware or enable simulation.")

        if not self.serial_manager.acquire_mode("READING"):
            raise RuntimeError(f"Cannot start reading while system is in {self.serial_manager.current_mode} mode.")

        self.continuous_mode = continuous
        self.is_reading = True
        self._cancel_requested = False
        self.last_error = None

        self._thread = threading.Thread(target=self._reading_worker, daemon=True)
        self._thread.start()

        return {
            "success": True,
            "continuous": self.continuous_mode,
            "duration": CAPTURE_SECONDS,
            "message": "Gesture reading started."
        }

    def stop_reading(self) -> Dict[str, Any]:
        """Stop reading gesture."""
        self._cancel_requested = True
        self.is_reading = False
        self.continuous_mode = False
        self.current_progress = None
        self.serial_manager.clear_collector()
        self.serial_manager.release_mode()
        return {"success": True, "message": "Gesture reading stopped."}

    def _reading_worker(self):
        """Worker thread executing 5-second capture iterations."""
        while self.is_reading and not self._cancel_requested:
            collected: List[List[float]] = []
            lock = threading.Lock()

            def collector(values: List[float]):
                with lock:
                    collected.append(values)

            self.serial_manager.set_collector(collector)

            self._emit("PREDICTION_STARTED", {
                "duration": CAPTURE_SECONDS,
                "continuous": self.continuous_mode,
                "message": f"Capturing gesture readings for {CAPTURE_SECONDS} seconds..."
            })

            start_time = time.time()
            last_progress = 0.0

            while not self._cancel_requested:
                elapsed = time.time() - start_time
                if elapsed >= CAPTURE_SECONDS:
                    break

                now = time.time()
                if now - last_progress >= 0.1:
                    last_progress = now
                    with lock:
                        count = len(collected)
                    percent = min(100.0, round((elapsed / CAPTURE_SECONDS) * 100.0, 1))
                    remaining = max(0.0, round(CAPTURE_SECONDS - elapsed, 1))
                    prog_payload = {
                        "elapsed": round(elapsed, 1),
                        "remaining": remaining,
                        "total": CAPTURE_SECONDS,
                        "percent": percent,
                        "readings_count": count
                    }
                    self.current_progress = prog_payload
                    self._emit("PREDICTION_PROGRESS", prog_payload)

                time.sleep(0.05)

            self.serial_manager.clear_collector()
            self.current_progress = None

            if self._cancel_requested:
                break

            with lock:
                readings = list(collected)

            if len(readings) < MIN_READINGS:
                err_msg = f"Not enough readings captured (Expected at least {MIN_READINGS}, got {len(readings)}). Please hold your hand steady and try again."
                self.last_error = err_msg
                self._emit("PREDICTION_ERROR", {
                    "error": err_msg,
                    "readings_count": len(readings),
                    "recovery": "Verify sensor connection and make sure data is streaming from ESP32."
                })
                if not self.continuous_mode:
                    break
                else:
                    time.sleep(1.5)
                    continue

            # Process prediction using v4_predictor logic
            try:
                # Reload v4_predictor in case threshold variables were updated
                global v4_predictor
                v4_predictor = importlib.reload(v4_predictor)

                # Predict each reading and compute majority voting & tie breaking
                finger_votes = [[] for _ in range(5)]
                orientation_votes = []

                for values in readings:
                    labels = v4_predictor.predict_fingers(values)
                    for i, label in enumerate(labels):
                        finger_votes[i].append(label)
                    orientation_votes.append(v4_predictor.predict_orientation(values))

                final_sequence_chars = []
                finger_breakdown = {}

                for i, finger in enumerate(FINGERS):
                    votes = finger_votes[i]
                    s_count = votes.count("S")
                    b_count = votes.count("B")
                    final_label = v4_predictor.majority_vote(votes)
                    final_sequence_chars.append(final_label)
                    finger_breakdown[finger] = {
                        "S_count": s_count,
                        "B_count": b_count,
                        "final": final_label
                    }

                final_sequence = "".join(final_sequence_chars)
                final_raw_orientation = v4_predictor.majority_vote(orientation_votes)
                final_orientation = "UP" if final_raw_orientation == "U" else "DOWN"

                # Dictionary lookup in GESTURE_MAP
                gesture = v4_predictor.get_gesture(final_sequence, final_raw_orientation)
                is_mapped = (gesture != "GESTURE NOT MAPPED")

                prediction_result = {
                    "sequence": final_sequence,
                    "orientation": final_orientation,
                    "raw_orientation": final_raw_orientation,
                    "gesture": gesture,
                    "is_mapped": is_mapped,
                    "readings_count": len(readings),
                    "finger_breakdown": finger_breakdown,
                    "orientation_votes": {
                        "U": orientation_votes.count("U"),
                        "D": orientation_votes.count("D"),
                        "final": final_orientation
                    },
                    "timestamp": time.time(),
                    "formatted_time": time.strftime("%H:%M:%S")
                }

                self.last_prediction = prediction_result
                self.last_error = None
                self.prediction_history.insert(0, prediction_result)
                if len(self.prediction_history) > 50:
                    self.prediction_history.pop()

                self._emit("PREDICTION_COMPLETED", prediction_result)

            except Exception as e:
                err_msg = f"Error during prediction calculations: {str(e)}"
                print(f"[PredictionService] {err_msg}")
                self.last_error = err_msg
                self._emit("PREDICTION_ERROR", {"error": err_msg})

            if not self.continuous_mode or self._cancel_requested:
                break
            else:
                # Brief pause between continuous readings so user sees result
                time.sleep(1.5)

        self.is_reading = False
        self.serial_manager.release_mode()
        print("[PredictionService] Reading loop stopped.")
