// Selected full-resolution, byte-identical owner assets: c0577f429c8317a15d57b330ce79384dfa801b84.
import u0 from './owner-assets/arcane/arcane-beam/combined-0.png?url';
import u1 from './owner-assets/arcane/arcane-beam/light-0.png?url';
import u2 from './owner-assets/arcane/blink-in/combined-0.png?url';
import u3 from './owner-assets/arcane/blink-in/light-0.png?url';
import u4 from './owner-assets/arcane/blink-out/combined-0.png?url';
import u5 from './owner-assets/arcane/blink-out/light-0.png?url';
import u6 from './owner-assets/arcane/mana-burst/combined-0.png?url';
import u7 from './owner-assets/arcane/mana-burst/light-0.png?url';
import u8 from './owner-assets/fire/fire-breath/combined-0.png?url';
import u9 from './owner-assets/fire/fire-breath/light-0.png?url';
import u10 from './owner-assets/fire/fire-tornado/combined-0.png?url';
import u11 from './owner-assets/fire/fire-tornado/light-0.png?url';
import u12 from './owner-assets/ice/ice-shatter/combined-0.png?url';
import u13 from './owner-assets/ice/ice-shatter/light-0.png?url';
import u14 from './owner-assets/ice/snowflake-burst/combined-0.png?url';
import u15 from './owner-assets/ice/snowflake-burst/light-0.png?url';
import u16 from './owner-assets/lightning/lightning-strike/combined-0.png?url';
import u17 from './owner-assets/lightning/lightning-strike/combined-1.png?url';
import u18 from './owner-assets/lightning/lightning-strike/light-0.png?url';
import u19 from './owner-assets/lightning/lightning-strike/light-1.png?url';
import u20 from './owner-assets/nature/leaf-storm/combined-0.png?url';
import u21 from './owner-assets/nature/leaf-storm/light-0.png?url';
export const OWNER_VFX = [
  {
    "id": "arcane/arcane-beam",
    "category": "arcane",
    "name": "Arcane beam",
    "meta": {
      "fps": 30,
      "duration": 1.2,
      "loop": true,
      "size": [
        264,
        100
      ],
      "origin": [
        26,
        84
      ],
      "bg": "ground"
    },
    "presentation": {
      "roleCandidate": "combat/ambient (TBD)",
      "anchor": "act",
      "depth": "back-front",
      "emissiveNight": "post-night",
      "sceneInteraction": "none",
      "extraShapes": false
    },
    "export": {
      "state": "PARITY_PASS",
      "frames": 36,
      "fps": 30,
      "frameSize": [
        264,
        100
      ],
      "pivot": [
        26,
        84
      ],
      "coreBounds": [
        24,
        11,
        233,
        82
      ],
      "focalPoint": [
        134.4,
        59.1
      ],
      "lightEnergy": 26.1558,
      "pages": {
        "combined": [
          {
            "path": u0,
            "first": 0,
            "count": 36,
            "columns": 7,
            "rows": 6,
            "dimensions": [
              1848,
              600
            ]
          }
        ],
        "light": [
          {
            "path": u1,
            "first": 0,
            "count": 36,
            "columns": 7,
            "rows": 6,
            "dimensions": [
              1848,
              600
            ]
          }
        ]
      }
    }
  },
  {
    "id": "arcane/blink-in",
    "category": "arcane",
    "name": "Blink in",
    "meta": {
      "fps": 30,
      "duration": 1.4,
      "loop": false,
      "size": [
        136,
        96
      ],
      "origin": [
        68,
        80
      ],
      "bg": "ground"
    },
    "presentation": {
      "roleCandidate": "combat/ambient (TBD)",
      "anchor": "body",
      "depth": "back-front",
      "emissiveNight": "post-night",
      "sceneInteraction": "none",
      "extraShapes": false
    },
    "export": {
      "state": "PARITY_PASS",
      "frames": 43,
      "fps": 30,
      "frameSize": [
        136,
        96
      ],
      "pivot": [
        68,
        80
      ],
      "coreBounds": [
        27,
        8,
        110,
        86
      ],
      "focalPoint": [
        68.2,
        63.5
      ],
      "lightEnergy": 5.6916,
      "pages": {
        "combined": [
          {
            "path": u2,
            "first": 0,
            "count": 43,
            "columns": 15,
            "rows": 3,
            "dimensions": [
              2040,
              288
            ]
          }
        ],
        "light": [
          {
            "path": u3,
            "first": 0,
            "count": 43,
            "columns": 15,
            "rows": 3,
            "dimensions": [
              2040,
              288
            ]
          }
        ]
      }
    }
  },
  {
    "id": "arcane/blink-out",
    "category": "arcane",
    "name": "Blink out",
    "meta": {
      "fps": 30,
      "duration": 1.6,
      "loop": false,
      "size": [
        136,
        96
      ],
      "origin": [
        68,
        80
      ],
      "bg": "ground"
    },
    "presentation": {
      "roleCandidate": "combat/ambient (TBD)",
      "anchor": "body",
      "depth": "back-front",
      "emissiveNight": "post-night",
      "sceneInteraction": "none",
      "extraShapes": false
    },
    "export": {
      "state": "PARITY_PASS",
      "frames": 49,
      "fps": 30,
      "frameSize": [
        136,
        96
      ],
      "pivot": [
        68,
        80
      ],
      "coreBounds": [
        14,
        11,
        126,
        86
      ],
      "focalPoint": [
        68.5,
        60.2
      ],
      "lightEnergy": 7.1386,
      "pages": {
        "combined": [
          {
            "path": u4,
            "first": 0,
            "count": 49,
            "columns": 15,
            "rows": 4,
            "dimensions": [
              2040,
              384
            ]
          }
        ],
        "light": [
          {
            "path": u5,
            "first": 0,
            "count": 49,
            "columns": 15,
            "rows": 4,
            "dimensions": [
              2040,
              384
            ]
          }
        ]
      }
    }
  },
  {
    "id": "arcane/mana-burst",
    "category": "arcane",
    "name": "Mana burst",
    "meta": {
      "fps": 30,
      "duration": 1.8,
      "loop": false,
      "size": [
        208,
        150
      ],
      "origin": [
        104,
        124
      ],
      "bg": "ground"
    },
    "presentation": {
      "roleCandidate": "combat/ambient (TBD)",
      "anchor": "ground",
      "depth": "back-front",
      "emissiveNight": "post-night",
      "sceneInteraction": "none",
      "extraShapes": false
    },
    "export": {
      "state": "PARITY_PASS",
      "frames": 55,
      "fps": 30,
      "frameSize": [
        208,
        150
      ],
      "pivot": [
        104,
        124
      ],
      "coreBounds": [
        18,
        6,
        181,
        132
      ],
      "focalPoint": [
        101.8,
        89.2
      ],
      "lightEnergy": 7.5242,
      "pages": {
        "combined": [
          {
            "path": u6,
            "first": 0,
            "count": 55,
            "columns": 9,
            "rows": 7,
            "dimensions": [
              1872,
              1050
            ]
          }
        ],
        "light": [
          {
            "path": u7,
            "first": 0,
            "count": 55,
            "columns": 9,
            "rows": 7,
            "dimensions": [
              1872,
              1050
            ]
          }
        ]
      }
    }
  },
  {
    "id": "fire/fire-breath",
    "category": "fire",
    "name": "Fire breath",
    "meta": {
      "fps": 30,
      "duration": 1.5,
      "loop": true,
      "size": [
        160,
        116
      ],
      "origin": [
        12,
        72
      ],
      "bg": "dark"
    },
    "presentation": {
      "roleCandidate": "combat/ambient (TBD)",
      "anchor": "source",
      "depth": "back-front",
      "emissiveNight": "post-night",
      "sceneInteraction": "none",
      "extraShapes": false
    },
    "export": {
      "state": "PARITY_PASS",
      "frames": 45,
      "fps": 30,
      "frameSize": [
        160,
        116
      ],
      "pivot": [
        12,
        72
      ],
      "coreBounds": [
        9,
        18,
        141,
        106
      ],
      "focalPoint": [
        72.5,
        60.8
      ],
      "lightEnergy": 19.8755,
      "pages": {
        "combined": [
          {
            "path": u8,
            "first": 0,
            "count": 45,
            "columns": 12,
            "rows": 4,
            "dimensions": [
              1920,
              464
            ]
          }
        ],
        "color": [
          {
            "path": "assets/fire/fire-breath/color-0.png",
            "first": 0,
            "count": 45,
            "columns": 12,
            "rows": 4,
            "dimensions": [
              1920,
              464
            ]
          }
        ],
        "light": [
          {
            "path": u9,
            "first": 0,
            "count": 45,
            "columns": 12,
            "rows": 4,
            "dimensions": [
              1920,
              464
            ]
          }
        ]
      }
    }
  },
  {
    "id": "fire/fire-tornado",
    "category": "fire",
    "name": "Fire tornado",
    "meta": {
      "fps": 30,
      "duration": 2,
      "loop": true,
      "size": [
        120,
        152
      ],
      "origin": [
        60,
        136
      ],
      "bg": "ground"
    },
    "presentation": {
      "roleCandidate": "combat/ambient (TBD)",
      "anchor": "ground",
      "depth": "back-front",
      "emissiveNight": "post-night",
      "sceneInteraction": "none",
      "extraShapes": false
    },
    "export": {
      "state": "PARITY_PASS",
      "frames": 60,
      "fps": 30,
      "frameSize": [
        120,
        152
      ],
      "pivot": [
        60,
        136
      ],
      "coreBounds": [
        20,
        21,
        100,
        139
      ],
      "focalPoint": [
        59.4,
        89.1
      ],
      "lightEnergy": 22.3128,
      "pages": {
        "combined": [
          {
            "path": u10,
            "first": 0,
            "count": 60,
            "columns": 17,
            "rows": 4,
            "dimensions": [
              2040,
              608
            ]
          }
        ],
        "color": [
          {
            "path": "assets/fire/fire-tornado/color-0.png",
            "first": 0,
            "count": 60,
            "columns": 17,
            "rows": 4,
            "dimensions": [
              2040,
              608
            ]
          }
        ],
        "light": [
          {
            "path": u11,
            "first": 0,
            "count": 60,
            "columns": 17,
            "rows": 4,
            "dimensions": [
              2040,
              608
            ]
          }
        ]
      }
    }
  },
  {
    "id": "ice/ice-shatter",
    "category": "ice",
    "name": "Ice shatter",
    "meta": {
      "fps": 30,
      "duration": 2.8,
      "loop": false,
      "size": [
        224,
        112
      ],
      "origin": [
        68,
        90
      ],
      "bg": "ground"
    },
    "presentation": {
      "roleCandidate": "combat/ambient (TBD)",
      "anchor": "ground",
      "depth": "back-front",
      "emissiveNight": "post-night",
      "sceneInteraction": "none",
      "extraShapes": false
    },
    "export": {
      "state": "PARITY_PASS",
      "frames": 85,
      "fps": 30,
      "frameSize": [
        224,
        112
      ],
      "pivot": [
        68,
        90
      ],
      "coreBounds": [
        20,
        26,
        195,
        95
      ],
      "focalPoint": [
        93.5,
        75.6
      ],
      "lightEnergy": 2.5436,
      "pages": {
        "combined": [
          {
            "path": u12,
            "first": 0,
            "count": 85,
            "columns": 9,
            "rows": 10,
            "dimensions": [
              2016,
              1120
            ]
          }
        ],
        "color": [
          {
            "path": "assets/ice/ice-shatter/color-0.png",
            "first": 0,
            "count": 85,
            "columns": 9,
            "rows": 10,
            "dimensions": [
              2016,
              1120
            ]
          }
        ],
        "light": [
          {
            "path": u13,
            "first": 0,
            "count": 85,
            "columns": 9,
            "rows": 10,
            "dimensions": [
              2016,
              1120
            ]
          }
        ]
      }
    }
  },
  {
    "id": "ice/snowflake-burst",
    "category": "ice",
    "name": "Snowflake burst",
    "meta": {
      "fps": 30,
      "duration": 3.2,
      "loop": false,
      "size": [
        140,
        120
      ],
      "origin": [
        70,
        106
      ],
      "bg": "ground"
    },
    "presentation": {
      "roleCandidate": "combat/ambient (TBD)",
      "anchor": "ground",
      "depth": "back-front",
      "emissiveNight": "post-night",
      "sceneInteraction": "none",
      "extraShapes": false
    },
    "export": {
      "state": "PARITY_PASS",
      "frames": 97,
      "fps": 30,
      "frameSize": [
        140,
        120
      ],
      "pivot": [
        70,
        106
      ],
      "coreBounds": [
        26,
        10,
        112,
        110
      ],
      "focalPoint": [
        70,
        59.1
      ],
      "lightEnergy": 4.8734,
      "pages": {
        "combined": [
          {
            "path": u14,
            "first": 0,
            "count": 97,
            "columns": 14,
            "rows": 7,
            "dimensions": [
              1960,
              840
            ]
          }
        ],
        "color": [
          {
            "path": "assets/ice/snowflake-burst/color-0.png",
            "first": 0,
            "count": 97,
            "columns": 14,
            "rows": 7,
            "dimensions": [
              1960,
              840
            ]
          }
        ],
        "light": [
          {
            "path": u15,
            "first": 0,
            "count": 97,
            "columns": 14,
            "rows": 7,
            "dimensions": [
              1960,
              840
            ]
          }
        ]
      }
    }
  },
  {
    "id": "lightning/lightning-strike",
    "category": "lightning",
    "name": "Lightning strike",
    "meta": {
      "fps": 30,
      "duration": 3,
      "loop": false,
      "size": [
        240,
        264
      ],
      "origin": [
        120,
        228
      ],
      "bg": "ground"
    },
    "presentation": {
      "roleCandidate": "combat/ambient (TBD)",
      "anchor": "ground",
      "depth": "back-front",
      "emissiveNight": "post-night",
      "sceneInteraction": "none",
      "extraShapes": false
    },
    "export": {
      "state": "PARITY_PASS",
      "frames": 91,
      "fps": 30,
      "frameSize": [
        240,
        264
      ],
      "pivot": [
        120,
        228
      ],
      "coreBounds": [
        38,
        1,
        203,
        239
      ],
      "focalPoint": [
        123.3,
        168
      ],
      "lightEnergy": 4.5087,
      "pages": {
        "combined": [
          {
            "path": u16,
            "first": 0,
            "count": 56,
            "columns": 8,
            "rows": 7,
            "dimensions": [
              1920,
              1848
            ]
          },
          {
            "path": u17,
            "first": 56,
            "count": 35,
            "columns": 8,
            "rows": 5,
            "dimensions": [
              1920,
              1320
            ]
          }
        ],
        "color": [
          {
            "path": "assets/lightning/lightning-strike/color-0.png",
            "first": 0,
            "count": 56,
            "columns": 8,
            "rows": 7,
            "dimensions": [
              1920,
              1848
            ]
          },
          {
            "path": "assets/lightning/lightning-strike/color-1.png",
            "first": 56,
            "count": 35,
            "columns": 8,
            "rows": 5,
            "dimensions": [
              1920,
              1320
            ]
          }
        ],
        "light": [
          {
            "path": u18,
            "first": 0,
            "count": 56,
            "columns": 8,
            "rows": 7,
            "dimensions": [
              1920,
              1848
            ]
          },
          {
            "path": u19,
            "first": 56,
            "count": 35,
            "columns": 8,
            "rows": 5,
            "dimensions": [
              1920,
              1320
            ]
          }
        ]
      }
    }
  },
  {
    "id": "nature/leaf-storm",
    "category": "nature",
    "name": "Leaf storm",
    "meta": {
      "fps": 30,
      "duration": 2.4,
      "loop": true,
      "size": [
        112,
        104
      ],
      "origin": [
        56,
        92
      ],
      "bg": "ground"
    },
    "presentation": {
      "roleCandidate": "combat/ambient (TBD)",
      "anchor": "act",
      "depth": "back-front",
      "emissiveNight": "post-night",
      "sceneInteraction": "none",
      "extraShapes": false
    },
    "export": {
      "state": "PARITY_PASS",
      "frames": 72,
      "fps": 30,
      "frameSize": [
        112,
        104
      ],
      "pivot": [
        56,
        92
      ],
      "coreBounds": [
        8,
        8,
        106,
        97
      ],
      "focalPoint": [
        54.9,
        55.9
      ],
      "lightEnergy": 3.225,
      "pages": {
        "combined": [
          {
            "path": u20,
            "first": 0,
            "count": 72,
            "columns": 18,
            "rows": 4,
            "dimensions": [
              2016,
              416
            ]
          }
        ],
        "color": [
          {
            "path": "assets/nature/leaf-storm/color-0.png",
            "first": 0,
            "count": 72,
            "columns": 18,
            "rows": 4,
            "dimensions": [
              2016,
              416
            ]
          }
        ],
        "light": [
          {
            "path": u21,
            "first": 0,
            "count": 72,
            "columns": 18,
            "rows": 4,
            "dimensions": [
              2016,
              416
            ]
          }
        ]
      }
    }
  }
];
