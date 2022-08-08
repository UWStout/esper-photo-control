import TriggerBox13 from './lib/TriggerBox13.js'
import { listPossibleTriggerBoxes } from './lib/triggerBoxFactory.js'
import { waitForMilliseconds } from './lib/util.js'

// Check command line arguments and print usage if incorrect
if (process.argv.length < 3) {
  console.log(`Usage: node ${process.argv[1]} <serial port name>`)

  // Get list of trigger boxes
  const devices = await listPossibleTriggerBoxes()
  if (devices.length < 1) {
    console.error('No trigger boxes detected')
  } else {
    console.log('\nPossible trigger boxes:')
    devices.forEach(device => console.log(` - "${device}"`))
  }

  // Do not continue
  process.exit(1)
}

// Extract the comm port
const PORT_PATH = process.argv[2]

// Initialize trigger box object
console.log(`** Connecting to ${PORT_PATH} **`)
const triggerBox = new TriggerBox13(PORT_PATH)
triggerBox.on('ready', async () => {
  // Print connection string
  console.log('Connected to trigger box ' + triggerBox.boxId + ' in ' + triggerBox.mode + ' mode on port "' + PORT_PATH + '"')

  try {
    // Pause a bit before sending commands
    await waitForMilliseconds(1000)

    // Enable link
    console.log('Enabling link ...')
    await triggerBox.enableLink(true)

    // Focus and fire
    console.log('Starting focus ...')
    await triggerBox.startFocus(1000)

    console.log('Releasing shutter ...')
    await triggerBox.releaseShutter()

    console.log('Releasing focus ...')
    await triggerBox.stopFocus()

    // Close the connection
    console.log('Shutting down ...')
    await triggerBox.close()
  } catch (error) {
    triggerBox.close()
    console.error('Box command failed:')
    console.error(error)
  }
})
