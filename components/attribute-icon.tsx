const attributeAssets: Record<string, string> = {
  力量: '/assets/attribute-strength.png',
  敏捷: '/assets/attribute-agility.png',
  智力: '/assets/attribute-intelligence.png',
  全才: '/assets/attribute-universal.png',
};

export function AttributeIcon({ attribute, className = '' }: { attribute: string; className?: string }) {
  const src = attributeAssets[attribute];
  if (!src) return null;
  return <img className={`attribute-icon ${className}`.trim()} src={src} alt={`${attribute}属性`} title={`${attribute}属性`} />;
}
