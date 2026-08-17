export const DEFAULT_LANGUAGE = 'en';

export const SKILL_CODES = {
  AIM: 'Aiming',
  BLA: 'LongBlade',
  BUA: 'Blunt',
  COO: 'Cooking',
  CRP: 'Carpentry',
  DOC: 'FirstAid',
  ELC: 'Electricity',
  FIS: 'Fishing',
  FKN: 'FlintKnapping',
  FOR: 'Foraging',
  FRM: 'Farming',
  HUS: 'Husbandry',
  LFT: 'Lightfoot',
  MEC: 'Mechanics',
  MTL: 'MetalWelding',
  POT: 'Pottery',
  REL: 'Reloading',
  SBA: 'ShortBlade',
  TAI: 'Tailoring',
  TRA: 'Trapping'
};

export const STATUS_CODES = {
  BOR: 'boredom',
  FAT: 'fatigue',
  PAN: 'panic',
  STS: 'stress'
};

export const RECIPE_GROUP_PREFIXES = [
  'EngineerMagazine',
  'ElectronicsMag',
  'PrimitiveToolMag',
  'GlassmakingMag',
  'HerbalistMag',
  'MechanicMag',
  'MetalworkMag',
  'SmithingMag',
  'TailoringMag',
  'CookingMag',
  'FarmingMag',
  'FishingMag',
  'HuntingMag',
  'KnittingMag',
  'ArmorMag',
  'WeaponMag',
  'TrickMag',
  'HempMag',
  'KeyMag',
  'RadioMag'
].sort((a, b) => b.length - a.length);
