import React, { useState, useEffect } from 'react';
import { 
  X, 
  BookOpen, 
  Search, 
  Volume2, 
  ArrowUp, 
  ArrowDown, 
  Plus, 
  Trash2, 
  Save, 
  RotateCcw, 
  Check, 
  AlertCircle, 
  Edit2, 
  CheckCircle2, 
  Sliders
} from 'lucide-react';
import { speech } from '../services/speech';

const FINGER_NAMES = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'];

const DEFAULT_26_MAPPINGS = [
  // Hand Up (U)
  { sequence: "SSSSS", raw_orientation: "U", orientation: "UP", gesture: "Gesture 1 - A" },
  { sequence: "SSSSB", raw_orientation: "U", orientation: "UP", gesture: "Gesture 2 - B" },
  { sequence: "SSSBS", raw_orientation: "U", orientation: "UP", gesture: "Gesture 3 - C" },
  { sequence: "SSBSS", raw_orientation: "U", orientation: "UP", gesture: "Gesture 4 - D" },
  { sequence: "SBSSS", raw_orientation: "U", orientation: "UP", gesture: "Gesture 5 - E" },
  { sequence: "BSSSS", raw_orientation: "U", orientation: "UP", gesture: "Gesture 6 - F" },
  { sequence: "SBBSS", raw_orientation: "U", orientation: "UP", gesture: "Gesture 7 - G" },
  { sequence: "BBSSS", raw_orientation: "U", orientation: "UP", gesture: "Gesture 8 - H" },
  { sequence: "SSBBS", raw_orientation: "U", orientation: "UP", gesture: "Gesture 9 - I" },
  { sequence: "SBSBS", raw_orientation: "U", orientation: "UP", gesture: "Gesture 10 - J" },
  { sequence: "BSBSS", raw_orientation: "U", orientation: "UP", gesture: "Gesture 11 - K" },
  { sequence: "BBSBS", raw_orientation: "U", orientation: "UP", gesture: "Gesture 12 - L" },
  { sequence: "BBBBB", raw_orientation: "U", orientation: "UP", gesture: "Gesture 13 - M" },
  // Hand Down (D)
  { sequence: "SSSSS", raw_orientation: "D", orientation: "DOWN", gesture: "Gesture 14 - N" },
  { sequence: "SSSSB", raw_orientation: "D", orientation: "DOWN", gesture: "Gesture 15 - O" },
  { sequence: "SSSBS", raw_orientation: "D", orientation: "DOWN", gesture: "Gesture 16 - P" },
  { sequence: "SSBSS", raw_orientation: "D", orientation: "DOWN", gesture: "Gesture 17 - Q" },
  { sequence: "SBSSS", raw_orientation: "D", orientation: "DOWN", gesture: "Gesture 18 - R" },
  { sequence: "BSSSS", raw_orientation: "D", orientation: "DOWN", gesture: "Gesture 19 - S" },
  { sequence: "SBBSS", raw_orientation: "D", orientation: "DOWN", gesture: "Gesture 20 - T" },
  { sequence: "BBSSS", raw_orientation: "D", orientation: "DOWN", gesture: "Gesture 21 - U" },
  { sequence: "SSBBS", raw_orientation: "D", orientation: "DOWN", gesture: "Gesture 22 - V" },
  { sequence: "SBSBS", raw_orientation: "D", orientation: "DOWN", gesture: "Gesture 23 - W" },
  { sequence: "BSBSS", raw_orientation: "D", orientation: "DOWN", gesture: "Gesture 24 - X" },
  { sequence: "BBSBS", raw_orientation: "D", orientation: "DOWN", gesture: "Gesture 25 - Y" },
  { sequence: "BBBBB", raw_orientation: "D", orientation: "DOWN", gesture: "Gesture 26 - Z" }
];

export default function GestureMapModal({ isOpen, onClose, gestureMap = [], onSaveMap }) {
  const [mappings, setMappings] = useState([]);
  const [filter, setFilter] = useState('');
  const [filterOrientation, setFilterOrientation] = useState('ALL'); // ALL, U, D
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success'|'error', text: '' }
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Sync mappings on open or when gestureMap prop changes
  useEffect(() => {
    if (isOpen) {
      setMappings(gestureMap && gestureMap.length > 0 ? JSON.parse(JSON.stringify(gestureMap)) : DEFAULT_26_MAPPINGS);
      setStatusMessage(null);
      setHasUnsavedChanges(false);
    }
  }, [isOpen, gestureMap]);

  if (!isOpen) return null;

  // Detect duplicate (sequence, raw_orientation) pairs
  const duplicateKeys = new Set();
  const seen = new Set();
  mappings.forEach((m) => {
    const key = `${m.sequence}_${m.raw_orientation || 'U'}`;
    if (seen.has(key)) {
      duplicateKeys.add(key);
    } else {
      seen.add(key);
    }
  });

  // Toggle single finger state between 'S' and 'B'
  const handleToggleFinger = (index, fingerIdx) => {
    setMappings((prev) => {
      const next = [...prev];
      const item = { ...next[index] };
      const chars = (item.sequence || 'SSSSS').split('');
      chars[fingerIdx] = chars[fingerIdx] === 'S' ? 'B' : 'S';
      item.sequence = chars.join('');
      next[index] = item;
      return next;
    });
    setHasUnsavedChanges(true);
    setStatusMessage(null);
  };

  // Toggle orientation between UP (U) and DOWN (D)
  const handleToggleOrientation = (index) => {
    setMappings((prev) => {
      const next = [...prev];
      const item = { ...next[index] };
      const isUp = item.raw_orientation === 'U' || item.orientation === 'UP';
      item.raw_orientation = isUp ? 'D' : 'U';
      item.orientation = isUp ? 'DOWN' : 'UP';
      next[index] = item;
      return next;
    });
    setHasUnsavedChanges(true);
    setStatusMessage(null);
  };

  // Update gesture output string
  const handleGestureTextChange = (index, text) => {
    setMappings((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], gesture: text };
      return next;
    });
    setHasUnsavedChanges(true);
    setStatusMessage(null);
  };

  // Add a new blank gesture mapping
  const handleAddNew = () => {
    // Generate a default unique sequence if possible
    let newSeq = "SSSSS";
    let newOri = filterOrientation === 'D' ? 'D' : 'U';
    
    // Check if (newSeq, newOri) already exists, if so pick an unused sequence
    const existingKeys = new Set(mappings.map(m => `${m.sequence}_${m.raw_orientation}`));
    const candidates = ["SSSSS", "SSSSB", "SSSBS", "SSBSS", "SBSSS", "BSSSS", "SBBSS", "BBSSS", "SSBBS", "SBSBS", "BSBSS", "BBSBS", "BBBBB"];
    for (const c of candidates) {
      if (!existingKeys.has(`${c}_${newOri}`)) {
        newSeq = c;
        break;
      }
    }

    const newItem = {
      sequence: newSeq,
      raw_orientation: newOri,
      orientation: newOri === 'U' ? 'UP' : 'DOWN',
      gesture: `Custom Gesture ${mappings.length + 1}`
    };

    setMappings((prev) => [newItem, ...prev]);
    setHasUnsavedChanges(true);
    setStatusMessage({
      type: 'info',
      text: 'New gesture mapping added. Remember to click "Save Changes" to apply.'
    });
  };

  // Delete gesture mapping
  const handleDelete = (index) => {
    const item = mappings[index];
    if (confirm(`Delete mapping for "${item.gesture}" (${item.sequence} ${item.orientation})?`)) {
      setMappings((prev) => prev.filter((_, idx) => idx !== index));
      setHasUnsavedChanges(true);
      setStatusMessage(null);
    }
  };

  // Reset to default 26 alphabet mappings
  const handleResetToDefaults = () => {
    if (confirm("Reset gesture map to the original 26 standard alphabet gestures? Any unsaved custom changes will be discarded.")) {
      setMappings(JSON.parse(JSON.stringify(DEFAULT_26_MAPPINGS)));
      setHasUnsavedChanges(true);
      setStatusMessage({
        type: 'info',
        text: 'Restored default 26 alphabet gestures. Click "Save Changes" to save to v4_predictor.py.'
      });
    }
  };

  // Save changes to v4_predictor.py
  const handleSave = async () => {
    if (duplicateKeys.size > 0) {
      setStatusMessage({
        type: 'error',
        text: 'Cannot save: duplicate sequence and orientation combinations detected! Please resolve highlighted entries.'
      });
      return;
    }

    // Check for empty gestures
    const emptyIdx = mappings.findIndex(m => !m.gesture || !m.gesture.trim());
    if (emptyIdx !== -1) {
      setStatusMessage({
        type: 'error',
        text: `Item #${emptyIdx + 1} has an empty gesture name. Please enter a valid name.`
      });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);
    try {
      if (onSaveMap) {
        await onSaveMap(mappings);
      }
      setHasUnsavedChanges(false);
      setStatusMessage({
        type: 'success',
        text: `Gesture map updated successfully! All ${mappings.length} mappings written to v4_predictor.py and reloaded.`
      });
    } catch (e) {
      setStatusMessage({
        type: 'error',
        text: e.message || 'Failed to save gesture map to v4_predictor.py.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Filter mappings
  const filtered = mappings.filter((m) => {
    const q = filter.toLowerCase();
    const matchesQuery = (
      (m.gesture || '').toLowerCase().includes(q) ||
      (m.sequence || '').toLowerCase().includes(q) ||
      (m.orientation || '').toLowerCase().includes(q)
    );
    const matchesOri = filterOrientation === 'ALL' || (m.raw_orientation || 'U') === filterOrientation;
    return matchesQuery && matchesOri;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="bg-navy-950 text-white px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-navy-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-navy-800 border border-navy-700 flex items-center justify-center text-blue-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-wide uppercase font-sans">
                  Gesture Map Manager & Editor
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  {mappings.length} mappings
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Click any finger to toggle Straight (S) vs Bent (B), edit gesture output text, or add new gestures.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-blue-600 hover:bg-blue-500 text-white animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save Changes *' : 'Save Changes'}</span>
            </button>

            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-md">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Notification Banner */}
        {statusMessage && (
          <div className={`px-5 py-2.5 text-xs flex items-center gap-2 border-b ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : statusMessage.type === 'error'
                ? 'bg-rose-50 text-rose-900 border-rose-200'
                : 'bg-blue-50 text-blue-900 border-blue-200'
          }`}>
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{statusMessage.text}</span>
          </div>
        )}

        {/* Toolbar: Search, Filter Tabs, Add Button */}
        <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search gesture text, sequence (e.g. SSBBS), or orientation..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md pl-9 pr-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-blue-500"
            />
          </div>

          {/* Orientation Filter Tabs & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            
            <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-slate-700">
              <button
                onClick={() => setFilterOrientation('ALL')}
                className={`px-2.5 py-1 rounded text-xs font-medium ${
                  filterOrientation === 'ALL' ? 'bg-navy-900 text-white' : 'hover:bg-slate-100'
                }`}
              >
                All ({mappings.length})
              </button>
              <button
                onClick={() => setFilterOrientation('U')}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                  filterOrientation === 'U' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'
                }`}
              >
                <ArrowUp className="w-3 h-3" />
                Hand Up ({mappings.filter(m => m.raw_orientation === 'U').length})
              </button>
              <button
                onClick={() => setFilterOrientation('D')}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                  filterOrientation === 'D' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100'
                }`}
              >
                <ArrowDown className="w-3 h-3" />
                Hand Down ({mappings.filter(m => m.raw_orientation === 'D').length})
              </button>
            </div>

            {/* Add New Gesture Button */}
            <button
              onClick={handleAddNew}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Gesture</span>
            </button>

            {/* Reset Defaults */}
            <button
              onClick={handleResetToDefaults}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors"
              title="Reset to 26 Alphabet Gestures"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Defaults</span>
            </button>

          </div>
        </div>

        {/* Gestures List */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
          
          <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-md p-2.5 flex items-center gap-2">
            <span className="font-semibold text-slate-700">How to edit:</span>
            <span>1. Edit the gesture text directly in the input box.</span>
            <span>&bull;</span>
            <span>2. Click on any of the 5 finger badges (T, I, M, R, L) to toggle between Straight (S) and Bent (B).</span>
            <span>&bull;</span>
            <span>3. Click the orientation pill to switch between UP and DOWN.</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((item, origIndex) => {
              // Locate original index in `mappings`
              const actualIndex = mappings.findIndex(m => m === item);
              const key = `${item.sequence}_${item.raw_orientation || 'U'}`;
              const isDuplicate = duplicateKeys.has(key);
              const seqChars = (item.sequence || 'SSSSS').split('');

              return (
                <div 
                  key={actualIndex}
                  className={`rounded-lg border p-3.5 transition-all flex flex-col justify-between gap-3 ${
                    isDuplicate 
                      ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-400'
                      : 'bg-white border-slate-200 hover:border-blue-300 shadow-xs'
                  }`}
                >
                  {/* Top row: Gesture Name Input + Actions */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-400 shrink-0">
                      #{actualIndex + 1}
                    </span>

                    {/* Editable Gesture Output */}
                    <input
                      type="text"
                      value={item.gesture}
                      onChange={(e) => handleGestureTextChange(actualIndex, e.target.value)}
                      placeholder="e.g. Hello, Thank You, Gesture 1 - A..."
                      className="flex-1 bg-slate-50 focus:bg-white border border-slate-300 focus:border-blue-500 rounded px-2.5 py-1 text-xs font-semibold text-slate-900 focus:outline-hidden"
                    />

                    {/* Speech Test Button */}
                    <button
                      onClick={() => speech.speak(item.gesture)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 transition-colors"
                      title="Test speech vocalisation"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDelete(actualIndex)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                      title="Delete this mapping"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Duplicate Error Warning */}
                  {isDuplicate && (
                    <div className="text-[11px] text-rose-700 font-medium flex items-center gap-1 font-mono">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Duplicate conflict! Another gesture already uses ({item.sequence}, {item.raw_orientation}).</span>
                    </div>
                  )}

                  {/* Bottom row: Interactive 5-Finger Selector + Orientation Toggle */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    
                    {/* 5 Finger Badges (Click to toggle) */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 hidden sm:inline">
                        Fingers:
                      </span>
                      {seqChars.map((char, fingerIdx) => (
                        <button
                          key={fingerIdx}
                          onClick={() => handleToggleFinger(actualIndex, fingerIdx)}
                          className={`w-7 h-8 rounded border flex flex-col items-center justify-center font-mono font-bold text-xs transition-transform active:scale-95 cursor-pointer ${
                            char === 'S'
                              ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-300'
                              : 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300'
                          }`}
                          title={`Click to toggle ${FINGER_NAMES[fingerIdx]}: currently ${char === 'S' ? 'Straight (S)' : 'Bent (B)'}`}
                        >
                          <span className="leading-none">{char}</span>
                          <span className="text-[8px] font-normal text-slate-500 uppercase mt-0.5">
                            {FINGER_NAMES[fingerIdx].charAt(0)}
                          </span>
                        </button>
                      ))}

                      <span className="ml-1.5 text-xs font-mono font-bold text-slate-700">
                        ({item.sequence})
                      </span>
                    </div>

                    {/* Orientation Toggle Button */}
                    <button
                      onClick={() => handleToggleOrientation(actualIndex)}
                      className={`px-2.5 py-1 rounded border text-xs font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                        item.raw_orientation === 'U'
                          ? 'bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300'
                          : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-800 border-indigo-300'
                      }`}
                      title="Click to toggle orientation between UP and DOWN"
                    >
                      {item.raw_orientation === 'U' ? (
                        <>
                          <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                          <span>UP</span>
                        </>
                      ) : (
                        <>
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                          <span>DOWN</span>
                        </>
                      )}
                    </button>

                  </div>

                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-xs">
              No gesture mappings match your filter criteria "{filter}".
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 sm:px-6 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          
          <div className="text-slate-500">
            {hasUnsavedChanges ? (
              <span className="text-amber-700 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                You have unsaved changes! Click "Save Changes" to write to v4_predictor.py.
              </span>
            ) : (
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                All mappings are synchronized with v4_predictor.py
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium rounded-md transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
