/**
 * trentoLandmarks.js
 * ─────────────────────────────────────────────────────────────────
 * Curated local destination database for Trento, Agusan del Sur.
 * Used for instant offline suggestions in the booking search bar.
 */

export const TRENTO_LANDMARKS = [
  // ── Government & Civic ────────────────────────────────────────
  { id: 'lm_001', name: 'Trento Municipal Hall',       category: 'Government',   icon: '🏛️', lat: 8.03555, lng: 126.06432 },
  { id: 'lm_002', name: 'Trento Police Station',       category: 'Government',   icon: '👮', lat: 8.03602, lng: 126.06440 },
  { id: 'lm_003', name: 'Trento Post Office',          category: 'Government',   icon: '📮', lat: 8.03560, lng: 126.06400 },
  { id: 'lm_004', name: 'COMELEC Office Trento',       category: 'Government',   icon: '🗳️', lat: 8.03530, lng: 126.06450 },
  { id: 'lm_005', name: 'Bureau of Fire Protection',   category: 'Government',   icon: '🚒', lat: 8.03580, lng: 126.06460 },

  // ── Health & Medical ──────────────────────────────────────────
  { id: 'lm_010', name: 'Rico Medical Clinic & Hospital', category: 'Health',    icon: '🏥', lat: 8.04480, lng: 126.06180 },
  { id: 'lm_011', name: 'Rural Health Unit (RHU)',     category: 'Health',       icon: '⚕️', lat: 8.03590, lng: 126.06380 },
  { id: 'lm_012', name: 'Mercury Drug Trento',         category: 'Health',       icon: '💊', lat: 8.04418, lng: 126.06288 },
  { id: 'lm_013', name: 'Generika Drugstore',          category: 'Health',       icon: '💊', lat: 8.04400, lng: 126.06280 },

  // ── Education ─────────────────────────────────────────────────
  { id: 'lm_020', name: 'Trento West Central Elementary School', category: 'Education', icon: '🏫', lat: 8.04419, lng: 126.06051 },
  { id: 'lm_021', name: 'ASSCAT - Trento Campus',      category: 'Education',    icon: '🎓', lat: 8.04380, lng: 126.06404 },
  { id: 'lm_022', name: 'Trento National High School', category: 'Education',    icon: '📚', lat: 8.04526, lng: 126.06170 },
  { id: 'lm_023', name: 'Father Saturnino Urios College of Trento', category: 'Education', icon: '✏️', lat: 8.03664, lng: 126.06236 },

  // ── Commerce & Market ─────────────────────────────────────────
  { id: 'lm_030', name: 'Trento Public Market',        category: 'Commerce',     icon: '🛒', lat: 8.04600, lng: 126.06380 },
  { id: 'lm_031', name: 'Bus Terminal Trento',         category: 'Transport',    icon: '🚌', lat: 8.04796, lng: 126.06307 },
  { id: 'lm_032', name: 'Caltex Gas Station Trento',   category: 'Commerce',     icon: '⛽', lat: 8.04760, lng: 126.06580 },
  { id: 'lm_033', name: 'Shell Gas Station',           category: 'Commerce',     icon: '⛽', lat: 8.04690, lng: 126.06620 },
  { id: 'lm_034', name: 'Petron Station Trento',       category: 'Commerce',     icon: '⛽', lat: 8.04720, lng: 126.06550 },
  { id: 'lm_035', name: 'Jollibee Trento',             category: 'Food',         icon: '🍔', lat: 8.04430, lng: 126.06300 },
  { id: 'lm_036', name: 'Chowking Trento',             category: 'Food',         icon: '🍜', lat: 8.04420, lng: 126.06320 },
  { id: 'lm_037', name: 'Landbank Trento',             category: 'Bank',         icon: '🏦', lat: 8.04450, lng: 126.06290 },
  { id: 'lm_038', name: 'BDO Trento Branch',           category: 'Bank',         icon: '🏦', lat: 8.04400, lng: 126.06310 },
  { id: 'lm_039', name: 'Metrobank Trento',            category: 'Bank',         icon: '🏦', lat: 8.04380, lng: 126.06330 },
  { id: 'lm_040', name: 'DBP Trento',                  category: 'Bank',         icon: '🏦', lat: 8.04410, lng: 126.06270 },
  { id: 'lm_041', name: 'GCash Center Trento',         category: 'Bank',         icon: '💳', lat: 8.04420, lng: 126.06290 },

  // ── Churches ──────────────────────────────────────────────────
  { id: 'lm_050', name: 'St. Francis of Assisi Parish', category: 'Church',      icon: '⛪', lat: 8.03728, lng: 126.06305 },
  { id: 'lm_051', name: 'Iglesia ni Cristo Trento',    category: 'Church',       icon: '⛪', lat: 8.05250, lng: 126.06010 },
  { id: 'lm_052', name: 'UCCP Church Trento',          category: 'Church',       icon: '⛪', lat: 8.05210, lng: 126.06040 },

  // ── Barangays ─────────────────────────────────────────────────
  { id: 'lm_060', name: 'Brgy. Poblacion',             category: 'Barangay',     icon: '🏘️', lat: 8.04433, lng: 126.06349 },
  { id: 'lm_061', name: 'Brgy. San Isidro',            category: 'Barangay',     icon: '🏘️', lat: 8.05530, lng: 126.05890 },
  { id: 'lm_062', name: 'Brgy. Cuevas',                category: 'Barangay',     icon: '🏘️', lat: 8.04910, lng: 126.06710 },
  { id: 'lm_063', name: 'Brgy. Manat',                 category: 'Barangay',     icon: '🏘️', lat: 8.04690, lng: 126.05870 },
  { id: 'lm_064', name: 'Brgy. Batangan',              category: 'Barangay',     icon: '🏘️', lat: 8.04470, lng: 126.06010 },
  { id: 'lm_065', name: 'Brgy. Rizal',                 category: 'Barangay',     icon: '🏘️', lat: 8.04410, lng: 126.06180 },
  { id: 'lm_066', name: 'Brgy. Salvacion',             category: 'Barangay',     icon: '🏘️', lat: 8.04350, lng: 126.06340 },
  { id: 'lm_067', name: 'Brgy. New Visayas',           category: 'Barangay',     icon: '🏘️', lat: 8.04280, lng: 126.06470 },
  { id: 'lm_068', name: 'Brgy. Kapatagan',             category: 'Barangay',     icon: '🏘️', lat: 8.04220, lng: 126.06610 },
  { id: 'lm_069', name: 'Brgy. Las Navas',             category: 'Barangay',     icon: '🏘️', lat: 8.04160, lng: 126.06740 },
];

// Popular quick-select destinations (shown before typing)
export const QUICK_DESTINATIONS = [
  TRENTO_LANDMARKS.find(l => l.id === 'lm_030'), // Public Market
  TRENTO_LANDMARKS.find(l => l.id === 'lm_001'), // Municipal Hall
  TRENTO_LANDMARKS.find(l => l.id === 'lm_010'), // District Hospital
  TRENTO_LANDMARKS.find(l => l.id === 'lm_031'), // Bus Terminal
  TRENTO_LANDMARKS.find(l => l.id === 'lm_020'), // Central School
  TRENTO_LANDMARKS.find(l => l.id === 'lm_021'), // ASSCAT
  TRENTO_LANDMARKS.find(l => l.id === 'lm_060'), // Poblacion
  TRENTO_LANDMARKS.find(l => l.id === 'lm_050'), // Church
].filter(Boolean);

// Category order for display
export const LANDMARK_CATEGORIES = [
  'Government', 'Health', 'Education', 'Commerce', 'Transport',
  'Food', 'Bank', 'Church', 'Barangay',
];

/**
 * Search landmarks by query string (name, category).
 * Returns top 6 matches.
 */
export function searchLandmarks(query) {
  if (!query || query.trim().length < 2) return [];
  const q = query.toLowerCase();
  return TRENTO_LANDMARKS.filter(
    l => l.name.toLowerCase().includes(q) || l.category.toLowerCase().includes(q)
  ).slice(0, 6);
}
