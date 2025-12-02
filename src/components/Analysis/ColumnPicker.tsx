import { useState, useRef, useEffect } from 'react';
import type {
  AnalysisIndicator,
  UserAnalysisView,
} from '@/services/api/indicators';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';
import { stripTooltipMarkdown } from '@/components/shared/InfoTooltip';
import {
  CardTitle,
  SectionTitle,
  Caption,
  Text,
  Muted,
  Tag,
} from '@/components/shared/Typography';
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
    valuation: 'Valuace',
    profitability: 'Ziskovost',
    growth: 'Růst',
    risk: 'Riziko',
    dividend: 'Dividendy',
    performance: 'Výkonnost',
    size: 'Velikost',
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
        <Button
          variant="ghost"
          className="picker-trigger"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Text>⚙ Sloupce ({selectedKeys.length})</Text>
          <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
        </Button>

        {onSaveView && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSaveDialog(true)}
            title="Uložit aktuální konfiguraci sloupců jako pohled"
          >
            Uložit pohled
          </Button>
        )}
      </div>

      {/* Views Selector */}
      {views.length > 0 && (
        <div className="views-row">
          <Caption>Pohledy:</Caption>
          <div className="views-list">
            {views.map((view) => (
              <div
                key={view.id}
                className={`view-chip ${
                  currentViewId === view.id ? 'active' : ''
                }`}
              >
                {onSetDefaultView && (
                  <Button
                    variant="ghost"
                    size="sm"
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
                      view.is_default
                        ? 'Výchozí pohled'
                        : 'Nastavit jako výchozí pohled'
                    }
                  >
                    {view.is_default ? '★' : '☆'}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="view-chip-name"
                  onClick={() => onSelectView?.(view)}
                >
                  {view.name}
                </Button>
                {onDeleteView && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="view-chip-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Smazat pohled "${view.name}"?`)) {
                        onDeleteView(view.id);
                      }
                    }}
                    title="Smazat pohled"
                  >
                    ×
                  </Button>
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
            <CardTitle>Uložit pohled</CardTitle>
            <Input
              type="text"
              placeholder="Název pohledu..."
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveView()}
              autoFocus
              fullWidth
            />
            <div className="dialog-actions">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowSaveDialog(false)}
              >
                Zrušit
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveView}
                disabled={!viewName.trim()}
              >
                Uložit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Columns Preview - Drag & Drop (Desktop only) */}
      {!isMobile && (
        <div className="selected-columns">
          <Caption>Tažením změníte pořadí:</Caption>
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
                <Text size="xs">⠿</Text>
                <Text size="sm">{indicator.short_name}</Text>
                <Button
                  variant="ghost"
                  size="sm"
                  className="remove-btn"
                  onClick={() => toggleColumn(key)}
                >
                  ×
                </Button>
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
              <div key={key} className="mobile-column-chip">
                <Text size="sm">{indicator.short_name}</Text>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleColumn(key)}
                >
                  ×
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Desktop Dropdown Panel */}
      {isOpen && !isMobile && (
        <div className="picker-dropdown">
          <div className="picker-search">
            <Input
              type="text"
              placeholder="Hledat indikátory..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (e.target.value) setActiveCategory(null);
              }}
              autoFocus
              fullWidth
            />
          </div>

          <div className="picker-content">
            {/* Category Sidebar */}
            <div className="category-sidebar">
              {categoryOrder.map((cat) => {
                const count = (categories[cat] || []).filter((i) =>
                  selectedKeys.includes(i.key)
                ).length;
                const total = (categories[cat] || []).length;
                return (
                  <Button
                    key={cat}
                    variant="ghost"
                    className={`category-item ${
                      activeCategory === cat ? 'active' : ''
                    }`}
                    onClick={() => {
                      setActiveCategory(activeCategory === cat ? null : cat);
                      setSearchTerm('');
                    }}
                  >
                    <Text size="sm" weight="medium">
                      {categoryLabels[cat]}
                    </Text>
                    <Muted>
                      {count}/{total}
                    </Muted>
                  </Button>
                );
              })}
            </div>

            {/* Indicator List */}
            <div className="indicator-list">
              {(searchTerm || activeCategory) &&
                filteredIndicators.length === 0 && (
                  <div className="indicator-empty">
                    <Muted>Žádné indikátory nenalezeny</Muted>
                  </div>
                )}

              {!searchTerm && !activeCategory && (
                <div className="indicator-empty">
                  <Muted>Vyberte kategorii nebo hledejte</Muted>
                </div>
              )}

              {filteredIndicators.map((ind) => (
                <label
                  key={ind.key}
                  className={`indicator-item ${
                    selectedKeys.includes(ind.key) ? 'selected' : ''
                  }`}
                >
                  <div className="indicator-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedKeys.includes(ind.key)}
                      onChange={() => toggleColumn(ind.key)}
                    />
                  </div>
                  <div className="indicator-info">
                    <div className="indicator-header">
                      <Text size="sm" weight="medium">
                        {ind.name}
                      </Text>
                      <Tag>{ind.short_name}</Tag>
                    </div>
                    <Caption>{stripTooltipMarkdown(ind.description)}</Caption>
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
              Výchozí nastavení
            </Button>
            <Button variant="primary" size="sm" onClick={handleClose}>
              Hotovo
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
              <SectionTitle>Vybrat sloupce</SectionTitle>
              <Button
                variant="ghost"
                className="mobile-picker-close"
                onClick={handleClose}
              >
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
              </Button>
            </div>

            <div className="mobile-picker-search">
              <Input
                type="text"
                placeholder="Hledat indikátory..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                fullWidth
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="search-clear"
                  onClick={() => setSearchTerm('')}
                >
                  ×
                </Button>
              )}
            </div>

            <div className="mobile-picker-content">
              {/* Search Results */}
              {mobileFilteredIndicators && (
                <div className="mobile-search-results">
                  {mobileFilteredIndicators.length === 0 ? (
                    <Muted>Žádné indikátory nenalezeny</Muted>
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
                          <Text size="base" weight="medium">
                            {ind.name}
                          </Text>
                          <Muted>{ind.short_name}</Muted>
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
                        <Button
                          variant="ghost"
                          className={`mobile-category-header ${
                            isExpanded ? 'expanded' : ''
                          }`}
                          onClick={() => toggleCategory(cat)}
                        >
                          <Text size="base" weight="medium">
                            {categoryLabels[cat] || cat}
                          </Text>
                          <Muted>
                            {selectedCount}/{catIndicators.length}
                          </Muted>
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
                        </Button>

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
                                  <Text size="base" weight="medium">
                                    {ind.name}
                                  </Text>
                                  <Muted>
                                    {stripTooltipMarkdown(ind.description)}
                                  </Muted>
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
                Výchozí nastavení
              </Button>
              <Button variant="primary" onClick={handleClose}>
                Hotovo ({selectedKeys.length})
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
