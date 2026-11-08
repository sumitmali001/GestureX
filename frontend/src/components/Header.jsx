import React from 'react';
import { 
  Activity, 
  Cpu, 
  Volume2, 
  VolumeX, 
  Sliders, 
  BookOpen, 
  Settings, 
  RefreshCw, 
  Zap, 
  Wifi, 
  WifiOff 
} from 'lucide-react';

export default function Header({
  serialStatus,
  currentMode,
  wsStatus,
  speechEnabled,
  onToggleSpeech,
  onOpenCalibration,
  onOpenGestureMap,
  onOpenSettings,
  onReconnect
}) {
  const isConnected = serialStatus?.is_connected;
  const isSimulated = serialStatus?.is_simulated;
  const port = serialStatus?.port || 'COM3';
  const baudRate = serialStatus?.baud_rate || 115200;

  // Mode badge styling
  let modeBadge = {
    label: 'IDLE',
    color: 'bg-slate-700/60 text-slate-200 border-slate-600'
  };
  if (currentMode === 'CALIBRATING') {
    modeBadge = {
      label: 'CALIBRATING',
      color: 'bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse'
    };
  } else if (currentMode === 'READING') {
    modeBadge = {
      label: 'READING GESTURE',
      color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 animate-pulse'
    };
  }

  return (
    <header className="bg-navy-950 text-white border-b border-navy-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Title and Subtitle */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-navy-800 border border-navy-700 flex items-center justify-center text-blue-400 shadow-inner">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-wider text-slate-100 font-sans uppercase">
                  HAND GESTURE VOCALISER
                </h1>
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded border uppercase font-medium ${modeBadge.color}`}>
                  {modeBadge.label}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-normal">
                Real-time gesture recognition and speech interface.
              </p>
            </div>
          </div>

          {/* Status Indicators & Action Bar */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs">
            
            {/* ESP32 Status Pill */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border font-mono ${
              isConnected
                ? isSimulated
                  ? 'bg-amber-950/40 border-amber-700/60 text-amber-300'
                  : 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300'
                : 'bg-rose-950/40 border-rose-800 text-rose-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                isConnected
                  ? isSimulated ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
                  : 'bg-rose-500'
              }`} />
              <span className="font-semibold">
                {isConnected
                  ? isSimulated ? `SIMULATED (${port})` : `ESP32 (${port})`
                  : 'ESP32 DISCONNECTED'}
              </span>
              <span className="text-slate-400 font-normal">@{baudRate}</span>
            </div>

            {/* WebSocket Indicator */}
            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] font-mono ${
              wsStatus === 'CONNECTED' 
                ? 'bg-navy-900 border-navy-700 text-slate-300'
                : 'bg-amber-950/40 border-amber-800 text-amber-300'
            }`}>
              {wsStatus === 'CONNECTED' ? (
                <Wifi className="w-3.5 h-3.5 text-blue-400" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{wsStatus === 'CONNECTED' ? 'WS LIVE' : 'WS RECONNECT'}</span>
            </div>

            {/* Quick Reconnect */}
            {!isConnected && (
              <button
                onClick={onReconnect}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700 rounded-md font-medium transition-colors"
                title="Attempt Reconnecting to COM3"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reconnect</span>
              </button>
            )}

            {/* Speech Output Toggle */}
            <button
              onClick={onToggleSpeech}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-colors ${
                speechEnabled
                  ? 'bg-blue-900/40 border-blue-600/70 text-blue-200 hover:bg-blue-800/50'
                  : 'bg-navy-900 border-navy-700 text-slate-400 hover:text-slate-200'
              }`}
              title={speechEnabled ? 'Vocaliser Speech Output: ON' : 'Vocaliser Speech Output: MUTED'}
            >
              {speechEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-blue-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span className="font-mono text-[11px]">{speechEnabled ? 'VOICE ON' : 'MUTED'}</span>
            </button>

            {/* Gesture Map Quick Reference */}
            <button
              onClick={onOpenGestureMap}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-navy-900 hover:bg-navy-800 text-slate-200 border border-navy-700 rounded-md transition-colors"
              title="View all 26 mapped gestures"
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Gesture Map</span>
            </button>

            {/* Prominent Calibration Action Button */}
            <button
              onClick={onOpenCalibration}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-md shadow-xs transition-colors"
              title="Open Sensor Calibration Interface"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Calibration</span>
            </button>

            {/* Port & Simulation Settings */}
            <button
              onClick={onOpenSettings}
              className="p-1.5 bg-navy-900 hover:bg-navy-800 text-slate-300 border border-navy-700 rounded-md transition-colors"
              title="Hardware & Port Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

          </div>

        </div>
      </div>
    </header>
  );
}
