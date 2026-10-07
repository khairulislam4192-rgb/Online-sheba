import React, { useState } from 'react';
import { X, Plus, Trash2, FolderTree, AlertCircle, Edit2, Check, Sparkles } from 'lucide-react';
import { Category } from '../types';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onAddCategory: (name: string) => Promise<void>;
  onUpdateCategory: (id: string, newName: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  isLoading: boolean;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  categories,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  isLoading,
}) => {
  const [newCatName, setNewCatName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
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

  const handleStartEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditValue(cat.name);
    setError(null);
  };

  const handleSaveEdit = async (id: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    setError(null);
    try {
      await onUpdateCategory(id, trimmed);
      setEditingId(null);
      setEditValue('');
    } catch (err: any) {
      setError(err.message || 'Failed to rename category.');
    }
  };

  const executeDelete = async (id: string) => {
    if (categories.length <= 1) {
      setError('At least one category must remain.');
      setConfirmDeleteId(null);
      return;
    }

    setDeletingId(id);
    setError(null);
    try {
      await onDeleteCategory(id);
      setConfirmDeleteId(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete category');
    } finally {
      setDeletingId(null);
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
                Add, rename or delete services anytime
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
                placeholder="e.g. Passport Online, Color Print..."
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

          {categories.map((cat, idx) => {
            const isEditing = editingId === cat.id;

            return (
              <div
                key={cat.id}
                className="py-2.5 flex items-center justify-between group hover:bg-zinc-50 rounded-xl px-2.5 -mx-2.5 transition-colors"
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                  <span className="text-zinc-400 font-mono text-xs w-4">
                    {idx + 1}.
                  </span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(cat.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                      className="flex-1 px-2.5 py-1 bg-white border border-indigo-400 rounded-lg text-xs font-bold focus:outline-none"
                    />
                  ) : (
                    <span className="text-xs font-bold text-zinc-800 truncate">
                      {cat.name}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(cat.id)}
                      className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors"
                      title="Save name"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStartEdit(cat)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Rename / Edit Category"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {confirmDeleteId === cat.id ? (
                    <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => executeDelete(cat.id)}
                        disabled={deletingId === cat.id}
                        className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold shadow-xs"
                      >
                        {deletingId === cat.id ? 'Deleting...' : 'Delete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-700"
                        title="Cancel"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(cat.id)}
                      disabled={deletingId === cat.id}
                      title="Delete Category"
                      className="p-1.5 rounded-lg text-zinc-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
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
