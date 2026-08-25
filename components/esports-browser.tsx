'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { EsportsPlayer, EsportsTeam, EsportsTransfer, TransferTeam } from '../lib/data';

const regionLabels: Record<string, string> = {
  Americas: '美洲',
  Europe: '欧洲与独联体',
  China: '中国',
  'Southeast Asia': '东南亚',
};

const subregionLabels: Record<string, string> = {
  'North America': '北美',
  'South America': '南美',
  'Western Europe': '西欧',
  'Eastern Europe & CIS': '东欧与独联体',
};

const roleLabels: Record<string, string> = {
  Captain: '队长',
  Coach: '教练',
  Analyst: '分析师',
  Manager: '经理',
  CEO: '负责人',
  Sub: '替补',
  Inactive: '非活跃',
  'Sporting Director': '竞技主管',
};

function roleLabel(value: string) {
  return roleLabels[value] || value || '正式成员';
}

function playerIdentityLabel(player: EsportsPlayer) {
  return { Player: '选手', Coach: '教练', Retired: '退役', Inactive: '非活跃' }[player.identity] || '选手';
}

function playerPositionLabel(player: EsportsPlayer) {
  if (player.identity === 'Coach') return 'Coach';
  return { 1: 'Carry · 1', 2: 'Solo Mid · 2', 3: 'Offlane · 3', 4: 'Support · 4', 5: 'Support · 5' }[player.position] || '待确认';
}

function regionLabel(region: string, subregion = '') {
  return subregionLabels[subregion] || regionLabels[region] || subregion || region || '地区待确认';
}

function SnapshotStatus({ generatedAt }: { generatedAt: string }) {
  return (
    <div className="esports-snapshot">
      <span className="status-dot" />
      <span><strong>Liquipedia 快照已同步</strong><small>{new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(generatedAt))}</small></span>
    </div>
  );
}

function TeamMark({ team, size = 'normal' }: { team: Pick<EsportsTeam, 'name' | 'logo'> | TransferTeam; size?: 'normal' | 'small' }) {
  return team.logo
    ? <img className={`team-mark ${size === 'small' ? 'is-small' : ''}`} src={team.logo} alt={`${team.name} 战队 Logo`} />
    : <span className={`team-mark fallback ${size === 'small' ? 'is-small' : ''}`} aria-hidden="true">{team.name.slice(0, 2).toUpperCase()}</span>;
}

function CountryFlag({ player }: { player: Pick<EsportsPlayer, 'name' | 'country' | 'flag'> }) {
  return player.flag
    ? <img className="country-flag" src={player.flag} alt={`${player.country}国籍旗帜`} title={player.country} />
    : <span className="country-flag fallback" title={player.country || '国籍待确认'} aria-hidden="true">•</span>;
}

function PageIntro({ eyebrow, title, copy, stats, generatedAt }: { eyebrow: string; title: string; copy: string; stats: Array<[string, string | number]>; generatedAt: string }) {
  return (
    <header className="esports-intro">
      <div>
        <p className="eyebrow accent">{eyebrow}</p>
        <h1>{title}</h1>
        {copy && <p>{copy}</p>}
      </div>
      <div className="esports-intro-meta">
        <div>{stats.map(([label, value]) => <span key={label}><strong>{value}</strong><small>{label}</small></span>)}</div>
        <SnapshotStatus generatedAt={generatedAt} />
      </div>
    </header>
  );
}

export function PlayersBrowser({ players, teams, transfers, generatedAt }: { players: EsportsPlayer[]; teams: EsportsTeam[]; transfers: EsportsTransfer[]; generatedAt: string }) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [membership, setMembership] = useState<'all' | 'current' | 'unattached'>('all');
  const teamsBySlug = useMemo(() => new Map(teams.map((team) => [team.slug, team])), [teams]);
  const latestMove = useMemo(() => {
    const result = new Map<string, EsportsTransfer>();
    for (const transfer of transfers) for (const player of transfer.players) if (!result.has(player.slug)) result.set(player.slug, transfer);
    return result;
  }, [transfers]);
  const regions = useMemo(() => [...new Set(players.map((player) => player.region).filter(Boolean))], [players]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('en');
    return players.filter((player) => {
      if (region && player.region !== region) return false;
      if (membership === 'current' && !player.teamSlug) return false;
      if (membership === 'unattached' && player.teamSlug) return false;
      return !needle || `${player.name} ${player.realName} ${player.country} ${player.teamName}`.toLocaleLowerCase('en').includes(needle);
    });
  }, [membership, players, query, region]);

  return (
    <article className="esports-page">
      <PageIntro eyebrow="Players" title="职业选手" copy="选手 ID 与战队名称保持原文；身份、当前司职位置、TI 参赛次数和转会记录来自 Liquipedia。" stats={[["收录选手", players.length], ["当前阵容", players.filter((player) => player.teamSlug).length], ["位置已核验", players.filter((player) => player.position >= 1 && player.position <= 5).length]]} generatedAt={generatedAt} />
      <Link className="friberg-promo" href="/friberg"><span>NEW · 单人模式</span><strong>用这些选手资料来玩一局 DOTA 2 弗一把</strong><b>8 次机会，开始猜测 →</b></Link>
      <div className="esports-toolbar">
        <label className="catalog-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 ID、实名、国籍或战队" /></label>
        <select value={region} onChange={(event) => setRegion(event.target.value)} aria-label="按赛区筛选"><option value="">全部赛区</option>{regions.map((item) => <option value={item} key={item}>{regionLabels[item] || item}</option>)}</select>
        <div className="esports-segmented" role="group" aria-label="按阵容状态筛选">
          {([['all', '全部'], ['current', '当前阵容'], ['unattached', '近期流动']] as const).map(([value, label]) => <button className={membership === value ? 'is-active' : ''} type="button" onClick={() => setMembership(value)} key={value}>{label}</button>)}
        </div>
        <span className="esports-result-count"><strong>{filtered.length}</strong> / {players.length}</span>
      </div>
      <div className="player-grid">
        {filtered.map((player) => {
          const team = teamsBySlug.get(player.teamSlug);
          const move = latestMove.get(player.slug);
          return (
            <article className="player-card" id={`player-${player.slug}`} key={player.slug}>
              <header>
                <CountryFlag player={player} />
                <div><h2>{player.name}</h2><p>{player.realName || '实名资料待补充'}</p></div>
                <a className="external-mark" href={player.profileUrl} target="_blank" rel="noreferrer" aria-label={`在 Liquipedia 查看 ${player.name}`}>↗</a>
              </header>
              <dl>
                <div><dt>国籍</dt><dd>{player.country || '待确认'}</dd></div>
                <div><dt>身份</dt><dd>{playerIdentityLabel(player)}</dd></div>
                <div><dt>位置</dt><dd>{playerPositionLabel(player)}</dd></div>
                <div><dt>TI</dt><dd>{player.tiAppearances} 次</dd></div>
              </dl>
              <div className="player-team-row">
                {team ? <><TeamMark team={team} size="small" /><Link href={`/teams#team-${team.slug}`}><small>当前战队</small><strong>{team.name}</strong></Link></> : <><span className="team-mark is-small fallback">—</span><span><small>当前战队</small><strong>暂无公开归属</strong></span></>}
              </div>
              {move && <Link className="recent-move" href={`/transfers#transfer-${move.id}`}><span>{move.date}</span>查看近期转会记录 →</Link>}
            </article>
          );
        })}
      </div>
    </article>
  );
}

export function TeamsBrowser({ players, teams, transfers, generatedAt }: { players: EsportsPlayer[]; teams: EsportsTeam[]; transfers: EsportsTransfer[]; generatedAt: string }) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const playersBySlug = useMemo(() => new Map(players.map((player) => [player.slug, player])), [players]);
  const regions = useMemo(() => [...new Set(teams.map((team) => team.region).filter(Boolean))], [teams]);
  const transferCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const transfer of transfers) for (const team of [...transfer.from, ...transfer.to]) counts.set(team.slug, (counts.get(team.slug) || 0) + 1);
    return counts;
  }, [transfers]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('en');
    return teams.filter((team) => {
      if (activeOnly && !team.roster.length) return false;
      if (region && team.region !== region) return false;
      return !needle || `${team.name} ${team.region} ${team.subregion} ${team.roster.map((slug) => playersBySlug.get(slug)?.name || '').join(' ')}`.toLocaleLowerCase('en').includes(needle);
    });
  }, [activeOnly, playersBySlug, query, region, teams]);

  return (
    <article className="esports-page">
      <PageIntro eyebrow="Teams" title="职业战队" copy="" stats={[["当前战队", teams.filter((team) => team.roster.length).length], ["阵容成员", players.filter((player) => player.teamSlug).length], ["赛区", regions.length]]} generatedAt={generatedAt} />
      <div className="esports-toolbar">
        <label className="catalog-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索战队或阵容成员" /></label>
        <select value={region} onChange={(event) => setRegion(event.target.value)} aria-label="按赛区筛选"><option value="">全部赛区</option>{regions.map((item) => <option value={item} key={item}>{regionLabels[item] || item}</option>)}</select>
        <label className="active-team-toggle"><input type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} />仅显示当前阵容</label>
        <span className="esports-result-count"><strong>{filtered.length}</strong> / {teams.length}</span>
      </div>
      <div className="team-grid">
        {filtered.map((team) => (
          <article className="team-card" id={`team-${team.slug}`} key={team.slug}>
            <header><TeamMark team={team} /><div><p>{regionLabel(team.region, team.subregion)}</p><h2>{team.name}</h2></div><a className="external-mark" href={team.sourceUrl} target="_blank" rel="noreferrer" aria-label={`在 Liquipedia 查看 ${team.name}`}>↗</a></header>
            <div className="roster-list">
              {team.roster.map((slug) => {
                const player = playersBySlug.get(slug);
                if (!player) return null;
                return <Link href={`/players#player-${player.slug}`} key={slug}><CountryFlag player={player} /><span><strong>{player.name}</strong><small>{roleLabel(player.role)}</small></span><b>→</b></Link>;
              })}
              {!team.roster.length && <p className="empty-roster">当前门户暂无公开阵容。</p>}
            </div>
            <footer><span>{team.roster.length} 名当前成员</span><Link href={`/transfers?team=${team.slug}`}>{transferCounts.get(team.slug) || 0} 条近期流动 →</Link></footer>
          </article>
        ))}
      </div>
    </article>
  );
}

function TransferTeamList({ teams, empty }: { teams: TransferTeam[]; empty: string }) {
  if (!teams.length) return <span className="transfer-none">{empty}</span>;
  return <div className="transfer-team-list">{teams.map((team) => <Link href={`/teams#team-${team.slug}`} key={team.slug}><TeamMark team={team} size="small" /><strong>{team.name}</strong></Link>)}</div>;
}

export function TransfersBrowser({ transfers, teams, generatedAt }: { transfers: EsportsTransfer[]; teams: EsportsTeam[]; generatedAt: string }) {
  const [query, setQuery] = useState('');
  const [team, setTeam] = useState('');
  useEffect(() => {
    const selectedTeam = new URLSearchParams(window.location.search).get('team') || '';
    queueMicrotask(() => setTeam(selectedTeam));
  }, []);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('en');
    return transfers.filter((transfer) => {
      const allTeams = [...transfer.from, ...transfer.to];
      if (team && !allTeams.some((item) => item.slug === team)) return false;
      const haystack = `${transfer.players.map((player) => `${player.name} ${player.country}`).join(' ')} ${allTeams.map((item) => item.name).join(' ')}`.toLocaleLowerCase('en');
      return !needle || haystack.includes(needle);
    });
  }, [query, team, transfers]);

  return (
    <article className="esports-page">
      <PageIntro eyebrow="Transfers" title="近期转会" copy="" stats={[["近期记录", transfers.length], ["涉及选手", new Set(transfers.flatMap((transfer) => transfer.players.map((player) => player.slug))).size], ["最新日期", transfers[0]?.date || '—']]} generatedAt={generatedAt} />
      <div className="esports-toolbar">
        <label className="catalog-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索选手、国籍或战队" /></label>
        <select value={team} onChange={(event) => setTeam(event.target.value)} aria-label="按战队筛选"><option value="">全部战队</option>{teams.map((item) => <option value={item.slug} key={item.slug}>{item.name}</option>)}</select>
        <span className="esports-result-count"><strong>{filtered.length}</strong> / {transfers.length}</span>
      </div>
      <div className="transfer-list">
        {filtered.map((transfer) => (
          <article className="transfer-card" id={`transfer-${transfer.id}`} key={transfer.id}>
            <time>{transfer.date}</time>
            <div className="transfer-players">
              {transfer.players.map((player) => <Link href={`/players#player-${player.slug}`} key={player.slug}><CountryFlag player={player as EsportsPlayer} /><span><strong>{player.name}</strong><small>{player.country || '国籍待确认'}</small></span></Link>)}
            </div>
            <div className="transfer-route">
              <div><small>原战队</small><TransferTeamList teams={transfer.from} empty="无 / 已离队" />{transfer.fromStatus.map((status) => <em key={status}>{roleLabel(status)}</em>)}</div>
              <b aria-hidden="true">→</b>
              <div><small>新战队</small><TransferTeamList teams={transfer.to} empty="无 / 待公布" />{transfer.toStatus.map((status) => <em key={status}>{roleLabel(status)}</em>)}</div>
            </div>
            {transfer.referenceUrl && <a className="transfer-reference" href={transfer.referenceUrl} target="_blank" rel="noreferrer">原始公告 / 参考来源 ↗</a>}
          </article>
        ))}
      </div>
    </article>
  );
}
