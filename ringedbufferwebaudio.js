// ringedbufferwebaudio.js
// by Georg Essl, August 2024
// Based on https://github.com/GoogleChromeLabs/web-audio-samples/tree/main/src/audio-worklet/free-queue
// By 2010-2024 Chromium authors (731fd47) 
// 
// License: Apache 2.0 (compatible with https://github.com/GoogleChromeLabs/web-audio-samples/blob/main/LICENSE)

// AtomicState between Workers/Threads
const atomicState = new Int32Array(
  new SharedArrayBuffer(1 * Int32Array.BYTES_PER_ELEMENT)
);

import { FreeQueueSAB } from "./free-queue-sab.js";
import { QUEUE_SIZE } from './constants.js';

// Create 2 FreeQueue instances with 4096 buffer length and 1 channel.
const inputQueue = new FreeQueueSAB(QUEUE_SIZE, 1); // Typically Mic In or Generic Generator Chains
const outputQueue = new FreeQueueSAB(QUEUE_SIZE, 1); // Typically Speaker Out
// Create one FreeQueue instance of variable size for application data purposes
export const realdataQueue = new FreeQueueSAB(QUEUE_SIZE, 1);
// Create an atomic state for synchronization between worker and AudioWorklet.

let samplerate = 48000; // This is just pre-seeded we will retrieve it from WebAudio

let source; // A web audio source (could be mic), default is constant at 0.

/**
 * Creates AudioContext, sets up AudioWorklet, basic WebAudio patch for audio to function.
 * @returns {Promise<AudioContext>}
 */
export const createAudioContext = async () => {

  const audioContext = new AudioContext();
  await audioContext.audioWorklet.addModule('/WebAudio/ringbufferwebaudio/basic-processor.js');
  samplerate = audioContext.sampleRate;
  const myArrayBuffer = audioContext.createBuffer(
    1,
    audioContext.sampleRate * 1,
    audioContext.sampleRate,
  );
  // Use constant source at value 0 if we want to specific input.
  // This is only here because we need it's .play()
  source = audioContext.createConstantSource();
  source.offset.setValueAtTime(0,0);
  // Below is a bad example because AudioBufferSourceNode does not allow the buffer to be changed
  // Hence we would have to destroy it, create a new one and rehook.
  // This current solution is precisely to work around this design of AudioBufferSource
/*  
  source = audioContext.createBufferSource();
  source.loop=true;
  source.buffer = myArrayBuffer;
  */
//  const audiobuffersource = new AudioBufferSourceNode(audiocontext);

  // Creating AudioWorklet that will process data. In our solution we do no processing in it.
  // It just hands through data.
  // The work will be done in the sketch and in a separate worker.
  const processorNode =
    new AudioWorkletNode(audioContext, 'basic-processor', {
      processorOptions: {
        inputQueue,
        outputQueue,
        atomicState
      }
    });

  // Web Audio patch that connects our source through the AudioWOrklet into the destination.
  source.connect(processorNode).connect(audioContext.destination);
  // Starting off with AudioContext not playing. 
  audioContext.suspend();
  // Start source so the patch pipeline is active
  source.start();
  return audioContext;
};


// Create a WebWorker for Audio Processing.
const worker = new Worker('./ringbufferwebaudio/worker.js', { type: 'module'});

// Send FreeQueue instances and atomic state to worker.
worker.postMessage({
  type: 'init',
  data: {
    inputQueue,
    outputQueue,
    realdataQueue,
    atomicState,
    samplerate
  }
});
