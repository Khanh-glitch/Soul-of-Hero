/** Small indirection so the engine can query storey state without an import cycle. */
export { activeFloor, entityFloor, applyFloor, syncFloor } from './floors';
