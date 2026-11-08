import React from 'react';
import { Activity, Compass, ArrowUp, ArrowDown } from 'lucide-react';

export default function TelemetryBar({ latestReading, thresholds, accelCalibration, serialStatus }) {
  // latestReading: [thumb, index, middle, ring, little, ax, ay, az]
  const hasReading = Array.isArray(latestReading) && latestReading.length === 8;
  
  const thumbVal = hasReading ? latestReading[0] : 0;
  const indexVal = hasReading ? latestReading[1] : 0;
  const middleVal = hasReading ? latestReading[2] : 0;
  const ringVal = hasReading ? latestReading[3] : 0;
  const littleVal = hasReading ? latestReading[4] : 0;

  const ax = hasReading ? latestReading[5] : 0;
  const ay = hasReading ? latestReading[6] : 0;
  const az = hasReading ? latestReading[7] : 0;

  const indexThresh = thresholds?.INDEX_THRESHOLD ?? 920;
  const middleThresh = thresholds?.MIDDLE_THRESHOLD ?? 825;
  const ringThresh = thresholds?.RING_THRESHOLD ?? 895;
  const littleThresh = thresholds?.LITTLE_THRESHOLD ?? 840;

  // Real-time instantaneous finger labels
  const thumbState = thumbVal === 0 ? 'S' : 'B';
  const indexState = indexVal >= indexThresh ? 'S' : 'B';
  const middleState = middleVal >= middleThresh ? 'S' : 'B';
  const ringState = ringVal >= ringThresh ? 'S' : 'B';
  const littleState = littleVal >= littleThresh ? 'S' : 'B';

  // Real-time instantaneous orientation
  const axis = accelCalibration?.axis || [0.0, 1.0, 0.0];
  const accelThresh = accelCalibration?.threshold ?? 0.0;
  const projection = ax * axis[0] + ay * axis[1] + az * axis[2];
  const orientation = projection >= accelThresh ? 'UP' : 'DOWN';

  const fingers = [
    { name: 'Thumb', val: thumbVal, state: thumbState, threshNote: '0=S, >0=B' },
    { name: 'Index', val: indexVal.toFixed(1), state: indexState, thresh: indexThresh },
    { name: 'Middle', val: middleVal.toFixed(1), state: middleState, thresh: middleThresh },
    { name: 'Ring', val: ringVal.toFixed(1), state: ringState, thresh: ringThresh },
    { name: 'Little', val: littleVal.toFixed(1), state: littleState, thresh: littleThresh },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-slate-100">
        
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
          <Activity className="w-4 h-4 text-blue-600" />
          <span>Live Telemetry & Sensor Stream</span>
          <span className="text-[11px] font-normal normal-case text-slate-400 font-mono">
            {hasReading ? `[${latestReading.map(v => typeof v === 'number' ? v.toFixed(1) : v).join(', ')}]` : 'Waiting for sensor data...'}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
          <div>Valid: <span className="text-slate-800 font-semibold">{serialStatus?.valid_readings_count || 0}</span></div>
          <div>Skipped: <span className="text-slate-800 font-semibold">{serialStatus?.skipped_lines_count || 0}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-3">
        
        {/* 5 Flex Sensors */}
        {fingers.map((f) => (
          <div key={f.name} className="bg-slate-50 border border-slate-200/80 rounded-md p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium text-slate-600">
              <span>{f.name}</span>
              <span className={`px-1.5 py-0.2 rounded text-[11px] font-mono font-bold ${
                f.state === 'S' 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
                {f.state === 'S' ? 'STRAIGHT' : 'BENT'}
              </span>
            </div>
            
            <div className="mt-1.5 flex items-baseline justify-between font-mono">
              <span className="text-base font-bold text-slate-800">{hasReading ? f.val : '--'}</span>
              <span className="text-[10px] text-slate-400">
                {f.thresh ? `T: ${f.thresh}` : f.threshNote}
              </span>
            </div>
          </div>
        ))}

        {/* Accelerometer / Orientation Card */}
        <div className="bg-navy-900 border border-navy-800 rounded-md p-2.5 text-white flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-300">
            <span className="flex items-center gap-1 font-sans">
              <Compass className="w-3.5 h-3.5 text-blue-400" />
              MPU6500
            </span>
            <span className={`px-1.5 py-0.2 rounded text-[11px] font-mono font-bold flex items-center gap-0.5 ${
              orientation === 'UP' 
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' 
                : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
            }`}>
              {orientation === 'UP' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {orientation}
            </span>
          </div>

          <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-slate-400">
            <span>X:{ax.toFixed(2)}</span>
            <span>Y:{ay.toFixed(2)}</span>
            <span>Z:{az.toFixed(2)}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
