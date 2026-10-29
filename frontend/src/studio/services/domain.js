export const CATEGORIES = ['Tops', 'Trousers', 'Dresses', 'Outerwear', 'Shoes', 'Accessories'];
export const COLORS = ['Black', 'White', 'Beige', 'Blue', 'Green', 'Pink', 'Brown', 'Gray', 'Red', 'Other'];
export const emptyState = () => ({ users: [], photos: [], wardrobe: [], catalog: [], sessions: [], saved: [] });
export function requireUser(state, id) {
  const user = state.users.find(u => u.id === id);
  if (!user || user.status !== 'ACTIVE') throw new Error('Your demo account is unavailable. Please sign in with an active account.');
  return user;
}
export function requireAdmin(state, id) {
  const user = requireUser(state, id);
  if (user.role !== 'ADMIN') throw new Error('An administrator demo session is required.');
  return user;
}
export function createSession(state, userId, input) {
  requireUser(state, userId);
  const photo = state.photos.find(p => p.id === input.photoId && p.userId === userId);
  if (!photo) throw new Error('Choose one of your personal photos.');
  if (Boolean(input.wardrobeItemId) === Boolean(input.catalogItemId)) throw new Error('Choose exactly one garment source.');
  const garment = input.wardrobeItemId
    ? state.wardrobe.find(i => i.id === input.wardrobeItemId && i.userId === userId && !i.deletedAt)
    : state.catalog.find(i => i.id === input.catalogItemId && i.status === 'ACTIVE');
  if (!garment) throw new Error('This garment is no longer available. Choose another piece.');
  if (!['Tops', 'Trousers', 'Dresses', 'Outerwear'].includes(garment.category)) throw new Error('Try-on is planned for tops, trousers, dresses, and outerwear.');
  return { id: crypto.randomUUID(), userId, photoId: photo.id, wardrobeItemId: input.wardrobeItemId || null, catalogItemId: input.catalogItemId || null, garmentName: garment.name, garmentCategory: garment.category, garmentAssetId: garment.assetId, status: 'AWAITING_INTEGRATION', statusMessage: 'CV integration is unavailable. Your inputs are saved locally; no image was generated. This session will not process automatically.', resultAssetId: null, createdAt: new Date().toISOString(), retryOf: input.retryOf || null };
}
export function saveOutfit(state, userId, sessionId) {
  requireUser(state, userId);
  const session = state.sessions.find(s => s.id === sessionId && s.userId === userId);
  if (!session || session.status !== 'COMPLETED' || !session.resultAssetId) throw new Error('Only completed sessions with a real generated result can be saved.');
  if (state.saved.some(s => s.userId === userId && s.sessionId === sessionId)) return;
  state.saved.push({ id: crypto.randomUUID(), userId, sessionId, createdAt: new Date().toISOString() });
}
export function deletePhoto(state, userId, photoId) {
  requireUser(state, userId);
  const photo = state.photos.find(p => p.id === photoId && p.userId === userId);
  if (!photo) throw new Error('Photo not found.');
  const sessions = state.sessions.filter(s => s.photoId === photoId && s.userId === userId);
  const ids = new Set(sessions.map(s => s.id));
  state.photos = state.photos.filter(p => p.id !== photoId);
  state.sessions = state.sessions.filter(s => !ids.has(s.id));
  state.saved = state.saved.filter(s => !ids.has(s.sessionId));
  return [photo.assetId, ...sessions.map(s => s.resultAssetId).filter(Boolean)];
}
