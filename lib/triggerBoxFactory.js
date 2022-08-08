import { SerialPort } from 'serialport'
import TriggerBoxLowLevel from './TriggerBoxLowLevel.js'
import { repeatUntil } from './util.js'

const MAX_RETRIES = 15

/**
 * Get a list of devices that may be trigger boxes. Without probing
 * deeper we cannot confirm for certain that they are trigger boxes.
 * Confirmation must be done by using the port name returned as the
 * path to make a new TriggerBox* object.
 *
 * This function works by identifying USB devices that are FTDI serial
 * port bridges. The FTDI serial port chip is used in many other
 * devices beside the ESPER trigger boxes so it may return false
 * positives.
 */
export async function listPossibleTriggerBoxes () {
  const deviceList = await SerialPort.list()
  return deviceList.filter(device => device.manufacturer === 'FTDI')
    .map(device => device.path)
    .sort((A, B) => A.localeCompare(B))
}

/**
 * Read the firmware version of a trigger box. Will throw an exception
 * if the device is not a trigger box.
 *
 * @param {string} commPortPath Serial communication port path
 * @returns {string} The firmware version in the format '#.#' if found.
 * @throws {Error} Will throw an error if it cannot connect or the device
 *                 does not respond properly
 */
export async function getTriggerBoxFirmwareVersion (commPortPath) {
  // Try to determine firmware version
  let triggerBox = null
  try {
    // Connect with low level interface
    triggerBox = new TriggerBoxLowLevel(commPortPath)
    await repeatUntil(() => triggerBox.connected, 200, MAX_RETRIES)

    // Install data listener for firmware version
    let firmware = ''
    const firmwareSplit = (response) => { firmware = response.split(' ')[1] }
    triggerBox.on('data', firmwareSplit)

    // Wait for response
    await repeatUntil(async () => {
      await triggerBox.sendCommand('p', 0)
      return (firmware !== '')
    }, 200, MAX_RETRIES)

    // Remove listener
    triggerBox.off('data', firmwareSplit)
    await triggerBox.close()

    // Return the result
    return firmware
  } catch (error) {
    if (triggerBox) {
      triggerBox.close()
    }
    throw new Error('Failed to read firmware version', { cause: error })
  }
}
