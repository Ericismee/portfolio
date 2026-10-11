'use client';
import { countryCodes, countryName } from '../lib/countries';
import { useLanguage } from './language';
export function LocationInput({name,value,onChange}:{name:string;value:string;onChange:(value:string)=>void}) {
  const {t,language} = useLanguage();
  const selected = countryCodes.find(code=>[countryName(code,'en'),countryName(code,'vi')].includes(value)) || '';
  return <span className="location-input">
    <select aria-label={t('Chọn quốc gia hoặc nhập địa điểm riêng', 'Choose a country or enter a custom location')} value={selected} onChange={event=>{if(event.target.value)onChange(countryName(event.target.value,'en'));}}>
      <option value="">{t('Địa điểm tùy chỉnh', 'Custom location')}</option>
      {[...countryCodes].sort((a,b)=>countryName(a,language).localeCompare(countryName(b,language),language)).map(code=><option value={code} key={code}>{countryName(code,language)}</option>)}
    </select>
    <input name={name} value={value} maxLength={200} autoComplete="country-name" placeholder={t('Ví dụ: Đà Lạt, Việt Nam', 'e.g. Da Lat, Vietnam')} onChange={event=>onChange(event.target.value)} />
    <small className="admin-help">{t('Chọn một quốc gia hoặc nhập địa điểm bất kỳ vào ô bên dưới. Để trống để ẩn.', 'Choose a country or type any location below. Leave empty to hide it.')}</small>
  </span>;
}
