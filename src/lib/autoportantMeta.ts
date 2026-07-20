/**
 * Shared metadata for Piscina Autoportant PDFs and wizard visuals.
 * Duplicates the model/finish tables so PDF pages can render without
 * pulling wizard code (and its React/UI dependencies).
 */
import confortAsset from '@/assets/autoportant-line-confort.png.asset.json';
import luxeAsset from '@/assets/autoportant-line-luxe.png.asset.json';
import luxePlusAsset from '@/assets/autoportant-line-luxe-plus.png.asset.json';
import aerisAsset from '@/assets/finishes/AERIS.webp.asset.json';
import argentiumAsset from '@/assets/finishes/ARGENTIUM.webp.asset.json';
import nacreAsset from '@/assets/finishes/NACRE.webp.asset.json';
import sabbiaAsset from '@/assets/finishes/SABBIA.webp.asset.json';
import stelaArticAsset from '@/assets/finishes/STELA_ARTIC.webp.asset.json';
import varaderoAsset from '@/assets/finishes/VARADERO.webp.asset.json';
import menorcaAsset from '@/assets/finishes/MENORCA.webp.asset.json';
import gr3000Asset from '@/assets/finishes/gresite/3000.webp.asset.json';
import gr3002Asset from '@/assets/finishes/gresite/3002.webp.asset.json';
import gr3003Asset from '@/assets/finishes/gresite/3003.webp.asset.json';
import gr3004Asset from '@/assets/finishes/gresite/3004.webp.asset.json';
import gr3057Asset from '@/assets/finishes/gresite/3057.webp.asset.json';
import gr3800Asset from '@/assets/finishes/gresite/3800.webp.asset.json';
import gr3802Asset from '@/assets/finishes/gresite/3802.webp.asset.json';
import gr3807Asset from '@/assets/finishes/gresite/3807.webp.asset.json';
import grNC7723Asset from '@/assets/finishes/gresite/NC7723.webp.asset.json';
import grNC7733Asset from '@/assets/finishes/gresite/NC7733.webp.asset.json';
import grNC7734Asset from '@/assets/finishes/gresite/NC7734.webp.asset.json';

export type AutoportantModelKey = 'line_confort' | 'line_luxe' | 'line_luxe_plus';

export interface AutoportantModelMeta {
  key: AutoportantModelKey;
  name: string;
  tagline: string;
  image: string;
  features: string[];
}

export const AUTOPORTANT_MODELS: Record<AutoportantModelKey, AutoportantModelMeta> = {
  line_confort: {
    key: 'line_confort',
    name: 'LINE CONFORT',
    tagline: "L'essencial del sistema Desingpool",
    image: confortAsset.url,
    features: [
      'Estructura autoportant amb sistema patentat Desingpool',
      'Piscina prefabricada provada en fàbrica (estanqueïtat garantida)',
      'Construcció industrialitzada amb maquinària CNC',
      'Sistema modular amb aïllament en poliestirè hidròfug',
      'Mòduls prefabricats amb accessoris i passamurs preinstal·lats',
      'Escala interior i exterior',
      'Revestiment interior en gresite estàndard',
      'Acabat exterior en morter acrílic texturat (blanc, beige o gris)',
      'Coronació en porcelànic DEKTON',
      'Mini focus LED blanc',
      'Filtre cartutx + bomba vel. variable + electròlisi salina',
      'Garantia de 10 anys sobre el vas',
    ],
  },
  line_luxe: {
    key: 'line_luxe',
    name: 'LINE LUXE',
    tagline: 'Disseny premium amb cristall panoràmic',
    image: luxeAsset.url,
    features: [
      'Totes les característiques estructurals del sistema Desingpool',
      'Escala interior amb banc integrat en tot el llarg',
      'Escala exterior',
      'Revestiment interior a triar: gresite, gresite nacarat, gresite digital o porcelànic',
      'Revestiment exterior i coronació en porcelànic DEKTON',
      'Cristall panoràmic de 1,40 × 0,40 m',
      'Mini focus LED blanc',
      'Preinstal·lació de calefacció',
      'Filtre cartutx + bomba vel. variable + electròlisi salina',
      'Garantia de 10 anys sobre el vas',
    ],
  },
  line_luxe_plus: {
    key: 'line_luxe_plus',
    name: 'LINE LUXE PLUS',
    tagline: 'La màxima expressió: cristall LARGE i cascada LED',
    image: luxePlusAsset.url,
    features: [
      'Totes les característiques estructurals del sistema Desingpool',
      'Escala interior amb banc integrat en tot el llarg',
      'Escala exterior',
      'Revestiment interior, exterior i coronació en porcelànic DEKTON o ALTOGLASS 15 × 15 cm',
      'Cristall panoràmic LARGE de 2,00 × 0,40 m',
      'Cascada encastada LED de 60 cm',
      'Mini focus LED blanc',
      'Preinstal·lació de calefacció',
      'Filtre cartutx + bomba vel. variable + electròlisi salina',
      'Garantia de 10 anys sobre el vas',
    ],
  },
};

/** Porcelànic finish images keyed by canonical name (as shown in the wizard). */
export const AUTOPORTANT_PORC_IMAGES: Record<string, string> = {
  AERIS: aerisAsset.url,
  ARGENTIUM: argentiumAsset.url,
  NACRE: nacreAsset.url,
  SABBIA: sabbiaAsset.url,
  STELA_ARTIC: stelaArticAsset.url,
  'STELA ARTIC': stelaArticAsset.url,
  VARADERO: varaderoAsset.url,
  MENORCA: menorcaAsset.url,
};

export const AUTOPORTANT_GRESITE_IMAGES: Record<string, string> = {
  '3000': gr3000Asset.url,
  '3002': gr3002Asset.url,
  '3003': gr3003Asset.url,
  '3004': gr3004Asset.url,
  '3057': gr3057Asset.url,
  NC7723: grNC7723Asset.url,
  NC7733: grNC7733Asset.url,
  NC7734: grNC7734Asset.url,
  '3800': gr3800Asset.url,
  '3802': gr3802Asset.url,
  '3807': gr3807Asset.url,
};

/** Resolve a finish key (as stored on the draft, e.g. `corona_porc_sabbia`
 *  or `rev_luxe_nc7733`) into its displayable name + family + image URL. */
export function resolveAutoportantFinish(
  key: string | undefined,
): { name: string; family: string; image?: string } | null {
  if (!key) return null;
  // Porcelànic finishes: keys `corona_porc_*` and `rev_plus_porc_*`.
  if (key.startsWith('corona_porc_') || key.startsWith('rev_plus_porc_')) {
    const raw = key
      .replace('corona_porc_', '')
      .replace('rev_plus_porc_', '')
      .toUpperCase()
      .replace('_', ' ');
    const name = raw === 'STELA ARTIC' ? 'STELA ARTIC' : raw;
    return { name, family: 'Porcelànic', image: AUTOPORTANT_PORC_IMAGES[name] };
  }
  // Gresite finishes: keys `rev_confort_<n>` and `rev_luxe_<n>`.
  if (key.startsWith('rev_confort_') || key.startsWith('rev_luxe_')) {
    const raw = key.replace('rev_confort_', '').replace('rev_luxe_', '').toUpperCase();
    return { name: raw, family: 'Gresite', image: AUTOPORTANT_GRESITE_IMAGES[raw] };
  }
  return { name: key, family: '' };
}