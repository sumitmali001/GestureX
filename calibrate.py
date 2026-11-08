import time
import serial
import math
import re
from pathlib import Path

# ============================================================
# CONFIGURATION
# ============================================================

SERIAL_PORT = "COM3"
BAUD_RATE = 115200

CAPTURE_SECONDS = 10
MIN_READINGS = 30

PREDICTOR_FILE = Path(__file__).parent / "v4_predictor.py"

FINGERS = ["Index", "Middle", "Ring", "Little"]


# ============================================================
# SERIAL DATA COLLECTION
# ============================================================

def capture_readings(ser, mode):

    readings = []
    start_time = time.time()
    skipped = 0

    print(f"\nCollecting {mode} readings for {CAPTURE_SECONDS} seconds...")
    print("Keep your hand position steady.")

    while time.time() - start_time < CAPTURE_SECONDS:

        line = ser.readline().decode(
            "utf-8",
            errors="ignore"
        ).strip()

        if not line:
            continue

        parts = line.split(",")

        if len(parts) != 8:
            skipped += 1
            continue

        try:
            values = [float(x.strip()) for x in parts]
        except ValueError:
            skipped += 1
            continue

        readings.append(values)

    print(f"Valid readings: {len(readings)}")

    if skipped:
        print(f"Skipped lines: {skipped}")

    if len(readings) < MIN_READINGS:
        raise RuntimeError(
            f"Not enough readings for mode {mode}. "
            f"Expected at least {MIN_READINGS}, got {len(readings)}."
        )

    return readings


# ============================================================
# CALCULATE FLEX SENSOR THRESHOLDS
# ============================================================

def calculate_thresholds(straight_data, bent_data):

    thresholds = {}

    # Sensor indexes:
    # 1 = Index
    # 2 = Middle
    # 3 = Ring
    # 4 = Little

    for i, finger in enumerate(FINGERS, start=1):

        straight_values = [row[i] for row in straight_data]
        bent_values = [row[i] for row in bent_data]

        straight_avg = sum(straight_values) / len(straight_values)
        bent_avg = sum(bent_values) / len(bent_values)

        print(f"\n{finger} finger:")
        print(f"  Straight average: {straight_avg:.2f}")
        print(f"  Bent average:     {bent_avg:.2f}")

        # Required condition:
        # Straight readings must be greater than bent readings.
        if straight_avg <= bent_avg:

            raise RuntimeError(
                f"\nCalibration failed for {finger}!\n"
                f"Straight average ({straight_avg:.2f}) must be "
                f"greater than bent average ({bent_avg:.2f}).\n"
                "Check the sensor placement, wiring and hand poses, "
                "then recalibrate."
            )

        threshold = (straight_avg + bent_avg) / 2

        thresholds[f"{finger.upper()}_THRESHOLD"] = round(
            threshold, 2
        )

        print(f"  Calculated threshold: {threshold:.2f}")

    return thresholds


# ============================================================
# CALCULATE ACCELEROMETER ORIENTATION BOUNDARY
# ============================================================

def calculate_accel_boundary(up_data, down_data):

    # Accelerometer indexes:
    # 5 = X
    # 6 = Y
    # 7 = Z

    up_mean = []
    down_mean = []

    for i in range(5, 8):

        up_mean.append(
            sum(row[i] for row in up_data) / len(up_data)
        )

        down_mean.append(
            sum(row[i] for row in down_data) / len(down_data)
        )

    # Direction vector from DOWN to UP.
    axis = [
        up_mean[i] - down_mean[i]
        for i in range(3)
    ]

    magnitude = math.sqrt(sum(x * x for x in axis))

    if magnitude < 1e-9:
        raise RuntimeError(
            "Accelerometer calibration failed: "
            "UP and DOWN readings are too similar."
        )

    # Normalize the direction vector.
    axis = [x / magnitude for x in axis]

    # Midpoint between UP and DOWN.
    midpoint = [
        (up_mean[i] + down_mean[i]) / 2
        for i in range(3)
    ]

    # Project midpoint onto the normalized axis.
    accel_threshold = sum(
        midpoint[i] * axis[i]
        for i in range(3)
    )

    print("\n========== ACCELEROMETER CALIBRATION ==========")
    print("UP average:  ", [round(x, 4) for x in up_mean])
    print("DOWN average:", [round(x, 4) for x in down_mean])
    print("Orientation axis:", [round(x, 6) for x in axis])
    print("Orientation threshold:", round(accel_threshold, 6))

    return axis, accel_threshold


# ============================================================
# UPDATE CALIBRATION VARIABLES IN PREDICTOR FILE
# ============================================================

def update_predictor(thresholds, accel_axis, accel_threshold):

    if not PREDICTOR_FILE.exists():
        raise FileNotFoundError(
            f"Could not find {PREDICTOR_FILE}"
        )

    code = PREDICTOR_FILE.read_text(encoding="utf-8")

    start_marker = "# === CALIBRATION START ==="
    end_marker = "# === CALIBRATION END ==="

    if start_marker not in code or end_marker not in code:
        raise RuntimeError(
            "Calibration markers were not found in v4_predictor.py."
        )

    new_block = f'''# === CALIBRATION START ===

# Automatically updated by calibrate.py

INDEX_THRESHOLD = {thresholds["INDEX_THRESHOLD"]}
MIDDLE_THRESHOLD = {thresholds["MIDDLE_THRESHOLD"]}
RING_THRESHOLD = {thresholds["RING_THRESHOLD"]}
LITTLE_THRESHOLD = {thresholds["LITTLE_THRESHOLD"]}

# Accelerometer orientation calibration
ACCEL_AXIS = {accel_axis}
ACCEL_THRESHOLD = {accel_threshold}

# === CALIBRATION END ==='''

    pattern = re.escape(start_marker) + r".*?" + re.escape(end_marker)

    updated_code, replacements = re.subn(
        pattern,
        lambda match: new_block,
        code,
        count=1,
        flags=re.DOTALL
    )

    if replacements != 1:
        raise RuntimeError("Could not update calibration section.")

    # Write only after the entire replacement has succeeded.
    PREDICTOR_FILE.write_text(
        updated_code,
        encoding="utf-8"
    )

    print("\nv4_predictor.py updated successfully!")


# ============================================================
# MAIN CALIBRATION WORKFLOW
# ============================================================

def main():

    print("==========================================")
    print("       HAND GESTURE V4 CALIBRATION")
    print("==========================================")

    print("\nCalibration modes:")
    print("S = All fingers straight")
    print("B = All fingers bent")
    print("U = Hand facing up")
    print("D = Hand facing down")

    straight_data = None
    bent_data = None
    up_data = None
    down_data = None

    try:

        with serial.Serial(
            SERIAL_PORT,
            BAUD_RATE,
            timeout=1
        ) as ser:

            time.sleep(2)
            ser.reset_input_buffer()

            # Collect all four modes in order.
            modes = ["S", "B", "U", "D"]

            for mode in modes:

                while True:

                    command = input(
                        f"\nPrepare your hand for {mode} mode. "
                        f"Type {mode} and press ENTER to start: "
                    ).strip().upper()

                    if command == mode:
                        break

                    print(f"Invalid input. Please enter {mode}.")

                ser.reset_input_buffer()

                readings = capture_readings(ser, mode)

                if mode == "S":
                    straight_data = readings

                elif mode == "B":
                    bent_data = readings

                elif mode == "U":
                    up_data = readings

                elif mode == "D":
                    down_data = readings

                print(f"\n{mode} calibration completed!")

        # Calculate all values after collecting the four modes.
        print("\n==========================================")
        print("       CALCULATING CALIBRATION")
        print("==========================================")

        thresholds = calculate_thresholds(
            straight_data,
            bent_data
        )

        accel_axis, accel_threshold = calculate_accel_boundary(
            up_data,
            down_data
        )

        # Update predictor source file.
        update_predictor(
            thresholds,
            accel_axis,
            accel_threshold
        )

        print("\n==========================================")
        print("       CALIBRATION SUCCESSFUL!")
        print("==========================================")

        print("\nUpdated flex thresholds:")

        for name, value in thresholds.items():
            print(f"{name}: {value}")

        print("\nAccelerometer axis:", accel_axis)
        print("Accelerometer threshold:", accel_threshold)

        print("\nYou can now run:")
        print("python v4_predictor.py")

    except (serial.SerialException, RuntimeError, FileNotFoundError) as error:

        print("\nCALIBRATION FAILED!")
        print(error)

    except KeyboardInterrupt:

        print("\nCalibration cancelled.")


if __name__ == "__main__":
    main()

