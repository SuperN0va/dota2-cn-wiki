'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { EsportsPlayer, EsportsTeam } from '../lib/data';

const MAX_GUESSES = 8;
const GAME_STORAGE_KEY = 'dota2-cn-wiki:player-guess:v1';
const STATS_STORAGE_KEY = 'dota2-cn-wiki:player-guess-stats:v1';

const regionLabels: Record<string, string> = {
  Americas: '美洲',
  Europe: '欧洲',
  China: '中国',
  'Southeast Asia': '东南亚',
};

const subregionLabels: Record<string, string> = {
  'North America': '北美',
  'South America': '南美',
  'Western Europe': '西欧',
  'Eastern Europe & CIS': '东欧与独联体',
};

const countryLabels: Record<string, string> = {
  Belarus: '白俄罗斯', Belgium: '比利时', Bolivia: '玻利维亚', Brazil: '巴西', Bulgaria: '保加利亚',
  Canada: '加拿大', China: '中国', Czechia: '捷克', Denmark: '丹麦', Ecuador: '厄瓜多尔', Estonia: '爱沙尼亚',
  Finland: '芬兰', Germany: '德国', Greece: '希腊', Indonesia: '印度尼西亚', Iran: '伊朗', Israel: '以色列',
  Jordan: '约旦', Kazakhstan: '哈萨克斯坦', Kyrgyzstan: '吉尔吉斯斯坦', Laos: '老挝', Lebanon: '黎巴嫩',
  Malaysia: '马来西亚', Moldova: '摩尔多瓦', Mongolia: '蒙古', Myanmar: '缅甸', Netherlands: '荷兰',
  Nicaragua: '尼加拉瓜', 'Non-representing': '无代表国籍', 'North Macedonia': '北马其顿', Pakistan: '巴基斯坦',
  Peru: '秘鲁', Philippines: '菲律宾', Poland: '波兰', Russia: '俄罗斯', Singapore: '新加坡', Slovakia: '斯洛伐克',
  Sweden: '瑞典', Thailand: '泰国', Turkey: '土耳其', Ukraine: '乌克兰', 'United Kingdom': '英国',
  'United States': '美国',
};

type GameStatus = 'playing' | 'won' | 'lost';
type MatchState = 'match' | 'near' | 'miss';
type Stats = { games: number; wins: number; streak: number; best: number };
type StoredGame = { targetSlug: string; guesses: string[]; status: GameStatus };
type GamePlayer = EsportsPlayer & { subregion: string; isCaptain: boolean };

const initialStats: Stats = { games: 0, wins: 0, streak: 0, best: 0 };

function pickRandom<T extends { slug: string }>(values: T[], excludedSlug = '') {
  const candidates = values.filter((value) => value.slug !== excludedSlug);
  if (!candidates.length) return values[0];
  const random = new Uint32Array(1);
  window.crypto.getRandomValues(random);
  const index = random[0] % candidates.length;
  return candidates[index];
}

function displayRegion(value: string) {
  return regionLabels[value] || value || '待确认';
}

function displaySubregion(value: string, region: string) {
  return subregionLabels[value] || regionLabels[value] || value || displayRegion(region);
}

function displayCountry(value: string) {
  return countryLabels[value] || value || '待确认';
}

function cellState(match: boolean, near = false): MatchState {
  return match ? 'match' : near ? 'near' : 'miss';
}

function FeedbackCell({ state, label, children }: { state: MatchState; label: string; children: React.ReactNode }) {
  return <div className={`guess-feedback-cell is-${state}`} data-label={label}>{children}</div>;
}

function TeamLogo({ player }: { player: GamePlayer }) {
  return player.teamLogo
    ? <img src={player.teamLogo} alt={`${player.teamName} Logo`} />
    : <span aria-hidden="true">{player.teamName.slice(0, 2).toUpperCase()}</span>;
}

function PlayerFlag({ player }: { player: GamePlayer }) {
  return player.flag
    ? <img src={player.flag} alt={`${displayCountry(player.country)}国旗`} />
    : <span aria-hidden="true">•</span>;
}

export function PlayerGuessGame({ players, teams, generatedAt }: { players: EsportsPlayer[]; teams: EsportsTeam[]; generatedAt: string }) {
  const gamePlayers = useMemo(() => {
    const teamsBySlug = new Map(teams.map((team) => [team.slug, team]));
    return players
      .filter((player) => player.teamSlug && player.teamName && player.region && player.country)
      .map((player) => ({
        ...player,
        subregion: teamsBySlug.get(player.teamSlug)?.subregion || player.region,
        isCaptain: player.role === 'Captain',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  }, [players, teams]);
  const playersBySlug = useMemo(() => new Map(gamePlayers.map((player) => [player.slug, player])), [gamePlayers]);

  const [hydrated, setHydrated] = useState(false);
  const [targetSlug, setTargetSlug] = useState('');
  const [guesses, setGuesses] = useState<string[]>([]);
  const [status, setStatus] = useState<GameStatus>('playing');
  const [stats, setStats] = useState<Stats>(initialStats);
  const [query, setQuery] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      let restored = false;
      try {
        const saved = JSON.parse(localStorage.getItem(GAME_STORAGE_KEY) || 'null') as StoredGame | null;
        if (saved && playersBySlug.has(saved.targetSlug)) {
          const validGuesses = saved.guesses.filter((slug) => playersBySlug.has(slug)).slice(0, MAX_GUESSES);
          setTargetSlug(saved.targetSlug);
          setGuesses(validGuesses);
          setStatus(saved.status === 'won' || saved.status === 'lost' ? saved.status : 'playing');
          restored = true;
        }
        const savedStats = JSON.parse(localStorage.getItem(STATS_STORAGE_KEY) || 'null') as Stats | null;
        if (savedStats && Number.isFinite(savedStats.games)) setStats({ ...initialStats, ...savedStats });
      } catch {
        localStorage.removeItem(GAME_STORAGE_KEY);
      }
      if (!restored) setTargetSlug(pickRandom(gamePlayers)?.slug || '');
      setHydrated(true);
    });
    return () => { active = false; };
  }, [gamePlayers, playersBySlug]);

  useEffect(() => {
    if (!hydrated || !targetSlug) return;
    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify({ targetSlug, guesses, status } satisfies StoredGame));
  }, [guesses, hydrated, status, targetSlug]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  }, [hydrated, stats]);

  const target = playersBySlug.get(targetSlug);
  const guessedPlayers = guesses.map((slug) => playersBySlug.get(slug)).filter((player): player is GamePlayer => Boolean(player));
  const remaining = MAX_GUESSES - guesses.length;
  const suggestions = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('en');
    if (!needle) return [];
    return gamePlayers.filter((player) => {
      if (guesses.includes(player.slug)) return false;
      return `${player.name} ${player.realName} ${player.teamName} ${player.country}`.toLocaleLowerCase('en').includes(needle);
    }).slice(0, 7);
  }, [gamePlayers, guesses, query]);

  function recordResult(won: boolean, attempts: number) {
    setStats((current) => ({
      games: current.games + 1,
      wins: current.wins + (won ? 1 : 0),
      streak: won ? current.streak + 1 : 0,
      best: won && (!current.best || attempts < current.best) ? attempts : current.best,
    }));
  }

  function makeGuess(slug: string) {
    if (!target || status !== 'playing' || guesses.includes(slug)) return;
    const nextGuesses = [...guesses, slug];
    setGuesses(nextGuesses);
    setQuery('');
    setMessage('');
    setInputFocused(false);
    if (slug === target.slug) {
      setStatus('won');
      recordResult(true, nextGuesses.length);
    } else if (nextGuesses.length >= MAX_GUESSES) {
      setStatus('lost');
      recordResult(false, nextGuesses.length);
    }
  }

  function submitGuess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const needle = query.trim().toLocaleLowerCase('en');
    const exact = gamePlayers.find((player) => player.name.toLocaleLowerCase('en') === needle && !guesses.includes(player.slug));
    if (exact) return makeGuess(exact.slug);
    if (suggestions.length === 1) return makeGuess(suggestions[0].slug);
    setMessage(needle ? '请从候选选手中选择一个准确的 ID。' : '先输入一名选手的 ID。');
  }

  function startNewGame() {
    const next = pickRandom(gamePlayers, targetSlug);
    setTargetSlug(next?.slug || '');
    setGuesses([]);
    setStatus('playing');
    setQuery('');
    setMessage('');
  }

  function giveUp() {
    if (status !== 'playing') return;
    setStatus('lost');
    recordResult(false, guesses.length);
  }

  const winRate = stats.games ? Math.round((stats.wins / stats.games) * 100) : 0;

  return (
    <article className="guess-game-page">
      <header className="guess-game-hero">
        <div>
          <p className="eyebrow accent">DOTA PLAYER // SOLO GUESSING</p>
          <h1>DOTA 2 弗一把</h1>
          <p>从当前职业阵容中找到隐藏选手。每次猜测都会比较国籍、赛区、战队和选手特征，你有 8 次机会。</p>
          <div className="guess-hero-actions"><a href="#guess-board">开始猜测 ↓</a><Link href="/players">先查选手资料 →</Link></div>
        </div>
        <div className="guess-stats" aria-label="本机游戏统计">
          <span><strong>{stats.games}</strong><small>已玩</small></span>
          <span><strong>{winRate}%</strong><small>胜率</small></span>
          <span><strong>{stats.streak}</strong><small>连胜</small></span>
          <span><strong>{stats.best || '—'}</strong><small>最佳步数</small></span>
        </div>
      </header>

      <section className="guess-game-shell" id="guess-board">
        <div className="guess-game-topline">
          <div><span className="status-dot" /><strong>{gamePlayers.length} 名当前阵容选手</strong><small>数据更新于 {new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(generatedAt))}</small></div>
          <div className="guess-progress"><span>猜测进度</span><strong>{guesses.length} / {MAX_GUESSES}</strong><i><b style={{ width: `${(guesses.length / MAX_GUESSES) * 100}%` }} /></i></div>
        </div>

        <details className="guess-rules">
          <summary>如何判断线索？</summary>
          <div>
            <p><span className="legend-swatch is-match" />绿色：完全一致</p>
            <p><span className="legend-swatch is-near" />黄色：接近；国家同大区、战队同分赛区，或昵称长度相差 1</p>
            <p><span className="legend-swatch is-miss" />红色：不一致；数字箭头指向答案的昵称长度</p>
          </div>
        </details>

        {hydrated && status === 'playing' && (
          <form className="guess-input-form" onSubmit={submitGuess}>
            <div className="guess-input-wrap">
              <span aria-hidden="true">⌕</span>
              <input
                autoComplete="off"
                value={query}
                onChange={(event) => { setQuery(event.target.value); setMessage(''); }}
                onFocus={() => setInputFocused(true)}
                onBlur={() => window.setTimeout(() => setInputFocused(false), 120)}
                placeholder="输入选手 ID、实名或战队…"
                aria-label="输入要猜测的职业选手"
              />
              <small>还剩 {remaining} 次</small>
              {inputFocused && query.trim() && (
                <div className="guess-suggestions">
                  {suggestions.map((player) => (
                    <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => makeGuess(player.slug)} key={player.slug}>
                      <span className="guess-suggestion-flag"><PlayerFlag player={player} /></span>
                      <span><strong>{player.name}</strong><small>{player.realName || displayCountry(player.country)}</small></span>
                      <em>{player.teamName}</em>
                    </button>
                  ))}
                  {!suggestions.length && <p>没有未猜过的匹配选手。</p>}
                </div>
              )}
            </div>
            <button type="submit">确认猜测</button>
          </form>
        )}
        {message && <p className="guess-form-message" role="alert">{message}</p>}

        {!hydrated && <div className="guess-loading">正在恢复本机对局…</div>}

        {hydrated && guessedPlayers.length === 0 && status === 'playing' && (
          <div className="guess-empty-state">
            <span>?</span>
            <div><strong>隐藏选手已就位</strong><p>先猜一名你熟悉的现役选手，第一排线索会告诉你接下来该往哪里找。</p></div>
          </div>
        )}

        {target && guessedPlayers.length > 0 && (
          <div className="guess-board" role="table" aria-label="猜测结果">
            <div className="guess-board-head" role="row">
              <span>选手</span><span>国籍</span><span>大区</span><span>分赛区</span><span>当前战队</span><span>身份</span><span>昵称长度</span>
            </div>
            {guessedPlayers.map((player, index) => {
              const country = cellState(player.country === target.country, player.region === target.region);
              const region = cellState(player.region === target.region);
              const subregion = cellState(player.subregion === target.subregion, player.region === target.region);
              const team = cellState(player.teamSlug === target.teamSlug, player.subregion === target.subregion);
              const captain = cellState(player.isCaptain === target.isCaptain);
              const lengthDelta = target.name.length - player.name.length;
              const nameLength = cellState(lengthDelta === 0, Math.abs(lengthDelta) === 1);
              return (
                <div className="guess-board-row" role="row" style={{ '--row-delay': `${index * 55}ms` } as React.CSSProperties} key={player.slug}>
                  <div className="guess-player-cell" data-label="选手">
                    <span className="guess-player-flag"><PlayerFlag player={player} /></span>
                    <span><strong>{player.name}</strong><small>{player.realName || '—'}</small></span>
                  </div>
                  <FeedbackCell state={country} label="国籍"><span className="guess-cell-flag"><PlayerFlag player={player} /></span><strong>{displayCountry(player.country)}</strong></FeedbackCell>
                  <FeedbackCell state={region} label="大区"><strong>{displayRegion(player.region)}</strong></FeedbackCell>
                  <FeedbackCell state={subregion} label="分赛区"><strong>{displaySubregion(player.subregion, player.region)}</strong></FeedbackCell>
                  <FeedbackCell state={team} label="当前战队"><span className="guess-cell-team"><TeamLogo player={player} /></span><strong>{player.teamName}</strong></FeedbackCell>
                  <FeedbackCell state={captain} label="身份"><strong>{player.isCaptain ? '队长' : '选手'}</strong></FeedbackCell>
                  <FeedbackCell state={nameLength} label="昵称长度"><strong>{player.name.length}</strong>{lengthDelta !== 0 && <b aria-label={lengthDelta > 0 ? '答案更长' : '答案更短'}>{lengthDelta > 0 ? '↑' : '↓'}</b>}</FeedbackCell>
                </div>
              );
            })}
          </div>
        )}

        {target && status !== 'playing' && (
          <section className={`guess-result is-${status}`}>
            <div className="guess-result-symbol">{status === 'won' ? '✓' : '!'}</div>
            <div className="guess-result-copy">
              <p>{status === 'won' ? `第 ${guesses.length} 次猜中` : '本局答案'}</p>
              <h2>{target.name}</h2>
              <span>{target.realName || displayCountry(target.country)}</span>
            </div>
            <div className="guess-result-team"><span className="guess-result-logo"><TeamLogo player={target} /></span><small>当前战队</small><strong>{target.teamName}</strong></div>
            <a href={target.profileUrl} target="_blank" rel="noreferrer">查看选手资料 ↗</a>
            <button type="button" onClick={startNewGame}>再来一局 →</button>
          </section>
        )}

        {hydrated && status === 'playing' && guesses.length > 0 && <button className="guess-give-up" type="button" onClick={giveUp}>放弃并揭晓答案</button>}
      </section>

      <footer className="guess-game-credit">
        <span>玩法灵感</span>
        <p>参考开源项目 <a href="https://github.com/shnlfriberg/csgofriberg" target="_blank" rel="noreferrer">csgofriberg</a> 的逐属性猜人机制；本页为 DOTA 2 中文 WIKI 的独立静态实现，不需要账号或后端服务。</p>
      </footer>
    </article>
  );
}
