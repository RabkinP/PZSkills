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

// Exact mapping between internal skill identifiers used by item/media data and
// Project Zomboid localization keys. Keep this explicit: do not infer keys by
// changing case, punctuation, or prefixes.
export const SKILL_TRANSLATION_KEYS = {
  Aiming: 'IGUI_perks_Aiming',
  Reloading: 'IGUI_perks_Reloading',
  LongBlade: 'IGUI_perks_LongBlade',
  Blunt: 'IGUI_perks_Blunt',
  ShortBlade: 'IGUI_perks_SmallBlade',
  Carpentry: 'IGUI_perks_Carpentry',
  Carving: 'IGUI_perks_Carving',
  Cooking: 'IGUI_perks_Cooking',
  Electricity: 'IGUI_perks_Electricity',
  Farming: 'IGUI_perks_Farming',
  FirstAid: 'IGUI_perks_Doctor',
  Fishing: 'IGUI_perks_Fishing',
  FlintKnapping: 'IGUI_perks_FlintKnapping',
  Foraging: 'IGUI_perks_Foraging',
  Glassmaking: 'IGUI_perks_Glassmaking',
  Masonry: 'IGUI_perks_Masonry',
  Mechanics: 'IGUI_perks_Mechanics',
  MetalWelding: 'IGUI_perks_MetalWelding',
  Blacksmith: 'IGUI_perks_Blacksmith',
  Pottery: 'IGUI_perks_Pottery',
  Tailoring: 'IGUI_perks_Tailoring',
  Trapping: 'IGUI_perks_Trapping',
  Husbandry: 'IGUI_perks_Husbandry',
  Butchering: 'IGUI_perks_Butchering',
  Tracking: 'IGUI_perks_Tracking',
  Maintenance: 'IGUI_perks_Maintenance',
  Lightfoot: 'IGUI_perks_Lightfooted'
};

// References confirmed to have no localization key in the supplied game data.
// New unresolved recipe references must fail the build until reviewed.
export const ALLOWED_UNRESOLVED_RECIPE_REFERENCES = new Set([
  'MakeSlugTrap'
]);
