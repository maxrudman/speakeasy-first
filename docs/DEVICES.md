# Device and browser support

Speak Ready uses **feature detection**, never browser sniffing, to decide what works. The user-agent string is only used to choose which help instructions to open first.

| Feature | Detected with | When missing |
|---|---|---|
| Recording | `navigator.mediaDevices.getUserMedia` + `MediaRecorder` | "This browser can't record audio. You can still type your answer below…" |
| Recording format | `MediaRecorder.isTypeSupported()` over WebM/Opus → Ogg/Opus → MP4/AAC → browser default | Browser default |
| Mic clean-up | `echoCancellation`, `noiseSuppression`, `autoGainControl` constraints | Retries with plain `audio: true` on `OverconstrainedError` |
| Live captions | `SpeechRecognition` / `webkitSpeechRecognition` | Server transcription after you stop, or type/paste |
| Level meter and silence check | `AudioContext` / `webkitAudioContext` actually running | Meter hidden; silence isn't judged (no false "we didn't hear you") |
| Dialogs | `HTMLDialogElement.showModal` | Falls back to the `open` attribute |
| Clipboard | `navigator.clipboard.writeText` | `execCommand("copy")` fallback |
| Push | `serviceWorker` + `PushManager` + `Notification` | iPhone: install to Home Screen first (iOS 16.4+); otherwise email |
| Install | `beforeinstallprompt` | Step-by-step guide for iPhone, Android and desktop |

## Browser-specific behavior we handle

- **iPhone/iPad Safari:** the audio context is created and resumed inside the tap, before the permission prompt, because Safari keeps contexts created later suspended. Form fields use 16px text on touch screens so focusing them doesn't zoom the page. `viewport-fit=cover` plus safe-area padding keep content clear of the notch and home indicator in both orientations. Safari records MP4/AAC, which every server transcriber accepts.
- **Chrome/Edge:** WebM recordings report `duration = Infinity`, which breaks the playback bar. The player seeks to the end once to get the real length. Live captions stop after a pause and are restarted, capped at 8 restarts in 10 seconds.
- **Firefox:** no live captions. Recording works (Ogg/WebM Opus), and the answer is transcribed on the server or typed.
- **In-app browsers** (Instagram, LinkedIn and others) often block the microphone. "Having trouble?" detects missing recording support and says to open the page in Safari or Chrome.

## Layout rules

- 320px phones up to large desktops, with no sideways scrolling. Long words wrap (`overflow-wrap: anywhere` in `main`).
- **Touch targets are at least 44×44px** on touch screens (`@media (pointer: coarse)` in `globals.css`). Mouse users keep compact controls.
- Phones: bottom tab bar plus a floating Coach button. Page bottom padding clears both, plus the home indicator.
- Short screens (phones in landscape, height ≤ 520px): the Coach opens full screen (`short:` variant).

## What was tested (Stage 6)

Automated in this repo's environment with **Chromium only**, using Playwright device emulation (viewport, touch, device scale and user agent). WebKit and Gecko engines weren't available there.

- **Audit** (overflow plus targets under 44px) on all four app pages at 320×568, iPhone 13 portrait and landscape, Pixel 7, iPad Mini, 1280 and 1920. Result: 0 overflow and 0 undersized targets on touch devices.
- **Flow** (log in, flashcard, practice, record, stop, playback, Coach, Journal, Account) on emulated Safari iPhone 13, iPhone SE, iPhone landscape, iPad, Safari Mac, Android Chrome Pixel 7, Firefox desktop, Edge desktop, and an old iOS profile without `MediaRecorder`. Live captions were removed for the Safari Mac, Firefox and old-iOS runs to exercise those fallbacks. All passed.

**Before the demo, please also try a real iPhone (Safari) and a real Android phone.** Record an answer, play it back, and check the transcript. Engine-level audio differences can only be confirmed on real devices.
