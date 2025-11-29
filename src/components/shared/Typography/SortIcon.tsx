import './Typography.css';

interface SortIconProps {
  direction: 'asc' | 'desc' | 'none';
  active?: boolean;
}

export function SortIcon({ direction, active = false }: SortIconProps) {
  const icon = direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '↕';
  const classes = ['sort-icon', active && 'sort-icon--active']
    .filter(Boolean)
    .join(' ');

  return <span className={classes}>{icon}</span>;
}
