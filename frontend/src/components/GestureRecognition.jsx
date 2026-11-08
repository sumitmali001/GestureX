import React, { useState } from 'react';
import { 
  Play, 
  Square, 
  Volume2, 
  CheckCircle, 
  HelpCircle, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Compass, 
  ArrowUp, 
  ArrowDown, 
  Sparkles,
  Repeat
} from 'lucide-react';
import { speech } from '../services/speech';

export default function GestureRecognition({
  isReading,
  predictionProgress,
  lastPrediction,
  history,
  onStartReading,
  onStopReading,
  speechEnabled,
  isConnected
}) {
  const [continuous, setContinuous] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const handleStart = () => {
    onStartReading(continuous);
  };

  const handleSpeak = (text) => {
    speech.speak(text);
  };

  const isCapturing = isReading && predictionProgress;
  const progressPercent = predictionProgress?.percent || 0;
  const remainingSec = predictionProgress?.remaining !== undefined ? predictionProgress.remaining : 5.0;
  const readingCount = predictionProgress?.readings_count || 0;

  const sequence = lastPrediction?.sequence || '-----';
  const orientation = lastPrediction?.orientation || '--';
  const gesture = lastPrediction?.gesture || 'NO PREDICTION YET';
  const isMapped = lastPrediction?.is_mapped;
  const fingerBreakdown = lastPrediction?.finger_breakdown;
  const orientationVotes = lastPrediction?.orientation_votes;

  const fingerNames = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'];

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      
      {/* Section Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/50">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <span>Gesture Recognition</span>
            {isReading && (
              <span className="flex items-center gap-1.5 text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                ACTIVE (5s CAPTURE)
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            5-second sensor capture, per-finger majority voting, tie-breaking, and dictionary lookup.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Continuous Toggle */}
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
            <input 
              type="checkbox"
              checked={continuous}
              onChange={(e) => setContinuous(e.target.checked)}
              disabled={isReading}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 disabled:opacity-50"
            />
            <span className="flex items-center gap-1">
              <Repeat className="w-3.5 h-3.5 text-slate-400" />
              Continuous Mode
            </span>
          </label>

          {/* Start / Stop Buttons */}
          {!isReading ? (
            <button
              onClick={handleStart}
              disabled={!isConnected}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium text-sm rounded-lg shadow-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Reading</span>
            </button>
          ) : (
            <button
              onClick={onStopReading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>Stop Reading</span>
            </button>
          )}

        </div>
      </div>

      <div className="p-6">
        
        {/* Active Capture Countdown and Progress */}
        {isCapturing && (
          <div className="mb-6 p-4 rounded-lg bg-blue-50/70 border border-blue-200 transition-all">
            <div className="flex items-center justify-between text-xs font-medium text-blue-900 mb-2">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
                <span>Capturing sensor readings... Hold gesture steady!</span>
              </span>
              <span className="font-mono font-bold text-sm text-blue-700">
                {remainingSec.toFixed(1)}s remaining ({readingCount} readings)
              </span>
            </div>

            <div className="w-full bg-blue-200/80 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-100 ease-linear"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* HERO PREDICTION RESULT CARD */}
        <div className={`rounded-xl border p-6 transition-all ${
          lastPrediction 
            ? isMapped 
              ? 'bg-gradient-to-br from-slate-900 to-navy-900 text-white border-navy-800 shadow-md' 
              : 'bg-gradient-to-br from-amber-950/80 to-slate-900 text-white border-amber-900/60 shadow-md'
            : 'bg-slate-50 border-slate-200 text-slate-400 text-center py-12'
        }`}>
          {lastPrediction ? (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              
              {/* Left: Gesture Name & Vocalise */}
              <div className="flex-1">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  <span>RECOGNIZED GESTURE</span>
                  {isMapped ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-normal">
                      <CheckCircle className="w-3 h-3" /> MAPPED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-normal">
                      <HelpCircle className="w-3 h-3" /> UNMAPPED
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <h3 className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
                    isMapped ? 'text-white' : 'text-amber-200'
                  }`}>
                    {gesture}
                  </h3>

                  {/* Manual speech replay */}
                  {isMapped && (
                    <button
                      onClick={() => handleSpeak(gesture)}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-blue-300 hover:text-white transition-colors"
                      title="Speak gesture aloud"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="mt-2 text-xs text-slate-400 font-mono flex items-center gap-4">
                  <span>Samples: {lastPrediction.readings_count}</span>
                  <span>Captured at: {lastPrediction.formatted_time || 'Just now'}</span>
                </div>
              </div>

              {/* Right: Sequence & Orientation details */}
              <div className="flex flex-wrap items-center gap-4 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6">
                
                {/* Finger Sequence */}
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium mb-1.5">
                    FINGER SEQUENCE
                  </div>
                  <div className="flex items-center gap-1.5">
                    {sequence.split('').map((char, idx) => (
                      <div 
                        key={idx} 
                        className={`w-9 h-10 rounded-md border flex flex-col items-center justify-center font-mono font-bold text-sm ${
                          char === 'S'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        }`}
                        title={`${fingerNames[idx]}: ${char === 'S' ? 'Straight' : 'Bent'}`}
                      >
                        <span>{char}</span>
                        <span className="text-[9px] font-normal text-slate-400 uppercase">
                          {fingerNames[idx]?.charAt(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hand Orientation */}
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium mb-1.5">
                    HAND ORIENTATION
                  </div>
                  <div className={`h-10 px-3.5 rounded-md border flex items-center gap-1.5 font-mono font-bold text-sm ${
                    orientation === 'UP'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/50'
                      : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
                  }`}>
                    {orientation === 'UP' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                    <span>{orientation}</span>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div>
              <Sparkles className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600">No gesture predictions yet.</p>
              <p className="text-xs text-slate-400 mt-1">Click "Start Reading" above to perform a 5-second gesture capture.</p>
            </div>
          )}
        </div>

        {/* Diagnostic Voting Breakdown (Collapsible) */}
        {lastPrediction && fingerBreakdown && (
          <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Voting Breakdown & Tie-Breaking Diagnostics
              </span>
              {showDiagnostics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showDiagnostics && (
              <div className="p-4 bg-white text-xs border-t border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Finger Voting Table */}
                  <div>
                    <h5 className="font-semibold text-slate-800 mb-2">Finger-by-Finger Votes</h5>
                    <table className="w-full border-collapse font-mono text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-left">
                          <th className="py-1.5 px-2 font-medium">Finger</th>
                          <th className="py-1.5 px-2 font-medium text-center">Straight (S)</th>
                          <th className="py-1.5 px-2 font-medium text-center">Bent (B)</th>
                          <th className="py-1.5 px-2 font-medium text-center">Final Winner</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fingerNames.map((name) => {
                          const fData = fingerBreakdown[name];
                          return (
                            <tr key={name} className="border-b border-slate-100">
                              <td className="py-1.5 px-2 font-medium text-slate-700 font-sans">{name}</td>
                              <td className="py-1.5 px-2 text-center text-emerald-700 font-semibold">{fData?.S_count ?? 0}</td>
                              <td className="py-1.5 px-2 text-center text-amber-700 font-semibold">{fData?.B_count ?? 0}</td>
                              <td className="py-1.5 px-2 text-center">
                                <span className={`px-1.5 py-0.5 rounded font-bold ${
                                  fData?.final === 'S' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {fData?.final}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Orientation Voting */}
                  <div>
                    <h5 className="font-semibold text-slate-800 mb-2">Orientation Votes</h5>
                    <div className="bg-slate-50 border border-slate-200 rounded-md p-3 font-mono">
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-600 font-sans">UP Votes (U):</span>
                        <span className="font-bold text-blue-700">{orientationVotes?.U ?? 0}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-600 font-sans">DOWN Votes (D):</span>
                        <span className="font-bold text-indigo-700">{orientationVotes?.D ?? 0}</span>
                      </div>
                      <div className="flex justify-between pt-2 text-slate-800">
                        <span className="font-semibold font-sans">Majority Outcome:</span>
                        <span className="font-bold text-blue-900">{orientationVotes?.final}</span>
                      </div>
                    </div>

                    <div className="mt-3 text-[11px] text-slate-500 leading-normal">
                      <span className="font-semibold text-slate-700">Tie-Breaking Rule:</span> If vote counts between S and B (or UP and DOWN) are identical, the most recent sensor prediction in the capture window is selected as the winner.
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        )}

        {/* Gesture Recognition History */}
        {history && history.length > 0 && (
          <div className="mt-6">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Recent Recognition History</span>
              <span className="text-slate-400 font-mono font-normal">Last {history.length} attempts</span>
            </h4>

            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[11px] text-left sticky top-0">
                    <th className="py-2 px-3">Time</th>
                    <th className="py-2 px-3">Gesture</th>
                    <th className="py-2 px-3">Sequence</th>
                    <th className="py-2 px-3">Orientation</th>
                    <th className="py-2 px-3 text-right">Voice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {history.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2 px-3 text-slate-500 text-[11px]">{item.formatted_time}</td>
                      <td className="py-2 px-3 font-semibold font-sans text-slate-800">
                        <span className={item.is_mapped ? 'text-slate-900' : 'text-amber-700'}>
                          {item.gesture}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-bold tracking-wider">{item.sequence}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          item.orientation === 'UP' ? 'bg-blue-100 text-blue-800' : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {item.orientation}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        {item.is_mapped && (
                          <button
                            onClick={() => handleSpeak(item.gesture)}
                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                            title="Speak again"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
