// worker.js for ringedbufferwebaudio.js
// by Georg Essl, August 2024
// Based on https://github.com/GoogleChromeLabs/web-audio-samples/tree/main/src/audio-worklet/free-queue
// By 2010-2024 Chromium authors (731fd47) 
// 
// License: Apache 2.0 (compatible with https://github.com/GoogleChromeLabs/web-audio-samples/blob/main/LICENSE)

// Main difference to the freequeue example is that we added at third queue.
// Given that input is necessary for .play() but there is no good modifyigable WebAudioSource
// we use a second source stream (realdataQueue) that allows us to feed modifyable data into the worker.

import { FreeQueueSAB } from "./free-queue-sab.js";
import { FRAME_SIZE } from "./constants.js";

/**
 * Worker message event handler.
 * This will initialize worker with FreeQueue instance and set loop for audio
 * processing. 
 */
self.onmessage = (msg) => {
  if (msg.data.type === "init") {
    let { inputQueue, outputQueue, realdataQueue, atomicState } = msg.data.data;
// Below hands down audio sample rate if needed for processing
//    let { inputQueue, outputQueue, realdataQueue, atomicState, samplerate } = msg.data.data;
    Object.setPrototypeOf(inputQueue, FreeQueueSAB.prototype);
    Object.setPrototypeOf(outputQueue, FreeQueueSAB.prototype);
    Object.setPrototypeOf(realdataQueue, FreeQueueSAB.prototype);
    
    // buffer for storing data pulled out from queue.
    const input = new Float32Array(FRAME_SIZE);
    // loop for processing data.
    let t=0;
    const output = new Float32Array(FRAME_SIZE);
    while (Atomics.wait(atomicState, 0, 0) === 'ok') {
      
      // pull data out from inputQueue.
      const didPull = inputQueue.pull([input], FRAME_SIZE);
      // This could be used to mix in given Audio Sources like live Mic data.
      // Currently unused in this worker implementation.
      if (realdataQueue.getAvailableSamples()>=FRAME_SIZE) {
//        realdataQueue.printAvailableReadAndWrite(); // To check is the worker is getting data
        realdataQueue.pull([input],FRAME_SIZE);
      }
      if (didPull) {
        // If pulling data out was successfull, process it and push it to
        // outputQueue

        // 0.5 is a gain factor. This could be modified into a working volume control
        const output = input.map(sample => 0.5 * sample);

        // Audio processing can be done in the worker. For example mixing input with realdata
        // Example below is just a test sine (or random) output
        /*
        for(let i=0; i<FRAME_SIZE;i++)
        {
//          output[i]=(Math.random(2*Math.PI*t/SR*440)-0.5)*2.0;
          output[i]=Math.sin(2*Math.PI*t/samplerate*440);
          t++;
        }
          */
        outputQueue.push([output], FRAME_SIZE);
      } 

      Atomics.store(atomicState, 0, 0);
    }
  }
};
