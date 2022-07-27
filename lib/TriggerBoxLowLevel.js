import EventEmitter from 'events'

import { SerialPort } from 'serialport'
import { DelimiterParser } from '@serialport/parser-delimiter'

// Max times to try for validation (waits 200ms between each try)
const MAX_VALIDATE_TRIES = 100

export default class TriggerBoxLowLevel extends EventEmitter {
  constructor (commPortPath, emitterOptions) {
    // Construct parent
    super(emitterOptions)

    // Attempt to connect to the serial port
    this.portPath = commPortPath
    this.uart = new SerialPort({
      path: this.portPath,
      baudRate: 115200
    }, (error) => {
      // Handle any connection error
      if (error) {
        throw new Error(`Failed to connect to trigger box on port "${this.portPath}"`, { cause: error })
      }
    })

    // Validate once open
    this.uart.on('open', async () => {
      // Validate, then emit ready event
      this.setupParser()
      if (!await this.validate()) {
        console.error('Validate failed')
      } else {
        this.emit('ready')
      }
    })
  }

  async validate () {
    // Clear any previous validation results
    delete this.mode
    delete this.boxId

    // Parse out the response, if any
    const dataTestCB = this.parseIdentity.bind(this)
    this.on('data', dataTestCB)

    // Attempt to validate
    let count = 1
    try {
      await this.sendCommand('*calling_ESPER_triggerBox')
      while (count < MAX_VALIDATE_TRIES &&
        (typeof this.mode !== 'string' || typeof this.boxId !== 'number')
      ) {
        count++
        await new Promise((resolve) => setTimeout(() => { resolve() }, 200))
        await this.sendCommand('*calling_ESPER_triggerBox')
      }
    } catch (error) {
      this.off('data', dataTestCB)
      throw new Error('Error in validate loop', { cause: error })
    }

    // Turn off our testing callback
    this.off('data', dataTestCB)

    // Make sure output is not spamming
    while (Date.now() - this.lastMessageTime < 200) {
      await this.sendCommand('^')
      await new Promise((resolve) => setTimeout(() => { resolve() }, 100))
    }

    // Did we validate?
    return (count < MAX_VALIDATE_TRIES)
  }

  parseIdentity (data) {
    // Parse response
    if (data.toString().startsWith('GreenTriggerBox:')) {
      this.mode = 'green'
      this.boxId = parseInt(data.toString().split(':')[1].slice(1))
    } else if (data.toString().startsWith('TriggerBox:')) {
      this.mode = 'blue'
      this.boxId = parseInt(data.toString().split(':')[1].slice(1))
    }
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

  // Close the COMM port and call the provided callback if any (will also call if port is not open)
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
