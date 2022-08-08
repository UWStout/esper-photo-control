import EventEmitter from 'events'

import { waitForMilliseconds } from './util.js'

import { SerialPort } from 'serialport'
import { DelimiterParser } from '@serialport/parser-delimiter'

// For Debugging: enable to log all data events
const LOG_ALL_DATA = false

// Time to wait for box to initialize
const WAIT_FOR_INIT = 2000

export default class TriggerBoxLowLevel extends EventEmitter {
  /**
   * Ready event.  Fires when the connection to the box is open and ready for commands.
   * @event TriggerBoxLowLevel#ready
   */

  /**
   * Data event. Fires when a message is received from the trigger box.
   * @event TriggerBoxLowLevel#data
   * @type {string} The raw message received from the trigger box.
   */

  /**
   * Close event. Fires when the connection is closed (or if close() is called when
   * the connection is not open).
   * @event TriggerBoxLowLevel#close
   */

  /**
   * Create a low-level Trigger Box interface. Automatically connects to the given
   * comm port and installs that standard response parser.
   * @fires TriggerBoxLowLevel#ready
   * @param {string} commPortPath The OS specific path of the comm port you wish to connect to
   * @param {Object} emitterOptions Any options to pass to the parent EventEmitter
   */
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
        this._onConnection()
      })
    })
  }

  /**
   * Callback used internally to complete setup of the trigger box connection.
   * @fires TriggerBoxLowLevel#ready
   */
  async _onConnection () {
    // Setup the output parser
    this._setupParser()

    // DEBUG: Install logger if enabled
    if (LOG_ALL_DATA) {
      this.on('data', console.log)
    }

    // Indicate connection complete
    this.connected = true
    this.emit('ready')
  }

  /**
   * Install an output parser to the serial port to parse the standard type of messages
   * expected from an ESPER Trigger Box (called automatically by the constructor).
   * @fires TriggerBoxLowLevel#data
   */
  _setupParser () {
    // Cannot setup parser if the UART is not initialized
    if (!this.uart) {
      throw new Error('Failed to setup serial parser, UART comm port not set')
    }

    // Data about most recent messages
    this._lastMessageTime = -1
    this._lastResponse = null

    // Setup the parser to interpret responses from the trigger box
    this.parser = this.uart.pipe(new DelimiterParser({ delimiter: '\n' }))
    this.parser.on('data', (data) => {
      this._lastMessageTime = Date.now()
      this._lastResponse = data.toString()
      this.emit('data', this._lastResponse)
    })
  }

  /**
   * Attempt to close the comm port. If it is not open, it will resolve immediately. Otherwise, it
   * resolves once the close is accepted or rejects if there is an error.
   * @fires TriggerBoxLowLevel#close
   * @returns {Promise} A promise that resolves once the closing is confirmed and rejects on errors.
   */
  async close () {
    return new Promise((resolve, reject) => {
      if (this.uart?.isOpen) {
        this.uart.close((error) => {
          if (error) {
            return reject(new Error('Failed to close connection to trigger box', { cause: error }))
          }
          this.emit('close')
          return resolve()
        })
      } else {
        this.emit('close')
        return resolve()
      }
    })
  }

  /**
   * Send a command to the trigger box and optionally wait for a response. Even if you send a
   * timeout of 0, you should await the resulting promise to ensure the command has been properly
   * sent.  If the timeout is 0, it will not wait for a response and just resolve without data.
   * @param {string} command A command to send to the trigger box on the UART comm port
   * @param {number} responseTimeout How long to wait for a response (0 = no wait)
   * @returns {Promise} Resolves after responseTimeout ms with a response or rejects on error
   */
  sendCommand (command, responseTimeout = 10000) {
    return new Promise((resolve, reject) => {
      // Ensure the connection is active and open
      if (!this.uart?.isOpen) {
        return reject(new Error('Failed to send trigger box command, uart connection not open'))
      }

      // Clear previous response then send command
      this._lastResponse = null
      this.uart.write(command + '\n', (err) => {
        // Check for error
        if (err) {
          return reject(new Error(`Failed to send trigger box command ${command}`, { cause: err }))
        }

        // Wait for response if a timeout was specified
        if (responseTimeout > 0) {
          const startTime = Date.now()
          const intervalCB = setInterval(() => {
            if (this._lastResponse !== null) {
              clearInterval(intervalCB)
              return resolve(this._lastResponse.trim())
            } else if (Date.now() - startTime >= responseTimeout) {
              clearInterval(intervalCB)
              return reject(new Error('Timeout exceeded waiting for response'))
            }
          }, 100)
        } else {
          // Resolve now without waiting for response
          return resolve()
        }
      })
    })
  }

  /**
   * Send a command that expects a 'tenFour' response (as many do)
   * @param {string} command The command to send
   * @throws {Error} If the response is anything other than 'tenFour' or an Error occurs
   */
  async sendTenFourCommand (command) {
    const response = await this.sendCommand(command)
    if (!response.startsWith('tenFour')) {
      throw Error(`Unexpected response: "${response}"`)
    }
  }
}
