import { bunja } from "bunja";

/**
 * Lazily created AudioContext used to play short beeps.
 */
export const soundBunja = bunja(() => {
  const ctx = new AudioContext();
  let alarmTimeouts: number[] = []; // Track alarm timeouts for cancellation

  function beep() {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.setValueAtTime(1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.stop(ctx.currentTime + 0.5);
  }

  function boop() {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 440;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.setValueAtTime(1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.stop(ctx.currentTime + 0.5);
  }

  function alarm() {
    // Clear any existing alarm timeouts
    stopAlarm();

    // Play 3 sets of 4 quick beeps with intervals
    for (let set = 0; set < 3; set++) {
      for (let beep = 0; beep < 4; beep++) {
        const timeoutId = setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "square"; // Different waveform for alarm sound
          osc.frequency.value = 1000; // Higher pitch for alarm
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
          osc.stop(ctx.currentTime + 0.15);
        }, set * 1000 + beep * 120); // 1000ms between sets, 120ms between beeps within a set
        alarmTimeouts.push(timeoutId);
      }
    }
  }

  function stopAlarm() {
    // Cancel all pending alarm timeouts
    alarmTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    alarmTimeouts = [];
  }

  bunja.effect(() => () => {
    stopAlarm(); // Clean up alarms when component unmounts
    ctx.close();
  });

  return { beep, boop, alarm, stopAlarm };
});
