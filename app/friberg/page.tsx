import type { Metadata } from 'next';
import { PlayerGuessGame } from '../../components/player-guess-game';
import { esports } from '../../lib/data';

export const metadata: Metadata = {
  title: 'DOTA 2 弗一把',
  description: '单人 DOTA 2 职业选手猜测游戏：根据国籍、赛区、战队与昵称线索，在 8 次机会内找到隐藏选手。',
};

export default function FribergPage() {
  return <PlayerGuessGame players={esports.players} generatedAt={esports.generatedAt} />;
}
