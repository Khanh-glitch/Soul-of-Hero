/// <reference types="vite/client" />
// An isolated diagnostic, NOT a playable delivery. Never enables in builds.
export const arcanaLabEnabled=import.meta.env.DEV && typeof location!=='undefined' && new URLSearchParams(location.search).get('arcanaBdev')==='1';
