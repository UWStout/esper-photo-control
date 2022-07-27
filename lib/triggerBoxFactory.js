import TriggerBoxLowLevel from './TriggerBoxLowLevel.js'
import { repeatUntil } from './util.js'

const MAX_RETRIES = 15

export async function getTriggerBoxFirmwareVersion (commPortPath) {
  // Try to determine firmware version
  try {
    // Connect with low level interface
    const triggerBox = new TriggerBoxLowLevel(commPortPath)
    await repeatUntil(() => triggerBox.connected, 200, MAX_RETRIES)

    // Install data listener for firmware version
    let firmware = ''
    const firmwareSplit = (response) => { firmware = response.split(' ')[1] }
    triggerBox.on('data', firmwareSplit)

    // Wait for response
    await repeatUntil(async () => {
      await triggerBox.sendCommand('p')
      return (firmware !== '')
    }, 200, MAX_RETRIES)

    // Remove listener
    triggerBox.off('data', firmwareSplit)
    triggerBox.close()

    // Return the result
    return firmware
  } catch (error) {
    throw new Error('Failed to read firmware version', { cause: error })
  }
}
