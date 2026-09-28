/** All bundled faces are OFL. Requested proprietary families are explicitly substituted. */
export const fontPairingNames=['modern-italic','editorial-geometric','condensed-light','script-humanist','black-headline','swiss-grotesk','editorial-serif','cinema-serif','grotesk-serif-accent','poster-grotesk'] as const;
export type FontPairingName=typeof fontPairingNames[number];
export type FontFaceSpec={family:string;weight:number;style:'normal'|'italic';file:string};
const face=(family:string,slug:string,weight:number,style:'normal'|'italic'='normal'):FontFaceSpec=>({family,weight,style,file:`${slug}-latin-${weight}-${style}.woff2`});
export const monoFace=face('IBM Plex Mono','ibm-plex-mono',400);
/** `displayScale` compensates for low x-height display faces; `type` overrides display tracking/leading for the face.
 * `accent` is an optional third face reserved for caption emphasis words; it defaults to the display face. */
export type FontPairing={display:FontFaceSpec;body:FontFaceSpec;accent?:FontFaceSpec;requested:string;substitutions:string[];displayScale?:number;type?:{displayTracking?:number;displayLineHeight?:number}};
export const fontPairings:Record<FontPairingName,FontPairing>={
 'modern-italic':{display:face('Inter','inter',400),body:face('DM Sans','dm-sans',400,'italic'),requested:'SF Pro Display Regular + DM Sans Display Italic',substitutions:['Inter Regular replaces SF Pro Display Regular; DM Sans Italic is the installed family name.']},
 'editorial-geometric':{display:face('Playfair Display','playfair-display',500),body:face('Montserrat','montserrat',400),requested:'Playfair Display + Gilroy Regular',substitutions:['Montserrat Regular replaces Gilroy Regular.']},
 'condensed-light':{display:face('Anton','anton',400),body:face('Poppins','poppins',300),requested:'Collvetica heavy compresses + Poppins Light',substitutions:['Anton replaces the unverified Collvetica/Coolvetica Heavy Compressed face.']},
 'script-humanist':{display:face('Great Vibes','great-vibes',400),body:face('Anek Latin','anek-latin',400),requested:'Great Vibes + Anek Latin Regular',substitutions:[]},
 'swiss-grotesk':{display:face('Inter','inter',700),body:face('Inter','inter',400),requested:'Tight grotesk poster headline + neutral grotesk body',substitutions:[],type:{displayTracking:-.045,displayLineHeight:.98}},
 'editorial-serif':{display:face('Instrument Serif','instrument-serif',400,'italic'),body:face('Inter','inter',500),requested:'Condensed italic editorial serif + grotesk body',substitutions:[],displayScale:1.22,type:{displayTracking:-.015,displayLineHeight:.95}},
 'cinema-serif':{display:face('Instrument Serif','instrument-serif',400),body:face('Inter','inter',400),requested:'Roman editorial serif + grotesk body',substitutions:[],displayScale:1.18,type:{displayTracking:-.01,displayLineHeight:1}},
 'grotesk-serif-accent':{display:face('Inter','inter',700),body:face('Inter','inter',500),accent:face('Instrument Serif','instrument-serif',400,'italic'),requested:'Grotesk headlines and captions with a sparing italic-serif emphasis word',substitutions:[],type:{displayTracking:-.04,displayLineHeight:.98}},
 'poster-grotesk':{display:face('Inter','inter',700),body:face('Inter','inter',500),requested:'Tight grotesk poster headline + medium grotesk captions, no serif',substitutions:[],type:{displayTracking:-.045,displayLineHeight:.98}},
 'black-headline':{display:face('Inter','inter',900),body:face('Bebas Neue','bebas-neue',400),requested:'SF Pro Display Black + Headliner',substitutions:['Inter Black replaces SF Pro Display Black; Bebas Neue replaces the unspecified Headliner font.']},
};
export const defaultPairing={ 'clean-tech':'swiss-grotesk','cinematic-doc':'cinema-serif','high-energy-shorts':'poster-grotesk'} as const;
