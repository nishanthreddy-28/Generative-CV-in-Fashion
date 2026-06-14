import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Search, Filter, Plus, Tag, Trash2, Wand2, ScanFace, Edit3, X, Shirt } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

const categories = ['All', 'Tops', 'Bottoms', 'Outerwear', 'Shoes', 'Accessories', 'Dresses'];

const presetImages = [
  { name: 'Trench Coat', url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=600' },
  { name: 'Linen Shirt', url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=600' },
  { name: 'Knit Sweater', url: 'https://images.unsplash.com/photo-1614975058789-41316d0e2e9c?auto=format&fit=crop&q=80&w=600' },
  { name: 'Chinos', url: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&q=80&w=600' },
  { name: 'Chelsea Boots', url: 'https://images.unsplash.com/photo-1638247025967-b4e38f6893b4?auto=format&fit=crop&q=80&w=600' },
  { name: 'Denim Jacket', url: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&q=80&w=600' },
];

const demoItems = [
  {
    id: 1, name: 'Minimal Trench Coat', category: 'Outerwear', brand: 'Massimo Dutti',
    tags: ['Formal'], colors: ['#8b7355'], imageHeight: 'h-80',
    image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=600'
  },
  {
    id: 2, name: 'White Linen Shirt', category: 'Tops', brand: 'Uniqlo',
    tags: ['Casual'], colors: ['#f5f5f0'], imageHeight: 'h-64',
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=600'
  },
  {
    id: 3, name: 'Textured Knit Sweater', category: 'Tops', brand: 'Zara',
    tags: ['Comfort'], colors: ['#d1c7bd'], imageHeight: 'h-72',
    image: 'https://images.unsplash.com/photo-1614975058789-41316d0e2e9c?auto=format&fit=crop&q=80&w=600'
  },
  {
    id: 4, name: 'Slim-Fit Chinos', category: 'Bottoms', brand: 'J.Crew',
    tags: ['Smart'], colors: ['#a69076'], imageHeight: 'h-72',
    image: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&q=80&w=600'
  },
  {
    id: 5, name: 'Leather Chelsea Boots', category: 'Shoes', brand: 'Thursday Boot',
    tags: ['Leather'], colors: ['#2c1a0e'], imageHeight: 'h-64',
    image: 'https://images.unsplash.com/photo-1638247025967-b4e38f6893b4?auto=format&fit=crop&q=80&w=600'
  },
];

function ClothingCard({ item, onDelete }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="masonry-item group relative bg-neutral-50 dark:bg-neutral-900 cursor-pointer overflow-hidden rounded-lg border border-neutral-100 dark:border-neutral-800"
    >
      {/* Image area */}
      <div className={`relative ${item.imageHeight || 'h-64'} w-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center overflow-hidden`}>
        {item.image ? (
          <img 
            src={item.image} 
            alt={item.name} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center opacity-30 text-black dark:text-white">
             <Shirt className="h-8 w-8 mb-2" strokeWidth={1} />
             <span className="text-xs uppercase tracking-widest">{item.category}</span>
          </div>
        )}

        {/* Hover overlay */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-white/90 dark:bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-4"
            >
              <Button size="sm" className="w-full gap-2 bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black">
                <ScanFace className="h-3.5 w-3.5" /> Try On
              </Button>
              <Button variant="outline" size="sm" className="w-full gap-2 border-black text-black hover:bg-neutral-100 dark:border-white dark:text-white dark:hover:bg-neutral-900">
                <Wand2 className="h-3.5 w-3.5" /> Generate Outfit
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Card Content */}
      <div className="p-4 bg-white dark:bg-neutral-900">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-black dark:text-white truncate">{item.name}</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mt-1">{item.brand}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
            className="flex h-6 w-6 items-center justify-center text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
            title="Delete item"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function WardrobePage() {
  const [items, setItems] = useState(demoItems);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Form states for new item
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Tops');
  const [newItemBrand, setNewItemBrand] = useState('');
  const [newItemImage, setNewItemImage] = useState(presetImages[0].url);

  const filteredItems = items.filter(item => {
    const matchCat = activeCategory === 'All' || item.category === activeCategory;
    const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        item.brand.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleDelete = (id) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const heights = ['h-64', 'h-72', 'h-80', 'h-56'];
    const randomHeight = heights[Math.floor(Math.random() * heights.length)];

    const addedItem = {
      id: Date.now(),
      name: newItemName.trim(),
      category: newItemCategory,
      brand: newItemBrand.trim() || 'Custom Brand',
      tags: ['New'],
      imageHeight: randomHeight,
      image: newItemImage
    };

    setItems(prev => [addedItem, ...prev]);
    setIsModalOpen(false);
    
    // Reset form
    setNewItemName('');
    setNewItemCategory('Tops');
    setNewItemBrand('');
    setNewItemImage(presetImages[0].url);
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-10 pb-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-neutral-200 dark:border-neutral-800"
      >
        <div>
          <h1 className="text-3xl md:text-4xl font-light text-black dark:text-white tracking-tight font-display mb-2">
            Catalog.
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            {items.length} {items.length === 1 ? 'item' : 'items'} in your collection
          </p>
        </div>

        <div className="flex items-center gap-4">
          {items.length === 0 && (
            <button
              onClick={() => setItems(demoItems)}
              className="text-xs font-medium text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white uppercase tracking-wider underline-offset-4 hover:underline"
            >
              Reset Demo
            </button>
          )}
          <Button onClick={() => setIsModalOpen(true)} className="gap-2 bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black">
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </div>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-6 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto custom-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-xs font-medium uppercase tracking-widest whitespace-nowrap transition-colors ${
                activeCategory === cat 
                  ? 'text-black dark:text-white border-b border-black dark:border-white pb-1' 
                  : 'text-neutral-400 hover:text-black dark:hover:text-white pb-1'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            className="w-full pl-9 pr-4 py-2 text-sm border-b border-neutral-200 dark:border-neutral-800 focus:border-black dark:focus:border-white outline-none bg-transparent transition-colors text-black dark:text-white"
          />
        </div>
      </div>

      {/* Content */}
      {filteredItems.length === 0 ? (
        <div className="py-24 text-center border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
          <Shirt className="h-8 w-8 mx-auto text-neutral-300 dark:text-neutral-700 mb-4" strokeWidth={1} />
          <h3 className="text-lg font-medium text-black dark:text-white mb-2">No items found</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">No matching items in your catalog.</p>
          <Button onClick={() => setIsModalOpen(true)} variant="outline" className="gap-2 border-black text-black hover:bg-neutral-100 dark:border-white dark:text-white dark:hover:bg-neutral-900">
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        </div>
      ) : (
        <motion.div layout className="masonry-grid">
          <AnimatePresence>
            {filteredItems.map((item) => (
              <ClothingCard key={item.id} item={item} onDelete={handleDelete} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Add Item Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Add Wardrobe Item"
        className="dark:bg-[#111113] dark:border-neutral-800 text-black dark:text-white"
      >
        <form onSubmit={handleAddItem} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-2">Item Name</label>
            <input 
              type="text" 
              required
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              placeholder="e.g. Classic Trench Coat"
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-sm focus:border-black dark:focus:border-white outline-none rounded transition-colors text-black dark:text-white placeholder:text-neutral-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-2">Category</label>
              <select
                value={newItemCategory}
                onChange={e => setNewItemCategory(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-sm focus:border-black dark:focus:border-white outline-none rounded text-black dark:text-white"
              >
                {categories.filter(c => c !== 'All').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-2">Brand</label>
              <input 
                type="text" 
                value={newItemBrand}
                onChange={e => setNewItemBrand(e.target.value)}
                placeholder="e.g. Zara"
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-sm focus:border-black dark:focus:border-white outline-none rounded transition-colors text-black dark:text-white placeholder:text-neutral-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-3">Select Image Preset</label>
            <div className="grid grid-cols-3 gap-2">
              {presetImages.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setNewItemImage(p.url)}
                  className={`relative aspect-square border rounded overflow-hidden p-0.5 transition-all ${
                    newItemImage === p.url 
                      ? 'border-black dark:border-white ring-1 ring-black dark:ring-white' 
                      : 'border-neutral-200 dark:border-neutral-800 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={p.url} alt={p.name} className="w-full h-full object-cover rounded-sm" />
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-850">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsModalOpen(false)}
              className="border-black text-black hover:bg-neutral-100 dark:border-white dark:text-white dark:hover:bg-neutral-900"
            >
              Cancel
            </Button>
            <Button type="submit" className="bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black">
              Save Item
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
