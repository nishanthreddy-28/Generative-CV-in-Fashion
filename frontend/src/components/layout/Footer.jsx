import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t py-6 md:py-0">
      <div className="container flex flex-col items-center justify-between gap-4 px-4 sm:px-8 md:h-24 md:flex-row">
        <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
          <ShoppingBag className="h-6 w-6" />
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built by Drape & Drop Inc. All rights reserved.
          </p>
        </div>
        <div className="flex gap-4">
          <Link to="#" className="text-sm font-medium hover:underline underline-offset-4">Terms</Link>
          <Link to="#" className="text-sm font-medium hover:underline underline-offset-4">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}
