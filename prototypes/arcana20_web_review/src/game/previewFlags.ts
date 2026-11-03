/// <reference types="vite/client" />
/** The dedicated review build is isolated from the ordinary game. It is an
 * unapproved prototype, not the production SOH build. Development remains
 * opt-in so ordinary local runs keep their original saves and behavior. */
export const arcanaReviewBuild=import.meta.env.VITE_ARCANA_REVIEW==='1';
const params=typeof location==='undefined'?null:new URLSearchParams(location.search);
export const arcanaLabEnabled=!!params && (arcanaReviewBuild || (import.meta.env.DEV && params.get('arcanaBdev')==='1'));
/** Review defaults to WebGL, with an explicit opt-out for fallback testing.
 * Existing development URLs retain their opt-in GPU behavior. */
export const arcanaGpuEnabled=arcanaLabEnabled && (params?.get('arcanaGpu')==='1' || (arcanaReviewBuild && params?.get('arcanaGpu')!=='0'));
