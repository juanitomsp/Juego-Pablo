import { Icon } from './Icon';
import { t } from '../i18n';

/** Ojo con el número de personas mirando la partida. */
export function SpectatorCount({ n }: { n: number }) {
  return (
    <span className={`spectators ${n ? '' : 'none'}`} title={n === 1 ? t('1 persona mirando') : t('{n} personas mirando', { n })} aria-label={t('{n} personas mirando', { n })}>
      <Icon name="eye" size={16} /> {n}
    </span>
  );
}
