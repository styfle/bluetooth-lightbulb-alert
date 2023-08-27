import { spawn } from 'child_process';
import noble from '@abandonware/noble';

/**
 * @type {import('@abandonware/noble').Peripheral}
 */
let cachedPeripheral = null;

/**
 * 
 * @returns {Promise<import('@abandonware/noble').Peripheral>}
 */
async function getPeripheral() {
  console.log('getPeripheral() called')
  return new Promise(async (resolve, reject) => {
    if (cachedPeripheral) {
      console.log('cachedPeripheral.connnectable', cachedPeripheral.connectable)
      console.log('cachedPeripheral.rssi', cachedPeripheral.rssi)
      console.log('cachedPeripheral.state', cachedPeripheral.state)
      if (cachedPeripheral.state !== 'connected') {
        console.log('since its not connected, we try to connect')
        await cachedPeripheral.connectAsync();
      }
      resolve(cachedPeripheral);
      return;
    }
    console.log('cachedPeripheral does not exist')
    noble.on('stateChange', async (state) => {
      console.log(`stateChange: ${state}`)
      if (state === 'poweredOn') {
        console.log('start scanning')
        await noble.startScanningAsync(['ffe5'], false);
      }
    });
    noble.on('discover', async (peripheral) => {
      console.log('discovered peripheral')
      if (peripheral.state !== 'connected') {
        console.log('since its not connected, we try to connect')
        await peripheral.connectAsync();
      }
      cachedPeripheral = peripheral;
      resolve(peripheral)
    });
    noble.on('error', (err) => {
      console.log('noble had an error event')
      reject(err);
    });
  });
}

async function turnOff() {
  const peripheral = await getPeripheral();
  console.log('got peripheral')
  const {characteristics} = await peripheral.discoverSomeServicesAndCharacteristicsAsync(['ffe5'], ['ffe9']);
  console.log('got characteristics')
  const characteristic = characteristics[0];
  console.log(`localName: ${peripheral.advertisement.localName}`);
  await characteristic.writeAsync(new Uint8Array([0xcc, 0x24, 0x33]), false); // turn off
  //console.log('disconnecting')
  //await peripheral.disconnectAsync();
}

/**
 * Turn the bulb on and set color to RGB.
 * @param {[number, number, number]} rgb 
 */
async function turnOn(rgba) {
  const peripheral = await getPeripheral();
  console.log('got peripheral')
  const {characteristics} = await peripheral.discoverSomeServicesAndCharacteristicsAsync(['ffe5'], ['ffe9']);
  const characteristic = characteristics[0];
  console.log(`localName: ${peripheral.advertisement.localName}`);
  await characteristic.writeAsync(new Uint8Array([0xcc, 0x23, 0x33]), false); // turn on
  await characteristic.writeAsync(new Uint8Array([0x56, ...rgba, 0xf0, 0xaa]), false); // set color
  //console.log('disconnecting')
  //await peripheral.disconnectAsync();
}

await turnOff();

// See https://stackoverflow.com/a/69736932/266535
const child = spawn('log', [
  'stream',
  '--predicate',
  'eventMessage contains "Cameras changed to"'
])

child.stdout.setEncoding('utf8')
child.stdout.on('data', async (data) => {
  console.log('data is ', data)
  if (data.includes('Cameras changed to []')) {
    console.log('turning off')
    await turnOff()
  } else if (data.includes('Cameras changed to [')) {
    console.log('turning on')
    await turnOn([0xFF, 0x00, 0x00, 0x00]) // red
  }
})
