// Страны: коды ISO 3166-1, названия даёт сам браузер на языке интерфейса (Intl.DisplayNames).
import { locale } from '../i18n';

export const COUNTRY_CODES = (
  'AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI KH CM CA CV CF TD CL CN CO KM CG CD CR CI HR CU CY CZ ' +
  'DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HK HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KP KR ' +
  'XK KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PW PS PA ' +
  'PG PY PE PH PL PT PR QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR ' +
  'TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW'
).split(' ');

let cache: { loc: string; names: Intl.DisplayNames } | null = null;

export function countryName(code?: string): string {
  if (!code) return '';
  const loc = locale();
  if (!cache || cache.loc !== loc) cache = { loc, names: new Intl.DisplayNames([loc], { type: 'region' }) };
  try {
    return cache.names.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Все страны, отсортированные по названию на языке интерфейса. */
export function countryOptions(): { value: string; label: string }[] {
  const loc = locale();
  return COUNTRY_CODES.map((c) => ({ value: c, label: countryName(c) })).sort((a, b) => a.label.localeCompare(b.label, loc));
}
