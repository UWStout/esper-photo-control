import TriggerBox13 from './lib/TriggerBox13.js'
import readline from 'readline'

// import { getTriggerBoxFirmwareVersion } from './lib/triggerBoxFactory.js'
// // Read the firmware version
// getTriggerBoxFirmwareVersion(process.argv[2]).then((firmware) => {
//   console.log('Firmware:', firmware)
// })

// Initialize readline input interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})
rl.setPrompt(`${process.argv[2]} > `)

// Initialize trigger box object
console.log(`** Connecting to ${process.argv[2]} **`)
const triggerBox = new TriggerBox13(process.argv[2])
triggerBox.on('ready', () => {
  // Print connection string
  console.log('Connected to trigger box ' + triggerBox.boxId + ' in ' + triggerBox.mode + ' mode on port "' + process.argv[2] + '"')

  // Show responses and then re-prompt
  triggerBox.on('data', (response) => {
    console.log(' ->' + response + '\n')
    rl.prompt()
  })

  // Exit after close
  triggerBox.on('close', () => {
    console.log('Bye')
    process.exit(0)
  })

  // Show initial prompt
  rl.prompt()
})

// Handle input from the user
rl.on('line', async (input) => {
  // Special close command
  if (input.toLowerCase() === 'close') {
    triggerBox.close()
  } else {
    await triggerBox.sendCommand(input)
  }
})
