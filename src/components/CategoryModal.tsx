import React, { useState } from 'react';
import { X, Plus, Trash2, FolderTree, AlertCircle } from 'lucide-react';
import { Category } from '../types';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onAddCategory: (name: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  isLoading: boolean;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  categories,
  onAddCategory,
  onDeleteCategory,
  isLoading,
}) => {
  const [newCatName, setNewCatName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;

    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('A category with this name already exists.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onAddCategory(trimmed);
      setNewCatName('');
    } catch (err: any) {
      setError(err.message || 'Failed to add category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (categories.length <= 1) {
      setError('At least one category must remain.');
      return;
    }

    if (window.confirm(`Are you sure you want to delete category "${name}"?`)) {
      setDeletingId(id);
      setError(null);
      try {
        await onDeleteCategory(id);
      } catch (err: any) {
        setError(err.message || 'Failed to delete category');
      } finally {
        setDeletingId(null);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-md w-full border border-zinc-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700">
              <FolderTree className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900">
                Service Categories
              </h3>
              <p className="text-xs text-zinc-500">
                Manage services for quick billing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add Category Form */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 bg-zinc-50/40">
          <form onSubmit={handleAdd} className="space-y-2">
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
              Add New Service Category:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={newCatName}
                onChange={(e) => {
                  setNewCatName(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. Passport Application, Color Print"
                className="flex-1 px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs font-medium focus:border-zinc-900 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSubmitting || !newCatName.trim()}
                className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>

            {error && (
              <div className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{error}</span>
              </div>
            )}
          </form>
        </div>

        {/* Categories List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 divide-y divide-zinc-100">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2.5">
            Active Categories ({categories.length})
          </div>

          {categories.map((cat, idx) => (
            <div
              key={cat.id}
              className="py-2.5 flex items-center justify-between group hover:bg-zinc-50 rounded-xl px-2.5 -mx-2.5 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-zinc-400 font-mono text-xs w-4">
                  {idx + 1}.
                </span>
                <span className="text-xs font-bold text-zinc-800 truncate">
                  {cat.name}
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleDelete(cat.id, cat.name)}
                disabled={deletingId === cat.id}
                title="Delete Category"
                className="p-1.5 rounded-lg text-zinc-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
