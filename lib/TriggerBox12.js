import TriggerBoxLowLevel from './TriggerBoxLowLevel.js'

// Max times to try for validation (waits 200ms between each try)
const MAX_VALIDATE_TRIES = 100

/**
 * Object for controlling an ESPER multi-camera trigger box with
 * firmware v1.2
 */
export default class TriggerBox12 extends TriggerBoxLowLevel {
  constructor (commPortPath, emitterOptions) {
    // Construct parent
    super(commPortPath, emitterOptions)

    // Validate once open
    this.uart.on('open', async () => {
      // Validate, then emit ready event
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
}
