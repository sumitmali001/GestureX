import React, { useState } from 'react';
import { 
  X, 
  Sliders, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ArrowRight, 
  RotateCcw, 
  ShieldCheck, 
  Activity, 
  Hand, 
  ArrowUp, 
  ArrowDown,
  Info
} from 'lucide-react';

const STAGES = [
  {
    id: 'S',
    num: 1,
    title: 'STAGE 1: STRAIGHT (S)',
    instruction: 'Keep all five fingers completely straight.',
    buttonText: 'Capture Straight',
    icon: Hand,
    desc: 'Calibrates high resistance / baseline voltage for open palm.'
  },
  {
    id: 'B',
    num: 2,
    title: 'STAGE 2: BENT (B)',
    instruction: 'Bend all five fingers.',
    buttonText: 'Capture Bent',
    icon: RotateCcw,
    desc: 'Calibrates lowered resistance values for fully clenched fist.'
  },
  {
    id: 'U',
    num: 3,
    title: 'STAGE 3: HAND UP (U)',
    instruction: 'Hold your hand in the UP position.',
    buttonText: 'Capture Hand Up',
    icon: ArrowUp,
    desc: 'Calibrates MPU6500 gravity vector for hand pointing upwards.'
  },
  {
    id: 'D',
    num: 4,
    title: 'STAGE 4: HAND DOWN (D)',
    instruction: 'Hold your hand in the DOWN position.',
    buttonText: 'Capture Hand Down',
    icon: ArrowDown,
    desc: 'Calibrates MPU6500 gravity vector for hand pointing downwards.'
  }
];

export default function CalibrationModal({
  isOpen,
  onClose,
  calibrationStatus,
  calibrationProgress,
  onStartStageCapture,
  onCancelCapture,
  onResetSession,
  isConnected
}) {
  const [activeTab, setActiveTab] = useState('S');

  if (!isOpen) return null;

  const isCapturing = calibrationStatus?.is_capturing;
  const currentStage = calibrationStatus?.current_stage;
  const stagesStatus = calibrationStatus?.stages || {};
  const currentThresholds = calibrationStatus?.current_thresholds || {};
  const lastResults = calibrationStatus?.last_results;
  const lastError = calibrationStatus?.last_error;

  const progressPercent = calibrationProgress?.percent || 0;
  const remainingSec = calibrationProgress?.remaining !== undefined ? calibrationProgress.remaining : 10.0;
  const readingsCount = calibrationProgress?.readings_count || 0;

  const handleCapture = (stageId) => {
    onStartStageCapture(stageId);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="bg-navy-950 text-white px-6 py-4 flex items-center justify-between border-b border-navy-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-blue-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg tracking-wide uppercase font-sans">
                Sensor Calibration Mode
              </h3>
              <p className="text-xs text-slate-400">
                Calibrate 4 flex sensors & MPU6500 orientation axis. Automatically updates v4_predictor.py.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Failure Alert Banner (if any) */}
          {lastError && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-rose-900">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <h5 className="font-bold text-sm text-rose-800">Calibration Error</h5>
                  <p className="font-mono mt-1 text-slate-800 whitespace-pre-line leading-relaxed">
                    {lastError}
                  </p>
                  <p className="mt-2 text-rose-700">
                    Straight and bent averages must satisfy the expected threshold direction (Straight &gt; Bent). Please adjust hand posture and recalibrate the stage.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Success Result Banner */}
          {lastResults && lastResults.success && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-300 p-4 text-emerald-950 shadow-xs">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h5 className="font-bold text-sm text-emerald-900">
                    Calibration Completed Successfully!
                  </h5>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Calculated thresholds and orientation boundary have been written to <code className="bg-emerald-100/80 px-1.5 py-0.5 rounded font-mono text-emerald-900 font-semibold">v4_predictor.py</code> between calibration markers.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 font-mono text-xs">
                    <div className="bg-white/80 p-2 rounded border border-emerald-200">
                      <div className="text-[10px] text-slate-500 font-sans">INDEX THRESHOLD</div>
                      <div className="text-sm font-bold text-slate-800">{lastResults.thresholds?.INDEX_THRESHOLD}</div>
                    </div>
                    <div className="bg-white/80 p-2 rounded border border-emerald-200">
                      <div className="text-[10px] text-slate-500 font-sans">MIDDLE THRESHOLD</div>
                      <div className="text-sm font-bold text-slate-800">{lastResults.thresholds?.MIDDLE_THRESHOLD}</div>
                    </div>
                    <div className="bg-white/80 p-2 rounded border border-emerald-200">
                      <div className="text-[10px] text-slate-500 font-sans">RING THRESHOLD</div>
                      <div className="text-sm font-bold text-slate-800">{lastResults.thresholds?.RING_THRESHOLD}</div>
                    </div>
                    <div className="bg-white/80 p-2 rounded border border-emerald-200">
                      <div className="text-[10px] text-slate-500 font-sans">LITTLE THRESHOLD</div>
                      <div className="text-sm font-bold text-slate-800">{lastResults.thresholds?.LITTLE_THRESHOLD}</div>
                    </div>
                  </div>

                  <div className="mt-2.5 p-2 bg-white/80 rounded border border-emerald-200 font-mono text-[11px] text-slate-700 flex flex-wrap items-center justify-between gap-2">
                    <span>Accel Axis: [{lastResults.accel_axis?.join(', ')}]</span>
                    <span>Threshold: {lastResults.accel_threshold}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stepper Navigation */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STAGES.map((s) => {
              const sData = stagesStatus[s.id];
              const isCollected = sData?.collected;
              const isThisActive = currentStage === s.id && isCapturing;

              return (
                <button
                  key={s.id}
                  onClick={() => !isCapturing && setActiveTab(s.id)}
                  disabled={isCapturing}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    isThisActive
                      ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                      : activeTab === s.id
                        ? 'bg-slate-50 border-slate-400 shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs font-bold text-slate-500">
                      STAGE {s.num} ({s.id})
                    </span>
                    {isCollected ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-300" />
                    )}
                  </div>
                  <div className="text-xs font-semibold text-slate-800 truncate">
                    {s.title.split(': ')[1]}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">
                    {isCollected ? `${sData.readings_count} samples` : 'Not captured'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Stage Detailed Card */}
          {(() => {
            const currentStageObj = STAGES.find(s => s.id === (isCapturing ? currentStage : activeTab));
            const sData = stagesStatus[currentStageObj.id];
            const isCollected = sData?.collected;
            const isThisCapturing = isCapturing && currentStage === currentStageObj.id;

            return (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <div className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-100 text-blue-800 uppercase mb-2">
                      {currentStageObj.title}
                    </div>
                    <h4 className="text-xl font-bold text-slate-900">
                      {currentStageObj.instruction}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {currentStageObj.desc}
                    </p>
                  </div>

                  {/* Stage Capture Button */}
                  <div>
                    {!isThisCapturing ? (
                      <button
                        onClick={() => handleCapture(currentStageObj.id)}
                        disabled={!isConnected || isCapturing}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors cursor-pointer disabled:cursor-not-allowed"
                      >
                        <Sliders className="w-4 h-4" />
                        <span>{currentStageObj.buttonText}</span>
                      </button>
                    ) : (
                      <button
                        onClick={onCancelCapture}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel Capture
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar during active 10s capture */}
                {isThisCapturing && (
                  <div className="mt-6 p-4 rounded-lg bg-blue-100/60 border border-blue-200">
                    <div className="flex items-center justify-between text-xs font-semibold text-blue-900 mb-2">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
                        <span>Collecting 10-second ESP32 readings for Mode {currentStageObj.id}...</span>
                      </span>
                      <span className="font-mono text-sm text-blue-800">
                        {remainingSec.toFixed(1)}s ({readingsCount} readings collected)
                      </span>
                    </div>

                    <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-blue-600 h-3 rounded-full transition-all duration-100 ease-linear"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Status indicator when already collected */}
                {!isThisCapturing && isCollected && (
                  <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md p-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Captured {sData.readings_count} valid samples. Ready to proceed or re-capture.</span>
                  </div>
                )}

              </div>
            );
          })()}

          {/* Current Predictor Thresholds Reference */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white">
            <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Active Thresholds in v4_predictor.py</span>
              <span className="text-[11px] font-mono text-slate-400 font-normal">Auto-loaded from file</span>
            </h5>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <div className="text-[10px] text-slate-500 font-sans">INDEX_THRESHOLD</div>
                <div className="text-sm font-bold text-slate-800">{currentThresholds.INDEX_THRESHOLD ?? 920}</div>
              </div>
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <div className="text-[10px] text-slate-500 font-sans">MIDDLE_THRESHOLD</div>
                <div className="text-sm font-bold text-slate-800">{currentThresholds.MIDDLE_THRESHOLD ?? 825}</div>
              </div>
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <div className="text-[10px] text-slate-500 font-sans">RING_THRESHOLD</div>
                <div className="text-sm font-bold text-slate-800">{currentThresholds.RING_THRESHOLD ?? 895}</div>
              </div>
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <div className="text-[10px] text-slate-500 font-sans">LITTLE_THRESHOLD</div>
                <div className="text-sm font-bold text-slate-800">{currentThresholds.LITTLE_THRESHOLD ?? 840}</div>
              </div>
            </div>

            <div className="mt-2.5 p-2 bg-slate-50 rounded border border-slate-200 font-mono text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
              <span>ACCEL_AXIS: [{currentThresholds.ACCEL_AXIS?.map(v => typeof v === 'number' ? v.toFixed(3) : v).join(', ') || '0.0, 1.0, 0.0'}]</span>
              <span>ACCEL_THRESHOLD: {currentThresholds.ACCEL_THRESHOLD ?? 0.0}</span>
              <span className="text-slate-400 font-sans text-[10px]">Thumb Rule: 0 = Straight, non-zero = Bent</span>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onResetSession}
            disabled={isCapturing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-300 rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All Stages</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-md shadow-xs transition-colors"
          >
            Close Calibration
          </button>
        </div>

      </div>
    </div>
  );
}
