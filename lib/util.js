// Function that will yield for 'time' milliseconds when awaited
export function waitForMilliseconds (time) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), time)
  })
}

export async function repeatUntil (testCB, millisecondsBetweenTries, maxRetries) {
  // Run once to start
  let result = await testCB()

  // Retry until 'testCB()' returns non falsy value
  let retryCount = 1
  while (!result && retryCount < maxRetries) {
    await waitForMilliseconds(millisecondsBetweenTries)
    result = await testCB()
    retryCount++
  }

  // Did we succeed?
  if (retryCount >= maxRetries) {
    throw new Error('Max retries exceeded waiting for test to pass.')
  }
}
