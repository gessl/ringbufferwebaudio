// p5.js example sketch using ringedbufferwebaudio.js
// by Georg Essl, August 2024
// Based on https://github.com/GoogleChromeLabs/web-audio-samples/tree/main/src/audio-worklet/free-queue
// By 2010-2024 Chromium authors (731fd47) 
// 
// License: Apache 2.0 (compatible with https://github.com/GoogleChromeLabs/web-audio-samples/blob/main/LICENSE)

//
// Import stuff from ringedbufferwebaudio.js
//
import { createAudioContext, realdataQueue } from "./ringedbufferwebaudio.js"
import { RENDER_QUANTUM } from './constants.js';

// Data related to playing audio
let audioContext = null;
let isPlaying = false;

//
// Example Sketch below.
//
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

