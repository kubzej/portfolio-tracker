import { useState, useEffect } from 'react';
import type { WatchlistTag, CreateWatchlistTagInput } from '@/types/database';
import { watchlistTagsApi } from '@/services/api';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';
import { TrashIcon } from '@/components/shared';
import {
  SectionTitle,
  Text,
  Muted,
  Label,
} from '@/components/shared/Typography';
import './Watchlists.css';

// Predefined colors for tags
const TAG_COLORS = [
  '#6b7280', // gray
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
];

interface TagManagerProps {
  onTagsChange?: () => void;
}

export function TagManager({ onTagsChange }: TagManagerProps) {
  const [tags, setTags] = useState<WatchlistTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      setLoading(true);
      const data = await watchlistTagsApi.getAll();
      setTags(data);
    } catch (err) {
      console.error('Error loading tags:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;

    try {
      setSaving(true);
      setError(null);
      const input: CreateWatchlistTagInput = {
        name: trimmed,
        color: newTagColor,
      };
      await watchlistTagsApi.create(input);
      setNewTagName('');
      setNewTagColor(TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]);
      await loadTags();
      onTagsChange?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Nepodařilo se vytvořit tag'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Smazat tento tag? Bude odebrán ze všech akcií.')) return;

    try {
      await watchlistTagsApi.delete(id);
      await loadTags();
      onTagsChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se smazat tag');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    }
  };

  if (loading) {
    return <Muted>Načítám tagy...</Muted>;
  }

  return (
    <div className="tag-manager">
      <SectionTitle>Vlastní tagy</SectionTitle>

      {error && <div className="form-error">{error}</div>}

      {/* Existing tags */}
      <div className="tag-list">
        {tags.length === 0 ? (
          <Muted>Zatím nemáte žádné tagy</Muted>
        ) : (
          tags.map((tag) => (
            <div key={tag.id} className="tag-item">
              <span
                className="tag-color-dot"
                style={{ backgroundColor: tag.color }}
              />
              <Text size="sm">{tag.name}</Text>
              <button
                type="button"
                className="tag-delete-btn"
                onClick={() => handleDelete(tag.id)}
                title="Smazat tag"
              >
                <TrashIcon size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add new tag */}
      <div className="tag-add-form">
        <Label>Přidat nový tag</Label>
        <div className="tag-add-row">
          <div className="tag-color-picker">
            {TAG_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`tag-color-option ${
                  newTagColor === color ? 'selected' : ''
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setNewTagColor(color)}
                title={color}
              />
            ))}
          </div>
          <Input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Název tagu"
            maxLength={30}
            inputSize="sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreate}
            disabled={saving || !newTagName.trim()}
          >
            {saving ? '...' : 'Přidat'}
          </Button>
        </div>
      </div>
    </div>
  );
}
