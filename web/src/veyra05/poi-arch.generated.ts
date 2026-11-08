// AUTO-GENERATED from canonical GOLD (88780f78b9e8) + WMP-03 architecture.v1.json (76435059eaf9) + U05 pilot scenes (73ec27319ce1).
// Every coordinate is in U=0.5 global tiles (1 AU = 2 tiles).
export interface PoiRoomSpec { id: string; cx: number; cy: number; wTiles: number; hTiles: number; covered: boolean; canopyOnly: boolean; u05Roof: string | null; u05Floor: string | null }
export interface PoiArchSpec { id: string; name: string; arche: string; atTile: [number, number]; obbAngle: number; obbTiles: [number, number]; enclosure: 'OPEN_AIR_YARD' | 'ENCLOSED_SINGLE' | 'ENCLOSED_MULTI_LAYER'; isPilot: boolean; hasExt: boolean; extTile: [number, number] | null; deepRooms: number; rooms: PoiRoomSpec[] }
export const POI_ARCH_PROVENANCE = { goldSha256: '88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256', archSha256: '76435059eaf9e77a507d3f5e111a94236d0ac46121631a18b43b14d3e8c07a85', u05Sha256: '73ec27319ce154b472572eb59e200bd01cf8a5cdcff62a6c9a651c721f3f9e61', count: 81 } as const;
export const POI_ARCH: Record<string, PoiArchSpec> = {
  "po_academy": {
    "id": "po_academy",
    "name": "Argus Academy",
    "arche": "research",
    "atTile": [
      1872,
      524
    ],
    "obbAngle": 0.08,
    "obbTiles": [
      77,
      53
    ],
    "enclosure": "ENCLOSED_MULTI_LAYER",
    "isPilot": true,
    "hasExt": true,
    "extTile": [
      1870,
      550
    ],
    "deepRooms": 1,
    "rooms": [
      {
        "id": "room.po_academy.1.1",
        "cx": 1854,
        "cy": 509,
        "wTiles": 34,
        "hTiles": 22,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": "tile",
        "u05Floor": "floor_stone"
      },
      {
        "id": "room.po_academy.1.2",
        "cx": 1892,
        "cy": 512,
        "wTiles": 34,
        "hTiles": 22,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": "tin",
        "u05Floor": "floor_stone"
      },
      {
        "id": "room.po_academy.2.1",
        "cx": 1852,
        "cy": 536,
        "wTiles": 34,
        "hTiles": 22,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": "tile",
        "u05Floor": "floor_stone"
      },
      {
        "id": "room.po_academy.2.2",
        "cx": 1890,
        "cy": 539,
        "wTiles": 34,
        "hTiles": 22,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": "tin",
        "u05Floor": "floor_stone"
      }
    ]
  },
  "po_observatory": {
    "id": "po_observatory",
    "name": "Argus Observatory",
    "arche": "observatory",
    "atTile": [
      1916,
      340
    ],
    "obbAngle": 0.1,
    "obbTiles": [
      45,
      31
    ],
    "enclosure": "ENCLOSED_SINGLE",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      1915,
      355
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_observatory.1.1",
        "cx": 1905,
        "cy": 339,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_observatory.1.2",
        "cx": 1927,
        "cy": 341,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_archive": {
    "id": "po_archive",
    "name": "Argus Archive Vaults",
    "arche": "facility",
    "atTile": [
      2036,
      452
    ],
    "obbAngle": 0.21,
    "obbTiles": [
      96,
      66
    ],
    "enclosure": "ENCLOSED_MULTI_LAYER",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      1989,
      442
    ],
    "deepRooms": 1,
    "rooms": [
      {
        "id": "room.po_archive.1.1",
        "cx": 2016,
        "cy": 431,
        "wTiles": 44,
        "hTiles": 29,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_archive.1.2",
        "cx": 2063,
        "cy": 441,
        "wTiles": 44,
        "hTiles": 29,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_archive.2.1",
        "cx": 2009,
        "cy": 463,
        "wTiles": 44,
        "hTiles": 29,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_archive.2.2",
        "cx": 2056,
        "cy": 473,
        "wTiles": 44,
        "hTiles": 29,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_hall_eyes": {
    "id": "po_hall_eyes",
    "name": "Hall of Eyes",
    "arche": "elder_site",
    "atTile": [
      1984,
      424
    ],
    "obbAngle": -0.06,
    "obbTiles": [
      109,
      75
    ],
    "enclosure": "ENCLOSED_MULTI_LAYER",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 1,
    "rooms": [
      {
        "id": "room.po_hall_eyes.1.1",
        "cx": 1984,
        "cy": 424,
        "wTiles": 105,
        "hTiles": 71,
        "covered": false,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_lantern": {
    "id": "po_lantern",
    "name": "Lantern Light",
    "arche": "observatory",
    "atTile": [
      2100,
      304
    ],
    "obbAngle": -0.35,
    "obbTiles": [
      45,
      31
    ],
    "enclosure": "ENCLOSED_SINGLE",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      2079,
      312
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_lantern.1.1",
        "cx": 2089,
        "cy": 308,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_lantern.1.2",
        "cx": 2111,
        "cy": 300,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_lanternstn": {
    "id": "po_lanternstn",
    "name": "Lantern Cove Station",
    "arche": "roadstop",
    "atTile": [
      2154,
      624
    ],
    "obbAngle": -0.24,
    "obbTiles": [
      38,
      26
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      2136,
      629
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_lanternstn.1.1",
        "cx": 2145,
        "cy": 626,
        "wTiles": 17,
        "hTiles": 24,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_lanternstn.1.2",
        "cx": 2164,
        "cy": 622,
        "wTiles": 17,
        "hTiles": 24,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_kestrel": {
    "id": "po_kestrel",
    "name": "Kestrel Radio Tower",
    "arche": "facility",
    "atTile": [
      1400,
      600
    ],
    "obbAngle": -0.33,
    "obbTiles": [
      96,
      66
    ],
    "enclosure": "ENCLOSED_MULTI_LAYER",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      1445,
      585
    ],
    "deepRooms": 1,
    "rooms": [
      {
        "id": "room.po_kestrel.1.1",
        "cx": 1372,
        "cy": 592,
        "wTiles": 44,
        "hTiles": 29,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_kestrel.1.2",
        "cx": 1417,
        "cy": 577,
        "wTiles": 44,
        "hTiles": 29,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_kestrel.2.1",
        "cx": 1383,
        "cy": 623,
        "wTiles": 44,
        "hTiles": 29,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_kestrel.2.2",
        "cx": 1428,
        "cy": 608,
        "wTiles": 44,
        "hTiles": 29,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_typhon": {
    "id": "po_typhon",
    "name": "Typhon's Fracture",
    "arche": "elder_site",
    "atTile": [
      1112,
      704
    ],
    "obbAngle": -0.16,
    "obbTiles": [
      109,
      75
    ],
    "enclosure": "ENCLOSED_MULTI_LAYER",
    "isPilot": true,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 1,
    "rooms": [
      {
        "id": "room.po_typhon.1.1",
        "cx": 1112,
        "cy": 704,
        "wTiles": 105,
        "hTiles": 71,
        "covered": false,
        "canopyOnly": false,
        "u05Roof": "tin",
        "u05Floor": "none"
      }
    ]
  },
  "po_viaduct": {
    "id": "po_viaduct",
    "name": "Crushed Viaduct",
    "arche": "ruins",
    "atTile": [
      1310,
      896
    ],
    "obbAngle": -0.31,
    "obbTiles": [
      77,
      53
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_viaduct.1.1",
        "cx": 1288,
        "cy": 889,
        "wTiles": 34,
        "hTiles": 22,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_viaduct.1.2",
        "cx": 1324,
        "cy": 878,
        "wTiles": 34,
        "hTiles": 22,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_viaduct.2.1",
        "cx": 1296,
        "cy": 914,
        "wTiles": 34,
        "hTiles": 22,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_viaduct.2.2",
        "cx": 1332,
        "cy": 903,
        "wTiles": 34,
        "hTiles": 22,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_freightyard": {
    "id": "po_freightyard",
    "name": "Shattered Freight Yard",
    "arche": "ruins",
    "atTile": [
      1380,
      1000
    ],
    "obbAngle": -0.07,
    "obbTiles": [
      77,
      53
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_freightyard.1.1",
        "cx": 1360,
        "cy": 988,
        "wTiles": 34,
        "hTiles": 22,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_freightyard.1.2",
        "cx": 1398,
        "cy": 985,
        "wTiles": 34,
        "hTiles": 22,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_freightyard.2.1",
        "cx": 1362,
        "cy": 1015,
        "wTiles": 34,
        "hTiles": 22,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_freightyard.2.2",
        "cx": 1400,
        "cy": 1012,
        "wTiles": 34,
        "hTiles": 22,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_fracquarry": {
    "id": "po_fracquarry",
    "name": "Fracture Quarry",
    "arche": "quarry",
    "atTile": [
      1200,
      1050
    ],
    "obbAngle": 0.34,
    "obbTiles": [
      90,
      62
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_fracquarry.1.1",
        "cx": 1200,
        "cy": 1050,
        "wTiles": 86,
        "hTiles": 58,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_falls": {
    "id": "po_falls",
    "name": "Falls Powerhouse",
    "arche": "powerplant",
    "atTile": [
      1444,
      876
    ],
    "obbAngle": -0.01,
    "obbTiles": [
      70,
      48
    ],
    "enclosure": "ENCLOSED_MULTI_LAYER",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      1444,
      900
    ],
    "deepRooms": 1,
    "rooms": [
      {
        "id": "room.po_falls.1.1",
        "cx": 1426,
        "cy": 864,
        "wTiles": 31,
        "hTiles": 20,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_falls.1.2",
        "cx": 1462,
        "cy": 864,
        "wTiles": 31,
        "hTiles": 20,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_falls.2.1",
        "cx": 1426,
        "cy": 888,
        "wTiles": 31,
        "hTiles": 20,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_falls.2.2",
        "cx": 1462,
        "cy": 888,
        "wTiles": 31,
        "hTiles": 20,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_greywater": {
    "id": "po_greywater",
    "name": "Greywater Hamlet",
    "arche": "village",
    "atTile": [
      1624,
      1184
    ],
    "obbAngle": 0.35,
    "obbTiles": [
      83,
      57
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": true,
    "hasExt": true,
    "extTile": [
      1634,
      1157
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_greywater.1.1",
        "cx": 1603,
        "cy": 1161,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": "thatch",
        "u05Floor": "floor_wood"
      },
      {
        "id": "room.po_greywater.1.2",
        "cx": 1629,
        "cy": 1171,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": "tile",
        "u05Floor": "floor_wood"
      },
      {
        "id": "room.po_greywater.1.3",
        "cx": 1655,
        "cy": 1180,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": "tin",
        "u05Floor": "floor_wood"
      },
      {
        "id": "room.po_greywater.2.1",
        "cx": 1593,
        "cy": 1188,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": "wood",
        "u05Floor": "floor_wood"
      },
      {
        "id": "room.po_greywater.2.2",
        "cx": 1619,
        "cy": 1197,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": "thatch",
        "u05Floor": "floor_wood"
      },
      {
        "id": "room.po_greywater.2.3",
        "cx": 1645,
        "cy": 1207,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": "tile",
        "u05Floor": "floor_wood"
      }
    ]
  },
  "po_pumphouse": {
    "id": "po_pumphouse",
    "name": "Greywater Pumphouse",
    "arche": "filter",
    "atTile": [
      1700,
      1112
    ],
    "obbAngle": -0.15,
    "obbTiles": [
      51,
      35
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_pumphouse.1.1",
        "cx": 1687,
        "cy": 1114,
        "wTiles": 23,
        "hTiles": 32,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_pumphouse.1.2",
        "cx": 1713,
        "cy": 1110,
        "wTiles": 23,
        "hTiles": 32,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_confluence": {
    "id": "po_confluence",
    "name": "Confluence Waystation",
    "arche": "roadstop",
    "atTile": [
      1836,
      1336
    ],
    "obbAngle": -0.33,
    "obbTiles": [
      38,
      26
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      1832,
      1324
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_confluence.1.1",
        "cx": 1827,
        "cy": 1339,
        "wTiles": 17,
        "hTiles": 24,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_confluence.1.2",
        "cx": 1845,
        "cy": 1333,
        "wTiles": 17,
        "hTiles": 24,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_sawaion": {
    "id": "po_sawaion",
    "name": "Aion Edge Sawmill",
    "arche": "sawmill",
    "atTile": [
      1496,
      1336
    ],
    "obbAngle": -0.12,
    "obbTiles": [
      70,
      48
    ],
    "enclosure": "ENCLOSED_SINGLE",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      1493,
      1312
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_sawaion.1.1",
        "cx": 1477,
        "cy": 1326,
        "wTiles": 31,
        "hTiles": 20,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_sawaion.1.2",
        "cx": 1512,
        "cy": 1322,
        "wTiles": 31,
        "hTiles": 20,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_sawaion.2.1",
        "cx": 1480,
        "cy": 1350,
        "wTiles": 31,
        "hTiles": 20,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_sawaion.2.2",
        "cx": 1515,
        "cy": 1346,
        "wTiles": 31,
        "hTiles": 20,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_mill": {
    "id": "po_mill",
    "name": "Mossbrook Mill",
    "arche": "mill",
    "atTile": [
      2004,
      1460
    ],
    "obbAngle": 0.05,
    "obbTiles": [
      51,
      35
    ],
    "enclosure": "ENCLOSED_SINGLE",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      2003,
      1478
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_mill.1.1",
        "cx": 1992,
        "cy": 1451,
        "wTiles": 23,
        "hTiles": 15,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_mill.1.2",
        "cx": 2017,
        "cy": 1452,
        "wTiles": 23,
        "hTiles": 15,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_mill.2.1",
        "cx": 1991,
        "cy": 1468,
        "wTiles": 23,
        "hTiles": 15,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_mill.2.2",
        "cx": 2016,
        "cy": 1469,
        "wTiles": 23,
        "hTiles": 15,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_kilns": {
    "id": "po_kilns",
    "name": "Charcoal Kilns",
    "arche": "smelter",
    "atTile": [
      1810,
      1570
    ],
    "obbAngle": 0.07,
    "obbTiles": [
      54,
      37
    ],
    "enclosure": "ENCLOSED_SINGLE",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      1783,
      1568
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_kilns.1.1",
        "cx": 1797,
        "cy": 1560,
        "wTiles": 24,
        "hTiles": 16,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_kilns.1.2",
        "cx": 1824,
        "cy": 1562,
        "wTiles": 24,
        "hTiles": 16,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_kilns.2.1",
        "cx": 1796,
        "cy": 1578,
        "wTiles": 24,
        "hTiles": 16,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_kilns.2.2",
        "cx": 1823,
        "cy": 1580,
        "wTiles": 24,
        "hTiles": 16,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_ranger": {
    "id": "po_ranger",
    "name": "Ranger Hut",
    "arche": "hamlet",
    "atTile": [
      1600,
      1520
    ],
    "obbAngle": -0.31,
    "obbTiles": [
      45,
      31
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      1595,
      1505
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_ranger.1.1",
        "cx": 1589,
        "cy": 1523,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_ranger.1.2",
        "cx": 1611,
        "cy": 1517,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_glade": {
    "id": "po_glade",
    "name": "Mosslight Glade",
    "arche": "grove",
    "atTile": [
      1564,
      1410
    ],
    "obbAngle": -0.18,
    "obbTiles": [
      51,
      35
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_glade.1.1",
        "cx": 1564,
        "cy": 1410,
        "wTiles": 48,
        "hTiles": 32,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_sapgrove": {
    "id": "po_sapgrove",
    "name": "Sap Grove",
    "arche": "grove",
    "atTile": [
      1920,
      1280
    ],
    "obbAngle": 0.16,
    "obbTiles": [
      51,
      35
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_sapgrove.1.1",
        "cx": 1920,
        "cy": 1280,
        "wTiles": 48,
        "hTiles": 32,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_elderwood": {
    "id": "po_elderwood",
    "name": "Heart of the Elderwood",
    "arche": "elder_site",
    "atTile": [
      1736,
      1424
    ],
    "obbAngle": -0.34,
    "obbTiles": [
      109,
      75
    ],
    "enclosure": "ENCLOSED_MULTI_LAYER",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 1,
    "rooms": [
      {
        "id": "room.po_elderwood.1.1",
        "cx": 1736,
        "cy": 1424,
        "wTiles": 105,
        "hTiles": 71,
        "covered": false,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_siloc": {
    "id": "po_siloc",
    "name": "Grain Silo Complex",
    "arche": "warehouse",
    "atTile": [
      2180,
      1520
    ],
    "obbAngle": 0.04,
    "obbTiles": [
      64,
      44
    ],
    "enclosure": "ENCLOSED_SINGLE",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      2181,
      1498
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_siloc.1.1",
        "cx": 2159,
        "cy": 1519,
        "wTiles": 18,
        "hTiles": 40,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_siloc.1.2",
        "cx": 2180,
        "cy": 1520,
        "wTiles": 18,
        "hTiles": 40,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_siloc.1.3",
        "cx": 2201,
        "cy": 1521,
        "wTiles": 18,
        "hTiles": 40,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_meridian": {
    "id": "po_meridian",
    "name": "Meridian Research Station",
    "arche": "research",
    "atTile": [
      2240,
      1380
    ],
    "obbAngle": -0.09,
    "obbTiles": [
      77,
      53
    ],
    "enclosure": "ENCLOSED_MULTI_LAYER",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      2238,
      1354
    ],
    "deepRooms": 1,
    "rooms": [
      {
        "id": "room.po_meridian.1.1",
        "cx": 2220,
        "cy": 1369,
        "wTiles": 34,
        "hTiles": 22,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_meridian.1.2",
        "cx": 2258,
        "cy": 1365,
        "wTiles": 34,
        "hTiles": 22,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_meridian.2.1",
        "cx": 2222,
        "cy": 1395,
        "wTiles": 34,
        "hTiles": 22,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_meridian.2.2",
        "cx": 2260,
        "cy": 1391,
        "wTiles": 34,
        "hTiles": 22,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_oldpump": {
    "id": "po_oldpump",
    "name": "Old Pumping Plant",
    "arche": "facility",
    "atTile": [
      1700,
      1970
    ],
    "obbAngle": -0.22,
    "obbTiles": [
      96,
      66
    ],
    "enclosure": "ENCLOSED_MULTI_LAYER",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      1693,
      1938
    ],
    "deepRooms": 1,
    "rooms": [
      {
        "id": "room.po_oldpump.1.1",
        "cx": 1673,
        "cy": 1959,
        "wTiles": 44,
        "hTiles": 29,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_oldpump.1.2",
        "cx": 1720,
        "cy": 1949,
        "wTiles": 44,
        "hTiles": 29,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_oldpump.2.1",
        "cx": 1680,
        "cy": 1991,
        "wTiles": 44,
        "hTiles": 29,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_oldpump.2.2",
        "cx": 1727,
        "cy": 1981,
        "wTiles": 44,
        "hTiles": 29,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_strait": {
    "id": "po_strait",
    "name": "Strait Landing",
    "arche": "port",
    "atTile": [
      2536,
      980
    ],
    "obbAngle": 0.19,
    "obbTiles": [
      77,
      53
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      2541,
      954
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_strait.1.1",
        "cx": 2517,
        "cy": 976,
        "wTiles": 34,
        "hTiles": 49,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_strait.1.2",
        "cx": 2555,
        "cy": 984,
        "wTiles": 34,
        "hTiles": 49,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_ironvein": {
    "id": "po_ironvein",
    "name": "Ironvein Mine",
    "arche": "mine",
    "atTile": [
      2410,
      1310
    ],
    "obbAngle": 0.14,
    "obbTiles": [
      83,
      57
    ],
    "enclosure": "ENCLOSED_MULTI_LAYER",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      2414,
      1282
    ],
    "deepRooms": 1,
    "rooms": [
      {
        "id": "room.po_ironvein.1.1",
        "cx": 2389,
        "cy": 1307,
        "wTiles": 38,
        "hTiles": 53,
        "covered": false,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_ironvein.1.2",
        "cx": 2431,
        "cy": 1313,
        "wTiles": 38,
        "hTiles": 53,
        "covered": false,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_ridgestop": {
    "id": "po_ridgestop",
    "name": "Ridge Pass Station",
    "arche": "roadstop",
    "atTile": [
      2356,
      1156
    ],
    "obbAngle": -0.37,
    "obbTiles": [
      38,
      26
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      2374,
      1149
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_ridgestop.1.1",
        "cx": 2347,
        "cy": 1159,
        "wTiles": 17,
        "hTiles": 24,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_ridgestop.1.2",
        "cx": 2365,
        "cy": 1153,
        "wTiles": 17,
        "hTiles": 24,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_rapids": {
    "id": "po_rapids",
    "name": "Rapids Portage Hut",
    "arche": "roadstop",
    "atTile": [
      2300,
      924
    ],
    "obbAngle": -0.09,
    "obbTiles": [
      38,
      26
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      2281,
      926
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_rapids.1.1",
        "cx": 2290,
        "cy": 925,
        "wTiles": 17,
        "hTiles": 24,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_rapids.1.2",
        "cx": 2310,
        "cy": 923,
        "wTiles": 17,
        "hTiles": 24,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_hook": {
    "id": "po_hook",
    "name": "Hook Village",
    "arche": "village",
    "atTile": [
      2600,
      670
    ],
    "obbAngle": -0.31,
    "obbTiles": [
      83,
      57
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      2591,
      643
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_hook.1.1",
        "cx": 2569,
        "cy": 665,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_hook.1.2",
        "cx": 2596,
        "cy": 656,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_hook.1.3",
        "cx": 2622,
        "cy": 648,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_hook.2.1",
        "cx": 2578,
        "cy": 692,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_hook.2.2",
        "cx": 2604,
        "cy": 684,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_hook.2.3",
        "cx": 2631,
        "cy": 675,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_mere": {
    "id": "po_mere",
    "name": "Hook Mere Pier",
    "arche": "pier",
    "atTile": [
      2500,
      736
    ],
    "obbAngle": -0.18,
    "obbTiles": [
      32,
      22
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_mere.1.1",
        "cx": 2500,
        "cy": 736,
        "wTiles": 30,
        "hTiles": 20,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_timberyard": {
    "id": "po_timberyard",
    "name": "Verdant Timberyard",
    "arche": "sawmill",
    "atTile": [
      2044,
      908
    ],
    "obbAngle": 0.33,
    "obbTiles": [
      70,
      48
    ],
    "enclosure": "ENCLOSED_SINGLE",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      2052,
      885
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_timberyard.1.1",
        "cx": 2031,
        "cy": 891,
        "wTiles": 31,
        "hTiles": 20,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_timberyard.1.2",
        "cx": 2065,
        "cy": 902,
        "wTiles": 31,
        "hTiles": 20,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_timberyard.2.1",
        "cx": 2023,
        "cy": 914,
        "wTiles": 31,
        "hTiles": 20,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_timberyard.2.2",
        "cx": 2057,
        "cy": 925,
        "wTiles": 31,
        "hTiles": 20,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_ember": {
    "id": "po_ember",
    "name": "Emberport",
    "arche": "port",
    "atTile": [
      2488,
      1676
    ],
    "obbAngle": -0.11,
    "obbTiles": [
      77,
      53
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      2450,
      1680
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_ember.1.1",
        "cx": 2469,
        "cy": 1678,
        "wTiles": 34,
        "hTiles": 49,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_ember.1.2",
        "cx": 2507,
        "cy": 1674,
        "wTiles": 34,
        "hTiles": 49,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_slag": {
    "id": "po_slag",
    "name": "Slagworks Foundry",
    "arche": "smelter",
    "atTile": [
      2380,
      1872
    ],
    "obbAngle": 0.03,
    "obbTiles": [
      77,
      53
    ],
    "enclosure": "ENCLOSED_SINGLE",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      2379,
      1898
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_slag.1.1",
        "cx": 2361,
        "cy": 1858,
        "wTiles": 34,
        "hTiles": 22,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_slag.1.2",
        "cx": 2400,
        "cy": 1859,
        "wTiles": 34,
        "hTiles": 22,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_slag.2.1",
        "cx": 2360,
        "cy": 1885,
        "wTiles": 34,
        "hTiles": 22,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_slag.2.2",
        "cx": 2399,
        "cy": 1886,
        "wTiles": 34,
        "hTiles": 22,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_southfoot": {
    "id": "po_southfoot",
    "name": "Southfoot Landing",
    "arche": "port",
    "atTile": [
      2392,
      2140
    ],
    "obbAngle": -0.13,
    "obbTiles": [
      77,
      53
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      2389,
      2114
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_southfoot.1.1",
        "cx": 2373,
        "cy": 2142,
        "wTiles": 34,
        "hTiles": 49,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_southfoot.1.2",
        "cx": 2411,
        "cy": 2138,
        "wTiles": 34,
        "hTiles": 49,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_gulfhead": {
    "id": "po_gulfhead",
    "name": "Gulfhead",
    "arche": "port",
    "atTile": [
      2104,
      1756
    ],
    "obbAngle": 0.02,
    "obbTiles": [
      92,
      63
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      2105,
      1724
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_gulfhead.1.1",
        "cx": 2081,
        "cy": 1755,
        "wTiles": 42,
        "hTiles": 59,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_gulfhead.1.2",
        "cx": 2127,
        "cy": 1757,
        "wTiles": 42,
        "hTiles": 59,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_filter": {
    "id": "po_filter",
    "name": "Delta Sluice & Filter Station",
    "arche": "filter",
    "atTile": [
      1868,
      1736
    ],
    "obbAngle": 0.17,
    "obbTiles": [
      51,
      35
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_filter.1.1",
        "cx": 1855,
        "cy": 1734,
        "wTiles": 23,
        "hTiles": 32,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_filter.1.2",
        "cx": 1881,
        "cy": 1738,
        "wTiles": 23,
        "hTiles": 32,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_westbank": {
    "id": "po_westbank",
    "name": "Westbank Landing",
    "arche": "pier",
    "atTile": [
      1836,
      1860
    ],
    "obbAngle": 0.07,
    "obbTiles": [
      32,
      22
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_westbank.1.1",
        "cx": 1836,
        "cy": 1860,
        "wTiles": 30,
        "hTiles": 20,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_westmouth": {
    "id": "po_westmouth",
    "name": "Westmouth",
    "arche": "port",
    "atTile": [
      704,
      1112
    ],
    "obbAngle": -0.22,
    "obbTiles": [
      77,
      53
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": true,
    "hasExt": true,
    "extTile": [
      710,
      1138
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_westmouth.1.1",
        "cx": 685,
        "cy": 1116,
        "wTiles": 34,
        "hTiles": 49,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": "wood",
        "u05Floor": "floor_wood"
      },
      {
        "id": "room.po_westmouth.1.2",
        "cx": 723,
        "cy": 1108,
        "wTiles": 34,
        "hTiles": 49,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": "tin",
        "u05Floor": "floor_wood"
      }
    ]
  },
  "po_greyquarry": {
    "id": "po_greyquarry",
    "name": "Greyback Quarry",
    "arche": "quarry",
    "atTile": [
      1012,
      1304
    ],
    "obbAngle": 0.36,
    "obbTiles": [
      90,
      62
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_greyquarry.1.1",
        "cx": 1012,
        "cy": 1304,
        "wTiles": 86,
        "hTiles": 58,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_westwood": {
    "id": "po_westwood",
    "name": "Westwood Hamlet",
    "arche": "hamlet",
    "atTile": [
      848,
      1484
    ],
    "obbAngle": -0.31,
    "obbTiles": [
      45,
      31
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      843,
      1469
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_westwood.1.1",
        "cx": 837,
        "cy": 1487,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_westwood.1.2",
        "cx": 859,
        "cy": 1481,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_fishcamp": {
    "id": "po_fishcamp",
    "name": "Fish Camp",
    "arche": "hamlet",
    "atTile": [
      704,
      1692
    ],
    "obbAngle": -0.13,
    "obbTiles": [
      45,
      31
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      702,
      1677
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_fishcamp.1.1",
        "cx": 693,
        "cy": 1693,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_fishcamp.1.2",
        "cx": 715,
        "cy": 1691,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_necropolis": {
    "id": "po_necropolis",
    "name": "Necropolis of the Hollow Sun",
    "arche": "elder_site",
    "atTile": [
      1208,
      2084
    ],
    "obbAngle": 0.08,
    "obbTiles": [
      109,
      75
    ],
    "enclosure": "ENCLOSED_MULTI_LAYER",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 1,
    "rooms": [
      {
        "id": "room.po_necropolis.1.1",
        "cx": 1208,
        "cy": 2084,
        "wTiles": 105,
        "hTiles": 71,
        "covered": false,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_tombs": {
    "id": "po_tombs",
    "name": "Dune Tombs",
    "arche": "tomb",
    "atTile": [
      1040,
      2172
    ],
    "obbAngle": 0.07,
    "obbTiles": [
      70,
      48
    ],
    "enclosure": "ENCLOSED_MULTI_LAYER",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      1005,
      2170
    ],
    "deepRooms": 1,
    "rooms": [
      {
        "id": "room.po_tombs.1.1",
        "cx": 1022,
        "cy": 2171,
        "wTiles": 31,
        "hTiles": 45,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_tombs.1.2",
        "cx": 1058,
        "cy": 2173,
        "wTiles": 31,
        "hTiles": 45,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_cairns": {
    "id": "po_cairns",
    "name": "Sunken Cairns",
    "arche": "ruins",
    "atTile": [
      940,
      1980
    ],
    "obbAngle": 0.31,
    "obbTiles": [
      77,
      53
    ],
    "enclosure": "ENCLOSED_MULTI_LAYER",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 1,
    "rooms": [
      {
        "id": "room.po_cairns.1.1",
        "cx": 926,
        "cy": 1962,
        "wTiles": 34,
        "hTiles": 22,
        "covered": false,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_cairns.1.2",
        "cx": 962,
        "cy": 1973,
        "wTiles": 34,
        "hTiles": 22,
        "covered": false,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_cairns.2.1",
        "cx": 918,
        "cy": 1987,
        "wTiles": 34,
        "hTiles": 22,
        "covered": false,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_cairns.2.2",
        "cx": 954,
        "cy": 1998,
        "wTiles": 34,
        "hTiles": 22,
        "covered": false,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_oasis": {
    "id": "po_oasis",
    "name": "Mirage Camp",
    "arche": "village",
    "atTile": [
      1336,
      1968
    ],
    "obbAngle": -0.05,
    "obbTiles": [
      83,
      57
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      1378,
      1966
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_oasis.1.1",
        "cx": 1308,
        "cy": 1955,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_oasis.1.2",
        "cx": 1335,
        "cy": 1954,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_oasis.1.3",
        "cx": 1363,
        "cy": 1952,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_oasis.2.1",
        "cx": 1309,
        "cy": 1984,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_oasis.2.2",
        "cx": 1337,
        "cy": 1982,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_oasis.2.3",
        "cx": 1364,
        "cy": 1981,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_bonestop": {
    "id": "po_bonestop",
    "name": "Bone Road Waystation",
    "arche": "roadstop",
    "atTile": [
      1504,
      1950
    ],
    "obbAngle": -0.05,
    "obbTiles": [
      38,
      26
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      1523,
      1949
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_bonestop.1.1",
        "cx": 1494,
        "cy": 1950,
        "wTiles": 17,
        "hTiles": 24,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_bonestop.1.2",
        "cx": 1514,
        "cy": 1950,
        "wTiles": 17,
        "hTiles": 24,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_sandgate": {
    "id": "po_sandgate",
    "name": "Sandgate",
    "arche": "port",
    "atTile": [
      1408,
      2248
    ],
    "obbAngle": -0.36,
    "obbTiles": [
      77,
      53
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      1399,
      2223
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_sandgate.1.1",
        "cx": 1390,
        "cy": 2255,
        "wTiles": 34,
        "hTiles": 49,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_sandgate.1.2",
        "cx": 1426,
        "cy": 2241,
        "wTiles": 34,
        "hTiles": 49,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_gate": {
    "id": "po_gate",
    "name": "Threshold Gate",
    "arche": "gate",
    "atTile": [
      336,
      1024
    ],
    "obbAngle": -0.23,
    "obbTiles": [
      70,
      48
    ],
    "enclosure": "ENCLOSED_MULTI_LAYER",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      341,
      1048
    ],
    "deepRooms": 1,
    "rooms": [
      {
        "id": "room.po_gate.1.1",
        "cx": 336,
        "cy": 1024,
        "wTiles": 67,
        "hTiles": 45,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_dpier": {
    "id": "po_dpier",
    "name": "Drowned Pier",
    "arche": "pier",
    "atTile": [
      452,
      1040
    ],
    "obbAngle": 0.01,
    "obbTiles": [
      32,
      22
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_dpier.1.1",
        "cx": 452,
        "cy": 1040,
        "wTiles": 30,
        "hTiles": 20,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_beacon": {
    "id": "po_beacon",
    "name": "Beacon Rock Light",
    "arche": "observatory",
    "atTile": [
      536,
      1312
    ],
    "obbAngle": 0.14,
    "obbTiles": [
      45,
      31
    ],
    "enclosure": "ENCLOSED_SINGLE",
    "isPilot": true,
    "hasExt": true,
    "extTile": [
      538,
      1297
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_beacon.1.1",
        "cx": 525,
        "cy": 1310,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": "tile",
        "u05Floor": "floor_stone"
      },
      {
        "id": "room.po_beacon.1.2",
        "cx": 547,
        "cy": 1314,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_wreck": {
    "id": "po_wreck",
    "name": "Wreck Isle Salvage",
    "arche": "ruins",
    "atTile": [
      368,
      1744
    ],
    "obbAngle": 0.17,
    "obbTiles": [
      77,
      53
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_wreck.1.1",
        "cx": 351,
        "cy": 1728,
        "wTiles": 34,
        "hTiles": 22,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_wreck.1.2",
        "cx": 389,
        "cy": 1734,
        "wTiles": 34,
        "hTiles": 22,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_wreck.2.1",
        "cx": 347,
        "cy": 1754,
        "wTiles": 34,
        "hTiles": 22,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_wreck.2.2",
        "cx": 385,
        "cy": 1760,
        "wTiles": 34,
        "hTiles": 22,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_tidecamp": {
    "id": "po_tidecamp",
    "name": "Tidepool Fishing Camp",
    "arche": "hamlet",
    "atTile": [
      340,
      1096
    ],
    "obbAngle": 0.02,
    "obbTiles": [
      45,
      31
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      340,
      1081
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_tidecamp.1.1",
        "cx": 329,
        "cy": 1096,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_tidecamp.1.2",
        "cx": 351,
        "cy": 1096,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_gullnest": {
    "id": "po_gullnest",
    "name": "Seabird Nesting Cliffs",
    "arche": "grove",
    "atTile": [
      3744,
      856
    ],
    "obbAngle": 0.3,
    "obbTiles": [
      51,
      35
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_gullnest.1.1",
        "cx": 3744,
        "cy": 856,
        "wTiles": 48,
        "hTiles": 32,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_gullpier": {
    "id": "po_gullpier",
    "name": "Tern Hut Pier",
    "arche": "pier",
    "atTile": [
      3724,
      940
    ],
    "obbAngle": -0.16,
    "obbTiles": [
      32,
      22
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_gullpier.1.1",
        "cx": 3724,
        "cy": 940,
        "wTiles": 30,
        "hTiles": 20,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_netcamp": {
    "id": "po_netcamp",
    "name": "Gull Net Camp",
    "arche": "hamlet",
    "atTile": [
      280,
      1696
    ],
    "obbAngle": -0.27,
    "obbTiles": [
      45,
      31
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      284,
      1711
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_netcamp.1.1",
        "cx": 269,
        "cy": 1699,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_netcamp.1.2",
        "cx": 291,
        "cy": 1693,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_cindercamp": {
    "id": "po_cindercamp",
    "name": "Cinder Camp",
    "arche": "village",
    "atTile": [
      3192,
      1768
    ],
    "obbAngle": -0.05,
    "obbTiles": [
      83,
      57
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      3150,
      1770
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_cindercamp.1.1",
        "cx": 3164,
        "cy": 1755,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_cindercamp.1.2",
        "cx": 3191,
        "cy": 1754,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_cindercamp.1.3",
        "cx": 3219,
        "cy": 1752,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_cindercamp.2.1",
        "cx": 3165,
        "cy": 1784,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_cindercamp.2.2",
        "cx": 3193,
        "cy": 1782,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_cindercamp.2.3",
        "cx": 3220,
        "cy": 1781,
        "wTiles": 24,
        "hTiles": 25,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_obsq": {
    "id": "po_obsq",
    "name": "Obsidian Quarry",
    "arche": "quarry",
    "atTile": [
      3300,
      1552
    ],
    "obbAngle": 0.37,
    "obbTiles": [
      90,
      62
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_obsq.1.1",
        "cx": 3300,
        "cy": 1552,
        "wTiles": 86,
        "hTiles": 58,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_sulfur": {
    "id": "po_sulfur",
    "name": "Sulfur Works",
    "arche": "mine",
    "atTile": [
      3536,
      1764
    ],
    "obbAngle": 0.27,
    "obbTiles": [
      83,
      57
    ],
    "enclosure": "ENCLOSED_MULTI_LAYER",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      3528,
      1792
    ],
    "deepRooms": 1,
    "rooms": [
      {
        "id": "room.po_sulfur.1.1",
        "cx": 3516,
        "cy": 1758,
        "wTiles": 38,
        "hTiles": 53,
        "covered": false,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_sulfur.1.2",
        "cx": 3556,
        "cy": 1770,
        "wTiles": 38,
        "hTiles": 53,
        "covered": false,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_geo": {
    "id": "po_geo",
    "name": "Geothermal Station",
    "arche": "powerplant",
    "atTile": [
      3472,
      1832
    ],
    "obbAngle": -0.39,
    "obbTiles": [
      70,
      48
    ],
    "enclosure": "ENCLOSED_MULTI_LAYER",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      3481,
      1854
    ],
    "deepRooms": 1,
    "rooms": [
      {
        "id": "room.po_geo.1.1",
        "cx": 3451,
        "cy": 1828,
        "wTiles": 31,
        "hTiles": 20,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_geo.1.2",
        "cx": 3484,
        "cy": 1814,
        "wTiles": 31,
        "hTiles": 20,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_geo.2.1",
        "cx": 3460,
        "cy": 1850,
        "wTiles": 31,
        "hTiles": 20,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_geo.2.2",
        "cx": 3493,
        "cy": 1836,
        "wTiles": 31,
        "hTiles": 20,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_emberwatch": {
    "id": "po_emberwatch",
    "name": "Ember Watch",
    "arche": "observatory",
    "atTile": [
      3240,
      1492
    ],
    "obbAngle": 0.06,
    "obbTiles": [
      45,
      31
    ],
    "enclosure": "ENCLOSED_SINGLE",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      3239,
      1507
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_emberwatch.1.1",
        "cx": 3229,
        "cy": 1491,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_emberwatch.1.2",
        "cx": 3251,
        "cy": 1493,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_surtur": {
    "id": "po_surtur",
    "name": "Foundry of the First Fire",
    "arche": "elder_site",
    "atTile": [
      3388,
      1652
    ],
    "obbAngle": -0.38,
    "obbTiles": [
      109,
      75
    ],
    "enclosure": "ENCLOSED_MULTI_LAYER",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 1,
    "rooms": [
      {
        "id": "room.po_surtur.1.1",
        "cx": 3388,
        "cy": 1652,
        "wTiles": 105,
        "hTiles": 71,
        "covered": false,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_saltharbor": {
    "id": "po_saltharbor",
    "name": "Saltwick Harbor",
    "arche": "port",
    "atTile": [
      3092,
      668
    ],
    "obbAngle": 0.34,
    "obbTiles": [
      77,
      53
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      3128,
      681
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_saltharbor.1.1",
        "cx": 3074,
        "cy": 662,
        "wTiles": 34,
        "hTiles": 49,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_saltharbor.1.2",
        "cx": 3110,
        "cy": 674,
        "wTiles": 34,
        "hTiles": 49,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_saltpans": {
    "id": "po_saltpans",
    "name": "Salt Pans",
    "arche": "quarry",
    "atTile": [
      3280,
      644
    ],
    "obbAngle": -0.16,
    "obbTiles": [
      90,
      62
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_saltpans.1.1",
        "cx": 3280,
        "cy": 644,
        "wTiles": 86,
        "hTiles": 58,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_saltlight": {
    "id": "po_saltlight",
    "name": "Saltwick Light",
    "arche": "observatory",
    "atTile": [
      3464,
      524
    ],
    "obbAngle": -0.07,
    "obbTiles": [
      45,
      31
    ],
    "enclosure": "ENCLOSED_SINGLE",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      3465,
      539
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_saltlight.1.1",
        "cx": 3453,
        "cy": 525,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_saltlight.1.2",
        "cx": 3475,
        "cy": 523,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_racks": {
    "id": "po_racks",
    "name": "Kelp Racks",
    "arche": "hamlet",
    "atTile": [
      3380,
      708
    ],
    "obbAngle": 0.18,
    "obbTiles": [
      45,
      31
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      3383,
      693
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_racks.1.1",
        "cx": 3369,
        "cy": 706,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_racks.1.2",
        "cx": 3391,
        "cy": 710,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_gullwreck": {
    "id": "po_gullwreck",
    "name": "Gull Isle Wreck",
    "arche": "ruins",
    "atTile": [
      3772,
      892
    ],
    "obbAngle": 0.26,
    "obbTiles": [
      77,
      53
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_gullwreck.1.1",
        "cx": 3757,
        "cy": 874,
        "wTiles": 34,
        "hTiles": 22,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_gullwreck.1.2",
        "cx": 3794,
        "cy": 884,
        "wTiles": 34,
        "hTiles": 22,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_gullwreck.2.1",
        "cx": 3750,
        "cy": 900,
        "wTiles": 34,
        "hTiles": 22,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_gullwreck.2.2",
        "cx": 3787,
        "cy": 910,
        "wTiles": 34,
        "hTiles": 22,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_ironharbor": {
    "id": "po_ironharbor",
    "name": "Ironholm Harbor",
    "arche": "port",
    "atTile": [
      2216,
      2528
    ],
    "obbAngle": 0.24,
    "obbTiles": [
      77,
      53
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      2253,
      2537
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_ironharbor.1.1",
        "cx": 2197,
        "cy": 2523,
        "wTiles": 34,
        "hTiles": 49,
        "covered": true,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_ironharbor.1.2",
        "cx": 2235,
        "cy": 2533,
        "wTiles": 34,
        "hTiles": 49,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_ironmine": {
    "id": "po_ironmine",
    "name": "Ironholm Mine",
    "arche": "mine",
    "atTile": [
      2372,
      2580
    ],
    "obbAngle": 0.27,
    "obbTiles": [
      83,
      57
    ],
    "enclosure": "ENCLOSED_MULTI_LAYER",
    "isPilot": true,
    "hasExt": true,
    "extTile": [
      2332,
      2569
    ],
    "deepRooms": 1,
    "rooms": [
      {
        "id": "room.po_ironmine.1.1",
        "cx": 2352,
        "cy": 2574,
        "wTiles": 38,
        "hTiles": 53,
        "covered": false,
        "canopyOnly": false,
        "u05Roof": "tin",
        "u05Floor": "none"
      },
      {
        "id": "room.po_ironmine.1.2",
        "cx": 2392,
        "cy": 2586,
        "wTiles": 38,
        "hTiles": 53,
        "covered": false,
        "canopyOnly": false,
        "u05Roof": "tin",
        "u05Floor": "none"
      }
    ]
  },
  "po_ironwh": {
    "id": "po_ironwh",
    "name": "Ironholm Depot",
    "arche": "warehouse",
    "atTile": [
      2472,
      2580
    ],
    "obbAngle": -0.39,
    "obbTiles": [
      64,
      44
    ],
    "enclosure": "ENCLOSED_SINGLE",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      2442,
      2592
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_ironwh.1.1",
        "cx": 2452,
        "cy": 2588,
        "wTiles": 18,
        "hTiles": 40,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_ironwh.1.2",
        "cx": 2472,
        "cy": 2580,
        "wTiles": 18,
        "hTiles": 40,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_ironwh.1.3",
        "cx": 2492,
        "cy": 2572,
        "wTiles": 18,
        "hTiles": 40,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_rc_meridian": {
    "id": "po_rc_meridian",
    "name": "Meridian Archive Cache",
    "arche": "ragnarok_cache",
    "atTile": [
      2276,
      1336
    ],
    "obbAngle": 0.28,
    "obbTiles": [
      45,
      31
    ],
    "enclosure": "ENCLOSED_SINGLE",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      2280,
      1321
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_rc_meridian.1.1",
        "cx": 2265,
        "cy": 1333,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_rc_meridian.1.2",
        "cx": 2287,
        "cy": 1339,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_rc_ironvein": {
    "id": "po_rc_ironvein",
    "name": "Foreman's Strongbox",
    "arche": "ragnarok_cache",
    "atTile": [
      2444,
      1352
    ],
    "obbAngle": -0.01,
    "obbTiles": [
      45,
      31
    ],
    "enclosure": "ENCLOSED_SINGLE",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      2444,
      1337
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_rc_ironvein.1.1",
        "cx": 2433,
        "cy": 1352,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_rc_ironvein.1.2",
        "cx": 2455,
        "cy": 1352,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_rc_kestrel": {
    "id": "po_rc_kestrel",
    "name": "Kestrel Tower Safe",
    "arche": "ragnarok_cache",
    "atTile": [
      1416,
      636
    ],
    "obbAngle": -0.38,
    "obbTiles": [
      45,
      31
    ],
    "enclosure": "ENCLOSED_SINGLE",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      1437,
      628
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_rc_kestrel.1.1",
        "cx": 1406,
        "cy": 640,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_rc_kestrel.1.2",
        "cx": 1426,
        "cy": 632,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_rc_dam": {
    "id": "po_rc_dam",
    "name": "Falls Dam Vault",
    "arche": "ragnarok_cache",
    "atTile": [
      1508,
      908
    ],
    "obbAngle": -0.18,
    "obbTiles": [
      45,
      31
    ],
    "enclosure": "ENCLOSED_SINGLE",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      1511,
      923
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_rc_dam.1.1",
        "cx": 1497,
        "cy": 910,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_rc_dam.1.2",
        "cx": 1519,
        "cy": 906,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_rc_sandgate": {
    "id": "po_rc_sandgate",
    "name": "Sandgate Customs Strongbox",
    "arche": "ragnarok_cache",
    "atTile": [
      1436,
      2212
    ],
    "obbAngle": -0.29,
    "obbTiles": [
      45,
      31
    ],
    "enclosure": "ENCLOSED_SINGLE",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      1415,
      2218
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_rc_sandgate.1.1",
        "cx": 1425,
        "cy": 2215,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_rc_sandgate.1.2",
        "cx": 1447,
        "cy": 2209,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_rc_salt": {
    "id": "po_rc_salt",
    "name": "Saltwick Harbor Safe",
    "arche": "ragnarok_cache",
    "atTile": [
      3120,
      644
    ],
    "obbAngle": -0.09,
    "obbTiles": [
      45,
      31
    ],
    "enclosure": "ENCLOSED_SINGLE",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      3121,
      659
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_rc_salt.1.1",
        "cx": 3109,
        "cy": 645,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      },
      {
        "id": "room.po_rc_salt.1.2",
        "cx": 3131,
        "cy": 643,
        "wTiles": 20,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_vend_gulf": {
    "id": "po_vend_gulf",
    "name": "Gulfhead Trading House [ĐỀ XUẤT]",
    "arche": "chest_vendor",
    "atTile": [
      2132,
      1788
    ],
    "obbAngle": -0.04,
    "obbTiles": [
      45,
      31
    ],
    "enclosure": "ENCLOSED_SINGLE",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      2110,
      1789
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_vend_gulf.1.1",
        "cx": 2132,
        "cy": 1788,
        "wTiles": 42,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_vend_strait": {
    "id": "po_vend_strait",
    "name": "Strait Landing Counter [ĐỀ XUẤT]",
    "arche": "chest_vendor",
    "atTile": [
      2572,
      1000
    ],
    "obbAngle": -0.29,
    "obbTiles": [
      45,
      31
    ],
    "enclosure": "ENCLOSED_SINGLE",
    "isPilot": false,
    "hasExt": true,
    "extTile": [
      2551,
      1006
    ],
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_vend_strait.1.1",
        "cx": 2572,
        "cy": 1000,
        "wTiles": 42,
        "hTiles": 28,
        "covered": true,
        "canopyOnly": false,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_evac_west": {
    "id": "po_evac_west",
    "name": "Westmouth Evac Pier",
    "arche": "evac",
    "atTile": [
      684,
      1160
    ],
    "obbAngle": -0.08,
    "obbTiles": [
      51,
      35
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_evac_west.1.1",
        "cx": 684,
        "cy": 1160,
        "wTiles": 48,
        "hTiles": 32,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_evac_south": {
    "id": "po_evac_south",
    "name": "Southfoot Evac Beach",
    "arche": "evac",
    "atTile": [
      2356,
      2180
    ],
    "obbAngle": -0.11,
    "obbTiles": [
      51,
      35
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_evac_south.1.1",
        "cx": 2356,
        "cy": 2180,
        "wTiles": 48,
        "hTiles": 32,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  },
  "po_evac_hook": {
    "id": "po_evac_hook",
    "name": "Hook Evac Point",
    "arche": "evac",
    "atTile": [
      2784,
      748
    ],
    "obbAngle": -0.1,
    "obbTiles": [
      51,
      35
    ],
    "enclosure": "OPEN_AIR_YARD",
    "isPilot": false,
    "hasExt": false,
    "extTile": null,
    "deepRooms": 0,
    "rooms": [
      {
        "id": "room.po_evac_hook.1.1",
        "cx": 2784,
        "cy": 748,
        "wTiles": 48,
        "hTiles": 32,
        "covered": false,
        "canopyOnly": true,
        "u05Roof": null,
        "u05Floor": null
      }
    ]
  }
};
