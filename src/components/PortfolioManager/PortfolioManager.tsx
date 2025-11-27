import { useState, useEffect } from 'react';
import type { Portfolio, CreatePortfolioInput } from '@/types/database';
import { portfoliosApi } from '@/services/api';
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
      setError('Failed to load portfolios');
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
      setError('Cannot delete the default portfolio');
      return;
    }

    if (
      !confirm(
        'Delete this portfolio? All transactions in it will need to be reassigned.'
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
          <h2>Manage Portfolios</h2>
          <button className="pm-close" onClick={onClose}>
            ×
          </button>
        </div>

        {error && <div className="pm-error">{error}</div>}

        {loading ? (
          <div className="pm-loading">Loading...</div>
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
                      <span className="pm-name">
                        {portfolio.name}
                        {portfolio.is_default && (
                          <span className="pm-default-badge">Default</span>
                        )}
                      </span>
                      {portfolio.description && (
                        <span className="pm-description">
                          {portfolio.description}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="pm-item-actions">
                    {!portfolio.is_default && (
                      <button
                        className="pm-btn pm-btn-default"
                        onClick={() => handleSetDefault(portfolio.id)}
                        title="Set as default"
                      >
                        ★
                      </button>
                    )}
                    <button
                      className="pm-btn pm-btn-edit"
                      onClick={() => handleEdit(portfolio)}
                    >
                      Edit
                    </button>
                    {!portfolio.is_default && (
                      <button
                        className="pm-btn pm-btn-delete"
                        onClick={() => handleDelete(portfolio.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {showAddForm ? (
              <form className="pm-form" onSubmit={handleSubmit}>
                <h3>{editingId ? 'Edit Portfolio' : 'Add Portfolio'}</h3>

                <div className="pm-form-group">
                  <label htmlFor="name">Name *</label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Long-term IRA"
                    required
                  />
                </div>

                <div className="pm-form-group">
                  <label htmlFor="description">Description</label>
                  <input
                    type="text"
                    id="description"
                    value={formData.description || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Optional description"
                  />
                </div>

                <div className="pm-form-group">
                  <label>Color</label>
                  <div className="pm-color-picker">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`pm-color-option ${
                          formData.color === color ? 'selected' : ''
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData({ ...formData, color })}
                      />
                    ))}
                  </div>
                </div>

                <div className="pm-form-actions">
                  <button
                    type="button"
                    className="pm-btn pm-btn-cancel"
                    onClick={handleCancel}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="pm-btn pm-btn-save">
                    {editingId ? 'Save Changes' : 'Add Portfolio'}
                  </button>
                </div>
              </form>
            ) : (
              <button
                className="pm-add-btn"
                onClick={() => setShowAddForm(true)}
              >
                + Add New Portfolio
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
