import { CATEGORIES, COLORS, requireAdmin, requireUser } from './domain.js';
export function upsertGarment(state, userId, source, fields, existingId, assetId) {
  if(source === 'catalog') requireAdmin(state,userId); else requireUser(state,userId);
  if(!fields.name?.trim() || fields.name.trim().length > 100) throw new Error('Enter a garment name of 1–100 characters.');
  if(!CATEGORIES.includes(fields.category) || !COLORS.includes(fields.color)) throw new Error('Choose a valid category and color.');
  const collection = state[source];
  const existing = existingId ? collection.find(i=>i.id===existingId && (source==='catalog'||i.userId===userId) && !i.deletedAt) : null;
  if(existingId && !existing) throw new Error('This garment is no longer available.');
  if(!existing && !assetId) throw new Error('Choose an image before saving.');
  if(source==='catalog' && !['ACTIVE','INACTIVE'].includes(fields.status)) throw new Error('Choose a valid catalog status.');
  const row = { ...existing, id: existing?.id || crypto.randomUUID(), userId: source==='wardrobe'?userId:undefined, createdByAdminId: source==='catalog' ? existing?.createdByAdminId || userId : undefined, name: fields.name.trim(), category: fields.category, color: fields.color, description:(fields.description||'').trim().slice(0,1000), assetId:assetId || existing?.assetId, status:source==='catalog'?fields.status:undefined, createdAt:existing?.createdAt || new Date().toISOString(), updatedAt:new Date().toISOString() };
  if(existing) collection[collection.indexOf(existing)] = row; else collection.push(row);
  return row;
}
export function queryGarments(items, { search = '', category = '', color = '', sort = 'newest', page = 1, pageSize = 9 } = {}) {
  const matches = items.filter(i=>!i.deletedAt && (!category||i.category===category) && (!color||i.color===color) && `${i.name} ${i.description||''}`.toLowerCase().includes(search.trim().toLowerCase()));
  matches.sort(sort==='name' ? (a,b)=>a.name.localeCompare(b.name) : (a,b)=>b.createdAt.localeCompare(a.createdAt));
  const pages = Math.max(1,Math.ceil(matches.length/pageSize)), current = Math.min(Math.max(1,page),pages);
  return { items:matches.slice((current-1)*pageSize,current*pageSize), total:matches.length, pages, current };
}
