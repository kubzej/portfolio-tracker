/**
 * Debug Showcase
 *
 * Visible only on localhost for development purposes.
 * Shows all components, typography, colors, and design system elements.
 */
import React, { useState } from 'react';
import './DebugShowcase.css';
import {
  // Core text
  Text,
  Label,
  Title,
  Caption,
  Muted,
  Description,
  Hint,
  Subtext,
  // Page structure
  PageTitle,
  SectionTitle,
  CardTitle,
  // Stock-specific
  Ticker,
  StockName,
  // Metrics
  MetricLabel,
  MetricValue,
  // UI elements
  Badge,
  Tag,
  Count,
  RecItem,
  SortIcon,
} from '../shared/Typography';

// Import existing shared components for comparison
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { ScoreCard } from '../shared/ScoreCard';
import { MetricRow } from '../shared/MetricRow';
import { PriceDisplay } from '../shared/PriceDisplay';
import { SignalBadge } from '../shared/SignalBadge';
import { EmptyState } from '../shared/EmptyState';
import { ErrorState } from '../shared/ErrorState';
import { ToggleGroup } from '../shared/ToggleGroup';
import { Tabs } from '../shared/Tabs';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { InfoTooltip } from '../shared/InfoTooltip';
import { BottomSheet, BottomSheetOption } from '../shared/BottomSheet';
import { StockCard } from '../shared/StockCard';

// Navigation categories
type Category = 'typography' | 'components' | 'patterns' | 'tokens';

interface NavItem {
  id: string;
  label: string;
  category: Category;
}

const NAV_ITEMS: NavItem[] = [
  // Typography
  { id: 'core-text', label: 'Core Text', category: 'typography' },
  { id: 'headings', label: 'Headings & Titles', category: 'typography' },
  { id: 'metrics', label: 'Metrics', category: 'typography' },
  { id: 'badges', label: 'Badges & Tags', category: 'typography' },
  // Components
  { id: 'stock', label: 'Stock Components', category: 'components' },
  { id: 'forms', label: 'Forms', category: 'components' },
  { id: 'ui', label: 'UI Controls', category: 'components' },
  { id: 'shared', label: 'Shared (Legacy)', category: 'components' },
  // Design Tokens
  { id: 'colors', label: 'Colors', category: 'tokens' },
  { id: 'fonts', label: 'Font Sizes', category: 'tokens' },
];

const CATEGORY_LABELS: Record<Category, string> = {
  typography: 'Typography',
  components: 'Components',
  patterns: 'Patterns',
  tokens: 'Design Tokens',
};

function CoreTextSection() {
  return (
    <section className="debug-section" id="core-text">
      <SectionTitle>Core Text Components</SectionTitle>

      {/* Text */}
      <div className="debug-group">
        <CardTitle>{'<Text>'}</CardTitle>
        <code className="debug-code">
          {'<Text size="base" weight="normal" color="primary">Hello</Text>'}
        </code>
        <div className="debug-row">
          <Text size="xs">xs text</Text>
          <Text size="sm">sm text</Text>
          <Text size="base">base text</Text>
          <Text size="md">md text</Text>
          <Text size="lg">lg text</Text>
        </div>
        <div className="debug-row">
          <Text weight="normal">normal</Text>
          <Text weight="medium">medium</Text>
          <Text weight="semibold">semibold</Text>
          <Text weight="bold">bold</Text>
        </div>
        <div className="debug-row">
          <Text color="primary">primary</Text>
          <Text color="secondary">secondary</Text>
          <Text color="muted">muted</Text>
          <Text color="success">success</Text>
          <Text color="danger">danger</Text>
        </div>
      </div>

      {/* Label */}
      <div className="debug-group">
        <CardTitle>{'<Label>'}</CardTitle>
        <code className="debug-code">
          {'<Label size="sm">Field name</Label>'}
        </code>
        <div className="debug-row">
          <Label size="sm">Small label</Label>
          <Label size="base">Base label</Label>
        </div>
        <Description>
          Generic label - NOT uppercase (use MetricLabel for uppercase)
        </Description>
      </div>

      {/* Muted */}
      <div className="debug-group">
        <CardTitle>{'<Muted>'}</CardTitle>
        <code className="debug-code">{'<Muted>—</Muted>'}</code>
        <div className="debug-row">
          <Muted>—</Muted>
          <Muted>N/A</Muted>
          <Muted>No data available</Muted>
        </div>
      </div>

      {/* Caption */}
      <div className="debug-group">
        <CardTitle>{'<Caption>'}</CardTitle>
        <code className="debug-code">
          {'<Caption>Small descriptive text</Caption>'}
        </code>
        <div className="debug-row">
          <Caption>This is a caption for additional context</Caption>
        </div>
      </div>

      {/* Description */}
      <div className="debug-group">
        <CardTitle>{'<Description>'}</CardTitle>
        <code className="debug-code">
          {'<Description size="base">Paragraph text</Description>'}
        </code>
        <div className="debug-column">
          <Description size="sm">
            Description sm - smaller explanatory text for compact spaces.
          </Description>
          <Description size="base">
            Description base - standard paragraph used for longer explanatory
            text.
          </Description>
        </div>
      </div>

      {/* Hint */}
      <div className="debug-group">
        <CardTitle>{'<Hint>'}</CardTitle>
        <code className="debug-code">{'<Hint>Helper text</Hint>'}</code>
        <div className="debug-row">
          <Hint>Leave empty to auto-fetch</Hint>
        </div>
      </div>

      {/* Subtext */}
      <div className="debug-group">
        <CardTitle>{'<Subtext>'}</CardTitle>
        <code className="debug-code">{'<Subtext>/ 20</Subtext>'}</code>
        <div className="debug-row">
          <MetricValue>15</MetricValue>
          <Subtext>/ 20</Subtext>
        </div>
      </div>
    </section>
  );
}

function HeadingsSection() {
  return (
    <section className="debug-section" id="headings">
      <SectionTitle>Headings & Titles</SectionTitle>

      {/* Title */}
      <div className="debug-group">
        <CardTitle>{'<Title>'}</CardTitle>
        <code className="debug-code">
          {'<Title size="lg" as="h2">Heading</Title>'}
        </code>
        <div className="debug-column">
          <Title size="sm">Title sm</Title>
          <Title size="base">Title base</Title>
          <Title size="lg">Title lg</Title>
          <Title size="xl">Title xl</Title>
          <Title size="2xl">Title 2xl</Title>
        </div>
      </div>

      {/* PageTitle */}
      <div className="debug-group">
        <CardTitle>{'<PageTitle>'}</CardTitle>
        <code className="debug-code">{'<PageTitle>Dashboard</PageTitle>'}</code>
        <div className="debug-row">
          <PageTitle>Portfolio Tracker</PageTitle>
        </div>
      </div>

      {/* SectionTitle */}
      <div className="debug-group">
        <CardTitle>{'<SectionTitle>'}</CardTitle>
        <code className="debug-code">
          {'<SectionTitle>Technical Indicators</SectionTitle>'}
        </code>
        <div className="debug-row">
          <SectionTitle>Technical Indicators</SectionTitle>
        </div>
      </div>

      {/* CardTitle */}
      <div className="debug-group">
        <CardTitle>{'<CardTitle>'}</CardTitle>
        <code className="debug-code">{'<CardTitle>Momentum</CardTitle>'}</code>
        <div className="debug-row">
          <CardTitle>Momentum Indicators</CardTitle>
        </div>
      </div>
    </section>
  );
}

function StockSection() {
  return (
    <section className="debug-section" id="stock">
      <SectionTitle>Stock Components</SectionTitle>

      {/* StockCard */}
      <div className="debug-group">
        <CardTitle>{'<StockCard>'}</CardTitle>
        <code className="debug-code">
          {
            '<StockCard ticker="AAPL" name="Apple Inc." exchange="NASDAQ" currency="USD" />'
          }
        </code>
        <div
          className="debug-row"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem',
            width: '100%',
          }}
        >
          <StockCard
            ticker="AAPL"
            name="Apple Inc."
            exchange="NASDAQ"
            currency="USD"
            sectorName="Technology"
            targetPrice={200}
            onClick={() => {}}
          />
          <StockCard
            ticker="CEZ"
            name="ČEZ, a.s."
            exchange="PSE"
            currency="CZK"
            sectorName="Utilities"
            onClick={() => {}}
          />
        </div>
        <Description>
          Complete stock card with market status, exchange, and optional target
          price.
        </Description>
      </div>

      {/* Ticker */}
      <div className="debug-group">
        <CardTitle>{'<Ticker>'}</CardTitle>
        <code className="debug-code">
          {'<Ticker size="base">AAPL</Ticker>'}
        </code>
        <div className="debug-row">
          <Ticker size="sm">aapl</Ticker>
          <Ticker size="base">aapl</Ticker>
          <Ticker size="lg">aapl</Ticker>
          <Ticker size="xl">aapl</Ticker>
        </div>
        <Description>
          Note: Input is lowercase, but CSS transforms to UPPERCASE
        </Description>
      </div>

      {/* StockName */}
      <div className="debug-group">
        <CardTitle>{'<StockName>'}</CardTitle>
        <code className="debug-code">
          {'<StockName truncate>Apple Inc.</StockName>'}
        </code>
        <div className="debug-row">
          <StockName>Apple Inc.</StockName>
          <StockName size="sm">Apple Inc.</StockName>
        </div>
        <div className="debug-row" style={{ maxWidth: 150 }}>
          <StockName truncate>Advanced Micro Devices, Inc.</StockName>
        </div>
      </div>
    </section>
  );
}

function MetricsSection() {
  return (
    <section className="debug-section" id="metrics">
      <SectionTitle>Metrics</SectionTitle>

      {/* MetricLabel */}
      <div className="debug-group">
        <CardTitle>{'<MetricLabel>'}</CardTitle>
        <code className="debug-code">
          {'<MetricLabel>P/E Ratio</MetricLabel>'}
        </code>
        <div className="debug-row">
          <MetricLabel>Price</MetricLabel>
          <MetricLabel>P/E Ratio</MetricLabel>
          <MetricLabel>52-Week Range</MetricLabel>
          <MetricLabel>MSPR</MetricLabel>
        </div>
        <Description>Always UPPERCASE via CSS</Description>
      </div>

      {/* MetricValue */}
      <div className="debug-group">
        <CardTitle>{'<MetricValue>'}</CardTitle>
        <code className="debug-code">
          {'<MetricValue sentiment="positive">+5.2%</MetricValue>'}
        </code>
        <div className="debug-row">
          <MetricValue>$150.00</MetricValue>
          <MetricValue sentiment="positive">+5.2%</MetricValue>
          <MetricValue sentiment="negative">-3.1%</MetricValue>
          <MetricValue sentiment="neutral">0.0%</MetricValue>
        </div>
        <div className="debug-row">
          <MetricValue size="sm">$150.00</MetricValue>
          <MetricValue size="base">$150.00</MetricValue>
          <MetricValue size="lg">$150.00</MetricValue>
        </div>
        <Description>Uses tabular-nums for alignment</Description>
      </div>
    </section>
  );
}

function BadgesSection() {
  return (
    <section className="debug-section" id="badges">
      <SectionTitle>Badges & Tags</SectionTitle>

      {/* Badge */}
      <div className="debug-group">
        <CardTitle>{'<Badge>'}</CardTitle>
        <code className="debug-code">
          {'<Badge variant="buy" size="base">Strong Buy</Badge>'}
        </code>

        <Label>Recommendation variants:</Label>
        <div className="debug-row">
          <Badge variant="buy">Strong Buy</Badge>
          <Badge variant="hold">Hold</Badge>
          <Badge variant="sell">Sell</Badge>
        </div>

        <Label>Sentiment variants:</Label>
        <div className="debug-row">
          <Badge variant="positive">Positive</Badge>
          <Badge variant="negative">Negative</Badge>
          <Badge variant="neutral">Neutral</Badge>
        </div>

        <Label>Other variants:</Label>
        <div className="debug-row">
          <Badge variant="info">NASDAQ</Badge>
          <Badge variant="info">USD</Badge>
          <Badge variant="warning">Warning</Badge>
        </div>

        <Label>Sizes:</Label>
        <div className="debug-row">
          <Badge variant="buy" size="xs">
            xs
          </Badge>
          <Badge variant="buy" size="sm">
            sm
          </Badge>
          <Badge variant="buy" size="base">
            base
          </Badge>
        </div>
      </div>

      {/* RecItem */}
      <div className="debug-group">
        <CardTitle>{'<RecItem>'}</CardTitle>
        <code className="debug-code">{'<RecItem type="buy">15</RecItem>'}</code>
        <div className="debug-row">
          <RecItem type="buy">15</RecItem>
          <RecItem type="hold">8</RecItem>
          <RecItem type="sell">2</RecItem>
        </div>
        <Description>
          For Buy/Hold/Sell analyst recommendation counts
        </Description>
      </div>

      {/* Tag */}
      <div className="debug-group">
        <CardTitle>{'<Tag>'}</CardTitle>
        <code className="debug-code">
          {'<Tag variant="default" size="sm">USD</Tag>'}
        </code>

        <Label>Variants:</Label>
        <div className="debug-row">
          <Tag variant="default">NASDAQ</Tag>
          <Tag variant="default">USD</Tag>
          <Tag variant="success">Open</Tag>
          <Tag variant="muted" title="Tooltip on hover">
            Closed
          </Tag>
        </div>

        <Label>Sizes:</Label>
        <div className="debug-row">
          <Tag size="xs">xs tag</Tag>
          <Tag size="sm">sm tag</Tag>
        </div>
        <Description>For exchange, currency, market status tags.</Description>
      </div>

      {/* Count */}
      <div className="debug-group">
        <CardTitle>{'<Count>'}</CardTitle>
        <code className="debug-code">{'<Count>5</Count>'}</code>
        <div className="debug-row">
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            News <Count>12</Count>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            Alerts <Count>3</Count>
          </span>
        </div>
      </div>

      {/* SortIcon */}
      <div className="debug-group">
        <CardTitle>{'<SortIcon>'}</CardTitle>
        <code className="debug-code">
          {'<SortIcon direction="asc" active />'}
        </code>
        <div className="debug-row">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text>Inactive:</Text>
            <SortIcon direction="none" />
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text>Ascending:</Text>
            <SortIcon direction="asc" active />
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text>Descending:</Text>
            <SortIcon direction="desc" active />
          </span>
        </div>
      </div>
    </section>
  );
}

function ColorsSection() {
  return (
    <section className="debug-section" id="colors">
      <SectionTitle>Colors</SectionTitle>

      <div className="debug-group">
        <CardTitle>Semantic Colors</CardTitle>
        <div className="color-grid">
          <div className="color-item">
            <div className="color-swatch" style={{ background: '#22c55e' }} />
            <Text size="sm">--color-success</Text>
            <Caption>#22c55e</Caption>
          </div>
          <div className="color-item">
            <div className="color-swatch" style={{ background: '#ef4444' }} />
            <Text size="sm">--color-danger</Text>
            <Caption>#ef4444</Caption>
          </div>
          <div className="color-item">
            <div className="color-swatch" style={{ background: '#f59e0b' }} />
            <Text size="sm">--color-warning</Text>
            <Caption>#f59e0b</Caption>
          </div>
          <div className="color-item">
            <div className="color-swatch" style={{ background: '#3b82f6' }} />
            <Text size="sm">--color-accent</Text>
            <Caption>#3b82f6</Caption>
          </div>
          <div className="color-item">
            <div className="color-swatch" style={{ background: '#6b7280' }} />
            <Text size="sm">--color-neutral</Text>
            <Caption>#6b7280</Caption>
          </div>
        </div>
      </div>

      <div className="debug-group">
        <CardTitle>Text Colors</CardTitle>
        <div className="color-grid">
          <div className="color-item">
            <div className="color-swatch" style={{ background: '#1a1a2e' }} />
            <Text size="sm">--text-primary</Text>
            <Caption>#1a1a2e</Caption>
          </div>
          <div className="color-item">
            <div className="color-swatch" style={{ background: '#4a4a6a' }} />
            <Text size="sm">--text-secondary</Text>
            <Caption>#4a4a6a</Caption>
          </div>
          <div className="color-item">
            <div className="color-swatch" style={{ background: '#8a8aa0' }} />
            <Text size="sm">--text-muted</Text>
            <Caption>#8a8aa0</Caption>
          </div>
        </div>
      </div>
    </section>
  );
}

function FontSizesSection() {
  return (
    <section className="debug-section" id="fonts">
      <SectionTitle>Font Sizes</SectionTitle>

      <div className="debug-group">
        <div className="font-list">
          <div className="font-item">
            <Text size="xs">--text-xs: 10px (0.625rem)</Text>
          </div>
          <div className="font-item">
            <Text size="sm">--text-sm: 12px (0.75rem)</Text>
          </div>
          <div className="font-item">
            <Text size="base">--text-base: 14px (0.875rem)</Text>
          </div>
          <div className="font-item">
            <Text size="md">--text-md: 16px (1rem)</Text>
          </div>
          <div className="font-item">
            <Text size="lg">--text-lg: 18px (1.125rem)</Text>
          </div>
        </div>
      </div>
    </section>
  );
}

function FormComponentsSection() {
  return (
    <section className="debug-section" id="forms">
      <SectionTitle>Forms</SectionTitle>

      {/* Button */}
      <div className="debug-group">
        <CardTitle>{'<Button>'}</CardTitle>
        <code className="debug-code">
          {'<Button variant="primary" size="md">Save</Button>'}
        </code>

        <Label>Variants:</Label>
        <div className="debug-row">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="success">Success</Button>
        </div>

        <Label>Sizes:</Label>
        <div className="debug-row">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>

        <Label>States:</Label>
        <div className="debug-row">
          <Button disabled>Disabled</Button>
          <Button isActive>Active</Button>
          <Button fullWidth>Full Width</Button>
        </div>
      </div>

      {/* Input */}
      <div className="debug-group">
        <CardTitle>{'<Input>'}</CardTitle>
        <code className="debug-code">
          {'<Input inputSize="md" placeholder="Enter value" />'}
        </code>

        <Label>Sizes:</Label>
        <div className="debug-column" style={{ gap: '0.5rem' }}>
          <Input inputSize="sm" placeholder="Small input" />
          <Input inputSize="md" placeholder="Medium input" />
          <Input inputSize="lg" placeholder="Large input" />
        </div>

        <Label>States:</Label>
        <div className="debug-column" style={{ gap: '0.5rem' }}>
          <Input placeholder="Normal state" />
          <Input error placeholder="Error state" />
          <Input disabled placeholder="Disabled state" />
        </div>

        <Label>Full width:</Label>
        <div className="debug-column" style={{ gap: '0.5rem' }}>
          <Input fullWidth placeholder="Full width input" />
        </div>

        <Label>Types:</Label>
        <div className="debug-column" style={{ gap: '0.5rem' }}>
          <Input type="email" placeholder="Email" />
          <Input type="password" placeholder="Password" />
          <Input type="number" placeholder="Number" />
        </div>
      </div>

      {/* Form Group Example */}
      <div className="debug-group">
        <CardTitle>Form Group Example</CardTitle>
        <code className="debug-code">
          {'<Label htmlFor="email">Email</Label>\n<Input id="email" ... />'}
        </code>

        <div className="debug-column" style={{ gap: '1rem' }}>
          <div className="debug-form-group">
            <Label htmlFor="demo-email">Email</Label>
            <Input
              id="demo-email"
              type="email"
              inputSize="md"
              fullWidth
              placeholder="you@example.com"
            />
            <Hint>We'll never share your email.</Hint>
          </div>

          <div className="debug-form-group">
            <Label htmlFor="demo-password">Password</Label>
            <Input
              id="demo-password"
              type="password"
              inputSize="md"
              fullWidth
              placeholder="••••••••"
            />
          </div>

          <Button variant="primary" fullWidth>
            Sign In
          </Button>
        </div>
      </div>
    </section>
  );
}

function UIComponentsSection() {
  const [toggleValue, setToggleValue] = React.useState('month');
  const [tabValue, setTabValue] = React.useState('holdings');
  const [bottomSheetOpen, setBottomSheetOpen] = React.useState(false);

  return (
    <section className="debug-section" id="ui">
      <SectionTitle>UI Controls</SectionTitle>

      {/* ToggleGroup */}
      <div className="debug-group">
        <CardTitle>{'<ToggleGroup>'}</CardTitle>
        <code className="debug-code">
          {'<ToggleGroup value={value} onChange={setValue} options={[...]} />'}
        </code>
        <div className="debug-row">
          <ToggleGroup
            value={toggleValue}
            onChange={setToggleValue}
            options={[
              { value: 'week', label: '1W' },
              { value: 'month', label: '1M' },
              { value: 'quarter', label: '3M' },
              { value: 'year', label: '1Y' },
            ]}
          />
        </div>
        <Description size="sm">
          For switching between time ranges, view modes, etc.
        </Description>
      </div>

      {/* Tabs */}
      <div className="debug-group">
        <CardTitle>{'<Tabs>'}</CardTitle>
        <code className="debug-code">
          {'<Tabs value={value} onChange={setValue} options={[...]} />'}
        </code>
        <div className="debug-row">
          <Tabs
            value={tabValue}
            onChange={setTabValue}
            options={[
              { value: 'holdings', label: 'Holdings' },
              { value: 'analysis', label: 'Analysis' },
              { value: 'news', label: 'News' },
            ]}
          />
        </div>
        <Description size="sm">
          For page navigation or content switching.
        </Description>
      </div>

      {/* LoadingSpinner */}
      <div className="debug-group">
        <CardTitle>{'<LoadingSpinner>'}</CardTitle>
        <code className="debug-code">
          {'<LoadingSpinner size="md" text="Loading..." />'}
        </code>
        <div className="debug-row" style={{ gap: '2rem' }}>
          <div style={{ textAlign: 'center' }}>
            <LoadingSpinner size="sm" />
            <Caption>sm</Caption>
          </div>
          <div style={{ textAlign: 'center' }}>
            <LoadingSpinner size="md" />
            <Caption>md</Caption>
          </div>
          <div style={{ textAlign: 'center' }}>
            <LoadingSpinner size="lg" />
            <Caption>lg</Caption>
          </div>
        </div>
        <div className="debug-row">
          <LoadingSpinner size="sm" text="Loading data..." />
        </div>
      </div>

      {/* InfoTooltip */}
      <div className="debug-group">
        <CardTitle>{'<InfoTooltip>'}</CardTitle>
        <code className="debug-code">
          {'<InfoTooltip text="Explanation text" />'}
        </code>
        <div
          className="debug-row"
          style={{ alignItems: 'center', gap: '1rem' }}
        >
          <span
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Text>Simple text</Text>
            <InfoTooltip text="This is a simple tooltip explanation." />
          </span>
          <span
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Text>Rich content</Text>
            <InfoTooltip>
              <p>
                <strong>RSI (Relative Strength Index)</strong>
              </p>
              <p>Hodnota 0-100. Pod 30 = přeprodaná akcie.</p>
            </InfoTooltip>
          </span>
        </div>
        <Description size="sm">
          Tooltips use Czech text per project convention.
        </Description>
      </div>

      {/* BottomSheet + BottomSheetOption */}
      <div className="debug-group">
        <CardTitle>{'<BottomSheet> + <BottomSheetOption>'}</CardTitle>
        <code className="debug-code">
          {
            '<BottomSheet isOpen={open} onClose={close} title="Select">\n  <BottomSheetOption label="Option" onClick={...} />\n</BottomSheet>'
          }
        </code>
        <div className="debug-row">
          <Button variant="outline" onClick={() => setBottomSheetOpen(true)}>
            Open BottomSheet
          </Button>
        </div>
        <BottomSheet
          isOpen={bottomSheetOpen}
          onClose={() => setBottomSheetOpen(false)}
          title="Select Portfolio"
        >
          <div className="bottom-sheet-options">
            <BottomSheetOption
              label="Main Portfolio"
              suffix="(Default)"
              color="#3b82f6"
              selected
              onClick={() => setBottomSheetOpen(false)}
            />
            <BottomSheetOption
              label="Tech Stocks"
              color="#22c55e"
              onClick={() => setBottomSheetOpen(false)}
            />
            <BottomSheetOption
              label="Dividends"
              color="#f59e0b"
              onClick={() => setBottomSheetOpen(false)}
            />
          </div>
        </BottomSheet>
        <Description size="sm">
          Mobile-first sheet for selections. Uses BottomSheetOption for items.
        </Description>
      </div>
    </section>
  );
}

function SharedComponentsSection() {
  return (
    <section className="debug-section" id="shared">
      <SectionTitle>Shared Components (Legacy)</SectionTitle>
      <Description>
        Tyto komponenty používají vlastní span elementy. Při refactoringu by
        měly používat Typography komponenty.
      </Description>

      {/* ScoreCard */}
      <div className="debug-group">
        <CardTitle>{'<ScoreCard>'}</CardTitle>
        <code className="debug-code">
          {'<ScoreCard label="Score" value={75} showBar />'}
        </code>
        <div className="debug-row">
          <ScoreCard label="Score" value={75} />
          <ScoreCard label="With Bar" value={85} showBar />
          <ScoreCard label="Good" value={90} sentiment="positive" />
          <ScoreCard label="Bad" value={25} sentiment="negative" />
          <ScoreCard label="Empty" value={null} />
        </div>
        <div className="debug-refactor">
          <Label>Refactor plan:</Label>
          <Description>
            Interně používá <code>span.score-card-label</code> a{' '}
            <code>span.score-card-value</code>. → Nahradit za{' '}
            <code>{'<MetricLabel>'}</code> a <code>{'<MetricValue>'}</code>
          </Description>
        </div>
      </div>

      {/* MetricRow */}
      <div className="debug-group">
        <CardTitle>{'<MetricRow>'}</CardTitle>
        <code className="debug-code">
          {'<MetricRow label="P/E Ratio" value={25.4} sentiment="positive" />'}
        </code>
        <div className="debug-column">
          <MetricRow label="P/E Ratio" value={25.4} />
          <MetricRow
            label="Revenue Growth"
            value={15.2}
            suffix="%"
            sentiment="positive"
          />
          <MetricRow label="Debt/Equity" value={1.8} sentiment="negative" />
          <MetricRow label="No Data" value={null} />
        </div>
        <div className="debug-refactor">
          <Label>Refactor plan:</Label>
          <Description>
            Interně používá <code>span.metric-row-label</code> a{' '}
            <code>span.metric-row-value</code>. → Nahradit za{' '}
            <code>{'<MetricLabel>'}</code> a <code>{'<MetricValue>'}</code>
          </Description>
        </div>
      </div>

      {/* PriceDisplay */}
      <div className="debug-group">
        <CardTitle>{'<PriceDisplay>'}</CardTitle>
        <code className="debug-code">
          {'<PriceDisplay price={150.25} change={2.5} changePercent={1.7} />'}
        </code>
        <div className="debug-row">
          <PriceDisplay price={150.25} />
          <PriceDisplay price={150.25} change={2.5} changePercent={1.7} />
          <PriceDisplay price={148.0} change={-1.5} changePercent={-1.0} />
          <PriceDisplay price={null} />
        </div>
        <div className="debug-refactor">
          <Label>Refactor plan:</Label>
          <Description>
            Interně používá <code>span.price-display-value</code> a{' '}
            <code>span.price-display-change</code>. → Nahradit za{' '}
            <code>{'<MetricValue>'}</code> se sentiment prop
          </Description>
        </div>
      </div>

      {/* SignalBadge */}
      <div className="debug-group">
        <CardTitle>{'<SignalBadge>'}</CardTitle>
        <code className="debug-code">
          {'<SignalBadge type="DIP_OPPORTUNITY" />'}
        </code>
        <div className="debug-row">
          <SignalBadge type="DIP_OPPORTUNITY" />
          <SignalBadge type="MOMENTUM" />
          <SignalBadge type="CONVICTION_HOLD" />
          <SignalBadge type="CONSIDER_TRIM" />
          <SignalBadge type="NEUTRAL" />
        </div>
        <div className="debug-refactor">
          <Label>Refactor plan:</Label>
          <Description>
            Používá vlastní span s SIGNAL_CONFIG systémem. → Ponechat jako je
            (specifická logika), ale interně může používat{' '}
            <code>{'<Badge>'}</code>
          </Description>
        </div>
      </div>

      {/* EmptyState */}
      <div className="debug-group">
        <CardTitle>{'<EmptyState>'}</CardTitle>
        <code className="debug-code">
          {'<EmptyState title="No data" description="Add some stocks" />'}
        </code>
        <div
          className="debug-row"
          style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8 }}
        >
          <EmptyState
            title="No stocks yet"
            description="Add your first stock to get started"
            action={{ label: 'Add Stock', onClick: () => {} }}
          />
        </div>
        <div className="debug-refactor">
          <Label>Refactor plan:</Label>
          <Description>
            Používá <code>h3.empty-state-title</code> a{' '}
            <code>p.empty-state-description</code>. → Nahradit za{' '}
            <code>{'<CardTitle>'}</code> a <code>{'<Description>'}</code>
          </Description>
        </div>
      </div>

      {/* ErrorState */}
      <div className="debug-group">
        <CardTitle>{'<ErrorState>'}</CardTitle>
        <code className="debug-code">
          {'<ErrorState message="Failed to load" onRetry={() => {}} />'}
        </code>
        <div
          className="debug-row"
          style={{ background: '#fef2f2', padding: '1rem', borderRadius: 8 }}
        >
          <ErrorState
            message="Failed to load data. Please try again."
            onRetry={() => {}}
          />
        </div>
        <div className="debug-refactor">
          <Label>Refactor plan:</Label>
          <Description>
            Používá <code>span.error-state-icon</code> a{' '}
            <code>p.error-state-message</code>. → Nahradit za{' '}
            <code>{'<Description>'}</code> nebo novou{' '}
            <code>{'<ErrorText>'}</code>
          </Description>
        </div>
      </div>
    </section>
  );
}

export function DebugShowcase() {
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const filteredItems = activeCategory === 'all' 
    ? NAV_ITEMS 
    : NAV_ITEMS.filter(item => item.category === activeCategory);

  const categories: Category[] = ['typography', 'components', 'tokens'];

  return (
    <div className="debug-showcase">
      <header className="debug-header">
        <PageTitle>Debug Showcase</PageTitle>
        <Description>
          Design system, komponenty a další - pouze pro vývoj
        </Description>
      </header>

      {/* Category Tabs */}
      <nav className="debug-nav">
        <div className="debug-nav-tabs">
          <button 
            className={`debug-nav-tab ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              className={`debug-nav-tab ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Quick Jump */}
        <div className="debug-nav-links">
          {filteredItems.map(item => (
            <button
              key={item.id}
              className="debug-nav-link"
              onClick={() => scrollToSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="debug-content">
        {(activeCategory === 'all' || activeCategory === 'typography') && (
          <>
            <CoreTextSection />
            <HeadingsSection />
            <MetricsSection />
            <BadgesSection />
          </>
        )}
        {(activeCategory === 'all' || activeCategory === 'components') && (
          <>
            <StockSection />
            <FormComponentsSection />
            <UIComponentsSection />
            <SharedComponentsSection />
          </>
        )}
        {(activeCategory === 'all' || activeCategory === 'tokens') && (
          <>
            <ColorsSection />
            <FontSizesSection />
          </>
        )}
      </div>

      <footer className="debug-footer">
        <Hint>Made with love</Hint>
      </footer>
    </div>
  );
}

export default DebugShowcase;
