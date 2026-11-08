import time
import serial
from collections import Counter

# ============================================================
# CONFIGURATION
# ============================================================

SERIAL_PORT = "COM3"
BAUD_RATE = 115200

CAPTURE_SECONDS = 5
MIN_READINGS = 10

THUMB_THRESHOLD = 0

FINGERS = ["Thumb", "Index", "Middle", "Ring", "Little"]


# ============================================================
# GESTURE MAPPING
# ============================================================

# KEY FORMAT:
# ("FIVE_FINGER_SEQUENCE", "ORIENTATION"): "GESTURE"

# Orientation:
# U = Hand Up / Straight
# D = Hand Down

# Replace the example values with your actual gestures.
# Add all 26 mappings manually.

# === GESTURE MAP START ===

GESTURE_MAP = {
    # ---------------- HAND UP (U) ----------------

    ("SBBBB", "U"): "A",
    ("SSBBB", "U"): "B",
    ("SSSSS", "U"): "C",
    ("BSSSS", "U"): "D",
    ("BSBBB", "U"): "E",
    ("SSSBS", "U"): "F",
    ("SSSBB", "U"): "G",
    ("SBBBS", "U"): "H",
    ("BBBBS", "U"): "I",
    ("BSSBB", "U"): "J",
    ("BBSSS", "U"): "K",
    ("SSBBS", "U"): "L",
    ("BBBBB", "U"): "M",

    # ---------------- HAND DOWN (D) ----------------

    ("SBBBB", "D"): "N",
    ("SSSSB", "D"): "O",
    ("SSSSS", "D"): "IOT",
    ("BSSSS", "D"): "Q",
    ("BSBBB", "D"): "R",
    ("SSSBS", "D"): "S",
    ("SSSBB", "D"): "T",
    ("SBBBS", "D"): "U",
    ("BBBBS", "D"): "V",
    ("BSSBB", "D"): "W",
    ("BBSSS", "D"): "X",
    ("SSBBS", "D"): "Y",
    ("BBBBB", "D"): "Z",
}

# === GESTURE MAP END ===


# ============================================================
# CALIBRATION VALUES
# ============================================================

# === CALIBRATION START ===

# Automatically updated by calibrate.py

INDEX_THRESHOLD = 860.84
MIDDLE_THRESHOLD = 674.6
RING_THRESHOLD = 359.92
LITTLE_THRESHOLD = 613.09

# Accelerometer orientation calibration
ACCEL_AXIS = [-0.07928, -0.357225, 0.930648]
ACCEL_THRESHOLD = -0.016337

# === CALIBRATION END ===


# ============================================================
# PREDICT EACH INDIVIDUAL READING
# ============================================================

def predict_fingers(values):

    thumb, index, middle, ring, little = values[:5]

    # Thumb: zero = Straight, non-zero = Bent.
    thumb_label = "S" if thumb == 0 else "B"

    # Other fingers: >= threshold = Straight.
    # Below threshold = Bent.

    index_label = "S" if index >= INDEX_THRESHOLD else "B"
    middle_label = "S" if middle >= MIDDLE_THRESHOLD else "B"
    ring_label = "S" if ring >= RING_THRESHOLD else "B"
    little_label = "S" if little >= LITTLE_THRESHOLD else "B"

    return [
        thumb_label,
        index_label,
        middle_label,
        ring_label,
        little_label
    ]


# ============================================================
# ACCELEROMETER ORIENTATION PREDICTION
# ============================================================

def predict_orientation(values):

    ax, ay, az = values[5:8]

    projection = (
        ax * ACCEL_AXIS[0]
        + ay * ACCEL_AXIS[1]
        + az * ACCEL_AXIS[2]
    )

    return "U" if projection >= ACCEL_THRESHOLD else "D"


# ============================================================
# CAPTURE SENSOR READINGS
# ============================================================

def capture_readings(ser):

    readings = []
    start_time = time.time()
    skipped = 0

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

    print(f"\nValid readings captured: {len(readings)}")

    if skipped:
        print(f"Invalid lines skipped: {skipped}")

    return readings


# ============================================================
# MAJORITY VOTING
# ============================================================

def majority_vote(votes):

    counts = Counter(votes)

    if not counts:
        return None

    highest_count = max(counts.values())

    # If there is a tie, use the most recent prediction.
    tied_labels = {
        label for label, count in counts.items()
        if count == highest_count
    }

    for label in reversed(votes):
        if label in tied_labels:
            return label

    return None


def finalize_prediction(readings):

    finger_votes = [[] for _ in range(5)]
    orientation_votes = []

    # Predict every captured reading.
    for values in readings:

        labels = predict_fingers(values)

        for i, label in enumerate(labels):
            finger_votes[i].append(label)

        orientation_votes.append(
            predict_orientation(values)
        )

    final_sequence = []

    print("\n========== FINGER-WISE VOTING ==========")

    for i, finger in enumerate(FINGERS):

        votes = finger_votes[i]

        s_count = votes.count("S")
        b_count = votes.count("B")

        final_label = majority_vote(votes)

        final_sequence.append(final_label)

        print(
            f"{finger:>6}: "
            f"S = {s_count}, "
            f"B = {b_count}, "
            f"Final = {final_label}"
        )

    # Orientation majority voting.
    final_orientation = majority_vote(orientation_votes)

    print("\n========== ORIENTATION VOTING ==========")

    print(f"UP count:   {orientation_votes.count('U')}")
    print(f"DOWN count: {orientation_votes.count('D')}")
    print(f"Final orientation: {final_orientation}")

    return "".join(final_sequence), final_orientation


# ============================================================
# GESTURE LOOKUP
# ============================================================

def get_gesture(sequence, orientation):

    key = (sequence, orientation)

    return GESTURE_MAP.get(
        key,
        "GESTURE NOT MAPPED"
    )


# ============================================================
# MAIN PROGRAM
# ============================================================

def main():

    print("==========================================")
    print("       HAND GESTURE VOCALISER V4")
    print("==========================================")

    print("\nPress ENTER to predict a gesture.")
    print("Type q to quit.")

    try:

        with serial.Serial(
            SERIAL_PORT,
            BAUD_RATE,
            timeout=1
        ) as ser:

            time.sleep(2)
            ser.reset_input_buffer()

            while True:

                command = input(
                    "\nPress ENTER for next attempt "
                    "or q to quit: "
                ).strip().lower()

                if command == "q":
                    print("\nExiting predictor.")
                    break

                ser.reset_input_buffer()

                print(
                    f"\nCapturing for {CAPTURE_SECONDS} seconds..."
                )

                print("Hold your gesture steady.")

                readings = capture_readings(ser)

                if len(readings) < MIN_READINGS:

                    print("\nNot enough readings.")
                    print("Please try again.")

                    continue

                # Get final finger sequence and orientation.
                sequence, orientation = finalize_prediction(
                    readings
                )

                # Look up the mapped gesture.
                gesture = get_gesture(
                    sequence,
                    orientation
                )

                print("\n==========================================")
                print("             FINAL PREDICTION")
                print("==========================================")

                print(f"Finger sequence: {sequence}")
                print(f"Orientation: {'UP' if orientation == 'U' else 'DOWN'}")

                print(f"\nPREDICTED GESTURE: {gesture}")

                print("==========================================")

    except serial.SerialException as error:

        print("\nSerial connection error:", error)
        print("Check COM3 and close Arduino Serial Monitor.")


if __name__ == "__main__":
    main()

