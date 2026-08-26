import { GameText } from './game-text';
import type { MechanicBlock, MechanicNote } from '../lib/data';

type MechanicDetailsProps = {
  block: MechanicBlock;
  compact?: boolean;
};

const groups: Array<{ key: 'mechanics' | 'interactions' | 'misc'; label: string; description: string }> = [
  { key: 'mechanics', label: '机制结算', description: '触发顺序、作用范围与数值结算' },
  { key: 'interactions', label: '相互作用', description: '与技能、物品和状态效果的交互' },
  { key: 'misc', label: '补充规则', description: '边界条件与特殊情况' },
];

function MechanicList({ notes }: { notes: MechanicNote[] }) {
  return <ol className="mechanic-note-list">{notes.map((note, index) => {
    const reviewed = note.translationStatus === 'reviewed';
    const displayText = reviewed ? note.text : note.original;
    return <li className={`mechanic-note indent-${Math.min(4, Math.max(1, note.indent || 1))}${reviewed ? ' is-reviewed' : ' is-source-fallback'}`} key={`${note.original}:${index}`}>
      {!reviewed && <small className="mechanic-source-label">英文原文</small>}
      <GameText text={displayText} />
    </li>;
  })}</ol>;
}

export function MechanicDetails({ block, compact = false }: MechanicDetailsProps) {
  const available = groups.filter((group) => block[group.key]?.length);
  if (!available.length) return null;
  return (
    <details className={`mechanic-details${compact ? ' is-compact' : ''}`}>
      <summary><span>机制与相互作用</span><small>{available.reduce((sum, group) => sum + block[group.key].length, 0)} 条可核对说明</small></summary>
      <div className="mechanic-details-body">
        {available.map((group) => <section className={`mechanic-group is-${group.key}`} key={group.key}>
          <header><strong>{group.label}</strong><small>{group.description}</small></header>
          <MechanicList notes={block[group.key]} />
        </section>)}
      </div>
    </details>
  );
}
