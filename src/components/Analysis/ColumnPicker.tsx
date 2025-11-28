import { useState, useRef, useEffect } from 'react';
import type {
  AnalysisIndicator,
  UserAnalysisView,
} from '@/services/api/indicators';
import { Button } from '@/components/shared/Button';
import './ColumnPicker.css';

interface ColumnPickerProps {
  indicators: AnalysisIndicator[];
  selectedKeys: string[];
  onSelectionChange: (keys: string[]) => void;
  onSaveView?: (name: string) => void;
  views?: UserAnalysisView[];
  currentViewId?: string | null;
  onSelectView?: (view: UserAnalysisView) => void;
  onDeleteView?: (viewId: string) => void;
  onSetDefaultView?: (viewId: string) => void;
}

// Hook to detect mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}

export function ColumnPicker({
  indicators,
  selectedKeys,
  onSelectionChange,
  onSaveView,
  views = [],
  currentViewId,
  onSelectView,
  onDeleteView,
  onSetDefaultView,
}: ColumnPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [viewName, setViewName] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Group indicators by category
  const categories = indicators.reduce((acc, ind) => {
    if (!acc[ind.category]) acc[ind.category] = [];
    acc[ind.category].push(ind);
    return acc;
  }, {} as Record<string, AnalysisIndicator[]>);

  const categoryOrder = [
    'valuation',
    'profitability',
    'growth',
    'risk',
    'dividend',
    'performance',
    'size',
  ];
  const categoryLabels: Record<string, string> = {
    valuation: 'Valuation',
    profitability: 'Profitability',
    growth: 'Growth',
    risk: 'Risk',
    dividend: 'Dividend',
    performance: 'Performance',
    size: 'Size',
  };

  // Filter indicators by search
  const filteredIndicators = searchTerm
    ? indicators.filter(
        (ind) =>
          ind.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ind.short_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ind.key.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : activeCategory
    ? categories[activeCategory] || []
    : [];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm('');
        setActiveCategory(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleColumn = (key: string) => {
    if (selectedKeys.includes(key)) {
      onSelectionChange(selectedKeys.filter((k) => k !== key));
    } else {
      onSelectionChange([...selectedKeys, key]);
    }
  };

  const handleSaveView = () => {
    if (viewName.trim() && onSaveView) {
      onSaveView(viewName.trim());
      setViewName('');
      setShowSaveDialog(false);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    if (
      draggedIndex !== null &&
      dragOverIndex !== null &&
      draggedIndex !== dragOverIndex
    ) {
      const newKeys = [...selectedKeys];
      const [draggedKey] = newKeys.splice(draggedIndex, 1);
      newKeys.splice(dragOverIndex, 0, draggedKey);
      onSelectionChange(newKeys);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const getIndicatorByKey = (key: string) =>
    indicators.find((i) => i.key === key);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const handleResetToDefault = () => {
    onSelectionChange([
      'peRatio',
      'pbRatio',
      'roe',
      'netMargin',
      'beta',
      'dividendYield',
      'debtToEquity',
      'marketCap',
    ]);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchTerm('');
    setActiveCategory(null);
  };

  // Filter indicators for mobile search
  const mobileFilteredIndicators = searchTerm
    ? indicators.filter(
        (ind) =>
          ind.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ind.short_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : null;

  return (
    <div className="column-picker" ref={dropdownRef}>
      <div className="column-picker-header">
        <button className="picker-trigger" onClick={() => setIsOpen(!isOpen)}>
          <span className="trigger-icon">⚙</span>
          <span>Columns ({selectedKeys.length})</span>
          <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
        </button>

        {onSaveView && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSaveDialog(true)}
            title="Save current column configuration as a view"
          >
            💾 Save View
          </Button>
        )}
      </div>

      {/* Views Selector */}
      {views.length > 0 && (
        <div className="views-row">
          <span className="views-label">Views:</span>
          <div className="views-list">
            {views.map((view) => (
              <div
                key={view.id}
                className={`view-chip ${
                  currentViewId === view.id ? 'active' : ''
                }`}
              >
                {onSetDefaultView && (
                  <button
                    className={`view-chip-star ${
                      view.is_default ? 'is-default' : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!view.is_default) {
                        onSetDefaultView(view.id);
                      }
                    }}
                    title={
                      view.is_default ? 'Default view' : 'Set as default view'
                    }
                  >
                    {view.is_default ? '★' : '☆'}
                  </button>
                )}
                <button
                  className="view-chip-name"
                  onClick={() => onSelectView?.(view)}
                >
                  {view.name}
                </button>
                {onDeleteView && (
                  <button
                    className="view-chip-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete view "${view.name}"?`)) {
                        onDeleteView(view.id);
                      }
                    }}
                    title="Delete view"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save View Dialog */}
      {showSaveDialog && (
        <div
          className="save-dialog-overlay"
          onClick={() => setShowSaveDialog(false)}
        >
          <div className="save-dialog" onClick={(e) => e.stopPropagation()}>
            <h4>Save View</h4>
            <input
              type="text"
              placeholder="View name..."
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveView()}
              autoFocus
            />
            <div className="dialog-actions">
              <button onClick={() => setShowSaveDialog(false)}>Cancel</button>
              <button
                className="primary"
                onClick={handleSaveView}
                disabled={!viewName.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Columns Preview - Drag & Drop (Desktop only) */}
      {!isMobile && (
        <div className="selected-columns">
          <span className="columns-hint">Drag to reorder:</span>
          {selectedKeys.map((key, index) => {
            const indicator = getIndicatorByKey(key);
            if (!indicator) return null;
            return (
              <div
                key={key}
                className={`selected-column-tag ${
                  draggedIndex === index ? 'dragging' : ''
                } ${dragOverIndex === index ? 'drag-over' : ''}`}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onDragLeave={handleDragLeave}
                title={indicator.description}
              >
                <span className="drag-handle">⠿</span>
                <span className="tag-name">{indicator.short_name}</span>
                <button
                  className="remove-btn"
                  onClick={() => toggleColumn(key)}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Mobile Selected Columns - Horizontal scroll */}
      {isMobile && selectedKeys.length > 0 && (
        <div className="mobile-selected-columns">
          {selectedKeys.map((key) => {
            const indicator = getIndicatorByKey(key);
            if (!indicator) return null;
            return (
              <span key={key} className="mobile-column-chip">
                {indicator.short_name}
                <button onClick={() => toggleColumn(key)}>×</button>
              </span>
            );
          })}
        </div>
      )}

      {/* Desktop Dropdown Panel */}
      {isOpen && !isMobile && (
        <div className="picker-dropdown">
          <div className="picker-search">
            <input
              type="text"
              placeholder="Search indicators..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (e.target.value) setActiveCategory(null);
              }}
              autoFocus
            />
          </div>

          <div className="picker-content">
            {/* Category Tabs */}
            <div className="category-tabs">
              {categoryOrder.map((cat) => (
                <button
                  key={cat}
                  className={`category-tab ${
                    activeCategory === cat ? 'active' : ''
                  }`}
                  onClick={() => {
                    setActiveCategory(activeCategory === cat ? null : cat);
                    setSearchTerm('');
                  }}
                >
                  {categoryLabels[cat] || cat}
                  <span className="count">
                    {
                      (categories[cat] || []).filter((i) =>
                        selectedKeys.includes(i.key)
                      ).length
                    }
                    /{(categories[cat] || []).length}
                  </span>
                </button>
              ))}
            </div>

            {/* Indicator List */}
            <div className="indicator-list">
              {(searchTerm || activeCategory) &&
                filteredIndicators.length === 0 && (
                  <div className="no-results">No indicators found</div>
                )}

              {!searchTerm && !activeCategory && (
                <div className="select-category-hint">
                  Select a category or search to add columns
                </div>
              )}

              {filteredIndicators.map((ind) => (
                <label
                  key={ind.key}
                  className={`indicator-item ${
                    selectedKeys.includes(ind.key) ? 'selected' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedKeys.includes(ind.key)}
                    onChange={() => toggleColumn(ind.key)}
                  />
                  <div className="indicator-info">
                    <span className="indicator-name">
                      {ind.name}
                      <span className="indicator-short">
                        ({ind.short_name})
                      </span>
                    </span>
                    <span className="indicator-desc">{ind.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="picker-footer">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetToDefault}
            >
              Reset to Default
            </Button>
            <Button variant="primary" size="sm" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      )}

      {/* Mobile Full-screen Panel */}
      {isOpen && isMobile && (
        <>
          <div className="mobile-picker-backdrop" onClick={handleClose} />
          <div className="mobile-picker-sheet">
            <div className="mobile-picker-header">
              <h3>Select Columns</h3>
              <button className="mobile-picker-close" onClick={handleClose}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mobile-picker-search">
              <input
                type="text"
                placeholder="Search indicators..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  className="search-clear"
                  onClick={() => setSearchTerm('')}
                >
                  ×
                </button>
              )}
            </div>

            <div className="mobile-picker-content">
              {/* Search Results */}
              {mobileFilteredIndicators && (
                <div className="mobile-search-results">
                  {mobileFilteredIndicators.length === 0 ? (
                    <div className="no-results">No indicators found</div>
                  ) : (
                    mobileFilteredIndicators.map((ind) => (
                      <div
                        key={ind.key}
                        className={`mobile-indicator-row ${
                          selectedKeys.includes(ind.key) ? 'selected' : ''
                        }`}
                        onClick={() => toggleColumn(ind.key)}
                      >
                        <div className="mobile-indicator-info">
                          <span className="mobile-indicator-name">
                            {ind.name}
                          </span>
                          <span className="mobile-indicator-short">
                            {ind.short_name}
                          </span>
                        </div>
                        <div
                          className={`mobile-toggle ${
                            selectedKeys.includes(ind.key) ? 'on' : ''
                          }`}
                        >
                          <div className="toggle-track">
                            <div className="toggle-thumb" />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Categories Accordion */}
              {!searchTerm && (
                <div className="mobile-categories">
                  {categoryOrder.map((cat) => {
                    const catIndicators = categories[cat] || [];
                    const selectedCount = catIndicators.filter((i) =>
                      selectedKeys.includes(i.key)
                    ).length;
                    const isExpanded = expandedCategories.has(cat);

                    return (
                      <div key={cat} className="mobile-category">
                        <button
                          className={`mobile-category-header ${
                            isExpanded ? 'expanded' : ''
                          }`}
                          onClick={() => toggleCategory(cat)}
                        >
                          <span className="category-icon">
                            {categoryLabels[cat]?.split(' ')[0] || ''}
                          </span>
                          <span className="category-name">
                            {categoryLabels[cat]
                              ?.split(' ')
                              .slice(1)
                              .join(' ') || cat}
                          </span>
                          <span className="category-count">
                            {selectedCount}/{catIndicators.length}
                          </span>
                          <span
                            className={`category-arrow ${
                              isExpanded ? 'expanded' : ''
                            }`}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="mobile-category-items">
                            {catIndicators.map((ind) => (
                              <div
                                key={ind.key}
                                className={`mobile-indicator-row ${
                                  selectedKeys.includes(ind.key)
                                    ? 'selected'
                                    : ''
                                }`}
                                onClick={() => toggleColumn(ind.key)}
                              >
                                <div className="mobile-indicator-info">
                                  <span className="mobile-indicator-name">
                                    {ind.name}
                                  </span>
                                  <span className="mobile-indicator-desc">
                                    {ind.description}
                                  </span>
                                </div>
                                <div
                                  className={`mobile-toggle ${
                                    selectedKeys.includes(ind.key) ? 'on' : ''
                                  }`}
                                >
                                  <div className="toggle-track">
                                    <div className="toggle-thumb" />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mobile-picker-footer">
              <Button variant="secondary" onClick={handleResetToDefault}>
                Reset to Default
              </Button>
              <Button variant="primary" onClick={handleClose}>
                Done ({selectedKeys.length})
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
