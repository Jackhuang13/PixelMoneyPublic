import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useI18n } from '@/i18n';
import type { Category } from '@/types';

export const CategoriesPage: React.FC = () => {
  const { categories, addCategory, updateCategory } = useApp();
  const { t } = useI18n();

  const [name, setName] = useState<string>('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [icon, setIcon] = useState<string>('🍔');

  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [editingIcon, setEditingIcon] = useState<string>('');

  const availableIcons = [
    '🍔', '🚗', '🏠', '🎮', '👗', '🏥', '✈️', '📚', '🎁', '💡',
    '🐾', '💰', '🎤', '🛠️', '📱', '🍷', '🏋️', '🎬', '☕', '👶',
    '🎓', '💼', '🛒', '🧼', '🚑', '🚌', '🚂', '🏖️', '⛰️', '🏫',
  ];

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert(t('alert.enterCategoryName'));
      return;
    }
    await addCategory({
      name: name.trim(),
      type,
      active: true,
      icon,
    });
    setName('');
    setIcon('🍔');
  };

  const startEdit = (cat: Category) => {
    if (cat.id) {
      setEditingCategoryId(cat.id);
      setEditingName(cat.name);
      setEditingIcon(cat.icon || '');
    }
  };

  const cancelEdit = () => {
    setEditingCategoryId(null);
    setEditingName('');
    setEditingIcon('');
  };

  const saveEdit = async (cat: Category) => {
    await updateCategory({
      ...cat,
      name: editingName,
      icon: editingIcon,
    });
    cancelEdit();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-yellow-400">{t('categories.title')}</h1>

      {/* Add Category */}
      <div className="p-4 bg-gray-700 pixel-border space-y-4">
        <h2 className="text-xl font-bold">{t('categories.addCategory')}</h2>
        <div>
          <label className="font-bold mb-2 block">{t('categories.icon')}</label>
          <select
            id="category-icon-select"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            className="w-full bg-gray-200 text-black p-2 text-2xl placeholder-gray-500 pixel-border-sm mb-4"
          >
            <option value="">{t('categories.noIcon') || 'None'}</option>
            {availableIcons.map((ic) => (
              <option key={ic} value={ic}>
                {ic}
              </option>
            ))}
          </select>
          <label className="font-bold">{t('categories.categoryName')}</label>
          <input
            id="category-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('categories.categoryNamePlaceholder')}
            className="w-full bg-gray-200 text-black p-2 text-lg placeholder-gray-500 pixel-border-sm"
          />
        </div>

        <div className="flex space-x-4">
          <label className="flex items-center space-x-2 font-bold cursor-pointer">
            <input
              type="radio"
              checked={type === 'expense'}
              onChange={() => setType('expense')}
              className="w-5 h-5"
            />
            <span>{t('categories.expense')}</span>
          </label>
          <label className="flex items-center space-x-2 font-bold cursor-pointer">
            <input
              type="radio"
              checked={type === 'income'}
              onChange={() => setType('income')}
              className="w-5 h-5"
            />
            <span>{t('categories.income')}</span>
          </label>
        </div>

        <button
          id="add-category-btn"
          onClick={handleSubmit}
          className="w-full px-4 py-2 text-lg font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border bg-purple-500"
        >
          {t('categories.addButton')}
        </button>
      </div>

      {/* Category List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t('categories.categoryList')}</h2>
        {categories.length === 0 ? (
          <div className="p-4 bg-gray-700 pixel-border text-center">
            <p>{t('categories.noCategories')}</p>
          </div>
        ) : (
          categories.map((cat) => (
            <div
              key={cat.id}
              className={`p-3 bg-gray-700 pixel-border ${!cat.active ? 'opacity-50' : ''}`}
            >
              <div>
                {/* Top Row: Icon, Name, Type */}
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    {editingCategoryId === cat.id ? (
                      <div className="flex-1 space-y-2">
                        <select
                          value={editingIcon}
                          onChange={(e) => setEditingIcon(e.target.value)}
                          className="w-full bg-gray-200 text-black p-2 text-2xl placeholder-gray-500 pixel-border-sm"
                        >
                          <option value="">{t('categories.noIcon') || 'None'}</option>
                          {availableIcons.map((ic) => (
                            <option key={ic} value={ic}>
                              {ic}
                            </option>
                          ))}
                        </select>
                        <input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="w-full bg-gray-200 text-black p-1 text-lg placeholder-gray-500 pixel-border-sm"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 min-w-0 overflow-hidden">
                        <span className="text-2xl shrink-0">{cat.icon || '📦'}</span>
                        <span className="text-lg font-bold truncate">
                          {cat.isDefault ? t('categories.uncategorized') : cat.name}
                        </span>
                      </div>
                    )}
                  </div>
                  {!cat.isDefault && (
                    <span
                      className={`ml-2 px-2 py-0.5 text-xs font-bold rounded shrink-0 ${
                        cat.type === 'income' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    >
                      {cat.type === 'income' ? t('categories.income') : t('categories.expense')}
                    </span>
                  )}
                </div>

                {/* Bottom Row: Controls */}
                {!cat.isDefault && (
                  <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center space-x-2">
                      <label className="text-sm font-bold">{t('categories.enable')}</label>
                      <input
                        type="checkbox"
                        checked={cat.active}
                        onChange={(e) => updateCategory({ ...cat, active: e.target.checked })}
                        className="w-6 h-6"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      {editingCategoryId === cat.id ? (
                        <>
                          <button
                            onClick={() => saveEdit(cat)}
                            className="px-2 py-1 text-xs font-bold transition-transform pixel-border-sm bg-green-500 active:translate-y-px active:translate-x-px"
                          >
                            {t('accounts.save')}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-2 py-1 text-xs font-bold transition-transform pixel-border-sm bg-gray-400 active:translate-y-px active:translate-x-px"
                          >
                            {t('accounts.cancel')}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEdit(cat)}
                          className="px-2 py-1 text-xs font-bold transition-transform pixel-border-sm bg-blue-500 active:translate-y-px active:translate-x-px"
                        >
                          {t('categories.edit')}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
