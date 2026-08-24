import type { Metadata } from 'next';
import { PlayersBrowser } from '../../components/esports-browser';
import { esports } from '../../lib/data';

export const metadata: Metadata = {
  title: '职业选手',
  description: 'DOTA 2 职业选手、国籍、当前战队与近期转会资料。',
};

export default function PlayersPage() {
  return <PlayersBrowser players={esports.players} teams={esports.teams} transfers={esports.transfers} generatedAt={esports.generatedAt} />;
}
