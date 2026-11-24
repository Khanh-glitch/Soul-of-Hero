import sys
p=sys.argv[1]; s=open(p,encoding='utf8').read()
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt,(a[:50],s.count(a)); s=s.replace(a,b)
rep("  started = new Set<string>(); toolsRemade = 0; repairs = 0;",
    "  started = new Set<string>(); toolsRemade = 0; repairs = 0;\n"
    "  /** Tool wear ledger (read-only bookkeeping): durability points spent per tool, by what the swing was spent on\n"
    "   *  (the material of the source being worked, `fight`, or `other`); tools made by hand or bench; tools worn to zero. */\n"
    "  toolWear: Record<string, Record<string, number>> = {}; toolsCrafted: Record<string, number> = {}; toolsBroken: Record<string, number> = {}; wearFor = 'other';")
rep("    const hp0 = this.p.hp, alive = new Map(this.r.creatures.map(c => [c.id, c.type] as const));\n    this.now += DT; tick(this.gs, input, DT, this.now); this.ticks++;\n",
    "    const hp0 = this.p.hp, alive = new Map(this.r.creatures.map(c => [c.id, c.type] as const));\n"
    "    const fighting = !!(input as any).attack && input !== inp && !!inp === false ? true : (input as any).__fight === true;\n"
    "    const dur0 = new Map<string, number>(); for (const st of C(this.r, 'inv').slots) if (st && st.dur !== undefined) dur0.set(st.uid, st.dur);\n"
    "    this.now += DT; tick(this.gs, input, DT, this.now); this.ticks++;\n"
    "    for (const st of C(this.r, 'inv').slots) { if (!st || st.dur === undefined) continue; const was = dur0.get(st.uid); if (was === undefined || st.dur >= was) continue;\n"
    "      const why = this.fightNow ? 'fight' : this.wearFor; const row = (this.toolWear[st.key] ??= {}); row[why] = +((row[why] || 0) + (was - st.dur)).toFixed(3);\n"
    "      if (was > 0 && st.dur <= 0) this.toolsBroken[st.key] = (this.toolsBroken[st.key] || 0) + 1; }\n"
    "    this.fightNow = false;\n")
# drop the clumsy `fighting` line; use a flag set where the bot decides to fight
rep("    const fighting = !!(input as any).attack && input !== inp && !!inp === false ? true : (input as any).__fight === true;\n","")
rep("this.fightTicks++;\n","this.fightTicks++; this.fightNow = true;\n")
rep("wearFor = 'other';","wearFor = 'other'; fightNow = false;")
rep("  harvestOne(s: { tx: number; ty: number; key: string }): boolean {",
    "  harvestOne(s: { tx: number; ty: number; key: string }): boolean {\n"
    "    const prev = this.wearFor; this.wearFor = sourceAt(this.r, s.tx, s.ty, this.now)?.def.mat ?? 'other';\n"
    "    try { return this.harvestOne0(s); } finally { this.wearFor = prev; }\n"
    "  }\n"
    "  private harvestOne0(s: { tx: number; ty: number; key: string }): boolean {")
rep("  craft(recipe: string, eid?: string) { return this.must('craft', eid ? { recipe, eid } : { recipe }); }",
    "  craft(recipe: string, eid?: string) { const out = RECIPES[recipe]?.out; if (out && ITEMS[out]?.dur) this.toolsCrafted[out] = (this.toolsCrafted[out] || 0) + 1; return this.must('craft', eid ? { recipe, eid } : { recipe }); }")
rep("toolsRemade: this.toolsRemade, toolRepairs: this.repairs,","toolsRemade: this.toolsRemade, toolRepairs: this.repairs, toolsCrafted: this.toolsCrafted, toolsBroken: this.toolsBroken, toolWear: this.toolWear,")
open(p,'w',encoding='utf8').write(s)
