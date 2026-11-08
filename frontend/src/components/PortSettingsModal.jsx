import React, { useState, useEffect } from 'react';
import { X, Settings, RefreshCw, Cpu, Check, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

export default function PortSettingsModal({
  isOpen,
  onClose,
  serialStatus,
  onConnect,
  onToggleSimulation
}) {
  const [selectedPort, setSelectedPort] = useState(serialStatus?.port || 'COM3');
  const [baudRate, setBaudRate] = useState(serialStatus?.baud_rate || 115200);
  const [availablePorts, setAvailablePorts] = useState([]);
  const [isLoadingPorts, setIsLoadingPorts] = useState(false);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadPorts();
      setSelectedPort(serialStatus?.port || 'COM3');
      setBaudRate(serialStatus?.baud_rate || 115200);
    }
  }, [isOpen, serialStatus]);

  const loadPorts = async () => {
    setIsLoadingPorts(true);
    setActionError(null);
    try {
      const res = await api.getPorts();
      setAvailablePorts(res.ports || []);
    } catch (e) {
      console.warn("Failed to load ports:", e);
    } finally {
      setIsLoadingPorts(false);
    }
  };

  const handleApply = async () => {
    setActionError(null);
    try {
      await onConnect(selectedPort, Number(baudRate));
      onClose();
    } catch (e) {
      setActionError(e.message || "Failed to connect to selected port.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-navy-950 text-white px-5 py-3.5 flex items-center justify-between border-b border-navy-800">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-sm tracking-wide uppercase font-sans">
              Serial & Hardware Settings
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          
          {actionError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-900 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Port Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5 font-semibold text-slate-700">
              <label>Serial COM Port</label>
              <button 
                onClick={loadPorts}
                className="text-blue-600 hover:text-blue-800 flex items-center gap-1 font-normal"
                disabled={isLoadingPorts}
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingPorts ? 'animate-spin' : ''}`} />
                Scan Ports
              </button>
            </div>

            <select
              value={selectedPort}
              onChange={(e) => setSelectedPort(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-slate-800 focus:outline-blue-500"
            >
              <option value="COM3">COM3 (Default ESP32 Port)</option>
              {availablePorts.map((p) => (
                <option key={p.port} value={p.port}>
                  {p.port} - {p.description}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Ensure Arduino Serial Monitor or any other terminal software is closed.
            </p>
          </div>

          {/* Baud Rate */}
          <div>
            <label className="block mb-1.5 font-semibold text-slate-700">Baud Rate</label>
            <input
              type="number"
              value={baudRate}
              onChange={(e) => setBaudRate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-slate-800 focus:outline-blue-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Fixed to 115200 for ESP32 firmware compatibility.
            </p>
          </div>

          {/* Simulation Toggle */}
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-amber-600" />
                  Hardware Simulation Mode
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Simulates 8-value stream for UI testing when ESP32 is unplugged.
                </p>
              </div>

              <button
                onClick={() => onToggleSimulation(!serialStatus?.is_simulated)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  serialStatus?.is_simulated ? 'bg-amber-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    serialStatus?.is_simulated ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end gap-2 text-xs">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-slate-600 hover:text-slate-800 border border-slate-300 rounded-md hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-xs flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5" />
            Connect Port
          </button>
        </div>

      </div>
    </div>
  );
}
