// VFX TEST KIT — disabled (`false`) in all real survival runs so progression/economy remain 100% pure.
// Enabled (`setVfxTestKit(true)`) ONLY inside Title's isolated QA Sandbox ("7 Cores & 4 Side Bosses" preset),
// and reset to `false` on exiting QA Sandbox. Presentation code never reads this flag.
export let VFX_TEST_KIT = false;
export function setVfxTestKit(on: boolean): void {
  VFX_TEST_KIT = on;
}
export const VFX_TEST_CAPS: Record<string, number> = { basic: 40, refined: 12, signature: 4 };
export const VFX_TEST_CORES = ['core_blast', 'core_meteor', 'core_dragon', 'core_elsa', 'core_earthmother', 'core_mjolnir', 'core_demon'];
