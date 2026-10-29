export const navigation = [
  { path: '/dashboard', label: 'Overview', icon: 'LayoutDashboard', description: 'Your personal style, thoughtfully collected.' },
  { path: '/photos', label: 'My photos', icon: 'Image', description: 'A space for your personal try-on photos.' },
  { path: '/wardrobe', label: 'My wardrobe', icon: 'Shirt', description: 'The pieces that make your style yours.' },
  { path: '/catalog', label: 'Discover', icon: 'Compass', description: 'Explore the platform clothing collection.' },
  { path: '/try-on', label: 'Virtual try-on', icon: 'ScanLine', description: 'Your photo. Your next look.' },
  { path: '/looks', label: 'My looks', icon: 'Heart', description: 'Your try-on history and saved outfits.' },
  { path: '/profile', label: 'Profile & preferences', icon: 'UserRound', description: 'Make your studio feel like you.' },
];
export function resolvePage(path) { return navigation.find(item => item.path === path); }
