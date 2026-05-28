// Shared types and DTOs — consumed by both api and web

export type Cell = 'X' | 'O' | null;
export type GameStatus = 'IN_PROGRESS' | 'PLAYER_WIN' | 'BOT_WIN' | 'DRAW';
export type Difficulty = 'EASY' | 'HARD';
export type Role = 'PLAYER' | 'ADMIN';

export interface ScoreDto {
  easyCurrentStreak: number;
  easyBestStreak: number;
  hardCurrentStreak: number;
  hardBestStreak: number;
}

export interface MeDto {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  score: ScoreDto;
}

export interface GameDto {
  id: string;
  board: Cell[];
  status: GameStatus;
  difficulty: Difficulty;
  turn: 'PLAYER' | 'BOT';
}

export interface MoveResultDto {
  board: Cell[];
  botMove: number | null;
  status: GameStatus;
  score: ScoreDto;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  bestStreak: number;
}

export interface AdminScoreEntry {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
  easyBestStreak: number;
  hardBestStreak: number;
  easyCurrentStreak: number;
  hardCurrentStreak: number;
}

export interface RecentGameEntry {
  id: string;
  status: GameStatus;
  difficulty: Difficulty;
  createdAt: string;
  finishedAt: string | null;
}

export interface PlayerDetailDto {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
  score: ScoreDto;
  recentGames: RecentGameEntry[];
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  correlationId: string;
  timestamp: string;
  path: string;
}
