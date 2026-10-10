import {upgradePublicContent} from './public-content.js';
import {initial,skills} from './data.js';
export const STORAGE_KEY='eric-profile-mock';
export function loadDemo(){let saved={};try{const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))saved=parsed}catch{}const data={...structuredClone(initial),...saved,profile:{...initial.profile,...saved.profile}};data.skills??=[...skills];data.items??={};data.links??={};if(!saved.contentVersion){data.contentVersion=0;upgradePublicContent(data);if(Object.keys(saved).length)persistDemo(data)}if(data.visualStyle!=='colorful-template'){if(!data.accent||['#000000','#0a66c2'].includes(data.accent.toLowerCase()))data.accent='#4264da';data.visualStyle='colorful-template'}return data}
export function persistDemo(data){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));return true}catch{return false}}
export const isOwner=()=>localStorage.getItem('eric-owner')!=='false';
export const toggleOwner=()=>localStorage.setItem('eric-owner',String(!isOwner()));
