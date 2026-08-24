import type { Metadata } from 'next';
import { ItemBrowser } from '../../components/item-browser';
import { itemSummaries } from '../../lib/data';

export const metadata: Metadata = {
  title: '物品辞典',
  description: 'DOTA 2 全物品官方中文描述、数值与逐版本改动日志。',
};

export default function ItemsPage() {
  return <ItemBrowser items={itemSummaries} />;
}
