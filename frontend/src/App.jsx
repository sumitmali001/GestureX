import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import TelemetryBar from './components/TelemetryBar';
import GestureRecognition from './components/GestureRecognition';
import CalibrationModal from './components/CalibrationModal';
import GestureMapModal from './components/GestureMapModal';
import PortSettingsModal from './components/PortSettingsModal';
import ErrorBanner from './components/ErrorBanner';

import { api } from './services/api';
import { speech } from './services/speech';
import { useWebSocket } from './hooks/useWebSocket';

export default function App() {
  // System & Hardware State
  const [serialStatus, setSerialStatus] = useState({
    is_connected: false,
    is_simulated: false,
    port: 'COM3',
    baud_rate: 115200,
    valid_readings_count: 0,
    skipped_lines_count: 0
  });
  const [currentMode, setCurrentMode] = useState('IDLE');
  const [latestReading, setLatestReading] = useState(null);
  const [thresholds, setThresholds] = useState({
    INDEX_THRESHOLD: 920,
    MIDDLE_THRESHOLD: 825,
    RING_THRESHOLD: 895,
    LITTLE_THRESHOLD: 840
  });
  const [accelCalibration, setAccelCalibration] = useState({
    axis: [0.0, 1.0, 0.0],
    threshold: 0.0
  });

  // Calibration State
  const [calibrationStatus, setCalibrationStatus] = useState(null);
  const [calibrationProgress, setCalibrationProgress] = useState(null);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);

  // Gesture Recognition State
  const [isReading, setIsReading] = useState(false);
  const [predictionProgress, setPredictionProgress] = useState(null);
  const [lastPrediction, setLastPrediction] = useState(null);
  const [predictionHistory, setPredictionHistory] = useState([]);

  // Modals & UI State
  const [isGestureMapOpen, setIsGestureMapOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [gestureMap, setGestureMap] = useState([]);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [globalError, setGlobalError] = useState(null);

  // Initial data loading
  const refreshSystemStatus = useCallback(async () => {
    try {
      const data = await api.getStatus();
      if (data.serial) setSerialStatus(data.serial);
      if (data.calibration) {
        setCalibrationStatus(data.calibration);
        if (data.calibration.current_thresholds) {
          setThresholds(data.calibration.current_thresholds);
          setAccelCalibration({
            axis: data.calibration.current_thresholds.ACCEL_AXIS || [0, 1, 0],
            threshold: data.calibration.current_thresholds.ACCEL_THRESHOLD || 0
          });
        }
      }
      if (data.prediction) {
        setIsReading(Boolean(data.prediction.is_reading));
        if (data.prediction.last_prediction) setLastPrediction(data.prediction.last_prediction);
      }
    } catch (e) {
      console.warn("Could not fetch system status on initial load:", e);
    }

    try {
      const predInfo = await api.getPredictorInfo();
      if (predInfo.thresholds) {
        setThresholds(predInfo.thresholds);
        setAccelCalibration({
          axis: predInfo.thresholds.ACCEL_AXIS || [0, 1, 0],
          threshold: predInfo.thresholds.ACCEL_THRESHOLD || 0
        });
      }
      if (predInfo.gesture_map) {
        setGestureMap(predInfo.gesture_map);
      }
    } catch (e) {
      console.warn("Could not fetch predictor info:", e);
    }
  }, []);

  useEffect(() => {
    refreshSystemStatus();
  }, [refreshSystemStatus]);

  // Handle incoming WebSocket events
  const handleWebSocketEvent = useCallback((type, payload) => {
    switch (type) {
      case 'INITIAL_STATE':
        if (payload.serial) setSerialStatus(payload.serial);
        if (payload.calibration) setCalibrationStatus(payload.calibration);
        if (payload.prediction) {
          setIsReading(Boolean(payload.prediction.is_reading));
          if (payload.prediction.last_prediction) setLastPrediction(payload.prediction.last_prediction);
        }
        break;

      case 'ESP32_CONNECTED':
        setSerialStatus((prev) => ({
          ...prev,
          is_connected: true,
          port: payload.port || prev.port,
          baud_rate: payload.baud_rate || prev.baud_rate,
          is_simulated: Boolean(payload.simulated)
        }));
        setGlobalError(null);
        break;

      case 'ESP32_DISCONNECTED':
        setSerialStatus((prev) => ({
          ...prev,
          is_connected: false
        }));
        if (payload.error) {
          setGlobalError({
            title: 'ESP32 Disconnected',
            message: payload.error,
            recovery: payload.recovery || 'Verify ESP32 USB connection and click Reconnect.'
          });
        }
        break;

      case 'TELEMETRY':
        if (payload.values) {
          setLatestReading(payload.values);
        }
        setSerialStatus((prev) => ({
          ...prev,
          valid_readings_count: payload.readings_count ?? prev.valid_readings_count,
          skipped_lines_count: payload.skipped_count ?? prev.skipped_lines_count
        }));
        break;

      case 'CALIBRATION_STARTED':
        setCurrentMode('CALIBRATING');
        setCalibrationStatus((prev) => ({
          ...prev,
          is_capturing: true,
          current_stage: payload.stage
        }));
        setCalibrationProgress({
          percent: 0,
          remaining: payload.duration || 10.0,
          readings_count: 0
        });
        break;

      case 'CALIBRATION_PROGRESS':
        setCalibrationProgress(payload);
        break;

      case 'CALIBRATION_STAGE_COMPLETED':
        setCalibrationProgress(null);
        setCalibrationStatus((prev) => {
          if (!prev) return prev;
          const updatedStages = { ...(prev.stages || {}) };
          if (updatedStages[payload.stage]) {
            updatedStages[payload.stage] = {
              ...updatedStages[payload.stage],
              collected: true,
              readings_count: payload.readings_count
            };
          }
          return {
            ...prev,
            is_capturing: false,
            stages: updatedStages
          };
        });
        break;

      case 'CALIBRATION_COMPLETED':
        setCurrentMode('IDLE');
        setCalibrationStatus((prev) => ({
          ...prev,
          is_capturing: false,
          last_results: payload,
          last_error: null
        }));
        if (payload.thresholds) {
          setThresholds(payload.thresholds);
        }
        if (payload.accel_axis) {
          setAccelCalibration({
            axis: payload.accel_axis,
            threshold: payload.accel_threshold ?? 0.0
          });
        }
        break;

      case 'PREDICTION_STARTED':
        setCurrentMode('READING');
        setIsReading(true);
        setPredictionProgress({
          percent: 0,
          remaining: payload.duration || 5.0,
          readings_count: 0
        });
        break;

      case 'PREDICTION_PROGRESS':
        setPredictionProgress(payload);
        break;

      case 'PREDICTION_COMPLETED':
        setPredictionProgress(null);
        setLastPrediction(payload);
        setPredictionHistory((prev) => [payload, ...prev.slice(0, 49)]);
        
        // Vocalise gesture using Speech Synthesis
        if (payload.gesture && payload.is_mapped) {
          speech.speak(payload.gesture);
        }
        break;

      case 'PREDICTION_ERROR':
        setPredictionProgress(null);
        setGlobalError({
          title: 'Gesture Capture Error',
          message: payload.error,
          recovery: payload.recovery || 'Hold hand steady and ensure sensor connection is solid.'
        });
        break;

      case 'GESTURE_MAP_UPDATED':
        if (payload.gesture_map) {
          setGestureMap(payload.gesture_map);
        }
        break;

      case 'GENERAL_ERROR':
        setGlobalError({
          title: payload.title || 'System Error',
          message: payload.error,
          recovery: payload.recovery
        });
        break;

      default:
        break;
    }
  }, []);

  const { wsStatus, reconnect: reconnectWs } = useWebSocket(handleWebSocketEvent);

  // Sync mode state
  useEffect(() => {
    if (calibrationStatus?.is_capturing) {
      setCurrentMode('CALIBRATING');
    } else if (isReading) {
      setCurrentMode('READING');
    } else {
      setCurrentMode('IDLE');
    }
  }, [calibrationStatus?.is_capturing, isReading]);

  // Active Polling Fallback (ensures UI always updates even if WebSocket has delay)
  useEffect(() => {
    const pollActiveState = async () => {
      try {
        if (isReading) {
          const rStatus = await api.getReadingStatus();
          if (rStatus) {
            setIsReading(Boolean(rStatus.is_reading));
            if (rStatus.current_progress) {
              setPredictionProgress(rStatus.current_progress);
            }
            if (rStatus.last_prediction) {
              setLastPrediction((prev) => {
                if (!prev || prev.timestamp !== rStatus.last_prediction.timestamp) {
                  setPredictionHistory((hist) => [rStatus.last_prediction, ...hist.slice(0, 49)]);
                  if (rStatus.last_prediction.gesture && rStatus.last_prediction.is_mapped) {
                    speech.speak(rStatus.last_prediction.gesture);
                  }
                  return rStatus.last_prediction;
                }
                return prev;
              });
            }
          }
        }

        if (calibrationStatus?.is_capturing) {
          const cStatus = await api.getCalibrationStatus();
          if (cStatus) {
            setCalibrationStatus(cStatus);
            if (cStatus.current_progress) {
              setCalibrationProgress(cStatus.current_progress);
            } else if (!cStatus.is_capturing) {
              setCalibrationProgress(null);
            }
            if (cStatus.current_thresholds) {
              setThresholds(cStatus.current_thresholds);
            }
          }
        }
      } catch (_) {}
    };

    let interval = null;
    if (isReading || calibrationStatus?.is_capturing) {
      interval = setInterval(pollActiveState, 350);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isReading, calibrationStatus?.is_capturing]);

  // Handler: Start Reading
  const handleStartReading = async (continuous) => {
    setGlobalError(null);
    setIsReading(true);
    setCurrentMode('READING');
    try {
      await api.startReading(continuous);
    } catch (e) {
      setIsReading(false);
      setCurrentMode('IDLE');
      setGlobalError({
        title: 'Cannot Start Reading',
        message: e.message || 'Failed to start gesture reading.'
      });
    }
  };

  // Handler: Stop Reading
  const handleStopReading = async () => {
    try {
      await api.stopReading();
      setIsReading(false);
      setPredictionProgress(null);
      setCurrentMode('IDLE');
    } catch (e) {
      console.warn("Error stopping reading:", e);
    }
  };

  // Handler: Start Stage Capture
  const handleStartStageCapture = async (stage) => {
    setGlobalError(null);
    setCalibrationStatus((prev) => ({
      ...prev,
      is_capturing: true,
      current_stage: stage
    }));
    setCurrentMode('CALIBRATING');
    try {
      await api.captureStage(stage);
    } catch (e) {
      setCalibrationStatus((prev) => ({
        ...prev,
        is_capturing: false
      }));
      setCurrentMode('IDLE');
      setGlobalError({
        title: `Stage ${stage} Capture Failed`,
        message: e.message || 'Could not start calibration stage.'
      });
    }
  };

  // Handler: Cancel Calibration Capture
  const handleCancelCalibrationCapture = async () => {
    try {
      await api.cancelCalibration();
      setCalibrationProgress(null);
    } catch (e) {
      console.warn("Error cancelling calibration:", e);
    }
  };

  // Handler: Reset Calibration Session
  const handleResetCalibration = async () => {
    try {
      await api.startCalibrationSession();
      refreshSystemStatus();
    } catch (e) {
      console.warn("Error resetting calibration:", e);
    }
  };

  // Handler: Reconnect Serial
  const handleReconnect = async () => {
    setGlobalError(null);
    try {
      const res = await api.connectSerial(serialStatus.port, serialStatus.baud_rate);
      if (!res.success && res.error) {
        setGlobalError({
          title: 'Serial Connection Failed',
          message: res.error,
          recovery: 'Please plug in the ESP32 to COM3 and close any open Serial Monitor windows.'
        });
      }
    } catch (e) {
      setGlobalError({
        title: 'Connection Error',
        message: e.message || 'Could not connect to serial port.'
      });
    }
  };

  // Handler: Connect selected port
  const handleConnectPort = async (port, baud) => {
    setGlobalError(null);
    const res = await api.connectSerial(port, baud);
    if (!res.success && res.error) {
      throw new Error(res.error);
    }
  };

  // Handler: Toggle Hardware Simulation
  const handleToggleSimulation = async (enabled) => {
    setGlobalError(null);
    try {
      await api.toggleSimulation(enabled);
      refreshSystemStatus();
    } catch (e) {
      setGlobalError({
        title: 'Simulation Toggle Failed',
        message: e.message
      });
    }
  };

  // Handler: Toggle Speech
  const handleToggleSpeech = () => {
    const nextVal = !speechEnabled;
    setSpeechEnabled(nextVal);
    speech.setEnabled(nextVal);
  };

  // Handler: Save Gesture Map to v4_predictor.py
  const handleSaveGestureMap = async (updatedList) => {
    setGlobalError(null);
    try {
      const res = await api.updateGestureMap(updatedList);
      if (res.success && res.gesture_map) {
        setGestureMap(res.gesture_map);
      }
      return res;
    } catch (e) {
      setGlobalError({
        title: 'Gesture Map Update Failed',
        message: e.message || 'Could not save updated gesture map.'
      });
      throw e;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800">
      
      {/* Engineering Header */}
      <Header
        serialStatus={serialStatus}
        currentMode={currentMode}
        wsStatus={wsStatus}
        speechEnabled={speechEnabled}
        onToggleSpeech={handleToggleSpeech}
        onOpenCalibration={() => setIsCalibrationOpen(true)}
        onOpenGestureMap={() => setIsGestureMapOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onReconnect={handleReconnect}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Global Error Banner */}
        <ErrorBanner
          error={globalError}
          onDismiss={() => setGlobalError(null)}
          onRetry={!serialStatus.is_connected ? handleReconnect : null}
        />

        {/* Live Telemetry Bar */}
        <TelemetryBar
          latestReading={latestReading}
          thresholds={thresholds}
          accelCalibration={accelCalibration}
          serialStatus={serialStatus}
        />

        {/* Gesture Recognition Section */}
        <GestureRecognition
          isReading={isReading}
          predictionProgress={predictionProgress}
          lastPrediction={lastPrediction}
          history={predictionHistory}
          onStartReading={handleStartReading}
          onStopReading={handleStopReading}
          speechEnabled={speechEnabled}
          isConnected={serialStatus.is_connected}
        />

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-3.5 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>HAND GESTURE VOCALISER V4 &bull; ESP32 + 5 FLEX SENSORS + MPU6500</span>
          <span>FastAPI Backend &bull; PySerial COM3 &bull; React Dashboard</span>
        </div>
      </footer>

      {/* Calibration Modal / Interface */}
      <CalibrationModal
        isOpen={isCalibrationOpen}
        onClose={() => setIsCalibrationOpen(false)}
        calibrationStatus={calibrationStatus}
        calibrationProgress={calibrationProgress}
        onStartStageCapture={handleStartStageCapture}
        onCancelCapture={handleCancelCalibrationCapture}
        onResetSession={handleResetCalibration}
        isConnected={serialStatus.is_connected}
      />

      {/* Gesture Map Dictionary Manager & Editor */}
      <GestureMapModal
        isOpen={isGestureMapOpen}
        onClose={() => setIsGestureMapOpen(false)}
        gestureMap={gestureMap}
        onSaveMap={handleSaveGestureMap}
      />

      {/* Port & Simulation Settings Modal */}
      <PortSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        serialStatus={serialStatus}
        onConnect={handleConnectPort}
        onToggleSimulation={handleToggleSimulation}
      />

    </div>
  );
}
