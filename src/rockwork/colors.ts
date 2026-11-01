import type { RockType } from '../model/schema';

export const ROCK_COLORS: Record<RockType, string> = {
  sandstone: '#b9a17f',
  granite: '#9b9792',
  limestone: '#d2c9b6',
  basalt: '#504d4a',
};

export const ROCK_LABELS: Record<RockType, string> = {
  sandstone: 'Sandstone',
  granite: 'Granite',
  limestone: 'Limestone',
  basalt: 'Basalt',
};
