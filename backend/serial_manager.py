import time
import threading
import serial
import serial.tools.list_ports
from typing import Optional, Callable, List, Dict, Any

class SerialManager:
    """
    Manages the single PySerial connection to the ESP32 on COM3 (or configured port)
    at 115200 baud. Ensures thread-safe data collection, 8-value numeric validation,
    disconnection detection, and telemetry dispatch.
    """

    def __init__(self, port: str = "COM3", baud_rate: int = 115200):
        self.port = port
        self.baud_rate = baud_rate
        self.ser: Optional[serial.Serial] = None
        
        self.is_connected = False
        self.is_simulated = False
        self.last_error: Optional[str] = None
        self.current_mode = "IDLE"  # IDLE, CALIBRATING, READING
        
        # Diagnostics
        self.valid_readings_count = 0
        self.skipped_lines_count = 0
        self.latest_reading: Optional[List[float]] = None
        self.last_reading_time = 0.0

        # Threading & Control
        self._lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._collector_callback: Optional[Callable[[List[float]], None]] = None
        self._event_dispatcher: Optional[Callable[[str, Dict[str, Any]], None]] = None
        
        # Telemetry throttle (max ~10 Hz)
        self._last_telemetry_time = 0.0

    def set_event_dispatcher(self, dispatcher: Callable[[str, Dict[str, Any]], None]):
        """Register the WebSocket event dispatcher."""
        self._event_dispatcher = dispatcher

    def _emit_event(self, event_type: str, payload: Dict[str, Any]):
        if self._event_dispatcher:
            try:
                self._event_dispatcher(event_type, payload)
            except Exception as e:
                print(f"[SerialManager] Error dispatching event {event_type}: {e}")

    def list_ports(self) -> List[Dict[str, str]]:
        """List all available COM ports on the system."""
        ports = []
        for p in serial.tools.list_ports.comports():
            ports.append({
                "port": p.device,
                "description": p.description,
                "hwid": p.hwid or ""
            })
        return ports

    def connect(self, port: Optional[str] = None, baud_rate: Optional[int] = None) -> bool:
        """Connect to the serial port safely."""
        with self._lock:
            if port:
                self.port = port
            if baud_rate:
                self.baud_rate = baud_rate

            self.disconnect()

            # If simulation mode is active, start simulator thread instead
            if self.is_simulated:
                self._running = True
                self.is_connected = True
                self.last_error = None
                self._thread = threading.Thread(target=self._simulation_loop, daemon=True)
                self._thread.start()
                self._emit_event("ESP32_CONNECTED", {
                    "port": f"{self.port} (SIMULATION)",
                    "baud_rate": self.baud_rate,
                    "simulated": True,
                    "message": "Connected to ESP32 Simulation Mode."
                })
                return True

            try:
                print(f"[SerialManager] Opening {self.port} at {self.baud_rate} baud...")
                self.ser = serial.Serial(self.port, self.baud_rate, timeout=1.0)
                # Give ESP32 reset time & flush buffers
                time.sleep(1.0)
                self.ser.reset_input_buffer()
                self.ser.reset_output_buffer()
                
                self.is_connected = True
                self.last_error = None
                self._running = True
                
                self._thread = threading.Thread(target=self._reader_loop, daemon=True)
                self._thread.start()

                print(f"[SerialManager] Successfully connected to {self.port}")
                self._emit_event("ESP32_CONNECTED", {
                    "port": self.port,
                    "baud_rate": self.baud_rate,
                    "simulated": False,
                    "message": f"Connected to ESP32 on {self.port} at {self.baud_rate} baud."
                })
                return True

            except serial.SerialException as e:
                err_msg = str(e)
                if "FileNotFoundError" in err_msg or "cannot find" in err_msg.lower() or "does not exist" in err_msg.lower():
                    friendly_err = f"{self.port} is not available. Please verify the ESP32 USB cable is securely connected."
                elif "PermissionError" in err_msg or "Access is denied" in err_msg:
                    friendly_err = f"Access denied to {self.port}. Another application (like Arduino Serial Monitor or another script) is using this port."
                else:
                    friendly_err = f"Serial port error on {self.port}: {err_msg}"

                print(f"[SerialManager] Connection failed: {friendly_err}")
                self.last_error = friendly_err
                self.is_connected = False
                self._emit_event("ESP32_DISCONNECTED", {
                    "port": self.port,
                    "error": friendly_err,
                    "recovery": "Check USB cable connection, verify COM port in Device Manager, or close Arduino Serial Monitor."
                })
                return False

            except Exception as e:
                friendly_err = f"Unexpected error connecting to {self.port}: {str(e)}"
                print(f"[SerialManager] {friendly_err}")
                self.last_error = friendly_err
                self.is_connected = False
                self._emit_event("GENERAL_ERROR", {
                    "error": friendly_err,
                    "context": "serial_connection"
                })
                return False

    def disconnect(self):
        """Disconnect and stop reader thread."""
        self._running = False
        if self._thread and self._thread.is_alive():
            # Wait briefly for thread to terminate
            self._thread.join(timeout=1.5)
            self._thread = None

        if self.ser:
            try:
                self.ser.close()
            except Exception:
                pass
            self.ser = None

        if self.is_connected:
            self.is_connected = False
            self._emit_event("ESP32_DISCONNECTED", {
                "port": self.port,
                "message": "Disconnected from serial port."
            })

    def enable_simulation(self, enable: bool = True):
        """Toggle simulation mode for testing UI without physical ESP32."""
        with self._lock:
            self.is_simulated = enable
        self.connect()

    def set_collector(self, callback: Optional[Callable[[List[float]], None]]):
        """Set an active consumer callback for incoming validated 8-value readings."""
        with self._lock:
            self._collector_callback = callback

    def clear_collector(self):
        """Clear the active consumer callback."""
        with self._lock:
            self._collector_callback = None

    def acquire_mode(self, mode: str) -> bool:
        """
        Ensure mutual exclusivity between CALIBRATING, READING, and IDLE.
        """
        with self._lock:
            if self.current_mode != "IDLE" and self.current_mode != mode:
                return False
            self.current_mode = mode
            return True

    def release_mode(self):
        """Release current mode back to IDLE."""
        with self._lock:
            self.current_mode = "IDLE"

    def get_status(self) -> Dict[str, Any]:
        """Return current status of serial connection."""
        return {
            "is_connected": self.is_connected,
            "is_simulated": self.is_simulated,
            "port": self.port,
            "baud_rate": self.baud_rate,
            "current_mode": self.current_mode,
            "valid_readings_count": self.valid_readings_count,
            "skipped_lines_count": self.skipped_lines_count,
            "last_error": self.last_error,
            "latest_reading": self.latest_reading,
            "last_reading_time": self.last_reading_time,
            "available_ports": self.list_ports()
        }

    def _process_line(self, line: str):
        """
        Validate that each received line contains exactly eight numeric values:
        thumb, index, middle, ring, little, accel_x, accel_y, accel_z
        """
        if not line:
            return

        parts = line.split(",")
        if len(parts) != 8:
            self.skipped_lines_count += 1
            return

        try:
            values = [float(x.strip()) for x in parts]
        except ValueError:
            self.skipped_lines_count += 1
            return

        self.valid_readings_count += 1
        now = time.time()
        self.last_reading_time = now
        self.latest_reading = values

        # Dispatch to active collector (calibration or prediction)
        with self._lock:
            callback = self._collector_callback

        if callback:
            try:
                callback(values)
            except Exception as e:
                print(f"[SerialManager] Collector callback error: {e}")

        # Throttled Telemetry broadcast (~10Hz)
        if now - self._last_telemetry_time >= 0.1:
            self._last_telemetry_time = now
            self._emit_event("TELEMETRY", {
                "values": values,
                "readings_count": self.valid_readings_count,
                "skipped_count": self.skipped_lines_count,
                "timestamp": now
            })

    def _reader_loop(self):
        """Continuous serial read loop."""
        print(f"[SerialManager] Reader loop started for {self.port}")
        while self._running and self.ser and self.ser.is_open:
            try:
                raw_bytes = self.ser.readline()
                if not raw_bytes:
                    continue

                line = raw_bytes.decode("utf-8", errors="ignore").strip()
                self._process_line(line)

            except serial.SerialException as e:
                if not self._running:
                    break
                friendly_err = f"Serial port disconnected unexpectedly: {e}"
                print(f"[SerialManager] {friendly_err}")
                self.is_connected = False
                self.last_error = friendly_err
                self._emit_event("ESP32_DISCONNECTED", {
                    "port": self.port,
                    "error": friendly_err,
                    "recovery": "Please check the ESP32 USB connection and click Reconnect."
                })
                break
            except Exception as e:
                if not self._running:
                    break
                print(f"[SerialManager] Reader loop exception: {e}")
                time.sleep(0.05)

        print("[SerialManager] Reader loop ended.")

    def _simulation_loop(self):
        """Simulation generator for testing when physical hardware is not plugged in."""
        import random
        print("[SerialManager] Simulation loop started.")
        while self._running:
            # Generate simulated reading based on current mode
            # Thumb (0=S, 1=B), Index, Middle, Ring, Little, Ax, Ay, Az
            if self.current_mode == "CALIBRATING":
                # Will be shaped by calibration service stage if desired
                reading = [
                    0.0,
                    random.uniform(920, 960),
                    random.uniform(850, 890),
                    random.uniform(910, 950),
                    random.uniform(860, 900),
                    random.uniform(-0.05, 0.05),
                    random.uniform(0.95, 1.05),
                    random.uniform(-0.05, 0.05)
                ]
            elif self.current_mode == "READING":
                # Simulated gesture reading
                reading = [
                    0.0,
                    random.uniform(930, 960),
                    random.uniform(900, 940),
                    random.uniform(700, 750),  # bent ring
                    random.uniform(700, 750),  # bent little
                    random.uniform(-0.02, 0.02),
                    random.uniform(0.98, 1.02), # UP
                    random.uniform(-0.02, 0.02)
                ]
            else:
                reading = [
                    0.0,
                    random.uniform(900, 930),
                    random.uniform(820, 860),
                    random.uniform(880, 920),
                    random.uniform(830, 870),
                    random.uniform(-0.05, 0.05),
                    random.uniform(0.90, 1.05),
                    random.uniform(-0.05, 0.05)
                ]

            line = ",".join(f"{v:.2f}" for v in reading)
            self._process_line(line)
            time.sleep(0.05) # ~20 readings/sec

        print("[SerialManager] Simulation loop ended.")
