import { Fragment } from 'react';

type GameTextProps = {
  text: string;
};

const numericEffectPattern = /([+\-−]?\d+(?:\.\d+)?(?:\s*[–—~～至]\s*[+\-−]?\d+(?:\.\d+)?)?(?:\s*\/\s*[+\-−]?\d+(?:\.\d+)?)*(?:\s*(?:%|秒|点|格|码|米|金币|层|次|级|个|倍|分钟))?)/g;
const numericEffectExactPattern = /^[+\-−]?\d+(?:\.\d+)?(?:\s*[–—~～至]\s*[+\-−]?\d+(?:\.\d+)?)?(?:\s*\/\s*[+\-−]?\d+(?:\.\d+)?)*(?:\s*(?:%|秒|点|格|码|米|金币|层|次|级|个|倍|分钟))?$/;

export function GameText({ text }: GameTextProps) {
  return <>{text.split(numericEffectPattern).map((part, index) => (
    numericEffectExactPattern.test(part)
      ? <strong className="numeric-effect" key={`${part}:${index}`}>{part}</strong>
      : <Fragment key={`${part}:${index}`}>{part}</Fragment>
  ))}</>;
}
