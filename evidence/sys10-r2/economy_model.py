#!/usr/bin/env python3
"""SYS10-R2 economy MODEL (not field measurement).
Reads SOH balance JSON + constants transcribed from catalog.ts / engine.ts (cited inline).
Assumptions are explicit; prices come from VENDOR_SPARES; no infinite cycle: oil is finite."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parents[2] / 'web' / 'src' / 'game'
bal = json.loads((root / 'balance.v1.json').read_text())
R = bal['oilRefineryV1']['recipes']; M = bal['motorbike']; L = bal['oilRefineryV1']
TANK_PER_CAN = 100          # fuel units per Fuel Canister (engine vehicleRefuel, can = 100 tank units)
FUEL_PER_PX = M['fuelPerPixel']
WEAR = M['wearPerPixel']
REPAIR_HP = M['repairHp']   # 50 HP per 1 Mechanical Part + 1 Fastener
OIL_PRICE, GLASS_PRICE = 5, 4   # VENDOR_SPARES salvaged_oil / glass (finite stock: 4 / 3)
OIL_STOCK, GLASS_STOCK = 4, 3
FURNACE_SECS, FURNACE_OIL, FURNACE_GLASS, FURNACE_CANS = 18, 3, 1, 1  # refine_salvaged_oil
rows = []
def route(name, oil, glass, secs, cans, lube=0):
    rows.append(dict(route=name, oil_per_can=round(oil/cans,2), glass_per_can=round(glass/cans,2),
                     secs_per_can=round(secs/cans,2), cans=cans, lube=lube))
route('A furnace (3 oil+1 glass -> 1 can, 18s)', FURNACE_OIL, FURNACE_GLASS, FURNACE_SECS, 1)
b = R['batch']; route('B refinery batch (5+1 -> 2 cans, 22s)', b['ins'][0][1], b['ins'][1][1], b['secs'], 2)
i = R['industrial']; route('B refinery industrial (6+1 -> 2 cans + 1 lube, 26s)', i['ins'][0][1], i['ins'][1][1], i['secs'], 2, lube=1)
lu = R['lube']; sep_oil = b['ins'][0][1] + lu['ins'][0][1]; sep_secs = b['secs'] + lu['secs']
print('== Per-product processing (MODEL) ==')
for r in rows: print(r)
print(f"separate batch+lube = {sep_oil} oil / {sep_secs}s  vs industrial = {i['ins'][0][1]} oil / {i['secs']}s")
print('\n== Motorbike maths (MODEL, flat unloaded road) ==')
can_px = TANK_PER_CAN / FUEL_PER_PX
print(f"one can = {can_px:.0f} px of travel; 1 lube covers {L['lubricantDistancePx']} px = {L['lubricantDistancePx']/can_px:.1f} cans")
saved_hp = L['lubricantDistancePx'] * WEAR * L['lubricantWearReduction']
print(f"lube saves {saved_hp:.1f} HP per {L['lubricantDistancePx']} px unloaded road (rough x1.5 -> {saved_hp*1.5:.1f}; loaded x1.5 more -> {saved_hp*1.5*1.5:.1f})")
print(f"  = {saved_hp/REPAIR_HP:.2f} of one repair (1 Mechanical Part + 1 Fastener), for {2} oil")
oil_eq_px = (2 / FURNACE_OIL) * can_px   # 2 oil expressed as furnace-fuel travel
print(f"  2 oil as furnace fuel = {2/FURNACE_OIL:.2f} cans = {oil_eq_px:.0f} px of unloaded travel")
print('\n== Oil and money at vendor prices (MODEL) ==')
print(f"oil at vendor price {OIL_PRICE}; vendor stock {OIL_STOCK} oil + {GLASS_STOCK} glass ... finite")
print(f"furnace cost per can: {FURNACE_OIL*OIL_PRICE + FURNACE_GLASS*GLASS_PRICE} money-eq; batch per can: {b['ins'][0][1]/2*OIL_PRICE + b['ins'][1][1]/2*GLASS_PRICE}")
print(f"oil saved per can refinery-batch vs furnace: {FURNACE_OIL - b['ins'][0][1]/2:.2f} oil; over 10 cans: {(FURNACE_OIL - b['ins'][0][1]/2)*10:.1f} oil")
