// Bring in all the parts of the library
import TriggerBoxLowLevel from './boxes/TriggerBoxLowLevel.js'
import TriggerBox13 from './boxes/TriggerBox13.js'
import { listPossibleTriggerBoxes, getTriggerBoxFirmwareVersion } from './other/triggerBoxFactory.js'
import { waitForMilliseconds } from './other/util.js'

// Export under the default namespace
export default {
  TriggerBoxLowLevel,
  TriggerBox: TriggerBox13,
  listPossibleTriggerBoxes,
  getTriggerBoxFirmwareVersion,
  waitForMilliseconds
}
