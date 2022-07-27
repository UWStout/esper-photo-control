import EventEmitter from 'events'

import { waitForMilliseconds } from './util.js'

import { SerialPort } from 'serialport'
import { DelimiterParser } from '@serialport/parser-delimiter'

// For Debugging: enable to log all data events
const LOG_ALL_DATA = false

// Time to wait for box to initialize
const WAIT_FOR_INIT = 2000

export default class TriggerBoxLowLevel extends EventEmitter {
  constructor (commPortPath, emitterOptions) {
    // Construct parent
    super(emitterOptions)

    // Attempt to connect to the serial port
    this.portPath = commPortPath
    this.uart = new SerialPort({
      path: this.portPath,
      baudRate: 115200
    }, async (error) => {
      // Handle any connection error
      if (error) {
        throw new Error(`Failed to connect to trigger box on port "${this.portPath}"`, { cause: error })
      }

      // Finish setup (need to wait for box to finish initializing)
      waitForMilliseconds(WAIT_FOR_INIT).then(() => {
        this.onConnection()
      })
    })
  }

  async onConnection () {
    // Setup the output parser
    this.setupParser()

    // DEBUG: Install logger if enabled
    if (LOG_ALL_DATA) {
      this.on('data', console.log)
    }

    // Indicate connection complete
    this.connected = true
    this.emit('ready')
  }

  // Setup a basic response parser for use with the ESPER box
  setupParser () {
    // Cannot setup parser if the UART is not initialized
    if (!this.uart) {
      throw new Error('Failed to setup serial parser, UART comm port not set')
    }

    //  Record timestamps of messages
    this.lastMessageTime = -1

    // Setup the parser to interpret responses from the trigger box
    this.parser = this.uart.pipe(new DelimiterParser({ delimiter: '\n' }))
    this.parser.on('data', (data) => {
      this.emit('data', data.toString())
      this.lastMessageTime = Date.now()
    })
  }

  // Close the COMM port and emit the 'close' event
  close () {
    if (this.uart?.isOpen) {
      this.uart.close((error) => {
        if (error) {
          throw new Error('Failed to close connection to trigger box', { cause: error })
        }
        this.emit('close')
      })
    } else {
      this.emit('close')
    }
  }

  // Send a command to the trigger box
  sendCommand (command) {
    return new Promise((resolve, reject) => {
      // Ensure the connection is active and open
      if (!this.uart?.isOpen) {
        return reject(new Error('Failed to send trigger box command, uart connection not open'))
      }

      // Send the command
      this.uart.write(command + '\n', (err) => {
        // Check for error
        if (err) {
          return reject(new Error(`Failed to send trigger box command ${command}`, { cause: err }))
        }

        // Indicate success
        return resolve()
      })
    })
  }
}
