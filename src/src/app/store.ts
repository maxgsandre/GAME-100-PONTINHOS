import { create } from 'zustand';

interface AppState {
  userId: string | null;
  playerName: string;
  currentRoomId: string | null;
  setUserId: (id: string | null) => void;
  setPlayerName: (name: string) => void;
  setCurrentRoomId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  userId: null,
  playerName: '',
  currentRoomId: null,
  setUserId: (id) => set({ userId: id }),
  setPlayerName: (name) => set({ playerName: name }),
  setCurrentRoomId: (id) => set({ currentRoomId: id }),
}));
