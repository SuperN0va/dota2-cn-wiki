import type { Metadata } from 'next';
import { TeamsBrowser } from '../../components/esports-browser';
import { esports } from '../../lib/data';

export const metadata: Metadata = {
  title: '职业战队',
  description: 'DOTA 2 职业战队、地区、当前阵容与近期人员流动。',
};

export default function TeamsPage() {
  return <TeamsBrowser players={esports.players} teams={esports.teams} transfers={esports.transfers} generatedAt={esports.generatedAt} />;
}
