import TriggerBoxLowLevel from './TriggerBoxLowLevel.js'
import { repeatUntil } from './util.js'

// Max times to try for validation (waits 200ms between each try)
const MAX_VALIDATE_TRIES = 100

export default class TriggerBox13 extends TriggerBoxLowLevel {
  async onConnection () {
    // Setup the output parser
    this.setupParser()

    // Attempt to validate that this is a trigger box
    try {
      await this.validate()
      this.connected = true
      this.emit('ready')
    } catch (error) {
      throw new Error('Validation failed', { cause: error })
    }
  }

  async validate () {
    // Clear any previous validation results
    delete this.mode
    delete this.boxId

    // Parse out the response, if any
    const dataTestCB = this.parseIdentity.bind(this)
    this.on('data', dataTestCB)

    // Attempt to validate
    await repeatUntil(async () => {
      await this.sendCommand('*calling_ESPER_triggerBox')
      return (typeof this.mode === 'string' && typeof this.boxId === 'number')
    }, 200, MAX_VALIDATE_TRIES)

    // Turn off our testing callback
    this.off('data', dataTestCB)

    // Make sure output is not spamming
    await repeatUntil(async () => {
      await this.sendCommand('^')
      return (Date.now() - this.lastMessageTime > 200)
    }, 100, MAX_VALIDATE_TRIES)
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
}
