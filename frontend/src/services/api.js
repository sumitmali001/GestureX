const BASE_URL = import.meta.env.VITE_API_URL || '';

async function fetchJson(endpoint, options = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!res.ok) {
    let errorDetail = res.statusText;
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorJson.error || errorDetail;
    } catch (_) {}
    throw new Error(errorDetail);
  }

  return res.json();
}

export const api = {
  getStatus: () => fetchJson('/api/status'),
  getPorts: () => fetchJson('/api/serial/ports'),
  connectSerial: (port = 'COM3', baud_rate = 115200) =>
    fetchJson('/api/serial/connect', {
      method: 'POST',
      body: JSON.stringify({ port, baud_rate })
    }),
  disconnectSerial: () =>
    fetchJson('/api/serial/disconnect', { method: 'POST' }),
  toggleSimulation: (enabled = true) =>
    fetchJson('/api/serial/simulation', {
      method: 'POST',
      body: JSON.stringify({ enabled })
    }),
  
  // Calibration
  getCalibrationStatus: () => fetchJson('/api/calibration/status'),
  startCalibrationSession: () => fetchJson('/api/calibration/start', { method: 'POST' }),
  captureStage: (stage) =>
    fetchJson('/api/calibration/capture', {
      method: 'POST',
      body: JSON.stringify({ stage })
    }),
  cancelCalibration: () => fetchJson('/api/calibration/cancel', { method: 'POST' }),
  finalizeCalibration: () => fetchJson('/api/calibration/finish', { method: 'POST' }),

  // Gesture Reading
  getReadingStatus: () => fetchJson('/api/reading/status'),
  startReading: (continuous = false) =>
    fetchJson('/api/reading/start', {
      method: 'POST',
      body: JSON.stringify({ continuous })
    }),
  stopReading: () => fetchJson('/api/reading/stop', { method: 'POST' }),

  // Predictor info & Gesture Map
  getPredictorInfo: () => fetchJson('/api/predictor/info'),
  updateGestureMap: (mappings) =>
    fetchJson('/api/predictor/gesture-map', {
      method: 'POST',
      body: JSON.stringify({ mappings })
    })
};
