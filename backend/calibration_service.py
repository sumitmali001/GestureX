import sys
import os
import time
import math
import threading
import importlib
from pathlib import Path
from typing import Dict, Any, List, Optional, Callable

# Ensure root directory is in sys.path so we can import calibrate and v4_predictor
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import calibrate
import v4_predictor
from backend.serial_manager import SerialManager

CAPTURE_SECONDS = 10.0
MIN_READINGS = 30
FINGERS = ["Index", "Middle", "Ring", "Little"]

STAGE_INFO = {
    "S": {
        "title": "STAGE 1: STRAIGHT (S)",
        "instruction": "Keep all five fingers completely straight.",
        "button": "Capture Straight"
    },
    "B": {
        "title": "STAGE 2: BENT (B)",
        "instruction": "Bend all five fingers.",
        "button": "Capture Bent"
    },
    "U": {
        "title": "STAGE 3: HAND UP (U)",
        "instruction": "Hold your hand in the UP position.",
        "button": "Capture Hand Up"
    },
    "D": {
        "title": "STAGE 4: HAND DOWN (D)",
        "instruction": "Hold your hand in the DOWN position.",
        "button": "Capture Hand Down"
    }
}

class CalibrationService:
    """
    Coordinates UI-driven 4-stage sensor calibration without terminal input.
    Reuses calculation algorithms and predictor file updating from calibrate.py.
    """

    def __init__(self, serial_manager: SerialManager):
        self.serial_manager = serial_manager
        self.stage_data: Dict[str, List[List[float]]] = {
            "S": [],
            "B": [],
            "U": [],
            "D": []
        }
        self.current_stage: Optional[str] = None
        self.is_capturing = False
        self.current_progress: Optional[Dict[str, Any]] = None
        self._cancel_requested = False
        self._thread: Optional[threading.Thread] = None
        self._event_dispatcher: Optional[Callable[[str, Dict[str, Any]], None]] = None
        
        self.last_results: Optional[Dict[str, Any]] = None
        self.last_error: Optional[str] = None

    def set_event_dispatcher(self, dispatcher: Callable[[str, Dict[str, Any]], None]):
        self._event_dispatcher = dispatcher

    def _emit(self, event_type: str, payload: Dict[str, Any]):
        if self._event_dispatcher:
            try:
                self._event_dispatcher(event_type, payload)
            except Exception as e:
                print(f"[CalibrationService] Dispatch error: {e}")

    def get_status(self) -> Dict[str, Any]:
        """Return the current calibration status and stored stages."""
        # Read current thresholds directly from loaded v4_predictor module
        current_thresholds = {
            "INDEX_THRESHOLD": getattr(v4_predictor, "INDEX_THRESHOLD", 920),
            "MIDDLE_THRESHOLD": getattr(v4_predictor, "MIDDLE_THRESHOLD", 825),
            "RING_THRESHOLD": getattr(v4_predictor, "RING_THRESHOLD", 895),
            "LITTLE_THRESHOLD": getattr(v4_predictor, "LITTLE_THRESHOLD", 840),
            "ACCEL_AXIS": getattr(v4_predictor, "ACCEL_AXIS", [0.0, 1.0, 0.0]),
            "ACCEL_THRESHOLD": getattr(v4_predictor, "ACCEL_THRESHOLD", 0.0)
        }

        stages_status = {}
        for s in ["S", "B", "U", "D"]:
            stages_status[s] = {
                "collected": len(self.stage_data[s]) > 0,
                "readings_count": len(self.stage_data[s]),
                "info": STAGE_INFO[s]
            }

        all_collected = all(len(self.stage_data[s]) >= MIN_READINGS for s in ["S", "B", "U", "D"])

        return {
            "is_capturing": self.is_capturing,
            "current_stage": self.current_stage,
            "current_progress": self.current_progress,
            "stages": stages_status,
            "all_collected": all_collected,
            "current_thresholds": current_thresholds,
            "last_results": self.last_results,
            "last_error": self.last_error
        }

    def reset(self):
        """Reset calibration session."""
        self.cancel_capture()
        self.stage_data = {"S": [], "B": [], "U": [], "D": []}
        self.last_error = None
        self.last_results = None
        self.current_progress = None

    def cancel_capture(self):
        """Cancel an ongoing stage capture."""
        self._cancel_requested = True
        self.is_capturing = False
        self.current_progress = None
        self.serial_manager.clear_collector()
        self.serial_manager.release_mode()

    def start_stage_capture(self, stage: str) -> Dict[str, Any]:
        """
        Start capturing readings for a given stage (S, B, U, D) for 10 seconds.
        """
        stage = stage.upper()
        if stage not in ["S", "B", "U", "D"]:
            raise ValueError(f"Invalid calibration stage: {stage}. Must be S, B, U, or D.")

        if self.is_capturing:
            raise RuntimeError("A calibration capture is already in progress.")

        if not self.serial_manager.is_connected:
            raise RuntimeError("ESP32 is not connected on serial port. Please connect hardware or enable simulation.")

        if not self.serial_manager.acquire_mode("CALIBRATING"):
            raise RuntimeError(f"Cannot calibrate while system is in {self.serial_manager.current_mode} mode.")

        self.current_stage = stage
        self.is_capturing = True
        self._cancel_requested = False
        self.last_error = None

        self._thread = threading.Thread(target=self._capture_worker, args=(stage,), daemon=True)
        self._thread.start()

        return {
            "success": True,
            "stage": stage,
            "duration": CAPTURE_SECONDS,
            "message": f"Started capture for {stage} ({STAGE_INFO[stage]['instruction']})"
        }

    def _capture_worker(self, stage: str):
        """Worker thread that collects readings for 10 seconds."""
        collected: List[List[float]] = []
        lock = threading.Lock()

        def collector(values: List[float]):
            with lock:
                # If in simulation mode, inject mode-appropriate realistic sensor values
                if self.serial_manager.is_simulated:
                    import random
                    if stage == "S":
                        # Straight fingers (higher values than bent)
                        vals = [
                            0.0,
                            random.uniform(940, 970),
                            random.uniform(880, 910),
                            random.uniform(920, 950),
                            random.uniform(870, 900),
                            random.uniform(-0.02, 0.02),
                            random.uniform(0.95, 1.05),
                            random.uniform(-0.02, 0.02)
                        ]
                    elif stage == "B":
                        # Bent fingers (lower values than straight)
                        vals = [
                            1.0,
                            random.uniform(690, 720),
                            random.uniform(640, 670),
                            random.uniform(660, 690),
                            random.uniform(610, 640),
                            random.uniform(-0.02, 0.02),
                            random.uniform(0.95, 1.05),
                            random.uniform(-0.02, 0.02)
                        ]
                    elif stage == "U":
                        # Hand Up orientation
                        vals = [
                            0.0,
                            random.uniform(930, 960),
                            random.uniform(870, 900),
                            random.uniform(900, 930),
                            random.uniform(850, 880),
                            random.uniform(-0.02, 0.02),
                            random.uniform(0.95, 1.05), # Ay ~ +1.0
                            random.uniform(-0.02, 0.02)
                        ]
                    elif stage == "D":
                        # Hand Down orientation
                        vals = [
                            0.0,
                            random.uniform(930, 960),
                            random.uniform(870, 900),
                            random.uniform(900, 930),
                            random.uniform(850, 880),
                            random.uniform(-0.02, 0.02),
                            random.uniform(-1.05, -0.95), # Ay ~ -1.0
                            random.uniform(-0.02, 0.02)
                        ]
                    collected.append(vals)
                else:
                    collected.append(values)

        self.serial_manager.set_collector(collector)

        self._emit("CALIBRATION_STARTED", {
            "stage": stage,
            "duration": CAPTURE_SECONDS,
            "instruction": STAGE_INFO[stage]["instruction"],
            "title": STAGE_INFO[stage]["title"]
        })

        start_time = time.time()
        last_progress_update = 0.0

        try:
            while not self._cancel_requested:
                elapsed = time.time() - start_time
                if elapsed >= CAPTURE_SECONDS:
                    break

                # Send periodic progress updates every 150ms
                now = time.time()
                if now - last_progress_update >= 0.15:
                    last_progress_update = now
                    with lock:
                        count = len(collected)
                    percent = min(100.0, round((elapsed / CAPTURE_SECONDS) * 100.0, 1))
                    remaining = max(0.0, round(CAPTURE_SECONDS - elapsed, 1))
                    progress_payload = {
                        "stage": stage,
                        "elapsed": round(elapsed, 1),
                        "remaining": remaining,
                        "total": CAPTURE_SECONDS,
                        "percent": percent,
                        "readings_count": count
                    }
                    self.current_progress = progress_payload
                    self._emit("CALIBRATION_PROGRESS", progress_payload)

                time.sleep(0.05)

            self.serial_manager.clear_collector()
            self.current_progress = None

            if self._cancel_requested:
                print(f"[CalibrationService] Capture for {stage} was cancelled.")
                self.is_capturing = False
                self.serial_manager.release_mode()
                return

            with lock:
                final_count = len(collected)

            if final_count < MIN_READINGS:
                err_msg = (
                    f"Not enough readings for stage {stage}. "
                    f"Expected at least {MIN_READINGS}, but only received {final_count}. "
                    "Please verify sensor connection and try again."
                )
                self.last_error = err_msg
                self.is_capturing = False
                self.serial_manager.release_mode()
                self._emit("GENERAL_ERROR", {
                    "error": err_msg,
                    "stage": stage,
                    "recovery": "Ensure ESP32 is powered and flex sensor wiring is solid."
                })
                return

            # Save stage data
            self.stage_data[stage] = list(collected)
            self.is_capturing = False
            self.serial_manager.release_mode()

            # Calculate average summary for this stage
            summary = {}
            if stage in ["S", "B"]:
                for i, finger in enumerate(FINGERS, start=1):
                    avg = sum(row[i] for row in collected) / len(collected)
                    summary[finger] = round(avg, 2)
            else:
                summary["accel_mean"] = [
                    round(sum(row[i] for row in collected) / len(collected), 4)
                    for i in range(5, 8)
                ]

            self._emit("CALIBRATION_STAGE_COMPLETED", {
                "stage": stage,
                "readings_count": final_count,
                "summary": summary,
                "message": f"Successfully captured {final_count} readings for {stage}."
            })

            # Check if all 4 stages are now complete
            if all(len(self.stage_data[s]) >= MIN_READINGS for s in ["S", "B", "U", "D"]):
                print("[CalibrationService] All 4 stages collected. Processing final calibration...")
                self.finalize_calibration()

        except Exception as e:
            err_msg = f"Unexpected error during calibration capture: {str(e)}"
            print(f"[CalibrationService] {err_msg}")
            self.last_error = err_msg
            self.is_capturing = False
            self.serial_manager.clear_collector()
            self.serial_manager.release_mode()
            self._emit("GENERAL_ERROR", {
                "error": err_msg,
                "stage": stage
            })

    def finalize_calibration(self) -> Dict[str, Any]:
        """
        Calculates thresholds, validates straight > bent, calculates accelerometer orientation,
        and updates v4_predictor.py preserving calibration markers.
        """
        for s in ["S", "B", "U", "D"]:
            if len(self.stage_data[s]) < MIN_READINGS:
                err = f"Cannot finalize calibration: Stage {s} has insufficient readings ({len(self.stage_data[s])}/{MIN_READINGS})."
                self.last_error = err
                self._emit("GENERAL_ERROR", {"error": err})
                return {"success": False, "error": err}

        straight_data = self.stage_data["S"]
        bent_data = self.stage_data["B"]
        up_data = self.stage_data["U"]
        down_data = self.stage_data["D"]

        try:
            # 1. Calculate flex sensor thresholds with validation
            # (straight_avg must be greater than bent_avg for each finger)
            thresholds = calibrate.calculate_thresholds(straight_data, bent_data)

            # 2. Calculate accelerometer boundary and normalized axis
            accel_axis, accel_threshold = calibrate.calculate_accel_boundary(up_data, down_data)

            # Round axis for clean storage and display
            accel_axis = [round(x, 6) for x in accel_axis]
            accel_threshold = round(accel_threshold, 6)

            # 3. Update v4_predictor.py file preserving markers
            calibrate.update_predictor(thresholds, accel_axis, accel_threshold)

            # 4. Reload v4_predictor module in python runtime so changes take effect immediately
            global v4_predictor
            v4_predictor = importlib.reload(v4_predictor)

            # Calculate detailed finger metrics for UI report
            finger_metrics = {}
            for i, finger in enumerate(FINGERS, start=1):
                s_vals = [row[i] for row in straight_data]
                b_vals = [row[i] for row in bent_data]
                s_avg = sum(s_vals) / len(s_vals)
                b_avg = sum(b_vals) / len(b_vals)
                finger_metrics[finger] = {
                    "straight_avg": round(s_avg, 2),
                    "bent_avg": round(b_avg, 2),
                    "threshold": thresholds[f"{finger.upper()}_THRESHOLD"],
                    "margin": round(s_avg - b_avg, 2)
                }

            result_payload = {
                "success": True,
                "message": "Calibration Completed Successfully! v4_predictor.py updated.",
                "thresholds": thresholds,
                "accel_axis": accel_axis,
                "accel_threshold": accel_threshold,
                "finger_metrics": finger_metrics,
                "timestamp": time.time()
            }

            self.last_results = result_payload
            self.last_error = None

            self._emit("CALIBRATION_COMPLETED", result_payload)
            return result_payload

        except RuntimeError as e:
            err_msg = str(e).strip()
            print(f"[CalibrationService] Calibration validation failed: {err_msg}")
            self.last_error = err_msg
            self._emit("GENERAL_ERROR", {
                "error": err_msg,
                "title": "Calibration Validation Failed",
                "recovery": "Ensure straight pose finger values are higher than bent pose values, verify flex sensor placement and wiring, then recalibrate."
            })
            return {"success": False, "error": err_msg}

        except Exception as e:
            err_msg = f"Failed to finalize calibration: {str(e)}"
            print(f"[CalibrationService] {err_msg}")
            self.last_error = err_msg
            self._emit("GENERAL_ERROR", {
                "error": err_msg,
                "title": "Calibration Update Error"
            })
            return {"success": False, "error": err_msg}
