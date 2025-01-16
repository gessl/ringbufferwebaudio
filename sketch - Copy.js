// ringedbufferwebaudio.js
// by Georg Essl, August 2024
// Based on https://github.com/GoogleChromeLabs/web-audio-samples/tree/main/src/audio-worklet/free-queue
// By 2010-2024 Chromium authors (731fd47) 
// 
// License:

// AtomicState between Workers/Threads
const atomicState = new Int32Array(
  new SharedArrayBuffer(1 * Int32Array.BYTES_PER_ELEMENT)
);

import { FreeQueueSAB } from "./free-queue-sab.js";
import { QUEUE_SIZE, RENDER_QUANTUM } from './constants.js';

// Create 2 FreeQueue instances with 4096 buffer length and 1 channel.
const inputQueue = new FreeQueueSAB(QUEUE_SIZE, 1); // Typically Mic In or Generic Generator Chains
const outputQueue = new FreeQueueSAB(QUEUE_SIZE, 1); // Typically Speaker Out
// Create one FreeQueue instance of variable size for application data purposes
const realdataQueue = new FreeQueueSAB(QUEUE_SIZE, 1);
// Create an atomic state for synchronization between worker and AudioWorklet.

let audioContext = null;
let isPlaying = false;
let samplerate = 48000; // This is just pre-seeded we will retrieve it from WebAudio

let source; // A web audio source (could be mic), default is constant at 0.

// Example Sketch below.
let mdt=0;  
let mfreqbase=40; // Lowest frequency
let mfreqoff=400; // Starting frequency offset, freq = mfreqbase+mfreqoff

export const mySketch = new p5(function(p5) {
  p5.setup = function () {
    p5.createCanvas(400, 400);
  }

  p5.draw = function () {
    if(isPlaying)
      p5.background(0,220,0);
    else
      p5.background(220,0,0);

    if(isPlaying==true)
    {
      let realdata = [];

      let m = 6;

      if(realdataQueue.getAvailableSamples()>6*RENDER_QUANTUM)
        m=6;
      else
        m=8;
      realdata.push(new Float32Array(m*RENDER_QUANTUM));

      for (let i = 0; i < m*RENDER_QUANTUM; i++) {
        mfreqoff = p5.mouseY;
        mdt = mdt+2*Math.PI*(mfreqbase+mfreqoff)/48000
        realdata[0][i] = Math.sin(mdt);// Generate a dt-based variable frequency sine
//              realdata[0][i] = Math.random(); // Try some noice
      }
      realdataQueue.push(realdata, m*RENDER_QUANTUM);
    }
  }
  
  // Mouse Button Interaction
  p5.mousePressed = async function (event) {
    // Create Audio Context.
    // Audio Context can only be created after a first interaction on the browser.
    if (!audioContext) {
      try {
        audioContext = await createAudioContext();
      } catch(error) {
        // Failed to create AudioContext (never seen this happen!)
        p5.print("ERROR Couldn't create the AudioContext");
        console.error(error);
        return;
      }
      p5.print("Audio Context created");
    }

    // Resume playback
    audioContext.resume();
    isPlaying = true;
  }
  
  p5.mouseReleased = function (event) {
    // Start audio playback if its not playing and we have a valid audioContext
    if (!isPlaying && audioContext) {
      audioContext.resume();
      isPlaying = true;
    } else {
      audioContext.suspend();
//      realdataQueue._reset(); // Use this if you want to reset the ring buffer
//      myt=0;                  // and set the phase of the sin to 0
      isPlaying = false;
    }
  
  }
})

/**
 * Creates AudioContext, sets up AudioWorklet, basic WebAudio patch for audio to function.
 * @returns {Promise<AudioContext>}
 */
const createAudioContext = async () => {

  const audioContext = new AudioContext();
  await audioContext.audioWorklet.addModule('./basic-processor.js');
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
const worker = new Worker('worker.js', { type: 'module'});

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
