import TriggerBox13 from './lib/boxes/TriggerBox13.js'
import readline from 'readline'

import { listPossibleTriggerBoxes } from './lib/other/triggerBoxFactory.js'

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

async function main (PORT_PATH) {
  // Initialize readline input interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  rl.setPrompt(`${PORT_PATH} > `)

  // Initialize trigger box object
  console.log(`** Connecting to ${PORT_PATH} **`)
  const triggerBox = new TriggerBox13(PORT_PATH)
  triggerBox.on('ready', () => {
    // Print connection string
    console.log('Connected to trigger box ' + triggerBox.boxId + ' in ' + triggerBox.mode + ' mode on port "' + PORT_PATH + '"')

    // Show responses and then re-prompt
    // triggerBox.on('data', (response) => {
    //   console.log(' ->' + response + '\n')
    //   rl.prompt()
    // })

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
      const response = await triggerBox.sendCommand(input, (input !== 'S' ? 5000 : 0))
      console.log(`[${response || '<no response expected>'}]`)
      rl.prompt()
    }
  })
}

main(process.argv[2])
