import { useState, useEffect } from 'react';
import type { Portfolio, CreatePortfolioInput } from '@/types/database';
import { portfoliosApi } from '@/services/api';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';
import { LoadingSpinner } from '@/components/shared';
import {
  SectionTitle,
  CardTitle,
  Text,
  Label,
  Description,
  Badge,
} from '@/components/shared/Typography';
import './PortfolioManager.css';

interface PortfolioManagerProps {
  onClose: () => void;
  onPortfolioCreated?: (portfolio: Portfolio) => void;
}

const COLORS = [
  '#646cff', // indigo
  '#22c55e', // green
  '#ef4444', // red
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
];

export function PortfolioManager({
  onClose,
  onPortfolioCreated,
}: PortfolioManagerProps) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreatePortfolioInput>({
    name: '',
    description: '',
    color: COLORS[0],
  });

  useEffect(() => {
    loadPortfolios();
  }, []);

  const loadPortfolios = async () => {
    try {
      setLoading(true);
      const data = await portfoliosApi.getAll();
      setPortfolios(data);
    } catch (err) {
      setError('Nepodařilo se načíst portfolia');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setError(null);
      if (editingId) {
        await portfoliosApi.update(editingId, formData);
      } else {
        const newPortfolio = await portfoliosApi.create(formData);
        onPortfolioCreated?.(newPortfolio);
      }
      setFormData({ name: '', description: '', color: COLORS[0] });
      setShowAddForm(false);
      setEditingId(null);
      await loadPortfolios();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save portfolio');
    }
  };

  const handleEdit = (portfolio: Portfolio) => {
    setFormData({
      name: portfolio.name,
      description: portfolio.description || '',
      color: portfolio.color,
    });
    setEditingId(portfolio.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    const portfolio = portfolios.find((p) => p.id === id);
    if (portfolio?.is_default) {
      setError('Nelze smazat výchozí portfolio');
      return;
    }

    if (
      !confirm(
        'Smazat toto portfolio? Všechny transakce v něm bude třeba přiřadit jinam.'
      )
    ) {
      return;
    }

    try {
      await portfoliosApi.delete(id);
      await loadPortfolios();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete portfolio'
      );
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      // First, unset all defaults
      for (const p of portfolios) {
        if (p.is_default) {
          await portfoliosApi.update(p.id, { is_default: false });
        }
      }
      // Set new default
      await portfoliosApi.update(id, { is_default: true });
      await loadPortfolios();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default');
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', description: '', color: COLORS[0] });
    setShowAddForm(false);
    setEditingId(null);
  };

  return (
    <div className="portfolio-manager-overlay" onClick={onClose}>
      <div className="portfolio-manager" onClick={(e) => e.stopPropagation()}>
        <div className="pm-header">
          <SectionTitle>Správa portfolií</SectionTitle>
          <Button
            variant="ghost"
            size="sm"
            icon
            onClick={onClose}
            aria-label="Zavřít"
          >
            ×
          </Button>
        </div>

        {error && (
          <div className="pm-error">
            <Text>{error}</Text>
          </div>
        )}

        {loading ? (
          <LoadingSpinner text="Načítám..." size="sm" />
        ) : (
          <>
            <div className="pm-list">
              {portfolios.map((portfolio) => (
                <div key={portfolio.id} className="pm-item">
                  <div className="pm-item-info">
                    <span
                      className="pm-color"
                      style={{ backgroundColor: portfolio.color }}
                    />
                    <div className="pm-item-text">
                      <div className="pm-name">
                        <Text weight="semibold">{portfolio.name}</Text>
                        {portfolio.is_default && (
                          <Badge variant="info" size="xs">
                            Výchozí
                          </Badge>
                        )}
                      </div>
                      {portfolio.description && (
                        <Description size="sm">
                          {portfolio.description}
                        </Description>
                      )}
                    </div>
                  </div>
                  <div className="pm-item-actions">
                    {!portfolio.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(portfolio.id)}
                        title="Nastavit jako výchozí"
                        className="pm-btn-default"
                      >
                        ★
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleEdit(portfolio)}
                    >
                      Upravit
                    </Button>
                    {!portfolio.is_default && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(portfolio.id)}
                      >
                        Smazat
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {showAddForm ? (
              <form className="pm-form" onSubmit={handleSubmit}>
                <CardTitle>
                  {editingId ? 'Upravit portfolio' : 'Přidat portfolio'}
                </CardTitle>

                <div className="pm-form-group">
                  <Label htmlFor="name">Název *</Label>
                  <Input
                    type="text"
                    id="name"
                    inputSize="md"
                    fullWidth
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="např. Dlouhodobé investice"
                    required
                  />
                </div>

                <div className="pm-form-group">
                  <Label htmlFor="description">Popis</Label>
                  <Input
                    type="text"
                    id="description"
                    inputSize="md"
                    fullWidth
                    value={formData.description || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Volitelný popis"
                  />
                </div>

                <div className="pm-form-group">
                  <Label>Barva</Label>
                  <div className="pm-color-picker">
                    {COLORS.map((color) => (
                      <Button
                        key={color}
                        type="button"
                        variant="ghost"
                        icon
                        size="sm"
                        className={`pm-color-option ${
                          formData.color === color ? 'selected' : ''
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData({ ...formData, color })}
                        aria-label={`Select color ${color}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="pm-form-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCancel}
                  >
                    Zrušit
                  </Button>
                  <Button type="submit" variant="primary">
                    {editingId ? 'Uložit změny' : 'Přidat portfolio'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="pm-add-wrapper">
                <Button
                  variant="outline"
                  fullWidth
                  className="pm-add-btn"
                  onClick={() => setShowAddForm(true)}
                >
                  + Přidat nové portfolio
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
