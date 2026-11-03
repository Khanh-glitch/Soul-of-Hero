// Browser-safe constants shared by compiler, renderer and authoring tool.
// Keep in sync with src/compiler/gold.mjs (Node-only compiler).
export const SCALE=Object.freeze({authorW:2000,authorH:1400,pxPerUnit:4,tile:16,unitsPerTile:4,gridW:500,gridH:350,terrainCell:8,terrainGw:250,terrainGh:175,playerSpeedPxPerSec:88,cameraW:640,cameraH:360});
export const auToPx=v=>v*SCALE.pxPerUnit;
export const auToTile=v=>v/SCALE.unitsPerTile;
export const tileToAu=v=>v*SCALE.unitsPerTile;
export const tileToPx=v=>v*SCALE.tile;
export const BIOME=Object.freeze({0:'lowland',1:'grassland',2:'forest',3:'highland',4:'marsh',5:'dunes',6:'frost',7:'cliff',8:'peak',9:'cinder',10:'slag',11:'coast'});
export const M=Object.freeze({DEEP:0,SHALLOW:1,RIVER:2,SAND:3,GRASS:4,MEADOW:5,FOREST:6,MARSH:7,ROCK:8,CLIFF:9,SNOW:10,ASH:11,LAVA:12,DUNE:13,TOXIC:14,ROAD_DIRT:15,ROAD_COBBLE:16,BRIDGE:17,DECK:18,FLOOR_WOOD:19,FLOOR_STONE:20,WALL_WOOD:21,WALL_STONE:22,ROOF_TILE:23,DOOR:24,PLAZA:25,INTERIOR_VOID:26,WATER_FOAM:27});
export const MATERIAL_NAME=Object.freeze(['deep_water','shallow_water','river_water','sand','grass','meadow','forest_floor','marsh','rock','cliff','snow','ash','lava','dune','toxic','road_dirt','road_cobble','bridge_deck','wood_deck','floor_wood','floor_stone','wall_wood','wall_stone','roof_tile','door','plaza','interior_void','water_foam']);
