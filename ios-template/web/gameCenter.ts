import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface GameCenterStatus {
  authenticated: boolean;
  gamePlayerId?: string;
  displayName?: string;
}

interface GameCenterBridge {
  getStatus(): Promise<GameCenterStatus>;
  authenticate(): Promise<GameCenterStatus>;
  addListener(event: 'statusChanged', callback: (status: GameCenterStatus) => void): Promise<PluginListenerHandle>;
}

export const gameCenterAvailable = (): boolean =>
  Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('SyncCityGameCenter');

// Call only after gameCenterAvailable() succeeds; browsers must show an unavailable state.
export const GameCenter = registerPlugin<GameCenterBridge>('SyncCityGameCenter');
