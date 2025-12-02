import { useState } from 'react';
import type {
  WatchlistSummary,
  CreateWatchlistInput,
  UpdateWatchlistInput,
} from '@/types/database';
import { watchlistsApi } from '@/services/api';
import { Button, Modal, Input, TextArea } from '@/components/shared';
import { Label } from '@/components/shared/Typography';

interface WatchlistFormProps {
  watchlist?: WatchlistSummary | null;
  onClose: () => void;
  onSuccess: () => void;
}

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#6366f1', // indigo
];

export function WatchlistForm({
  watchlist,
  onClose,
  onSuccess,
}: WatchlistFormProps) {
  const [name, setName] = useState(watchlist?.name ?? '');
  const [description, setDescription] = useState(watchlist?.description ?? '');
  const [color, setColor] = useState(watchlist?.color ?? PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!watchlist;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Název je povinný');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isEditing) {
        const input: UpdateWatchlistInput = {
          name: name.trim(),
          description: description.trim() || undefined,
          color,
        };
        await watchlistsApi.update(watchlist.id, input);
      } else {
        const input: CreateWatchlistInput = {
          name: name.trim(),
          description: description.trim() || undefined,
          color,
        };
        await watchlistsApi.create(input);
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save watchlist');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isEditing ? 'Upravit watchlist' : 'Nový watchlist'}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="watchlist-form">
        {error && <div className="form-error">{error}</div>}

        <div className="form-group">
          <Label htmlFor="watchlist-name">Název *</Label>
          <Input
            id="watchlist-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="např. Tech akcie k nákupu"
            autoFocus
            fullWidth
          />
        </div>

        <div className="form-group">
          <Label htmlFor="watchlist-description">Popis</Label>
          <TextArea
            id="watchlist-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Volitelné poznámky k watchlistu..."
            rows={3}
            fullWidth
          />
        </div>

        <div className="form-group">
          <Label>Barva</Label>
          <div className="color-picker">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-option ${color === c ? 'selected' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className="form-actions">
          <Button variant="outline" type="button" onClick={onClose}>
            Zrušit
          </Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? 'Ukládám...' : isEditing ? 'Uložit změny' : 'Vytvořit'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
