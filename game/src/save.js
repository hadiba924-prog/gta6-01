// Save / load progress to localStorage (money, respect, mission, coins, position).
const KEY = 'solmar-bay-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s !== 'object' || s === null) return null;
    return s;
  } catch (_) {
    return null;
  }
}

export function writeSave(state) {
  try {
    const s = {
      money: state.money,
      respect: state.respect,
      missionIndex: state.missionIndex,
      coinsTaken: [...state.coinsTaken],
      completed: [...state.completedMissions],
      pos: state.playerPos ? [state.playerPos.x, state.playerPos.y, state.playerPos.z] : null,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (_) { /* storage unavailable — play without saving */ }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (_) {}
}
