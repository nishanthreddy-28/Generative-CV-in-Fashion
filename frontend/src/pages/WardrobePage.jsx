import React, { useState } from 'react';
import { Upload, Search, Filter, Plus } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';

export default function WardrobePage() {
  const [items, setItems] = useState([]); // Empty state by default
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wardrobe</h1>
          <p className="text-muted-foreground mt-2">Manage your clothing items and accessories.</p>
        </div>
        <Button onClick={() => setUploadModalOpen(true)} className="gap-2">
          <Upload className="h-4 w-4" /> Upload Item
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search your wardrobe..." className="pl-9" />
        </div>
        <Button variant="outline" className="gap-2 sm:w-auto">
          <Filter className="h-4 w-4" /> Filters
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-24 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
            <ShirtIcon className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">No items yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Upload your first clothing item to start building your digital wardrobe and get AI styling suggestions.
          </p>
          <Button onClick={() => setUploadModalOpen(true)} className="mt-6 gap-2">
            <Plus className="h-4 w-4" /> Add your first item
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {/* Item cards would go here */}
        </div>
      )}

      <Modal isOpen={isUploadModalOpen} onClose={() => setUploadModalOpen(false)} title="Upload Clothing Item">
        <div className="space-y-6">
          <div className="border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/50 transition-colors">
            <Upload className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="font-medium">Click to upload or drag and drop</p>
            <p className="text-sm text-muted-foreground mt-1">SVG, PNG, JPG or GIF (max. 5MB)</p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setUploadModalOpen(false)}>Cancel</Button>
            <Button>Upload & Analyze</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ShirtIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
    </svg>
  );
}
