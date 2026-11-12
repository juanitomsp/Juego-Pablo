import { Icon } from './Icon';

/** Ojo con el número de personas mirando la partida. */
export function SpectatorCount({ n }: { n: number }) {
  return (
    <span className={`spectators ${n ? '' : 'none'}`} title={n === 1 ? '1 persona mirando' : `${n} personas mirando`} aria-label={`${n} mirando`}>
      <Icon name="eye" size={16} /> {n}
    </span>
  );
}
