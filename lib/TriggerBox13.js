import TriggerBoxLowLevel from './TriggerBoxLowLevel.js'
import { repeatUntil } from './util.js'

// Max times to try for validation (waits 200ms between each try)
const MAX_VALIDATE_TRIES = 100

export default class TriggerBox13 extends TriggerBoxLowLevel {
  /**
   * Overrides the low-level method to both setup the response parser and
   * validate that this a proper trigger box. Called automatically by the
   * constructor.
   * @fires TriggerBoxLowLevel#ready
   * @returns {Promise} Resolves on success, rejects with Error on failure.
   */
  async _onConnection () {
    // Setup the output parser
    this._setupParser()

    // Attempt to validate that this is a trigger box
    try {
      await this._validate()
      this.connected = true
      this.emit('ready')
    } catch (error) {
      throw new Error('Validation failed', { cause: error })
    }
  }

  /**
   * Interrogates the device on the given comm port to confirm that it is
   * an ESPER trigger box. Sets this.mode and this.boxId on success.
   * @returns {Promise} Resolves to 'true' on success and 'false' on failure.
   */
  async _validate () {
    // Clear any previous validation results
    delete this.mode
    delete this.boxId

    // Parse out the response, if any
    const dataTestCB = this._parseIdentity.bind(this)
    this.on('data', dataTestCB)

    // Attempt to validate
    await repeatUntil(async () => {
      await this.sendCommand('*calling_ESPER_triggerBox', 0)
      return (typeof this.mode === 'string' && typeof this.boxId === 'number')
    }, 200, MAX_VALIDATE_TRIES)

    // Turn off our testing callback
    this.off('data', dataTestCB)

    // Make sure output is not spamming
    await repeatUntil(async () => {
      await this.sendCommand('^', 0)
      return (Date.now() - this._lastMessageTime > 200)
    }, 100, MAX_VALIDATE_TRIES)
  }

  /**
   * Data callback used internally by this._validate() to parse out the
   * mode and boxId.
   * @param {buffer} data The raw response from the trigger box
   */
  _parseIdentity (data) {
    // Parse response
    if (data.toString().startsWith('GreenTriggerBox:')) {
      this.mode = 'green'
      this.boxId = parseInt(data.toString().split(':')[1].slice(1))
    } else if (data.toString().startsWith('TriggerBox:')) {
      this.mode = 'blue'
      this.boxId = parseInt(data.toString().split(':')[1].slice(1))
    }
  }

  /**
   * Parse, clamp, and validate a number for use in a command
   * @param {number|string} value Value that should be an integer
   * @param {number} max The largest allowed value (defaults to 9999)
   * @param {number} min The smallest allowed value
   * @returns {number} The value clamped to the given range and parsed to an integer
   */
  _validateNumber (value, max = 9999, min = 0) {
    let setValue = parseInt(value)
    if (isNaN(setValue)) { setValue = Math.floor(value) }
    return Math.min(max, Math.max(min, setValue))
  }

  _parseStructuredResponse (response, label) {
    const labelMatch = response.match(new RegExp(`${label}:\\[(?<value>.*)\\]`, 'm'))
    if (labelMatch) {
      return labelMatch.value
    } else {
      throw new Error('Unexpected response format')
    }
  }

  // Basic control commands
  async releaseShutter () { await this.sendCommand('S', 0) }

  async startFocus (waitAfter = 0) {
    await this.sendTenFourCommand('F1')
    if (waitAfter > 0) {
      await new Promise(resolve => setTimeout(() => resolve(), waitAfter))
    }
  }

  async stopFocus () { await this.sendTenFourCommand('F0') }

  // Timing setup commands
  async setBulbTime (newTime) {
    // Validate the parameter and send the command
    const setTime = this._validateNumber(newTime)
    await this.sendTenFourCommand(`b${setTime.toFixed(0).padStart(4, '0')}`)
  }

  // <d8 23 456 99 32 1> Set the current sequencer stage delay values.
  // (also prints "updating stage delay tables")
  async setSequencerDelays (...delays) {
    // Validate parameters
    if (delays.length !== 6) { throw new Error('Unexpected number of delays') }
    const values = delays.map(value => this._validateNumber(value).toFixed(0).padStart(4))

    // Send the command (TODO: Test if we get expected response?)
    return await this.sendCommand(`d${values.join(' ')}`)
  }

  // <f111000> Set the current focus enable array.
  async enableFocusOutput (...enable) {
    if (enable.length !== 6) { throw new Error('Unexpected number of focus enable flags') }
    const enableStr = enable.map(flag => flag ? '1' : '0').join()
    await this.sendTenFourCommand(`f${enableStr}`)
  }

  // <s000111> Set the current shutter enable array.
  async enableShutterOutput (...enable) {
    if (enable.length !== 6) { throw new Error('Unexpected number of shutter enable flags') }
    const enableStr = enable.map(flag => flag ? '1' : '0').join()
    await this.sendTenFourCommand(`s${enableStr}`)
  }

  // <i34> Set box id to 34. This is used by the TriggerBoxController GUI to enumerate boxes on startup.
  async setBoxId (newId) {
    // Validate the parameter and send the command
    const setId = this._validateNumber(newId, 255, 0)
    await this.sendTenFourCommand(`i${setId}`)
  }

  // <nExample Name> Set the internally stored name of the box
  async setBoxName (newName) {
    // eslint-disable-next-line no-useless-escape
    if (newName.match(/[\[\]\n\r]/m)) {
      throw new Error('Invalid characters in box name ("[", "]" and new line characters are not allowed)')
    }

    await this.sendTenFourCommand(`n${newName}`)
  }

  // <l1> / <l0> Turn front mode light on or off
  async enableFrontLight (enable) {
    this.sendTenFourCommand(enable ? 'l1' : 'l0')
  }

  // <m0> / <m2> Set mode to simple mode or sequencer mode
  async setMode (sequencerMode) {
    this.sendTenFourCommand(sequencerMode ? 'm2' : 'm0')
  }

  // <z123> Set input delay to 123 millis
  async setInputDelay (newDelay) {
    const setDelay = this._validateNumber(newDelay)
    await this.sendTenFourCommand(`z${setDelay.toFixed(0).padStart(4, '0')}`)
  }

  // <x897> Set link delay to 897 millis
  async setLinkDelay (newDelay) {
    const setDelay = this._validateNumber(newDelay)
    await this.sendTenFourCommand(`x${setDelay.toFixed(0).padStart(4, '0')}`)
  }

  // <k1 / k0> Enable or disable the link output.
  async enableLink (enable) {
    await this.sendTenFourCommand(enable ? 'k1' : 'k0')
  }

  // <N> Print "BoxName:[Example Name]"
  async getBoxName () {
    const response = await this.sendCommand('N')
    return this._parseStructuredResponse(response, 'BoxName')
  }

  // <I> Print "BoxID:[34]
  async getBoxId () {
    const response = await this.sendCommand('I')
    return this._parseStructuredResponse(response, 'BoxID')
  }

  // <B> Print "BulbTime:[xxxx]"
  async getBulbTime () {
    const response = await this.sendCommand('B')
    return this._parseStructuredResponse(response, 'BulbTime')
  }

  // <D> Print the current sequencer stage delay array "Delays:[12 23 34 45 56 67 ]"
  async getSequencerDelays () {
    const response = await this.sendCommand('D')
    const delays = this._parseStructuredResponse(response, 'Delays')
    return delays.split(' ').map(parseInt)
  }

  // <V> Print "FocusArray:[EN EN EN DIS DIS DIS ]"
  async getFocusOutput () {
    const response = await this.sendCommand('V')
    const focusOutput = this._parseStructuredResponse(response, 'FocusArray')
    return focusOutput.split(' ').map(flag => flag === 'EN')
  }

  // <G> Print "ShutterArray:[DIS DIS DIS EN EN EN ]"
  async getShutterOutput () {
    const response = await this.sendCommand('G')
    const shutterOutput = this._parseStructuredResponse(response, 'ShutterArray')
    return shutterOutput.split(' ').map(flag => flag === 'EN')
  }

  // <E> Prints freeMemory():[815 ] - the number of bytes of free memory in box's RAM.
  async getFreeMemory () {
    const response = await this.sendCommand('E')
    return parseInt(this._parseStructuredResponse(response, 'freeMemory\\(\\)'))
  }

  // <L> Print "Light:[EN/DIS]"
  async isFrontLightEnabled () {
    const response = await this.sendCommand('L')
    return (this._parseStructuredResponse(response, 'Light') === 'EN')
  }

  // <M> Print "Mode:[ 0 ]"
  async isSimpleMode () {
    const response = await this.sendCommand('M')
    return (this._parseStructuredResponse(response, 'Mode') === '0')
  }

  async isSequencerMode () {
    const response = await this.sendCommand('M')
    return (this._parseStructuredResponse(response, 'Mode') === '2')
  }

  // <Z> Print "InDelayMils:[0 ]"
  async getInputDelay () {
    const response = await this.sendCommand('Z')
    return parseInt(this._parseStructuredResponse(response, 'InDelayMils'))
  }

  // <X> Print "LinkDelayMils:[0 ]"
  async getLinkDelay () {
    const response = await this.sendCommand('X')
    return parseInt(this._parseStructuredResponse(response, 'LinkDelayMils'))
  }

  // <K> Print "chainEnable:[EN/DIS]"
  async isLinkEnabled () {
    const response = await this.sendCommand('K')
    return this._parseStructuredResponse(response, 'chainEnable') === 'EN'
  }

  // <p> Prints "Version x.x" referring to firmware
  async getFirmwareVersion () {
    const response = await this.sendCommand('p')
    return response.split(' ')[1]
  }

  /*
   See _validate() method
   <*calling_ESPER_triggerBox> Puts box into "find me mode" - it will print TriggerBox:[box_id] every 100mS until a '^' char is sent. This is used by the TriggerBoxController GUI to enumerate boxes on startup.

   NOT SUPPORTED
   <O> Writes the box's current settings to EEPROM, so that settings will be recalled the next time the box is powered up.
   <R> Box will read the settings from its EEPROM into RAM. This also happens on box startup.
   <q> Resets each value of EEPROM back to default - prints each index it resets, to indicate progress. Complete at 1023, takes around ten seconds.
   <Q> Print each value of each EEPROM address.
  */
}
