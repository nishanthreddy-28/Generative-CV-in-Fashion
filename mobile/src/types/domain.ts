export type User = {
  id: string;
  email: string;
  name?: string;
  role: "user" | "admin";
};
export type Session = { user: User };
export type Garment = {
  id: string;
  name: string;
  category: string;
  color?: string;
  brand?: string;
  imageUrl?: string;
  notes?: string;
  size?: string;
  material?: string;
  price?: number | null;
  active?: boolean;
};
export type Outfit = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  garmentIds: string[];
  occasion?: string;
};
export type Profile = {
  name: string;
  style?: string;
  location?: string;
  bio?: string;
};
export type BodyProfile = {
  height?: number | null;
  chest?: number | null;
  waist?: number | null;
  hips?: number | null;
  inseam?: number | null;
  units?: string;
  fit?: string;
  bodyShape?: string;
  skinTone?: string;
  undertone?: string;
};
export type Preferences = {
  units?: string;
  theme?: string;
  emailNotifications?: string;
};
export type Dashboard = {
  wardrobeCount: number;
  savedOutfitCount: number;
  recommendationCount: number;
};
export type TryOnJob = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  imageUrl?: string;
  error?: string;
};
export type Page<T> = { items: T[]; nextCursor?: string | null };
