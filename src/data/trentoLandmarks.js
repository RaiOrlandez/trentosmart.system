/**
 * trentoLandmarks.js
 * ─────────────────────────────────────────────────────────────────
 * Curated local destination database for Trento, Agusan del Sur.
 * Used for instant offline suggestions in the booking search bar.
 */

export const TRENTO_LANDMARKS = [
  // ── Government & Civic ────────────────────────────────────────
  { id: 'lm_001', name: 'Trento Municipal Hall',       category: 'Government',   icon: '🏛️', lat: 8.0505, lng: 126.0624 },
  { id: 'lm_002', name: 'Trento Police Station',       category: 'Government',   icon: '👮', lat: 8.0512, lng: 126.0631 },
  { id: 'lm_003', name: 'Trento Post Office',          category: 'Government',   icon: '📮', lat: 8.0508, lng: 126.0619 },
  { id: 'lm_004', name: 'COMELEC Office Trento',       category: 'Government',   icon: '🗳️', lat: 8.0503, lng: 126.0627 },
  { id: 'lm_005', name: 'Bureau of Fire Protection',   category: 'Government',   icon: '🚒', lat: 8.0499, lng: 126.0633 },

  // ── Health & Medical ──────────────────────────────────────────
  { id: 'lm_010', name: 'Trento District Hospital',    category: 'Health',       icon: '🏥', lat: 8.0491, lng: 126.0598 },
  { id: 'lm_011', name: 'Rural Health Unit (RHU)',     category: 'Health',       icon: '⚕️', lat: 8.0506, lng: 126.0612 },
  { id: 'lm_012', name: 'Mercury Drug Trento',         category: 'Health',       icon: '💊', lat: 8.0514, lng: 126.0641 },
  { id: 'lm_013', name: 'Generika Drugstore',          category: 'Health',       icon: '💊', lat: 8.0511, lng: 126.0638 },

  // ── Education ─────────────────────────────────────────────────
  { id: 'lm_020', name: 'Trento Central School',       category: 'Education',    icon: '🏫', lat: 8.0523, lng: 126.0615 },
  { id: 'lm_021', name: 'Agusan del Sur State College (ASSCAT) - Trento', category: 'Education', icon: '🎓', lat: 8.0534, lng: 126.0597 },
  { id: 'lm_022', name: 'Trento National High School', category: 'Education',    icon: '📚', lat: 8.0528, lng: 126.0608 },
  { id: 'lm_023', name: 'Notre Dame School Trento',    category: 'Education',    icon: '✏️', lat: 8.0519, lng: 126.0621 },

  // ── Commerce & Market ─────────────────────────────────────────
  { id: 'lm_030', name: 'Trento Public Market',        category: 'Commerce',     icon: '🛒', lat: 8.0497, lng: 126.0645 },
  { id: 'lm_031', name: 'Bus Terminal Trento',         category: 'Transport',    icon: '🚌', lat: 8.04796, lng: 126.06307 },
  { id: 'lm_032', name: 'Caltex Gas Station Trento',  category: 'Commerce',     icon: '⛽', lat: 8.0476, lng: 126.0658 },
  { id: 'lm_033', name: 'Shell Gas Station',           category: 'Commerce',     icon: '⛽', lat: 8.0469, lng: 126.0662 },
  { id: 'lm_034', name: 'Petron Station Trento',       category: 'Commerce',     icon: '⛽', lat: 8.0472, lng: 126.0655 },
  { id: 'lm_035', name: 'Jollibee Trento',             category: 'Food',         icon: '🍔', lat: 8.0516, lng: 126.0644 },
  { id: 'lm_036', name: 'Chowking Trento',             category: 'Food',         icon: '🍜', lat: 8.0513, lng: 126.0647 },
  { id: 'lm_037', name: 'Landbank Trento',             category: 'Bank',         icon: '🏦', lat: 8.0507, lng: 126.0636 },
  { id: 'lm_038', name: 'BDO Trento Branch',           category: 'Bank',         icon: '🏦', lat: 8.0509, lng: 126.0634 },
  { id: 'lm_039', name: 'Metrobank Trento',            category: 'Bank',         icon: '🏦', lat: 8.0511, lng: 126.0632 },
  { id: 'lm_040', name: 'DBP Trento',                  category: 'Bank',         icon: '🏦', lat: 8.0505, lng: 126.0629 },
  { id: 'lm_041', name: 'GCash Center Trento',         category: 'Bank',         icon: '💳', lat: 8.0514, lng: 126.0639 },

  // ── Churches ──────────────────────────────────────────────────
  { id: 'lm_050', name: 'St. Joseph Parish Church',    category: 'Church',       icon: '⛪', lat: 8.0518, lng: 126.0609 },
  { id: 'lm_051', name: 'Iglesia ni Cristo Trento',   category: 'Church',       icon: '⛪', lat: 8.0525, lng: 126.0601 },
  { id: 'lm_052', name: 'UCCP Church Trento',          category: 'Church',       icon: '⛪', lat: 8.0521, lng: 126.0604 },

  // ── Barangays ─────────────────────────────────────────────────
  { id: 'lm_060', name: 'Brgy. Poblacion',             category: 'Barangay',     icon: '🏘️', lat: 8.0510, lng: 126.0625 },
  { id: 'lm_061', name: 'Brgy. San Isidro',            category: 'Barangay',     icon: '🏘️', lat: 8.0553, lng: 126.0589 },
  { id: 'lm_062', name: 'Brgy. Cuevas',                category: 'Barangay',     icon: '🏘️', lat: 8.0491, lng: 126.0671 },
  { id: 'lm_063', name: 'Brgy. Manat',                 category: 'Barangay',     icon: '🏘️', lat: 8.0469, lng: 126.0587 },
  { id: 'lm_064', name: 'Brgy. Batangan',              category: 'Barangay',     icon: '🏘️', lat: 8.0447, lng: 126.0601 },
  { id: 'lm_065', name: 'Brgy. Rizal',                 category: 'Barangay',     icon: '🏘️', lat: 8.0441, lng: 126.0618 },
  { id: 'lm_066', name: 'Brgy. Salvacion',             category: 'Barangay',     icon: '🏘️', lat: 8.0435, lng: 126.0634 },
  { id: 'lm_067', name: 'Brgy. New Visayas',           category: 'Barangay',     icon: '🏘️', lat: 8.0428, lng: 126.0647 },
  { id: 'lm_068', name: 'Brgy. Kapatagan',             category: 'Barangay',     icon: '🏘️', lat: 8.0422, lng: 126.0661 },
  { id: 'lm_069', name: 'Brgy. Las Navas',             category: 'Barangay',     icon: '🏘️', lat: 8.0416, lng: 126.0674 },
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
