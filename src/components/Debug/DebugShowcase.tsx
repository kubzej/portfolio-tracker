import { useState } from 'react';
import {
  // Typography
  Text,
  Label,
  Title,
  Caption,
  Muted,
  Description,
  Hint,
  Subtext,
  PageTitle,
  SectionTitle,
  CardTitle,
  Ticker,
  StockName,
  MetricLabel,
  MetricValue,
  Badge,
  Tag,
  Count,
  RecItem,
  SortIcon,
} from '@/components/shared/Typography';
import { Button } from '@/components/shared/Button';
import { Input, TextArea } from '@/components/shared/Input';
import { Tabs } from '@/components/shared/Tabs';
import { Modal } from '@/components/shared/Modal';
import {
  BottomSheet,
  BottomSheetOption,
  BottomSheetSelect,
} from '@/components/shared/BottomSheet';
import {
  ActionSheet,
  ActionSheetOption,
} from '@/components/shared/ActionSheet';
import { ToggleGroup } from '@/components/shared/ToggleGroup';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { MetricCard } from '@/components/shared/MetricCard';
import { MetricRow } from '@/components/shared/MetricRow';
import { ScoreCard } from '@/components/shared/ScoreCard';
import { PriceDisplay } from '@/components/shared/PriceDisplay';
import { SignalBadge } from '@/components/shared/SignalBadge';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import {
  TimeRangeSelector,
  TIME_RANGES_SHORT,
} from '@/components/shared/TimeRangeSelector';
import type { TimeRange } from '@/components/shared/TimeRangeSelector';
import { ChartSection, ChartNoData } from '@/components/shared/ChartSection';
import { StockCard } from '@/components/shared/StockCard';
import {
  TrendSignal,
  MACard,
  MACardsRow,
} from '@/components/shared/TrendSignal';
import {
  IndicatorValue,
  IndicatorValuesRow,
  IndicatorSignal,
  ZoneBadge,
  ZonesRow,
} from '@/components/shared/IndicatorValue';
import { EditIcon, TrashIcon } from '@/components/shared/Icons';
import './DebugShowcase.css';

type Section =
  | 'typography'
  | 'buttons'
  | 'inputs'
  | 'badges'
  | 'cards'
  | 'feedback'
  | 'navigation'
  | 'modals'
  | 'charts'
  | 'icons';

const SECTIONS: { value: Section; label: string }[] = [
  { value: 'typography', label: 'Typography' },
  { value: 'buttons', label: 'Buttons' },
  { value: 'inputs', label: 'Inputs' },
  { value: 'badges', label: 'Badges' },
  { value: 'cards', label: 'Cards' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'navigation', label: 'Navigation' },
  { value: 'modals', label: 'Modals' },
  { value: 'charts', label: 'Charts' },
  { value: 'icons', label: 'Icons' },
];

export function DebugShowcase() {
  const [activeSection, setActiveSection] = useState<Section>('typography');
  const [modalOpen, setModalOpen] = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('1M');
  const [toggleValue, setToggleValue] = useState('all');
  const [tabValue, setTabValue] = useState('tab1');
  const [selectValue, setSelectValue] = useState('option1');
  const [inputValue, setInputValue] = useState('');

  const renderSection = () => {
    switch (activeSection) {
      case 'typography':
        return <TypographySection />;
      case 'buttons':
        return <ButtonsSection />;
      case 'inputs':
        return (
          <InputsSection
            inputValue={inputValue}
            setInputValue={setInputValue}
          />
        );
      case 'badges':
        return <BadgesSection />;
      case 'cards':
        return <CardsSection />;
      case 'feedback':
        return <FeedbackSection />;
      case 'navigation':
        return (
          <NavigationSection
            tabValue={tabValue}
            setTabValue={setTabValue}
            toggleValue={toggleValue}
            setToggleValue={setToggleValue}
            selectedTimeRange={selectedTimeRange}
            setSelectedTimeRange={setSelectedTimeRange}
            selectValue={selectValue}
            setSelectValue={setSelectValue}
          />
        );
      case 'modals':
        return (
          <ModalsSection
            modalOpen={modalOpen}
            setModalOpen={setModalOpen}
            bottomSheetOpen={bottomSheetOpen}
            setBottomSheetOpen={setBottomSheetOpen}
            actionSheetOpen={actionSheetOpen}
            setActionSheetOpen={setActionSheetOpen}
          />
        );
      case 'charts':
        return <ChartsSection />;
      case 'icons':
        return <IconsSection />;
      default:
        return null;
    }
  };

  return (
    <div className="debug-showcase">
      <div className="debug-showcase__header">
        <PageTitle>Component Showcase</PageTitle>
        <Description>
          Debug screen for all shared UI components with their variants and use
          cases.
        </Description>
      </div>

      <nav className="debug-showcase__nav">
        {SECTIONS.map((section) => (
          <Button
            key={section.value}
            variant={activeSection === section.value ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveSection(section.value)}
          >
            {section.label}
          </Button>
        ))}
      </nav>

      <div className="debug-showcase__content">{renderSection()}</div>
    </div>
  );
}

// ============================================
// TYPOGRAPHY SECTION
// ============================================
function TypographySection() {
  return (
    <div className="debug-section">
      <SectionTitle>Typography</SectionTitle>

      {/* Page Titles */}
      <div className="debug-subsection">
        <CardTitle>Page Titles</CardTitle>
        <div className="debug-showcase-row">
          <PageTitle>PageTitle - Main page heading</PageTitle>
        </div>
        <div className="debug-showcase-row">
          <SectionTitle>SectionTitle - Section heading</SectionTitle>
        </div>
        <div className="debug-showcase-row">
          <CardTitle>CardTitle - Card/panel heading</CardTitle>
        </div>
      </div>

      {/* Title variants */}
      <div className="debug-subsection">
        <CardTitle>Title Sizes</CardTitle>
        <div className="debug-showcase-grid">
          <Title size="sm">Title sm</Title>
          <Title size="base">Title base</Title>
          <Title size="lg">Title lg</Title>
          <Title size="xl">Title xl</Title>
          <Title size="2xl">Title 2xl</Title>
        </div>
      </div>

      {/* Text component */}
      <div className="debug-subsection">
        <CardTitle>Text Component</CardTitle>
        <div className="debug-showcase-grid">
          <Text size="xs">Text xs</Text>
          <Text size="sm">Text sm</Text>
          <Text size="base">Text base</Text>
          <Text size="lg">Text lg</Text>
        </div>
        <div className="debug-showcase-grid">
          <Text weight="normal">weight: normal</Text>
          <Text weight="medium">weight: medium</Text>
          <Text weight="semibold">weight: semibold</Text>
          <Text weight="bold">weight: bold</Text>
        </div>
        <div className="debug-showcase-grid">
          <Text color="primary">color: primary</Text>
          <Text color="secondary">color: secondary</Text>
          <Text color="muted">color: muted</Text>
          <Text color="success">color: success</Text>
          <Text color="danger">color: danger</Text>
        </div>
      </div>

      {/* Stock-specific */}
      <div className="debug-subsection">
        <CardTitle>Stock Typography</CardTitle>
        <div className="debug-showcase-grid">
          <div>
            <MetricLabel>Ticker</MetricLabel>
            <Ticker size="sm">AAPL</Ticker>
            <Ticker size="base">AAPL</Ticker>
            <Ticker size="lg">AAPL</Ticker>
          </div>
          <div>
            <MetricLabel>StockName</MetricLabel>
            <StockName size="sm">Apple Inc.</StockName>
            <StockName size="base">Apple Inc.</StockName>
            <StockName size="lg" truncate>
              Apple Inc. - Very Long Company Name That Should Truncate
            </StockName>
          </div>
        </div>
      </div>

      {/* Metric typography */}
      <div className="debug-subsection">
        <CardTitle>Metric Typography</CardTitle>
        <div className="debug-showcase-grid">
          <div>
            <MetricLabel>METRIC LABEL</MetricLabel>
          </div>
          <div>
            <MetricValue>1,234.56</MetricValue>
          </div>
          <div>
            <MetricValue sentiment="positive">+12.5%</MetricValue>
          </div>
          <div>
            <MetricValue sentiment="negative">-8.3%</MetricValue>
          </div>
          <div>
            <MetricValue size="sm">Small</MetricValue>
            <MetricValue size="base">Base</MetricValue>
            <MetricValue size="lg">Large</MetricValue>
          </div>
        </div>
      </div>

      {/* Labels and helpers */}
      <div className="debug-subsection">
        <CardTitle>Labels & Helper Text</CardTitle>
        <div className="debug-showcase-grid">
          <div>
            <Label size="sm">Label sm</Label>
            <Label size="base">Label base</Label>
          </div>
          <div>
            <Caption>Caption text</Caption>
          </div>
          <div>
            <Muted>Muted / N/A text</Muted>
          </div>
          <div>
            <Description>
              Description paragraph text for explanations.
            </Description>
          </div>
          <div>
            <Hint>Hint text for form fields</Hint>
          </div>
          <div>
            <Subtext>/ 100 points</Subtext>
          </div>
        </div>
      </div>

      {/* Recommendation items */}
      <div className="debug-subsection">
        <CardTitle>RecItem (Analyst Recommendations)</CardTitle>
        <div className="debug-showcase-row">
          <RecItem variant="buy">Buy: 15</RecItem>
          <RecItem variant="hold">Hold: 8</RecItem>
          <RecItem variant="sell">Sell: 2</RecItem>
        </div>
      </div>

      {/* Count */}
      <div className="debug-subsection">
        <CardTitle>Count</CardTitle>
        <div className="debug-showcase-row">
          <Text>Notifications</Text>
          <Count>5</Count>
          <Text>Messages</Text>
          <Count>99+</Count>
        </div>
      </div>

      {/* Sort Icon */}
      <div className="debug-subsection">
        <CardTitle>SortIcon</CardTitle>
        <div className="debug-showcase-row">
          <Text>Name</Text>
          <SortIcon direction="asc" />
          <Text>Price</Text>
          <SortIcon direction="desc" />
          <Text>Change</Text>
          <SortIcon direction="none" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// BUTTONS SECTION
// ============================================
function ButtonsSection() {
  return (
    <div className="debug-section">
      <SectionTitle>Buttons</SectionTitle>

      {/* Variants */}
      <div className="debug-subsection">
        <CardTitle>Variants</CardTitle>
        <div className="debug-showcase-row">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="success">Success</Button>
        </div>
      </div>

      {/* Sizes */}
      <div className="debug-subsection">
        <CardTitle>Sizes</CardTitle>
        <div className="debug-showcase-row">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </div>

      {/* States */}
      <div className="debug-subsection">
        <CardTitle>States</CardTitle>
        <div className="debug-showcase-row">
          <Button variant="primary">Normal</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button variant="ghost" isActive>
            Active (isActive)
          </Button>
        </div>
      </div>

      {/* Icon buttons */}
      <div className="debug-subsection">
        <CardTitle>Icon Buttons</CardTitle>
        <div className="debug-showcase-row">
          <Button variant="ghost" size="sm" icon>
            <EditIcon size={16} />
          </Button>
          <Button variant="ghost" size="sm" icon>
            <TrashIcon size={16} />
          </Button>
          <Button variant="danger" size="sm" icon>
            ×
          </Button>
        </div>
      </div>

      {/* Full width */}
      <div className="debug-subsection">
        <CardTitle>Full Width</CardTitle>
        <Button variant="primary" fullWidth>
          Full Width Button
        </Button>
      </div>
    </div>
  );
}

// ============================================
// INPUTS SECTION
// ============================================
function InputsSection({
  inputValue,
  setInputValue,
}: {
  inputValue: string;
  setInputValue: (v: string) => void;
}) {
  return (
    <div className="debug-section">
      <SectionTitle>Inputs</SectionTitle>

      {/* Input sizes */}
      <div className="debug-subsection">
        <CardTitle>Input Sizes</CardTitle>
        <div className="debug-showcase-grid">
          <div>
            <Label htmlFor="input-sm">Small</Label>
            <Input
              id="input-sm"
              inputSize="sm"
              placeholder="Small input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="input-md">Medium</Label>
            <Input
              id="input-md"
              inputSize="md"
              placeholder="Medium input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="input-lg">Large</Label>
            <Input
              id="input-lg"
              inputSize="lg"
              placeholder="Large input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Input states */}
      <div className="debug-subsection">
        <CardTitle>Input States</CardTitle>
        <div className="debug-showcase-grid">
          <div>
            <Label htmlFor="input-normal">Normal</Label>
            <Input id="input-normal" placeholder="Normal input" />
            <Hint>This is a hint text</Hint>
          </div>
          <div>
            <Label htmlFor="input-error">Error</Label>
            <Input id="input-error" placeholder="Error input" error />
            <Hint>
              <Text color="danger">This field is required</Text>
            </Hint>
          </div>
          <div>
            <Label htmlFor="input-disabled">Disabled</Label>
            <Input id="input-disabled" placeholder="Disabled" disabled />
          </div>
        </div>
      </div>

      {/* Full width */}
      <div className="debug-subsection">
        <CardTitle>Full Width</CardTitle>
        <Label htmlFor="input-full">Full Width Input</Label>
        <Input id="input-full" placeholder="Full width input" fullWidth />
      </div>

      {/* TextArea */}
      <div className="debug-subsection">
        <CardTitle>TextArea</CardTitle>
        <div className="debug-showcase-grid">
          <div>
            <Label htmlFor="textarea-sm">Small</Label>
            <TextArea
              id="textarea-sm"
              inputSize="sm"
              placeholder="Small textarea"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="textarea-md">Medium</Label>
            <TextArea
              id="textarea-md"
              inputSize="md"
              placeholder="Medium textarea"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="textarea-lg">Large</Label>
            <TextArea
              id="textarea-lg"
              inputSize="lg"
              placeholder="Large textarea"
              rows={3}
            />
          </div>
        </div>
        <div className="debug-showcase-grid">
          <div>
            <Label htmlFor="textarea-error">With Error</Label>
            <TextArea
              id="textarea-error"
              placeholder="Error state"
              error
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="textarea-full">Full Width</Label>
            <TextArea
              id="textarea-full"
              placeholder="Full width"
              fullWidth
              rows={2}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// BADGES SECTION
// ============================================
function BadgesSection() {
  return (
    <div className="debug-section">
      <SectionTitle>Badges & Tags</SectionTitle>

      {/* Badge - Recommendation variants */}
      <div className="debug-subsection">
        <CardTitle>Badge - Recommendations</CardTitle>
        <div className="debug-showcase-row">
          <Badge variant="buy">Buy</Badge>
          <Badge variant="sell">Sell</Badge>
          <Badge variant="hold">Hold</Badge>
        </div>
      </div>

      {/* Badge - Sentiment variants */}
      <div className="debug-subsection">
        <CardTitle>Badge - Sentiment</CardTitle>
        <div className="debug-showcase-row">
          <Badge variant="positive">Positive</Badge>
          <Badge variant="negative">Negative</Badge>
          <Badge variant="neutral">Neutral</Badge>
        </div>
      </div>

      {/* Badge - Status variants */}
      <div className="debug-subsection">
        <CardTitle>Badge - Status</CardTitle>
        <div className="debug-showcase-row">
          <Badge variant="info">Info</Badge>
          <Badge variant="warning">Warning</Badge>
        </div>
      </div>

      {/* Badge - Signal variants */}
      <div className="debug-subsection">
        <CardTitle>Badge - Signals</CardTitle>
        <div className="debug-showcase-row">
          <Badge variant="dip">DIP</Badge>
          <Badge variant="momentum">Momentum</Badge>
          <Badge variant="conviction">Conviction</Badge>
          <Badge variant="target">Target</Badge>
          <Badge variant="trim">Trim</Badge>
          <Badge variant="watch">Watch</Badge>
          <Badge variant="accumulate">Accumulate</Badge>
        </div>
      </div>

      {/* Badge sizes */}
      <div className="debug-subsection">
        <CardTitle>Badge Sizes</CardTitle>
        <div className="debug-showcase-row">
          <Badge variant="buy" size="xs">
            XS
          </Badge>
          <Badge variant="buy" size="sm">
            SM
          </Badge>
          <Badge variant="buy" size="base">
            Base
          </Badge>
          <Badge variant="buy" size="lg">
            LG
          </Badge>
        </div>
      </div>

      {/* SignalBadge */}
      <div className="debug-subsection">
        <CardTitle>SignalBadge (with tooltips)</CardTitle>
        <div className="debug-showcase-row">
          <SignalBadge type="DIP_OPPORTUNITY" size="md" showTooltip />
          <SignalBadge type="MOMENTUM" size="md" showTooltip />
          <SignalBadge type="CONVICTION_HOLD" size="md" showTooltip />
          <SignalBadge type="NEAR_TARGET" size="md" showTooltip />
          <SignalBadge type="CONSIDER_TRIM" size="md" showTooltip />
          <SignalBadge type="WATCH_CLOSELY" size="md" showTooltip />
          <SignalBadge type="ACCUMULATE" size="md" showTooltip />
          <SignalBadge type="NEUTRAL" size="md" showTooltip />
        </div>
        <div className="debug-showcase-row">
          <SignalBadge type="DIP_OPPORTUNITY" size="sm" />
          <SignalBadge type="MOMENTUM" size="sm" />
        </div>
      </div>

      {/* Tag */}
      <div className="debug-subsection">
        <CardTitle>Tag</CardTitle>
        <div className="debug-showcase-row">
          <Tag>Default</Tag>
          <Tag variant="success">Success</Tag>
          <Tag variant="muted">Muted</Tag>
        </div>
        <div className="debug-showcase-row">
          <Tag size="xs">XS</Tag>
          <Tag size="sm">SM</Tag>
        </div>
      </div>
    </div>
  );
}

// ============================================
// CARDS SECTION
// ============================================
function CardsSection() {
  return (
    <div className="debug-section">
      <SectionTitle>Cards & Metrics</SectionTitle>

      {/* MetricCard */}
      <div className="debug-subsection">
        <CardTitle>MetricCard</CardTitle>
        <div className="debug-showcase-grid">
          <MetricCard label="P/E Ratio" value={25.4} suffix="x" />
          <MetricCard
            label="ROE"
            value={18.5}
            suffix="%"
            sentiment="positive"
          />
          <MetricCard label="Debt/Equity" value={0.85} sentiment="negative" />
          <MetricCard label="Dividend Yield" value={null} />
          <MetricCard label="With Subvalue" value={75} subValue="100" />
          <MetricCard label="With Subtext" value={85} subtext="/ 100 points" />
          <MetricCard
            label="With Tooltip"
            value={42}
            tooltip={<InfoTooltip text="**Example** | This is a tooltip" />}
          />
        </div>
      </div>

      {/* MetricCard sizes */}
      <div className="debug-subsection">
        <CardTitle>MetricCard Sizes</CardTitle>
        <div className="debug-showcase-grid">
          <MetricCard label="Small" value={100} size="sm" />
          <MetricCard label="Medium" value={100} size="md" />
          <MetricCard label="Large" value={100} size="lg" />
        </div>
      </div>

      {/* MetricRow */}
      <div className="debug-subsection">
        <CardTitle>MetricRow</CardTitle>
        <div className="debug-metric-rows">
          <MetricRow label="Market Cap" value="2.5T" />
          <MetricRow
            label="Revenue Growth"
            value={15.3}
            suffix="%"
            sentiment="positive"
          />
          <MetricRow
            label="Net Margin"
            value={-5.2}
            suffix="%"
            sentiment="negative"
          />
          <MetricRow label="Missing Data" value={null} />
          <MetricRow
            label="With Tooltip"
            value={42}
            tooltip="**Info** | Some details"
          />
        </div>
      </div>

      {/* ScoreCard */}
      <div className="debug-subsection">
        <CardTitle>ScoreCard</CardTitle>
        <div className="debug-showcase-grid">
          <ScoreCard label="Fundamental" value={75} />
          <ScoreCard label="Technical" value={45} showBar />
          <ScoreCard
            label="Auto Sentiment"
            value={82}
            showBar
            thresholds={{ good: 70, bad: 40 }}
          />
          <ScoreCard label="No Data" value={null} />
        </div>
      </div>

      {/* ScoreCard sizes */}
      <div className="debug-subsection">
        <CardTitle>ScoreCard Sizes</CardTitle>
        <div className="debug-showcase-grid">
          <ScoreCard label="Small" value={65} size="sm" showBar />
          <ScoreCard label="Medium" value={65} size="md" showBar />
          <ScoreCard label="Large" value={65} size="lg" showBar />
        </div>
      </div>

      {/* PriceDisplay */}
      <div className="debug-subsection">
        <CardTitle>PriceDisplay</CardTitle>
        <div className="debug-showcase-grid">
          <PriceDisplay
            price={185.5}
            currency="USD"
            change={2.35}
            changePercent={1.28}
          />
          <PriceDisplay
            price={185.5}
            currency="USD"
            change={-3.2}
            changePercent={-1.7}
          />
          <PriceDisplay price={1234.56} currency="EUR" showChange={false} />
          <PriceDisplay price={null} />
        </div>
      </div>

      {/* PriceDisplay sizes */}
      <div className="debug-subsection">
        <CardTitle>PriceDisplay Sizes</CardTitle>
        <div className="debug-showcase-grid">
          <PriceDisplay price={100} size="sm" changePercent={1.5} />
          <PriceDisplay price={100} size="md" changePercent={1.5} />
          <PriceDisplay price={100} size="lg" changePercent={1.5} />
        </div>
      </div>

      {/* StockCard */}
      <div className="debug-subsection">
        <CardTitle>StockCard</CardTitle>
        <div className="debug-showcase-grid">
          <StockCard
            ticker="AAPL"
            name="Apple Inc."
            exchange="NASDAQ"
            currency="USD"
            sectorName="Technology"
            targetPrice={200}
          />
          <StockCard
            ticker="TSLA"
            name="Tesla Inc."
            exchange="NASDAQ"
            currency="USD"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================
// FEEDBACK SECTION
// ============================================
function FeedbackSection() {
  return (
    <div className="debug-section">
      <SectionTitle>Feedback & States</SectionTitle>

      {/* LoadingSpinner */}
      <div className="debug-subsection">
        <CardTitle>LoadingSpinner</CardTitle>
        <div className="debug-showcase-row">
          <LoadingSpinner size="sm" />
          <LoadingSpinner size="md" />
          <LoadingSpinner size="lg" />
        </div>
        <div className="debug-showcase-row">
          <LoadingSpinner size="md" text="Loading data..." />
        </div>
      </div>

      {/* EmptyState */}
      <div className="debug-subsection">
        <CardTitle>EmptyState</CardTitle>
        <EmptyState
          title="No stocks found"
          description="Add stocks to your portfolio to see them here."
          action={{
            label: 'Add Stock',
            onClick: () => console.log('Add stock'),
          }}
        />
      </div>

      {/* ErrorState */}
      <div className="debug-subsection">
        <CardTitle>ErrorState</CardTitle>
        <ErrorState
          message="Failed to load data. Please try again."
          onRetry={() => console.log('Retry')}
        />
      </div>

      {/* InfoTooltip */}
      <div className="debug-subsection">
        <CardTitle>InfoTooltip</CardTitle>
        <div className="debug-showcase-row">
          <Text>Hover for info</Text>
          <InfoTooltip text="Simple tooltip text" />
        </div>
        <div className="debug-showcase-row">
          <Text>With formatting</Text>
          <InfoTooltip text="**Bold Title** | Description text | • Bullet point 1 | • Bullet point 2" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// NAVIGATION SECTION
// ============================================
function NavigationSection({
  tabValue,
  setTabValue,
  toggleValue,
  setToggleValue,
  selectedTimeRange,
  setSelectedTimeRange,
  selectValue,
  setSelectValue,
}: {
  tabValue: string;
  setTabValue: (v: string) => void;
  toggleValue: string;
  setToggleValue: (v: string) => void;
  selectedTimeRange: TimeRange;
  setSelectedTimeRange: (v: TimeRange) => void;
  selectValue: string;
  setSelectValue: (v: string) => void;
}) {
  return (
    <div className="debug-section">
      <SectionTitle>Navigation & Controls</SectionTitle>

      {/* Tabs */}
      <div className="debug-subsection">
        <CardTitle>Tabs</CardTitle>
        <Tabs
          value={tabValue}
          onChange={setTabValue}
          options={[
            { value: 'tab1', label: 'Overview' },
            { value: 'tab2', label: 'Analysis' },
            { value: 'tab3', label: 'News' },
          ]}
        />
      </div>

      {/* ToggleGroup - default */}
      <div className="debug-subsection">
        <CardTitle>ToggleGroup - Default</CardTitle>
        <ToggleGroup
          value={toggleValue}
          onChange={setToggleValue}
          options={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      </div>

      {/* ToggleGroup - transaction */}
      <div className="debug-subsection">
        <CardTitle>ToggleGroup - Transaction Variant</CardTitle>
        <ToggleGroup
          value={toggleValue}
          onChange={setToggleValue}
          variant="transaction"
          options={[
            { value: 'all', label: 'All' },
            { value: 'buy', label: 'Buy' },
            { value: 'sell', label: 'Sell' },
          ]}
        />
      </div>

      {/* ToggleGroup - with counts */}
      <div className="debug-subsection">
        <CardTitle>ToggleGroup - With Counts</CardTitle>
        <ToggleGroup
          value={toggleValue}
          onChange={setToggleValue}
          options={[
            { value: 'all', label: 'All', count: 25 },
            { value: 'buy', label: 'Strong Buy', count: 12, color: 'success' },
            { value: 'hold', label: 'Hold', count: 8, color: 'warning' },
            { value: 'sell', label: 'Sell', count: 0, color: 'danger' },
          ]}
          variant="signal"
          hideEmpty
        />
      </div>

      {/* ToggleGroup sizes */}
      <div className="debug-subsection">
        <CardTitle>ToggleGroup - Sizes</CardTitle>
        <div className="debug-showcase-grid">
          <ToggleGroup
            value={toggleValue}
            onChange={setToggleValue}
            size="sm"
            options={[
              { value: 'all', label: 'All' },
              { value: 'some', label: 'Some' },
            ]}
          />
          <ToggleGroup
            value={toggleValue}
            onChange={setToggleValue}
            size="md"
            options={[
              { value: 'all', label: 'All' },
              { value: 'some', label: 'Some' },
            ]}
          />
        </div>
      </div>

      {/* TimeRangeSelector */}
      <div className="debug-subsection">
        <CardTitle>TimeRangeSelector</CardTitle>
        <TimeRangeSelector
          value={selectedTimeRange}
          onChange={setSelectedTimeRange}
          ranges={TIME_RANGES_SHORT}
        />
      </div>

      {/* BottomSheetSelect */}
      <div className="debug-subsection">
        <CardTitle>
          BottomSheetSelect (desktop = native, mobile = bottom sheet)
        </CardTitle>
        <BottomSheetSelect
          value={selectValue}
          onChange={setSelectValue}
          options={[
            { value: 'option1', label: 'Option 1' },
            { value: 'option2', label: 'Option 2' },
            { value: 'option3', label: 'Option 3', color: '#22c55e' },
          ]}
          label="Select an option"
          placeholder="Choose..."
        />
      </div>
    </div>
  );
}

// ============================================
// MODALS SECTION
// ============================================
function ModalsSection({
  modalOpen,
  setModalOpen,
  bottomSheetOpen,
  setBottomSheetOpen,
  actionSheetOpen,
  setActionSheetOpen,
}: {
  modalOpen: boolean;
  setModalOpen: (v: boolean) => void;
  bottomSheetOpen: boolean;
  setBottomSheetOpen: (v: boolean) => void;
  actionSheetOpen: boolean;
  setActionSheetOpen: (v: boolean) => void;
}) {
  return (
    <div className="debug-section">
      <SectionTitle>Modals & Overlays</SectionTitle>

      {/* Modal */}
      <div className="debug-subsection">
        <CardTitle>Modal</CardTitle>
        <div className="debug-showcase-row">
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            Open Modal
          </Button>
        </div>
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Example Modal"
        >
          <Description>
            This is the modal content. You can put any content here including
            forms, lists, or other components.
          </Description>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <Button variant="primary" onClick={() => setModalOpen(false)}>
              Confirm
            </Button>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </Modal>
      </div>

      {/* ActionSheet - new optimized component */}
      <div className="debug-subsection">
        <CardTitle>ActionSheet (optimized for mobile)</CardTitle>
        <Description>
          Uses native &lt;dialog&gt; element for better mobile performance. No
          browser freeze issues.
        </Description>
        <div className="debug-showcase-row">
          <Button variant="primary" onClick={() => setActionSheetOpen(true)}>
            Open Action Sheet
          </Button>
        </div>
        <ActionSheet
          isOpen={actionSheetOpen}
          onClose={() => setActionSheetOpen(false)}
          title="Select Portfolio"
        >
          <ActionSheetOption
            label="All Portfolios"
            color="#6366f1"
            selected
            onClick={() => setActionSheetOpen(false)}
          />
          <ActionSheetOption
            label="Growth Portfolio"
            suffix="(Default)"
            color="#22c55e"
            onClick={() => setActionSheetOpen(false)}
          />
          <ActionSheetOption
            label="Dividend Portfolio"
            color="#f59e0b"
            onClick={() => setActionSheetOpen(false)}
          />
        </ActionSheet>
      </div>

      {/* BottomSheet - legacy */}
      <div className="debug-subsection">
        <CardTitle>BottomSheet (legacy)</CardTitle>
        <div className="debug-showcase-row">
          <Button variant="secondary" onClick={() => setBottomSheetOpen(true)}>
            Open Bottom Sheet
          </Button>
        </div>
        <BottomSheet
          isOpen={bottomSheetOpen}
          onClose={() => setBottomSheetOpen(false)}
          title="Select Option"
        >
          <BottomSheetOption
            label="Option 1"
            suffix="(Default)"
            selected
            onClick={() => setBottomSheetOpen(false)}
          />
          <BottomSheetOption
            label="Option 2"
            color="#22c55e"
            onClick={() => setBottomSheetOpen(false)}
          />
          <BottomSheetOption
            label="Option 3"
            onClick={() => setBottomSheetOpen(false)}
          />
        </BottomSheet>
      </div>
    </div>
  );
}

// ============================================
// CHARTS SECTION
// ============================================
function ChartsSection() {
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');

  return (
    <div className="debug-section">
      <SectionTitle>Charts & Indicators</SectionTitle>

      {/* ChartSection */}
      <div className="debug-subsection">
        <CardTitle>ChartSection</CardTitle>
        <ChartSection
          title="Price Chart"
          tooltip="**Price Chart** | Shows historical price data"
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
        >
          <div
            style={{
              height: '200px',
              background: 'var(--color-bg-secondary)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Muted>Chart placeholder</Muted>
          </div>
        </ChartSection>
      </div>

      {/* ChartNoData */}
      <div className="debug-subsection">
        <CardTitle>ChartNoData</CardTitle>
        <ChartNoData message="Not enough data to display chart" />
      </div>

      {/* TrendSignal */}
      <div className="debug-subsection">
        <CardTitle>TrendSignal</CardTitle>
        <div className="debug-showcase-grid">
          <TrendSignal
            signal="BULLISH"
            description="Strong upward momentum"
            type="bullish"
          />
          <TrendSignal
            signal="BEARISH"
            description="Downward pressure"
            type="bearish"
          />
          <TrendSignal
            signal="NEUTRAL"
            description="Consolidating"
            type="neutral"
          />
        </div>
      </div>

      {/* MACard */}
      <div className="debug-subsection">
        <CardTitle>MACard (Moving Average)</CardTitle>
        <MACardsRow>
          <MACard
            label="SMA 20"
            value={185.42}
            vsValue={2.3}
            vsLabel=" vs price"
          />
          <MACard
            label="SMA 50"
            value={182.15}
            vsValue={-1.5}
            vsLabel=" vs price"
          />
          <MACard
            label="SMA 200"
            value={175.8}
            vsValue={5.2}
            vsLabel=" vs price"
            crossSignal="golden"
          />
        </MACardsRow>
      </div>

      {/* IndicatorValue */}
      <div className="debug-subsection">
        <CardTitle>IndicatorValue</CardTitle>
        <IndicatorValuesRow>
          <IndicatorValue label="RSI" value={65} sentiment="neutral" />
          <IndicatorValue label="RSI" value={75} sentiment="overbought" />
          <IndicatorValue label="RSI" value={25} sentiment="oversold" />
          <IndicatorValue
            label="MACD"
            value="1.25"
            sentiment="positive"
            tooltip="**MACD** | Moving Average Convergence Divergence"
          />
        </IndicatorValuesRow>
      </div>

      {/* IndicatorSignal */}
      <div className="debug-subsection">
        <CardTitle>IndicatorSignal</CardTitle>
        <div className="debug-showcase-row">
          <IndicatorSignal type="bullish">Bullish</IndicatorSignal>
          <IndicatorSignal type="bearish">Bearish</IndicatorSignal>
          <IndicatorSignal type="neutral">Neutral</IndicatorSignal>
          <IndicatorSignal type="overbought">Overbought</IndicatorSignal>
          <IndicatorSignal type="oversold">Oversold</IndicatorSignal>
          <IndicatorSignal type="strong">Strong</IndicatorSignal>
          <IndicatorSignal type="weak">Weak</IndicatorSignal>
        </div>
      </div>

      {/* ZoneBadge */}
      <div className="debug-subsection">
        <CardTitle>ZoneBadge</CardTitle>
        <ZonesRow>
          <ZoneBadge type="overbought">Overbought (&gt;70)</ZoneBadge>
          <ZoneBadge type="neutral">Neutral (30-70)</ZoneBadge>
          <ZoneBadge type="oversold">Oversold (&lt;30)</ZoneBadge>
        </ZonesRow>
      </div>
    </div>
  );
}

// ============================================
// ICONS SECTION
// ============================================
function IconsSection() {
  return (
    <div className="debug-section">
      <SectionTitle>Icons</SectionTitle>

      <div className="debug-subsection">
        <CardTitle>Available Icons</CardTitle>
        <div className="debug-showcase-row">
          <div className="debug-icon-item">
            <EditIcon size={24} />
            <Caption>EditIcon</Caption>
          </div>
          <div className="debug-icon-item">
            <TrashIcon size={24} />
            <Caption>TrashIcon</Caption>
          </div>
        </div>
      </div>

      <div className="debug-subsection">
        <CardTitle>Icon Sizes</CardTitle>
        <div className="debug-showcase-row">
          <EditIcon size={12} />
          <EditIcon size={16} />
          <EditIcon size={20} />
          <EditIcon size={24} />
          <EditIcon size={32} />
        </div>
      </div>
    </div>
  );
}
