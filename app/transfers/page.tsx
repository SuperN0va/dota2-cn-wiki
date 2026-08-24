import type { Metadata } from 'next';
import { TransfersBrowser } from '../../components/esports-browser';
import { esports } from '../../lib/data';

export const metadata: Metadata = {
  title: '近期转会',
  description: 'DOTA 2 最近 50 条重要职业选手转会与阵容变动。',
};

export default function TransfersPage() {
  return <TransfersBrowser transfers={esports.transfers} teams={esports.teams} generatedAt={esports.generatedAt} />;
}
